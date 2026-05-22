/* =========================================================
   HP 물약 설정 모달
   ========================================================= */
import { useGameStore } from '../../store/gameStore';
import { POTIONS } from '../../data/gameData';

/* ── 색상 ── */
const POTION_COLORS: Record<string, string> = {
  red_potion: '#ef5350',
  crimson_potion: '#ff7043',
  clear_potion: '#42a5f5',
};

const HEAL_POTIONS = ['red_potion', 'crimson_potion', 'clear_potion'] as const;
const THRESHOLDS = [30, 50, 70];

export default function HpPotionModal({ onClose }: { onClose: () => void }) {
  const potions = useGameStore((s) => s.potions);
  const selectedPotionId = useGameStore((s) => s.selectedPotionId);
  const potionAutoUse = useGameStore((s) => s.potionAutoUse);
  const potionAutoThreshold = useGameStore((s) => s.potionAutoThreshold);
  const potionAutoBuy = useGameStore((s) => s.potionAutoBuy);
  const setSelectedPotion = useGameStore((s) => s.setSelectedPotion);
  const togglePotionAutoUse = useGameStore((s) => s.togglePotionAutoUse);
  const setPotionAutoThreshold = useGameStore((s) => s.setPotionAutoThreshold);
  const togglePotionAutoBuy = useGameStore((s) => s.togglePotionAutoBuy);

  return (
    <>
      {/* 오버레이 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 999,
        }}
      />
      {/* 모달 */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-soft)',
          borderRadius: 'var(--r-md)',
          padding: 'var(--s-4)',
          zIndex: 1000,
          minWidth: 280,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
      >
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 'var(--s-3)',
        }}>
          <span style={{
            fontSize: 'var(--fs-base)', fontWeight: 700,
            fontFamily: 'var(--font-display)', color: 'var(--text)',
          }}>
            체력회복제 설정
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-mute)', fontSize: 'var(--fs-md)',
              cursor: 'pointer', padding: '2px 6px',
            }}
          >
            X
          </button>
        </div>

        {/* 물약 선택 */}
        <div style={{
          display: 'flex', gap: 'var(--s-2)', marginBottom: 'var(--s-3)',
        }}>
          {HEAL_POTIONS.map((id) => {
            const p = POTIONS[id];
            const count = potions[id] ?? 0;
            const color = POTION_COLORS[id];
            const selected = selectedPotionId === id;
            return (
              <button
                key={id}
                onClick={() => setSelectedPotion(id)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: 'var(--r-sm)',
                  border: selected
                    ? `2px solid ${color}`
                    : '1px solid var(--border-soft)',
                  background: selected
                    ? `color-mix(in oklch, ${color} 15%, var(--bg-panel))`
                    : 'var(--bg-panel)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: color,
                  boxShadow: selected ? `0 0 8px ${color}` : 'none',
                }} />
                <span style={{
                  fontSize: 'var(--fs-xs)', fontWeight: 700, color,
                  fontFamily: 'var(--font-mono)',
                }}>
                  {p.name}
                </span>
                <span style={{
                  fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-mono)',
                  color: count > 0 ? 'var(--text-dim)' : 'var(--danger)',
                  fontWeight: 700,
                }}>
                  x{count}
                </span>
                <span style={{
                  fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  HP {p.healMin}~{p.healMax}
                </span>
              </button>
            );
          })}
        </div>

        {/* 자동사용 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
          marginBottom: 'var(--s-2)',
          padding: '8px 12px',
          background: 'var(--bg-panel)',
          borderRadius: 'var(--r-sm)',
          border: '1px solid var(--border-soft)',
        }}>
          <span style={{
            fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-dim)',
            flex: 1,
          }}>
            자동 사용
          </span>
          <button
            onClick={togglePotionAutoUse}
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--r-xs)',
              border: potionAutoUse
                ? '1px solid var(--success)'
                : '1px solid var(--border-soft)',
              background: potionAutoUse
                ? 'color-mix(in oklch, var(--success) 15%, transparent)'
                : 'var(--bg-sunken)',
              color: potionAutoUse ? 'var(--success)' : 'var(--text-mute)',
              fontSize: 'var(--fs-xs)', fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
            }}
          >
            {potionAutoUse ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* 임계값 */}
        {potionAutoUse && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
            marginBottom: 'var(--s-2)',
            padding: '8px 12px',
            background: 'var(--bg-panel)',
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--border-soft)',
          }}>
            <span style={{
              fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-dim)',
              flex: 1,
            }}>
              HP 임계값
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {THRESHOLDS.map((t) => (
                <button
                  key={t}
                  onClick={() => setPotionAutoThreshold(t)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 'var(--r-xs)',
                    border: potionAutoThreshold === t
                      ? '1px solid var(--warning)'
                      : '1px solid var(--border-soft)',
                    background: potionAutoThreshold === t
                      ? 'color-mix(in oklch, var(--warning) 15%, transparent)'
                      : 'var(--bg-sunken)',
                    color: potionAutoThreshold === t ? 'var(--warning)' : 'var(--text-mute)',
                    fontSize: 'var(--fs-xs)', fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                  }}
                >
                  {t}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 자동구매 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
          padding: '8px 12px',
          background: 'var(--bg-panel)',
          borderRadius: 'var(--r-sm)',
          border: '1px solid var(--border-soft)',
        }}>
          <span style={{
            fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-dim)',
            flex: 1,
          }}>
            자동 구매
          </span>
          <button
            onClick={togglePotionAutoBuy}
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--r-xs)',
              border: potionAutoBuy
                ? '1px solid var(--accent)'
                : '1px solid var(--border-soft)',
              background: potionAutoBuy
                ? 'color-mix(in oklch, var(--accent) 15%, transparent)'
                : 'var(--bg-sunken)',
              color: potionAutoBuy ? 'var(--accent)' : 'var(--text-mute)',
              fontSize: 'var(--fs-xs)', fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
            }}
          >
            {potionAutoBuy ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    </>
  );
}
