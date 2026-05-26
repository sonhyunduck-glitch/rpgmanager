/* =========================================================
   HUNT METRICS — 미니맵 좌측 하단 오버레이 (KILLS/GOLD/XP/AVG)
   디자인: hunt-app.jsx 핸드오프 기반 (.metrics)
   ========================================================= */
import { useGameStore } from '../../store/gameStore';

export default function HuntMetrics() {
  const hunt = useGameStore(s => s.hunt);
  const isActive = hunt.status !== 'idle';

  if (!isActive) return null;

  const kills = hunt.kills;
  const gold = hunt.goldGained;
  const avgKillTime = hunt.avgKillTime > 0 ? (hunt.avgKillTime / 1000).toFixed(1) + 's' : '--';
  const items = hunt.itemsFound;

  // 사냥 시간 (분)
  const elapsed = hunt.startedAt > 0
    ? Math.max(1, Math.floor((Date.now() - hunt.startedAt) / 60000))
    : 0;

  return (
    <div style={{
      position: 'absolute',
      bottom: 8,
      left: 8,
      display: 'flex',
      gap: 10,
      padding: '6px 10px',
      background: 'rgba(17, 21, 28, 0.85)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-sm)',
      backdropFilter: 'blur(8px)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-xs)',
      zIndex: 10,
      pointerEvents: 'none',
    }}>
      <Metric label="KILLS" value={kills.toLocaleString()} color="var(--accent)" />
      <Metric label="GOLD" value={`+${formatNum(gold)}`} color="var(--success)" />
      <Metric label="AVG" value={avgKillTime} />
      <Metric label="ITEMS" value={String(items)} color={items > 0 ? 'var(--info)' : undefined} />
      {elapsed > 0 && <Metric label="TIME" value={`${elapsed}m`} />}
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{
        color: 'var(--text-mute)',
        fontSize: 8,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>{label}</span>
      <span style={{
        color: color ?? 'var(--text)',
        fontWeight: 600,
        fontSize: 'var(--fs-sm)',
      }}>{value}</span>
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return n.toLocaleString();
}
