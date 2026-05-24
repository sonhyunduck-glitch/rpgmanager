import { useEffect, useRef } from 'react';
import { useGameStore } from './store/gameStore';
import StatusBar from './components/layout/StatusBar';
import LeftPanel from './components/layout/LeftPanel';
import CombatLog from './components/hunt/CombatLog';
import CombatSummary from './components/hunt/CombatSummary';
import CombatStatus from './components/hunt/CombatStatus';
import Minimap from './components/hunt/Minimap';
import SkillBar from './components/hunt/SkillBar';
import ForgePanel from './components/forge/ForgePanel';
import InventoryPanel from './components/inventory/InventoryPanel';
import ZoneSelectPanel from './components/zones/ZoneSelectPanel';
import ShopPanel from './components/shop/ShopPanel';
import TradePanel from './components/trade/TradePanel';
import SkillPanel from './components/skills/SkillPanel';
import ChatPanel from './components/chat/ChatPanel';
import RightPanel from './components/layout/RightPanel';
import Leaderboard from './components/guild/Leaderboard';
import GuildPanel from './components/guild/GuildPanel';
import ProfileModal from './components/profile/ProfileModal';
import OfflineRewardModal from './components/offline/OfflineRewardModal';
import UpdateModal from './components/update/UpdateModal';
import RotateOverlay from './components/ui/RotateOverlay';

const BASE_TICK_MS = 3000;

interface AppProps {
  userId: string;
}

export default function App({ userId }: AppProps) {
  const viewMode = useGameStore(s => s.viewMode);
  const huntStatus = useGameStore(s => s.hunt.status);
  const tickHunt = useGameStore(s => s.tickHunt);
  const getAtkSpeedMult = useGameStore(s => s.getAtkSpeedMult);

  const initFromDB = useGameStore(s => s.initFromDB);
  const initDone = useRef(false);

  // DB에서 유저 데이터 로드
  useEffect(() => {
    if (!initDone.current) {
      initDone.current = true;
      initFromDB(userId);
    }
  }, [userId, initFromDB]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 동적 틱: setTimeout 체인 — 버프에 따라 간격이 바뀜
  useEffect(() => {
    if (huntStatus !== 'hunting') {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      return;
    }

    function scheduleTick() {
      const mult = getAtkSpeedMult();
      const tickMs = Math.max(500, Math.round(BASE_TICK_MS / mult));
      timerRef.current = setTimeout(() => {
        try {
          tickHunt();
        } catch (e) {
          console.error('[tickHunt error]', e);
        }
        scheduleTick();
      }, tickMs);
    }
    scheduleTick();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [huntStatus, tickHunt, getAtkSpeedMult]);

  const isWideCenter = viewMode === 'inventory' || viewMode === 'zones' || viewMode === 'shop' || viewMode === 'trade' || viewMode === 'skills' || viewMode === 'ranking' || viewMode === 'guild';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      overflow: 'hidden',
    }}>
      <StatusBar />

      <div style={{
        display: 'grid',
        gridTemplateColumns: isWideCenter
          ? '1fr 4fr'
          : '1fr 2.5fr 1.2fr',
        gap: 'var(--layout-gap)',
        padding: 'var(--layout-pad)',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}>
        <LeftPanel />

        {viewMode === 'main' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--layout-gap)',
            minHeight: 0,
            overflow: 'hidden',
          }}>
            <CombatStatus />

            {/* 미니맵 + 스킬바 — 확장 */}
            <div style={{
              flex: 3,
              minHeight: 0,
              overflow: 'hidden',
              display: 'flex',
              gap: 'var(--layout-gap)',
            }}>
              <div style={{ flex: 9, minWidth: 0, overflow: 'hidden' }}>
                <Minimap />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SkillBar />
              </div>
            </div>

            {/* 하단 채팅 — 확장 */}
            <div style={{ flex: 2, minHeight: 0, overflow: 'hidden' }}>
              <ChatPanel />
            </div>
          </div>
        )}

        {viewMode === 'inventory' && <InventoryPanel />}
        {viewMode === 'zones' && <ZoneSelectPanel />}
        {viewMode === 'shop' && <ShopPanel />}
        {viewMode === 'trade' && <TradePanel />}
        {viewMode === 'skills' && <SkillPanel />}
        {viewMode === 'ranking' && <Leaderboard />}
        {viewMode === 'guild' && <GuildPanel />}

        {viewMode === 'craft' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--layout-gap)',
            minHeight: 0,
            overflow: 'hidden',
          }}>
            <CombatSummary />
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <CombatLog />
            </div>
          </div>
        )}

        {/* 우측: 사냥터 카드 + 전투 로그 */}
        {viewMode === 'main' && <RightPanel />}
        {viewMode === 'craft' && <ForgePanel />}
      </div>

      {/* 전역 모달 오버레이 */}
      <ProfileModal />
      <OfflineRewardModal />
      <UpdateModal />
      <RotateOverlay />
    </div>
  );
}
