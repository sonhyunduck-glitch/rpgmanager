/* =========================================================
   EQUIP ACTIONS — 장비 관리, 강화, 제작, 큐 처리
   ========================================================= */
import {
  RECIPES, MATERIALS,
  getScrollId, getEnhanceRate, isEnhanceSafe,
  EQUIPMENT_TEMPLATES,
} from '../data/gameData';
import { createEquipment, equipStat } from './helpers';
import { ALL_EQUIP_SLOT_KEYS, EQUIP_TYPE_TO_SLOT } from './storeTypes';
import type { Equipment, ScrollType } from '../types';
import type { GameState, SetState, GetState } from './storeTypes';

type SaveFn = (state: GameState) => void;

export function createEquipActions(set: SetState, get: GetState, save: SaveFn) {
  return {
    processQueueItem: (id: string, action: 'equip' | 'sell' | 'keep') => {
      const state = get();
      const item = state.queue.find(q => q.id === id);
      if (!item) return;

      const newQueue = state.queue.filter(q => q.id !== id);
      const updates: Partial<GameState> = { queue: newQueue };

      if (action === 'equip') {
        const eq = item.item;
        let slotKey = EQUIP_TYPE_TO_SLOT[eq.type];
        if (eq.type === 'ring' && state.equippedRing) slotKey = 'equippedRing2';
        if (slotKey) {
          const old = (state as unknown as Record<string, unknown>)[slotKey] as Equipment | null;
          (updates as unknown as Record<string, unknown>)[slotKey] = eq;
          if (old && state.inventory.length < state.inventoryCapacity) {
            updates.inventory = [...state.inventory, old];
          } else if (old) {
            updates.gold = state.gold + old.sellPrice;
          }
        }
      } else if (action === 'sell') {
        updates.gold = (updates.gold ?? state.gold) + item.priceIfSold;
      } else if (action === 'keep') {
        if (state.inventory.length < state.inventoryCapacity) {
          updates.inventory = [...(updates.inventory ?? state.inventory), item.item];
        }
      }

      if (state.hunt.status === 'paused' && newQueue.length < state.queueCapacity) {
        updates.hunt = { ...state.hunt, status: 'hunting' };
      }

      set(updates as GameState);
      save(get());
    },

    bulkSellLow: () => {
      const state = get();
      let goldGained = 0;
      const remaining = state.queue.filter(q => {
        if (q.recommendation === 'sell') { goldGained += q.priceIfSold; return false; }
        return true;
      });

      const updates: Partial<GameState> = {
        queue: remaining,
        gold: state.gold + goldGained,
      };
      if (state.hunt.status === 'paused' && remaining.length < state.queueCapacity) {
        updates.hunt = { ...state.hunt, status: 'hunting' };
      }
      set(updates as GameState);
      save(get());
    },

    tryEnhance: (uid: string, scrollType: ScrollType) => {
      const state = get();
      let eq: Equipment | null = null;
      for (const key of ALL_EQUIP_SLOT_KEYS) {
        const s = state[key];
        if (s?.uid === uid) { eq = s; break; }
      }
      if (!eq) eq = state.inventory.find(e => e.uid === uid) ?? null;
      if (!eq) return;

      const level = eq.enhanceLevel;

      if (scrollType === 'cursed') {
        if (level <= 0) return;
      } else {
        if (level >= eq.maxEnhance) return;
      }

      const scrollId = getScrollId(eq.type, scrollType);
      const scrollName = MATERIALS[scrollId]?.name ?? scrollId;
      if ((state.materials[scrollId] ?? 0) < 1) return;

      const newMaterials = { ...state.materials, [scrollId]: (state.materials[scrollId] ?? 0) - 1 };
      const successRate = getEnhanceRate(eq.type, level);
      const safe = isEnhanceSafe(eq.type, level);

      let success: boolean;
      let destroyed = false;
      let updated: Equipment;

      if (scrollType === 'cursed') {
        success = true;
        updated = { ...eq, enhanceLevel: level - 1 };
      } else if (scrollType === 'blessed') {
        if (safe) {
          success = true;
          const bonus = 1 + Math.floor(Math.random() * 3);
          const newLevel = Math.min(eq.enhanceLevel + bonus, eq.maxEnhance);
          updated = { ...eq, enhanceLevel: newLevel };
        } else {
          success = Math.random() < successRate;
          if (success) {
            const bonus = 1 + Math.floor(Math.random() * 2);
            const newLevel = Math.min(eq.enhanceLevel + bonus, eq.maxEnhance);
            updated = { ...eq, enhanceLevel: newLevel };
          } else {
            destroyed = true;
            updated = { ...eq };
          }
        }
      } else {
        success = Math.random() < successRate;
        if (success) {
          updated = { ...eq, enhanceLevel: level + 1 };
        } else if (!safe) {
          destroyed = true;
          updated = { ...eq };
        } else {
          updated = { ...eq };
        }
      }

      const statBefore = equipStat(eq);
      const statAfter = destroyed ? 0 : equipStat(updated);

      const updates: Partial<GameState> = { materials: newMaterials, enhanceScrollType: scrollType };

      if (scrollType === 'blessed' || destroyed) {
        (updates as GameState).enhanceAnim = { uid, fromLevel: level, toLevel: destroyed ? 0 : updated.enhanceLevel, destroyed, scrollType };
      } else {
        (updates as GameState).enhanceAnim = null;
      }

      const hasAnim = (updates as GameState).enhanceAnim != null;
      if (!hasAnim && !destroyed) {
        let slotFound = false;
        for (const key of ALL_EQUIP_SLOT_KEYS) {
          if (state[key]?.uid === uid) {
            (updates as unknown as Record<string, unknown>)[key] = updated;
            slotFound = true;
            break;
          }
        }
        if (!slotFound) updates.inventory = state.inventory.map(e => e.uid === uid ? updated : e);
      }

      (updates as GameState).enhanceResult = {
        success, destroyed,
        itemName: eq.name, equipType: eq.type,
        fromLevel: level, toLevel: destroyed ? -1 : updated.enhanceLevel,
        statBefore, statAfter,
        scrollUsed: scrollName, scrollType, successRate,
      };

      set(updates as GameState);
      save(get());
    },

    closeEnhanceResult: () => set({ enhanceResult: null }),
    setEnhanceTarget: (uid: string | null) => set({ enhanceTargetUid: uid }),

    clearEnhanceAnim: () => {
      const state = get();
      const anim = state.enhanceAnim;
      if (!anim) { set({ enhanceAnim: null }); return; }

      const uid = anim.uid;
      const updates: Partial<GameState> = { enhanceAnim: null };

      if (anim.destroyed) {
        let slotFound = false;
        for (const key of ALL_EQUIP_SLOT_KEYS) {
          if (state[key]?.uid === uid) {
            (updates as unknown as Record<string, unknown>)[key] = null;
            slotFound = true;
            break;
          }
        }
        if (!slotFound) updates.inventory = state.inventory.filter(e => e.uid !== uid);
      } else if (anim.toLevel > 0) {
        let slotFound = false;
        for (const key of ALL_EQUIP_SLOT_KEYS) {
          const eq = state[key];
          if (eq?.uid === uid) {
            (updates as unknown as Record<string, unknown>)[key] = { ...eq, enhanceLevel: anim.toLevel };
            slotFound = true;
            break;
          }
        }
        if (!slotFound) {
          updates.inventory = state.inventory.map(e =>
            e.uid === uid ? { ...e, enhanceLevel: anim.toLevel } : e
          );
        }
      }

      set(updates as GameState);
      save(get());
    },

    tryCraft: (recipeId: string) => {
      const state = get();
      const recipe = RECIPES.find(r => r.id === recipeId);
      if (!recipe) return;
      if (state.gold < recipe.goldCost) return;
      if (state.inventory.length >= state.inventoryCapacity) return;

      for (const req of recipe.materials) {
        if ((state.materials[req.materialId] ?? 0) < req.quantity) return;
      }

      const newMaterials = { ...state.materials };
      for (const req of recipe.materials) {
        newMaterials[req.materialId] -= req.quantity;
      }

      const newEquip = createEquipment(recipe.resultTemplateId);
      set({
        gold: state.gold - recipe.goldCost,
        materials: newMaterials,
        inventory: [...state.inventory, newEquip],
      });
      save(get());
    },

    sellFromInventory: (uid: string) => {
      const state = get();
      const eq = state.inventory.find(e => e.uid === uid);
      if (!eq) return;
      set({
        inventory: state.inventory.filter(e => e.uid !== uid),
        gold: state.gold + eq.sellPrice,
      });
      save(get());
    },

    equipFromInventory: (uid: string) => {
      const state = get();
      const eq = state.inventory.find(e => e.uid === uid);
      if (!eq) return;

      const newInventory = state.inventory.filter(e => e.uid !== uid);
      const updates: Partial<GameState> = { inventory: newInventory };

      let slotKey = EQUIP_TYPE_TO_SLOT[eq.type];
      if (eq.type === 'ring' && state.equippedRing) slotKey = 'equippedRing2';
      if (slotKey) {
        const old = (state as unknown as Record<string, unknown>)[slotKey] as Equipment | null;
        if (old) newInventory.push(old);
        (updates as unknown as Record<string, unknown>)[slotKey] = eq;
      }

      updates.inventory = newInventory;
      set(updates as GameState);
      save(get());
    },

    unequipToInventory: (uid: string) => {
      const state = get();
      if (state.inventory.length >= state.inventoryCapacity) return;

      const updates: Partial<GameState> = {};
      for (const slotKey of ALL_EQUIP_SLOT_KEYS) {
        const eq = state[slotKey];
        if (eq?.uid === uid) {
          (updates as unknown as Record<string, unknown>)[slotKey] = null;
          updates.inventory = [...state.inventory, eq];
          break;
        }
      }
      if (!updates.inventory) return;
      set(updates as GameState);
      save(get());
    },
  };
}
