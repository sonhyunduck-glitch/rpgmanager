/* =========================================================
   RIGHT PANEL — 우측 패널 (상: 사냥터 카드 | 하: 전투 로그)
   ========================================================= */
import HuntZones from '../hunt/HuntZones';
import CombatLog from '../hunt/CombatLog';

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
      {/* 상: 사냥터 카드 */}
      <div style={{ flexShrink: 0 }}>
        <HuntZones />
      </div>

      {/* 하: 전투 로그 */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <CombatLog />
      </div>
    </div>
  );
}
