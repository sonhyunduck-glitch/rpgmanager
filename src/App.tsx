import { useEffect, useRef } from 'react';
import { useGameStore } from './store/gameStore';
import StatusBar from './components/layout/StatusBar';
import LeftPanel from './components/layout/LeftPanel';
import CombatLog from './components/hunt/CombatLog';
import CombatSummary from './components/hunt/CombatSummary';
import HuntZones from './components/hunt/HuntZones';
import CombatStatus from './components/hunt/CombatStatus';
import Minimap from './components/hunt/Minimap';
import SkillBar from './components/hunt/SkillBar';
import ForgePanel from './components/forge/ForgePanel';
import InventoryPanel from './components/inventory/InventoryPanel';
import ZoneSelectPanel from './components/zones/ZoneSelectPanel';
import ShopPanel from './components/shop/ShopPanel';
import TradePanel from './components/trade/TradePanel';
import ChatPanel from './components/chat/ChatPanel';
import RightPanel from './components/layout/RightPanel';
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

  const isWideCenter = viewMode === 'inventory' || viewMode === 'zones' || viewMode === 'shop' || viewMode === 'trade';

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
          : '1fr 3fr 1fr',
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
            <HuntZones />
            <CombatStatus />

            {/* 미니맵(2x2) + 로그(우측 1x3) + 하단 빈영역 */}
            <div style={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              display: 'flex',
              gap: 'var(--layout-gap)',
            }}>
              {/* 좌측: 미니맵(상) + 빈영역(하) */}
              <div style={{
                flex: 2,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--layout-gap)',
              }}>
                {/* 미니맵(90%) + 스킬바(10%) — 2/3 높이 */}
                <div style={{ flex: 2, minHeight: 0, overflow: 'hidden', display: 'flex', gap: 'var(--layout-gap)' }}>
                  <div style={{ flex: 9, minWidth: 0, overflow: 'hidden' }}>
                    <Minimap />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <SkillBar />
                  </div>
                </div>
                {/* 하단 채팅 — 1/3 높이 */}
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  <ChatPanel />
                </div>
              </div>

              {/* 우측: 전투 로그 — 전체 높이 */}
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <CombatLog />
              </div>
            </div>
          </div>
        )}

        {viewMode === 'inventory' && <InventoryPanel />}
        {viewMode === 'zones' && <ZoneSelectPanel />}
        {viewMode === 'shop' && <ShopPanel />}
        {viewMode === 'trade' && <TradePanel />}

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

        {/* 우측: 리더보드 + 길드 */}
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
