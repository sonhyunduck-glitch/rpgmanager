import { useGameStore } from '../../store/gameStore';
import { xpForLevel } from '../../data/gameData';
import { CLASS_CONFIGS } from '../../data/classData';
import { signOut } from '../../lib/auth';
import { STAT_VALUE, CHIP } from '../../styles/shared';
import type { ViewMode } from '../../types';

const CLASS_ICONS: Record<string, string> = {
  knight: '⚔️',
  elf: '🏹',
  wizard: '🔮',
};

const NAV_ITEMS: { mode: ViewMode; label: string }[] = [
  { mode: 'main', label: '사냥' },
  { mode: 'inventory', label: '가방' },
  { mode: 'skills', label: '스킬' },
  { mode: 'zones', label: '사냥터' },
  { mode: 'shop', label: '상점' },
  { mode: 'trade', label: '거래소' },
  { mode: 'ranking', label: '랭킹' },
  { mode: 'guild', label: '클랜' },
];

export default function StatusBar() {
  const playerName = useGameStore((s) => s.playerName);
  const playerClass = useGameStore((s) => s.playerClass);
  const level = useGameStore((s) => s.level);
  const exp = useGameStore((s) => s.exp);
  const gold = useGameStore((s) => s.gold);
  const viewMode = useGameStore((s) => s.viewMode);
  const setViewMode = useGameStore((s) => s.setViewMode);
  const logout = useGameStore((s) => s.logout);

  const handleLogout = async () => {
    logout();       // DB flush + 동기화 해제
    await signOut(); // Supabase 세션 종료
  };

  const needed = xpForLevel(level);
  const expPct = needed > 0 ? Math.min(100, (exp / needed) * 100) : 0;

  return (
    <header
      style={{
        height: 'var(--status-h)',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-soft)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--s-4)',
        gap: 'var(--s-4)',
        boxShadow: 'var(--shadow-sm)',
        zIndex: 100,
        flexShrink: 0,
      }}
    >
      {/* Player identity — 2줄: 레벨+경험치 / 닉네임 */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1, minWidth: 0 }}>
        {/* 1줄: 레벨 + EXP 바 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontWeight: 800,
            fontSize: 'var(--fs-xs)', color: 'var(--text-dim)',
            flexShrink: 0,
          }}>
            Lv.{level}
          </span>
          <div style={{
            flex: 1, height: 4, borderRadius: 2,
            background: 'color-mix(in oklch, var(--text-mute) 15%, transparent)',
            overflow: 'hidden', minWidth: 40,
          }}>
            <div style={{
              height: '100%', width: `${expPct}%`,
              background: 'var(--info)', borderRadius: 2,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{
            fontSize: 'calc(var(--fs-2xs))', fontFamily: 'var(--font-mono)',
            fontWeight: 700, color: 'var(--info)', flexShrink: 0,
          }}>
            {expPct.toFixed(3)}%
          </span>
        </div>
        {/* 2줄: 닉네임 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
          <span style={{ fontSize: 'var(--fs-2xs)' }} title={CLASS_CONFIGS[playerClass].nameKo}>
            {CLASS_ICONS[playerClass] ?? ''}
          </span>
          <span style={{
            fontFamily: "'Space Grotesk', var(--font-display)",
            fontWeight: 700, fontSize: 'var(--fs-xs)', color: 'var(--info)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {playerName}
          </span>
        </div>
      </div>

      {/* Gold chip */}
      <div
        style={{
          ...CHIP,
          background: 'color-mix(in oklch, var(--accent) 15%, transparent)',
          border: '1px solid color-mix(in oklch, var(--accent) 40%, transparent)',
          color: 'var(--accent)',
        }}
      >
        <span style={{ fontSize: 'var(--fs-sm)' }}>$</span>
        <span style={STAT_VALUE}>{gold.toLocaleString()}</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Nav buttons */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
        {NAV_ITEMS.map(({ mode, label }) => {
          const isActive = viewMode === mode;
          return (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                ...CHIP,
                background: isActive
                  ? 'color-mix(in oklch, var(--accent) 18%, transparent)'
                  : 'transparent',
                border: isActive
                  ? '1px solid var(--accent)'
                  : '1px solid var(--border-soft)',
                color: isActive ? 'var(--accent)' : 'var(--text-mute)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                fontFamily: 'var(--font-ui)',
                fontWeight: 600,
              }}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        style={{
          ...CHIP,
          background: 'transparent',
          border: '1px solid var(--border-soft)',
          color: 'var(--text-mute)',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--fs-xs)',
          marginLeft: 'var(--s-2)',
        }}
        title="로그아웃"
      >
        ⏻
      </button>
    </header>
  );
}
