/* =========================================================
   TRADE PANEL — 장비 거래소 (L1J 모바일 스타일)
   ========================================================= */
import { useState } from 'react';
import BrowseTab from './BrowseTab';
import RegisterTab from './RegisterTab';
import MyTradesTab from './MyTradesTab';

type TradeTab = 'browse' | 'register' | 'my';

const TABS: { key: TradeTab; icon: string; label: string }[] = [
  { key: 'browse',   icon: '🔍', label: '검색' },
  { key: 'register', icon: '📋', label: '판매 등록' },
  { key: 'my',       icon: '📜', label: '내거래' },
];

export default function TradePanel() {
  const [tab, setTab] = useState<TradeTab>('browse');

  return (
    <div style={{
      height: '100%',
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-md)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* ── 헤더 탭 바 (L1J 스타일) ── */}
      <div style={{
        display: 'flex',
        background: 'var(--bg-sunken)',
        borderBottom: '1px solid var(--border-soft)',
        flexShrink: 0,
      }}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '8px 0',
                border: 'none', borderBottom: active ? '2px solid var(--info)' : '2px solid transparent',
                background: active
                  ? 'color-mix(in oklch, var(--info) 6%, transparent)'
                  : 'transparent',
                color: active ? 'var(--info)' : 'var(--text-mute)',
                fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)',
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
            >
              <span style={{ fontSize: 'var(--fs-xs)' }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── 콘텐츠 ── */}
      <div style={{
        flex: 1, minHeight: 0,
        padding: 'var(--s-3)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {tab === 'browse' && <BrowseTab />}
        {tab === 'register' && <RegisterTab />}
        {tab === 'my' && <MyTradesTab />}
      </div>
    </div>
  );
}
