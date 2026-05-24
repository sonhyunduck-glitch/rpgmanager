/* ══════════════════════════════════════════════════════════
   Equipment Card — 장비 카드
   ══════════════════════════════════════════════════════════ */
import { equipDisplayName } from '../../store/gameStore';
import { EQUIPMENT_TEMPLATES } from '../../data/gameData';
import type { Equipment, PlayerClass } from '../../types';

/** 클래스 뱃지 표시용 */
const CLASS_BADGE: Record<PlayerClass, { icon: string; label: string }> = {
  knight: { icon: '⚔️', label: '기사' },
  elf:    { icon: '🏹', label: '요정' },
  wizard: { icon: '🔮', label: '마법사' },
};

export default function EquipCard({
  eq, isEquipped, isSelected, onSelect, onAction, actionLabel, actionStyle,
}: {
  eq: Equipment;
  isEquipped: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onAction: () => void;
  actionLabel: string;
  actionStyle: 'success' | 'ghost';
}) {
  const isWpn = eq.type === 'weapon' || eq.type === 'bow' || eq.type === 'staff';
  const enh = eq.enhanceLevel;

  return (
    <div
      onClick={onSelect}
      style={{
        background: isSelected
          ? 'radial-gradient(ellipse at 50% 0%, color-mix(in oklch, var(--accent) 12%, var(--bg-panel)), var(--bg-panel))'
          : 'var(--bg-panel)',
        border: isSelected
          ? '2px solid var(--accent)'
          : '1px solid var(--border-soft)',
        borderRadius: 'var(--r-sm)',
        padding: 'var(--s-3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-1)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, background 0.15s ease',
      }}
    >

      {/* Equipped badge */}
      {isEquipped && (
        <span style={{
          position: 'absolute',
          top: 6,
          left: 6,
          fontSize: '8px',
          padding: '1px 5px',
          borderRadius: 'var(--r-full)',
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          fontWeight: 700,
        }}>
          착용
        </span>
      )}

      {/* Name */}
      <div style={{
        color: 'var(--text)',
        fontWeight: 700,
        fontSize: 'var(--fs-sm)',
        lineHeight: 1.3,
        paddingRight: 'var(--s-6)',
        marginTop: isEquipped ? 16 : 0,
      }}>
        {equipDisplayName(eq)}
      </div>

      {/* Stat — Lineage style */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-xs)',
        color: 'var(--text-dim)',
      }}>
        {isWpn
          ? <>타격 {eq.baseAtk}/{eq.baseAtkLarge}{enh > 0 && <span style={{ color: 'var(--success)' }}> (+{enh})</span>}{eq.isTwoHanded && <span style={{ color: 'var(--accent)', marginLeft: 4 }}>양손</span>}</>
          : <>AC {eq.baseDef}<span style={{ color: enh > 0 ? 'var(--success)' : 'var(--text-mute)' }}>+{enh}</span></>
        }
      </div>

      {/* Class restriction badges */}
      {(() => {
        const t = EQUIPMENT_TEMPLATES[eq.templateId];
        const cr = t?.classRestriction;
        if (!cr || cr.length === 0) return null;
        return (
          <div style={{ display: 'flex', gap: 3, fontSize: '10px' }}>
            {cr.map(cls => {
              const b = CLASS_BADGE[cls];
              return (
                <span
                  key={cls}
                  style={{
                    padding: '0 4px',
                    borderRadius: 'var(--r-xs)',
                    background: 'color-mix(in oklch, var(--text-mute) 8%, transparent)',
                    color: 'var(--text-mute)',
                    lineHeight: '16px',
                  }}
                >
                  {b.icon}{b.label}
                </span>
              );
            })}
          </div>
        );
      })()}

      {/* Bonus */}
      {eq.bonusEffects.length > 0 && (
        <div style={{ fontSize: '10px', color: 'var(--info)' }}>
          {eq.bonusEffects.join(' / ')}
        </div>
      )}

      {/* Action button */}
      <div style={{ marginTop: 'var(--s-1)' }}>
        <button
          onClick={e => { e.stopPropagation(); onAction(); }}
          style={{
            width: '100%',
            padding: '5px 0',
            border: actionStyle === 'ghost' ? '1px solid var(--border)' : 'none',
            borderRadius: 'var(--r-xs)',
            background: actionStyle === 'success'
              ? 'linear-gradient(135deg, var(--success), oklch(0.66 0.16 135))'
              : 'transparent',
            color: actionStyle === 'success' ? '#fff' : 'var(--text-dim)',
            fontFamily: 'var(--font-ui)',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
