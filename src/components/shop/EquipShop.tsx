/* ── 장비 상점 ── */
import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { EQUIPMENT_TEMPLATES } from '../../data/gameData';
import type { ShopTab, EquipmentTemplate } from '../../types';
// shared styles not needed — sub-tabs use inline styles

/** 공격 타입 장비인지 (무기/활/지팡이) */
function isAtkType(t: string): boolean {
  return t === 'weapon' || t === 'bow' || t === 'staff';
}

const ARMOR_GROUPS: { type: string; label: string }[] = [
  { type: 'tshirt', label: '티셔츠' },
  { type: 'helmet', label: '투구' },
  { type: 'armor',  label: '갑옷' },
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

/* ── 장비 아이템 행 ── */
function EquipRow({ tmpl, canBuy, buyEquip }: {
  tmpl: EquipmentTemplate;
  canBuy: boolean;
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
          fontWeight: 700, fontSize: 'var(--fs-sm)',
          color: 'var(--text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {tmpl.name}
        </div>
        <div style={{
          display: 'flex', gap: 8, marginTop: 2,
          fontSize: 'var(--fs-xs)', color: 'var(--text-mute)',
          fontFamily: 'var(--font-mono)',
        }}>
          <span>{isAtkType(tmpl.type) ? `타격 ${tmpl.baseAtk}/${tmpl.baseAtkLarge}` : `AC ${tmpl.baseDef}`}</span>
          {tmpl.isTwoHanded && <span style={{ color: 'var(--accent)' }}>양손</span>}
        </div>
        {tmpl.bonusEffects && tmpl.bonusEffects.length > 0 && (
          <div style={{
            display: 'flex', gap: 6, marginTop: 2,
            fontSize: 'var(--fs-xs)', color: 'var(--info)',
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
          fontSize: 'var(--fs-sm)',
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

export default function EquipShop({
  tab, gold, inventory, inventoryCapacity,
}: {
  tab: ShopTab;
  gold: number;
  inventory: { uid: string }[];
  inventoryCapacity: number;
}) {
  const buyEquip = useGameStore(s => s.buyEquipFromShop);
  const playerClass = useGameStore(s => s.playerClass);
  const all = Object.values(EQUIPMENT_TEMPLATES);
  const isFull = inventory.length >= inventoryCapacity;

  // 부위별 카테고리 그룹
  const WEAPON_GROUPS: { type: string; label: string }[] = [
    { type: 'weapon', label: '검/창/둔기' },
    { type: 'bow',    label: '활' },
    { type: 'staff',  label: '지팡이' },
  ];

  const groups = tab === 'weapon'
    ? WEAPON_GROUPS
    : tab === 'armor'
      ? ARMOR_GROUPS
      : ACCESSORY_GROUPS;

  // 서브탭 (카테고리 선택)
  const [subType, setSubType] = useState<string>(groups[0].type);

  // 탭 변경 시 서브탭 리셋
  const activeGroup = groups.find(g => g.type === subType) ?? groups[0];

  const items = all
    .filter(t => t.type === activeGroup.type)
    .filter(t => !t.classRestriction || t.classRestriction.includes(playerClass))
    .sort((a, b) => a.sellPrice - b.sellPrice);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
      {/* 서브탭 (카테고리가 2개 이상일 때) */}
      {groups.length > 1 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--s-1)',
        }}>
          {groups.map(g => {
            const isActive = activeGroup.type === g.type;
            const count = all.filter(t => t.type === g.type).length;
            return (
              <button
                key={g.type}
                onClick={() => setSubType(g.type)}
                style={{
                  padding: 'var(--s-1) var(--s-2)',
                  borderRadius: 'var(--r-xs)',
                  border: isActive
                    ? '1px solid var(--accent)'
                    : '1px solid var(--border-soft)',
                  background: isActive
                    ? 'color-mix(in oklch, var(--accent) 15%, transparent)'
                    : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-mute)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-ui)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {g.label}
                <span style={{
                  marginLeft: 3,
                  fontSize: 'var(--fs-2xs)',
                  opacity: 0.7,
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 아이템 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
        {items.map(tmpl => {
          const shopPrice = tmpl.sellPrice * 2;
          const canBuy = gold >= shopPrice && !isFull;
          return (
            <EquipRow
              key={tmpl.id}
              tmpl={tmpl}
              canBuy={canBuy}
              buyEquip={buyEquip}
            />
          );
        })}
        {items.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: 'var(--s-4)',
            fontSize: 'var(--fs-sm)',
            color: 'var(--text-mute)',
          }}>
            판매 중인 장비가 없습니다
          </div>
        )}
      </div>

      {isFull && (
        <div style={{
          textAlign: 'center',
          padding: 'var(--s-2)',
          fontSize: 'var(--fs-sm)',
          color: 'var(--danger)',
        }}>
          인벤토리가 가득 찼습니다
        </div>
      )}
    </div>
  );
}
