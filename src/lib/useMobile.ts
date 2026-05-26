/* =========================================================
   useMobile — 모바일 감지 훅

   CSS tokens.css의 강제 가로 회전 미디어 쿼리와 동일 기준:
   @media (orientation: portrait) and (pointer: coarse) and (max-width: 768px)

   또는 자연 가로 모드에서 높이가 500px 이하인 경우.
   두 조건 모두 "모바일 사냥 전용 레이아웃" 트리거.
   ========================================================= */
import { useState, useEffect } from 'react';

function check(): boolean {
  if (typeof window === 'undefined') return false;
  // 자연 가로 모드 모바일 (높이 짧음)
  const naturalLandscape =
    window.matchMedia('(max-height: 500px) and (orientation: landscape) and (pointer: coarse)').matches;
  // 세로 모드 → CSS가 강제 가로 회전하는 상황
  const forcedLandscape =
    window.matchMedia('(orientation: portrait) and (pointer: coarse) and (max-width: 768px)').matches;
  return naturalLandscape || forcedLandscape;
}

export function useMobile(): boolean {
  const [mobile, setMobile] = useState(check);

  useEffect(() => {
    const handler = () => setMobile(check());
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, []);

  return mobile;
}
