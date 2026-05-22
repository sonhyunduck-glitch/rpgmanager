/* ── 장비 상점 ── */
import { useGameStore } from '../../store/gameStore';
import { EQUIPMENT_TEMPLATES } from '../../data/gameData';
import type { ShopTab, EquipmentTemplate } from '../../types';
import { LABEL } from '../../styles/shared';

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

export default function EquipShop({
  tab, gold, inventory, inventoryCapacity,
}: {
  tab: ShopTab;
  gold: number;
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
