/* =========================================================
   TRADE PANEL — 장비 거래소 (구매 | 등록 | 내거래)
   ========================================================= */
import { useState } from 'react';
import { PANEL_FULL, TAB_CONTAINER, tabStyle } from '../../styles/shared';
import BrowseTab from './BrowseTab';
import RegisterTab from './RegisterTab';
import MyTradesTab from './MyTradesTab';

type TradeTab = 'browse' | 'register' | 'my';

const TABS: { key: TradeTab; label: string }[] = [
  { key: 'browse', label: '거래소' },
  { key: 'register', label: '등록' },
  { key: 'my', label: '내거래' },
];

export default function TradePanel() {
  const [tab, setTab] = useState<TradeTab>('browse');

  return (
    <div style={PANEL_FULL}>
      {/* 탭 */}
      <div style={TAB_CONTAINER}>
        {TABS.map(t => (
          <button key={t.key} style={tabStyle(tab === t.key)} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'browse' && <BrowseTab />}
      {tab === 'register' && <RegisterTab />}
      {tab === 'my' && <MyTradesTab />}
    </div>
  );
}
