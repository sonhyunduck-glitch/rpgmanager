/* ══════════════════════════════════════════════════════════
   Enhance Sidebar — 우측 강화 패널
   ══════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { Equipment, ScrollType } from '../../types';
import { MATERIALS, getEnhanceRate, isEnhanceSafe, getScrollId, formatEnhanceRate } from '../../data/gameData';
import { LABEL } from '../../styles/shared';

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

export default function EnhanceSidebar({
  selectedItem, equippedUids, materials, tryEnhance,
}: {
  selectedItem: Equipment | null;
  equippedUids: Set<string>;
  materials: Record<string, number>;
  tryEnhance: (uid: string, scrollType: ScrollType) => void;
}) {
  const [scrollType, setScrollType] = useState<ScrollType>('normal');
  const [animLevel, setAnimLevel] = useState<number | null>(null);
  const enhanceAnim = useGameStore(s => s.enhanceAnim);
  const clearEnhanceAnim = useGameStore(s => s.clearEnhanceAnim);

  const target = selectedItem;
  const level = target ? target.enhanceLevel : 0;
  const maxed = target ? target.enhanceLevel >= target.maxEnhance : true;
  const successRate = target ? getEnhanceRate(target.type, level, target.safeEnchant) : 0;
  const safe = target ? isEnhanceSafe(level, target.safeEnchant) : true;

  const isWeapon = target?.type === 'weapon';

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
    return `인챈트 +1 (성공률 ${formatEnhanceRate(successRate)})`;
  })();

  const displayLevel = animLevel ?? (target ? target.enhanceLevel : 0);

  // 강화 결과 즉시 반영 (애니메이션 없음)
  useEffect(() => {
    if (!enhanceAnim || enhanceAnim.uid !== target?.uid) {
      setAnimLevel(null);
      return;
    }
    clearEnhanceAnim();
    setAnimLevel(null);
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
              <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 'var(--fs-base)' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--fs-sm)', fontFamily: 'var(--font-mono)' }}>
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
              <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 'var(--fs-sm)' }}>
                최대 강화 달성
              </div>
            )}

            {/* Enhance level indicator */}
            <div style={{
              fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-mono)',
              color: 'var(--text-mute)',
            }}>
              +{displayLevel} / +{target.maxEnhance}
            </div>
          </div>

          {/* Scroll type selector */}
          {target.maxEnhance > 0 && (
            <div>
              <div style={{ ...LABEL, fontSize: 'var(--fs-xs)' }}>주문서 선택</div>
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
              <div style={{ ...LABEL, fontSize: 'var(--fs-xs)' }}>강화 비용</div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 'var(--fs-sm)',
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
                  fontSize: 'var(--fs-xs)',
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
