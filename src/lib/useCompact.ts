/* =========================================================
   useCompact — 뷰포트 기반 컴팩트 모드 감지 훅

   모바일: 강제 가로 회전(portrait → 90° rotate)으로
   원래 높이(짧은 변)가 CSS 너비가 됨.
   폰 세로 모드 높이 ≈ 360~414px → 회전 후 width ≈ 360~414.

   기준: innerHeight ≤ 500  (자연 가로 모드 — 폰 높이 짧음)
     또는 innerWidth  ≤ 500  (강제 가로 전 — 아직 portrait)
     → compact = true
   ========================================================= */
import { useState, useEffect } from 'react';

export function useCompact(breakpoint = 500): boolean {
  const [compact, setCompact] = useState(() => check(breakpoint));

  useEffect(() => {
    const handler = () => setCompact(check(breakpoint));
    window.addEventListener('resize', handler);
    // 방향 전환도 감지
    window.addEventListener('orientationchange', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, [breakpoint]);

  return compact;
}

function check(bp: number): boolean {
  return Math.min(window.innerWidth, window.innerHeight) <= bp;
}
