/* =========================================================
   CHAT PANEL — 미니맵 하단 채팅 (Supabase Realtime)
   컴팩트 레이아웃: 헤더(GLOBAL/GUILD 탭) + 메시지 스크롤 + 입력
   ========================================================= */
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import {
  loadRecentMessages,
  sendMessage,
  subscribeToChannel,
  unsubscribeChannel,
} from '../../lib/chat';
import type { ChatMessage } from '../../types';
import { ClickableName } from '../profile/ClickableName';

const MAX_MSG_LENGTH = 200;
const MAX_DISPLAY = 100;

type ChatTab = 'global' | 'guild';

/* ── 시간 포매터 ── */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/* ── 메시지 라인 (컴팩트) ── */
function MessageLine({ msg, isMe, isGuild }: { msg: ChatMessage; isMe: boolean; isGuild: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '1px 0', alignItems: 'baseline' }}>
      <span style={{
        fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)', fontFamily: 'var(--font-mono)',
        flexShrink: 0,
      }}>
        {formatTime(msg.createdAt)}
      </span>
      <ClickableName
        userId={msg.userId}
        name={msg.userName}
        isMe={isMe}
        style={{
          fontSize: 'var(--fs-xs)', fontWeight: 700,
          color: isMe ? 'var(--accent)' : isGuild ? 'var(--success)' : 'var(--info)',
          fontFamily: 'var(--font-display)',
          flexShrink: 0, whiteSpace: 'nowrap',
          maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      />
      {!isGuild && msg.guildName && (
        <span style={{
          fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)', fontFamily: 'var(--font-mono)',
          flexShrink: 0,
        }}>
          [{msg.guildName}]
        </span>
      )}
      <span style={{
        fontSize: 'var(--fs-xs)', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)',
        lineHeight: 1.4, wordBreak: 'break-word', flex: 1, minWidth: 0,
      }}>
        {msg.text}
      </span>
    </div>
  );
}

