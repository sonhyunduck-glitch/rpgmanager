/* =========================================================
   MOBILE HUNT LAYOUT — 모바일 세로모드 사냥 전체화면 HUD
   디자인 핸드오프: 사냥-모바일.html 기반 (세로 모드)

   구조:
     canvas (Minimap 풀스크린) ← position:absolute inset:0
     ├─ topbar   (레벨+HP/MP바 / 버프 / 골드)
     ├─ zone     (구역 표시 + 자동사냥)
     ├─ actions  (우하단 공격/스킬 버튼)
     ├─ bottom   (물약슬롯 + 캐릭터정보)
     └─ metrics  (HuntMetrics 오버레이)

   사냥 화면은 MobileShell 없이 독립 전체화면.
   다른 페이지 이동은 하단 네비 바 통해서.
   ========================================================= */
import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { HUNT_ZONES, getBravePotionId } from '../../data/gameData';
import { CLASS_CONFIGS } from '../../data/classData';
import {
  finalAC, finalMR, calcPlayerHitRate, calcBluePotionMpBonus, calcMpRegenAmount,
  meleeHit, minDamage, maxDamage, bowMinDamage, bowMaxDamage,
  magicDamageRange,
  calcHpRegenRange, calcHpRegenIntervalSec,
  calcMpRegenIntervalSec,
} from '../../data/statFormulas';
import { getAllEquipped, ROOMS_PER_ZONE } from '../../store/storeTypes';
import Minimap from './Minimap';
import HuntMetrics from './HuntMetrics';
import HpPotionModal from './HpPotionModal';
import TransformScrollModal from './TransformScrollModal';
import MiniChatFeed from './MiniChatFeed';
import type { ViewMode, PlayerClass, CombatStyle, Equipment, ActiveBuff, StatKey } from '../../types';

/* ── 물약 쿨다운 RAF 훅 (60fps 부드러운 프로그레스) ── */
function usePotionCooldown(lastUsedAt: number, cooldownMs: number): number {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (cooldownMs <= 0 || lastUsedAt <= 0) {
      setProgress(0);
      return;
    }
    const endAt = lastUsedAt + cooldownMs;
    const tick = () => {
      const remaining = Math.max(0, endAt - Date.now());
      const p = remaining / cooldownMs;
      setProgress(p);
      if (p > 0) rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(rafRef.current);
  }, [lastUsedAt, cooldownMs]);

  return progress;
}

