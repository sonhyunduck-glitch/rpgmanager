import { useGameStore } from '../../store/gameStore';
import { LABEL, STAT_VALUE } from '../../styles/shared';

function formatKillTime(ms: number): string {
  if (ms <= 0) return '--';
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function CombatSummary() {
  const hunt = useGameStore((s) => s.hunt);

  const totalMaterials = Object.values(hunt.materialsGained ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--s-1) var(--s-3)',
        flexShrink: 0,
      }}
    >
      {/* Stat cards — compact horizontal row */}
      <div style={{ display: 'flex', gap: 'var(--s-2)', overflow: 'hidden' }}>
        <StatCard label="KILLS" value={hunt.kills} color="var(--text)" />
        <StatCard label="GOLD" value={hunt.goldGained.toLocaleString()} color="var(--accent)" />
        <StatCard label="MATS" value={totalMaterials} color="var(--info)" />
        <StatCard label="ITEMS" value={hunt.itemsFound} color="var(--success)" />
        <StatCard label="AVG" value={formatKillTime(hunt.avgKillTime ?? 0)} color="var(--text)" />
      </div>
    </div>
  );
}

/** Stat card — matches HuntZones zone card style */
function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: 'var(--bg-sunken)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-sm)',
        padding: '4px var(--s-2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
      }}
    >
      <span style={{ ...LABEL, fontSize: 'var(--fs-2xs)' }}>{label}</span>
      <span style={{ ...STAT_VALUE, fontSize: 'var(--fs-base)', color }}>{value}</span>
    </div>
  );
}
