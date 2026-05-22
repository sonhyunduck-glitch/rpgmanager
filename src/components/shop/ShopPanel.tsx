/* =========================================================
   SHOP PANEL — 물약 / 무기 / 방어구 / 악세사리 / 판매
   ========================================================= */
import { useState } from 'react';
import { useGameStore, equipDisplayName } from '../../store/gameStore';
import {
  POTIONS, POTION_ORDER,
  EQUIPMENT_TEMPLATES, MATERIALS,
} from '../../data/gameData';
import type { ShopTab, EquipmentTemplate, Equipment } from '../../types';
import { LABEL, PANEL_FULL, TAB_CONTAINER, tabStyle } from '../../styles/shared';
// helpers not needed here — shop uses store actions directly

type FullShopTab = ShopTab | 'sell';

const TABS: { key: FullShopTab; label: string }[] = [
  { key: 'potion', label: '물약' },
  { key: 'weapon', label: '무기' },
  { key: 'armor', label: '방어구' },
  { key: 'accessory', label: '악세사리' },
  { key: 'scroll', label: '주문서' },
  { key: 'sell', label: '판매' },
];

const SCROLL_SHOP_ITEMS: { id: string; price: number }[] = [
  { id: 'weapon_scroll', price: 75000 },
  { id: 'blessed_weapon_scroll', price: 150000 },
  { id: 'cursed_weapon_scroll', price: 15000 },
  { id: 'armor_scroll', price: 31000 },
  { id: 'blessed_armor_scroll', price: 62000 },
  { id: 'cursed_armor_scroll', price: 6200 },
];

const ARMOR_GROUPS: { type: string; label: string }[] = [
  { type: 'tshirt', label: '티셔츠' },
  { type: 'armor',  label: '갑옷' },
  { type: 'helmet', label: '투구' },
  { type: 'cloak',  label: '망토' },
  { type: 'gloves', label: '장갑' },
  { type: 'boots',  label: '부츠' },
  { type: 'shield', label: '방패' },
];
const ACCESSORY_GROUPS: { type: string; label: string }[] = [
  { type: 'necklace', label: '목걸이' },
  { type: 'ring',     label: '반지' },
  { type: 'belt',     label: '벨트' },
];

