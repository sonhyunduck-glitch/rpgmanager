/* =========================================================
   ROTATE OVERLAY — 모바일 세로 모드일 때 가로 전환 안내
   ========================================================= */
import { useState, useEffect } from 'react';

export default function RotateOverlay() {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    // 모바일 터치 디바이스에서만 동작
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isMobile) return;

    const check = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);

    // PWA/전체화면일 때 landscape 잠금 시도
    try {
      if (screen.orientation?.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch {}

    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  if (!isPortrait) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      background: 'oklch(0.10 0.012 260 / 0.95)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      backdropFilter: 'blur(8px)',
    }}>
      {/* 회전 아이콘 */}
      <div style={{
        fontSize: 48,
        animation: 'rotateIcon 2s ease-in-out infinite',
      }}>
        📱
      </div>

      <div style={{
        color: 'var(--text)',
        fontSize: 16,
        fontWeight: 700,
        fontFamily: 'var(--font-display)',
      }}>
        화면을 가로로 돌려주세요
      </div>

      <div style={{
        color: 'var(--text-mute)',
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 1.6,
      }}>
        LogDot은 가로 모드에 최적화되어 있습니다
      </div>

      <style>{`
        @keyframes rotateIcon {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-90deg); }
          50% { transform: rotate(-90deg); }
          75% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
