/* ── 재료 상점 ── */
import { SHOP_ETC_ITEMS } from '../../data/shopItemData';
import { LABEL } from '../../styles/shared';

function fmtGold(n: number): string {
  return n >= 1000 ? n.toLocaleString() + 'G' : n + 'G';
}

export default function MaterialShop({
  gold, materials, buyMaterial,
}: {
  gold: number;
  materials: Record<string, number>;
  buyMaterial: (id: string, qty: number, unitPrice: number) => void;
}) {
  const items = SHOP_ETC_ITEMS.filter(i => i.category === 'material');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
      {items.map(item => {
        const owned = materials[item.id] ?? 0;
        return (
          <div
            key={item.id}
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
            {/* 이름 + 가격 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--text)' }}>
                {item.name}
              </div>
              <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)', marginTop: 1 }}>
                구매 {fmtGold(item.buyPrice)}
                {item.sellPrice > 0 && ` · 판매 ${fmtGold(item.sellPrice)}`}
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
                const cost = item.buyPrice * qty;
                const canBuy = gold >= cost;
                return (
                  <button
                    key={qty}
                    onClick={() => canBuy && buyMaterial(item.id, qty, item.buyPrice)}
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
                      {fmtGold(cost)}
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
