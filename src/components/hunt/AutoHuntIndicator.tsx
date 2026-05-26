/* =========================================================
   AUTO HUNT INDICATOR — 미니맵 우측 상단 오버레이
   디자인: hunt-app.jsx 핸드오프 기반 (.auto-toggle)
   ========================================================= */
import { useGameStore } from '../../store/gameStore';

export default function AutoHuntIndicator() {
  const huntStatus = useGameStore(s => s.hunt.status);
  const isHunting = huntStatus === 'hunting';
  const isPaused = huntStatus === 'paused';

  if (huntStatus === 'idle') return null;

  return (
    <div style={{
      position: 'absolute',
      top: 8,
      right: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      background: 'rgba(17, 21, 28, 0.85)',
      border: `1px solid ${isHunting
        ? 'color-mix(in oklch, var(--accent) 40%, transparent)'
        : 'var(--border-soft)'}`,
      borderRadius: 'var(--r-full)',
      backdropFilter: 'blur(8px)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-xs)',
      color: isHunting ? 'var(--accent)' : 'var(--text-mute)',
      zIndex: 10,
      pointerEvents: 'none',
    }}>
      {/* 펄스 닷 */}
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: isHunting ? 'var(--success)' : isPaused ? 'var(--warning)' : 'var(--text-faint)',
        boxShadow: isHunting ? '0 0 6px var(--success)' : 'none',
        animation: isHunting ? 'pulse 1.2s ease-in-out infinite' : 'none',
        flexShrink: 0,
      }} />
      {isHunting ? '자동 사냥 진행중' : isPaused ? '일시 정지' : '사냥 중지'}
    </div>
  );
}
