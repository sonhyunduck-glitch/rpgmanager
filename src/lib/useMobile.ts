/* =========================================================
   useMobile — 모바일 감지 훅

   세로 모드 모바일 감지:
   pointer: coarse (터치 디바이스) + max-width: 768px (폰/소형 태블릿)
   ========================================================= */
import { useState, useEffect } from 'react';

function check(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse) and (max-width: 768px)').matches;
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
