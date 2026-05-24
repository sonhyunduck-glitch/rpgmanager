/* ── 소비 아이템 상점 (L1J etc_items 기반) ── */
import { useState, useMemo } from 'react';
import {
  SHOP_ETC_ITEMS,
  type ShopItemCategory,
  type ShopEtcItem,
} from '../../data/shopItemData';
import { LABEL, TAB_CONTAINER, tabStyle } from '../../styles/shared';

const CATEGORIES: { key: ShopItemCategory; label: string }[] = [
  { key: 'potion', label: '물약' },
  { key: 'scroll', label: '주문서' },
  { key: 'material', label: '재료' },
  { key: 'food', label: '음식' },
  { key: 'gem', label: '보석' },
];

/** 가격 포맷 (1000 이상: 1,000G) */
function fmtGold(n: number): string {
  return n >= 1000 ? n.toLocaleString() + 'G' : n + 'G';
}

export default function ConsumableShop({
  gold,
  materials,
  buyMaterial,
}: {
  gold: number;
  materials: Record<string, number>;
  buyMaterial: (id: string, qty: number, unitPrice: number) => void;
}) {
  const [category, setCategory] = useState<ShopItemCategory>('potion');

  const items = useMemo(() =>
    SHOP_ETC_ITEMS.filter(item => item.category === category),
    [category],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
      {/* 카테고리 탭 */}
      <div style={{
        ...TAB_CONTAINER,
        flexWrap: 'wrap',
      }}>
        {CATEGORIES.map(cat => {
          const count = SHOP_ETC_ITEMS.filter(i => i.category === cat.key).length;
          return (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              style={{
                ...tabStyle(category === cat.key),
                fontSize: 'var(--fs-xs)',
                padding: 'var(--s-1) var(--s-2)',
                flex: 'none',
              }}
            >
              {cat.label}
              <span style={{
                fontSize: 'var(--fs-2xs)',
                color: 'var(--text-mute)',
                marginLeft: 2,
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 아이템 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
        {items.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: 'var(--text-mute)',
            fontSize: 'var(--fs-sm)',
            padding: 'var(--s-6) 0',
          }}>
            이 카테고리에 아이템이 없습니다
          </div>
        )}

        {items.map(item => (
          <ConsumableRow
            key={item.id}
            item={item}
            gold={gold}
            owned={materials[item.id] ?? 0}
            buyMaterial={buyMaterial}
          />
        ))}
      </div>
    </div>
  );
}

function ConsumableRow({
  item,
  gold,
  owned,
  buyMaterial,
}: {
  item: ShopEtcItem;
  gold: number;
  owned: number;
  buyMaterial: (id: string, qty: number, unitPrice: number) => void;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--s-3)',
      padding: 'var(--s-3)',
      background: 'var(--bg-sunken)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-sm)',
    }}>
      {/* 이름 + 가격 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700,
          fontSize: 'var(--fs-sm)',
          color: 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {item.name}
        </div>
        <div style={{
          fontSize: 'var(--fs-2xs)',
          color: 'var(--text-mute)',
          marginTop: 1,
        }}>
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
}
