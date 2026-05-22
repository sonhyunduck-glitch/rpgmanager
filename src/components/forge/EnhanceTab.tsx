import { useState, useEffect, useRef } from 'react';
import { useGameStore, equipStat, equipDisplayName, type Equipment } from '../../store/gameStore';
import {
  getEnhanceRate, isEnhanceSafe,
  getScrollId, MATERIALS,
} from '../../data/gameData';
import type { ScrollType } from '../../types';
import { LABEL, BTN_PRIMARY, BTN_DISABLED } from '../../styles/shared';

function rateColor(rate: number) {
  if (rate > 0.7) return 'var(--success)';
  if (rate > 0.4) return 'var(--warning)';
  return 'var(--danger)';
}

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

export default function EnhanceTab() {
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
  const inventory = useGameStore(s => s.inventory);
  const materials = useGameStore(s => s.materials);
  const enhanceTargetUid = useGameStore(s => s.enhanceTargetUid);
  const setEnhanceTarget = useGameStore(s => s.setEnhanceTarget);
  const tryEnhance = useGameStore(s => s.tryEnhance);
  const enhanceAnim = useGameStore(s => s.enhanceAnim);
  const clearEnhanceAnim = useGameStore(s => s.clearEnhanceAnim);

  const [scrollType, setScrollType] = useState<ScrollType>('normal');
  const [animLevel, setAnimLevel] = useState<number | null>(null);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build list of enhanceable equipment (all equipped + inventory)
  const allEquipped = [
    equippedWeapon, equippedTshirt, equippedHelmet, equippedArmor, equippedCloak,
    equippedGloves, equippedBoots, equippedShield,
    equippedNecklace, equippedRing, equippedRing2, equippedBelt,
  ];
  const equippedUids = new Set(allEquipped.filter(Boolean).map(e => e!.uid));
  const candidates: Equipment[] = [];
  allEquipped.forEach(eq => { if (eq) candidates.push(eq); });
  inventory.forEach(eq => candidates.push(eq));

  // Resolve target -- default to equipped weapon
  const targetUid = enhanceTargetUid ?? equippedWeapon?.uid ?? null;
  const target = candidates.find(c => c.uid === targetUid) ?? null;

  // 강화 애니메이션: 축복 룰렛 / 파괴 추락
  useEffect(() => {
    if (!enhanceAnim || enhanceAnim.uid !== targetUid) {
      setAnimLevel(null);
      return;
    }
    const { fromLevel, toLevel, scrollType: animScroll } = enhanceAnim;
    const max = target?.maxEnhance ?? 10;
    const safe = target ? isEnhanceSafe(target.type, fromLevel) : true;
    const isBlessed = animScroll === 'blessed';
    const steps: number[] = [];
    // 각 스텝별 딜레이 (ms) — 기본값은 나중에 채움
    const delays: number[] = [];

    if (toLevel === 0) {
      // 파괴 연출
      if (isBlessed && !safe) {
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
      const maxBonus = safe ? 3 : 2;
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
  }, [enhanceAnim, targetUid]);

  // Enhance info
  const displayLevel = animLevel ?? (target ? target.enhanceLevel : 0);
  const level = target ? target.enhanceLevel : 0;
  const maxed = target ? target.enhanceLevel >= target.maxEnhance : true;
  const isWeapon = target?.type === 'weapon';

  // 주문서 정보
  const scrollId = target ? getScrollId(target.type, scrollType) : '';
  const scrollName = MATERIALS[scrollId]?.name ?? '';
  const ownedScroll = materials[scrollId] ?? 0;
  const successRate = getEnhanceRate(target?.type ?? 'weapon', level);
  const safe = isEnhanceSafe(target?.type ?? 'weapon', level);

  // 사용 가능 여부
  const canUse = (() => {
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

  return (
    <>
      {/* Target selector */}
      <div>
        <div style={LABEL}>강화 대상</div>
        <div style={{
          marginTop: 'var(--s-2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--s-1)',
          maxHeight: 160,
          overflowY: 'auto',
        }}>
          {candidates.length === 0 && (
            <div style={{ color: 'var(--text-mute)', fontSize: 'var(--fs-sm)' }}>
              장비가 없습니다
            </div>
          )}
          {candidates.map(eq => {
            const isSelected = eq.uid === targetUid;
            const equipped = equippedUids.has(eq.uid);
            return (
              <button
                key={eq.uid}
                onClick={() => setEnhanceTarget(eq.uid)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--s-2)',
                  padding: '8px var(--s-3)',
                  background: isSelected ? 'var(--bg-elevated)' : 'transparent',
                  border: isSelected
                    ? '1px solid var(--accent)'
                    : '1px solid var(--border-soft)',
                  borderRadius: 'var(--r-xs)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 'var(--fs-sm)',
                  textAlign: 'left',
                  transition: 'all var(--dur-fast)',
                }}
              >
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>
                  {isSelected && animLevel !== null
                    ? (displayLevel > 0 ? `+${displayLevel} ${eq.name}` : eq.name)
                    : equipDisplayName(eq)}
                </span>
                <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                  {eq.type === 'weapon'
                    ? `타격 ${eq.baseAtk}/${eq.baseAtkLarge}`
                    : `AC ${eq.baseDef}+${isSelected && animLevel !== null ? displayLevel : eq.enhanceLevel}`}
                </span>
                {equipped && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: 'var(--r-full)',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    fontWeight: 600,
                  }}>
                    착용중
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected item preview */}
      {target && (
        <div style={{
          background: 'var(--bg-sunken)',
          borderRadius: 'var(--r-sm)',
          padding: 'var(--s-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--s-3)',
          borderLeft: '3px solid var(--accent)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 'var(--fs-md)' }}>
              {displayLevel > 0 ? `+${displayLevel} ${target.name}` : target.name}
            </span>
          </div>

          {/* Enhance level bar */}
          {target.maxEnhance > 0 && (
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
          )}
        </div>
      )}

      {/* Scroll type selector */}
      {target && target.maxEnhance > 0 && (
        <div>
          <div style={LABEL}>주문서 선택</div>
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
                    padding: '8px 4px',
                    border: selected
                      ? `2px solid ${SCROLL_COLORS[st]}`
                      : '1px solid var(--border-soft)',
                    borderRadius: 'var(--r-xs)',
                    background: selected ? 'var(--bg-elevated)' : 'transparent',
                    color: SCROLL_COLORS[st],
                    textShadow: SCROLL_GLOW[st],
                    cursor: 'pointer',
                    fontFamily: 'var(--font-ui)',
                    fontSize: '11px',
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
                    fontSize: '10px',
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
            fontSize: '10px',
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

      {/* Risk warning */}
      {target && target.maxEnhance > 0 && scrollType === 'normal' && !safe && !maxed && (
        <div style={{
          fontSize: '10px',
          color: 'var(--danger)',
          background: 'var(--danger-soft)',
          padding: '4px 8px',
          borderRadius: 'var(--r-xs)',
        }}>
          실패 시 장비 파괴
        </div>
      )}

      {/* Enhance button */}
      <div style={{ marginTop: 'auto' }}>
        <button
          style={canUse ? BTN_PRIMARY : BTN_DISABLED}
          disabled={!canUse}
          onClick={() => {
            if (target && canUse) tryEnhance(target.uid, scrollType);
          }}
        >
          {scrollType === 'cursed' ? '인챈트 해제' : '강화 시도하기'}
        </button>
      </div>
    </>
  );
}
