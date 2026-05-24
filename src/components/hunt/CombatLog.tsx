import { useLayoutEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { LogEntry } from '../../types';

/* ── 탭 정의 ── */
type LogTab = 'combat' | 'skill' | 'loot';

/** 전투 탭: 발견 + 처치 + 진입/클리어 + 피격/회피/사망 */
const COMBAT_FILTER = (e: LogEntry) =>
  e.type === 'encounter' || e.type === 'kill' || e.type === 'enter'
  || (e.type === 'crit' && e.text.includes('처치'))
  || e.type === 'hit_taken' || e.type === 'miss' || e.type === 'death'
  || e.type === 'join';

/** 스킬 탭: 스킬 시전 + 무기 특수스킬 + 물약/버프 */
const SKILL_FILTER = (e: LogEntry) =>
  e.type === 'skill' || e.type === 'battle' || e.type === 'potion';

/** 획득 탭: 아이템 획득만 */
const LOOT_FILTER = (e: LogEntry) =>
  e.type === 'loot' || e.type === 'find';

/* ── 태그 색상 ── */
const TAG_COLORS: Partial<Record<LogEntry['type'], string>> = {
  encounter: 'var(--info)',
  kill: 'var(--success)',
  crit: 'var(--success)',
  loot: 'oklch(0.65 0.18 85)',
  find: 'var(--accent)',
  skill: 'oklch(0.65 0.20 300)',
  battle: 'oklch(0.60 0.18 30)',
  potion: 'oklch(0.70 0.16 150)',
  hit_taken: 'oklch(0.60 0.22 25)',
  miss: 'var(--text-mute)',
  death: 'oklch(0.55 0.25 15)',
  join: 'oklch(0.60 0.15 60)',
};

const TAG_LABELS: Partial<Record<LogEntry['type'], string>> = {
  encounter: '발견',
  kill: '처치',
  crit: '처치',
  loot: '획득',
  find: '장비',
  skill: '스킬',
  battle: '발동',
  potion: '버프',
  hit_taken: '피격',
  miss: '회피',
  death: '사망',
  join: '합류',
};

/* ── 로그 라인 ── */
function LogLine({ entry }: { entry: LogEntry }) {
  const color = TAG_COLORS[entry.type];
  const tag = TAG_LABELS[entry.type];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--s-2)',
        padding: '1px 0',
        fontSize: 'var(--fs-sm)',
        fontFamily: 'var(--font-mono)',
        lineHeight: 1.4,
      }}
    >
      <span
        style={{
          fontSize: 'var(--fs-xs)',
          fontWeight: 700,
          color: 'var(--bg-canvas)',
          background: color,
          padding: '1px 5px',
          borderRadius: 'var(--r-xs)',
          flexShrink: 0,
          letterSpacing: '0.06em',
          marginTop: 2,
        }}
      >
        {tag}
      </span>
      <span style={{ color: 'var(--text-dim)', flex: 1 }}>{entry.text}</span>
      <span
        style={{
          fontSize: 'var(--fs-xs)',
          color: 'var(--text-mute)',
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {formatTime(entry.timestamp)}
      </span>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/* ── 메인 컴포넌트 ── */
export default function CombatLog() {
  const combatLog = useGameStore((s) => s.combatLog);
  const [tab, setTab] = useState<LogTab>('combat');
  const scrollRef = useRef<HTMLDivElement>(null);

  const filterFn = tab === 'combat' ? COMBAT_FILTER : tab === 'skill' ? SKILL_FILTER : LOOT_FILTER;
  const filtered = combatLog.filter(filterFn);

  const lastId = filtered.length > 0 ? filtered[filtered.length - 1].id : '';
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  return (
    <div
      style={{
        background: 'var(--bg-log, var(--bg-canvas))',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-md)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Header + Tabs */}
      <div
        style={{
          padding: '0 var(--s-3)',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--s-1)',
          flexShrink: 0,
        }}
      >
        <TabBtn active={tab === 'combat'} onClick={() => setTab('combat')}>
          Combat
        </TabBtn>
        <TabBtn active={tab === 'skill'} onClick={() => setTab('skill')}>
          Skill
        </TabBtn>
        <TabBtn active={tab === 'loot'} onClick={() => setTab('loot')}>
          Loot
        </TabBtn>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--text-mute)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {filtered.length}
        </span>
      </div>

      {/* Scrollable log */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--s-2) var(--s-3)',
          scrollBehavior: 'smooth',
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-mute)',
              fontSize: 'var(--fs-sm)',
              fontStyle: 'italic',
              padding: 'var(--s-6)',
            }}
          >
            {tab === 'combat' ? 'No combat activity yet.' : tab === 'skill' ? 'No skill activity yet.' : 'No loot yet.'}
          </div>
        ) : (
          filtered.map((entry) => <LogLine key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}

/* ── 탭 버튼 ── */
function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        padding: '5px 8px 4px',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-xs)',
        fontWeight: active ? 700 : 500,
        color: active ? 'var(--accent)' : 'var(--text-mute)',
        cursor: 'pointer',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        transition: 'all 0.15s ease',
      }}
    >
      {children}
    </button>
  );
}
