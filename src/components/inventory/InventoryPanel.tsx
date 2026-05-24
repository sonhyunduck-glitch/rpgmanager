/* =========================================================
   INVENTORY PANEL — 중앙: 가방 그리드 / 우측: 착용장비 + 강화
   ========================================================= */
import { useState } from 'react';
import { useGameStore, equipDisplayName } from '../../store/gameStore';
import type { Equipment } from '../../types';
import { MATERIALS } from '../../data/gameData';
import { LABEL, PANEL_FULL, chipStyle } from '../../styles/shared';
import EnhanceSidebar from './EnhanceSidebar';
import EquipCard from './EquipCard';

type FilterMode = 'all' | 'weapon' | 'defense' | 'material';

/* ── 착용 슬롯 정의 ── */
interface EquipSlotDef { key: string; label: string; }

const EQUIP_SLOTS: EquipSlotDef[] = [
  { key: 'weapon',   label: '무기'   },
  { key: 'helmet',   label: '투구'   },
  { key: 'armor',    label: '갑옷'   },
  { key: 'shield',   label: '방패'   },
  { key: 'cloak',    label: '망토'   },
  { key: 'gloves',   label: '장갑'   },
  { key: 'boots',    label: '장화'   },
  { key: 'tshirt',   label: '티셔츠' },
  { key: 'necklace', label: '목걸이' },
  { key: 'ring',     label: '반지'   },
  { key: 'ring2',    label: '반지2'  },
  { key: 'belt',     label: '벨트'   },
  { key: 'earring',  label: '귀걸이' },
];

function slotStatLine(eq: Equipment): string {
  const isWpn = eq.type === 'weapon' || eq.type === 'bow' || eq.type === 'staff';
  if (isWpn) {
    const enh = eq.enhanceLevel > 0 ? ` (+${eq.enhanceLevel})` : '';
    return `타격 ${eq.baseAtk}/${eq.baseAtkLarge}${enh}`;
  }
  return `AC ${eq.baseDef}+${eq.enhanceLevel}`;
}

/* ── 우측 탭 ── */
type RightTab = 'equip' | 'enhance';