export default function ShopPanel() {
  const [tab, setTab] = useState<FullShopTab>('potion');
  const gold = useGameStore(s => s.gold);
  const level = useGameStore(s => s.level);
  const potions = useGameStore(s => s.potions);
  const buyPotion = useGameStore(s => s.buyPotion);
  const inventory = useGameStore(s => s.inventory);
  const inventoryCapacity = useGameStore(s => s.inventoryCapacity);
  const materials = useGameStore(s => s.materials);
  const sellFromInventory = useGameStore(s => s.sellFromInventory);
  const buyMaterial = useGameStore(s => s.buyMaterial);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--s-3)',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Header + Tabs */}
      <div style={{
        ...PANEL_FULL,
        gap: 'var(--s-3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 'var(--fs-md)' }}>상점</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--accent)',
            fontWeight: 700,
          }}>
            {gold.toLocaleString()} G
          </span>
        </div>

        {/* Tabs */}
        <div style={TAB_CONTAINER}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={tabStyle(tab === t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {tab === 'potion' && (
            <PotionShop
              gold={gold}
              level={level}
              potions={potions}
              buyPotion={buyPotion}
            />
          )}
          {tab === 'scroll' && (
            <ScrollShop
              gold={gold}
              materials={materials}
              buyMaterial={buyMaterial}
            />
          )}
          {(tab === 'weapon' || tab === 'armor' || tab === 'accessory') && (
            <EquipShop
              tab={tab}
              gold={gold}
              level={level}
              inventory={inventory}
              inventoryCapacity={inventoryCapacity}
            />
          )}
          {tab === 'sell' && (
            <SellShop
              inventory={inventory}
              sellFromInventory={sellFromInventory}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 판매 상점 ── */
function SellShop({
  inventory, sellFromInventory,
}: {
  inventory: Equipment[];
  sellFromInventory: (uid: string) => void;
}) {
  if (inventory.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: 'var(--s-6)',
        color: 'var(--text-mute)',
        fontSize: 'var(--fs-sm)',
      }}>
        판매할 장비가 없습니다
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
      {inventory.map(eq => {
        const isWpn = eq.type === 'weapon';

        return (
          <div
            key={eq.uid}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--s-3)',
              padding: 'var(--s-2) var(--s-3)',
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)',
            }}
          >
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 700, fontSize: 12,
                color: 'var(--text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {equipDisplayName(eq)}
              </div>
              <div style={{
                display: 'flex', gap: 8, marginTop: 2,
                fontSize: 10, color: 'var(--text-mute)',
                fontFamily: 'var(--font-mono)',
              }}>
                <span>{isWpn ? `타격 ${eq.baseAtk}/${eq.baseAtkLarge}` : `AC ${eq.baseDef}+${eq.enhanceLevel}`}{eq.enhanceLevel > 0 && eq.type === 'weapon' && ` (+${eq.enhanceLevel})`}</span>
              </div>
              {eq.bonusEffects.length > 0 && (
                <div style={{
                  display: 'flex', gap: 6, marginTop: 2,
                  fontSize: 9, color: 'var(--info)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {eq.bonusEffects.map((eff, i) => (
                    <span key={i}>{eff.replace(' (미구현)', '')}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Sell button */}
            <button
              onClick={() => sellFromInventory(eq.uid)}
              style={{
                padding: '5px 10px',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--danger)',
                background: 'color-mix(in oklch, var(--danger) 10%, transparent)',
                color: 'var(--danger)',
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {eq.sellPrice.toLocaleString()}G 판매
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ── 물약 상점 ── */
function PotionShop({
  gold, level, potions, buyPotion,
}: {
  gold: number; level: number;
  potions: Record<string, number>;
  buyPotion: (id: string, qty: number) => void;
}) {
  const POTION_COLOR: Record<string, string> = {
    red_potion: '#ef5350',
    crimson_potion: '#ff7043',
    clear_potion: '#42a5f5',
    green_potion: '#66bb6a',
    courage_potion: '#ab47bc',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
      {POTION_ORDER.map(id => {
        const p = POTIONS[id];
        const owned = potions[id] ?? 0;
        const color = POTION_COLOR[id] ?? 'var(--text-dim)';
        const locked = level < p.requiredLevel;

        return (
          <div
            key={id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--s-3)',
              padding: 'var(--s-3)',
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)',
              opacity: locked ? 0.4 : 1,
            }}
          >
            {/* 물약 아이콘 */}
            <div style={{
              width: 32, height: 32,
              borderRadius: 'var(--r-sm)',
              background: `color-mix(in oklch, ${color} 15%, transparent)`,
              border: `1px solid color-mix(in oklch, ${color} 30%, transparent)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: color,
                boxShadow: `0 0 6px ${color}`,
              }} />
            </div>

            {/* 정보 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color }}>
                {p.name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 2 }}>
                {p.buffDuration ? (
                  <>
                    {p.atkSpeedMult && p.atkSpeedMult > 1 && `공속 ×${p.atkSpeedMult}`}
                    {p.moveSpeedMult && p.moveSpeedMult > 1 && ` 이속 ×${p.moveSpeedMult}`}
                    {` (${p.buffDuration}초)`}
                  </>
                ) : (
                  <>HP {p.healMin}~{p.healMax} 회복</>
                )}
                {locked && (
                  <span style={{ color: 'var(--danger)', marginLeft: 6 }}>
                    Lv.{p.requiredLevel} 필요
                  </span>
                )}
              </div>
            </div>

            {/* 보유 수량 */}
            <div style={{ textAlign: 'center', minWidth: 40 }}>
              <div style={{ ...LABEL, fontSize: 7 }}>보유</div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                fontSize: 14,
                color: owned > 0 ? 'var(--text)' : 'var(--text-mute)',
              }}>
                {owned}
              </div>
            </div>

            {/* 구매 버튼들 */}
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {[1, 10, 50].map(qty => {
                const cost = p.buyPrice * qty;
                const canBuy = !locked && gold >= cost;
                return (
                  <button
                    key={qty}
                    onClick={() => canBuy && buyPotion(id, qty)}
                    disabled={!canBuy}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 'var(--r-xs)',
                      border: '1px solid var(--border-soft)',
                      background: canBuy ? 'var(--bg-panel)' : 'var(--bg-sunken)',
                      color: canBuy ? 'var(--accent)' : 'var(--text-mute)',
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      cursor: canBuy ? 'pointer' : 'not-allowed',
                      opacity: canBuy ? 1 : 0.5,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <span>+{qty}</span>
                    <span style={{ fontSize: 8, color: 'var(--text-mute)' }}>
                      {cost}G
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── 주문서 상점 ── */
function ScrollShop({
  gold, materials, buyMaterial,
}: {
  gold: number;
  materials: Record<string, number>;
  buyMaterial: (id: string, qty: number, unitPrice: number) => void;
}) {
  const SCROLL_COLORS: Record<string, string> = {
    weapon_scroll: 'var(--text)',
    blessed_weapon_scroll: '#F5C518',
    cursed_weapon_scroll: 'var(--danger)',
    armor_scroll: 'var(--text)',
    blessed_armor_scroll: '#F5C518',
    cursed_armor_scroll: 'var(--danger)',
  };
  const SCROLL_GLOW: Record<string, string | undefined> = {
    blessed_weapon_scroll: '0 0 6px rgba(245,197,24,0.6), 0 0 14px rgba(245,197,24,0.3)',
    blessed_armor_scroll: '0 0 6px rgba(245,197,24,0.6), 0 0 14px rgba(245,197,24,0.3)',
  };

  const GROUPS = [
    { label: '무기 주문서', ids: ['weapon_scroll', 'blessed_weapon_scroll', 'cursed_weapon_scroll'] },
    { label: '방어구 주문서', ids: ['armor_scroll', 'blessed_armor_scroll', 'cursed_armor_scroll'] },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
      {GROUPS.map(group => (
        <div key={group.label}>
          <div style={{
            ...LABEL,
            fontSize: 10,
            marginBottom: 'var(--s-2)',
            paddingBottom: 'var(--s-1)',
            borderBottom: '1px solid var(--border-soft)',
          }}>
            {group.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
            {group.ids.map(id => {
              const item = SCROLL_SHOP_ITEMS.find(s => s.id === id);
              if (!item) return null;
              const mat = MATERIALS[id];
              if (!mat) return null;
              const owned = materials[id] ?? 0;
              const color = SCROLL_COLORS[id] ?? 'var(--text)';

              return (
                <div
                  key={id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--s-3)',
                    padding: 'var(--s-3)',
                    background: 'var(--bg-sunken)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 'var(--r-sm)',
                  }}
                >
                  {/* 이름 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color, textShadow: SCROLL_GLOW[id] }}>
                      {mat.name}
                    </div>
                  </div>

                  {/* 보유 수량 */}
                  <div style={{ textAlign: 'center', minWidth: 40 }}>
                    <div style={{ ...LABEL, fontSize: 7 }}>보유</div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      fontSize: 14,
                      color: owned > 0 ? 'var(--text)' : 'var(--text-mute)',
                    }}>
                      {owned}
                    </div>
                  </div>

                  {/* 구매 버튼들 */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {[1, 10, 50].map(qty => {
                      const cost = item.price * qty;
                      const canBuy = gold >= cost;
                      return (
                        <button
                          key={qty}
                          onClick={() => canBuy && buyMaterial(id, qty, item.price)}
                          disabled={!canBuy}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 'var(--r-xs)',
                            border: '1px solid var(--border-soft)',
                            background: canBuy ? 'var(--bg-panel)' : 'var(--bg-sunken)',
                            color: canBuy ? 'var(--accent)' : 'var(--text-mute)',
                            fontSize: 10,
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            cursor: canBuy ? 'pointer' : 'not-allowed',
                            opacity: canBuy ? 1 : 0.5,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 1,
                          }}
                        >
                          <span>+{qty}</span>
                          <span style={{ fontSize: 8, color: 'var(--text-mute)' }}>
                            {cost}G
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── 장비 아이템 행 ── */
function EquipRow({ tmpl, canBuy, isFull, buyEquip }: {
  tmpl: EquipmentTemplate;
  canBuy: boolean;
  isFull: boolean;
  buyEquip: (id: string) => void;
}) {
  const shopPrice = tmpl.sellPrice * 2;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--s-3)',
        padding: 'var(--s-2) var(--s-3)',
        background: 'var(--bg-sunken)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-sm)',
      }}
    >
      {/* 정보 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700, fontSize: 12,
          color: 'var(--text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {tmpl.name}
        </div>
        <div style={{
          display: 'flex', gap: 8, marginTop: 2,
          fontSize: 10, color: 'var(--text-mute)',
          fontFamily: 'var(--font-mono)',
        }}>
          <span>{tmpl.type === 'weapon' ? `타격 ${tmpl.baseAtk}/${tmpl.baseAtkLarge}` : `AC ${tmpl.baseDef}`}</span>
        </div>
        {tmpl.bonusEffects && tmpl.bonusEffects.length > 0 && (
          <div style={{
            display: 'flex', gap: 6, marginTop: 2,
            fontSize: 9, color: 'var(--info)',
            fontFamily: 'var(--font-mono)',
          }}>
            {tmpl.bonusEffects.map((eff, i) => {
              const label = eff.replace(' (미구현)', '');
              return <span key={i}>{label}</span>;
            })}
          </div>
        )}
      </div>

      {/* 가격 + 구매 */}
      <button
        onClick={() => canBuy && buyEquip(tmpl.id)}
        disabled={!canBuy}
        style={{
          padding: '5px 10px',
          borderRadius: 'var(--r-sm)',
          border: canBuy
            ? '1px solid var(--accent)'
            : '1px solid var(--border-soft)',
          background: canBuy
            ? 'color-mix(in oklch, var(--accent) 10%, transparent)'
            : 'var(--bg-sunken)',
          color: canBuy ? 'var(--accent)' : 'var(--text-mute)',
          fontSize: 11,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          cursor: canBuy ? 'pointer' : 'not-allowed',
          opacity: canBuy ? 1 : 0.5,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {shopPrice.toLocaleString()}G
      </button>
    </div>
  );
}

/* ── 장비 상점 ── */
function EquipShop({
  tab, gold, level, inventory, inventoryCapacity,
}: {
  tab: ShopTab;
  gold: number; level: number;
  inventory: { uid: string }[];
  inventoryCapacity: number;
}) {
  const buyEquip = useGameStore(s => s.buyEquipFromShop);
  const all = Object.values(EQUIPMENT_TEMPLATES);
  const isFull = inventory.length >= inventoryCapacity;

  // 부위별 카테고리 그룹
  const groups = tab === 'weapon'
    ? [{ type: 'weapon', label: '무기' }]
    : tab === 'armor'
      ? ARMOR_GROUPS
      : ACCESSORY_GROUPS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
      {groups.map(group => {
        const items = all
          .filter(t => t.type === group.type)
          .sort((a, b) => a.sellPrice - b.sellPrice);
        if (items.length === 0) return null;

        return (
          <div key={group.type}>
            {/* 카테고리 헤더 — 무기 탭은 단일이므로 숨김 */}
            {groups.length > 1 && (
              <div style={{
                ...LABEL,
                fontSize: 10,
                marginBottom: 'var(--s-2)',
                paddingBottom: 'var(--s-1)',
                borderBottom: '1px solid var(--border-soft)',
              }}>
                {group.label}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
              {items.map(tmpl => {
                const shopPrice = tmpl.sellPrice * 2;
                const canBuy = gold >= shopPrice && !isFull;
                return (
                  <EquipRow
                    key={tmpl.id}
                    tmpl={tmpl}
                    canBuy={canBuy}
                    isFull={isFull}
                    buyEquip={buyEquip}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {isFull && (
        <div style={{
          textAlign: 'center',
          padding: 'var(--s-2)',
          fontSize: 11,
          color: 'var(--danger)',
        }}>
          인벤토리가 가득 찼습니다
        </div>
      )}
    </div>
  );
}
