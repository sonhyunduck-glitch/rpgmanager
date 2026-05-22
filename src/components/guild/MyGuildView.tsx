/* =========================================================
   MyGuildView — 길드 가입중: 정보 + 멤버 리스트 + 공지 편집
   ========================================================= */
import { useEffect, useState, useCallback } from 'react';
import {
  getGuild,
  getGuildMembers,
  leaveGuild,
  updateGuildNotice,
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

export function MyGuildView({
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
