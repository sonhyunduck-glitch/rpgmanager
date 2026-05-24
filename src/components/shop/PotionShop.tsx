/* ── 물약 상점 ── */
import { POTIONS, POTION_ORDER } from '../../data/gameData';
import { LABEL } from '../../styles/shared';
import type { PlayerClass } from '../../types';

const POTION_COLOR: Record<string, string> = {
  red_potion: '#ef5350',
  crimson_potion: '#ff7043',
  clear_potion: '#80cbc4',
  blue_potion: '#42a5f5',
  green_potion: '#66bb6a',
  courage_potion: '#ab47bc',
  elven_wafer: '#81c784',
  wisdom_potion: '#7986cb',
};

const CLASS_BADGE: Record<PlayerClass, string> = {
  knight: '⚔️',
  elf: '🏹',
  wizard: '🔮',
};

export default function PotionShop({
  gold, potions, buyPotion, playerClass,
}: {
  gold: number;
  potions: Record<string, number>;
  buyPotion: (id: string, qty: number) => void;
  playerClass: PlayerClass;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
      {POTION_ORDER.map(id => {
        const p = POTIONS[id];
        const owned = potions[id] ?? 0;
        const color = POTION_COLOR[id] ?? 'var(--text-dim)';
        // 클래스 제한 체크 (L1J: 용기=기사, 와퍼=요정, 지혜=마법사)
        const canUse = !p.classRestriction || p.classRestriction.includes(playerClass);
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
              opacity: canUse ? 1 : 0.4,
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
              <div style={{ fontWeight: 700, fontSize: 'var(--fs-base)', color, display: 'flex', alignItems: 'center', gap: 4 }}>
                {p.name}
                {/* 클래스 제한 뱃지 */}
                {p.classRestriction && (
                  <span style={{ fontSize: 'var(--fs-2xs)', opacity: 0.8 }}>
                    {p.classRestriction.map(c => CLASS_BADGE[c]).join('')}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-mute)', marginTop: 2 }}>
                {p.buffDuration ? (
                  <>
                    {p.id === 'blue_potion' ? 'MP 리젠 증가' : ''}
                    {p.atkSpeedMult && p.atkSpeedMult > 1 && `공속 ×${p.atkSpeedMult}`}
                    {p.moveSpeedMult && p.moveSpeedMult > 1 && ` 이속 ×${p.moveSpeedMult}`}
                    {p.spBonus ? `SP +${p.spBonus}` : ''}
                    {` (${p.buffDuration >= 60 ? `${Math.floor(p.buffDuration / 60)}분` : `${p.buffDuration}초`})`}
                    {!canUse && ' (사용 불가)'}
                  </>
                ) : (
                  <>HP {p.healMin}~{p.healMax} 회복</>
                )}
              </div>
            </div>

            {/* 보유 수량 */}
            <div style={{ textAlign: 'center', minWidth: 40 }}>
              <div style={{ ...LABEL, fontSize: 'var(--fs-2xs)' }}>보유</div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                fontSize: 'var(--fs-base)',
                color: owned > 0 ? 'var(--text)' : 'var(--text-mute)',
              }}>
                {owned}
              </div>
            </div>

            {/* 구매 버튼들 */}
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {[1, 10, 50].map(qty => {
                const cost = p.buyPrice * qty;
                const canBuy = gold >= cost && canUse;
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
                      fontSize: 'var(--fs-xs)',
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
                    <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)' }}>
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
