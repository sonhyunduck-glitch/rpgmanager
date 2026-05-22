/* =========================================================
   CHAT PANEL — 미니맵 하단 채팅 (Supabase Realtime)
   컴팩트 레이아웃: 헤더 + 메시지 스크롤 + 입력
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

const CHANNEL = 'global';
const MAX_MSG_LENGTH = 200;
const MAX_DISPLAY = 100;

/* ── 시간 포매터 ── */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/* ── 레벨 색상 ── */
function levelColor(lv: number): string {
  if (lv >= 50) return 'var(--danger)';
  if (lv >= 40) return 'oklch(0.65 0.18 45)';
  if (lv >= 30) return 'var(--accent)';
  if (lv >= 20) return 'var(--info)';
  if (lv >= 10) return 'var(--success)';
  return 'var(--text-mute)';
}

/* ── 메시지 라인 (컴팩트) ── */
function MessageLine({ msg, isMe }: { msg: ChatMessage; isMe: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '1px 0', alignItems: 'baseline' }}>
      <span style={{
        fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)', fontFamily: 'var(--font-mono)',
        flexShrink: 0,
      }}>
        {formatTime(msg.createdAt)}
      </span>
      <span style={{
        fontSize: 'var(--fs-2xs)', fontWeight: 700, fontFamily: 'var(--font-mono)',
        color: levelColor(msg.userLevel), flexShrink: 0,
      }}>
        {msg.userLevel}
      </span>
      <ClickableName
        userId={msg.userId}
        name={msg.userName}
        isMe={isMe}
        style={{
          fontSize: 'var(--fs-xs)', fontWeight: 700,
          color: isMe ? 'var(--accent)' : 'var(--info)',
          fontFamily: 'var(--font-display)',
          flexShrink: 0, whiteSpace: 'nowrap',
          maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      />
      {msg.guildName && (
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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // 초기 로드 + Realtime 구독 + 폴링 fallback
  useEffect(() => {
    let cancelled = false;

    // 초기 로드
    (async () => {
      const recent = await loadRecentMessages(CHANNEL, 50);
      if (!cancelled) { setMessages(recent); setLoaded(true); }
    })();

    // Realtime 구독 (Supabase publication 활성화 시 즉시 수신)
    const sub = subscribeToChannel(CHANNEL, (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        const next = [...prev, newMsg];
        return next.length > MAX_DISPLAY ? next.slice(-MAX_DISPLAY) : next;
      });
    });

    // 폴링 fallback (10초마다 새 메시지 확인 — Realtime 안 될 때 대비)
    const poll = setInterval(async () => {
      if (cancelled) return;
      const recent = await loadRecentMessages(CHANNEL, 50);
      if (!cancelled) {
        setMessages((prev) => {
          // 새 메시지가 있으면 병합 (id 기반 dedup)
          const ids = new Set(prev.map(m => m.id));
          const newOnes = recent.filter(m => !ids.has(m.id));
          if (newOnes.length === 0) return prev;
          const merged = [...prev, ...newOnes];
          return merged.length > MAX_DISPLAY ? merged.slice(-MAX_DISPLAY) : merged;
        });
      }
    }, 10_000);

    return () => { cancelled = true; unsubscribeChannel(sub); clearInterval(poll); };
  }, []);

  const lastId = messages.length > 0 ? messages[messages.length - 1].id : 0;
  useLayoutEffect(() => { scrollToBottom(); }, [lastId, scrollToBottom]);
  useLayoutEffect(() => { if (loaded) scrollToBottom(); }, [loaded, scrollToBottom]);

  // 전송
  const handleSend = async () => {
    const text = input.trim();
    if (!text || !userId || sending) return;
    if (text.length > MAX_MSG_LENGTH) return;

    setSending(true);
    setInput('');

    const sent = await sendMessage(CHANNEL, userId, playerName, level, null, text);
    if (sent) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        const next = [...prev, sent];
        return next.length > MAX_DISPLAY ? next.slice(-MAX_DISPLAY) : next;
      });
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
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--s-1)',
        flexShrink: 0, marginBottom: 'var(--s-1)',
      }}>
        <span style={{
          ...LABEL, fontSize: 'var(--fs-xs)', marginBottom: 0,
        }}>
          Chat
        </span>
        <span style={{
          fontSize: 'var(--fs-2xs)', fontFamily: 'var(--font-mono)', fontWeight: 700,
          color: 'var(--accent)', padding: '0 4px',
          borderRadius: 'var(--r-xs)',
          background: 'color-mix(in oklch, var(--accent) 10%, transparent)',
        }}>
          GLOBAL
        </span>
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
            첫 메시지를 보내보세요!
          </div>
        ) : (
          messages.map((msg) => (
            <MessageLine key={msg.id} msg={msg} isMe={msg.userId === userId} />
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
          placeholder="메시지..."
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
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
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
              : 'var(--accent)',
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
