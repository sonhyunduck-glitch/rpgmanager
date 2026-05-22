/* =========================================================
   UTILS — 공통 유틸리티 함수
   ========================================================= */

/** 상대 시간 포매터 (ISO 문자열 → "방금", "5분 전", "3시간 전", "2일 전") */
export function timeAgo(iso: string | undefined): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

/** 날짜 포매터 (ISO → "2024.01.15") */
export function dateFmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`;
}

/** Number 변환 (NaN-safe, fallback 반환) */
export function safeNumber(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isNaN(n) ? fallback : n;
}
