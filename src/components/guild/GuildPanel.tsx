/* =========================================================
   GUILD PANEL — 우측 패널: 길드 정보 + 멤버 + 관리
   미가입 → 길드 목록/생성
   가입중 → 길드 정보 + 멤버 리스트
   ========================================================= */
import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import {
  createGuild,
  listGuilds,
  getGuild,
  getGuildMembers,
  joinGuild,
  leaveGuild,
  updateGuildNotice,
  getGuildMemberCount,
} from '../../lib/guild';
import type { GuildRow, GuildMemberRow } from '../../lib/guild';
import { LABEL } from '../../styles/shared';
import { ClickableName } from '../profile/ClickableName';
import { timeAgo } from '../../lib/utils';

/* ── 역할 색상/라벨 ── */
const ROLE_STYLE: Record<string, { color: string; label: string }> = {
  leader: { color: 'var(--accent)', label: 'Leader' },
  officer: { color: 'var(--info)', label: 'Officer' },
  member: { color: 'var(--text-mute)', label: 'Member' },
};


/* ── 길드 미가입: 목록 + 생성 ── */
function NoGuildView({ userId, onJoined }: { userId: string; onJoined: () => void }) {
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

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || name.length < 2 || name.length > 12) {
      setError('길드 이름: 2~12자');
      return;
    }
    setError('');
    const { error: err } = await createGuild(name, userId);
    if (err) { setError(err); return; }
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
        ...LABEL, fontSize: 9, marginBottom: 'var(--s-2)',
        display: 'flex', alignItems: 'center', gap: 'var(--s-1)',
      }}>
        <span>Guild</span>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => setCreating(!creating)}
          style={{
            fontSize: 8, fontWeight: 700, fontFamily: 'var(--font-mono)',
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
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value.slice(0, 12))}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="길드 이름..."
              maxLength={12}
              style={{
                flex: 1, minWidth: 0, padding: '4px 6px',
                border: '1px solid var(--border-soft)',
                borderRadius: 'var(--r-xs)',
                background: 'var(--bg-panel)',
                color: 'var(--text)', fontFamily: 'var(--font-mono)',
                fontSize: 10, outline: 'none',
              }}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              style={{
                padding: '0 8px', border: 'none',
                borderRadius: 'var(--r-xs)',
                background: newName.trim() ? 'var(--accent)' : 'var(--bg-sunken)',
                color: newName.trim() ? '#fff' : 'var(--text-mute)',
                fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                cursor: newName.trim() ? 'pointer' : 'default',
              }}
            >
              Create
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          fontSize: 9, color: 'var(--danger)', fontFamily: 'var(--font-mono)',
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
            fontSize: 10, fontStyle: 'italic', padding: 'var(--s-4)',
          }}>
            Loading...
          </div>
        ) : guilds.length === 0 ? (
          <div style={{
            textAlign: 'center', color: 'var(--text-mute)',
            fontSize: 10, fontStyle: 'italic', padding: 'var(--s-4)',
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
                  fontSize: 11, fontWeight: 700, color: 'var(--text)',
                  fontFamily: 'var(--font-display)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {g.name}
                </div>
                <div style={{
                  fontSize: 8, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)',
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
                  fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700,
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

/* ── 길드 가입중: 정보 + 멤버 ── */
function MyGuildView({
  userId,
  guildId,
  onLeft,
}: {
  userId: string;
  guildId: string;
  onLeft: () => void;
}) {
  const [guild, setGuild] = useState<GuildRow | null>(null);
  const [members, setMembers] = useState<GuildMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNotice, setEditingNotice] = useState(false);
  const [noticeText, setNoticeText] = useState('');

  const isLeader = guild?.leader_id === userId;

  const loadData = useCallback(async () => {
    setLoading(true);
    const [g, m] = await Promise.all([
      getGuild(guildId),
      getGuildMembers(guildId),
    ]);
    setGuild(g);
    setMembers(m);
    if (g) setNoticeText(g.notice);
    setLoading(false);
  }, [guildId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLeave = async () => {
    if (isLeader) return; // 리더는 탈퇴 불가 (해산 구현은 추후)
    const { error } = await leaveGuild(guildId, userId);
    if (!error) onLeft();
  };

  const handleSaveNotice = async () => {
    await updateGuildNotice(guildId, noticeText.trim());
    setEditingNotice(false);
    await loadData();
  };

  if (loading) {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: 'var(--text-mute)', fontSize: 10,
      }}>
        Loading...
      </div>
    );
  }

  if (!guild) return null;

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', gap: 'var(--s-2)',
    }}>
      {/* 길드 헤더 */}
      <div style={{ flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--s-1)',
        }}>
          <span style={{
            fontSize: 13, fontWeight: 700, color: 'var(--accent)',
            fontFamily: 'var(--font-display)',
          }}>
            {guild.name}
          </span>
          <span style={{
            fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: 'var(--text-mute)',
          }}>
            Lv.{guild.level}
          </span>
        </div>
        <div style={{
          fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)',
          marginTop: 2,
        }}>
          {members.length}/{guild.max_members}명
        </div>
      </div>

      {/* 공지사항 */}
      <div style={{
        padding: '6px 8px',
        background: 'var(--bg-sunken)',
        borderRadius: 'var(--r-sm)',
        border: '1px solid var(--border-soft)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginBottom: 3,
        }}>
          <span style={{ ...LABEL, fontSize: 8, marginBottom: 0 }}>Notice</span>
          {isLeader && !editingNotice && (
            <button
              onClick={() => setEditingNotice(true)}
              style={{
                fontSize: 7, fontFamily: 'var(--font-mono)',
                background: 'none', border: 'none',
                color: 'var(--accent)', cursor: 'pointer',
              }}
            >
              Edit
            </button>
          )}
        </div>
        {editingNotice ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              value={noticeText}
              onChange={(e) => setNoticeText(e.target.value.slice(0, 100))}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveNotice()}
              maxLength={100}
              style={{
                flex: 1, minWidth: 0, padding: '3px 6px',
                border: '1px solid var(--border-soft)',
                borderRadius: 'var(--r-xs)',
                background: 'var(--bg-panel)',
                color: 'var(--text)', fontFamily: 'var(--font-mono)',
                fontSize: 9, outline: 'none',
              }}
            />
            <button
              onClick={handleSaveNotice}
              style={{
                padding: '0 6px', border: 'none',
                borderRadius: 'var(--r-xs)',
                background: 'var(--accent)', color: '#fff',
                fontSize: 8, fontWeight: 700, cursor: 'pointer',
              }}
            >
              OK
            </button>
          </div>
        ) : (
          <div style={{
            fontSize: 9, color: guild.notice ? 'var(--text-dim)' : 'var(--text-mute)',
            fontFamily: 'var(--font-mono)',
            fontStyle: guild.notice ? 'normal' : 'italic',
            wordBreak: 'break-word',
          }}>
            {guild.notice || '(공지 없음)'}
          </div>
        )}
      </div>

      {/* 멤버 리스트 */}
      <div style={{ ...LABEL, fontSize: 8, marginBottom: 0, flexShrink: 0 }}>
        Members
      </div>
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {members.map((m) => {
          const rs = ROLE_STYLE[m.role] ?? ROLE_STYLE.member;
          const isMe = m.user_id === userId;
          return (
            <div
              key={m.user_id}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 6px',
                borderRadius: 'var(--r-xs)',
                background: isMe
                  ? 'color-mix(in oklch, var(--accent) 6%, transparent)'
                  : 'transparent',
              }}
            >
              {/* 역할 표시 */}
              <span style={{
                fontSize: 7, fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: rs.color, minWidth: 32,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {rs.label}
              </span>
              {/* 레벨 */}
              <span style={{
                fontSize: 8, fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: 'var(--text-mute)', minWidth: 20, textAlign: 'right',
              }}>
                {m.level}
              </span>
              {/* 이름 */}
              <ClickableName
                userId={m.user_id}
                name={m.name ?? '알 수 없음'}
                isMe={isMe}
                style={{
                  fontSize: 10,
                  fontWeight: isMe ? 700 : 500,
                  fontFamily: 'var(--font-display)',
                  flex: 1, minWidth: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              />
              {/* 최근 접속 */}
              <span style={{
                fontSize: 7, fontFamily: 'var(--font-mono)',
                color: 'var(--text-mute)', flexShrink: 0,
              }}>
                {timeAgo(m.last_active_at)}
              </span>
            </div>
          );
        })}
      </div>

      {/* 탈퇴 버튼 */}
      {!isLeader && (
        <button
          onClick={handleLeave}
          style={{
            flexShrink: 0,
            padding: '4px 0',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--r-xs)',
            background: 'transparent',
            color: 'var(--text-mute)',
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          Leave Guild
        </button>
      )}
    </div>
  );
}

/* ── 메인 길드 패널 ── */
export default function GuildPanel() {
  const userId = useGameStore((s) => s.authUserId);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  // 현재 유저의 길드 확인
  const checkGuild = useCallback(async () => {
    if (!userId) return;
    const { supabase } = await import('../../lib/supabase');
    const { data } = await supabase
      .from('guild_members')
      .select('guild_id')
      .eq('user_id', userId)
      .maybeSingle();

    setGuildId(data?.guild_id ?? null);
    setChecked(true);
  }, [userId]);

  useEffect(() => { checkGuild(); }, [checkGuild]);

  if (!userId || !checked) {
    return (
      <div style={{
        height: '100%',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--s-2) var(--s-3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-mute)',
        fontSize: 10,
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      height: '100%',
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-md)',
      padding: 'var(--s-2) var(--s-3)',
      overflow: 'hidden',
    }}>
      {guildId ? (
        <MyGuildView
          userId={userId}
          guildId={guildId}
          onLeft={() => { setGuildId(null); }}
        />
      ) : (
        <NoGuildView
          userId={userId}
          onJoined={() => checkGuild()}
        />
      )}
    </div>
  );
}