/* ── 가격 포맷 ── */
function fmtG(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(n >= 100_000 ? 0 : 1)}만`;
  return n.toLocaleString();
}

/* ── 공통 스타일 ── */
const glassPanel = {
  background: 'rgba(0,0,0,0.55)',
  border: '1px solid oklch(0.36 0.014 260 / 0.6)',
  backdropFilter: 'blur(6px)',
} as const;

const textShadow = '0 0 4px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.95)';

/* ── 퀵 메뉴 (드롭다운) ── */
const ALL_MENU: { mode: ViewMode; icon: string; label: string }[] = [
  { mode: 'inventory', icon: '⌗', label: '가방' },
  { mode: 'skills',    icon: '✦', label: '스킬' },
  { mode: 'shop',      icon: '⛁', label: '상점' },
  { mode: 'zones',     icon: '◈', label: '사냥터' },
  { mode: 'trade',     icon: '⇄', label: '거래소' },
  { mode: 'guild',     icon: '⚑', label: '길드' },
  { mode: 'ranking',   icon: '♛', label: '랭킹' },
];

/* ═══════════════════════════════════════════════════════════
   메인 컴포넌트
   ═══════════════════════════════════════════════════════════ */
export default function MobileHuntLayout() {
  const [showHpModal, setShowHpModal] = useState(false);
  const [showTsModal, setShowTsModal] = useState(false);
  const [showBuffModal, setShowBuffModal] = useState(false);
  const [showRoomSelector, setShowRoomSelector] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  /* ── store selectors ── */
  const viewMode     = useGameStore(s => s.viewMode);
  const setViewMode  = useGameStore(s => s.setViewMode);
  const hunt         = useGameStore(s => s.hunt);
  const level        = useGameStore(s => s.level);
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
  const bluePotionEnabled    = useGameStore(s => s.bluePotionEnabled);
  const transformScrollEnabled = useGameStore(s => s.transformScrollEnabled);
  const transformScrollType    = useGameStore(s => s.transformScrollType);
  const lastPotionUsedAt       = useGameStore(s => s.lastPotionUsedAt);
  const lastPotionCooldownMs   = useGameStore(s => s.lastPotionCooldownMs);
  const getStr     = useGameStore(s => s.getStr);
  const getDex     = useGameStore(s => s.getDex);
  const getCon     = useGameStore(s => s.getCon);
  const getWis     = useGameStore(s => s.getWis);
  const getInt     = useGameStore(s => s.getInt);
  const getTotalDefense = useGameStore(s => s.getTotalDefense);
  const statAllocation = useGameStore(s => s.statAllocation);
  const playerName = useGameStore(s => s.playerName);
  const equippedWeapon = useGameStore(s => s.equippedWeapon);
  const moveToRoom = useGameStore(s => s.moveToRoom);

  const maxHp = baseMaxHp + getTotalHpBonus();
  const maxMp = getMaxMp();
  const currentMp = hunt.currentMp;
  const hpPct = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 100;
  const mpPct = maxMp > 0 ? Math.max(0, Math.min(100, (currentMp / maxMp) * 100)) : 0;

  const zone = HUNT_ZONES.find(z => z.id === hunt.zoneId);
  const isHunting = hunt.status === 'hunting';

  /* ── 전투 스탯 ── */
  const str = getStr();
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
  const weaponEnchant = state.equippedWeapon?.enhanceLevel ?? 0;
  const equipBonusHit = allSlots.reduce((s, eq) => s + (eq?.bonuses?.hit ?? 0), 0);
  const hitRate = calcPlayerHitRate(level, str, dex, weaponEnchant, equipBonusHit);

  /* ── 물약 ── */
  const HP_POTION_COLORS: Record<string, string> = {
    red_potion: '#ef5350',
    crimson_potion: '#ff7043',
    clear_potion: '#e0e0e0',
  };
  const hpPotionColor = HP_POTION_COLORS[selectedPotionId] ?? '#ef5350';
  const hpCount = potions[selectedPotionId] ?? 0;
  const bravePotionId = getBravePotionId(playerClass);
  const greenCount = potions['green_potion'] ?? 0;
  const blueCount  = potions['blue_potion'] ?? 0;
  const braveCount = potions[bravePotionId] ?? 0;

  /* ── 버프 ── */
  const now = Date.now();
  const aliveBuffs = activeBuffs.filter(b => b.expiresAt > now);

  /* ── 변신주문서 ── */
  const tsCount = transformScrollType === 'event'
    ? (materials['event_transform_scroll'] ?? 0)
    : (materials['transform_scroll'] ?? 0);

  /* ── 물약 쿨다운 오버레이 (RAF 60fps) ── */
  const potionCdProgress = usePotionCooldown(lastPotionUsedAt, lastPotionCooldownMs || 3000);

  /* ── 현재 사냥터 이름 ── */
  const zoneName = zone?.name ?? '대기중';
  const roomNum = hunt.currentRoom;

  /* ── 메인이 아닌 다른 뷰일 때는 이 레이아웃 안 보임 ── */
  if (viewMode !== 'main') return null;

  return (
    <div style={{
      position: 'relative',
      width: '100%', height: '100%',
      overflow: 'hidden',
      background: 'var(--bg-canvas)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ━━━ CANVAS: 미니맵 풀스크린 배경 ━━━ */}
      <div style={{
        position: 'absolute', inset: 0,
      }}>
        <Minimap />
        <HuntMetrics />
      </div>

      {/* ━━━ TOP HUD BAR ━━━ */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        padding: '8px 8px 8px',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'start',
        gap: 8,
        zIndex: 10,
        background: 'linear-gradient(180deg, rgba(6,8,11,0.82) 60%, transparent)',
        pointerEvents: 'none',
      }}>
        {/* ── LEFT: 레벨 + HP/MP 바 + 미니 스탯 ── */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', pointerEvents: 'auto' }}>
          <button
            onClick={() => setShowStatsModal(true)}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 22, fontWeight: 700,
              color: 'var(--text)',
              lineHeight: 1,
              textShadow,
              cursor: 'pointer',
            }}
          >
            {level}
          </button>
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
              display: 'flex', flexWrap: 'wrap', gap: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: 9, color: 'var(--text-dim)',
              marginTop: 3,
            }}>
              <span style={{ textShadow }}>
                <span style={{ color: 'var(--text-mute)' }}>AC</span>{' '}
                <span style={{ color: 'var(--danger)' }}>{ac}</span>
              </span>
              <span style={{ textShadow }}>
                <span style={{ color: 'var(--text-mute)' }}>HIT</span>{' '}
                {combatStyle === 'ranged_magic' ? '자동' : hitRate}
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

        {/* ── CENTER: 버프 뱃지 (클릭→모달) ── */}
        <div style={{ justifySelf: 'center', pointerEvents: 'auto' }}>
          {aliveBuffs.length > 0 && (
            <button
              onClick={() => setShowBuffModal(true)}
              style={{
                ...glassPanel,
                borderRadius: 999,
                padding: '4px 12px',
                display: 'flex', alignItems: 'center', gap: 5,
                cursor: 'pointer',
                borderColor: 'oklch(0.68 0.20 305 / 0.6)',
              }}
            >
              <span style={{ fontSize: 12, color: 'oklch(0.68 0.20 305)' }}>✦</span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10, fontWeight: 700,
                color: 'oklch(0.68 0.20 305)',
                textShadow,
              }}>
                BUFF
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9, fontWeight: 700,
                background: 'oklch(0.68 0.20 305)',
                color: '#000',
                padding: '0 5px', borderRadius: 99,
                minWidth: 16, textAlign: 'center',
              }}>
                {aliveBuffs.length}
              </span>
            </button>
          )}
        </div>

        {/* ── RIGHT: 골드 + 퀵 메뉴 ── */}
        <div style={{
          justifySelf: 'end',
          pointerEvents: 'auto',
          display: 'flex', flexDirection: 'column',
          gap: 6, alignItems: 'flex-end',
        }}>
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
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMoreMenu(v => !v)}
              style={{
                width: 36, height: 40,
                background: showMoreMenu ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.55)',
                border: `1px solid ${showMoreMenu ? 'var(--accent)' : 'var(--border-soft)'}`,
                borderRadius: 8,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 1,
                color: showMoreMenu ? 'var(--accent)' : 'var(--text-dim)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <span style={{ fontSize: 13, lineHeight: 1 }}>☰</span>
              <span style={{
                fontSize: 8, lineHeight: 1,
                fontFamily: 'var(--font-mono)',
                color: showMoreMenu ? 'var(--accent)' : 'var(--text-mute)',
              }}>메뉴</span>
            </button>
            {showMoreMenu && (
              <>
                <div
                  onClick={() => setShowMoreMenu(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: -1 }}
                />
                <div style={{
                  position: 'absolute',
                  top: '100%', right: 0,
                  marginTop: 6,
                  background: 'rgba(10,12,16,0.92)',
                  border: '1px solid var(--border-soft)',
                  borderRadius: 8,
                  padding: '4px 0',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                  minWidth: 110,
                  zIndex: 20,
                }}>
                  {ALL_MENU.map(({ mode, icon, label }) => (
                    <button
                      key={mode}
                      onClick={() => { setViewMode(mode); setShowMoreMenu(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        width: '100%', padding: '9px 14px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11, fontWeight: 500,
                        color: 'var(--text)',
                        textShadow: 'none',
                      }}
                    >
                      <span style={{ fontSize: 13, width: 18, textAlign: 'center' }}>{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ━━━ ZONE LABEL (좌측, 탑바 아래) — 클릭 시 구역 선택 ━━━ */}
      <div style={{
        position: 'absolute',
        top: 86, left: 12,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-dim)',
        textAlign: 'left',
        textShadow: '0 0 4px rgba(0,0,0,0.9)',
        zIndex: 15,
      }}>
        <button
          onClick={() => { if (isHunting) setShowRoomSelector(v => !v); }}
          style={{
            background: 'none', border: 'none', padding: '4px 8px',
            margin: '-4px -8px',
            cursor: isHunting ? 'pointer' : 'default',
            color: 'var(--text)', fontWeight: 700, fontSize: 12.5,
            fontFamily: 'var(--font-mono)',
            textShadow: '0 0 4px rgba(0,0,0,0.9)',
            display: 'flex', alignItems: 'center', gap: 4,
            justifyContent: 'flex-start',
          }}
        >
          {zoneName} {roomNum > 0 && `${roomNum}구역`}
          {isHunting && (
            <span style={{
              fontSize: 8, color: 'var(--text-mute)',
              transform: showRoomSelector ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
              display: 'inline-block',
            }}>▼</span>
          )}
        </button>
        {isHunting && (
          <div style={{
            color: 'var(--success)', fontSize: 10, marginTop: 2,
            display: 'flex', alignItems: 'center', gap: 4,
            justifyContent: 'flex-start',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--success)',
              boxShadow: '0 0 6px var(--success)',
              animation: 'pulse 1.4s ease-in-out infinite',
              display: 'inline-block',
            }} />
            자동 사냥
          </div>
        )}

        {/* ── 구역 선택 드롭다운 ── */}
        {showRoomSelector && isHunting && (
          <>
            <div
              onClick={() => setShowRoomSelector(false)}
              style={{ position: 'fixed', inset: 0, zIndex: -1 }}
            />
            <div style={{
              marginTop: 6,
              background: 'rgba(10,12,16,0.92)',
              border: '1px solid var(--border-soft)',
              borderRadius: 8,
              padding: '4px 0',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              minWidth: 120,
            }}>
              {Array.from({ length: ROOMS_PER_ZONE }, (_, i) => {
                const room = i + 1;
                const isCurrent = room === roomNum;
                const isCleared = room <= hunt.roomCleared;
                const isNext = room === hunt.roomCleared + 1;
                const isLocked = room > hunt.roomCleared + 1;

                return (
                  <button
                    key={room}
                    disabled={isLocked}
                    onClick={() => {
                      if (!isLocked && !isCurrent) {
                        moveToRoom(room);
                      }
                      setShowRoomSelector(false);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      width: '100%', padding: '8px 14px',
                      background: isCurrent ? 'rgba(255,255,255,0.06)' : 'transparent',
                      border: 'none',
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11, fontWeight: isCurrent ? 700 : 500,
                      color: isLocked ? 'var(--text-faint)'
                        : isCurrent ? 'var(--accent)'
                        : isCleared ? 'var(--text)'
                        : isNext ? 'var(--success)'
                        : 'var(--text-dim)',
                      textAlign: 'left',
                      justifyContent: 'flex-start',
                      textShadow: 'none',
                      opacity: isLocked ? 0.4 : 1,
                    }}
                  >
                    <span style={{ fontSize: 10 }}>
                      {isLocked ? '🔒' : isCleared ? '✓' : isCurrent ? '▶' : '○'}
                    </span>
                    {room}구역
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ━━━ BOTTOM CONSUMABLE GRID (3×2) ━━━ */}
      <div style={{
        position: 'absolute',
        right: 8, bottom: 8,
        zIndex: 10,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 44px)',
        gap: 3,
      }}>
        {/* Row 1: HP물약 · 초록물약 · 용기물약 */}
        <button
          onClick={() => setShowHpModal(true)}
          style={{
            ...slotStyle,
            borderColor: potionAutoUse ? hpPotionColor : 'oklch(0.36 0.014 260 / 0.6)',
            cursor: 'pointer',
          }}
        >
          <svg width="22" height="24" viewBox="0 0 22 24" style={{
            filter: potionAutoUse ? `drop-shadow(0 0 4px ${hpPotionColor})` : 'none',
          }}>
            {/* 뚜껑 */}
            <rect x="8" y="0" width="6" height="4" rx="1" fill="rgba(255,255,255,0.5)" />
            {/* 목 */}
            <rect x="9" y="4" width="4" height="3" rx="0.5" fill={hpPotionColor} opacity="0.7" />
            {/* 몸통 */}
            <path d="M9,7 Q4,10 4,15 Q4,23 11,23 Q18,23 18,15 Q18,10 13,7 Z"
              fill={hpPotionColor} />
            {/* 하이라이트 */}
            <ellipse cx="8.5" cy="14" rx="2" ry="3.5" fill="rgba(255,255,255,0.25)" />
          </svg>
          {potionCdProgress > 0 && (
            <svg
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}
              viewBox="0 0 44 44"
            >
              <circle
                cx="22" cy="22" r="18"
                fill="none"
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${2 * Math.PI * 18 * (1 - potionCdProgress)}`}
                transform="rotate(-90 22 22)"
              />
            </svg>
          )}
          <span style={potCountStyle}>{hpCount}</span>
        </button>

        <div style={{
          ...slotStyle,
          borderColor: greenPotionEnabled ? 'var(--success)' : 'oklch(0.36 0.014 260 / 0.6)',
        }}>
          <span style={{
            width: 18, height: 18, borderRadius: '50%',
            background: 'var(--success)',
            boxShadow: greenPotionEnabled ? '0 0 6px var(--success)' : 'none',
          }} />
          <span style={potCountStyle}>{greenCount}</span>
        </div>

        <div style={{
          ...slotStyle,
          borderColor: couragePotionEnabled ? 'oklch(0.68 0.20 305)' : 'oklch(0.36 0.014 260 / 0.6)',
        }}>
          <span style={{
            width: 18, height: 18, borderRadius: '50%',
            background: 'oklch(0.68 0.20 305)',
            boxShadow: couragePotionEnabled ? '0 0 6px oklch(0.68 0.20 305)' : 'none',
          }} />
          <span style={potCountStyle}>{braveCount}</span>
        </div>

        {/* Row 2: 변신주문서 · 파란물약 · 빈칸 */}
        <button
          onClick={() => setShowTsModal(true)}
          style={{
            ...slotStyle,
            borderColor: transformScrollEnabled
              ? (transformScrollType === 'event' ? '#F5C518' : '#00e5ff')
              : 'oklch(0.36 0.014 260 / 0.6)',
            cursor: 'pointer',
          }}
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

        <div style={{
          ...slotStyle,
          borderColor: bluePotionEnabled ? '#42a5f5' : 'oklch(0.36 0.014 260 / 0.6)',
        }}>
          <span style={{
            width: 18, height: 18, borderRadius: '50%',
            background: '#42a5f5',
            boxShadow: bluePotionEnabled ? '0 0 6px #42a5f5' : 'none',
          }} />
          <span style={potCountStyle}>{blueCount}</span>
        </div>

        {/* 빈 슬롯 */}
        <div style={slotStyle} />
      </div>

      {/* ━━━ 미니 채팅 (좌하단 오버레이) ━━━ */}
      <MiniChatFeed />

      {/* ━━━ 모달 ━━━ */}
      {showHpModal && <HpPotionModal onClose={() => setShowHpModal(false)} />}
      {showTsModal && <TransformScrollModal onClose={() => setShowTsModal(false)} />}
      {showBuffModal && <BuffListModal buffs={aliveBuffs} now={now} wis={wis} onClose={() => setShowBuffModal(false)} />}
      {/* ━━━ STATS DRAWER (좌측 슬라이드 — MobileShell과 동일 방식) ━━━ */}
      <div
        onClick={() => setShowStatsModal(false)}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          opacity: showStatsModal ? 1 : 0,
          pointerEvents: showStatsModal ? 'auto' : 'none',
          transition: 'opacity 0.22s ease',
          zIndex: 900,
        }}
      />
      <StatsDrawer
        open={showStatsModal}
        playerName={playerName}
        playerClass={playerClass}
        level={level}
        currentHp={currentHp}
        maxHp={maxHp}
        currentMp={currentMp}
        maxMp={maxMp}
        str={str}
        dex={dex}
        con={getCon()}
        wis={wis}
        int_={getInt()}
        statAllocation={statAllocation}
        ac={ac}
        mr={mr}
        hitRate={hitRate}
        combatStyle={combatStyle}
        bonusSp={bonusSp}
        equippedWeapon={equippedWeapon}
        activeBuffs={activeBuffs}
      />
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
      width: 'min(110px, 32vw)', height: 9,
      background: 'rgba(0,0,0,0.65)',
      borderRadius: 3,
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: gradient,
        borderRadius: 3,
        transition: 'width 0.25s',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 8.5, fontWeight: 700,
        color: '#fff',
        textShadow: '0 0 3px rgba(0,0,0,0.95)',
        letterSpacing: '-0.02em',
      }}>
        {value} / {max}
      </div>
    </div>
  );
}

