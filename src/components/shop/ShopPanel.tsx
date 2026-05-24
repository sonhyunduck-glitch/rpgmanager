/* =========================================================
   SHOP PANEL — 물약 / 무기 / 방어구 / 악세사리 / 판매
   ========================================================= */
import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { ShopTab } from '../../types';
import { PANEL_FULL, TAB_CONTAINER, tabStyle } from '../../styles/shared';
import PotionShop from './PotionShop';
import ScrollShop from './ScrollShop';
import EquipShop from './EquipShop';
import SellShop from './SellShop';
import ConsumableShop from './ConsumableShop';

type FullShopTab = ShopTab | 'sell';

const TABS: { key: FullShopTab; label: string }[] = [
  { key: 'potion', label: '물약' },
  { key: 'weapon', label: '무기' },
  { key: 'armor', label: '방어구' },
  { key: 'accessory', label: '악세사리' },
  { key: 'scroll', label: '주문서' },
  { key: 'consumable', label: '소비' },
  { key: 'sell', label: '판매' },
];

export default function ShopPanel() {
  const [tab, setTab] = useState<FullShopTab>('potion');
  const gold = useGameStore(s => s.gold);
  const potions = useGameStore(s => s.potions);
  const buyPotion = useGameStore(s => s.buyPotion);
  const playerClass = useGameStore(s => s.playerClass);
  const inventory = useGameStore(s => s.inventory);
  const inventoryCapacity = useGameStore(s => s.inventoryCapacity);
  const materials = useGameStore(s => s.materials);
  const sellFromInventory = useGameStore(s => s.sellFromInventory);
  const buyMaterial = useGameStore(s => s.buyMaterial);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--s-3)',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Header + Tabs */}
      <div style={{
        ...PANEL_FULL,
        gap: 'var(--s-3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 'var(--fs-md)' }}>상점</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-sm)',
            color: 'var(--accent)',
            fontWeight: 700,
          }}>
            {gold.toLocaleString()} G
          </span>
        </div>

        {/* Tabs */}
        <div style={TAB_CONTAINER}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={tabStyle(tab === t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {tab === 'potion' && (
            <PotionShop
              gold={gold}
              potions={potions}
              buyPotion={buyPotion}
              playerClass={playerClass}
            />
          )}
          {tab === 'scroll' && (
            <ScrollShop
              gold={gold}
              materials={materials}
              buyMaterial={buyMaterial}
            />
          )}
          {(tab === 'weapon' || tab === 'armor' || tab === 'accessory') && (
            <EquipShop
              tab={tab}
              gold={gold}
              inventory={inventory}
              inventoryCapacity={inventoryCapacity}
            />
          )}
          {tab === 'consumable' && (
            <ConsumableShop
              gold={gold}
              materials={materials}
              buyMaterial={buyMaterial}
            />
          )}
          {tab === 'sell' && (
            <SellShop
              inventory={inventory}
              sellFromInventory={sellFromInventory}
            />
          )}
        </div>
      </div>
    </div>
  );
}
