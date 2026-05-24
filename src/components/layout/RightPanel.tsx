/* =========================================================
   RIGHT PANEL — 우측 패널
   프로필 조회 시: 프로필 패널 표시
   기본:          사냥터 카드 + 전투 로그
   ========================================================= */
import { useGameStore } from '../../store/gameStore';
import HuntZones from '../hunt/HuntZones';
import CombatLog from '../hunt/CombatLog';
import ProfileModal from '../profile/ProfileModal';

export default function RightPanel() {
  const viewingProfileId = useGameStore(s => s.viewingProfileId);

  /* 프로필 조회 중이면 프로필 패널 표시 */
  if (viewingProfileId) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}>
        <ProfileModal />
      </div>
    );
  }

  /* 기본: 사냥터 카드 + 전투 로그 */
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
