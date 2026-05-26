/* =========================================================
   MOBILE SHELL — 모바일 세로모드 공용 레이아웃
   사냥(hunt) 화면 제외 7개 페이지 공유 셸

   구조:
     ├─ Top bar   (52px): 햄버거 | Lv+HP/MP | 골드
     ├─ Body      (flex:1, scroll): {children}
     ├─ Bottom nav(56px): 5탭 (사냥/가방/스킬/상점/더보기)
     ├─ Stats drawer (좌 슬라이드 260px): 스탯+전투+포인트배분
     └─ More sheet   (하단 슬라이드): 사냥터/거래소/랭킹/클랜
   ========================================================= */
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { CLASS_CONFIGS } from '../../data/classData';
import { finalAC, finalMR } from '../../data/statFormulas';
import { getAllEquipped } from '../../store/storeTypes';
import type { ViewMode, StatKey } from '../../types';

/* ── 가격 포맷 ── */
function fmtG(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(n >= 100_000 ? 0 : 1)}만`;
  return n.toLocaleString();
}

/* ── 스탯 색상 ── */
const STAT_COLORS: Record<StatKey, string> = {
  str: 'var(--danger)',
  dex: 'var(--info)',
  con: 'var(--success)',
  wis: 'oklch(0.74 0.16 200)',
  int: 'oklch(0.68 0.20 305)',
};

/* ── 하단 네비 탭 ── */
const BOTTOM_TABS: { mode: ViewMode | 'more'; icon: string; label: string }[] = [
  { mode: 'main',      icon: '⚔', label: '사냥' },
  { mode: 'inventory', icon: '⌗', label: '가방' },
  { mode: 'skills',    icon: '✦', label: '스킬' },
  { mode: 'shop',      icon: '⛁', label: '상점' },
  { mode: 'more',      icon: '⋯', label: '더보기' },
];

/* ── 더보기 시트 항목 ── */
const MORE_ITEMS: { mode: ViewMode; icon: string; label: string }[] = [
  { mode: 'zones',   icon: '◈', label: '사냥터' },
  { mode: 'trade',   icon: '⇄', label: '거래소' },
  { mode: 'ranking', icon: '★', label: '랭킹' },
  { mode: 'guild',   icon: '◆', label: '클랜' },
];

/* ── 클래스 아이콘 ── */
const CLASS_ICON: Record<string, string> = { knight: '⚔', elf: '⌬', wizard: '✦' };

/* ═══════════════════════════════════════════════════
   MobileShell
   ═══════════════════════════════════════════════════ */
export default function MobileShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // ── Store selectors ──
  const viewMode      = useGameStore(s => s.viewMode);
  const setViewMode   = useGameStore(s => s.setViewMode);
  const level         = useGameStore(s => s.level);
  const currentHp     = useGameStore(s => s.currentHp);
  const baseMaxHp     = useGameStore(s => s.maxHp);
  const getTotalHpBonus = useGameStore(s => s.getTotalHpBonus);
  const getMaxMp      = useGameStore(s => s.getMaxMp);
  const hunt          = useGameStore(s => s.hunt);
  const gold          = useGameStore(s => s.gold);
  const playerName    = useGameStore(s => s.playerName);
  const playerClass   = useGameStore(s => s.playerClass);
  const getStr        = useGameStore(s => s.getStr);
  const getDex        = useGameStore(s => s.getDex);
  const getCon        = useGameStore(s => s.getCon);
  const getWis        = useGameStore(s => s.getWis);
  const getInt        = useGameStore(s => s.getInt);
  const getRemainingPoints = useGameStore(s => s.getRemainingPoints);
  const statAllocation = useGameStore(s => s.statAllocation);
  const allocateStat  = useGameStore(s => s.allocateStat);
  const getTotalDefense = useGameStore(s => s.getTotalDefense);

  // ── Derived values ──
  const maxHp     = baseMaxHp + getTotalHpBonus();
  const maxMp     = getMaxMp();
  const currentMp = hunt.currentMp;
  const hpPct     = maxHp > 0 ? Math.min(100, (currentHp / maxHp) * 100) : 0;
  const mpPct     = maxMp > 0 ? Math.min(100, (currentMp / maxMp) * 100) : 0;

  const str = getStr();
  const dex = getDex();
  const con = getCon();
  const wis = getWis();
  const intStat = getInt();
  const remaining = getRemainingPoints();

  const baseStats   = CLASS_CONFIGS[playerClass].baseStats;
  const totalDef    = getTotalDefense();
  const ac          = finalAC(totalDef, level, dex, playerClass);
  const mr          = finalMR(level, wis);

  // Equipment bonuses for combat stats
  const state    = useGameStore.getState();
  const allSlots = getAllEquipped(state);
  const bonusMr  = allSlots.reduce((s, eq) => s + (eq?.bonuses?.mr ?? 0), 0);
  const bonusHit = allSlots.reduce((s, eq) => s + (eq?.bonuses?.hit ?? 0), 0);
  const bonusSp  = allSlots.reduce((s, eq) => s + (eq?.bonuses?.sp ?? 0), 0);
  const bonusExtraDmg = allSlots.reduce((s, eq) => s + (eq?.bonuses?.extraDmg ?? 0), 0);

  const isMoreActive = (['zones', 'trade', 'ranking', 'guild'] as ViewMode[]).includes(viewMode);

  // Stat getters map for drawer
  const statGetters: Record<StatKey, number> = { str, dex, con, wis, int: intStat };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', width: '100vw',
      background: 'var(--bg-canvas)',
      position: 'relative', overflow: 'hidden',
    }}>

      {/* ═══════════ TOP BAR ═══════════ */}
      <header style={{
        height: 52, flexShrink: 0,
        background: 'var(--bg-sunken)',
        borderBottom: '1px solid var(--border-soft)',
        display: 'grid',
        gridTemplateColumns: '32px 1fr auto',
        alignItems: 'center',
        padding: '6px 10px',
        gap: 8,
      }}>
        {/* Hamburger */}
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            width: 44, height: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none',
            cursor: 'pointer', padding: 0, margin: '-6px',
          }}
          aria-label="Open stats"
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
            <rect y="0" width="18" height="2" rx="1" fill="var(--text-mute)" />
            <rect y="6" width="18" height="2" rx="1" fill="var(--text-mute)" />
            <rect y="12" width="18" height="2" rx="1" fill="var(--text-mute)" />
          </svg>
        </button>

        {/* Center: Level + HP/MP bars */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontWeight: 800,
            fontSize: 16, color: 'var(--text)',
            flexShrink: 0, lineHeight: 1,
          }}>
            {level}
          </span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            {/* HP bar */}
            <div style={{ position: 'relative', height: 8, borderRadius: 4, overflow: 'hidden', background: 'oklch(0.2 0.01 25 / 0.5)' }}>
              <div style={{
                position: 'absolute', inset: 0,
                width: `${hpPct}%`,
                background: 'linear-gradient(90deg, var(--danger), oklch(0.72 0.20 30))',
                borderRadius: 4,
                transition: 'width 0.3s ease',
              }} />
              <span style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 7, fontWeight: 700,
                color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                lineHeight: 1,
              }}>
                {currentHp} / {maxHp}
              </span>
            </div>
            {/* MP bar */}
            <div style={{ position: 'relative', height: 8, borderRadius: 4, overflow: 'hidden', background: 'oklch(0.2 0.01 230 / 0.5)' }}>
              <div style={{
                position: 'absolute', inset: 0,
                width: `${mpPct}%`,
                background: 'linear-gradient(90deg, var(--info), oklch(0.78 0.14 240))',
                borderRadius: 4,
                transition: 'width 0.3s ease',
              }} />
              <span style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 7, fontWeight: 700,
                color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                lineHeight: 1,
              }}>
                {currentMp} / {maxMp}
              </span>
            </div>
          </div>
        </div>

        {/* Gold pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 3,
          padding: '3px 8px',
          borderRadius: 'var(--r-full)',
          background: 'color-mix(in oklch, var(--accent) 12%, transparent)',
          border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10.5,
            fontWeight: 700, color: 'var(--accent)', lineHeight: 1,
          }}>
            {fmtG(gold)}
          </span>
        </div>
      </header>

      {/* ═══════════ BODY (children) ═══════════ */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto', overflowX: 'hidden',
          padding: '12px 10px',
          scrollbarWidth: 'none' as const,
        }}
        /* Webkit scrollbar hiding via className would be ideal,
           but we keep it inline-only. The scrollbarWidth covers Firefox;
           for Chrome/Safari we apply a style element below. */
      >
        {children}
      </main>

      {/* Webkit scrollbar hide (injected once) */}
      <style>{`
        main::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ═══════════ BOTTOM NAV ═══════════ */}
      <nav style={{
        flexShrink: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        background: 'var(--bg-sunken)',
        borderTop: '1px solid var(--border-soft)',
        padding: '4px 4px 6px',
      }}>
        {BOTTOM_TABS.map(({ mode, icon, label }) => {
          const isActive =
            mode === 'more'
              ? (isMoreActive || sheetOpen)
              : viewMode === mode;

          return (
            <button
              key={mode}
              onClick={() => {
                if (mode === 'more') {
                  setSheetOpen(prev => !prev);
                } else {
                  setViewMode(mode as ViewMode);
                  setSheetOpen(false);
                }
              }}
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 2, padding: '6px 0 4px',
                minHeight: 44,
                background: 'none', border: 'none',
                color: isActive ? 'var(--accent)' : 'var(--text-mute)',
                cursor: 'pointer',
                borderRadius: 'var(--r-sm)',
                transition: 'background 0.1s ease',
              }}
              onPointerDown={e => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
              }}
              onPointerUp={e => {
                (e.currentTarget as HTMLElement).style.background = 'none';
              }}
              onPointerLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'none';
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
              <span style={{
                fontSize: 10, fontFamily: 'var(--font-ui)', fontWeight: 600,
                lineHeight: 1,
              }}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ═══════════ STATS DRAWER (left slide) ═══════════ */}
      {/* Backdrop */}
      <div
        onClick={() => setDrawerOpen(false)}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          opacity: drawerOpen ? 1 : 0,
          pointerEvents: drawerOpen ? 'auto' : 'none',
          transition: 'opacity 0.22s ease',
          zIndex: 900,
        }}
      />
      {/* Drawer panel */}
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 260,
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border-soft)',
        transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
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
          <span style={{ fontSize: 22 }}>{CLASS_ICON[playerClass] ?? ''}</span>
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
              Lv.{level} {CLASS_CONFIGS[playerClass].nameKo}
            </div>
          </div>
        </div>

        {/* Stat points banner */}
        {remaining > 0 && (
          <div style={{
            margin: '10px 12px 0',
            padding: '5px 10px', textAlign: 'center',
            background: 'color-mix(in oklch, var(--accent) 12%, transparent)',
            border: '1px solid color-mix(in oklch, var(--accent) 40%, transparent)',
            borderRadius: 'var(--r-sm)',
            fontFamily: 'var(--font-mono)', fontSize: 11,
            fontWeight: 600, color: 'var(--accent)',
          }}>
            +{remaining} point{remaining > 1 ? 's' : ''}
          </div>
        )}

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
            const color  = STAT_COLORS[key];
            const total  = statGetters[key];
            const base   = (baseStats as Record<string, number>)[key] ?? 0;
            const alloc  = statAllocation[key];
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
                {remaining > 0 && (
                  <button
                    onClick={() => allocateStat(key)}
                    style={{
                      width: 28, height: 28,
                      minWidth: 44, minHeight: 44,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '50%',
                      border: `1px solid ${color}`,
                      background: 'transparent',
                      color,
                      fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
                      cursor: 'pointer', padding: 0,
                      marginLeft: 4,
                    }}
                    aria-label={`${key.toUpperCase()} +1`}
                  >
                    +
                  </button>
                )}
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
          <DrawerCombatRow label="HIT" value={`${level + bonusHit}`} color="var(--text-dim)" />
          <DrawerCombatRow label="AC" value={`${ac}`} color="var(--success)" />
          <DrawerCombatRow label="DMG" value={`+${bonusExtraDmg}`} color="var(--warning)" />
          <DrawerCombatRow label="MR" value={`${mr + bonusMr}`} color="var(--info)" />
          <DrawerCombatRow label="SP" value={`+${bonusSp}`} color="oklch(0.68 0.20 305)" />
        </div>
      </aside>

      {/* ═══════════ MORE SHEET (bottom slide) ═══════════ */}
      {/* Backdrop */}
      <div
        onClick={() => setSheetOpen(false)}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          opacity: sheetOpen ? 1 : 0,
          pointerEvents: sheetOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
          zIndex: 800,
        }}
      />
      {/* Sheet panel */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        background: 'var(--bg-panel)',
        borderTop: '1px solid var(--border-soft)',
        borderRadius: '14px 14px 0 0',
        transform: sheetOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.25s cubic-bezier(.16,1,.3,1)',
        zIndex: 810,
        padding: '10px 16px 24px',
      }}>
        {/* Grip handle */}
        <div style={{
          width: 40, height: 4,
          borderRadius: 2,
          background: 'var(--text-faint)',
          margin: '0 auto 14px',
        }} />

        {/* Grid of 4 items */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
        }}>
          {MORE_ITEMS.map(({ mode, icon, label }) => (
            <button
              key={mode}
              onClick={() => {
                setViewMode(mode);
                setSheetOpen(false);
              }}
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 4,
                padding: '14px 4px',
                minHeight: 44,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-soft)',
                borderRadius: 10,
                cursor: 'pointer',
                color: viewMode === mode ? 'var(--accent)' : 'var(--text)',
              }}
            >
              <span style={{ fontSize: 24, lineHeight: 1 }}>{icon}</span>
              <span style={{
                fontSize: 11, fontFamily: 'var(--font-ui)', fontWeight: 600,
                lineHeight: 1,
              }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Drawer combat row helper ── */
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
