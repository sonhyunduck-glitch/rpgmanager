/* ── 물약 상점 ── */
import { POTIONS, POTION_ORDER } from '../../data/gameData';
import { LABEL } from '../../styles/shared';

const POTION_COLOR: Record<string, string> = {
  red_potion: '#ef5350',
  crimson_potion: '#ff7043',
  clear_potion: '#42a5f5',
  green_potion: '#66bb6a',
  courage_potion: '#ab47bc',
};

export default function PotionShop({
  gold, potions, buyPotion,
}: {
  gold: number;
  potions: Record<string, number>;
  buyPotion: (id: string, qty: number) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
      {POTION_ORDER.map(id => {
        const p = POTIONS[id];
        const owned = potions[id] ?? 0;
        const color = POTION_COLOR[id] ?? 'var(--text-dim)';
        return (
          <div
            key={id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--s-3)',
              padding: 'var(--s-3)',
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)',
            }}
          >
            {/* 물약 아이콘 */}
            <div style={{
              width: 32, height: 32,
              borderRadius: 'var(--r-sm)',
              background: `color-mix(in oklch, ${color} 15%, transparent)`,
              border: `1px solid color-mix(in oklch, ${color} 30%, transparent)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: color,
                boxShadow: `0 0 6px ${color}`,
              }} />
            </div>

            {/* 정보 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color }}>
                {p.name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 2 }}>
                {p.buffDuration ? (
                  <>
                    {p.atkSpeedMult && p.atkSpeedMult > 1 && `공속 ×${p.atkSpeedMult}`}
                    {p.moveSpeedMult && p.moveSpeedMult > 1 && ` 이속 ×${p.moveSpeedMult}`}
                    {` (${p.buffDuration}초)`}
                  </>
                ) : (
                  <>HP {p.healMin}~{p.healMax} 회복</>
                )}
                {/* 레벨 제한 없음 */}
              </div>
            </div>

            {/* 보유 수량 */}
            <div style={{ textAlign: 'center', minWidth: 40 }}>
              <div style={{ ...LABEL, fontSize: 7 }}>보유</div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                fontSize: 14,
                color: owned > 0 ? 'var(--text)' : 'var(--text-mute)',
              }}>
                {owned}
              </div>
            </div>

            {/* 구매 버튼들 */}
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {[1, 10, 50].map(qty => {
                const cost = p.buyPrice * qty;
                const canBuy = gold >= cost;
                return (
                  <button
                    key={qty}
                    onClick={() => canBuy && buyPotion(id, qty)}
                    disabled={!canBuy}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 'var(--r-xs)',
                      border: '1px solid var(--border-soft)',
                      background: canBuy ? 'var(--bg-panel)' : 'var(--bg-sunken)',
                      color: canBuy ? 'var(--accent)' : 'var(--text-mute)',
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      cursor: canBuy ? 'pointer' : 'not-allowed',
                      opacity: canBuy ? 1 : 0.5,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <span>+{qty}</span>
                    <span style={{ fontSize: 8, color: 'var(--text-mute)' }}>
                      {cost}G
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
