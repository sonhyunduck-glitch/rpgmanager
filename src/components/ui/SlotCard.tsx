import { LABEL, STAT_VALUE } from '../../styles/shared';
import { equipDisplayName } from '../../store/gameStore';
import type { Equipment } from '../../types';

interface SlotCardProps {
  label: string;
  equipment: Equipment | null;
}

export default function SlotCard({ label, equipment }: SlotCardProps) {
  if (!equipment) {
    return (
      <div
        style={{
          background: 'var(--bg-panel)',
          border: '2px dashed var(--border-soft)',
          borderRadius: 'var(--r-md)',
          padding: 'var(--s-3)',
          textAlign: 'center',
        }}
      >
        <div style={LABEL}>{label}</div>
        <div
          style={{
            color: 'var(--text-mute)',
            fontSize: 12,
            marginTop: 'var(--s-2)',
            fontStyle: 'italic',
          }}
        >
          비어있음
        </div>
      </div>
    );
  }

  const color = 'var(--text)';
  const displayName = equipDisplayName(equipment);
  const isWeapon = equipment.type === 'weapon';
  const enchant = equipment.enhanceLevel;

  return (
    <div
      style={{
        '--rar': color,
        background: 'var(--bg-panel)',
        border: `1px solid ${color}`,
        borderRadius: 'var(--r-md)',
        padding: 'var(--s-3)',
        boxShadow: `0 0 8px color-mix(in oklch, ${color} 25%, transparent)`,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-1)',
      } as React.CSSProperties}
    >
      <div style={{ ...LABEL, fontSize: 9, color: 'var(--text-mute)' }}>{label}</div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: color,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {displayName}
      </div>

      {/* Weapon: 타격치 소/대 (+강화) */}
      {isWeapon ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ ...LABEL, fontSize: 9 }}>타격치</span>
            <span style={{ ...STAT_VALUE, fontSize: 12, color: 'var(--text)' }}>
              {equipment.baseAtk}/{equipment.baseAtkLarge}
              {enchant > 0 && (
                <span style={{ color: 'var(--success)', fontSize: 11, marginLeft: 4 }}>(+{enchant})</span>
              )}
            </span>
          </div>
        </div>
      ) : (
        /* Armor: AC 기본+강화 */
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ ...LABEL, fontSize: 9 }}>AC</span>
          <span style={{ ...STAT_VALUE, fontSize: 13, color: 'var(--text)' }}>
            {equipment.baseDef}
            <span style={{ color: enchant > 0 ? 'var(--success)' : 'var(--text-mute)' }}>+{enchant}</span>
          </span>
        </div>
      )}

      {equipment.bonusEffects && equipment.bonusEffects.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
          {equipment.bonusEffects.map((effect, i) => (
            <span
              key={i}
              style={{
                fontSize: 9,
                color: 'var(--accent)',
                background: 'color-mix(in oklch, var(--accent) 10%, transparent)',
                padding: '1px 5px',
                borderRadius: 999,
              }}
            >
              {effect}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
