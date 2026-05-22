/* =========================================================
   NoGuildView — 길드 미가입: 길드 목록 + 생성 폼
   ========================================================= */
import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import {
  createGuild,
  listGuilds,
  joinGuild,
  getGuildMemberCount,
} from '../../lib/guild';
import type { GuildRow } from '../../lib/guild';
import { LABEL } from '../../styles/shared';

/* ── 길드 생성 조건 ── */
const GUILD_CREATE_LEVEL = 30;
const GUILD_CREATE_GOLD = 30000;

export function NoGuildView({ userId, onJoined }: { userId: string; onJoined: () => void }) {
  const level = useGameStore(s => s.level);
  const gold = useGameStore(s => s.gold);
  const [guilds, setGuilds] = useState<(GuildRow & { memberCount?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const loadGuilds = useCallback(async () => {
    setLoading(true);
    const list = await listGuilds();
    // 멤버 수 조회
    const withCounts = await Promise.all(
      list.map(async (g) => ({
        ...g,
        memberCount: await getGuildMemberCount(g.id),
      })),
    );
    setGuilds(withCounts);
    setLoading(false);
  }, []);

  useEffect(() => { loadGuilds(); }, [loadGuilds]);

  const canCreate = level >= GUILD_CREATE_LEVEL && gold >= GUILD_CREATE_GOLD;

  const handleCreate = async () => {
    if (level < GUILD_CREATE_LEVEL) {
      setError(`Lv.${GUILD_CREATE_LEVEL} 이상 필요`);
      return;
    }
    if (gold < GUILD_CREATE_GOLD) {
      setError(`${GUILD_CREATE_GOLD.toLocaleString()}G 필요`);
      return;
    }
    const name = newName.trim();
    if (!name || name.length < 2 || name.length > 12) {
      setError('길드 이름: 2~12자');
      return;
    }
    setError('');
    const { error: err } = await createGuild(name, userId);
    if (err) { setError(err); return; }
    // 골드 차감
    useGameStore.setState(s => ({ gold: s.gold - GUILD_CREATE_GOLD }));
    setNewName('');
    setCreating(false);
    onJoined();
  };

  const handleJoin = async (guildId: string) => {
    const { error: err } = await joinGuild(guildId, userId);
    if (err) { setError(err); return; }
    onJoined();
  };

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        ...LABEL, fontSize: 'var(--fs-xs)', marginBottom: 'var(--s-2)',
        display: 'flex', alignItems: 'center', gap: 'var(--s-1)',
      }}>
        <span>Guild</span>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => setCreating(!creating)}
          style={{
            fontSize: 'var(--fs-2xs)', fontWeight: 700, fontFamily: 'var(--font-mono)',
            padding: '1px 6px', borderRadius: 'var(--r-xs)',
            border: '1px solid var(--accent)',
            background: creating
              ? 'color-mix(in oklch, var(--accent) 15%, transparent)'
              : 'transparent',
            color: 'var(--accent)', cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}
        >
          {creating ? 'Cancel' : '+ New'}
        </button>
      </div>

      {/* 길드 생성 폼 */}
      {creating && (
        <div style={{
          padding: 'var(--s-2)',
          background: 'var(--bg-sunken)',
          borderRadius: 'var(--r-sm)',
          border: '1px solid var(--border-soft)',
          marginBottom: 'var(--s-2)',
          flexShrink: 0,
        }}>
          {/* 생성 조건 */}
          <div style={{
            display: 'flex', gap: 'var(--s-2)', marginBottom: 4,
            fontSize: 'var(--fs-2xs)', fontFamily: 'var(--font-mono)',
          }}>
            <span style={{ color: level >= GUILD_CREATE_LEVEL ? 'var(--text-dim)' : 'var(--danger)' }}>
              Lv.{GUILD_CREATE_LEVEL}
            </span>
            <span style={{ color: gold >= GUILD_CREATE_GOLD ? 'var(--accent)' : 'var(--danger)' }}>
              {GUILD_CREATE_GOLD.toLocaleString()}G
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value.slice(0, 12))}
              onKeyDown={(e) => e.key === 'Enter' && canCreate && handleCreate()}
              placeholder="길드 이름..."
              maxLength={12}
              style={{
                flex: 1, minWidth: 0, padding: '4px 6px',
                border: '1px solid var(--border-soft)',
                borderRadius: 'var(--r-xs)',
                background: 'var(--bg-panel)',
                color: 'var(--text)', fontFamily: 'var(--font-mono)',
                fontSize: 'var(--fs-xs)', outline: 'none',
              }}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || !canCreate}
              style={{
                padding: '0 8px', border: 'none',
                borderRadius: 'var(--r-xs)',
                background: newName.trim() && canCreate ? 'var(--accent)' : 'var(--bg-sunken)',
                color: newName.trim() && canCreate ? '#fff' : 'var(--text-mute)',
                fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', fontWeight: 700,
                cursor: newName.trim() && canCreate ? 'pointer' : 'default',
              }}
            >
              Create
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          fontSize: 'var(--fs-xs)', color: 'var(--danger)', fontFamily: 'var(--font-mono)',
          padding: '2px 0', marginBottom: 'var(--s-1)', flexShrink: 0,
        }}>
          {error}
        </div>
      )}

      {/* 길드 목록 */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {loading ? (
          <div style={{
            textAlign: 'center', color: 'var(--text-mute)',
            fontSize: 'var(--fs-xs)', fontStyle: 'italic', padding: 'var(--s-4)',
          }}>
            Loading...
          </div>
        ) : guilds.length === 0 ? (
          <div style={{
            textAlign: 'center', color: 'var(--text-mute)',
            fontSize: 'var(--fs-xs)', fontStyle: 'italic', padding: 'var(--s-4)',
          }}>
            길드가 없습니다.
            <br />첫 길드를 만들어보세요!
          </div>
        ) : (
          guilds.map((g) => (
            <div
              key={g.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 8px',
                background: 'var(--bg-sunken)',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border-soft)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)',
                  fontFamily: 'var(--font-display)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {g.name}
                </div>
                <div style={{
                  fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)', fontFamily: 'var(--font-mono)',
                  marginTop: 1,
                }}>
                  Lv.{g.level} | {g.memberCount ?? '?'}/{g.max_members}명
                </div>
              </div>
              <button
                onClick={() => handleJoin(g.id)}
                style={{
                  padding: '3px 8px', border: 'none',
                  borderRadius: 'var(--r-xs)',
                  background: 'var(--accent)', color: '#fff',
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', fontWeight: 700,
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                Join
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
