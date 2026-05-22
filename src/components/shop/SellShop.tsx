/* ── 판매 상점 ── */
import { equipDisplayName } from '../../store/gameStore';
import type { Equipment } from '../../types';

export default function SellShop({
  inventory, sellFromInventory,
}: {
  inventory: Equipment[];
  sellFromInventory: (uid: string) => void;
}) {
  if (inventory.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: 'var(--s-6)',
        color: 'var(--text-mute)',
        fontSize: 'var(--fs-sm)',
      }}>
        판매할 장비가 없습니다
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
      {inventory.map(eq => {
        const isWpn = eq.type === 'weapon';

        return (
          <div
            key={eq.uid}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--s-3)',
              padding: 'var(--s-2) var(--s-3)',
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)',
            }}
          >
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 700, fontSize: 12,
                color: 'var(--text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {equipDisplayName(eq)}
              </div>
              <div style={{
                display: 'flex', gap: 8, marginTop: 2,
                fontSize: 10, color: 'var(--text-mute)',
                fontFamily: 'var(--font-mono)',
              }}>
                <span>{isWpn ? `타격 ${eq.baseAtk}/${eq.baseAtkLarge}` : `AC ${eq.baseDef}+${eq.enhanceLevel}`}{eq.enhanceLevel > 0 && eq.type === 'weapon' && ` (+${eq.enhanceLevel})`}</span>
              </div>
              {eq.bonusEffects.length > 0 && (
                <div style={{
                  display: 'flex', gap: 6, marginTop: 2,
                  fontSize: 9, color: 'var(--info)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {eq.bonusEffects.map((eff, i) => (
                    <span key={i}>{eff.replace(' (미구현)', '')}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Sell button */}
            <button
              onClick={() => sellFromInventory(eq.uid)}
              style={{
                padding: '5px 10px',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--danger)',
                background: 'color-mix(in oklch, var(--danger) 10%, transparent)',
                color: 'var(--danger)',
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {eq.sellPrice.toLocaleString()}G 판매
            </button>
          </div>
        );
      })}
    </div>
  );
}
