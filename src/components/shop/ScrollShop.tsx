/* ── 주문서 상점 ── */
import { MATERIALS } from '../../data/gameData';
import { LABEL } from '../../styles/shared';

const SCROLL_SHOP_ITEMS: { id: string; price: number }[] = [
  { id: 'weapon_scroll', price: 75000 },
  { id: 'blessed_weapon_scroll', price: 150000 },
  { id: 'cursed_weapon_scroll', price: 15000 },
  { id: 'armor_scroll', price: 31000 },
  { id: 'blessed_armor_scroll', price: 62000 },
  { id: 'cursed_armor_scroll', price: 6200 },
];

const SCROLL_COLORS: Record<string, string> = {
  weapon_scroll: 'var(--text)',
  blessed_weapon_scroll: '#F5C518',
  cursed_weapon_scroll: 'var(--danger)',
  armor_scroll: 'var(--text)',
  blessed_armor_scroll: '#F5C518',
  cursed_armor_scroll: 'var(--danger)',
};

const SCROLL_GLOW: Record<string, string | undefined> = {
  blessed_weapon_scroll: '0 0 6px rgba(245,197,24,0.6), 0 0 14px rgba(245,197,24,0.3)',
  blessed_armor_scroll: '0 0 6px rgba(245,197,24,0.6), 0 0 14px rgba(245,197,24,0.3)',
};

const GROUPS = [
  { label: '무기 주문서', ids: ['weapon_scroll', 'blessed_weapon_scroll', 'cursed_weapon_scroll'] },
  { label: '방어구 주문서', ids: ['armor_scroll', 'blessed_armor_scroll', 'cursed_armor_scroll'] },
];

export default function ScrollShop({
  gold, materials, buyMaterial,
}: {
  gold: number;
  materials: Record<string, number>;
  buyMaterial: (id: string, qty: number, unitPrice: number) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
      {GROUPS.map(group => (
        <div key={group.label}>
          <div style={{
            ...LABEL,
            fontSize: 'var(--fs-xs)',
            marginBottom: 'var(--s-2)',
            paddingBottom: 'var(--s-1)',
            borderBottom: '1px solid var(--border-soft)',
          }}>
            {group.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
            {group.ids.map(id => {
              const item = SCROLL_SHOP_ITEMS.find(s => s.id === id);
              if (!item) return null;
              const mat = MATERIALS[id];
              if (!mat) return null;
              const owned = materials[id] ?? 0;
              const color = SCROLL_COLORS[id] ?? 'var(--text)';

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
                  {/* 이름 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color, textShadow: SCROLL_GLOW[id] }}>
                      {mat.name}
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
                      const cost = item.price * qty;
                      const canBuy = gold >= cost;
                      return (
                        <button
                          key={qty}
                          onClick={() => canBuy && buyMaterial(id, qty, item.price)}
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
        </div>
      ))}
    </div>
  );
}
