/* =========================================================
   EQUIP ACTIONS — 장비 관리, 강화, 제작, 큐 처리
   ========================================================= */
import {
  RECIPES, MATERIALS, EQUIPMENT_TEMPLATES,
  getScrollId, getEnhanceRate, isEnhanceSafe,
} from '../data/gameData';
import { canClassEquip } from '../data/classData';
import { secureRandomInt } from '../lib/random';
import { createEquipment, equipStat } from './helpers';
import { ALL_EQUIP_SLOT_KEYS, EQUIP_TYPE_TO_SLOT } from './storeTypes';
import type { Equipment, ScrollType, EquipType } from '../types';
import type { GameState, SetState, GetState } from './storeTypes';

// ══════════════════════════════════════════════
// L1J 축복 주문서 다중 강화 (L1EnchantScroll.java randomLevel 원본)
// ⚠️ 임의 수정 금지 — L1J 3.63c 소스에서 1:1 추출
// ══════════════════════════════════════════════

/** 축복 무기 주문서 다중 강화 (L1J randomLevel 원본) */
function blessedWeaponRandomLevel(enchantLevel: number): number {
  const rnd = secureRandomInt(1, 100);
  if (enchantLevel <= 2) {
    // 32% +1, 44% +2, 24% +3
    if (rnd <= 32) return 1;
    if (rnd <= 76) return 2;
    return 3;
  } else if (enchantLevel <= 5) {
    // 50% +1, 50% +2
    return rnd <= 50 ? 1 : 2;
  }
  return 1; // +6 이상: 항상 +1
}

/** 축복 방어구 주문서 다중 강화 (L1J randomLevel 원본) */
function blessedArmorRandomLevel(enchantLevel: number, safeEnchant: number): number {
  if (safeEnchant === 0) return 1; // safe_enchant 0 아이템: 항상 +1
  const rnd = secureRandomInt(1, 100);
  if (enchantLevel <= -6) {
    // 20% 균등 +1~+5
    if (rnd <= 20) return 1;
    if (rnd <= 40) return 2;
    if (rnd <= 60) return 3;
    if (rnd <= 80) return 4;
    return 5;
  } else if (enchantLevel >= -5 && enchantLevel <= -3) {
    // 25% 균등 +1~+4
    if (rnd <= 25) return 1;
    if (rnd <= 50) return 2;
    if (rnd <= 75) return 3;
    return 4;
  } else if (enchantLevel <= 2) {
    // 32% +1, 44% +2, 24% +3
    if (rnd <= 32) return 1;
    if (rnd <= 76) return 2;
    return 3;
  } else if (enchantLevel <= 5) {
    // 50% +1, 50% +2
    return rnd <= 50 ? 1 : 2;
  }
  return 1; // +6 이상: 항상 +1
}

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
        // 클래스/레벨 제한 체크 — 불가 시 인벤토리에 보관
        const eqTpl = EQUIPMENT_TEMPLATES[eq.templateId];
        const levelBlocked = eqTpl?.minLevel ? state.level < eqTpl.minLevel : false;
        if (!canClassEquip(state.playerClass, eq.type as EquipType) || levelBlocked) {
          if (state.inventory.length < state.inventoryCapacity) {
            updates.inventory = [...(updates.inventory ?? state.inventory), eq];
          }
          // 장착 불가 + 인벤토리 가득 → 드랍 (아무 처리 안 함)
        } else {
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
      const isWeapon = eq.type === 'weapon' || eq.type === 'bow' || eq.type === 'staff';

      if (scrollType === 'cursed') {
        // 저주: 하한 체크 (L1J: 무기 -6 이하 생존, 방어구 -6 이하 파괴)
        // 우리 게임에서는 0 이하 저주 불가로 간소화
        if (level <= 0) return;
      } else {
        if (level >= eq.maxEnhance) return;
      }

      const scrollId = getScrollId(eq.type, scrollType);
      const scrollName = MATERIALS[scrollId]?.name ?? scrollId;
      if ((state.materials[scrollId] ?? 0) < 1) return;

      const newMaterials = { ...state.materials, [scrollId]: (state.materials[scrollId] ?? 0) - 1 };
      const successRate = getEnhanceRate(eq.type, level, eq.safeEnchant);
      const safe = isEnhanceSafe(level, eq.safeEnchant);

      let success: boolean;
      let destroyed = false;
      let safeFailure = false;
      let updated: Equipment;

      if (scrollType === 'cursed') {
        // ── 저주 주문서 (L1J: 항상 -1, 하한 체크) ──
        success = true;
        updated = { ...eq, enhanceLevel: level - 1 };
      } else {
        // ── 일반/축복 주문서 (L1J L1EnchantScroll.java 원본) ──
        // ⚠️ 10000 범위 사용: +9 이상 0.6%/0.3% 정밀도 확보
        const chance = Math.round(successRate * 10000);

        if (level >= 9) {
          // +9 이상: 3가지 결과 (성공 / 안전 실패 / 파괴)
          const rnd = secureRandomInt(1, 10000);
          if (rnd <= chance) {
            // 성공
            success = true;
            if (scrollType === 'blessed') {
              const bonus = isWeapon
                ? blessedWeaponRandomLevel(level)
                : blessedArmorRandomLevel(level, eq.safeEnchant);
              updated = { ...eq, enhanceLevel: Math.min(level + bonus, eq.maxEnhance) };
            } else {
              updated = { ...eq, enhanceLevel: level + 1 };
            }
          } else if (rnd <= chance * 2) {
            // 안전 실패: 아이템 유지, 레벨 변동 없음
            success = false;
            safeFailure = true;
            updated = { ...eq };
          } else {
            // 파괴
            success = false;
            destroyed = true;
            updated = { ...eq };
          }
        } else if (safe) {
          // 안전 구간: 항상 성공
          success = true;
          if (scrollType === 'blessed') {
            const bonus = isWeapon
              ? blessedWeaponRandomLevel(level)
              : blessedArmorRandomLevel(level, eq.safeEnchant);
            updated = { ...eq, enhanceLevel: Math.min(level + bonus, eq.maxEnhance) };
          } else {
            updated = { ...eq, enhanceLevel: level + 1 };
          }
        } else {
          // 비안전 구간: 성공 또는 파괴
          const rnd = secureRandomInt(1, 10000);
          if (rnd <= chance) {
            success = true;
            if (scrollType === 'blessed') {
              const bonus = isWeapon
                ? blessedWeaponRandomLevel(level)
                : blessedArmorRandomLevel(level, eq.safeEnchant);
              updated = { ...eq, enhanceLevel: Math.min(level + bonus, eq.maxEnhance) };
            } else {
              updated = { ...eq, enhanceLevel: level + 1 };
            }
          } else {
            success = false;
            destroyed = true;
            updated = { ...eq };
          }
        }
      }

      const statBefore = equipStat(eq);
      const statAfter = destroyed ? 0 : equipStat(updated);

      const updates: Partial<GameState> = { materials: newMaterials, enhanceScrollType: scrollType };

      if (scrollType === 'blessed' || destroyed || safeFailure) {
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
        success, destroyed, safeFailure,
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
      // 클래스 장비 제한 체크
      if (!canClassEquip(state.playerClass, eq.type as EquipType)) return;
      // 레벨 제한 체크
      const tpl = EQUIPMENT_TEMPLATES[eq.templateId];
      if (tpl?.minLevel && state.level < tpl.minLevel) return;

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
