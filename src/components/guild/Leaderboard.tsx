/* =========================================================
   LEADERBOARD — 레벨 랭킹 (우측 패널 상단)
   ========================================================= */
import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getTopPlayers } from '../../lib/leaderboard';
import type { LeaderboardEntry } from '../../lib/leaderboard';
import { LABEL } from '../../styles/shared';
import { ClickableName } from '../profile/ClickableName';

/* ── 순위 색상 ── */
function rankColor(rank: number): string {
  if (rank === 1) return 'oklch(0.8 0.18 85)';   // gold
  if (rank === 2) return 'oklch(0.75 0.03 250)';  // silver
  if (rank === 3) return 'oklch(0.65 0.1 55)';    // bronze
  return 'var(--text-mute)';
}

export default function Leaderboard() {
  const userId = useGameStore((s) => s.authUserId);
  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const top = await getTopPlayers(15);
    setPlayers(top);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // 60초마다 갱신
  useEffect(() => {
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div style={{
      height: '100%',
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-md)',
      padding: 'var(--s-2) var(--s-3)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--s-1)',
        flexShrink: 0, marginBottom: 'var(--s-1)',
      }}>
        <span style={{ ...LABEL, fontSize: 9, marginBottom: 0 }}>
          Ranking
        </span>
        <span style={{ flex: 1 }} />
        <button
          onClick={load}
          style={{
            fontSize: 8, fontFamily: 'var(--font-mono)',
            background: 'none', border: 'none',
            color: 'var(--text-mute)', cursor: 'pointer',
          }}
          title="새로고침"
        >
          Refresh
        </button>
      </div>

      {/* 랭킹 리스트 */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 1,
      }}>
        {loading ? (
          <div style={{
            textAlign: 'center', color: 'var(--text-mute)',
            fontSize: 10, fontStyle: 'italic', padding: 'var(--s-3)',
          }}>
            Loading...
          </div>
        ) : players.length === 0 ? (
          <div style={{
            textAlign: 'center', color: 'var(--text-mute)',
            fontSize: 10, fontStyle: 'italic', padding: 'var(--s-3)',
          }}>
            No players yet.
          </div>
        ) : (
          players.map((p, i) => {
            const rank = i + 1;
            const isMe = p.id === userId;
            const rColor = rankColor(rank);
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '2px 4px',
                  borderRadius: 'var(--r-xs)',
                  background: isMe
                    ? 'color-mix(in oklch, var(--accent) 8%, transparent)'
                    : rank <= 3
                      ? `color-mix(in oklch, ${rColor} 5%, transparent)`
                      : 'transparent',
                }}
              >
                {/* 순위 */}
                <span style={{
                  fontSize: rank <= 3 ? 10 : 8,
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: rColor,
                  minWidth: 16,
                  textAlign: 'right',
                }}>
                  {rank}
                </span>

                {/* 레벨 */}
                <span style={{
                  fontSize: 8, fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-mute)',
                  minWidth: 22, textAlign: 'right',
                }}>
                  {p.level}
                </span>

                {/* 이름 */}
                <ClickableName
                  userId={p.id}
                  name={p.name}
                  isMe={isMe}
                  style={{
                    fontSize: 10,
                    fontWeight: isMe ? 700 : 500,
                    fontFamily: 'var(--font-display)',
                    flex: 1, minWidth: 0,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                />

                {/* 길드 */}
                {p.guild_name && (
                  <span style={{
                    fontSize: 7, fontFamily: 'var(--font-mono)',
                    color: 'var(--text-mute)', flexShrink: 0,
                    maxWidth: 40,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    [{p.guild_name}]
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
