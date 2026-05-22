/* =========================================================
   SHOP ACTIONS — 포션/장비/재료 구매, 포션 설정
   ========================================================= */
import { POTIONS, EQUIPMENT_TEMPLATES } from '../data/gameData';
import { createEquipment } from './helpers';
import type { GameState, SetState, GetState } from './storeTypes';

type SaveFn = (state: GameState) => void;

export function createShopActions(set: SetState, get: GetState, save: SaveFn) {
  return {
    buyPotion: (id: string, qty: number) => {
      const state = get();
      const potion = POTIONS[id];
      if (!potion) return;
      const cost = potion.buyPrice * qty;
      if (state.gold < cost) return;
      set({
        gold: state.gold - cost,
        potions: { ...state.potions, [id]: (state.potions[id] ?? 0) + qty },
      });
      save(get());
    },

    buyEquipFromShop: (templateId: string) => {
      const state = get();
      const tmpl = EQUIPMENT_TEMPLATES[templateId];
      if (!tmpl) return;
      const shopPrice = tmpl.sellPrice * 2;
      if (state.gold < shopPrice) return;
      if (state.inventory.length >= state.inventoryCapacity) return;
      const newEquip = createEquipment(templateId);
      set({
        gold: state.gold - shopPrice,
        inventory: [...state.inventory, newEquip],
      });
      save(get());
    },

    buyMaterial: (materialId: string, qty: number, unitPrice: number) => {
      const state = get();
      const totalCost = unitPrice * qty;
      if (state.gold < totalCost) return;
      set({
        gold: state.gold - totalCost,
        materials: { ...state.materials, [materialId]: (state.materials[materialId] ?? 0) + qty },
      });
      save(get());
    },

    setMaterials: (m: Record<string, number>) => {
      set({ materials: m });
      save(get());
    },

    setSelectedPotion: (id: string) => {
      set({ selectedPotionId: id });
      save(get());
    },

    togglePotionAutoUse: () => {
      set(s => ({ potionAutoUse: !s.potionAutoUse }));
      save(get());
    },

    setPotionAutoThreshold: (pct: number) => {
      set({ potionAutoThreshold: Math.max(10, Math.min(90, pct)) });
      save(get());
    },

    togglePotionAutoBuy: () => {
      set(s => ({ potionAutoBuy: !s.potionAutoBuy }));
      save(get());
    },

    toggleGreenPotion: () => {
      set(s => ({ greenPotionEnabled: !s.greenPotionEnabled }));
      save(get());
    },

    toggleCouragePotion: () => {
      set(s => ({ couragePotionEnabled: !s.couragePotionEnabled }));
      save(get());
    },
  };
}
