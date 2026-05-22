/* =========================================================
   DERIVED STATS — 장비 보너스 포함 스탯 계산
   ========================================================= */
import { BASE_STATS, totalStatPoints } from '../data/statFormulas';
import { getActiveSets } from '../data/gameData';
import { equipStat } from './helpers';
import { getAllEquipped } from './storeTypes';
import type { Equipment } from '../types';
import type { GetState } from './storeTypes';

export function createDerivedStats(get: GetState) {
  const statBonus = (key: 'str' | 'dex' | 'con' | 'wis') => {
    const s = get();
    return getAllEquipped(s).reduce((sum, eq) => sum + (eq?.bonuses?.[key] ?? 0), 0);
  };

  return {
    getStr: () => {
      const s = get();
      return BASE_STATS.str + s.statAllocation.str + statBonus('str');
    },
    getDex: () => {
      const s = get();
      return BASE_STATS.dex + s.statAllocation.dex + statBonus('dex');
    },
    getCon: () => {
      const s = get();
      return BASE_STATS.con + s.statAllocation.con + statBonus('con');
    },
    getWis: () => {
      const s = get();
      return BASE_STATS.wis + s.statAllocation.wis + statBonus('wis');
    },

    getRemainingPoints: () => {
      const { level, statAllocation } = get();
      const total = totalStatPoints(level);
      const used = statAllocation.str + statAllocation.dex + statAllocation.con + statAllocation.wis;
      return total - used;
    },

    getTotalDefense: () => {
      const s = get();
      const slots = [
        s.equippedTshirt, s.equippedArmor, s.equippedHelmet, s.equippedCloak,
        s.equippedGloves, s.equippedBoots, s.equippedShield,
        s.equippedNecklace, s.equippedRing, s.equippedRing2, s.equippedBelt,
      ];
      const baseDef = slots.reduce((total, eq) => eq ? total + equipStat(eq) : total, 0);
      const allEquipped = [s.equippedWeapon, ...slots].filter((e): e is Equipment => e !== null);
      const templateIds = allEquipped.map(e => e.templateId);
      const setAcBonus = getActiveSets(templateIds).reduce((sum, set) => sum + (set.bonuses.ac ?? 0), 0);
      return baseDef + setAcBonus;
    },

    getSetBonusHp: () => {
      const s = get();
      const allEquipped = getAllEquipped(s).filter((e): e is Equipment => e !== null);
      const templateIds = allEquipped.map(e => e.templateId);
      return getActiveSets(templateIds).reduce((sum, set) => sum + (set.bonuses.hp ?? 0), 0);
    },

    getTotalHpBonus: () => {
      const s = get();
      const equipBonusHp = getAllEquipped(s).reduce((sum, eq) => sum + (eq?.bonuses?.hp ?? 0), 0);
      return equipBonusHp + s.getSetBonusHp();
    },

    getAtkSpeedMult: () => {
      const now = Date.now();
      // 레벨 패시브 제거 → 변신주문서 버프가 공속 제공
      return get().activeBuffs
        .filter(b => b.expiresAt > now)
        .reduce((mult, b) => mult * b.atkSpeedMult, 1);
    },

    getMoveSpeedMult: () => {
      const now = Date.now();
      // MAX → 곱연산 변경: 변신주문서 이속 × 초록물약 이속 동시 적용
      return get().activeBuffs
        .filter(b => b.expiresAt > now)
        .reduce((mult, b) => mult * b.moveSpeedMult, 1);
    },
  };
}