/* ============================== COMPONENT ============================== */
export default function InventoryPanel() {
  const inventory = useGameStore(s => s.inventory);
  const inventoryCapacity = useGameStore(s => s.inventoryCapacity);
  const materials = useGameStore(s => s.materials);
  const equipFromInventory = useGameStore(s => s.equipFromInventory);
  const unequipToInventory = useGameStore(s => s.unequipToInventory);

  const enhanceTargetUid = useGameStore(s => s.enhanceTargetUid);
  const setEnhanceTarget = useGameStore(s => s.setEnhanceTarget);
  const tryEnhance = useGameStore(s => s.tryEnhance);

  const equippedMap: Record<string, Equipment | null> = {
    weapon:   useGameStore(s => s.equippedWeapon),
    tshirt:   useGameStore(s => s.equippedTshirt),
    helmet:   useGameStore(s => s.equippedHelmet),
    armor:    useGameStore(s => s.equippedArmor),
    cloak:    useGameStore(s => s.equippedCloak),
    gloves:   useGameStore(s => s.equippedGloves),
    boots:    useGameStore(s => s.equippedBoots),
    shield:   useGameStore(s => s.equippedShield),
    necklace: useGameStore(s => s.equippedNecklace),
    ring:     useGameStore(s => s.equippedRing),
    ring2:    useGameStore(s => s.equippedRing2),
    belt:     useGameStore(s => s.equippedBelt),
    earring:  useGameStore(s => s.equippedEarring),
  };

  const equippedItems = Object.values(equippedMap).filter((e): e is Equipment => e !== null);
  const equippedUids = new Set(equippedItems.map(e => e.uid));

  const [filter, setFilter] = useState<FilterMode>('all');
  const [rightTab, setRightTab] = useState<RightTab>('equip');

  const isWeaponType = (t: string) => t === 'weapon' || t === 'bow' || t === 'staff';
  const filteredInv = filter === 'all'
    ? inventory
    : filter === 'material'
      ? []
      : filter === 'weapon'
        ? inventory.filter(eq => isWeaponType(eq.type))
        : inventory.filter(eq => !isWeaponType(eq.type));

  const selectedUid = enhanceTargetUid;
  const selectedItem = selectedUid
    ? (equippedItems.find(e => e.uid === selectedUid) ?? inventory.find(e => e.uid === selectedUid) ?? null)
    : null;

  const emptySlots = Math.max(0, inventoryCapacity - inventory.length);
  const BAG_COLS = 5;

  return (
    <div style={{
      ...PANEL_FULL,
      display: 'grid',
      gridTemplateColumns: '1fr 280px',
      gap: 'var(--s-3)',
      padding: 'var(--s-4)',
    }}>
      {/* ━━━ CENTER: 가방 그리드 ━━━ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)', minHeight: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--s-2)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s-2)' }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--fs-md)' }}>가방</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', color: 'var(--text-dim)' }}>
              {inventory.length}/{inventoryCapacity}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
            {([
              ['all', '전체'],
              ['weapon', '무기'],
              ['defense', '방어구'],
              ['material', '재료'],
            ] as [FilterMode, string][]).map(([key, txt]) => (
              <button key={key} style={chipStyle(filter === key)} onClick={() => setFilter(key)}>
                {txt}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable grid */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
          {filter !== 'material' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${BAG_COLS}, 1fr)`,
              gap: 'var(--s-2)',
              alignContent: 'start',
            }}>
              {filteredInv.map(eq => (
                <EquipCard
                  key={eq.uid}
                  eq={eq}
                  isEquipped={false}
                  isSelected={eq.uid === selectedUid}
                  onSelect={() => { setEnhanceTarget(eq.uid); setRightTab('enhance'); }}
                  onAction={() => equipFromInventory(eq.uid)}
                  actionLabel="착용"
                  actionStyle="success"
                />
              ))}
              {filter === 'all' && Array.from({ length: Math.min(emptySlots, 10) }, (_, i) => (
                <div key={`empty-${i}`} style={{
                  border: '1px dashed var(--border-soft)',
                  borderRadius: 'var(--r-sm)',
                  minHeight: 88,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-faint)',
                  fontSize: 'var(--fs-xs)',
                }}>
                  빈 슬롯
                </div>
              ))}
            </div>
          )}

          {/* Materials */}
          {(filter === 'all' || filter === 'material') && (
            <div>
              <div style={{ ...LABEL, marginBottom: 'var(--s-2)' }}>보유 재료</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 'var(--s-2)',
              }}>
                {Object.entries(materials)
                  .filter(([, qty]) => qty > 0)
                  .map(([matId, qty]) => {
                    const mat = MATERIALS[matId];
                    return (
                      <div key={matId} style={{
                        background: 'var(--bg-sunken)',
                        border: '1px solid var(--border-soft)',
                        borderRadius: 'var(--r-xs)',
                        padding: '6px var(--s-3)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-dim)' }}>
                          {mat?.name ?? matId}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', color: 'var(--text)' }}>
                          x{qty}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ━━━ RIGHT: 착용장비 / 강화 탭 전환 ━━━ */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        minHeight: 0,
        overflow: 'hidden',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-md)',
      }}>
        {/* Tab buttons */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-soft)',
          flexShrink: 0,
        }}>
          {([
            ['equip', '착용장비'] as const,
            ['enhance', '강화'] as const,
          ]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setRightTab(tab)}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                borderBottom: rightTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'transparent',
                color: rightTab === tab ? 'var(--accent)' : 'var(--text-mute)',
                fontSize: 'var(--fs-xs)',
                fontWeight: 700,
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {rightTab === 'equip' ? (
            /* ── 착용장비 목록 ── */
            <div style={{
              height: '100%',
              overflowY: 'auto',
              padding: 'var(--s-2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}>
              {EQUIP_SLOTS.map(slot => {
                const eq = equippedMap[slot.key];
                const isSelected = eq ? eq.uid === selectedUid : false;

                return (
                  <div
                    key={slot.key}
                    onClick={() => {
                      if (eq) { setEnhanceTarget(eq.uid); setRightTab('enhance'); }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '5px 8px',
                      borderRadius: 'var(--r-sm)',
                      background: isSelected
                        ? 'color-mix(in oklch, var(--accent) 10%, transparent)'
                        : 'transparent',
                      border: isSelected
                        ? '1px solid color-mix(in oklch, var(--accent) 40%, transparent)'
                        : '1px solid transparent',
                      cursor: eq ? 'pointer' : 'default',
                      transition: 'all 0.12s',
                    }}
                  >
                    {/* Slot label */}
                    <span style={{
                      fontSize: '10px',
                      color: 'var(--text-mute)',
                      minWidth: 36,
                      flexShrink: 0,
                    }}>
                      {slot.label}
                    </span>

                    {eq ? (
                      <>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {equipDisplayName(eq)}
                          </div>
                          <div style={{
                            fontSize: '10px',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--success)',
                          }}>
                            {slotStatLine(eq)}
                          </div>
                        </div>
                        {/* Unequip */}
                        <button
                          onClick={e => { e.stopPropagation(); unequipToInventory(eq.uid); }}
                          style={{
                            padding: '2px 6px',
                            border: '1px solid var(--border-soft)',
                            borderRadius: 'var(--r-xs)',
                            background: 'transparent',
                            color: 'var(--text-mute)',
                            fontSize: '9px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          해제
                        </button>
                      </>
                    ) : (
                      <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>—</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── 강화 패널 ── */
            <EnhanceSidebar
              selectedItem={selectedItem}
              equippedUids={equippedUids}
              materials={materials}
              tryEnhance={tryEnhance}
            />
          )}
        </div>
      </div>
    </div>
  );
}
