/* =========================================================
   RIGHT PANEL — 우측 패널 (상: 리더보드 | 하: 길드)
   ========================================================= */
import Leaderboard from '../guild/Leaderboard';
import GuildPanel from '../guild/GuildPanel';

export default function RightPanel() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--layout-gap)',
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
    }}>
      {/* 상: 리더보드 */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Leaderboard />
      </div>

      {/* 하: 길드 */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <GuildPanel />
      </div>
    </div>
  );
}