/* ── 메인 컴포넌트 ── */
export default function ChatPanel() {
  const userId = useGameStore((s) => s.authUserId);
  const playerName = useGameStore((s) => s.playerName);
  const level = useGameStore((s) => s.level);
  const guildId = useGameStore((s) => s.guildId);
  const guildName = useGameStore((s) => s.guildName);

  const [chatOpen, setChatOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<ChatTab>('global');
  const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([]);
  const [guildMessages, setGuildMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [globalLoaded, setGlobalLoaded] = useState(false);
  const [guildLoaded, setGuildLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 길드 탈퇴/해체 시 글로벌로 전환
  useEffect(() => {
    if (!guildId && activeTab === 'guild') setActiveTab('global');
  }, [guildId, activeTab]);

  const messages = activeTab === 'guild' ? guildMessages : globalMessages;
  const loaded = activeTab === 'guild' ? guildLoaded : globalLoaded;

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // addMessage helper (dedup + cap)
  const addMsg = useCallback(
    (setter: React.Dispatch<React.SetStateAction<ChatMessage[]>>, newMsg: ChatMessage) => {
      setter((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        const next = [...prev, newMsg];
        return next.length > MAX_DISPLAY ? next.slice(-MAX_DISPLAY) : next;
      });
    },
    [],
  );

  // ── Global 채널 구독 (항상) ──
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const recent = await loadRecentMessages('global', 50);
      if (!cancelled) { setGlobalMessages(recent); setGlobalLoaded(true); }
    })();

    const sub = subscribeToChannel('global', (msg) => addMsg(setGlobalMessages, msg));

    const poll = setInterval(async () => {
      if (cancelled) return;
      const recent = await loadRecentMessages('global', 50);
      if (!cancelled) {
        setGlobalMessages((prev) => {
          const ids = new Set(prev.map(m => m.id));
          const newOnes = recent.filter(m => !ids.has(m.id));
          if (newOnes.length === 0) return prev;
          const merged = [...prev, ...newOnes];
          return merged.length > MAX_DISPLAY ? merged.slice(-MAX_DISPLAY) : merged;
        });
      }
    }, 10_000);

    return () => { cancelled = true; unsubscribeChannel(sub); clearInterval(poll); };
  }, [addMsg]);

  // ── Guild 채널 구독 (guildId 존재 시만) ──
  useEffect(() => {
    if (!guildId) {
      setGuildMessages([]);
      setGuildLoaded(false);
      return;
    }
    let cancelled = false;
    const guildChannel = `guild:${guildId}`;

    (async () => {
      const recent = await loadRecentMessages(guildChannel, 50);
      if (!cancelled) { setGuildMessages(recent); setGuildLoaded(true); }
    })();

    const sub = subscribeToChannel(guildChannel, (msg) => addMsg(setGuildMessages, msg));

    const poll = setInterval(async () => {
      if (cancelled) return;
      const recent = await loadRecentMessages(guildChannel, 50);
      if (!cancelled) {
        setGuildMessages((prev) => {
          const ids = new Set(prev.map(m => m.id));
          const newOnes = recent.filter(m => !ids.has(m.id));
          if (newOnes.length === 0) return prev;
          const merged = [...prev, ...newOnes];
          return merged.length > MAX_DISPLAY ? merged.slice(-MAX_DISPLAY) : merged;
        });
      }
    }, 10_000);

    return () => { cancelled = true; unsubscribeChannel(sub); clearInterval(poll); };
  }, [guildId, addMsg]);

  // 스크롤 자동 하단
  const lastId = messages.length > 0 ? messages[messages.length - 1].id : 0;
  useLayoutEffect(() => { scrollToBottom(); }, [lastId, scrollToBottom]);
  useLayoutEffect(() => { if (loaded) scrollToBottom(); }, [loaded, scrollToBottom]);

  // 탭 전환 시 스크롤 리셋
  useLayoutEffect(() => { scrollToBottom(); }, [activeTab, scrollToBottom]);

  // 전송
  const handleSend = async () => {
    const text = input.trim();
    if (!text || !userId || sending) return;
    if (text.length > MAX_MSG_LENGTH) return;

    setSending(true);
    setInput('');

    const channel = activeTab === 'guild' && guildId ? `guild:${guildId}` : 'global';
    const sent = await sendMessage(channel, userId, playerName, level, guildName ?? null, text);
    if (sent) {
      const setter = activeTab === 'guild' ? setGuildMessages : setGlobalMessages;
      addMsg(setter, sent);
    } else {
      setInput(text);
    }

    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={{
      height: '100%',
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-md)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'max-height 0.2s ease',
    }}>
      {/* 헤더 — CHAT + 탭 전환 + 토글 */}
      <div style={{
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: chatOpen ? '1px solid var(--border-soft)' : 'none',
        flexShrink: 0,
      }}>
        <span style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-mute)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
        }}>
          CHAT
        </span>
        {/* 채널 탭 */}
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            onClick={() => setActiveTab('global')}
            style={{
              padding: '3px 9px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 500,
              color: activeTab === 'global' ? 'var(--accent)' : 'var(--text-mute)',
              background: activeTab === 'global' ? 'var(--bg-sunken)' : 'transparent',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
          >
            전체
          </button>
          {guildId && (
            <button
              onClick={() => setActiveTab('guild')}
              style={{
                padding: '3px 9px',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 500,
                color: activeTab === 'guild' ? 'var(--success)' : 'var(--text-mute)',
                background: activeTab === 'guild' ? 'var(--bg-sunken)' : 'transparent',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              클랜
            </button>
          )}
        </div>
        {/* 토글 버튼 */}
        <button
          onClick={() => setChatOpen(o => !o)}
          style={{
            marginLeft: 'auto',
            color: 'var(--text-mute)',
            fontSize: 14,
            width: 22,
            height: 22,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 3,
            transition: 'color 0.12s',
          }}
        >
          {chatOpen ? '−' : '+'}
        </button>
      </div>

      {chatOpen && (
        <>
          {/* 메시지 목록 */}
          <div ref={scrollRef} style={{
            flex: 1, minHeight: 0,
            overflowY: 'auto', overflowX: 'hidden',
            padding: '6px 14px',
            scrollBehavior: 'smooth',
            fontSize: 11.5,
          }}>
            {!loaded ? (
              <div style={{
                textAlign: 'center', color: 'var(--text-mute)',
                fontSize: 'var(--fs-xs)', fontStyle: 'italic', padding: 'var(--s-3)',
              }}>
                Loading...
              </div>
            ) : messages.length === 0 ? (
              <div style={{
                textAlign: 'center', color: 'var(--text-mute)',
                fontSize: 'var(--fs-xs)', fontStyle: 'italic', padding: 'var(--s-3)',
              }}>
                {activeTab === 'guild' ? '길드 첫 메시지를 보내보세요!' : '첫 메시지를 보내보세요!'}
              </div>
            ) : (
              messages.map((msg) => (
                <MessageLine
                  key={msg.id}
                  msg={msg}
                  isMe={msg.userId === userId}
                  isGuild={activeTab === 'guild'}
                />
              ))
            )}
          </div>

          {/* 입력 */}
          <div style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--border-soft)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_MSG_LENGTH))}
              onKeyDown={handleKeyDown}
              placeholder={activeTab === 'guild' ? '길드 메시지...' : '메시지...'}
              maxLength={MAX_MSG_LENGTH}
              style={{
                flex: 1, minWidth: 0,
                fontSize: 12,
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
                background: 'transparent',
                border: 'none',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              style={{
                width: 24,
                height: 22,
                background: 'var(--bg-sunken)',
                border: '1px solid var(--border-soft)',
                borderRadius: 4,
                color: !input.trim() || sending ? 'var(--text-mute)' : 'var(--text)',
                display: 'grid',
                placeItems: 'center',
                cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                transition: 'all 0.12s',
              }}
            >
              ›
            </button>
          </div>
        </>
      )}
    </div>
  );
}
