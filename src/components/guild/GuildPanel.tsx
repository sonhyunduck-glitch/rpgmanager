/* =========================================================
   GUILD PANEL — 클랜(길드) 페이지 전체
   미가입 → 길드 목록/생성
   가입중 → 배너 + 3탭(개요/멤버/클랜전)
   디자인 핸드오프 기반 리디자인
   ========================================================= */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import {
  getGuild,
  getGuildMembers,
  listGuilds,
  joinGuild,
  createGuild,
  leaveGuild,
  updateGuildNotice,
  dissolveGuild,
  getGuildMemberCount,
} from '../../lib/guild';
import type { GuildRow, GuildMemberRow } from '../../lib/guild';
import { ClickableName } from '../profile/ClickableName';
import { timeAgo, dateFmt } from '../../lib/utils';

/* ═══════════════════════════════════════════════════════════
   상수 & 헬퍼
   ═══════════════════════════════════════════════════════════ */
const GUILD_CREATE_LEVEL = 30;
const GUILD_CREATE_GOLD  = 30000;
const ONLINE_THRESHOLD   = 5 * 60 * 1000; // 5분

const PURPLE = 'oklch(0.68 0.20 305)';
const PURPLE_BORDER = 'color-mix(in oklch, oklch(0.68 0.20 305) 30%, transparent)';

type ClanTab = 'overview' | 'members' | 'war';
type SortKey = 'role' | 'lv' | 'recent';

interface ClassInfo { icon: string; name: string; color: string; border: string }
const CLASS_MAP: Record<string, ClassInfo> = {
  knight: { icon: '⚔', name: '기사', color: 'var(--danger)',  border: 'color-mix(in oklch, var(--danger) 40%, transparent)' },
  elf:    { icon: '⌒', name: '요정', color: 'var(--success)', border: 'color-mix(in oklch, var(--success) 40%, transparent)' },
  wizard: { icon: '✦', name: '마법사', color: PURPLE,    border: PURPLE_BORDER },
};

const ROLE_MAP: Record<string, { label: string; icon: string; color: string }> = {
  leader:  { label: '클랜장',  icon: '★', color: 'var(--accent)' },
  officer: { label: '운영진',  icon: '◆', color: 'var(--info)' },
  member:  { label: '클랜원',  icon: '·', color: 'var(--text-faint)' },
};

function classOf(cls: string | null | undefined): ClassInfo {
  return CLASS_MAP[cls ?? ''] ?? CLASS_MAP.knight;
}

function isOnline(lastActive: string | undefined): boolean {
  if (!lastActive) return false;
  return Date.now() - new Date(lastActive).getTime() < ONLINE_THRESHOLD;
}

function fmtG(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return Math.floor(n / 1e3) + 'k';
  return n.toLocaleString();
}

/* ═══════════════════════════════════════════════════════════
   길드 배너
   ═══════════════════════════════════════════════════════════ */
