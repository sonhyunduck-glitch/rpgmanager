import { LABEL, STAT_VALUE } from '../../styles/shared';

interface StatBoxProps {
  label: string;
  value: number | string;
  color?: string;
}

export default function StatBox({ label, value, color = 'var(--text)' }: StatBoxProps) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-sm)',
        padding: 'var(--s-3)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-1)',
      }}
    >
      <div style={{ ...LABEL, fontSize: 9 }}>{label}</div>
      <div style={{ ...STAT_VALUE, fontSize: 22, color }}>{value}</div>
    </div>
  );
}
