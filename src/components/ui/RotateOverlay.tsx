/* =========================================================
   ROTATE OVERLAY — 모바일 landscape 잠금 시도 (PWA/전체화면)
   CSS tokens.css 의 강제 회전이 메인 처리를 담당하므로
   이 컴포넌트는 Screen Orientation API 잠금만 시도.
   ========================================================= */
import { useEffect } from 'react';

export default function RotateOverlay() {
  useEffect(() => {
    // 모바일 터치 디바이스에서만 동작
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isMobile) return;

    // PWA/전체화면일 때 landscape 잠금 시도
    try {
      if (screen.orientation?.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch {}
  }, []);

  // CSS 강제 회전이 처리하므로 오버레이 UI 불필요
  return null;
}
