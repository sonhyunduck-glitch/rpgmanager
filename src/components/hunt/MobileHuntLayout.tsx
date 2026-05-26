/* =========================================================
   MOBILE HUNT LAYOUT — 모바일 전용 사냥 전체화면 HUD
   디자인 핸드오프: 사냥-모바일.html 기반

   구조:
     canvas (Minimap 풀스크린) ← position:absolute inset:0
     ├─ topbar   (레벨+HP바 / 버프 / 골드+퀵메뉴)
     ├─ zone     (구역 표시)
     ├─ sideMenu (좌측 메뉴 버튼)
     ├─ actions  (우하단 액션 버튼)
     ├─ bottom   (스킬슬롯 + 물약)
     └─ chatFeed (채팅 피드)

   기존 컴포넌트 재사용:
     - Minimap: 풀스크린 캔버스 배경
     - SkillBar 슬롯: 하단 바에 재배치
     - CombatStatus 데이터: 상단 HUD에 재배치
     - AutoHuntIndicator: 구역 라벨 하단
     - HuntMetrics: 좌하단 오버레이 (기존 유지)
   ========================================================= */
import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { HUNT_ZONES, POTIONS, getBravePotionId } from '../../data/gameData';
import { CLASS_CONFIGS } from '../../data/classData';
import { finalAC, finalMR } from '../../data/statFormulas';
import { getAllEquipped } from '../../store/storeTypes';
import Minimap from './Minimap';
import HuntMetrics from './HuntMetrics';
import HpPotionModal from './HpPotionModal';
import TransformScrollModal from './TransformScrollModal';
import type { ViewMode } from '../../types';

