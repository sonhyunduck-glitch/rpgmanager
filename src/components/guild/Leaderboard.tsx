/* =========================================================
   LEADERBOARD — 랭킹 (코드닷 디자인 시스템)
   포디움 + 테이블 + 내 순위 사이드바 — 단일 파일
   ========================================================= */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getTopPlayers } from '../../lib/leaderboard';
import type { LeaderboardEntry } from '../../lib/leaderboard';
import { ClickableName } from '../profile/ClickableName';
import type { PlayerClass } from '../../types';
import { useCompact } from '../../lib/useCompact';

/* ─── 클래스 정보 ─── */
const CLASS_INFO: Record<string, { icon: string; name: string; color: string; border: string }> = {
  knight:  { icon: '⚔', name: '기사',   color: 'var(--danger)',  border: 'color-mix(in oklch, var(--danger) 40%, transparent)' },
  elf:     { icon: '⌒', name: '요정',   color: 'var(--success)', border: 'color-mix(in oklch, var(--success) 40%, transparent)' },
  wizard:  { icon: '✦', name: '마법사', color: 'oklch(0.68 0.20 305)', border: 'color-mix(in oklch, oklch(0.68 0.20 305) 40%, transparent)' },
};

function classOf(pc: string | null) {
  return CLASS_INFO[pc ?? ''] ?? { icon: '?', name: '?', color: 'var(--text-mute)', border: 'var(--border-soft)' };
}

/* ─── 순위 색상 ─── */
const RANK_COLORS = {
  1: 'var(--accent)',
  2: '#96a5b9',
  3: '#b07814',
} as Record<number, string>;

function rankColor(r: number) { return RANK_COLORS[r] ?? 'var(--text-mute)'; }

/* ─── 온라인 판정 (5분 이내) ─── */
function isOnline(lastActive: string): boolean {
  if (!lastActive) return false;
  return Date.now() - new Date(lastActive).getTime() < 5 * 60_000;
}

