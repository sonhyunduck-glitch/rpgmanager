import { useState, useEffect } from 'react';
import { useGameStore, equipDisplayName, type Equipment } from '../../store/gameStore';
import {
  getEnhanceRate, isEnhanceSafe,
  getScrollId, formatEnhanceRate,
} from '../../data/gameData';
import type { ScrollType } from '../../types';
import { LABEL, BTN_PRIMARY, BTN_DISABLED } from '../../styles/shared';


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
  const equippedEarring = useGameStore(s => s.equippedEarring);
  const inventory = useGameStore(s => s.inventory);
  const materials = useGameStore(s => s.materials);
  const enhanceTargetUid = useGameStore(s => s.enhanceTargetUid);
  const setEnhanceTarget = useGameStore(s => s.setEnhanceTarget);
  const tryEnhance = useGameStore(s => s.tryEnhance);
  const enhanceAnim = useGameStore(s => s.enhanceAnim);
  const clearEnhanceAnim = useGameStore(s => s.clearEnhanceAnim);

  const [scrollType, setScrollType] = useState<ScrollType>('normal');
  const [animLevel, setAnimLevel] = useState<number | null>(null);

  // Build list of enhanceable equipment (all equipped + inventory)
  const allEquipped = [
    equippedWeapon, equippedTshirt, equippedHelmet, equippedArmor, equippedCloak,
    equippedGloves, equippedBoots, equippedShield,
    equippedNecklace, equippedRing, equippedRing2, equippedBelt, equippedEarring,
  ];
  const equippedUids = new Set(allEquipped.filter(Boolean).map(e => e!.uid));
  const candidates: Equipment[] = [];
  allEquipped.forEach(eq => { if (eq) candidates.push(eq); });
  inventory.forEach(eq => candidates.push(eq));

  // Resolve target -- default to equipped weapon
  const targetUid = enhanceTargetUid ?? equippedWeapon?.uid ?? null;
  const target = candidates.find(c => c.uid === targetUid) ?? null;

  // 강화 결과 즉시 반영 (애니메이션 없음)
  useEffect(() => {
    if (!enhanceAnim || enhanceAnim.uid !== targetUid) {
      setAnimLevel(null);
      return;
    }
    // 즉시 결과 적용
    clearEnhanceAnim();
    setAnimLevel(null);
  }, [enhanceAnim, targetUid]);

  // Enhance info
  const displayLevel = animLevel ?? (target ? target.enhanceLevel : 0);
  const level = target ? target.enhanceLevel : 0;
  const maxed = target ? target.enhanceLevel >= target.maxEnhance : true;
  // 주문서 정보
  const scrollId = target ? getScrollId(target.type, scrollType) : '';
  const ownedScroll = materials[scrollId] ?? 0;
  const successRate = getEnhanceRate(target?.type ?? 'weapon', level, target?.safeEnchant ?? 6);
  const safe = isEnhanceSafe(level, target?.safeEnchant ?? 6);

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
    return `인챈트 +1 (성공률 ${formatEnhanceRate(successRate)})`;
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

          {/* Enhance level indicator */}
          {target.maxEnhance > 0 && (
            <div style={{
              fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-mono)',
              color: 'var(--text-mute)',
            }}>
              +{displayLevel} / +{target.maxEnhance}
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