/* ── 가격 포맷 ── */
function fmtG(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(n >= 100_000 ? 0 : 1)}만`;
  return n.toLocaleString();
}

/* ── 클래스 아이콘 ── */
const CLASS_ICON: Record<string, string> = { knight: '⚔', elf: '⌒', wizard: '✦' };

/* ── 네비게이션 항목 ── */
const SIDE_NAV: { mode: ViewMode; icon: string; label: string }[] = [
  { mode: 'inventory', icon: '⌗', label: '가방' },
  { mode: 'zones',     icon: '◈', label: '사냥터' },
  { mode: 'shop',      icon: '⛁', label: '상점' },
  { mode: 'skills',    icon: '✦', label: '스킬' },
  { mode: 'trade',     icon: '⇄', label: '거래소' },
];

/* ── 공통 스타일 ── */
const glassPanel = {
  background: 'rgba(0,0,0,0.55)',
  border: '1px solid oklch(0.36 0.014 260 / 0.6)',
  backdropFilter: 'blur(6px)',
} as const;

const textShadow = '0 0 4px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.95)';

/* ═══════════════════════════════════════════════════════════
   메인 컴포넌트
   ═══════════════════════════════════════════════════════════ */
export default function MobileHuntLayout() {
  const [showHpModal, setShowHpModal] = useState(false);
  const [showTsModal, setShowTsModal] = useState(false);

  /* ── store selectors ── */
  const viewMode     = useGameStore(s => s.viewMode);
  const setViewMode  = useGameStore(s => s.setViewMode);
  const hunt         = useGameStore(s => s.hunt);
  const level        = useGameStore(s => s.level);
  const playerName   = useGameStore(s => s.playerName);
  const playerClass  = useGameStore(s => s.playerClass);
  const currentHp    = useGameStore(s => s.currentHp);
  const baseMaxHp    = useGameStore(s => s.maxHp);
  const getTotalHpBonus = useGameStore(s => s.getTotalHpBonus);
  const getMaxMp     = useGameStore(s => s.getMaxMp);
  const gold         = useGameStore(s => s.gold);
  const activeBuffs  = useGameStore(s => s.activeBuffs);
  const potions      = useGameStore(s => s.potions);
  const materials    = useGameStore(s => s.materials);
  const selectedPotionId  = useGameStore(s => s.selectedPotionId);
  const potionAutoUse     = useGameStore(s => s.potionAutoUse);
  const greenPotionEnabled  = useGameStore(s => s.greenPotionEnabled);
  const couragePotionEnabled = useGameStore(s => s.couragePotionEnabled);
  const transformScrollEnabled = useGameStore(s => s.transformScrollEnabled);
  const transformScrollType    = useGameStore(s => s.transformScrollType);
  const getDex     = useGameStore(s => s.getDex);
  const getWis     = useGameStore(s => s.getWis);
  const getTotalDefense = useGameStore(s => s.getTotalDefense);

  const maxHp = baseMaxHp + getTotalHpBonus();
  const maxMp = getMaxMp();
  const currentMp = hunt.currentMp;
  const hpPct = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 100;
  const mpPct = maxMp > 0 ? Math.max(0, Math.min(100, (currentMp / maxMp) * 100)) : 0;

  const zone = HUNT_ZONES.find(z => z.id === hunt.zoneId);
  const isHunting = hunt.status === 'hunting';

  /* ── 전투 스탯 ── */
  const dex = getDex();
  const wis = getWis();
  const totalDef = getTotalDefense();
  const ac = finalAC(totalDef, level, dex, playerClass);
  const state = useGameStore.getState();
  const allSlots = getAllEquipped(state);
  const bonusMr = allSlots.reduce((s, eq) => s + (eq?.bonuses?.mr ?? 0), 0);
  const bonusSp = allSlots.reduce((s, eq) => s + (eq?.bonuses?.sp ?? 0), 0);
  const mr = finalMR(level, wis) + bonusMr;
  const combatStyle = CLASS_CONFIGS[playerClass].combatStyle;

  /* ── 물약 ── */
  const hpPotion = POTIONS[selectedPotionId];
  const hpCount = potions[selectedPotionId] ?? 0;
  const bravePotionId = getBravePotionId(playerClass);
  const greenCount = potions['green_potion'] ?? 0;
  const braveCount = potions[bravePotionId] ?? 0;

  /* ── 버프 ── */
  const now = Date.now();
  const aliveBuffs = activeBuffs.filter(b => b.expiresAt > now);

  /* ── 변신주문서 ── */
  const tsCount = transformScrollType === 'event'
    ? (materials['event_transform_scroll'] ?? 0)
    : (materials['transform_scroll'] ?? 0);

  /* ── 현재 사냥터 이름 ── */
  const zoneName = zone?.name ?? '대기중';
  const roomNum = hunt.currentRoom;

  /* ── 메인이 아닌 다른 뷰 (가방, 스킬 등) 일 때는 이 레이아웃 안 보임 ── */
  if (viewMode !== 'main') return null;

  return (
    <div style={{
      position: 'relative',
      width: '100%', height: '100%',
      overflow: 'hidden',
      background: 'var(--bg-canvas)',
    }}>
      {/* ━━━ CANVAS: 미니맵 풀스크린 배경 ━━━ */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <Minimap />
        <HuntMetrics />
      </div>

      {/* ━━━ TOP HUD BAR ━━━ */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        padding: '8px 8px 12px',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'start',
        gap: 8,
        zIndex: 10,
        background: 'linear-gradient(180deg, rgba(6,8,11,0.75), transparent)',
        pointerEvents: 'none',
      }}>
        {/* 각 자식은 pointer-events: auto */}

        {/* ── LEFT: 레벨 + HP/MP 바 + 미니 스탯 ── */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', pointerEvents: 'auto' }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 22, fontWeight: 700,
            color: 'var(--text)',
            lineHeight: 1,
            textShadow,
          }}>
            {level}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* HP Bar */}
            <HudBar
              value={currentHp} max={maxHp}
              pct={hpPct}
              gradient="linear-gradient(180deg, var(--danger), oklch(0.50 0.17 25))"
            />
            {/* MP Bar */}
            {maxMp > 0 && (
              <HudBar
                value={currentMp} max={maxMp}
                pct={mpPct}
                gradient="linear-gradient(180deg, var(--info), oklch(0.55 0.13 230))"
              />
            )}
            {/* Mini stats */}
            <div style={{
              display: 'flex', gap: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: 9, color: 'var(--text-dim)',
              marginTop: 2,
            }}>
              <span style={{ textShadow }}>
                <span style={{ color: 'var(--text-mute)' }}>AC</span>{' '}
                <span style={{ color: 'var(--danger)' }}>{ac}</span>
              </span>
              <span style={{ textShadow }}>
                <span style={{ color: 'var(--text-mute)' }}>HIT</span>{' '}
                {combatStyle === 'ranged_magic' ? '자동' : '—'}
              </span>
              {bonusSp > 0 && (
                <span style={{ textShadow }}>
                  <span style={{ color: 'var(--text-mute)' }}>SP</span> +{bonusSp}
                </span>
              )}
              <span style={{ textShadow }}>
                <span style={{ color: 'var(--text-mute)' }}>MR</span> {mr}
              </span>
            </div>
          </div>
        </div>

        {/* ── CENTER: 버프 슬롯 ── */}
        <div style={{
          justifySelf: 'center',
          display: 'flex', gap: 4,
          alignItems: 'center',
          pointerEvents: 'auto',
        }}>
          {aliveBuffs.slice(0, 4).map((buff, i) => {
            const remainSec = Math.max(0, Math.floor((buff.expiresAt - now) / 1000));
            const min = Math.floor(remainSec / 60);
            const isPassive = buff.potionId?.startsWith('passive_');
            const isTs = buff.potionId === 'transform_scroll';
            const isGreen = buff.potionId === 'green_potion';
            const color = isTs ? 'var(--accent)' : isGreen ? 'var(--success)' : 'oklch(0.68 0.20 305)';
            return (
              <div key={i} style={{
                width: 30, height: 30,
                ...glassPanel,
                borderRadius: 6,
                display: 'grid', placeItems: 'center',
                position: 'relative',
                fontSize: 14,
                color,
              }}>
                {isTs ? '⚜' : isGreen ? '✚' : '✦'}
                {!isPassive && (
                  <span style={{
                    position: 'absolute', bottom: -2, right: -2,
                    fontFamily: 'var(--font-mono)', fontSize: 8,
                    background: 'var(--accent)', color: '#000',
                    padding: '0 3px', borderRadius: 3, fontWeight: 700,
                  }}>
                    {min}m
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* ── RIGHT: 골드 + 퀵 메뉴 ── */}
        <div style={{
          justifySelf: 'end',
          display: 'flex', flexDirection: 'column', gap: 6,
          alignItems: 'flex-end',
          pointerEvents: 'auto',
        }}>
          {/* 골드 필 */}
          <span style={{
            background: 'rgba(0,0,0,0.6)',
            border: '1px solid oklch(0.74 0.17 55 / 0.4)',
            color: 'var(--accent)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11, fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 999,
            textShadow,
          }}>
            {fmtG(gold)} G
          </span>
          {/* 퀵 메뉴 (랭킹, 클랜 등) */}
          <div style={{ display: 'flex', gap: 4 }}>
            <QBtn icon="♛" title="랭킹" onClick={() => setViewMode('ranking')} />
            <QBtn icon="◈" title="클랜" onClick={() => setViewMode('guild')} />
          </div>
        </div>
      </div>

      {/* ━━━ ZONE LABEL (우측 상단, 탑바 아래) ━━━ */}
      <div style={{
        position: 'absolute',
        top: 82, right: 12,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-dim)',
        textAlign: 'right',
        textShadow,
        zIndex: 5,
        pointerEvents: 'none',
      }}>
        <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 12.5 }}>
          {zoneName} {roomNum > 0 && `${roomNum}구역`}
        </div>
        {isHunting && (
          <div style={{ color: 'var(--success)', fontSize: 10, marginTop: 2 }}>
            ● 자동 사냥
          </div>
        )}
      </div>

      {/* ━━━ LEFT SIDE MENU ━━━ */}
      <div style={{
        position: 'absolute',
        left: 8, top: 110,
        display: 'flex', flexDirection: 'column', gap: 6,
        zIndex: 9,
      }}>
        {SIDE_NAV.map(item => {
          const isActive = viewMode === item.mode;
          return (
            <button
              key={item.mode}
              onClick={() => setViewMode(item.mode)}
              style={{
                width: 44, height: 44,
                ...glassPanel,
                borderRadius: '50%',
                display: 'grid', placeItems: 'center',
                color: isActive ? 'var(--accent)' : 'var(--text-dim)',
                fontSize: 16,
                cursor: 'pointer',
                position: 'relative',
                ...(isActive ? {
                  background: 'oklch(0.74 0.17 55 / 0.18)',
                  borderColor: 'var(--accent)',
                } : {}),
              }}
              title={item.label}
            >
              {item.icon}
              <span style={{
                position: 'absolute',
                fontSize: 8,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-mute)',
                top: '100%', marginTop: 2,
                textShadow,
                letterSpacing: '-0.04em',
                whiteSpace: 'nowrap',
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ━━━ RIGHT ACTIONS (공격/자동/스킬 버튼) ━━━ */}
      <div style={{
        position: 'absolute',
        right: 12, bottom: 100,
        width: 150, height: 150,
        zIndex: 9,
      }}>
        {/* 메인 공격 버튼 — 70×70 */}
        <div style={{
          position: 'absolute', right: 0, bottom: 0,
          width: 70, height: 70,
          borderRadius: '50%',
          background: 'radial-gradient(circle, oklch(0.74 0.17 55 / 0.25), rgba(0,0,0,0.6))',
          border: '2px solid var(--accent)',
          display: 'grid', placeItems: 'center',
          color: 'var(--accent)',
          fontSize: 28,
          boxShadow: '0 0 20px oklch(0.74 0.17 55 / 0.4)',
          pointerEvents: 'none',
        }}>
          {CLASS_ICON[playerClass] ?? '⚔'}
        </div>

        {/* AUTO 버튼 */}
        <div style={{
          position: 'absolute', right: 82, bottom: 8,
          width: 48, height: 48,
          borderRadius: '50%',
          ...glassPanel,
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 10, fontWeight: 700,
          color: isHunting ? 'var(--success)' : 'var(--text-dim)',
          ...(isHunting ? {
            borderColor: 'var(--success)',
            background: 'radial-gradient(circle, oklch(0.76 0.17 145 / 0.2), rgba(0,0,0,0.6))',
          } : {}),
          pointerEvents: 'none',
        }}>
          AUTO
          {isHunting && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              width: 8, height: 8,
              background: 'var(--success)',
              borderRadius: '50%',
              boxShadow: '0 0 6px var(--success)',
              animation: 'pulse 1.4s ease-in-out infinite',
            }} />
          )}
        </div>

        {/* 클래스 아이콘 버튼 */}
        <button
          onClick={() => setShowTsModal(true)}
          style={{
            position: 'absolute', right: 8, bottom: 82,
            width: 48, height: 48,
            borderRadius: '50%',
            ...glassPanel,
            display: 'grid', placeItems: 'center',
            color: 'var(--info)',
            fontSize: 16, cursor: 'pointer',
            borderColor: 'oklch(0.74 0.14 230 / 0.5)',
          }}
          title="변신주문서"
        >
          ⚜
        </button>

        {/* 스킬 버튼 */}
        <div style={{
          position: 'absolute', right: 84, bottom: 82,
          width: 48, height: 48,
          borderRadius: '50%',
          ...glassPanel,
          display: 'grid', placeItems: 'center',
          fontSize: 20, color: 'var(--text-dim)',
          pointerEvents: 'none',
        }}>
          {combatStyle === 'ranged_magic' ? '✦' : combatStyle === 'ranged_bow' ? '⌒' : '⚔'}
        </div>
      </div>

      {/* ━━━ BOTTOM BAR (물약 슬롯) ━━━ */}
      <div style={{
        position: 'absolute',
        left: 0, right: 0, bottom: 0,
        padding: '8px 8px 12px',
        display: 'flex',
        gap: 4,
        zIndex: 10,
        background: 'linear-gradient(0deg, rgba(6,8,11,0.85), transparent)',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}>
        {/* 좌: 빈 스킬 슬롯 (미래 확장) */}
        <div style={{ display: 'flex', gap: 4 }}>
          {/* HP 물약 설정 슬롯 */}
          <button
            onClick={() => setShowHpModal(true)}
            style={{
              ...slotStyle,
              borderColor: potionAutoUse
                ? 'var(--danger)'
                : 'oklch(0.36 0.014 260 / 0.6)',
            }}
            title={`${hpPotion?.name ?? 'HP 물약'} (${hpCount})`}
          >
            <span style={{
              width: 18, height: 18, borderRadius: '50%',
              background: 'var(--danger)',
              boxShadow: potionAutoUse ? '0 0 6px var(--danger)' : 'none',
            }} />
            <span style={potCountStyle}>{hpCount}</span>
          </button>

          {/* 초록 물약 슬롯 */}
          <div style={{
            ...slotStyle,
            borderColor: greenPotionEnabled
              ? 'var(--success)'
              : 'oklch(0.36 0.014 260 / 0.6)',
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: '50%',
              background: 'var(--success)',
              boxShadow: greenPotionEnabled ? '0 0 6px var(--success)' : 'none',
            }} />
            <span style={potCountStyle}>{greenCount}</span>
          </div>

          {/* 용기 물약 슬롯 */}
          <div style={{
            ...slotStyle,
            borderColor: couragePotionEnabled
              ? 'oklch(0.68 0.20 305)'
              : 'oklch(0.36 0.014 260 / 0.6)',
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: '50%',
              background: 'oklch(0.68 0.20 305)',
              boxShadow: couragePotionEnabled ? '0 0 6px oklch(0.68 0.20 305)' : 'none',
            }} />
            <span style={potCountStyle}>{braveCount}</span>
          </div>

          {/* 변신주문서 슬롯 */}
          <button
            onClick={() => setShowTsModal(true)}
            style={{
              ...slotStyle,
              borderColor: transformScrollEnabled
                ? (transformScrollType === 'event' ? '#F5C518' : '#00e5ff')
                : 'oklch(0.36 0.014 260 / 0.6)',
              cursor: 'pointer',
            }}
            title="변신주문서"
          >
            <span style={{
              width: 18, height: 18, borderRadius: '50%',
              background: transformScrollType === 'event' ? '#F5C518' : '#00e5ff',
              boxShadow: transformScrollEnabled
                ? `0 0 6px ${transformScrollType === 'event' ? '#F5C518' : '#00e5ff'}`
                : 'none',
              opacity: transformScrollEnabled ? 1 : 0.4,
            }} />
            <span style={potCountStyle}>{tsCount}</span>
          </button>
        </div>

        {/* 우: 캐릭터 정보 필 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px',
          ...glassPanel,
          borderRadius: 999,
          pointerEvents: 'auto',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10, fontWeight: 700,
            color: 'var(--accent)',
            textShadow,
          }}>
            {CLASS_ICON[playerClass]} {playerName}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9, color: 'var(--text-mute)',
          }}>
            Lv.{level}
          </span>
        </div>
      </div>

      {/* ━━━ 모달 ━━━ */}
      {showHpModal && <HpPotionModal onClose={() => setShowHpModal(false)} />}
      {showTsModal && <TransformScrollModal onClose={() => setShowTsModal(false)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   서브 컴포넌트
   ═══════════════════════════════════════════════════════════ */

/** 상단 HUD HP/MP 바 */
function HudBar({ value, max, pct, gradient }: {
  value: number; max: number; pct: number; gradient: string;
}) {
  return (
    <div style={{
      width: 110, height: 9,
      background: 'rgba(0,0,0,0.65)',
      borderRadius: 2,
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: gradient,
        borderRadius: 2,
        transition: 'width 0.25s',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 8, fontWeight: 700,
        color: '#fff',
        textShadow: '0 0 3px rgba(0,0,0,0.95)',
        letterSpacing: '-0.02em',
      }}>
        {value} / {max}
      </div>
    </div>
  );
}

/** 퀵 버튼 (우상단 원형) */
function QBtn({ icon, title, onClick }: {
  icon: string; title: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 32, height: 32,
        ...glassPanel,
        borderRadius: '50%',
        display: 'grid', placeItems: 'center',
        color: 'var(--text-dim)',
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      {icon}
    </button>
  );
}

/* ── 하단 물약 슬롯 스타일 ── */
const slotStyle: React.CSSProperties = {
  position: 'relative',
  width: 48, height: 48,
  background: 'rgba(0,0,0,0.6)',
  border: '1px solid oklch(0.36 0.014 260 / 0.6)',
  borderRadius: 8,
  display: 'grid', placeItems: 'center',
  backdropFilter: 'blur(6px)',
  cursor: 'default',
  padding: 0,
};

const potCountStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 1, right: 3,
  fontFamily: 'var(--font-mono)',
  fontSize: 9, fontWeight: 700,
  color: 'var(--text)',
  textShadow: '0 0 3px rgba(0,0,0,0.95)',
};
