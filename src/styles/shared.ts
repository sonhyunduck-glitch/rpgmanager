/* =========================================================
   SHARED INLINE STYLES — 공통 스타일 중앙 관리
   컴포넌트에서 import { S } from '../styles/shared' 로 사용
   ========================================================= */
import type React from 'react';

/** 모노 라벨 (UPPERCASE, 작은 글씨) */
export const LABEL: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: 'var(--text-mute)',
};

/** 숫자 디스플레이 (tabular-nums, 굵은 폰트) */
export const STAT_VALUE: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
};

/** 패널 컨테이너 (내부 전용 — PANEL_FULL에서 확장) */
const PANEL: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border-soft)',
  borderRadius: 'var(--r-md)',
  padding: 'var(--s-4)',
  boxShadow: 'var(--shadow-sm)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--s-3)',
};

/** 패널 (전체 높이, 오버플로 숨김) */
export const PANEL_FULL: React.CSSProperties = {
  ...PANEL,
  height: '100%',
  overflow: 'hidden',
};

/** 칩 기본 */
export const CHIP: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--s-1)',
  padding: 'var(--s-1) var(--s-3)',
  borderRadius: 999,
  fontSize: 'var(--fs-sm)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

/** 기본 버튼 (Primary gradient) */
export const BTN_PRIMARY: React.CSSProperties = {
  width: '100%',
  padding: 'var(--s-3) 0',
  border: 'none',
  borderRadius: 'var(--r-sm)',
  background: 'linear-gradient(135deg, var(--accent), oklch(0.68 0.18 45))',
  color: '#fff',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--fs-base)',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'opacity var(--dur-fast)',
};

/** 비활성 버튼 */
export const BTN_DISABLED: React.CSSProperties = {
  ...BTN_PRIMARY,
  opacity: 0.4,
  cursor: 'not-allowed',
};

/** Success 버튼 */
export const BTN_SUCCESS: React.CSSProperties = {
  ...BTN_PRIMARY,
  background: 'linear-gradient(135deg, var(--success), oklch(0.66 0.16 135))',
};

/** 작은 액션 버튼 (카드 내부) */
export const BTN_SM: React.CSSProperties = {
  height: 'var(--s-7)',
  borderRadius: 'var(--r-sm)',
  fontWeight: 600,
  fontSize: 'var(--fs-xs)',
  cursor: 'pointer',
  border: 'none',
  padding: '0 var(--s-3)',
  transition: 'transform 0.1s ease, background 0.15s ease',
  fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

/** 탭 컨테이너 */
export const TAB_CONTAINER: React.CSSProperties = {
  display: 'flex',
  background: 'var(--bg-sunken)',
  borderRadius: 'var(--r-sm)',
  padding: '3px',
  gap: '2px',
};

/** 탭 버튼 기본 (내부 전용 — tabStyle()에서 확장) */
const TAB_BASE: React.CSSProperties = {
  flex: 1,
  padding: 'var(--s-2) 0',
  border: 'none',
  borderRadius: 'var(--r-xs)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--fs-sm)',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all var(--dur) var(--ease-out)',
};

/** 스크롤 영역 */
export const SCROLL_AREA: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--s-3)',
  paddingRight: 'var(--s-1)',
};

/* ── Helper functions ── */

/** 탭 활성/비활성 스타일 생성 */
export function tabStyle(active: boolean): React.CSSProperties {
  return {
    ...TAB_BASE,
    background: active ? 'var(--bg-elevated)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-mute)',
    boxShadow: active ? 'var(--shadow-sm)' : 'none',
  };
}

/** 필터 칩 활성/비활성 스타일 */
export function chipStyle(active: boolean): React.CSSProperties {
  return {
    ...CHIP,
    padding: 'var(--s-1) var(--s-3)',
    border: '1px solid var(--border-soft)',
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--fs-xs)',
    cursor: 'pointer',
    transition: 'all var(--dur-fast)',
    background: active ? 'var(--bg-elevated)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-dim)',
    borderColor: active ? 'var(--accent)' : 'var(--border-soft)',
  };
}