/* ── 하단 물약 슬롯 스타일 ── */
const slotStyle: React.CSSProperties = {
  position: 'relative',
  width: 44, height: 44,
  background: 'rgba(0,0,0,0.6)',
  border: '1px solid oklch(0.36 0.014 260 / 0.6)',
  borderRadius: 8,
  display: 'grid', placeItems: 'center',
  backdropFilter: 'blur(6px)',
  cursor: 'default',
  padding: 0,
  fontFamily: 'var(--font-mono)',
};

const potCountStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 1, right: 3,
  fontFamily: 'var(--font-mono)',
  fontSize: 9, fontWeight: 700,
  color: 'var(--text)',
  textShadow: '0 0 3px rgba(0,0,0,0.95)',
};

/* ═══════════════════════════════════════════════════════════
   버프 목록 모달
   ═══════════════════════════════════════════════════════════ */
function BuffListModal({ buffs, now, wis, onClose }: {
  buffs: ActiveBuff[]; now: number; wis: number; onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 99999,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 300, maxWidth: '88vw',
          maxHeight: '70vh',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-soft)',
          borderRadius: 'var(--r-md)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalIn 0.18s ease-out',
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 14, fontWeight: 700, color: 'var(--text)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ color: 'oklch(0.68 0.20 305)' }}>✦</span>
            활성 버프
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--text-mute)', fontWeight: 500,
            }}>
              ({buffs.length})
            </span>
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-soft)',
              color: 'var(--text-mute)',
              fontSize: 14, cursor: 'pointer',
              display: 'grid', placeItems: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* 버프 리스트 */}
        <div style={{ overflowY: 'auto', padding: '8px 0' }}>
          {buffs.length === 0 ? (
            <div style={{
              padding: 32, textAlign: 'center',
              color: 'var(--text-faint)', fontSize: 12,
            }}>
              활성화된 버프가 없습니다.
            </div>
          ) : buffs.map((buff, i) => {
            const remainSec = Math.max(0, Math.floor((buff.expiresAt - now) / 1000));
            const min = Math.floor(remainSec / 60);
            const sec = remainSec % 60;
            const isPassive = buff.potionId?.startsWith('passive_');
            const isTs = buff.potionId === 'transform_scroll';
            const isGreen = buff.potionId === 'green_potion';
            const isBlue = buff.potionId === 'blue_potion';
            const isSkill = !!buff.skillId;
            const color = isTs ? 'var(--accent)'
              : isGreen ? 'var(--success)'
              : isBlue ? '#42a5f5'
              : isSkill ? 'var(--info)'
              : 'oklch(0.68 0.20 305)';
            const icon = isTs ? '⚜' : isGreen ? '✚' : isBlue ? '◆' : isSkill ? '✦' : '✦';

            // 효과 요약 텍스트
            const effects: string[] = [];
            if (buff.atkSpeedMult > 1) effects.push(`공속 x${buff.atkSpeedMult}`);
            if (buff.moveSpeedMult > 1) effects.push(`이속 x${buff.moveSpeedMult}`);
            if (buff.acBonus) effects.push(`AC ${buff.acBonus}`);
            if (buff.hitBonus) effects.push(`명중 +${buff.hitBonus}`);
            if (buff.dmgBonus) effects.push(`추타 +${buff.dmgBonus}`);
            if (buff.fireDmgBonus) effects.push(`화염 +${buff.fireDmgBonus}`);
            if (buff.spBonus) effects.push(`SP +${buff.spBonus}`);
            if (isBlue) {
              const baseRegen = calcMpRegenAmount(wis);
              const bonus = calcBluePotionMpBonus(wis);
              effects.push(`MP +${baseRegen + bonus}/16초`);
            }

            return (
              <div key={i} style={{
                padding: '10px 16px',
                display: 'flex', alignItems: 'center', gap: 10,
                borderBottom: i < buffs.length - 1
                  ? '1px solid color-mix(in oklch, var(--border-soft) 50%, transparent)'
                  : 'none',
              }}>
                {/* 아이콘 */}
                <div style={{
                  width: 34, height: 34, borderRadius: 7, flexShrink: 0,
                  background: `color-mix(in oklch, ${color} 10%, transparent)`,
                  border: `1px solid color-mix(in oklch, ${color} 30%, transparent)`,
                  display: 'grid', placeItems: 'center',
                  fontSize: 16, color,
                }}>
                  {icon}
                </div>

                {/* 이름 + 효과 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--text)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {buff.name}
                  </div>
                  {effects.length > 0 && (
                    <div style={{
                      fontSize: 10, color: 'var(--text-mute)',
                      fontFamily: 'var(--font-mono)',
                      marginTop: 2,
                    }}>
                      {effects.join(' · ')}
                    </div>
                  )}
                </div>

                {/* 남은 시간 */}
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11, fontWeight: 700,
                  color: isPassive ? 'var(--text-mute)' : color,
                  flexShrink: 0, textAlign: 'right',
                }}>
                  {isPassive ? '상시' : `${min}:${String(sec).padStart(2, '0')}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STATS DRAWER — 레벨 클릭 시 좌측 슬라이드
   MobileShell의 Stats drawer와 동일한 UX
   ═══════════════════════════════════════════════════════════ */
const STAT_COLORS: Record<StatKey, string> = {
  str: 'var(--danger)',
  dex: 'var(--info)',
  con: 'var(--success)',
  wis: 'oklch(0.74 0.16 200)',
  int: 'oklch(0.68 0.20 305)',
};

const CLASS_ICON_DRAWER: Record<string, string> = { knight: '⚔', elf: '⌬', wizard: '✦' };

function StatsDrawer({ open, playerName, playerClass, level,
  currentHp, maxHp, currentMp, maxMp,
  str, dex, con, wis, int_,
  statAllocation, ac, mr, hitRate, combatStyle, bonusSp,
  equippedWeapon, activeBuffs,
}: {
  open: boolean;
  playerName: string; playerClass: PlayerClass; level: number;
  currentHp: number; maxHp: number; currentMp: number; maxMp: number;
  str: number; dex: number; con: number; wis: number; int_: number;
  statAllocation: Record<StatKey, number>;
  ac: number; mr: number; hitRate: number;
  combatStyle: CombatStyle; bonusSp: number;
  equippedWeapon: Equipment | null;
  activeBuffs: ActiveBuff[];
}) {
  const baseStats = CLASS_CONFIGS[playerClass].baseStats;
  const statGetters: Record<StatKey, number> = { str, dex, con, wis, int: int_ };

  // 전투 스탯 계산
  const weaponEnchant = equippedWeapon?.enhanceLevel ?? 0;
  const weaponBaseDmgS = equippedWeapon?.baseAtk ?? 0;
  const state = useGameStore.getState();
  const allSlots = getAllEquipped(state);
  const bonusExtraDmg = allSlots.reduce((s, eq) => s + (eq?.bonuses?.extraDmg ?? 0), 0);
  const bonusBowDmg = allSlots.reduce((s, eq) => s + (eq?.bonuses?.bowDmg ?? 0), 0);
  const equipHpr = allSlots.reduce((s, eq) => s + (eq?.bonuses?.hpr ?? 0), 0);
  const equipMpr = allSlots.reduce((s, eq) => s + (eq?.bonuses?.mpr ?? 0), 0);

  let hit: number | string;
  let dmgStr: string;

  if (combatStyle === 'ranged_bow') {
    hit = hitRate;
    const dMin = bowMinDamage(level, weaponEnchant, dex) + bonusExtraDmg + bonusBowDmg;
    const dMax = bowMaxDamage(weaponBaseDmgS, level, weaponEnchant, dex) + bonusExtraDmg + bonusBowDmg;
    dmgStr = `${dMin}~${dMax}`;
  } else if (combatStyle === 'ranged_magic') {
    hit = '자동';
    const magicRange = magicDamageRange(weaponBaseDmgS, int_, bonusSp, level, playerClass);
    dmgStr = `~${Math.round((magicRange.min + magicRange.max) / 2)}`;
  } else {
    hit = meleeHit(level, weaponEnchant, str) + allSlots.reduce((s, eq) => s + (eq?.bonuses?.hit ?? 0), 0);
    const dMin = minDamage(level, weaponEnchant, str) + bonusExtraDmg;
    const dMax = maxDamage(weaponBaseDmgS, level, weaponEnchant, str) + bonusExtraDmg;
    dmgStr = `${dMin}~${dMax}`;
  }

  const hpRegenRange = calcHpRegenRange(level, con);
  const hpRegenSec = calcHpRegenIntervalSec(level, playerClass);
  const hasBlueBuff = activeBuffs.some(b => b.potionId === 'blue_potion' && b.expiresAt > Date.now());
  const mpRegenBase = calcMpRegenAmount(wis);
  const mpRegenBlueBonus = hasBlueBuff ? calcBluePotionMpBonus(wis) : 0;
  const mpRegenTotal = mpRegenBase + equipMpr + mpRegenBlueBonus;
  const mpRegenSec = calcMpRegenIntervalSec();

  const classConfig = CLASS_CONFIGS[playerClass];

  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, bottom: 0,
      width: 260,
      background: 'var(--bg-panel)',
      borderRight: '1px solid var(--border-soft)',
      transform: open ? 'translateX(0)' : 'translateX(-100%)',
      transition: 'transform 0.22s cubic-bezier(.16,1,.3,1)',
      zIndex: 910,
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', overflowX: 'hidden',
    }}>
      {/* Player header */}
      <div style={{
        padding: '16px 14px 12px',
        borderBottom: '1px solid var(--border-soft)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 22 }}>{CLASS_ICON_DRAWER[playerClass] ?? ''}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 14, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {playerName}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-mute)',
          }}>
            Lv.{level} {classConfig.nameKo}
          </div>
        </div>
      </div>

      {/* Section: STATS */}
      <div style={{
        padding: '10px 12px 0',
        fontFamily: 'var(--font-mono)', fontSize: 9.5,
        fontWeight: 700, color: 'var(--text-faint)',
        textTransform: 'uppercase', letterSpacing: 1,
      }}>
        STATS
      </div>
      <div style={{ padding: '4px 12px 0' }}>
        {(['str', 'dex', 'con', 'wis', 'int'] as StatKey[]).map(key => {
          const color = STAT_COLORS[key];
          const total = statGetters[key];
          const base = (baseStats as Record<string, number>)[key] ?? 0;
          const alloc = statAllocation[key];
          return (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '5px 0',
              borderBottom: '1px dashed var(--border-soft)',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                fontWeight: 700, color, minWidth: 30,
              }}>
                {key.toUpperCase()}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 13,
                fontWeight: 800, color,
              }}>
                {total}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9,
                color: 'var(--text-faint)',
              }}>
                ({base}+{alloc})
              </span>
            </div>
          );
        })}
      </div>

      {/* Section: COMBAT */}
      <div style={{
        padding: '12px 12px 0',
        fontFamily: 'var(--font-mono)', fontSize: 9.5,
        fontWeight: 700, color: 'var(--text-faint)',
        textTransform: 'uppercase', letterSpacing: 1,
      }}>
        COMBAT
      </div>
      <div style={{ padding: '4px 12px 12px' }}>
        <DrawerCombatRow label="HP" value={`${currentHp} / ${maxHp}`} color={
          currentHp > maxHp * 0.6 ? 'var(--success)'
            : currentHp > maxHp * 0.3 ? 'var(--warning)' : 'var(--danger)'
        } />
        <DrawerCombatRow label="MP" value={`${currentMp} / ${maxMp}`} color="var(--info)" />
        <DrawerCombatRow label="HIT" value={`${hit}`} color={hit === '자동' ? 'var(--info)' : 'var(--text-dim)'} />
        <DrawerCombatRow label="AC" value={`${ac}`} color="var(--success)" />
        <DrawerCombatRow label={combatStyle === 'ranged_magic' ? 'E.BOLT' : 'DMG'} value={dmgStr} color="var(--warning)" />
        {combatStyle === 'ranged_magic' && (
          <DrawerCombatRow label="SP" value={`+${bonusSp}`} color="oklch(0.68 0.20 305)" />
        )}
        <DrawerCombatRow label="MR" value={`${mr}`} color="var(--info)" />
        <DrawerCombatRow label="HPR" value={`${hpRegenRange.min + equipHpr}~${hpRegenRange.max + equipHpr}/${hpRegenSec}s`} color="var(--text-dim)" />
        <DrawerCombatRow label="MPR" value={`${mpRegenTotal}/${mpRegenSec}s${hasBlueBuff ? ' ★' : ''}`} color="var(--text-dim)" />
      </div>
    </aside>
  );
}

/** 드로어 COMBAT 행 (MobileShell과 동일 스타일) */
function DrawerCombatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '5px 0',
      borderBottom: '1px dashed var(--border-soft)',
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10,
        fontWeight: 600, color: 'var(--text-mute)', minWidth: 30,
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 12,
        fontWeight: 700, color,
      }}>
        {value}
      </span>
    </div>
  );
}
