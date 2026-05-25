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
import { LABEL } from '../../styles/shared';
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
      padding: 'var(--s-2) var(--s-3)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* 헤더 — 탭 전환 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--s-1)',
        flexShrink: 0, marginBottom: 'var(--s-1)',
      }}>
        <span style={{ ...LABEL, fontSize: 'var(--fs-xs)', marginBottom: 0 }}>
          Chat
        </span>
        {/* GLOBAL 탭 */}
        <button
          onClick={() => setActiveTab('global')}
          style={{
            fontSize: 'var(--fs-2xs)', fontFamily: 'var(--font-mono)', fontWeight: 700,
            padding: '0 4px', border: 'none', cursor: 'pointer',
            borderRadius: 'var(--r-xs)',
            background: activeTab === 'global'
              ? 'color-mix(in oklch, var(--accent) 10%, transparent)'
              : 'transparent',
            color: activeTab === 'global' ? 'var(--accent)' : 'var(--text-mute)',
            transition: 'all 0.15s',
          }}
        >
          GLOBAL
        </button>
        {/* GUILD 탭 (길드 가입 시만) */}
        {guildId && (
          <button
            onClick={() => setActiveTab('guild')}
            style={{
              fontSize: 'var(--fs-2xs)', fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '0 4px', border: 'none', cursor: 'pointer',
              borderRadius: 'var(--r-xs)',
              background: activeTab === 'guild'
                ? 'color-mix(in oklch, var(--success) 10%, transparent)'
                : 'transparent',
              color: activeTab === 'guild' ? 'var(--success)' : 'var(--text-mute)',
              transition: 'all 0.15s',
            }}
          >
            GUILD
          </button>
        )}
        <span style={{ flex: 1 }} />
        <span style={{
          fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)', fontFamily: 'var(--font-mono)',
        }}>
          {messages.length}
        </span>
      </div>

      {/* 메시지 목록 */}
      <div ref={scrollRef} style={{
        flex: 1, minHeight: 0,
        overflowY: 'auto', overflowX: 'hidden',
        scrollBehavior: 'smooth',
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
        display: 'flex', gap: 4, flexShrink: 0,
        paddingTop: 'var(--s-1)',
        borderTop: '1px solid var(--border-soft)',
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
            padding: '4px 8px',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--r-xs)',
            background: 'var(--bg-sunken)',
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-xs)',
            outline: 'none',
            transition: 'border-color 0.15s ease',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = activeTab === 'guild' ? 'var(--success)' : 'var(--accent)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-soft)'; }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          style={{
            padding: '0 8px',
            border: 'none',
            borderRadius: 'var(--r-xs)',
            background: !input.trim() || sending
              ? 'var(--bg-sunken)'
              : activeTab === 'guild' ? 'var(--success)' : 'var(--accent)',
            color: !input.trim() || sending ? 'var(--text-mute)' : '#fff',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-xs)', fontWeight: 700,
            cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          {sending ? '..' : '>'}
        </button>
      </div>
    </div>
  );
}
