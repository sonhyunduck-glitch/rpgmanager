/* =========================================================
   MINI CHAT FEED — 모바일 사냥 화면 오버레이 채팅
   디자인 핸드오프: 사냥-모바일.html 기반

   구조:
     ├─ chat-feed  (좌하단 플로팅 메시지, pointer-events:none)
     ├─ chat-toggle (⌨ 토글 버튼 + 뱃지)
     └─ mini-input  (토글 시 하단 입력 바)

   ChatPanel과 독립 — 모바일 사냥 모드에서만 마운트됨.
   global 채널 구독 + 최근 5건 표시.
   ========================================================= */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import {
  loadRecentMessages,
  sendMessage,
  subscribeToChannel,
  unsubscribeChannel,
} from '../../lib/chat';
import type { ChatMessage } from '../../types';

const FEED_MAX = 5;
const MAX_MSG_LEN = 200;
const textShadow = '0 0 3px rgba(0,0,0,0.95)';

export default function MiniChatFeed() {
  const userId     = useGameStore(s => s.authUserId);
  const playerName = useGameStore(s => s.playerName);
  const level      = useGameStore(s => s.level);
  const guildName  = useGameStore(s => s.guildName);

  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [input, setInput]         = useState('');
  const [sending, setSending]     = useState(false);
  const [newCount, setNewCount]   = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const initDone = useRef(false);

  /* ── dedup + cap ── */
  const addMsg = useCallback((msg: ChatMessage) => {
    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev;
      return [...prev, msg].slice(-FEED_MAX);
    });
    if (initDone.current) setNewCount(c => c + 1);
  }, []);

  /* ── global 구독 ── */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const recent = await loadRecentMessages('global', FEED_MAX);
      if (!cancelled) {
        setMessages(recent.slice(-FEED_MAX));
        initDone.current = true;
      }
    })();

    const sub = subscribeToChannel('global', addMsg);
    return () => { cancelled = true; unsubscribeChannel(sub); };
  }, [addMsg]);

  /* ── focus input ── */
  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  /* ── 전송 ── */
  const handleSend = async () => {
    const text = input.trim();
    if (!text || !userId || sending) return;

    setSending(true);
    setInput('');

    const sent = await sendMessage('global', userId, playerName, level, guildName ?? null, text);
    if (sent) addMsg(sent);
    else setInput(text);

    setSending(false);
    inputRef.current?.focus();
  };

  const handleToggle = () => {
    setShowInput(o => !o);
    setNewCount(0);
  };

  return (
    <>
      {/* ── 플로팅 채팅 피드 (최근 메시지, 읽기 전용) ── */}
      <div style={{
        position: 'absolute',
        left: 8, bottom: 116,
        maxWidth: '55%',
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        {messages.map(msg => (
          <div key={msg.id} style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            textShadow,
            marginBottom: 2,
            opacity: 0.85,
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            <span style={{
              color: msg.guildName ? 'oklch(0.68 0.20 305)' : 'var(--info)',
              fontWeight: 700,
            }}>
              {msg.userName}:
            </span>{' '}
            <span style={{ color: 'var(--text-dim)' }}>
              {msg.text}
            </span>
          </div>
        ))}
      </div>

      {/* ── 채팅 토글 버튼 ── */}
      <button
        onClick={handleToggle}
        style={{
          position: 'absolute',
          left: 8, bottom: 70,
          zIndex: 10,
          width: 36, height: 36,
          background: 'rgba(0,0,0,0.55)',
          border: `1px solid ${showInput ? 'var(--accent)' : 'var(--border-soft)'}`,
          borderRadius: '50%',
          display: 'grid', placeItems: 'center',
          color: showInput ? 'var(--accent)' : 'var(--text-dim)',
          fontSize: 14,
          cursor: 'pointer',
          padding: 0,
          backdropFilter: 'blur(6px)',
        }}
        title="채팅"
      >
        ⌨
        {newCount > 0 && !showInput && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            width: 16, height: 16,
            background: 'var(--danger)',
            color: '#fff',
            borderRadius: '50%',
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
            display: 'grid', placeItems: 'center',
          }}>
            {newCount > 9 ? '9+' : newCount}
          </span>
        )}
      </button>

      {/* ── 미니 입력 바 (토글 시 표시) ── */}
      {showInput && (
        <div style={{
          position: 'absolute',
          left: 0, right: 0, bottom: 60,
          zIndex: 11,
          padding: '0 10px',
        }}>
          <div style={{
            display: 'flex', gap: 6, alignItems: 'center',
            background: 'rgba(0,0,0,0.8)',
            border: '1px solid var(--border-soft)',
            borderRadius: 20,
            padding: '6px 8px 6px 14px',
            backdropFilter: 'blur(8px)',
          }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value.slice(0, MAX_MSG_LEN))}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="메시지..."
              maxLength={MAX_MSG_LEN}
              style={{
                flex: 1, minWidth: 0,
                fontSize: 11,
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
                background: 'transparent',
                border: 'none', outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              style={{
                width: 28, height: 24,
                background: input.trim() && !sending ? 'var(--accent)' : 'var(--bg-sunken)',
                border: '1px solid var(--border-soft)',
                borderRadius: 12,
                color: input.trim() && !sending ? '#000' : 'var(--text-mute)',
                display: 'grid', placeItems: 'center',
                cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 13,
                padding: 0, flexShrink: 0,
              }}
            >
              ›
            </button>
          </div>
        </div>
      )}
    </>
  );
}
