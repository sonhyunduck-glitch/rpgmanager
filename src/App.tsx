import { useEffect, useRef } from 'react';
import { useGameStore } from './store/gameStore';
import { saveState as saveStateToLS } from './store/helpers';
import { flushNow } from './lib/dbSync';
import { useMobile } from './lib/useMobile';
import StatusBar from './components/layout/StatusBar';
import LeftPanel from './components/layout/LeftPanel';
import CombatStatus from './components/hunt/CombatStatus';
import Minimap from './components/hunt/Minimap';
import InventoryPanel from './components/inventory/InventoryPanel';
import ZoneSelectPanel from './components/zones/ZoneSelectPanel';
import ShopPanel from './components/shop/ShopPanel';
import TradePanel from './components/trade/TradePanel';
import SkillPanel from './components/skills/SkillPanel';
import ChatPanel from './components/chat/ChatPanel';
import HuntMetrics from './components/hunt/HuntMetrics';
import AutoHuntIndicator from './components/hunt/AutoHuntIndicator';
import RightPanel from './components/layout/RightPanel';
import ProfilePanel from './components/profile/ProfileModal';
import Leaderboard from './components/guild/Leaderboard';
import GuildPanel from './components/guild/GuildPanel';
import MobileHuntLayout from './components/hunt/MobileHuntLayout';
import MobileShell from './components/layout/MobileShell';
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
  const dbReady = useGameStore(s => s.dbReady);
  const mobile = useMobile();

  const initFromDB = useGameStore(s => s.initFromDB);
  const initDone = useRef(false);

  // DB에서 유저 데이터 로드
  useEffect(() => {
    if (!initDone.current) {
      initDone.current = true;
      initFromDB(userId);
    }
  }, [userId, initFromDB]);

  // 페이지 이탈 시 상태 저장 (DB 로드 완료 후에만 — 구 데이터 덮어쓰기 방지)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!useGameStore.getState().dbReady) return; // DB 미로드 시 세이브 차단
      const s = useGameStore.getState();
      saveStateToLS(s);
      flushNow().catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 동적 틱: setTimeout 체인 — 버프에 따라 간격이 바뀜
  // ⚠️ dbReady 전까지 사냥 차단 (기기 이동 시 구 데이터로 전투 방지)
  useEffect(() => {
    if (!dbReady || huntStatus !== 'hunting') {
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
  }, [dbReady, huntStatus, tickHunt, getAtkSpeedMult]);

  const viewingProfileId = useGameStore(s => s.viewingProfileId);

  // 프로필 조회 중이면 우측 패널이 필요하므로 3컬럼
  const hasRightPanel = viewMode === 'main' || !!viewingProfileId;
  const isWideCenter = !hasRightPanel;

  // DB 로드 완료 전 로딩 표시 (기기 이동 시 구 데이터 조작 방지)
  if (!dbReady) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-canvas)',
      }}>
        <div style={{
          fontFamily: "'Space Grotesk', var(--font-display)",
          fontSize: 16, color: 'var(--text-mute)',
        }}>데이터 동기화 중...</div>
      </div>
    );
  }

  /* ── 모바일 세로모드 레이아웃 ── */
  if (mobile) {
    return (
      <div style={{
        width: '100%', height: '100dvh',
        overflow: 'hidden',
        background: 'var(--bg-canvas)',
        position: 'relative',
      }}>
        {viewMode === 'main' ? (
          /* 사냥: 독립 전체화면 (캔버스 + HUD 오버레이) */
          <MobileHuntLayout />
        ) : (
          /* 나머지 7개 페이지: MobileShell (탑바 + 바텀네비 + 드로어) */
          <MobileShell>
            {viewMode === 'inventory' && <InventoryPanel />}
            {viewMode === 'zones' && <ZoneSelectPanel />}
            {viewMode === 'shop' && <ShopPanel />}
            {viewMode === 'trade' && <TradePanel />}
            {viewMode === 'skills' && <SkillPanel />}
            {viewMode === 'ranking' && <Leaderboard />}
            {viewMode === 'guild' && <GuildPanel />}
          </MobileShell>
        )}

        {/* 프로필 모달 (모바일에서도 오버레이) */}
        {viewingProfileId && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 50,
            overflow: 'auto',
          }}>
            <ProfilePanel />
          </div>
        )}

        {/* 전역 모달 오버레이 */}
        <OfflineRewardModal />
        <UpdateModal />
      </div>
    );
  }

  /* ── 데스크톱 레이아웃 (기존) ── */
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
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

            {/* 미니맵 + 오버레이 */}
            <div style={{
              flex: 3,
              minHeight: 0,
              overflow: 'hidden',
              position: 'relative',
            }}>
              <Minimap />
              <HuntMetrics />
              <AutoHuntIndicator />
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

        {/* 우측 패널: 프로필 조회 중이면 프로필, 아니면 기본(사냥터+로그) */}
        {viewingProfileId ? (
          <div style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
            <ProfilePanel />
          </div>
        ) : viewMode === 'main' ? (
          <RightPanel />
        ) : null}
      </div>

      {/* 전역 모달 오버레이 */}
      <OfflineRewardModal />
      <UpdateModal />
      <RotateOverlay />
    </div>
  );
}