function GuildBanner({
  guild, memberCount, onlineCount, isLeader, isSoleMember,
  onLeave, onDissolve,
}: {
  guild: GuildRow;
  memberCount: number;
  onlineCount: number;
  isLeader: boolean;
  isSoleMember: boolean;
  onLeave: () => void;
  onDissolve: () => void;
}) {
  const initial = guild.name.charAt(0).toUpperCase();

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '80px 1fr auto',
      gap: 16,
      alignItems: 'center',
      padding: '18px 20px',
      background: `
        radial-gradient(ellipse 60% 100% at 20% 50%, color-mix(in oklch, ${PURPLE} 8%, transparent), transparent 70%),
        linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-sunken) 100%)
      `,
      border: '1px solid var(--border-soft)',
      borderRadius: 10,
      marginBottom: 16,
      position: 'relative' as const,
      overflow: 'hidden',
    }}>
      {/* 장식 */}
      <div style={{
        position: 'absolute', right: -40, top: -40,
        width: 200, height: 200,
        background: 'radial-gradient(circle, color-mix(in oklch, var(--accent) 4%, transparent), transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* 엠블럼 */}
      <div style={{
        width: 80, height: 80, borderRadius: 10,
        background: `conic-gradient(from 45deg at 50% 50%, #2a1a3e, #4a2570, #2a1a3e)`,
        border: `2px solid color-mix(in oklch, ${PURPLE} 50%, transparent)`,
        boxShadow: `0 0 20px color-mix(in oklch, ${PURPLE} 20%, transparent)`,
        display: 'grid', placeItems: 'center',
        fontFamily: 'var(--font-mono)', fontSize: 32,
        color: '#fff',
        textShadow: `0 0 12px color-mix(in oklch, ${PURPLE} 80%, transparent)`,
        position: 'relative',
      }}>
        {initial}
        <span style={{
          position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
          fontSize: 7, fontWeight: 700, letterSpacing: '0.15em',
          color: 'rgba(255,255,255,0.6)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          maxWidth: '90%',
        }}>
          {guild.name.toUpperCase()}
        </span>
      </div>

      {/* 길드 정보 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 22, fontWeight: 700, color: 'var(--text)',
            fontFamily: 'var(--font-display)', letterSpacing: '-0.01em',
          }}>
            {guild.name}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            padding: '3px 10px', borderRadius: 100,
            background: 'color-mix(in oklch, var(--accent) 10%, transparent)',
            color: 'var(--accent)',
            border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
          }}>
            Lv.{guild.level}
          </span>
        </div>
        {guild.notice && (
          <div style={{
            color: 'var(--text-mute)', fontSize: 12.5,
            fontStyle: 'italic', marginTop: 2,
          }}>
            &ldquo;{guild.notice}&rdquo;
          </div>
        )}
        <div style={{
          display: 'flex', gap: 18, marginTop: 8,
          fontFamily: 'var(--font-mono)', fontSize: 11,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ color: 'var(--text-mute)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {'멤버'}
            </span>
            <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>
              {memberCount}/{guild.max_members}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ color: 'var(--text-mute)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {'접속중'}
            </span>
            <span style={{ color: 'var(--success)', fontSize: 14, fontWeight: 600 }}>
              {onlineCount}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ color: 'var(--text-mute)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {'창립'}
            </span>
            <span style={{ color: 'var(--text)', fontSize: 12, fontWeight: 600 }}>
              {dateFmt(guild.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
        {!isLeader && (
          <button
            onClick={onLeave}
            style={{
              padding: '7px 14px',
              background: 'var(--bg-elevated)',
              border: '1px solid color-mix(in oklch, var(--danger) 20%, transparent)',
              color: 'var(--danger)',
              borderRadius: 5, fontSize: 11.5,
              fontFamily: 'var(--font-ui)', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.12s',
            }}
          >
            {'클랜 탈퇴'}
          </button>
        )}
        {isLeader && isSoleMember && (
          <button
            onClick={onDissolve}
            style={{
              padding: '7px 14px',
              background: 'var(--bg-elevated)',
              border: '1px solid color-mix(in oklch, var(--danger) 20%, transparent)',
              color: 'var(--danger)',
              borderRadius: 5, fontSize: 11.5,
              fontFamily: 'var(--font-ui)', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.12s',
            }}
          >
            {'길드 해산'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   탭 바
   ═══════════════════════════════════════════════════════════ */
function ClanTabBar({
  tab, setTab, memberCount,
}: {
  tab: ClanTab; setTab: (t: ClanTab) => void;
  memberCount: number;
}) {
  const tabs: { key: ClanTab; label: string; badge?: string }[] = [
    { key: 'overview', label: '개요' },
    { key: 'members', label: '멤버', badge: String(memberCount) },
    { key: 'war', label: '클랜전' },
  ];

  return (
    <div style={{
      display: 'flex', gap: 4, marginBottom: 16,
      borderBottom: '1px solid var(--border-soft)',
    }}>
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          style={{
            padding: '10px 18px',
            color: tab === t.key ? 'var(--accent)' : 'var(--text-mute)',
            fontSize: 13, fontWeight: 500,
            fontFamily: 'var(--font-ui)',
            borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`,
            marginBottom: -1,
            background: 'none', border: 'none',
            borderBottomStyle: 'solid', borderBottomWidth: 2,
            borderBottomColor: tab === t.key ? 'var(--accent)' : 'transparent',
            cursor: 'pointer', transition: 'color 0.12s',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {t.label}
          {t.badge && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              padding: '1px 6px', borderRadius: 100,
              background: tab === t.key
                ? 'color-mix(in oklch, var(--accent) 15%, transparent)'
                : 'var(--bg-elevated)',
              color: tab === t.key ? 'var(--accent)' : 'var(--text-mute)',
            }}>
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   통계 카드
   ═══════════════════════════════════════════════════════════ */
function StatCard({
  label, value, color,
}: {
  label: string; value: string; color?: string;
}) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-soft)',
      borderRadius: 6, padding: '12px 14px',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9.5,
        color: 'var(--text-mute)', textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700,
        marginTop: 4, color: color ?? 'var(--text)',
      }}>
        {value}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   개요 탭
   ═══════════════════════════════════════════════════════════ */
function OverviewTab({
  guild, members, userId,
  editingNotice, setEditingNotice, noticeText, setNoticeText,
  onSaveNotice,
}: {
  guild: GuildRow;
  members: GuildMemberRow[];
  userId: string;
  editingNotice: boolean;
  setEditingNotice: (v: boolean) => void;
  noticeText: string;
  setNoticeText: (v: string) => void;
  onSaveNotice: () => void;
}) {
  const isLeader = guild.leader_id === userId;
  const onlineMembers = members.filter(m => isOnline(m.last_active_at));
  const avgLevel = members.length > 0
    ? Math.round(members.reduce((s, m) => s + (m.level ?? 1), 0) / members.length)
    : 0;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1.4fr 1fr',
      gap: 14,
      alignItems: 'start',
    }}>
      {/* 좌측 */}
      <div>
        {/* 공지사항 */}
        <div style={{
          borderLeft: '3px solid var(--accent)',
          padding: '10px 14px',
          background: 'color-mix(in oklch, var(--accent) 4%, transparent)',
          borderRadius: '0 4px 4px 0',
          marginBottom: 12,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 4,
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9.5,
              color: 'var(--accent)', letterSpacing: '0.12em',
              textTransform: 'uppercase', fontWeight: 600,
            }}>
              {'★ 클랜장 공지 · 고정'}
            </span>
            {isLeader && !editingNotice && (
              <button
                onClick={() => setEditingNotice(true)}
                style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)',
                  background: 'none', border: 'none',
                  color: 'var(--accent)', cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                Edit
              </button>
            )}
          </div>
          {editingNotice ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={noticeText}
                onChange={(e) => setNoticeText(e.target.value.slice(0, 100))}
                onKeyDown={(e) => e.key === 'Enter' && onSaveNotice()}
                maxLength={100}
                style={{
                  flex: 1, minWidth: 0, padding: '5px 8px',
                  border: '1px solid var(--border-soft)',
                  borderRadius: 4,
                  background: 'var(--bg-panel)',
                  color: 'var(--text)', fontFamily: 'var(--font-mono)',
                  fontSize: 12, outline: 'none',
                }}
              />
              <button
                onClick={onSaveNotice}
                style={{
                  padding: '0 10px', border: 'none', borderRadius: 4,
                  background: 'var(--accent)', color: '#fff',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >
                OK
              </button>
              <button
                onClick={() => { setEditingNotice(false); setNoticeText(guild.notice); }}
                style={{
                  padding: '0 8px', border: '1px solid var(--border-soft)',
                  borderRadius: 4, background: 'transparent',
                  color: 'var(--text-mute)', fontSize: 11, cursor: 'pointer',
                }}
              >
                {'취소'}
              </button>
            </div>
          ) : (
            <div style={{
              color: guild.notice ? 'var(--text)' : 'var(--text-mute)',
              fontSize: 12.5, lineHeight: 1.5,
              fontStyle: guild.notice ? 'normal' : 'italic',
              wordBreak: 'break-word',
            }}>
              {guild.notice || '(공지 없음)'}
            </div>
          )}
          {guild.notice && !editingNotice && (
            <div style={{
              marginTop: 6, fontFamily: 'var(--font-mono)',
              fontSize: 10, color: 'var(--text-mute)',
            }}>
              {guild.name}
            </div>
          )}
        </div>

        {/* 통계 카드 그리드 */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: 10, marginBottom: 16,
        }}>
          <StatCard label={'멤버'} value={`${members.length}/${guild.max_members}`} color="var(--text)" />
          <StatCard label={'길드 레벨'} value={`Lv.${guild.level}`} color="var(--accent)" />
          <StatCard label={'접속중'} value={String(onlineMembers.length)} color="var(--success)" />
          <StatCard label={'평균 레벨'} value={`Lv.${avgLevel}`} color={PURPLE} />
        </div>

        {/* 멤버 레벨 분포 (간단 요약) */}
        <div style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-soft)',
          borderRadius: 8, overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-soft)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <h3 style={{
              margin: 0, fontSize: 13, fontWeight: 600,
              color: 'var(--text)', fontFamily: 'var(--font-ui)',
            }}>
              {'멤버 현황'}
            </h3>
            <span style={{
              marginLeft: 'auto', fontFamily: 'var(--font-mono)',
              fontSize: 10.5, color: 'var(--text-mute)',
            }}>
              {members.length}{'명'}
            </span>
          </div>
          <div style={{ padding: '14px 16px' }}>
            {/* 역할별 통계 */}
            {(['leader', 'officer', 'member'] as const).map(role => {
              const count = members.filter(m => m.role === role).length;
              if (count === 0) return null;
              const rm = ROLE_MAP[role];
              return (
                <div key={role} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 0',
                  borderBottom: '1px dashed color-mix(in oklch, var(--border-soft) 50%, transparent)',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9.5,
                    color: rm.color, minWidth: 50,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {rm.icon} {rm.label}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13,
                    color: 'var(--text)', fontWeight: 600,
                  }}>
                    {count}
                  </span>
                  <span style={{ color: 'var(--text-mute)', fontSize: 11 }}>
                    {'명'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 우측 — 온라인 멤버 */}
      <div>
        <div style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-soft)',
          borderRadius: 8, overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-soft)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <h3 style={{
              margin: 0, fontSize: 13, fontWeight: 600,
              color: 'var(--text)', fontFamily: 'var(--font-ui)',
            }}>
              {'온라인 멤버'}
            </h3>
            <span style={{
              marginLeft: 'auto', fontFamily: 'var(--font-mono)',
              fontSize: 10.5, color: 'var(--text-mute)',
            }}>
              {onlineMembers.length}/{members.length}{'명 접속중'}
            </span>
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            padding: '12px 16px',
            maxHeight: 360, overflowY: 'auto',
          }}>
            {onlineMembers.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: 20,
                color: 'var(--text-mute)', fontSize: 12,
                fontFamily: 'var(--font-mono)',
              }}>
                {'접속중인 멤버가 없습니다'}
              </div>
            ) : (
              onlineMembers.slice(0, 10).map(m => {
                const cls = classOf(m.player_class);
                const role = ROLE_MAP[m.role] ?? ROLE_MAP.member;
                const isMe = m.user_id === userId;
                return (
                  <div key={m.user_id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    {/* 아바타 + 온라인 닷 */}
                    <span style={{ position: 'relative', flexShrink: 0 }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: 5,
                        display: 'grid', placeItems: 'center',
                        background: 'var(--bg-sunken)',
                        border: `1px solid ${cls.border}`,
                        fontFamily: 'var(--font-mono)', fontSize: 13,
                        color: cls.color,
                      }}>
                        {cls.icon}
                      </span>
                      <span style={{
                        position: 'absolute', right: -2, bottom: -2,
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--success)',
                        boxShadow: '0 0 6px var(--success)',
                        border: '2px solid var(--bg-panel)',
                      }} />
                    </span>
                    {/* 이름 + 메타 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ClickableName
                          userId={m.user_id}
                          name={m.name ?? '???'}
                          isMe={isMe}
                          style={{
                            fontSize: 13, fontWeight: 600,
                            fontFamily: 'var(--font-ui)',
                            color: isMe ? 'var(--accent)' : 'var(--text)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}
                        />
                        {isMe && (
                          <span style={{
                            color: 'var(--accent)', fontSize: 10,
                            fontFamily: 'var(--font-mono)',
                          }}>
                            (나)
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: 10,
                        color: 'var(--text-mute)', marginTop: 1,
                      }}>
                        {cls.name} {'·'} Lv.{m.level ?? 1}
                        {m.role !== 'member' && (
                          <span style={{ marginLeft: 6, color: role.color }}>
                            {role.icon} {role.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   멤버 탭
   ═══════════════════════════════════════════════════════════ */
function MembersTab({
  members, userId,
}: {
  members: GuildMemberRow[];
  userId: string;
}) {
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('role');

  const roleOrder = { leader: 0, officer: 1, member: 2 };

  const rows = useMemo(() => {
    let r = members.slice();
    if (q) {
      const qq = q.toLowerCase();
      r = r.filter(m => (m.name ?? '').toLowerCase().includes(qq));
    }
    if (roleFilter) r = r.filter(m => m.role === roleFilter);
    r.sort((a, b) => {
      if (sortKey === 'lv') return (b.level ?? 0) - (a.level ?? 0);
      if (sortKey === 'recent') {
        const aOn = isOnline(a.last_active_at) ? 0 : 1;
        const bOn = isOnline(b.last_active_at) ? 0 : 1;
        return aOn - bOn;
      }
      // role sort
      return (roleOrder[a.role] ?? 2) - (roleOrder[b.role] ?? 2);
    });
    return r;
  }, [members, q, roleFilter, sortKey]);

  return (
    <>
      {/* 툴바 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 14,
      }}>
        {/* 검색 */}
        <div style={{
          flex: 1, maxWidth: 320,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-soft)',
          borderRadius: 6,
        }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--text-faint)" strokeWidth="1.6">
            <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>
          </svg>
          <input
            placeholder={'멤버 이름 검색'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 12.5, color: 'var(--text)',
              fontFamily: 'var(--font-ui)',
            }}
          />
        </div>

        {/* 역할 필터 */}
        <button
          onClick={() => {
            const cycle: (string | null)[] = [null, 'leader', 'officer', 'member'];
            const idx = cycle.indexOf(roleFilter);
            setRoleFilter(cycle[(idx + 1) % cycle.length]);
          }}
          style={{
            padding: '7px 11px',
            background: roleFilter
              ? 'color-mix(in oklch, var(--accent) 5%, transparent)'
              : 'var(--bg-panel)',
            border: `1px solid ${roleFilter
              ? 'color-mix(in oklch, var(--accent) 40%, transparent)'
              : 'var(--border-soft)'}`,
            borderRadius: 6, fontSize: 11.5,
            color: roleFilter ? 'var(--accent)' : 'var(--text-mute)',
            cursor: 'pointer', fontFamily: 'var(--font-ui)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {'역할'}
          {roleFilter && (
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
              {ROLE_MAP[roleFilter]?.label}
            </span>
          )}
        </button>

        {/* 정렬 */}
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          style={{
            padding: '7px 28px 7px 11px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-soft)',
            borderRadius: 6, fontSize: 11.5,
            color: 'var(--text)', fontFamily: 'var(--font-mono)',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%237c8696' d='M1.5 3.5L5 7l3.5-3.5z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
            cursor: 'pointer',
          }}
        >
          <option value="role">{'역할 순'}</option>
          <option value="lv">{'레벨 ↓'}</option>
          <option value="recent">{'접속중 우선'}</option>
        </select>
      </div>

      {/* 멤버 테이블 */}
      <div style={{
        border: '1px solid var(--border-soft)',
        borderRadius: 8,
        background: 'var(--bg-panel)',
        overflow: 'hidden',
      }}>
        {/* 헤더 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '24px 1.6fr 80px 80px 1fr 90px',
          alignItems: 'center', columnGap: 14,
          padding: '9px 16px',
          background: 'var(--bg-sunken)',
          borderBottom: '1px solid var(--border-soft)',
          fontFamily: 'var(--font-mono)', fontSize: 10,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          fontWeight: 600, color: 'var(--text-mute)',
        }}>
          <span />
          <span>{'이름'}</span>
          <span>{'클래스'}</span>
          <span>{'레벨'}</span>
          <span>{'마지막 접속'}</span>
          <span style={{ textAlign: 'right' }}>{'액션'}</span>
        </div>

        {/* 행 */}
        {rows.map(m => {
          const cls = classOf(m.player_class);
          const role = ROLE_MAP[m.role] ?? ROLE_MAP.member;
          const isMe = m.user_id === userId;
          const online = isOnline(m.last_active_at);

          return (
            <div
              key={m.user_id}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 1.6fr 80px 80px 1fr 90px',
                alignItems: 'center', columnGap: 14,
                padding: '9px 16px',
                borderBottom: '1px solid color-mix(in oklch, var(--border-soft) 50%, transparent)',
                transition: 'background 0.1s',
                ...(isMe ? {
                  background: 'color-mix(in oklch, var(--accent) 4%, transparent)',
                  borderLeft: '2px solid var(--accent)',
                  paddingLeft: 14,
                } : {}),
              }}
              onMouseEnter={(e) => { if (!isMe) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={(e) => { if (!isMe) e.currentTarget.style.background = ''; }}
            >
              {/* 상태 닷 */}
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: online ? 'var(--success)' : 'var(--text-faint)',
                boxShadow: online ? '0 0 6px var(--success)' : 'none',
              }} />

              {/* 이름 + 역할 */}
              <span style={{
                display: 'flex', alignItems: 'center', gap: 10, minWidth: 0,
              }}>
                <span style={{
                  width: 30, height: 30, borderRadius: 5,
                  display: 'grid', placeItems: 'center',
                  background: 'var(--bg-sunken)',
                  border: `1px solid ${cls.border}`,
                  fontFamily: 'var(--font-mono)', fontSize: 14,
                  color: cls.color, flexShrink: 0,
                }}>
                  {cls.icon}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                    <ClickableName
                      userId={m.user_id}
                      name={m.name ?? '???'}
                      isMe={isMe}
                      style={{
                        fontSize: 13, fontWeight: 600,
                        fontFamily: 'var(--font-ui)',
                        color: isMe ? 'var(--accent)' : 'var(--text)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}
                    />
                    {isMe && (
                      <span style={{
                        color: 'var(--accent)', fontSize: 10,
                        fontFamily: 'var(--font-mono)',
                      }}>
                        (나)
                      </span>
                    )}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9.5,
                    color: role.color, marginTop: 2,
                    display: 'block',
                  }}>
                    {role.icon} {role.label}
                  </span>
                </span>
              </span>

              {/* 클래스 */}
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 11.5,
                color: 'var(--text-mute)',
              }}>
                {cls.name}
              </span>

              {/* 레벨 */}
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 13,
                color: 'var(--text)', fontWeight: 600,
              }}>
                Lv.{m.level ?? 1}
              </span>

              {/* 마지막 접속 */}
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10.5,
                color: online ? 'var(--success)' : 'var(--text-faint)',
              }}>
                {online ? '● 접속중' : timeAgo(m.last_active_at)}
              </span>

              {/* 액션 */}
              <span style={{
                display: 'flex', gap: 4, justifyContent: 'flex-end',
              }}>
                <button
                  title={'프로필'}
                  onClick={() => useGameStore.getState().openProfile(m.user_id)}
                  style={{
                    width: 28, height: 28, borderRadius: 4,
                    border: '1px solid var(--border-soft)',
                    background: 'none', color: 'var(--text-mute)',
                    display: 'grid', placeItems: 'center',
                    cursor: 'pointer', transition: 'all 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--text)';
                    e.currentTarget.style.borderColor = 'var(--border-strong)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-mute)';
                    e.currentTarget.style.borderColor = 'var(--border-soft)';
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="8" cy="6" r="3"/><path d="M3 14a5 5 0 0110 0"/>
                  </svg>
                </button>
              </span>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div style={{
            padding: 30, textAlign: 'center',
            color: 'var(--text-mute)', fontSize: 12,
            fontFamily: 'var(--font-mono)',
          }}>
            {q || roleFilter
              ? '검색 결과가 없습니다'
              : '멤버가 없습니다'}
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   클랜전 탭 (준비 중 플레이스홀더)
   ═══════════════════════════════════════════════════════════ */
function WarTab() {
  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-soft)',
      borderRadius: 8,
      padding: 40,
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 32, marginBottom: 12,
        color: 'var(--text-faint)',
      }}>
        {'⚔️'}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 14,
        color: 'var(--text-mute)', fontWeight: 600, marginBottom: 6,
      }}>
        {'클랜전 시스템 준비 중'}
      </div>
      <div style={{
        fontSize: 12, color: 'var(--text-faint)',
        lineHeight: 1.5,
      }}>
        {'클랜전 기능이 곧 추가됩니다.'}
        <br />
        {'더 강해진 클랜을 기대해 주세요!'}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   가입 중 — 전체 뷰
   ═══════════════════════════════════════════════════════════ */
function MyGuildContent({
  userId, guildId, onLeft,
}: {
  userId: string; guildId: string; onLeft: () => void;
}) {
  const [guild, setGuild] = useState<GuildRow | null>(null);
  const [members, setMembers] = useState<GuildMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ClanTab>('overview');
  const [editingNotice, setEditingNotice] = useState(false);
  const [noticeText, setNoticeText] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [g, m] = await Promise.all([getGuild(guildId), getGuildMembers(guildId)]);
    setGuild(g);
    setMembers(m);
    if (g) setNoticeText(g.notice);
    setLoading(false);
  }, [guildId]);

  useEffect(() => { loadData(); }, [loadData]);

  // 30초 자동 새로고침
  useEffect(() => {
    const iv = setInterval(loadData, 30_000);
    return () => clearInterval(iv);
  }, [loadData]);

  const handleLeave = async () => {
    if (guild?.leader_id === userId) return;
    if (!window.confirm('정말 클랜을 탈퇴하시겠습니까?')) return;
    const { error } = await leaveGuild(guildId, userId);
    if (!error) onLeft();
  };

  const handleDissolve = async () => {
    if (guild?.leader_id !== userId || members.length !== 1) return;
    if (!window.confirm('정말 길드를 해산하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    const { error } = await dissolveGuild(guildId, userId);
    if (error) { alert(error); return; }
    onLeft();
  };

  const handleSaveNotice = async () => {
    await updateGuildNotice(guildId, noticeText.trim());
    setEditingNotice(false);
    await loadData();
  };

  if (loading || !guild) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 60, color: 'var(--text-mute)', fontSize: 12,
        fontFamily: 'var(--font-mono)',
      }}>
        Loading...
      </div>
    );
  }

  const isLeader = guild.leader_id === userId;
  const onlineCount = members.filter(m => isOnline(m.last_active_at)).length;

  return (
    <>
      <GuildBanner
        guild={guild}
        memberCount={members.length}
        onlineCount={onlineCount}
        isLeader={isLeader}
        isSoleMember={isLeader && members.length === 1}
        onLeave={handleLeave}
        onDissolve={handleDissolve}
      />

      <ClanTabBar tab={tab} setTab={setTab} memberCount={members.length} />

      {tab === 'overview' && (
        <OverviewTab
          guild={guild} members={members} userId={userId}
          editingNotice={editingNotice} setEditingNotice={setEditingNotice}
          noticeText={noticeText} setNoticeText={setNoticeText}
          onSaveNotice={handleSaveNotice}
        />
      )}
      {tab === 'members' && (
        <MembersTab members={members} userId={userId} />
      )}
      {tab === 'war' && <WarTab />}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   미가입 — 길드 목록 + 생성
   ═══════════════════════════════════════════════════════════ */
function NoGuildContent({ userId, onJoined }: { userId: string; onJoined: () => void }) {
  const level = useGameStore(s => s.level);
  const gold  = useGameStore(s => s.gold);
  const [guilds, setGuilds] = useState<(GuildRow & { memberCount?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const loadGuilds = useCallback(async () => {
    setLoading(true);
    const list = await listGuilds();
    const withCounts = await Promise.all(
      list.map(async (g) => ({ ...g, memberCount: await getGuildMemberCount(g.id) })),
    );
    setGuilds(withCounts);
    setLoading(false);
  }, []);

  useEffect(() => { loadGuilds(); }, [loadGuilds]);

  const canCreate = level >= GUILD_CREATE_LEVEL && gold >= GUILD_CREATE_GOLD;

  const handleCreate = async () => {
    if (level < GUILD_CREATE_LEVEL) { setError(`Lv.${GUILD_CREATE_LEVEL} 이상 필요`); return; }
    if (gold < GUILD_CREATE_GOLD)   { setError(`${GUILD_CREATE_GOLD.toLocaleString()}G 필요`); return; }
    const name = newName.trim();
    if (!name || name.length < 2 || name.length > 12) { setError('길드 이름: 2~12자'); return; }
    setError('');
    const { error: err } = await createGuild(name, userId);
    if (err) { setError(err); return; }
    useGameStore.setState(s => ({ gold: s.gold - GUILD_CREATE_GOLD }));
    setNewName(''); setCreating(false);
    onJoined();
  };

  const handleJoin = async (gId: string) => {
    const { error: err } = await joinGuild(gId, userId);
    if (err) { setError(err); return; }
    onJoined();
  };

  return (
    <>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 18,
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 17,
            fontWeight: 700, color: 'var(--text)',
          }}>
            {'클랜'}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-mute)', letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            GUILD
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setCreating(!creating)}
          style={{
            padding: '7px 14px', borderRadius: 5,
            border: creating
              ? '1px solid color-mix(in oklch, var(--accent) 40%, transparent)'
              : '1px solid var(--border-soft)',
            background: creating
              ? 'color-mix(in oklch, var(--accent) 10%, transparent)'
              : 'var(--bg-elevated)',
            color: creating ? 'var(--accent)' : 'var(--text-mute)',
            fontFamily: 'var(--font-mono)', fontSize: 11.5,
            fontWeight: 700, cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            transition: 'all 0.12s',
          }}
        >
          {creating ? 'CANCEL' : '+ NEW GUILD'}
        </button>
      </div>

      {/* 생성 폼 */}
      {creating && (
        <div style={{
          padding: 16,
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-soft)',
          borderRadius: 8, marginBottom: 14,
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-mute)', textTransform: 'uppercase',
            letterSpacing: '0.1em', fontWeight: 600, marginBottom: 10,
          }}>
            {'새 길드 창설'}
          </div>

          {/* 조건 표시 */}
          <div style={{
            display: 'flex', gap: 14, marginBottom: 10,
            fontFamily: 'var(--font-mono)', fontSize: 11,
          }}>
            <span style={{
              color: level >= GUILD_CREATE_LEVEL ? 'var(--success)' : 'var(--danger)',
            }}>
              {level >= GUILD_CREATE_LEVEL ? '✓' : '✗'} Lv.{GUILD_CREATE_LEVEL}
            </span>
            <span style={{
              color: gold >= GUILD_CREATE_GOLD ? 'var(--accent)' : 'var(--danger)',
            }}>
              {gold >= GUILD_CREATE_GOLD ? '✓' : '✗'} {fmtG(GUILD_CREATE_GOLD)}G
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value.slice(0, 12))}
              onKeyDown={(e) => e.key === 'Enter' && canCreate && handleCreate()}
              placeholder={'길드 이름 (2~12자)'}
              maxLength={12}
              style={{
                flex: 1, minWidth: 0, padding: '8px 12px',
                border: '1px solid var(--border-soft)',
                borderRadius: 6, background: 'var(--bg-sunken)',
                color: 'var(--text)', fontFamily: 'var(--font-mono)',
                fontSize: 13, outline: 'none',
              }}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || !canCreate}
              style={{
                padding: '0 16px', border: 'none', borderRadius: 6,
                background: newName.trim() && canCreate
                  ? 'linear-gradient(135deg, var(--accent), oklch(0.68 0.18 45))'
                  : 'var(--bg-sunken)',
                color: newName.trim() && canCreate ? '#fff' : 'var(--text-mute)',
                fontFamily: 'var(--font-mono)', fontSize: 12,
                fontWeight: 700, cursor: newName.trim() && canCreate ? 'pointer' : 'default',
                transition: 'opacity 0.12s',
              }}
            >
              CREATE
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          fontSize: 12, color: 'var(--danger)', fontFamily: 'var(--font-mono)',
          padding: '4px 0', marginBottom: 10,
        }}>
          {error}
        </div>
      )}

      {/* 길드 목록 */}
      {loading ? (
        <div style={{
          textAlign: 'center', color: 'var(--text-mute)',
          fontSize: 12, fontFamily: 'var(--font-mono)',
          padding: 40,
        }}>
          Loading...
        </div>
      ) : guilds.length === 0 ? (
        <div style={{
          textAlign: 'center', color: 'var(--text-mute)',
          fontSize: 13, padding: 40,
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-soft)',
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 28, marginBottom: 8, color: 'var(--text-faint)' }}>
            {'⚔️'}
          </div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {'길드가 없습니다'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {'첫 길드를 만들어보세요!'}
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {guilds.map(g => (
            <div
              key={g.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 16px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-soft)',
                borderRadius: 8,
                transition: 'border-color 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-soft)'; }}
            >
              {/* 엠블럼 */}
              <div style={{
                width: 42, height: 42, borderRadius: 7,
                background: `conic-gradient(from 45deg, #2a1a3e, #4a2570, #2a1a3e)`,
                border: `1px solid ${PURPLE_BORDER}`,
                display: 'grid', placeItems: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 18,
                color: '#fff', flexShrink: 0,
                textShadow: `0 0 8px color-mix(in oklch, ${PURPLE} 60%, transparent)`,
              }}>
                {g.name.charAt(0).toUpperCase()}
              </div>
              {/* 정보 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: 'var(--text)',
                  fontFamily: 'var(--font-display)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {g.name}
                </div>
                <div style={{
                  display: 'flex', gap: 10, marginTop: 3,
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  color: 'var(--text-mute)',
                }}>
                  <span style={{ color: 'var(--accent)' }}>Lv.{g.level}</span>
                  <span>{g.memberCount ?? '?'}/{g.max_members}{'명'}</span>
                </div>
              </div>
              {/* 가입 버튼 */}
              <button
                onClick={() => handleJoin(g.id)}
                style={{
                  padding: '7px 16px', border: 'none', borderRadius: 5,
                  background: 'linear-gradient(135deg, var(--accent), oklch(0.68 0.18 45))',
                  color: '#fff',
                  fontFamily: 'var(--font-mono)', fontSize: 11.5,
                  fontWeight: 700, cursor: 'pointer',
                  flexShrink: 0, transition: 'opacity 0.12s',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}
              >
                JOIN
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   메인 길드 패널
   ═══════════════════════════════════════════════════════════ */
export default function GuildPanel() {
  const userId = useGameStore(s => s.authUserId);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const checkGuild = useCallback(async () => {
    if (!userId) return;
    const { supabase } = await import('../../lib/supabase');
    const { data } = await supabase
      .from('guild_members')
      .select('guild_id')
      .eq('user_id', userId)
      .maybeSingle();

    const newGuildId = data?.guild_id ?? null;
    setGuildId(newGuildId);
    setChecked(true);

    if (newGuildId) {
      const guild = await getGuild(newGuildId);
      useGameStore.setState({ guildId: newGuildId, guildName: guild?.name ?? null });
    } else {
      useGameStore.setState({ guildId: null, guildName: null });
    }
  }, [userId]);

  useEffect(() => { checkGuild(); }, [checkGuild]);

  if (!userId || !checked) {
    return (
      <div style={{
        padding: '18px 22px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-mute)', fontSize: 12,
        fontFamily: 'var(--font-mono)',
        height: '100%',
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      padding: '18px 22px 32px',
      overflowY: 'auto',
      height: '100%',
    }}>
      {/* Breadcrumb */}
      {!guildId && (
        <div style={{ marginBottom: 0 }} />
      )}

      {guildId ? (
        <MyGuildContent
          userId={userId}
          guildId={guildId}
          onLeft={() => {
            setGuildId(null);
            useGameStore.setState({ guildId: null, guildName: null });
          }}
        />
      ) : (
        <NoGuildContent
          userId={userId}
          onJoined={() => checkGuild()}
        />
      )}
    </div>
  );
}
