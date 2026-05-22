/* =========================================================
   INVENTORY PANEL — 인벤토리 (착용 장비 + 가방 + 강화)
   ========================================================= */
import { useState, useEffect, useRef } from 'react';
import { useGameStore, equipDisplayName } from '../../store/gameStore';
import type { Equipment, ScrollType } from '../../types';
import {
  MATERIALS,
  getEnhanceRate, isEnhanceSafe, getScrollId,
} from '../../data/gameData';
import { LABEL, PANEL_FULL, chipStyle } from '../../styles/shared';

type FilterMode = 'all' | 'weapon' | 'defense' | 'material';

/* ── rate colour helper ── */
function rateColor(rate: number) {
  if (rate > 0.7) return 'var(--success)';
  if (rate > 0.4) return 'var(--warning)';
  return 'var(--danger)';
}

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

  // All equipped items
  const equippedWeapon = useGameStore(s => s.equippedWeapon);
  const equippedTshirt = useGameStore(s => s.equippedTshirt);
  const equippedHelmet = useGameStore(s => s.equippedHelmet);
  const equippedArmor = useGameStore(s => s.equippedArmor);
  const equippedCloak = useGameStore(s => s.equippedCloak);
  const equippedGloves = useGameStore(s => s.equippedGloves);
  const equippedBoots = useGameStore(s => s.equippedBoots);
  const equippedShield = useGameStore(s => s.equippedShield);
  const equippedNecklace = useGameStore(s => s.equippedNecklace);
  const equippedRing = useGameStore(s => s.equippedRing);
  const equippedRing2 = useGameStore(s => s.equippedRing2);
  const equippedBelt = useGameStore(s => s.equippedBelt);

  const allEquipped: (Equipment | null)[] = [
    equippedWeapon, equippedTshirt, equippedHelmet, equippedArmor, equippedCloak,
    equippedGloves, equippedBoots, equippedShield,
    equippedNecklace, equippedRing, equippedRing2, equippedBelt,
  ];
  const equippedItems = allEquipped.filter((e): e is Equipment => e !== null);
  const equippedUids = new Set(equippedItems.map(e => e.uid));

  const [filter, setFilter] = useState<FilterMode>('all');

  // Filter inventory (non-equipped) items
  const filteredInv = filter === 'all'
    ? inventory
    : filter === 'material'
      ? []
      : filter === 'weapon'
        ? inventory.filter(eq => eq.type === 'weapon')
        : inventory.filter(eq => eq.type !== 'weapon');

  // Filter equipped items (same logic)
  const filteredEquipped = filter === 'all'
    ? equippedItems
    : filter === 'material'
      ? []
      : filter === 'weapon'
        ? equippedItems.filter(eq => eq.type === 'weapon')
        : equippedItems.filter(eq => eq.type !== 'weapon');

  // Currently selected for enhance
  const selectedUid = enhanceTargetUid;
  const selectedItem = selectedUid
    ? (equippedItems.find(e => e.uid === selectedUid) ?? inventory.find(e => e.uid === selectedUid) ?? null)
    : null;

  const emptySlots = Math.max(0, inventoryCapacity - inventory.length);
  const GRID_COLS = 4;

  return (
    <div style={{
      ...PANEL_FULL,
      display: 'grid',
      gridTemplateColumns: '1fr 280px',
      gap: 'var(--s-4)',
      padding: 'var(--s-5)',
    }}>
      {/* ━━━ LEFT: Item Grid ━━━ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)', minHeight: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--s-2)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s-2)' }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--fs-md)' }}>인벤토리</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', color: 'var(--text-dim)' }}>
              {inventory.length}/{inventoryCapacity}
            </span>
          </div>
        </div>

        {/* Filter chips */}
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

        {/* Scrollable grid area */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>

          {/* ── Equipped Section ── */}
          {filter !== 'material' && filteredEquipped.length > 0 && (
            <div>
              <div style={{ ...LABEL, marginBottom: 'var(--s-2)', fontSize: 10 }}>착용 중</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                gap: 'var(--s-2)',
              }}>
                {filteredEquipped.map(eq => (
                  <EquipCard
                    key={eq.uid}
                    eq={eq}
                    isEquipped
                    isSelected={eq.uid === selectedUid}
                    onSelect={() => setEnhanceTarget(eq.uid)}
                    onAction={() => unequipToInventory(eq.uid)}
                    actionLabel="해제"
                    actionStyle="ghost"
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Inventory Section ── */}
          {filter !== 'material' && (
            <div>
              {filteredEquipped.length > 0 && filteredInv.length > 0 && (
                <div style={{ ...LABEL, marginBottom: 'var(--s-2)', fontSize: 10 }}>가방</div>
              )}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                gap: 'var(--s-2)',
                alignContent: 'start',
              }}>
                {filteredInv.map(eq => (
                  <EquipCard
                    key={eq.uid}
                    eq={eq}
                    isEquipped={false}
                    isSelected={eq.uid === selectedUid}
                    onSelect={() => setEnhanceTarget(eq.uid)}
                    onAction={() => equipFromInventory(eq.uid)}
                    actionLabel="착용"
                    actionStyle="success"
                  />
                ))}
                {/* Empty slots */}
                {filter === 'all' && Array.from({ length: Math.min(emptySlots, 8) }, (_, i) => (
                  <div key={`empty-${i}`} style={{
                    border: '1px dashed var(--border-soft)',
                    borderRadius: 'var(--r-sm)',
                    minHeight: 100,
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
            </div>
          )}

          {/* ── Materials Section ── */}
          {(filter === 'all' || filter === 'material') && (
            <div>
              <div style={{ ...LABEL, marginBottom: 'var(--s-2)' }}>보유 재료</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
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
                        padding: '8px var(--s-3)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-dim)' }}>
                          {mat?.name ?? matId}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', color: 'var(--text)' }}>
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

      {/* ━━━ RIGHT: Enhance Panel ━━━ */}
      <EnhanceSidebar
        selectedItem={selectedItem}
        equippedUids={equippedUids}
        materials={materials}
        tryEnhance={tryEnhance}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Enhance Sidebar — 우측 강화 패널
   ══════════════════════════════════════════════════════════ */
const SCROLL_LABELS: Record<ScrollType, string> = {
  normal: '일반',
  blessed: '축복',
  cursed: '저주',
};
const SCROLL_COLORS: Record<ScrollType, string> = {
  normal: 'var(--text)',
  blessed: '#F5C518',
  cursed: 'var(--danger)',
};
const SCROLL_GLOW: Record<ScrollType, string | undefined> = {
  normal: undefined,
  blessed: '0 0 6px rgba(245,197,24,0.6), 0 0 14px rgba(245,197,24,0.3)',
  cursed: undefined,
};

function EnhanceSidebar({
  selectedItem, equippedUids, materials, tryEnhance,
}: {
  selectedItem: Equipment | null;
  equippedUids: Set<string>;
  materials: Record<string, number>;
  tryEnhance: (uid: string, scrollType: ScrollType) => void;
}) {
  const [scrollType, setScrollType] = useState<ScrollType>('normal');
  const [animLevel, setAnimLevel] = useState<number | null>(null);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enhanceAnim = useGameStore(s => s.enhanceAnim);
  const clearEnhanceAnim = useGameStore(s => s.clearEnhanceAnim);

  const target = selectedItem;
  const level = target ? target.enhanceLevel : 0;
  const maxed = target ? target.enhanceLevel >= target.maxEnhance : true;
  const successRate = target ? getEnhanceRate(target.type, level) : 0;
  const safe = target ? isEnhanceSafe(target.type, level) : true;

  const isWeapon = target?.type === 'weapon';
  const enchant = target ? target.enhanceLevel : 0;
  const nextEnchant = enchant + 1;

  // 주문서 정보
  const scrollId = target ? getScrollId(target.type, scrollType) : '';
  const scrollName = MATERIALS[scrollId]?.name ?? '';
  const ownedScroll = materials[scrollId] ?? 0;

  // 사용 가능 여부
  const canEnhance = (() => {
    if (!target || ownedScroll < 1) return false;
    if (scrollType === 'cursed') return level > 0;
    return !maxed;
  })();

  // 주문서별 설명
  const scrollDesc = (() => {
    if (scrollType === 'cursed') return '인챈트 -1 (확정)';
    if (scrollType === 'blessed') {
      return safe ? '인챈트 +1~+3 (확정 성공)' : '성공 시 +1~+2 (실패 시 파괴)';
    }
    return `인챈트 +1 (성공률 ${Math.round(successRate * 100)}%)`;
  })();

  const displayLevel = animLevel ?? (target ? target.enhanceLevel : 0);

  // 강화 애니메이션: 축복 룰렛 / 파괴 추락
  useEffect(() => {
    if (!enhanceAnim || enhanceAnim.uid !== target?.uid) {
      setAnimLevel(null);
      return;
    }
    const { fromLevel, toLevel, scrollType: animScroll } = enhanceAnim;
    const max = target?.maxEnhance ?? 10;
    const isSafe = target ? isEnhanceSafe(target.type, fromLevel) : true;
    const isBlessed = animScroll === 'blessed';
    const steps: number[] = [];
    const delays: number[] = [];

    if (toLevel === 0) {
      // 파괴 연출
      if (isBlessed && !isSafe) {
        // 축복 파괴: 룰렛 후 추락
        const maxBonus = 2;
        const maxPossible = Math.min(fromLevel + maxBonus, max);
        const pool: number[] = [];
        for (let v = fromLevel + 1; v <= maxPossible; v++) pool.push(v);
        const count = 6 + Math.floor(Math.random() * 5);
        for (let s = 0; s < count; s++) {
          const prev = steps.length > 0 ? steps[steps.length - 1] : fromLevel;
          const choices = pool.filter(v => v !== prev);
          steps.push(choices[Math.floor(Math.random() * choices.length)]);
          delays.push(120 + Math.random() * 80);
        }
        const last = steps[steps.length - 1] ?? fromLevel;
        const fallSteps = last;
        for (let v = last - 1; v >= 0; v--) {
          steps.push(v);
          const progress = (last - v) / fallSteps;
          delays.push(Math.max(20, 107 * (1 - progress * 0.8)));
        }
      } else {
        // 일반 파괴: 한 칸 올라갔다가 추락
        steps.push(fromLevel + 1);
        delays.push(230);
        const fallSteps = fromLevel + 1;
        for (let v = fromLevel; v >= 0; v--) {
          steps.push(v);
          const progress = (fromLevel + 1 - v) / fallSteps;
          delays.push(Math.max(20, 107 * (1 - progress * 0.8)));
        }
      }
    } else {
      // 축복 성공: 룰렛
      const maxBonus = isSafe ? 3 : 2;
      const maxPossible = Math.min(fromLevel + maxBonus, max);
      const pool: number[] = [];
      for (let v = fromLevel + 1; v <= maxPossible; v++) pool.push(v);
      const count = 6 + Math.floor(Math.random() * 5);
      for (let s = 0; s < count; s++) {
        const prev = steps.length > 0 ? steps[steps.length - 1] : fromLevel;
        const choices = pool.filter(v => v !== prev);
        steps.push(choices[Math.floor(Math.random() * choices.length)]);
        delays.push(120 + Math.random() * 80);
      }
      if (steps[steps.length - 1] !== toLevel) {
        steps.push(toLevel);
        delays.push(120);
      }
    }

    let i = 0;
    setAnimLevel(fromLevel);
    const tick = () => {
      if (i < steps.length) {
        setAnimLevel(steps[i]);
        const d = delays[i] ?? 100;
        i++;
        animRef.current = setTimeout(tick, d);
      } else {
        setAnimLevel(null);
        clearEnhanceAnim();
      }
    };
    animRef.current = setTimeout(tick, 130);
    return () => { if (animRef.current) clearTimeout(animRef.current); };
  }, [enhanceAnim]);

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-md)',
      padding: 'var(--s-4)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--s-4)',
      overflow: 'auto',
    }}>
      <div style={LABEL}>강화</div>

      {!target ? (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-mute)',
          fontSize: 'var(--fs-sm)',
          textAlign: 'center',
          padding: 'var(--s-4)',
        }}>
          좌측에서 장비를 선택하세요
        </div>
      ) : (
        <>
          {/* Selected item preview */}
          <div style={{
            background: 'var(--bg-sunken)',
            borderRadius: 'var(--r-sm)',
            padding: 'var(--s-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--s-2)',
            borderLeft: '3px solid var(--accent)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 13 }}>
                {displayLevel > 0 ? `+${displayLevel} ${target.name}` : target.name}
              </span>
            </div>

            {equippedUids.has(target.uid) && (
              <span style={{
                alignSelf: 'flex-start',
                fontSize: '9px',
                padding: '1px 6px',
                borderRadius: 'var(--r-full)',
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                fontWeight: 600,
              }}>
                착용중
              </span>
            )}

            {/* Stat preview — Lineage style */}
            {!maxed ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                {isWeapon ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-dim)' }}>타격치</span>
                      <span>
                        <span style={{ color: 'var(--text)' }}>
                        {target.baseAtk}/{target.baseAtkLarge}
                        </span>
                        <span style={{ color: 'var(--text-dim)' }}> (+{displayLevel})</span>
                        <span style={{ color: 'var(--text-mute)' }}> → </span>
                        <span style={{ color: 'var(--success)', fontWeight: 700 }}>(+{displayLevel + 1})</span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-dim)' }}>공격 성공</span>
                      <span>
                        <span style={{ color: 'var(--text)' }}>+{displayLevel}</span>
                        <span style={{ color: 'var(--text-mute)' }}> → </span>
                        <span style={{ color: 'var(--success)', fontWeight: 700 }}>+{displayLevel + 1}</span>
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-dim)' }}>AC</span>
                    <span>
                      <span style={{ color: 'var(--text)' }}>{target.baseDef}+{displayLevel}</span>
                      <span style={{ color: 'var(--text-mute)' }}> → </span>
                      <span style={{ color: 'var(--success)', fontWeight: 700 }}>{target.baseDef}+{displayLevel + 1}</span>
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12 }}>
                최대 강화 달성
              </div>
            )}

            {/* Enhance level bar */}
            <div style={{ display: 'flex', gap: '3px' }}>
              {Array.from({ length: target.maxEnhance }, (_, i) => {
                const filled = i < displayLevel;
                const isAnimating = animLevel !== null;
                return (
                  <div key={i} style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    background: filled ? 'var(--accent)' : 'var(--bg-panel)',
                    transition: isAnimating ? 'background 0.15s' : 'none',
                  }} />
                );
              })}
            </div>
          </div>

          {/* Scroll type selector */}
          {target.maxEnhance > 0 && (
            <div>
              <div style={{ ...LABEL, fontSize: 9 }}>주문서 선택</div>
              <div style={{
                marginTop: 'var(--s-2)',
                display: 'flex',
                gap: 'var(--s-2)',
              }}>
                {(['normal', 'blessed', 'cursed'] as ScrollType[]).map(st => {
                  const sid = getScrollId(target.type, st);
                  const owned = materials[sid] ?? 0;
                  const selected = scrollType === st;
                  return (
                    <button
                      key={st}
                      onClick={() => setScrollType(st)}
                      style={{
                        flex: 1,
                        padding: '6px 2px',
                        border: selected
                          ? `2px solid ${SCROLL_COLORS[st]}`
                          : '1px solid var(--border-soft)',
                        borderRadius: 'var(--r-xs)',
                        background: selected ? 'var(--bg-elevated)' : 'transparent',
                        color: SCROLL_COLORS[st],
                        textShadow: SCROLL_GLOW[st],
                        cursor: 'pointer',
                        fontFamily: 'var(--font-ui)',
                        fontSize: '10px',
                        fontWeight: selected ? 700 : 500,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                        transition: 'all var(--dur-fast)',
                      }}
                    >
                      <span>{SCROLL_LABELS[st]}</span>
                      <span style={{
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)',
                        color: owned > 0 ? 'var(--text-dim)' : 'var(--danger)',
                      }}>
                        x{owned}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Scroll description */}
              <div style={{
                marginTop: 'var(--s-2)',
                fontSize: '9px',
                color: SCROLL_COLORS[scrollType],
                textShadow: SCROLL_GLOW[scrollType],
                background: 'var(--bg-sunken)',
                padding: '4px 8px',
                borderRadius: 'var(--r-xs)',
              }}>
                {scrollDesc}
              </div>
            </div>
          )}

          {/* Cost info */}
          {target.maxEnhance > 0 && (scrollType !== 'cursed' ? !maxed : level > 0) && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--s-2)',
            }}>
              <div style={{ ...LABEL, fontSize: 9 }}>강화 비용</div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
              }}>
                <span style={{ color: 'var(--text-dim)' }}>{scrollName}</span>
                <span style={{
                  color: ownedScroll >= 1 ? 'var(--text)' : 'var(--danger)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {ownedScroll} / 1
                </span>
              </div>

              {/* Risk warnings — only for normal scroll in unsafe zone */}
              {scrollType === 'normal' && !safe && (
                <div style={{
                  fontSize: 10,
                  color: 'var(--danger)',
                  background: 'var(--danger-soft)',
                  padding: '4px 8px',
                  borderRadius: 'var(--r-xs)',
                  fontWeight: 600,
                }}>
                  실패 시 장비 파괴
                </div>
              )}
            </div>
          )}

          {/* Enhance button */}
          <div style={{ marginTop: 'auto' }}>
            <button
              style={{
                width: '100%',
                padding: '12px 0',
                border: 'none',
                borderRadius: 'var(--r-sm)',
                background: canEnhance
                  ? 'linear-gradient(135deg, var(--accent), oklch(0.68 0.18 45))'
                  : 'var(--bg-sunken)',
                color: canEnhance ? '#fff' : 'var(--text-mute)',
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--fs-base)',
                fontWeight: 700,
                cursor: canEnhance ? 'pointer' : 'not-allowed',
                transition: 'all var(--dur-fast)',
              }}
              disabled={!canEnhance}
              onClick={() => {
                if (target && canEnhance) tryEnhance(target.uid, scrollType);
              }}
            >
              {scrollType === 'cursed' ? '인챈트 해제' : '강화 시도하기'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Equipment Card — 장비 카드
   ══════════════════════════════════════════════════════════ */
function EquipCard({
  eq, isEquipped, isSelected, onSelect, onAction, actionLabel, actionStyle,
}: {
  eq: Equipment;
  isEquipped: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onAction: () => void;
  actionLabel: string;
  actionStyle: 'success' | 'ghost';
}) {
  const isWpn = eq.type === 'weapon';
  const enh = eq.enhanceLevel;

  return (
    <div
      onClick={onSelect}
      style={{
        background: isSelected
          ? 'radial-gradient(ellipse at 50% 0%, color-mix(in oklch, var(--accent) 12%, var(--bg-panel)), var(--bg-panel))'
          : 'var(--bg-panel)',
        border: isSelected
          ? '2px solid var(--accent)'
          : '1px solid var(--border-soft)',
        borderRadius: 'var(--r-sm)',
        padding: 'var(--s-3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-1)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, background 0.15s ease',
      }}
    >

      {/* Equipped badge */}
      {isEquipped && (
        <span style={{
          position: 'absolute',
          top: 6,
          left: 6,
          fontSize: '8px',
          padding: '1px 5px',
          borderRadius: 'var(--r-full)',
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          fontWeight: 700,
        }}>
          착용
        </span>
      )}

      {/* Name */}
      <div style={{
        color: 'var(--text)',
        fontWeight: 700,
        fontSize: 'var(--fs-sm)',
        lineHeight: 1.3,
        paddingRight: 'var(--s-6)',
        marginTop: isEquipped ? 16 : 0,
      }}>
        {equipDisplayName(eq)}
      </div>

      {/* Stat — Lineage style */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-xs)',
        color: 'var(--text-dim)',
      }}>
        {isWpn
          ? <>타격 {eq.baseAtk}/{eq.baseAtkLarge}{enh > 0 && <span style={{ color: 'var(--success)' }}> (+{enh})</span>}</>
          : <>AC {eq.baseDef}<span style={{ color: enh > 0 ? 'var(--success)' : 'var(--text-mute)' }}>+{enh}</span></>
        }
      </div>

      {/* Bonus */}
      {eq.bonusEffects.length > 0 && (
        <div style={{ fontSize: '10px', color: 'var(--info)' }}>
          {eq.bonusEffects.join(' / ')}
        </div>
      )}

      {/* Action button */}
      <div style={{ marginTop: 'var(--s-1)' }}>
        <button
          onClick={e => { e.stopPropagation(); onAction(); }}
          style={{
            width: '100%',
            padding: '5px 0',
            border: actionStyle === 'ghost' ? '1px solid var(--border)' : 'none',
            borderRadius: 'var(--r-xs)',
            background: actionStyle === 'success'
              ? 'linear-gradient(135deg, var(--success), oklch(0.66 0.16 135))'
              : 'transparent',
            color: actionStyle === 'success' ? '#fff' : 'var(--text-dim)',
            fontFamily: 'var(--font-ui)',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
