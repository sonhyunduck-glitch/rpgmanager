/* =========================================================
   DERIVED STATS — 장비 보너스 포함 스탯 계산 (클래스별 기본값)
   ========================================================= */
import { totalStatPoints, calcMaxMp } from '../data/statFormulas';
import { getClassBaseStats, CLASS_CONFIGS } from '../data/classData';
import { getActiveSets } from '../data/setData';
import { equipStat } from './helpers';
import { getAllEquipped } from './storeTypes';
import type { Equipment } from '../types';
import type { GetState } from './storeTypes';

/** 장착 중인 장비 templateId 배열 가져오기 */
function getEquippedTemplateIds(s: ReturnType<GetState>): string[] {
  return getAllEquipped(s).filter((e): e is Equipment => e !== null).map(e => e.templateId);
}

/** 세트 보너스에서 특정 키의 합산값 */
function sumSetBonus(s: ReturnType<GetState>, key: string): number {
  const ids = getEquippedTemplateIds(s);
  return getActiveSets(ids).reduce(
    (sum, set) => sum + ((set.bonuses as Record<string, number>)[key] ?? 0), 0,
  );
}

export function createDerivedStats(get: GetState) {
  const statBonus = (key: 'str' | 'dex' | 'con' | 'wis' | 'int') => {
    const s = get();
    const equipBonus = getAllEquipped(s).reduce((sum, eq) => sum + (eq?.bonuses?.[key] ?? 0), 0);
    const setBonus = sumSetBonus(s, key);
    return equipBonus + setBonus;
  };

  return {
    getStr: () => {
      const s = get();
      const base = getClassBaseStats(s.playerClass);
      return base.str + s.statAllocation.str + statBonus('str');
    },
    getDex: () => {
      const s = get();
      const base = getClassBaseStats(s.playerClass);
      return base.dex + s.statAllocation.dex + statBonus('dex');
    },
    getCon: () => {
      const s = get();
      const base = getClassBaseStats(s.playerClass);
      return base.con + s.statAllocation.con + statBonus('con');
    },
    getWis: () => {
      const s = get();
      const base = getClassBaseStats(s.playerClass);
      return base.wis + s.statAllocation.wis + statBonus('wis');
    },
    getInt: () => {
      const s = get();
      const base = getClassBaseStats(s.playerClass);
      return base.int + s.statAllocation.int + statBonus('int');
    },

    /** 장비 SP(마법 강화) 보너스 합산 — 마법 대미지 계수용 (장비 + 세트) */
    getSp: () => {
      const s = get();
      const equipSp = getAllEquipped(s).reduce((sum, eq) => sum + (eq?.bonuses?.sp ?? 0), 0);
      return equipSp + sumSetBonus(s, 'sp');
    },

    getRemainingPoints: () => {
      const s = get();
      const { level, statAllocation } = s;
      const initial = CLASS_CONFIGS[s.playerClass].initialPoints;
      const total = totalStatPoints(level, initial);
      const used = statAllocation.str + statAllocation.dex + statAllocation.con + statAllocation.wis + statAllocation.int;
      return total - used;
    },

    getTotalDefense: () => {
      const s = get();
      const slots = [
        s.equippedTshirt, s.equippedArmor, s.equippedHelmet, s.equippedCloak,
        s.equippedGloves, s.equippedBoots, s.equippedShield,
        s.equippedNecklace, s.equippedRing, s.equippedRing2, s.equippedBelt,
        s.equippedEarring,
      ];
      const baseDef = slots.reduce((total, eq) => eq ? total + equipStat(eq) : total, 0);
      const setAcBonus = sumSetBonus(s, 'ac');
      return baseDef + setAcBonus;
    },

    getSetBonusHp: () => sumSetBonus(get(), 'hp'),

    /** 세트 MR 보너스 */
    getSetBonusMr: () => sumSetBonus(get(), 'mr'),

    /** 세트 명중 보너스 */
    getSetBonusHit: () => sumSetBonus(get(), 'hit'),

    /** 세트 추타 보너스 */
    getSetBonusDmg: () => sumSetBonus(get(), 'dmg'),

    /** 세트 활 명중 보너스 */
    getSetBonusBowHit: () => sumSetBonus(get(), 'bowHit'),

    /** 세트 활 추타 보너스 */
    getSetBonusBowDmg: () => sumSetBonus(get(), 'bowDmg'),

    getTotalHpBonus: () => {
      const s = get();
      const equipBonusHp = getAllEquipped(s).reduce((sum, eq) => sum + (eq?.bonuses?.hp ?? 0), 0);
      return equipBonusHp + s.getSetBonusHp();
    },

    getAtkSpeedMult: () => {
      const s = get();
      const now = Date.now();
      // 장비 헤이스트: 무기에 haste 보너스가 있으면 1.33배 (L1J is_haste)
      const equipHaste = s.equippedWeapon?.bonuses?.haste ? 1.33 : 1;
      // 버프 헤이스트: 변신주문서/스킬 버프
      const buffMult = s.activeBuffs
        .filter(b => b.expiresAt > now)
        .reduce((mult, b) => mult * b.atkSpeedMult, 1);
      return equipHaste * buffMult;
    },

    getMoveSpeedMult: () => {
      const now = Date.now();
      // MAX → 곱연산 변경: 변신주문서 이속 × 초록물약 이속 동시 적용
      return get().activeBuffs
        .filter(b => b.expiresAt > now)
        .reduce((mult, b) => mult * b.moveSpeedMult, 1);
    },

    getMaxMp: () => {
      const s = get();
      const base = getClassBaseStats(s.playerClass);
      const totalInt = base.int + s.statAllocation.int + statBonus('int');
      const totalWis = base.wis + s.statAllocation.wis + statBonus('wis');
      const baseMp = calcMaxMp(s.level, totalWis, totalInt, s.playerClass);
      // 장비 MP 보너스 합산
      const equipMp = getAllEquipped(s).reduce((sum, eq) => sum + (eq?.bonuses?.mp ?? 0), 0);
      return baseMp + equipMp;
    },
  };
}
