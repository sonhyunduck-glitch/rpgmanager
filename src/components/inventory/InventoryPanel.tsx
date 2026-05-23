/* =========================================================
   INVENTORY PANEL — 인벤토리 (착용 장비 + 가방 + 강화)
   ========================================================= */
import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { Equipment } from '../../types';
import { MATERIALS } from '../../data/gameData';
import { LABEL, PANEL_FULL, chipStyle } from '../../styles/shared';
import EnhanceSidebar from './EnhanceSidebar';
import EquipCard from './EquipCard';

type FilterMode = 'all' | 'weapon' | 'defense' | 'material';

/* ============================== COMPONENT ============================== */
export default function InventoryPanel() {
  const inventory = useGameStore(s => s.inventory);
  const inventoryCapacity = useGameStore(s => s.inventoryCapacity);
  const materials = useGameStore(s => s.materials);
  const equipFromInventory = useGameStore(s => s.equipFromInventory);
  const unequipToInventory = useGameStore(s => s.unequipToInventory);

  const enhanceTargetUid = useGameStore(s => s.enhanceTargetUid);
  const setEnhanceTarget = useGameStore(s => s.setEnhanceTarget);
  const tryEnhance = useGameStore(s => s.tryEnhance);

  // All equipped items
  const equippedWeapon = useGameStore(s => s.equippedWeapon);
  const equippedTshirt = useGameStore(s => s.equippedTshirt);
  const equippedHelmet = useGameStore(s => s.equippedHelmet);
  const equippedArmor = useGameStore(s => s.equippedArmor);
  const equippedCloak = useGameStore(s => s.equippedCloak);
  const equippedGloves = useGameStore(s => s.equippedGloves);
  const equippedBoots = useGameStore(s => s.equippedBoots);
  const equippedShield = useGameStore(s => s.equippedShield);
  const equippedNecklace = useGameStore(s => s.equippedNecklace);
  const equippedRing = useGameStore(s => s.equippedRing);
  const equippedRing2 = useGameStore(s => s.equippedRing2);
  const equippedBelt = useGameStore(s => s.equippedBelt);
  const equippedEarring = useGameStore(s => s.equippedEarring);

  const allEquipped: (Equipment | null)[] = [
    equippedWeapon, equippedTshirt, equippedHelmet, equippedArmor, equippedCloak,
    equippedGloves, equippedBoots, equippedShield,
    equippedNecklace, equippedRing, equippedRing2, equippedBelt, equippedEarring,
  ];
  const equippedItems = allEquipped.filter((e): e is Equipment => e !== null);
  const equippedUids = new Set(equippedItems.map(e => e.uid));

  const [filter, setFilter] = useState<FilterMode>('all');

  // Filter inventory (non-equipped) items
  const isWeaponType = (t: string) => t === 'weapon' || t === 'bow' || t === 'staff';
  const filteredInv = filter === 'all'
    ? inventory
    : filter === 'material'
      ? []
      : filter === 'weapon'
        ? inventory.filter(eq => isWeaponType(eq.type))
        : inventory.filter(eq => !isWeaponType(eq.type));

  // Filter equipped items (same logic)
  const filteredEquipped = filter === 'all'
    ? equippedItems
    : filter === 'material'
      ? []
      : filter === 'weapon'
        ? equippedItems.filter(eq => isWeaponType(eq.type))
        : equippedItems.filter(eq => !isWeaponType(eq.type));

  // Currently selected for enhance
  const selectedUid = enhanceTargetUid;
  const selectedItem = selectedUid
    ? (equippedItems.find(e => e.uid === selectedUid) ?? inventory.find(e => e.uid === selectedUid) ?? null)
    : null;

  const emptySlots = Math.max(0, inventoryCapacity - inventory.length);
  const GRID_COLS = 4;

  return (
    <div style={{
      ...PANEL_FULL,
      display: 'grid',
      gridTemplateColumns: '1fr 280px',
      gap: 'var(--s-4)',
      padding: 'var(--s-5)',
    }}>
      {/* ━━━ LEFT: Item Grid ━━━ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)', minHeight: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--s-2)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s-2)' }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--fs-md)' }}>인벤토리</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', color: 'var(--text-dim)' }}>
              {inventory.length}/{inventoryCapacity}
            </span>
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
          {([
            ['all', '전체'],
            ['weapon', '무기'],
            ['defense', '방어구'],
            ['material', '재료'],
          ] as [FilterMode, string][]).map(([key, txt]) => (
            <button key={key} style={chipStyle(filter === key)} onClick={() => setFilter(key)}>
              {txt}
            </button>
          ))}
        </div>

        {/* Scrollable grid area */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>

          {/* ── Equipped Section ── */}
          {filter !== 'material' && filteredEquipped.length > 0 && (
            <div>
              <div style={{ ...LABEL, marginBottom: 'var(--s-2)', fontSize: 'var(--fs-xs)' }}>착용 중</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                gap: 'var(--s-2)',
              }}>
                {filteredEquipped.map(eq => (
                  <EquipCard
                    key={eq.uid}
                    eq={eq}
                    isEquipped
                    isSelected={eq.uid === selectedUid}
                    onSelect={() => setEnhanceTarget(eq.uid)}
                    onAction={() => unequipToInventory(eq.uid)}
                    actionLabel="해제"
                    actionStyle="ghost"
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Inventory Section ── */}
          {filter !== 'material' && (
            <div>
              {filteredEquipped.length > 0 && filteredInv.length > 0 && (
                <div style={{ ...LABEL, marginBottom: 'var(--s-2)', fontSize: 'var(--fs-xs)' }}>가방</div>
              )}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                gap: 'var(--s-2)',
                alignContent: 'start',
              }}>
                {filteredInv.map(eq => (
                  <EquipCard
                    key={eq.uid}
                    eq={eq}
                    isEquipped={false}
                    isSelected={eq.uid === selectedUid}
                    onSelect={() => setEnhanceTarget(eq.uid)}
                    onAction={() => equipFromInventory(eq.uid)}
                    actionLabel="착용"
                    actionStyle="success"
                  />
                ))}
                {/* Empty slots */}
                {filter === 'all' && Array.from({ length: Math.min(emptySlots, 8) }, (_, i) => (
                  <div key={`empty-${i}`} style={{
                    border: '1px dashed var(--border-soft)',
                    borderRadius: 'var(--r-sm)',
                    minHeight: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-faint)',
                    fontSize: 'var(--fs-xs)',
                  }}>
                    빈 슬롯
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Materials Section ── */}
          {(filter === 'all' || filter === 'material') && (
            <div>
              <div style={{ ...LABEL, marginBottom: 'var(--s-2)' }}>보유 재료</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 'var(--s-2)',
              }}>
                {Object.entries(materials)
                  .filter(([, qty]) => qty > 0)
                  .map(([matId, qty]) => {
                    const mat = MATERIALS[matId];
                    return (
                      <div key={matId} style={{
                        background: 'var(--bg-sunken)',
                        border: '1px solid var(--border-soft)',
                        borderRadius: 'var(--r-xs)',
                        padding: '8px var(--s-3)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-dim)' }}>
                          {mat?.name ?? matId}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', color: 'var(--text)' }}>
                          x{qty}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ━━━ RIGHT: Enhance Panel ━━━ */}
      <EnhanceSidebar
        selectedItem={selectedItem}
        equippedUids={equippedUids}
        materials={materials}
        tryEnhance={tryEnhance}
      />
    </div>
  );
}
