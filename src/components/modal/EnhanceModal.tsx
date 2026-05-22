/* =========================================================
   ENHANCE MODAL — 강화 결과 오버레이
   ========================================================= */
import { useEffect, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import {
  getEnhanceRate, getScrollId, MATERIALS,
} from '../../data/gameData';

/* ── keyframe injection (once) ── */
const ANIM_ID = '__enhance-modal-anim__';
if (typeof document !== 'undefined' && !document.getElementById(ANIM_ID)) {
  const style = document.createElement('style');
  style.id = ANIM_ID;
  style.textContent = `
    @keyframes enhanceModalIn {
      from { transform: scale(0.95); opacity: 0; }
      to   { transform: scale(1); opacity: 1; }
    }
    @keyframes destroyShake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-4px); }
      40% { transform: translateX(4px); }
      60% { transform: translateX(-3px); }
      80% { transform: translateX(3px); }
    }
  `;
  document.head.appendChild(style);
}

/* ============================== COMPONENT ============================== */
export default function EnhanceModal() {
  const enhanceResult = useGameStore(s => s.enhanceResult);
  const closeEnhanceResult = useGameStore(s => s.closeEnhanceResult);
  const enhanceTargetUid = useGameStore(s => s.enhanceTargetUid);
  const tryEnhance = useGameStore(s => s.tryEnhance);

  // Close on Esc
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') closeEnhanceResult();
  }, [closeEnhanceResult]);

  useEffect(() => {
    if (enhanceResult) {
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
    }
  }, [enhanceResult, handleKey]);

  if (!enhanceResult) return null;

  const enhanceScrollType = useGameStore(s => s.enhanceScrollType);
  const materials = useGameStore(s => s.materials);

  const {
    success, destroyed, itemName, equipType, fromLevel, toLevel,
    statBefore, statAfter, scrollUsed, scrollType, successRate,
  } = enhanceResult;

  // Visual theme: success green, destroyed dark-red, fail orange-red
  const borderColor = destroyed
    ? 'oklch(0.45 0.22 25)'
    : success ? 'var(--success)' : 'var(--danger)';
  const bgGlow = destroyed
    ? 'radial-gradient(ellipse at 50% 0%, oklch(0.35 0.22 25 / 0.15), transparent 70%)'
    : success
      ? 'radial-gradient(ellipse at 50% 0%, oklch(0.76 0.17 145 / 0.08), transparent 70%)'
      : 'radial-gradient(ellipse at 50% 0%, oklch(0.66 0.21 25 / 0.08), transparent 70%)';

  // Next attempt info (only relevant if not destroyed)
  const nextScrollId = getScrollId(equipType, enhanceScrollType);
  const hasNextScroll = (materials[nextScrollId] ?? 0) >= 1;
  const canRetry = !destroyed && toLevel < 10 && toLevel >= 0 && hasNextScroll;
  const nextLevel = toLevel;
  const nextRate = getEnhanceRate(equipType, nextLevel);

  const handleRetry = () => {
    if (enhanceTargetUid) {
      closeEnhanceResult();
      tryEnhance(enhanceTargetUid, enhanceScrollType);
    }
  };

  // Result tag text
  const tagText = destroyed ? '장비 파괴!' : success ? '강화 성공!' : '강화 실패';
  const tagBg = destroyed ? 'oklch(0.35 0.22 25 / 0.3)' : success ? 'var(--success-soft)' : 'var(--danger-soft)';
  const tagColor = destroyed ? 'oklch(0.65 0.25 25)' : success ? 'var(--success)' : 'var(--danger)';

  return (
    // Backdrop
    <div
      onClick={closeEnhanceResult}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--s-5)',
      }}
    >
      {/* Modal */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-panel)',
          backgroundImage: bgGlow,
          border: `2px solid ${borderColor}`,
          borderRadius: 'var(--r-lg)',
          padding: 'var(--s-6)',
          minWidth: 360,
          maxWidth: 440,
          width: '100%',
          boxShadow: `0 0 40px -8px ${
            destroyed ? 'oklch(0.45 0.22 25 / 0.5)'
            : success ? 'oklch(0.76 0.17 145 / 0.3)'
            : 'oklch(0.66 0.21 25 / 0.3)'
          }`,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--s-5)',
          animation: destroyed
            ? 'enhanceModalIn 0.3s var(--ease-out), destroyShake 0.4s 0.15s'
            : 'enhanceModalIn 0.3s var(--ease-out)',
        }}
      >
        {/* Result tag */}
        <div style={{ textAlign: 'center' }}>
          <span style={{
            display: 'inline-block',
            padding: '4px 16px',
            borderRadius: 'var(--r-full)',
            background: tagBg,
            color: tagColor,
            fontWeight: 700,
            fontSize: 'var(--fs-sm)',
            letterSpacing: '0.08em',
          }}>
            {tagText}
          </span>
        </div>

        {/* Title — 현재 상태 + 다음 진행 미리보기 */}
        <div style={{
          textAlign: 'center',
          fontSize: 'var(--fs-xl)',
          fontWeight: 800,
          fontFamily: 'var(--font-display)',
          color: destroyed ? 'var(--danger)' : 'var(--text)',
          lineHeight: 1.2,
        }}>
          {destroyed
            ? <>{itemName} +{fromLevel} <span style={{ color: 'oklch(0.65 0.25 25)' }}>DESTROYED</span></>
            : <>{itemName} +{toLevel} → +{toLevel + 1}</>
          }
        </div>

        {/* Current / Next — 다음 강화 미리보기 */}
        {!destroyed && (
          <div style={{ display: 'flex', gap: 'var(--s-3)' }}>
            <div style={{
              flex: 1,
              background: 'var(--bg-sunken)',
              borderRadius: 'var(--r-sm)',
              padding: 'var(--s-3)',
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: 'var(--text-mute)',
                marginBottom: 'var(--s-1)',
              }}>
                {equipType === 'weapon' ? '추타 / 명중' : 'AC'}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--fs-lg)',
                fontWeight: 700,
                color: 'var(--text)',
              }}>
                {equipType === 'weapon'
                  ? `+${toLevel} / +${toLevel}`
                  : `${statAfter - toLevel}+${toLevel}`}
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-mute)',
              fontSize: 'var(--fs-lg)',
            }}>
              →
            </div>

            <div style={{
              flex: 1,
              background: 'var(--bg-sunken)',
              borderRadius: 'var(--r-sm)',
              padding: 'var(--s-3)',
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: 'var(--text-mute)',
                marginBottom: 'var(--s-1)',
              }}>
                {equipType === 'weapon' ? '추타 / 명중' : 'AC'}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--fs-lg)',
                fontWeight: 700,
                color: 'var(--accent)',
              }}>
                {equipType === 'weapon'
                  ? `+${toLevel + 1} / +${toLevel + 1}`
                  : `${statAfter - toLevel}+${toLevel + 1}`}
              </div>
            </div>
          </div>
        )}

        {/* Destroy warning message */}
        {destroyed && (
          <div style={{
            textAlign: 'center',
            padding: 'var(--s-2) var(--s-3)',
            background: 'oklch(0.25 0.08 25 / 0.25)',
            borderRadius: 'var(--r-xs)',
            border: '1px solid oklch(0.45 0.22 25 / 0.3)',
            color: 'oklch(0.65 0.25 25)',
            fontSize: 'var(--fs-xs)',
            fontWeight: 600,
          }}>
            장비가 파괴되어 사라졌습니다
          </div>
        )}

        {/* Meta info */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--s-1)',
          fontSize: 'var(--fs-xs)',
          color: 'var(--text-dim)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>사용 주문서</span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              ...(scrollType === 'blessed' ? {
                color: '#F5C518',
                textShadow: '0 0 6px rgba(245,197,24,0.6), 0 0 14px rgba(245,197,24,0.3)',
              } : {}),
            }}>{scrollUsed}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>성공률</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(successRate * 100)}%</span>
          </div>

          {/* Next attempt preview — only show if item still exists */}
          {canRetry && (
            <div style={{
              marginTop: 'var(--s-2)',
              padding: 'var(--s-2) var(--s-3)',
              background: 'var(--bg-sunken)',
              borderRadius: 'var(--r-xs)',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '10px',
              color: 'var(--text-mute)',
            }}>
              <span>다음 시도</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {Math.round(nextRate * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 'var(--s-3)' }}>
          {/* Close button — full width when destroyed */}
          <button
            onClick={closeEnhanceResult}
            style={{
              flex: destroyed ? 1 : 1,
              padding: '12px 0',
              border: destroyed ? '1px solid oklch(0.45 0.22 25 / 0.4)' : '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              background: 'transparent',
              color: 'var(--text-dim)',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--fs-base)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all var(--dur-fast)',
            }}
          >
            닫기
          </button>

          {/* Retry — hidden when destroyed */}
          {canRetry && (
            <button
              onClick={handleRetry}
              style={{
                flex: 1.5,
                padding: '12px 0',
                border: 'none',
                borderRadius: 'var(--r-sm)',
                background: 'linear-gradient(135deg, var(--accent), oklch(0.68 0.18 45))',
                color: '#fff',
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--fs-base)',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'opacity var(--dur-fast)',
              }}
            >
              한 번 더 도전
              <span style={{
                display: 'block',
                fontSize: '10px',
                fontWeight: 400,
                opacity: 0.8,
                marginTop: 2,
              }}>
                주문서 1
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