/* ─── 가격 포맷 ─── */
function fmtG(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(n >= 100_000 ? 0 : 1)}만`;
  return n.toLocaleString();
}

/* ─── 카테고리 ─── */
type RankCat = 'level' | 'gold';
const CATEGORIES: { id: RankCat; name: string; icon: string }[] = [
  { id: 'level', name: '레벨', icon: '★' },
  { id: 'gold',  name: '골드', icon: '$' },
];

/* ─── 클래스 필터 사이클 ─── */
const CLASS_CYCLE: (PlayerClass | null)[] = [null, 'knight', 'elf', 'wizard'];

/* ═══════════════════════════════════════════════════════════
   포디움 카드 (Top 3)
   ═══════════════════════════════════════════════════════════ */
function PodiumCard({
  player, rank, cat, compact,
}: {
  player: LeaderboardEntry; rank: number; cat: RankCat; compact?: boolean;
}) {
  const cls = classOf(player.player_class);
  const medal = rank === 1 ? '🏆' : rank === 2 ? '◆' : '◇';
  const rc = rankColor(rank);
  const metricVal = cat === 'gold' ? fmtG(player.gold) : String(player.level);
  const metricLabel = cat === 'gold' ? '골드' : '레벨';
  const isR1 = rank === 1;

  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: `1px solid ${
        isR1 ? 'color-mix(in oklch, var(--accent) 45%, transparent)'
        : rank === 2 ? 'color-mix(in oklch, #96a5b9 30%, transparent)'
        : 'color-mix(in oklch, #b07814 35%, transparent)'
      }`,
      borderRadius: compact ? 7 : 10,
      padding: compact
        ? (isR1 ? '16px 10px 14px' : '14px 10px 12px')
        : (isR1 ? '28px 16px 22px' : '22px 16px 18px'),
      textAlign: 'center',
      position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 2 : 4,
      overflow: 'hidden',
      boxShadow: isR1
        ? '0 0 0 1px color-mix(in oklch, var(--accent) 15%, transparent) inset, 0 0 24px color-mix(in oklch, var(--accent) 8%, transparent)'
        : 'none',
    }}>
      {/* 상단 그라디언트 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: compact ? 50 : 80,
        background: `linear-gradient(180deg, ${rc} 0%, transparent 100%)`,
        opacity: 0.04, pointerEvents: 'none',
      }} />

      {/* 1위 별 */}
      {isR1 && (
        <span style={{
          position: 'absolute', top: -2, right: compact ? 4 : 10,
          fontSize: compact ? 18 : 24, color: 'var(--accent)',
          textShadow: '0 0 12px color-mix(in oklch, var(--accent) 60%, transparent)',
        }}>★</span>
      )}

      {/* 순위 */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: compact ? (isR1 ? 22 : 18) : (isR1 ? 32 : 24), fontWeight: 700,
        lineHeight: 1, marginBottom: compact ? 2 : 4,
        color: rc,
      }}>
        #{rank}
      </div>

      {/* 메달 */}
      <div style={{
        width: compact ? 26 : 36, height: compact ? 26 : 36, marginBottom: compact ? 3 : 6,
        display: 'grid', placeItems: 'center', fontSize: compact ? 16 : 22,
        color: rc,
      }}>
        {medal}
      </div>

      {/* 이름 */}
      <div style={{
        fontSize: compact ? (isR1 ? 13 : 12) : (isR1 ? 17 : 15), fontWeight: 600,
        color: 'var(--text)', marginTop: compact ? 1 : 2,
        fontFamily: 'var(--font-ui)',
        whiteSpace: compact ? 'nowrap' : undefined,
        overflow: compact ? 'hidden' : undefined,
        textOverflow: compact ? 'ellipsis' : undefined,
        maxWidth: compact ? '100%' : undefined,
      }}>
        {player.name}
      </div>

      {/* 클래스 + 길드 */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: compact ? 9.5 : 11,
        color: 'var(--text-mute)', marginTop: compact ? 1 : 2,
      }}>
        {cls.icon} {cls.name} · Lv.{player.level}
        {player.guild_name && !compact && (
          <span style={{ color: 'oklch(0.68 0.20 305)', marginLeft: 6 }}>
            [{player.guild_name}]
          </span>
        )}
      </div>

      {/* 메트릭 */}
      <div style={{
        marginTop: compact ? 6 : 10, paddingTop: compact ? 6 : 10,
        borderTop: '1px dashed color-mix(in oklch, var(--border-soft) 60%, transparent)',
        width: '100%',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: compact ? (isR1 ? 15 : 13) : (isR1 ? 20 : 17),
          fontWeight: 700, color: rc,
        }}>
          {metricVal}
          {cat === 'gold' && (
            <span style={{
              fontSize: compact ? 9 : 11, color: 'var(--text-mute)',
              marginLeft: compact ? 2 : 4, fontWeight: 400,
            }}>G</span>
          )}
        </span>
        <span style={{
          display: 'block',
          fontFamily: 'var(--font-mono)', fontSize: compact ? 8.5 : 10,
          color: 'var(--text-mute)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginTop: 2,
        }}>
          {metricLabel}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   테이블 행
   ═══════════════════════════════════════════════════════════ */
function BoardRow({
  player, rank, cat, isMe, compact,
}: {
  player: LeaderboardEntry;
  rank: number;
  cat: RankCat;
  isMe: boolean;
  compact?: boolean;
}) {
  const cls = classOf(player.player_class);
  const rc = rankColor(rank);
  const online = isOnline(player.last_active_at);
  const metricVal = cat === 'gold' ? fmtG(player.gold) : String(player.level);
  const metricUnit = cat === 'gold' ? 'G' : '';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: compact ? '32px 1fr 50px' : '60px 1.8fr 1fr 80px 1fr 80px',
      alignItems: 'center', columnGap: compact ? 6 : 12,
      padding: compact ? '6px 8px' : '9px 16px',
      borderBottom: '1px solid color-mix(in oklch, var(--border-soft) 50%, transparent)',
      transition: 'background 0.1s',
      ...(isMe ? {
        background: 'color-mix(in oklch, var(--accent) 5%, transparent)',
        borderLeft: '2px solid var(--accent)',
        paddingLeft: compact ? 6 : 14,
      } : {}),
    }}>
      {/* 순위 */}
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: compact ? 11.5 : 14, fontWeight: 600,
        color: rank <= 3 ? rc : 'var(--text-mute)',
      }}>
        #{rank}
      </span>

      {/* 이름 셀 */}
      <span style={{
        display: 'flex', alignItems: 'center', gap: compact ? 6 : 10, minWidth: 0,
      }}>
        {/* 아바타 */}
        <span style={{
          width: compact ? 22 : 30, height: compact ? 22 : 30, borderRadius: compact ? 4 : 5,
          display: 'grid', placeItems: 'center',
          background: 'var(--bg-sunken)',
          border: `1px solid ${cls.border}`,
          fontFamily: 'var(--font-mono)', fontSize: compact ? 11 : 14,
          color: cls.color, flexShrink: 0,
        }}>
          {cls.icon}
        </span>
        {/* 이름 + 길드 */}
        <span style={{
          minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <ClickableName
              userId={player.id}
              name={player.name}
              isMe={isMe}
              style={{
                fontSize: compact ? 11.5 : 13, fontWeight: 600,
                fontFamily: 'var(--font-ui)',
                color: rank <= 3 ? 'var(--accent)' : 'var(--text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            />
            {isMe && (
              <span style={{
                color: 'var(--accent)', fontSize: compact ? 9 : 10,
                fontFamily: 'var(--font-mono)',
              }}>
                (나)
              </span>
            )}
          </span>
          {player.guild_name && !compact && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'oklch(0.68 0.20 305)',
            }}>
              <span style={{ color: 'var(--text-faint)' }}>[</span>
              {player.guild_name}
              <span style={{ color: 'var(--text-faint)' }}>]</span>
            </span>
          )}
        </span>
      </span>

      {/* 클래스 — hidden on compact */}
      {!compact && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11.5,
          color: 'var(--text-mute)',
        }}>
          {cls.name}
        </span>
      )}

      {/* 레벨 — hidden on compact (shown as metric column instead) */}
      {!compact && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 13,
          color: 'var(--text)', fontWeight: 600,
        }}>
          Lv.{player.level}
          <small style={{
            color: 'var(--text-mute)', fontSize: 10, marginLeft: 4,
          }}>
            {player.exp.toFixed(1)}%
          </small>
        </span>
      )}

      {/* 메트릭 (카테고리별) — on compact this is the 3rd column */}
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: compact ? 11.5 : 13.5,
        color: 'var(--accent)', fontWeight: 600,
        textAlign: compact ? 'right' : undefined,
      }}>
        {metricVal}
        {metricUnit && (
          <span style={{
            color: 'var(--text-mute)', fontSize: compact ? 9 : 10,
            marginLeft: 2, fontWeight: 400,
          }}>{metricUnit}</span>
        )}
      </span>

      {/* 온라인 상태 — hidden on compact */}
      {!compact && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10.5,
          color: online ? 'var(--success)' : 'var(--text-mute)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: online ? 'var(--success)' : 'var(--text-faint)',
            boxShadow: online ? '0 0 4px var(--success)' : 'none',
          }} />
          {online ? '온라인' : '오프라인'}
        </span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   내 순위 사이드바 카드
   ═══════════════════════════════════════════════════════════ */
function MyRankCard({
  me, myRank, total, compact,
}: {
  me: LeaderboardEntry;
  myRank: number;
  total: number;
  compact?: boolean;
}) {
  const cls = classOf(me.player_class);

  /* compact: inline banner instead of sidebar card */
  if (compact) {
    return (
      <div style={{
        background: 'var(--bg-panel)',
        border: '1px solid color-mix(in oklch, var(--accent) 40%, transparent)',
        borderRadius: 6, padding: '8px 10px',
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 8,
        boxShadow: '0 0 0 1px color-mix(in oklch, var(--accent) 8%, transparent) inset',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)',
          textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600,
        }}>내 순위</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700,
          color: 'var(--accent)', lineHeight: 1,
        }}>#{myRank}</span>
        <span style={{ color: 'var(--text-mute)', fontSize: 11 }}>/ {total.toLocaleString()}</span>
        <span style={{ flex: 1 }} />
        <span style={{
          width: 24, height: 24, borderRadius: 4,
          background: 'var(--bg-sunken)', border: `1px solid ${cls.border}`,
          color: cls.color, display: 'grid', placeItems: 'center', fontSize: 13,
        }}>{cls.icon}</span>
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: 11.5, fontWeight: 600,
          color: 'var(--text)',
        }}>{me.name}</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-mute)',
        }}>Lv.{me.level}</span>
      </div>
    );
  }

  return (
    <div style={{
      position: 'sticky', top: 14, alignSelf: 'start',
    }}>
      {/* 메인 카드 */}
      <div style={{
        background: 'var(--bg-panel)',
        border: '1px solid color-mix(in oklch, var(--accent) 40%, transparent)',
        borderRadius: 8, padding: 16,
        boxShadow: '0 0 0 1px color-mix(in oklch, var(--accent) 8%, transparent) inset',
      }}>
        {/* 라벨 */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9.5,
          color: 'var(--accent)',
          textTransform: 'uppercase', letterSpacing: '0.12em',
          fontWeight: 600, marginBottom: 10,
        }}>
          내 순위
        </div>

        {/* 큰 순위 */}
        <div>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700,
            color: 'var(--accent)', lineHeight: 1,
          }}>
            #{myRank}
          </span>
          <span style={{
            color: 'var(--text-mute)', fontSize: 14, fontWeight: 400,
          }}>
            {' '}/ {total.toLocaleString()}
          </span>
        </div>

        {/* 내 정보 */}
        <div style={{
          marginTop: 14, paddingTop: 14,
          borderTop: '1px dashed color-mix(in oklch, var(--border-soft) 60%, transparent)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{
            width: 40, height: 40, borderRadius: 6,
            background: 'var(--bg-sunken)',
            border: `1px solid ${cls.border}`,
            color: cls.color,
            display: 'grid', placeItems: 'center', fontSize: 18,
          }}>
            {cls.icon}
          </span>
          <div>
            <div style={{
              fontSize: 14, fontWeight: 600, color: 'var(--text)',
              fontFamily: 'var(--font-ui)',
            }}>
              {me.name}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10.5,
              color: 'var(--text-mute)', marginTop: 2,
            }}>
              {cls.name} · Lv.{me.level}
              {me.guild_name && ` · [${me.guild_name}]`}
            </div>
          </div>
        </div>

        {/* 미니 스탯 그리드 */}
        <div style={{
          marginTop: 14,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        }}>
          <StatPill label="레벨" value={`${me.level}`} sub={`.${Math.floor(me.exp)}`} />
          <StatPill label="골드" value={fmtG(me.gold)} color="var(--accent)" />
        </div>
      </div>
    </div>
  );
}

function StatPill({
  label, value, sub, color,
}: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid color-mix(in oklch, var(--border-soft) 60%, transparent)',
      padding: '8px 10px', borderRadius: 5,
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9.5,
        color: 'var(--text-mute)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
        color: color ?? 'var(--text)', marginTop: 2,
      }}>
        {value}
        {sub && (
          <span style={{
            color: 'var(--text-mute)', fontSize: 11, marginLeft: 2,
          }}>{sub}</span>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   메인 컴포넌트
   ═══════════════════════════════════════════════════════════ */
export default function Leaderboard() {
  const compact    = useCompact();
  const userId     = useGameStore(s => s.authUserId);
  const myName     = useGameStore(s => s.playerName);
  const myLevel    = useGameStore(s => s.level);
  const myGold     = useGameStore(s => s.gold);
  const myClass    = useGameStore(s => s.playerClass);
  const guildName  = useGameStore(s => s.guildName);

  const [players, setPlayers]       = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [cat, setCat]               = useState<RankCat>('level');
  const [query, setQuery]           = useState('');
  const [classFilter, setClassFilter] = useState<PlayerClass | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const top = await getTopPlayers(50);
    setPlayers(top);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // 30초마다 자동 갱신
  useEffect(() => {
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  // 카테고리별 정렬
  const sorted = useMemo(() => {
    let list = players.slice();
    if (cat === 'gold') {
      list.sort((a, b) => b.gold - a.gold);
    }
    // level은 이미 DB 정렬됨
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q)
        || (p.guild_name ?? '').toLowerCase().includes(q),
      );
    }
    if (classFilter) {
      list = list.filter(p => p.player_class === classFilter);
    }
    return list;
  }, [players, cat, query, classFilter]);

  // 내 순위 찾기
  const myIdx = sorted.findIndex(p => p.id === userId);
  const myEntry: LeaderboardEntry | null = myIdx >= 0 ? sorted[myIdx] : (userId ? {
    id: userId, name: myName, level: myLevel, exp: 0, gold: myGold,
    title: '', player_class: myClass, guild_name: guildName ?? null,
    last_active_at: new Date().toISOString(),
  } : null);
  const myRank = myIdx >= 0 ? myIdx + 1 : sorted.length + 1;
  const catLabel = CATEGORIES.find(c => c.id === cat)?.name ?? '레벨';

  return (
    <div style={{
      height: '100%',
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-md)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
      padding: compact ? '6px 8px 10px' : '18px 22px 32px',
    }}>
      {/* ── 브레드크럼 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: compact ? 8 : 14,
        marginBottom: compact ? 8 : 14, paddingBottom: compact ? 8 : 12,
        borderBottom: '1px solid color-mix(in oklch, var(--border-soft) 50%, transparent)',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: compact ? 14 : 17, fontWeight: 600, color: 'var(--text)',
          fontFamily: 'var(--font-ui)',
          display: 'inline-flex', alignItems: 'baseline', gap: compact ? 6 : 8,
        }}>
          랭킹
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: compact ? 10 : 11,
            color: 'var(--text-mute)',
            padding: compact ? '1px 6px' : '2px 8px', borderRadius: 100,
            background: 'var(--bg-elevated)',
          }}>
            {loading ? '...' : `${players.length}명`}
          </span>
        </span>
        <span style={{ flex: 1 }} />
        {!compact && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font-mono)', fontSize: 10.5,
            color: 'var(--text-mute)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--success)',
              boxShadow: '0 0 6px var(--success)',
            }} />
            매 30초 갱신
          </span>
        )}
      </div>

      {/* ── 카테고리 탭 ── */}
      <div style={{
        display: 'flex', gap: compact ? 2 : 4,
        borderBottom: '1px solid var(--border-soft)',
        marginBottom: compact ? 8 : 16, flexShrink: 0,
      }}>
        {CATEGORIES.map(c => {
          const on = cat === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              style={{
                padding: compact ? '6px 12px' : '10px 18px',
                color: on ? 'var(--accent)' : 'var(--text-mute)',
                fontSize: compact ? 11.5 : 13, fontWeight: on ? 700 : 500,
                fontFamily: 'var(--font-ui)',
                borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
                background: 'none', border: 'none',
                borderBottomStyle: 'solid',
                borderBottomWidth: 2,
                borderBottomColor: on ? 'var(--accent)' : 'transparent',
                cursor: 'pointer',
                transition: 'color 0.12s, border-color 0.12s',
                display: 'inline-flex', alignItems: 'center', gap: compact ? 4 : 8,
              }}
            >
              <span style={{ fontSize: compact ? 12 : 14 }}>{c.icon}</span>
              {c.name}
            </button>
          );
        })}
      </div>

      {/* ── 검색 + 필터 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: compact ? 8 : 16,
        marginBottom: compact ? 10 : 18, flexShrink: 0, flexWrap: 'wrap',
      }}>
        {/* 검색 */}
        <div style={{
          flex: 1, maxWidth: compact ? undefined : 320, minWidth: compact ? 0 : 140,
          display: 'flex', alignItems: 'center', gap: compact ? 6 : 8,
          padding: compact ? '5px 8px' : '7px 12px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-soft)',
          borderRadius: 6,
        }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
            stroke="currentColor" strokeWidth="1.6"
            style={{ color: 'var(--text-faint)', flexShrink: 0 }}
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            placeholder="플레이어/길드 검색"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              flex: 1, fontSize: compact ? 11.5 : 12.5, fontFamily: 'var(--font-ui)',
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text)',
            }}
          />
        </div>

        {/* 클래스 필터 */}
        <button
          onClick={() => {
            const idx = CLASS_CYCLE.indexOf(classFilter);
            setClassFilter(CLASS_CYCLE[(idx + 1) % CLASS_CYCLE.length]);
          }}
          style={{
            padding: compact ? '5px 8px' : '7px 11px',
            background: classFilter
              ? 'color-mix(in oklch, var(--accent) 5%, transparent)'
              : 'var(--bg-panel)',
            border: classFilter
              ? '1px solid color-mix(in oklch, var(--accent) 40%, transparent)'
              : '1px solid var(--border-soft)',
            borderRadius: 6,
            fontSize: 11.5, fontFamily: 'var(--font-ui)',
            color: classFilter ? 'var(--accent)' : 'var(--text-mute)',
            cursor: 'pointer',
            transition: 'all 0.12s',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          클래스
          {classFilter && (
            <span style={{
              color: 'var(--text)', fontFamily: 'var(--font-mono)',
              marginLeft: 4,
            }}>
              {classOf(classFilter).name}
            </span>
          )}
        </button>
      </div>

      {/* ── 스크롤 콘텐츠 ── */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        {/* 포디움 (Top 3) */}
        {sorted.length >= 3 && !query && !classFilter && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.1fr 1fr',
            gap: compact ? 6 : 12, marginBottom: compact ? 10 : 18,
            alignItems: 'end',
          }}>
            <PodiumCard player={sorted[1]} rank={2} cat={cat} compact={compact} />
            <PodiumCard player={sorted[0]} rank={1} cat={cat} compact={compact} />
            <PodiumCard player={sorted[2]} rank={3} cat={cat} compact={compact} />
          </div>
        )}

        {/* 내 순위 인라인 (compact only — above table) */}
        {compact && myEntry && (
          <MyRankCard
            me={myEntry}
            myRank={myRank}
            total={players.length}
            compact
          />
        )}

        {/* 보드 + 사이드바 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : (myEntry ? 'minmax(0,1fr) 280px' : '1fr'),
          gap: compact ? 8 : 14, alignItems: 'start',
        }}>
          {/* 테이블 */}
          <div style={{
            border: '1px solid color-mix(in oklch, var(--border-soft) 60%, transparent)',
            borderRadius: compact ? 6 : 8, background: 'var(--bg-panel)',
            overflow: 'hidden',
          }}>
            {/* 헤더 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: compact ? '32px 1fr 50px' : '60px 1.8fr 1fr 80px 1fr 80px',
              alignItems: 'center', columnGap: compact ? 6 : 12,
              padding: compact ? '6px 8px' : '9px 16px',
              background: 'var(--bg-sunken)',
              borderBottom: '1px solid var(--border-soft)',
              fontFamily: 'var(--font-mono)', fontSize: compact ? 9 : 10,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: 'var(--text-mute)', fontWeight: 600,
            }}>
              <span>순위</span>
              <span>플레이어</span>
              {!compact && <span>클래스</span>}
              {!compact && <span>레벨</span>}
              <span style={{ textAlign: compact ? 'right' : undefined }}>{catLabel}</span>
              {!compact && <span>상태</span>}
            </div>

            {/* 행들 */}
            {loading ? (
              <div style={{
                textAlign: 'center', padding: compact ? 24 : 40,
                color: 'var(--text-faint)', fontSize: compact ? 11.5 : 13,
                fontFamily: 'var(--font-mono)',
              }}>
                Loading...
              </div>
            ) : sorted.length === 0 ? (
              <div style={{
                padding: compact ? 32 : 60, textAlign: 'center',
                color: 'var(--text-faint)', fontSize: compact ? 11.5 : 13,
                fontFamily: 'var(--font-mono)',
              }}>
                검색 결과가 없습니다.
              </div>
            ) : (
              sorted.map((p, i) => (
                <BoardRow
                  key={p.id}
                  player={p}
                  rank={i + 1}
                  cat={cat}
                  isMe={p.id === userId}
                  compact={compact}
                />
              ))
            )}
          </div>

          {/* 내 순위 사이드바 (desktop only) */}
          {!compact && myEntry && (
            <MyRankCard
              me={myEntry}
              myRank={myRank}
              total={players.length}
            />
          )}
        </div>
      </div>
    </div>
  );
}
