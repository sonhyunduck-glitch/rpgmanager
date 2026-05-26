/* =========================================================
   useCompact — 뷰포트 기반 컴팩트 모드 감지 훅

   모바일 세로 모드: innerWidth ≤ 500 (폰 세로 폭)
   가로 모드 폰:     innerHeight ≤ 500

   기준: min(innerWidth, innerHeight) ≤ breakpoint → compact
   ========================================================= */
import { useState, useEffect } from 'react';

export function useCompact(breakpoint = 500): boolean {
  const [compact, setCompact] = useState(() => check(breakpoint));

  useEffect(() => {
    const handler = () => setCompact(check(breakpoint));
    window.addEventListener('resize', handler);
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
