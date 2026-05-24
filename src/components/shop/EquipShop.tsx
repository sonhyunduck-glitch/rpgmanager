/* ── 장비 상점 ── */
import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { EQUIPMENT_TEMPLATES } from '../../data/gameData';
import { canClassEquip } from '../../data/classData';
import type { ShopTab, EquipmentTemplate, PlayerClass } from '../../types';
// shared styles not needed — sub-tabs use inline styles

/** 공격 타입 장비인지 (무기/활/지팡이) */
function isAtkType(t: string): boolean {
  return t === 'weapon' || t === 'bow' || t === 'staff';
}

/** 클래스 뱃지 표시용 */
const CLASS_BADGE: Record<PlayerClass, { icon: string; label: string }> = {
  knight: { icon: '⚔️', label: '기사' },
  elf:    { icon: '🏹', label: '요정' },
  wizard: { icon: '🔮', label: '마법사' },
};

/** 착용 가능 클래스 뱃지 렌더 */
function ClassBadges({ restriction, playerClass }: {
  restriction?: PlayerClass[];
  playerClass: PlayerClass;
}) {
  if (!restriction) return null; // 전 클래스 착용 가능 → 뱃지 불필요
  const myClass = restriction.includes(playerClass);
  return (
    <div style={{
      display: 'flex', gap: 3, marginTop: 2,
      fontSize: '10px',
    }}>
      {restriction.map(cls => {
        const b = CLASS_BADGE[cls];
        const isMe = cls === playerClass;
        return (
          <span
            key={cls}
            style={{
              padding: '0 4px',
              borderRadius: 'var(--r-xs)',
              background: isMe
                ? 'color-mix(in oklch, var(--accent) 15%, transparent)'
                : 'color-mix(in oklch, var(--text-mute) 8%, transparent)',
              color: isMe ? 'var(--accent)' : 'var(--text-mute)',
              fontWeight: isMe ? 700 : 400,
              lineHeight: '16px',
            }}
          >
            {b.icon}{b.label}
          </span>
        );
      })}
      {!myClass && (
        <span style={{ color: 'var(--danger)', fontWeight: 600, lineHeight: '16px' }}>
          착용불가
        </span>
      )}
    </div>
  );
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
function EquipRow({ tmpl, canBuy, canEquipClass, playerClass, onClickBuy }: {
  tmpl: EquipmentTemplate;
  canBuy: boolean;
  canEquipClass: boolean;
  playerClass: PlayerClass;
  onClickBuy: () => void;
}) {
  const shopPrice = tmpl.sellPrice * 2;
  const buyable = canBuy && canEquipClass;
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
        opacity: canEquipClass ? 1 : 0.5,
      }}
    >
      {/* 정보 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700, fontSize: 'var(--fs-sm)',
          color: canEquipClass ? 'var(--text)' : 'var(--text-mute)',
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
        <ClassBadges restriction={tmpl.classRestriction} playerClass={playerClass} />
        {tmpl.bonusEffects && tmpl.bonusEffects.length > 0 && (
          <div style={{
            display: 'flex', gap: 6, marginTop: 2,
            fontSize: 'var(--fs-xs)', color: 'var(--info)',
            fontFamily: 'var(--font-mono)',
            flexWrap: 'wrap',
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
        onClick={() => buyable && onClickBuy()}
        disabled={!buyable}
        style={{
          padding: '5px 10px',
          borderRadius: 'var(--r-sm)',
          border: buyable
            ? '1px solid var(--accent)'
            : '1px solid var(--border-soft)',
          background: buyable
            ? 'color-mix(in oklch, var(--accent) 10%, transparent)'
            : 'var(--bg-sunken)',
          color: buyable ? 'var(--accent)' : 'var(--text-mute)',
          fontSize: 'var(--fs-sm)',
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          cursor: buyable ? 'pointer' : 'not-allowed',
          opacity: buyable ? 1 : 0.5,
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

  // 구매 확인 다이얼로그 상태
  const [confirmItem, setConfirmItem] = useState<EquipmentTemplate | null>(null);

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

  // 클래스 필터 제거 — 모든 아이템 표시 (착용불가 아이템은 흐리게)
  const items = all
    .filter(t => t.type === activeGroup.type)
    .sort((a, b) => {
      // 착용 가능 아이템 먼저, 그 다음 가격순
      const aEquip = canClassEquip(playerClass, a.type, a.classRestriction) ? 0 : 1;
      const bEquip = canClassEquip(playerClass, b.type, b.classRestriction) ? 0 : 1;
      if (aEquip !== bEquip) return aEquip - bEquip;
      return a.sellPrice - b.sellPrice;
    });

  const handleConfirmBuy = () => {
    if (confirmItem) {
      buyEquip(confirmItem.id);
      setConfirmItem(null);
    }
  };

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
          const canBuyGold = gold >= shopPrice && !isFull;
          const equipOk = canClassEquip(playerClass, tmpl.type, tmpl.classRestriction);
          return (
            <EquipRow
              key={tmpl.id}
              tmpl={tmpl}
              canBuy={canBuyGold}
              canEquipClass={equipOk}
              playerClass={playerClass}
              onClickBuy={() => setConfirmItem(tmpl)}
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

      {/* ── 구매 확인 다이얼로그 ── */}
      {confirmItem && (
        <div
          onClick={() => setConfirmItem(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              padding: 'var(--s-5)',
              minWidth: 260,
              maxWidth: 340,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--s-3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{
              fontSize: 'var(--fs-base)',
              fontWeight: 700,
              color: 'var(--text)',
              textAlign: 'center',
            }}>
              구매 확인
            </div>

            <div style={{
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)',
              padding: 'var(--s-3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--s-1)',
            }}>
              <div style={{
                fontWeight: 700,
                fontSize: 'var(--fs-sm)',
                color: 'var(--text)',
              }}>
                {confirmItem.name}
              </div>
              <div style={{
                fontSize: 'var(--fs-xs)',
                color: 'var(--text-mute)',
                fontFamily: 'var(--font-mono)',
              }}>
                {isAtkType(confirmItem.type)
                  ? `타격 ${confirmItem.baseAtk}/${confirmItem.baseAtkLarge}`
                  : `AC ${confirmItem.baseDef}`}
                {confirmItem.isTwoHanded && ' (양손)'}
              </div>
              <ClassBadges restriction={confirmItem.classRestriction} playerClass={playerClass} />
            </div>

            <div style={{
              textAlign: 'center',
              fontSize: 'var(--fs-base)',
              fontWeight: 700,
              color: 'var(--accent)',
              fontFamily: 'var(--font-mono)',
            }}>
              {(confirmItem.sellPrice * 2).toLocaleString()} Gold
            </div>

            <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
              <button
                onClick={() => setConfirmItem(null)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  background: 'transparent',
                  color: 'var(--text-mute)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleConfirmBuy}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  border: 'none',
                  borderRadius: 'var(--r-sm)',
                  background: 'linear-gradient(135deg, var(--accent), oklch(0.65 0.2 260))',
                  color: '#fff',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                구매
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
