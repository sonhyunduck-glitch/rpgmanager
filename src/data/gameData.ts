/* =========================================================
   STATIC GAME DATA — 몬스터, 사냥터, 장비 템플릿, 재료, 레시피
   ========================================================= */

import type { EquipmentTemplate, Material, HuntZone, Potion, PlayerClass } from '../types';
import { generateHuntZones, getMonstersForTier, getMonstersForRoom, roomToTier } from './monsterData';
import { CSV_EQUIPMENT } from './csvEquipData';
import { ETC_ITEMS } from './dropData';
import { SHOP_ETC_ITEMS } from './shopItemData';
export { getMonstersForTier, getMonstersForRoom, roomToTier };
export { EQUIPMENT_SETS, getActiveSets } from './setData';
export type { SetEffect, SetBonuses } from './setData';
export { SHOP_ETC_ITEMS } from './shopItemData';
export type { ShopEtcItem, ShopItemCategory } from './shopItemData';

// Re-export types for backward compatibility
export type { EquipmentTemplate, Material, Monster, HuntZone, EquipType, ZoneTier, Potion } from '../types';

// ── Level Speed & Color ──
/** (레거시) 레벨별 공격속도 패시브 — 변신주문서 시스템으로 이전됨
 *  getAtkSpeedMult()에서 더 이상 사용하지 않음.
 *  TRANSFORM_SCROLL_TABLE이 이 값들을 흡수. */
const LEVEL_SPEED_TABLE: [number, number][] = [
  [95, 3.10], [90, 2.75], [85, 2.45], [80, 2.20],
  [75, 2.00], [70, 1.75], [65, 1.65], [60, 1.56],
  [55, 1.48], [52, 1.40], [50, 1.25],
];

/** @deprecated 변신주문서 시스템으로 대체. 하위 호환용 유지. */
export function getLevelSpeedMult(level: number): number {
  for (const [lvl, mult] of LEVEL_SPEED_TABLE) {
    if (level >= lvl) return mult;
  }
  return 1;
}

// ── Transform Scroll (변신주문서) ──
/**
 * 변신주문서 속도 테이블 — [최소레벨, 공속배율, 이속배율]
 * 기존 LEVEL_SPEED_TABLE 공속 값을 흡수 + 이속 신규 추가.
 * 내림차순 매칭: 레벨 ≥ minLv → 해당 행 반환.
 */
const TRANSFORM_SCROLL_TABLE: [number, number, number][] = [
  // [minLv, atkMult, moveMult]
  [95, 3.10, 1.85],
  [90, 2.75, 1.80],
  [85, 2.45, 1.75],
  [80, 2.20, 1.70],
  [75, 2.00, 1.65],
  [70, 1.75, 1.58],
  [65, 1.65, 1.52],
  [60, 1.56, 1.48],
  [55, 1.48, 1.42],
  [52, 1.40, 1.38],
  [50, 1.25, 1.35],
  [49, 1.23, 1.33],
  [45, 1.21, 1.30],
  [40, 1.18, 1.26],
  [35, 1.15, 1.22],
  [30, 1.12, 1.18],
  [25, 1.09, 1.14],
  [20, 1.06, 1.10],
  [12, 1.04, 1.06],
];

/** 변신주문서 사용 시 레벨에 맞는 공속/이속 배율 반환 */
export function getTransformScrollSpeed(level: number): { atk: number; move: number } {
  for (const [lvl, atk, move] of TRANSFORM_SCROLL_TABLE) {
    if (level >= lvl) return { atk, move };
  }
  return { atk: 1, move: 1 };
}

/** 변신주문서 테이블에서 매칭되는 변신 레벨 반환 (닷 색상용) */
export function getTransformScrollLevel(level: number): number {
  for (const [lvl] of TRANSFORM_SCROLL_TABLE) {
    if (level >= lvl) return lvl;
  }
  return level;
}

export const TRANSFORM_SCROLL_DURATION = 1800;    // 30분 (초)
export const TRANSFORM_SCROLL_PRICE = 500;         // 상점 구매가
export const TRANSFORM_SCROLL_DROP_RATE = 0.03;    // 3% 킬당 드롭률
export const TRANSFORM_SCROLL_MAX = 10;            // 최대 보유 수

/** 레벨별 플레이어 닷 색상 */
const LEVEL_DOT_COLOR: [number, string][] = [
  [95, 'platinum'], // 특수 처리 — CSS 애니메이션
  [90, '#ea80fc'], // bright purple
  [85, '#ce93d8'], // purple
  [80, '#f48fb1'], // pink
  [75, '#ef5350'], // red
  [70, '#ff7043'], // deep orange
  [65, '#ffa726'], // orange
  [60, '#ffee58'], // yellow
  [55, '#c6ff00'], // lime
  [52, '#69f0ae'], // green
  [50, '#00e5ff'], // cyan
];

export function getPlayerDotColor(level: number): string {
  for (const [lvl, color] of LEVEL_DOT_COLOR) {
    if (level >= lvl) return color;
  }
  return '#42a5f5'; // default blue
}

// ── Potions ──
export const POTIONS: Record<string, Potion> = {
  red_potion:     { id: 'red_potion',     name: '빨간 물약', healMin: 6,  healMax: 27,  buyPrice: 37,  requiredLevel: 1, cooldownMs: 3000 },
  crimson_potion: { id: 'crimson_potion', name: '주홍 물약', healMin: 26, healMax: 68,  buyPrice: 200, requiredLevel: 1, cooldownMs: 5000 },
  clear_potion:   { id: 'clear_potion',   name: '맑은 물약', healMin: 44, healMax: 107, buyPrice: 600, requiredLevel: 1, cooldownMs: 6000 },
  blue_potion:    { id: 'blue_potion',    name: '파란 물약', healMin: 0,  healMax: 0,   buyPrice: 700, requiredLevel: 1,
                    buffDuration: 600 },  // L1J: 10분 MP리젠 버프
  green_potion:   { id: 'green_potion',   name: '초록 물약', healMin: 0,  healMax: 0,   buyPrice: 200, requiredLevel: 1,
                    buffDuration: 300, atkSpeedMult: 1.33, moveSpeedMult: 1.33 },
  // ── L1J 클래스별 brave 계열 물약 ──
  courage_potion: { id: 'courage_potion', name: '용기의 물약', healMin: 0, healMax: 0,  buyPrice: 800, requiredLevel: 1,
                    buffDuration: 300, atkSpeedMult: 1.33,
                    classRestriction: ['knight'] },  // L1J: 기사 전용 (ClassInitial=K)
  elven_wafer:    { id: 'elven_wafer',    name: '엘븐 와퍼', healMin: 0, healMax: 0,   buyPrice: 1000, requiredLevel: 1,
                    buffDuration: 300, atkSpeedMult: 1.33,
                    classRestriction: ['elf'] },     // L1J: 요정 전용 (ClassInitial=E)
  wisdom_potion:  { id: 'wisdom_potion',  name: '지혜의 물약', healMin: 0, healMax: 0,  buyPrice: 600, requiredLevel: 1,
                    buffDuration: 300, spBonus: 2,
                    classRestriction: ['wizard'] },  // L1J: 마법사 전용 (ClassInitial=W, SP+2)
};
export const POTION_ORDER = ['red_potion', 'crimson_potion', 'clear_potion', 'blue_potion', 'green_potion', 'courage_potion', 'elven_wafer', 'wisdom_potion'];
/** 힐 물약만 (자동사용 순환용) */
export const HEAL_POTION_ORDER = ['red_potion', 'crimson_potion', 'clear_potion'];
/** 클래스별 brave 계열 물약 ID 조회 */
export function getBravePotionId(playerClass: PlayerClass): string {
  switch (playerClass) {
    case 'knight': return 'courage_potion';
    case 'elf':    return 'elven_wafer';
    case 'wizard': return 'wisdom_potion';
  }
}

// ── Materials (주문서 + L1J 드롭 아이템) ──
export const MATERIALS: Record<string, Material> = {
  // ── 변신주문서 ──
  transform_scroll:       { id: 'transform_scroll',       name: '변신주문서',                 sellPrice: 250 },
  event_transform_scroll: { id: 'event_transform_scroll', name: '이벤트 변신주문서',           sellPrice: 500 },

  // ── 강화 주문서 ──
  weapon_scroll:          { id: 'weapon_scroll',          name: '무기강화주문서',             sellPrice: 37500 },
  blessed_weapon_scroll:  { id: 'blessed_weapon_scroll',  name: '축복받은 무기강화주문서',   sellPrice: 75000 },
  cursed_weapon_scroll:   { id: 'cursed_weapon_scroll',   name: '저주받은 무기강화주문서',   sellPrice: 7500 },
  armor_scroll:           { id: 'armor_scroll',           name: '방어구강화주문서',           sellPrice: 15500 },
  blessed_armor_scroll:   { id: 'blessed_armor_scroll',   name: '축복받은 방어구강화주문서', sellPrice: 31000 },
  cursed_armor_scroll:    { id: 'cursed_armor_scroll',    name: '저주받은 방어구강화주문서', sellPrice: 3100 },
  // L1J etc_items.csv 기반 드롭 아이템 (dropData.ts에서 자동 생성)
  ...ETC_ITEMS,
  // L1J 상점 전용 아이템 (shopItemData.ts — ETC_ITEMS에 없는 것만 추가)
  ...Object.fromEntries(
    SHOP_ETC_ITEMS
      .filter(item => !ETC_ITEMS[item.id])
      .map(item => [item.id, { id: item.id, name: item.name, sellPrice: item.sellPrice > 0 ? item.sellPrice : 0 } as Material]),
  ),
};

// ── Equipment Templates (수동 정의) ──
// baseAtk/baseAtkLarge = 소형/대형 몹 타격치
// 강화(인챈트)는 타격치에 영향 없음 — 추타+1, 명중+1 per level (statFormulas.ts)
// safeEnchant 미지정 시 통합 단계에서 기본값 자동 적용 (무기=6, 방어구=4)
const HAND_CURATED_TEMPLATES: Record<string, Omit<EquipmentTemplate, 'safeEnchant'> & { safeEnchant?: number }> = {
  /* ── 무기 (62종 + 2 deprecated) ── weapons_review.txt 기반 선별
     L1J 3.63c CSV 373종 중 62종 선택 + 드랍 테이블 참조 2종 유지
     타입: weapon(한손검/단검), weapon+isTwoHanded(양손검), bow, staff
     CSV 무기 필터링: SELECTED_CSV_WEAPON_IDS 참조
  */

  // ── DEPRECATED: 드랍 테이블 호환용 (선별 목록에 없으나 dropData.ts 참조) ──
  silver_sword:        { id: 'silver_sword',        name: '은검',               type: 'weapon', baseAtk: 7,  baseAtkLarge: 7,  baseDef: 0, maxEnhance: 10, sellPrice: 4000,  weight: 40000, bonuses: { undeadSlayer: true }, bonusEffects: ['언데드 추타'] },
  oak_staff:           { id: 'oak_staff',           name: '참나무 지팡이',        type: 'staff', baseAtk: 4,  baseAtkLarge: 4,  baseDef: 0, maxEnhance: 10, sellPrice: 50,    weight: 15000, classRestriction: ['wizard'], bonuses: { mr: 2, sp: 1 }, bonusEffects: ['MR+2', 'SP+1'] },

  // ── 단검 (5종, type: weapon) ──
  lastabad_dagger:     { id: 'lastabad_dagger',     name: '라스타바드 단검',      type: 'weapon', baseAtk: 4,  baseAtkLarge: 3,  baseDef: 0, maxEnhance: 10, sellPrice: 2000,  weight: 20000, classRestriction: ['knight'], bonuses: { hit: 2 }, bonusEffects: ['명중+2'] },
  mithril_dagger:      { id: 'mithril_dagger',      name: '미스릴 단검',          type: 'weapon', baseAtk: 6,  baseAtkLarge: 5,  baseDef: 0, maxEnhance: 10, sellPrice: 5000,  weight: 50000, bonuses: { sp: 1, mpr: 3, undeadSlayer: true }, bonusEffects: ['SP+1', 'MPR+3', '언데드 추타'] },
  oriharukon_dagger:   { id: 'oriharukon_dagger',   name: '오리하루콘 단검',       type: 'weapon', baseAtk: 7,  baseAtkLarge: 7,  baseDef: 0, maxEnhance: 10, sellPrice: 5000,  weight: 50000, bonuses: { extraDmg: 2, unbreakable: true }, bonusEffects: ['추타+2', '손상되지 않음'] },
  changcheon_dagger:   { id: 'changcheon_dagger',   name: '창천의 단검',          type: 'weapon', baseAtk: 8,  baseAtkLarge: 6,  baseDef: 0, safeEnchant: 0, maxEnhance: 10, sellPrice: 4000,  weight: 40000, bonuses: { hit: 12, extraDmg: 5 }, bonusEffects: ['명중+12', '추타+5'] },
  crystal_dagger:      { id: 'crystal_dagger',      name: '수정 단검',            type: 'weapon', baseAtk: 10, baseAtkLarge: 4,  baseDef: 0, maxEnhance: 10, sellPrice: 4500,  weight: 45000, bonuses: { extraDmg: 1, undeadSlayer: true }, bonusEffects: ['추타+1', '언데드 추타'] },

  // ── 한손검 (18종, type: weapon, 기사 전용) ──
  // 🛒 상점 판매 (2종)
  silver_long_sword:   { id: 'silver_long_sword',   name: '은장검',                       type: 'weapon', baseAtk: 8,  baseAtkLarge: 12, baseDef: 0, maxEnhance: 10, sellPrice: 5000,  weight: 50000, classRestriction: ['knight'], bonuses: { undeadSlayer: true }, bonusEffects: ['언데드 추타'] },
  red_knight_sword:    { id: 'red_knight_sword',    name: '붉은 기사의 검',               type: 'weapon', baseAtk: 8,  baseAtkLarge: 12, baseDef: 0, maxEnhance: 10, sellPrice: 4000,  weight: 40000, classRestriction: ['knight'], bonuses: { str: 1 }, bonusEffects: ['STR+1'] },
  // 💥 필드 드랍 (16종)
  mail_breaker:        { id: 'mail_breaker',        name: '흑기사 수색대의 검',           type: 'weapon', baseAtk: 4,  baseAtkLarge: 5,  baseDef: 0, maxEnhance: 10, sellPrice: 4000,  weight: 40000, classRestriction: ['knight'], bonuses: { hit: 10, undeadSlayer: true }, bonusEffects: ['명중+10', '언데드 추타'] },
  damascus_sword:      { id: 'damascus_sword',      name: '돌 골렘의 파편 검',            type: 'weapon', baseAtk: 10, baseAtkLarge: 11, baseDef: 0, maxEnhance: 10, sellPrice: 4500,  weight: 45000, classRestriction: ['knight'], bonuses: { unbreakable: true }, bonusEffects: ['손상되지 않음'] },
  lastabad_long_sword: { id: 'lastabad_long_sword', name: '라스타바드 근위대의 장검',     type: 'weapon', baseAtk: 10, baseAtkLarge: 12, baseDef: 0, maxEnhance: 10, sellPrice: 4000,  weight: 30000, classRestriction: ['knight'], bonuses: { hit: 1 }, bonusEffects: ['명중+1'] },
  cutlass:             { id: 'cutlass',             name: '유령선 악령의 커트라스',       type: 'weapon', baseAtk: 10, baseAtkLarge: 12, baseDef: 0, maxEnhance: 10, sellPrice: 5000,  weight: 50000, classRestriction: ['knight'], bonuses: { hit: 1, unbreakable: true }, bonusEffects: ['명중+1', '손상되지 않음'] },
  katana:              { id: 'katana',              name: '아 투바 오크의 군도',          type: 'weapon', baseAtk: 10, baseAtkLarge: 12, baseDef: 0, maxEnhance: 10, sellPrice: 4000,  weight: 40000, classRestriction: ['knight'], bonuses: { hit: 1 }, bonusEffects: ['명중+1'] },
  rapier:              { id: 'rapier',              name: '에바 시 댄서의 세검',          type: 'weapon', baseAtk: 11, baseAtkLarge: 6,  baseDef: 0, maxEnhance: 10, sellPrice: 6000,  weight: 60000, classRestriction: ['knight'] },
  shamshir:            { id: 'shamshir',            name: '테베 칼 비스의 시미터',        type: 'weapon', baseAtk: 11, baseAtkLarge: 6,  baseDef: 0, maxEnhance: 10, sellPrice: 6000,  weight: 60000, classRestriction: ['knight'], bonuses: { hit: 1 }, bonusEffects: ['명중+1'] },
  dark_elf_sword:      { id: 'dark_elf_sword',      name: '다크 엘프 제너럴의 검',       type: 'weapon', baseAtk: 12, baseAtkLarge: 12, baseDef: 0, maxEnhance: 10, sellPrice: 4000,  weight: 20000, classRestriction: ['knight'], bonuses: { hit: 3, extraDmg: 1, dex: 1, hp: 50, undeadSlayer: true }, bonusEffects: ['명중+3', '추타+1', 'DEX+1', 'HP+50', '언데드 추타'] },
  changcheon_sword:    { id: 'changcheon_sword',    name: '심연의 화령의 검',             type: 'weapon', baseAtk: 12, baseAtkLarge: 12, baseDef: 0, safeEnchant: 0, maxEnhance: 10, sellPrice: 2000,  weight: 20000, classRestriction: ['knight'], bonuses: { hit: 2, extraDmg: 5 }, bonusEffects: ['명중+2', '추타+5'] },
  mugwan_sword:        { id: 'mugwan_sword',        name: '용비 좀비 엘모어 장군의 장검', type: 'weapon', baseAtk: 13, baseAtkLarge: 10, baseDef: 0, maxEnhance: 10, sellPrice: 12000, weight: 120000, classRestriction: ['knight'], bonuses: { hit: 1, extraDmg: 2 }, bonusEffects: ['명중+1', '추타+2'] },
  thunder_sword:       { id: 'thunder_sword',       name: '볼 라이트닝의 뇌신검',        type: 'weapon', baseAtk: 13, baseAtkLarge: 12, baseDef: 0, maxEnhance: 10, sellPrice: 10000, weight: 40000, classRestriction: ['knight'], bonuses: { hit: 1, extraDmg: 1, unbreakable: true }, bonusEffects: ['명중+1', '추타+1', '손상되지 않음'] },
  kurtz_sword:         { id: 'kurtz_sword',         name: '어둠의 군주의 장검',           type: 'weapon', baseAtk: 15, baseAtkLarge: 11, baseDef: 0, maxEnhance: 10, sellPrice: 20000, weight: 40000, classRestriction: ['knight'], bonuses: { hit: 4, extraDmg: 5, unbreakable: true }, bonusEffects: ['명중+4', '추타+5', '손상되지 않음'] },
  death_blade:         { id: 'death_blade',         name: '상급 바실리스크의 이빨검',     type: 'weapon', baseAtk: 16, baseAtkLarge: 8,  baseDef: 0, maxEnhance: 10, sellPrice: 10000, weight: 100000, classRestriction: ['knight'], bonuses: { hit: 2, unbreakable: true }, bonusEffects: ['명중+2', '손상되지 않음'], minLevel: 50 },
  oriharukon_sword:    { id: 'oriharukon_sword',    name: '자이언트 가디언의 장검',       type: 'weapon', baseAtk: 16, baseAtkLarge: 10, baseDef: 0, maxEnhance: 10, sellPrice: 12000, weight: 120000, classRestriction: ['knight'], bonuses: { hit: 2 }, bonusEffects: ['명중+2'] },
  dk_flame_sword:      { id: 'dk_flame_sword',      name: '불타는 전사의 화염검',         type: 'weapon', baseAtk: 16, baseAtkLarge: 10, baseDef: 0, maxEnhance: 10, sellPrice: 20000, weight: 40000, classRestriction: ['knight'], bonuses: { hit: 5, extraDmg: 2 }, bonusEffects: ['명중+5', '추타+2'] },
  ancient_sword:       { id: 'ancient_sword',       name: '악마의 신전 저주검',           type: 'weapon', baseAtk: 35, baseAtkLarge: 20, baseDef: 0, safeEnchant: 0, maxEnhance: 10, sellPrice: 20000, weight: 30000, classRestriction: ['knight'], bonuses: { hit: 5 }, bonusEffects: ['명중+5'], minLevel: 45 },

  // ── 양손검 (11종, type: weapon, isTwoHanded) ──
  blood_great_sword:   { id: 'blood_great_sword',   name: '피의 대검',            type: 'weapon', baseAtk: 13, baseAtkLarge: 15, baseDef: 0, maxEnhance: 10, sellPrice: 16000, weight: 160000, isTwoHanded: true, classRestriction: ['knight'], bonuses: { extraDmg: 3 }, bonusEffects: ['추타+3'] },
  balrog_two_hand:     { id: 'balrog_two_hand',     name: '악마의 신전 사멸검',        type: 'weapon', baseAtk: 13, baseAtkLarge: 15, baseDef: 0, safeEnchant: 0, maxEnhance: 10, sellPrice: 6000,  weight: 60000, isTwoHanded: true, classRestriction: ['knight'], bonuses: { hit: 8, extraDmg: 11 }, bonusEffects: ['명중+8', '추타+11'] },
  changcheon_great_sword: { id: 'changcheon_great_sword', name: '심연의 지령의 대검',    type: 'weapon', baseAtk: 18, baseAtkLarge: 20, baseDef: 0, safeEnchant: 0, maxEnhance: 10, sellPrice: 9000,  weight: 90000, isTwoHanded: true, classRestriction: ['knight'], bonuses: { hit: 1, extraDmg: 6 }, bonusEffects: ['명중+1', '추타+6'] },
  duke_two_hand:       { id: 'duke_two_hand',       name: '킹 버그베어의 양손검',         type: 'weapon', baseAtk: 19, baseAtkLarge: 23, baseDef: 0, maxEnhance: 10, sellPrice: 10000, weight: 150000, isTwoHanded: true, classRestriction: ['knight'], bonuses: { hit: 1, extraDmg: 5 }, bonusEffects: ['명중+1', '추타+5'] },
  great_sword:         { id: 'great_sword',         name: '오우거의 대검',        type: 'weapon', baseAtk: 20, baseAtkLarge: 17, baseDef: 0, maxEnhance: 10, sellPrice: 5000,  weight: 150000, isTwoHanded: true, classRestriction: ['knight'], bonuses: { extraDmg: 3 }, bonusEffects: ['추타+3'] },
  tebe_two_hand:       { id: 'tebe_two_hand',       name: '테베 스핑크스의 대검', type: 'weapon', baseAtk: 21, baseAtkLarge: 26, baseDef: 0, maxEnhance: 10, sellPrice: 10000, weight: 100000, isTwoHanded: true, classRestriction: ['knight'], bonuses: { hit: 5, str: 1, con: 2 }, bonusEffects: ['명중+5', 'STR+1', 'CON+2'] },
  nightvald_two_hand:  { id: 'nightvald_two_hand',  name: '좀비 엘모어 마샬의 양손검',   type: 'weapon', baseAtk: 22, baseAtkLarge: 28, baseDef: 0, maxEnhance: 10, sellPrice: 25000, weight: 100000, isTwoHanded: true, classRestriction: ['knight'], bonuses: { hit: -1, extraDmg: 6, str: 1 }, bonusEffects: ['명중-1', '추타+6', 'STR+1'] },
  dragon_slayer:       { id: 'dragon_slayer',       name: '테라 드래곤의 대검',       type: 'weapon', baseAtk: 24, baseAtkLarge: 33, baseDef: 0, maxEnhance: 10, sellPrice: 30000, weight: 180000, isTwoHanded: true, classRestriction: ['knight'] },
  ancient_great_sword: { id: 'ancient_great_sword', name: '라스타바드 성역의 고대 대검',          type: 'weapon', baseAtk: 27, baseAtkLarge: 45, baseDef: 0, safeEnchant: 0, maxEnhance: 10, sellPrice: 35000, weight: 70000, isTwoHanded: true, classRestriction: ['knight'], bonuses: { hit: 3, extraDmg: 3 }, bonusEffects: ['명중+3', '추타+3'], minLevel: 45 },
  emperor_exec_sword:  { id: 'emperor_exec_sword',  name: '어둠의 군주의 집행검',       type: 'weapon', baseAtk: 28, baseAtkLarge: 33, baseDef: 0, safeEnchant: 0, maxEnhance: 10, sellPrice: 10000, weight: 100000, isTwoHanded: true, classRestriction: ['knight'], bonuses: { hit: 5, extraDmg: 20, str: 2, unbreakable: true }, bonusEffects: ['명중+5', '추타+20', 'STR+2', '손상되지 않음'] },
  girtas_sword:        { id: 'girtas_sword',        name: '이계의 신 기르타스의 검',         type: 'weapon', baseAtk: 43, baseAtkLarge: 53, baseDef: 0, safeEnchant: 0, maxEnhance: 10, sellPrice: 50000, weight: 100000, isTwoHanded: true, classRestriction: ['knight'], bonuses: { hit: 7, extraDmg: 30, str: 2, con: 1, unbreakable: true }, bonusEffects: ['명중+7', '추타+30', 'STR+2', 'CON+1', '손상되지 않음'] },

  // ── 활 (13종, type: bow, isTwoHanded) ──
  hunter_bow:          { id: 'hunter_bow',          name: '사냥꾼 활',            type: 'bow', baseAtk: 2, baseAtkLarge: 2, baseDef: 0, maxEnhance: 10, sellPrice: 3000,  weight: 30000, isTwoHanded: true, classRestriction: ['elf'], bonuses: { bowHit: 5, bowDmg: 1, unbreakable: true }, bonusEffects: ['활 명중+5', '활 추타+1', '손상되지 않음'] },
  black_bow:           { id: 'black_bow',           name: '다크 엘프 레인저의 활',            type: 'bow', baseAtk: 3, baseAtkLarge: 2, baseDef: 0, maxEnhance: 10, sellPrice: 5000,  weight: 40000, isTwoHanded: true, classRestriction: ['elf'], bonuses: { bowHit: 5, bowDmg: 2, unbreakable: true }, bonusEffects: ['활 명중+5', '활 추타+2', '손상되지 않음'] },
  crossbow:            { id: 'crossbow',            name: '오크 스카우트의 활',          type: 'bow', baseAtk: 3, baseAtkLarge: 2, baseDef: 0, maxEnhance: 10, sellPrice: 4000,  weight: 50000, isTwoHanded: true, classRestriction: ['knight', 'elf'], bonuses: { bowHit: 3, bowDmg: 2, unbreakable: true }, bonusEffects: ['활 명중+3', '활 추타+2', '손상되지 않음'] },
  long_bow:            { id: 'long_bow',            name: '어둠 숲지기의 장궁',                type: 'bow', baseAtk: 3, baseAtkLarge: 3, baseDef: 0, maxEnhance: 10, sellPrice: 5000,  weight: 40000, isTwoHanded: true, classRestriction: ['elf'], bonuses: { bowDmg: 3, unbreakable: true }, bonusEffects: ['활 추타+3', '손상되지 않음'] },
  flame_bow:           { id: 'flame_bow',           name: '불타는 궁수의 화궁',            type: 'bow', baseAtk: 3, baseAtkLarge: 3, baseDef: 0, maxEnhance: 10, sellPrice: 20000, weight: 30000, isTwoHanded: true, classRestriction: ['elf'], bonuses: { bowHit: 2, bowDmg: 4, unbreakable: true, undeadSlayer: true }, bonusEffects: ['활 명중+2', '활 추타+4', '손상되지 않음', '언데드 추타'], minLevel: 50 },
  crimson_crossbow:    { id: 'crimson_crossbow',    name: '해골 궁수의 쇠뇌',     type: 'bow', baseAtk: 3, baseAtkLarge: 3, baseDef: 0, maxEnhance: 10, sellPrice: 2000,  weight: 25000, isTwoHanded: true, classRestriction: ['elf'], bonuses: { bowHit: 1, unbreakable: true }, bonusEffects: ['활 명중+1', '손상되지 않음'], minLevel: 40 },
  moon_long_bow:       { id: 'moon_long_bow',       name: '오염 된 엘프의 신궁',            type: 'bow', baseAtk: 3, baseAtkLarge: 3, baseDef: 0, maxEnhance: 10, sellPrice: 2500,  weight: 25000, isTwoHanded: true, classRestriction: ['elf'], bonuses: { bowHit: 4, bowDmg: 4, unbreakable: true }, bonusEffects: ['활 명중+4', '활 추타+4', '손상되지 않음'] },
  changcheon_bow:      { id: 'changcheon_bow',      name: '심연의 풍령의 활',            type: 'bow', baseAtk: 3, baseAtkLarge: 3, baseDef: 0, safeEnchant: 0, maxEnhance: 10, sellPrice: 35000, weight: 60000, isTwoHanded: true, classRestriction: ['elf'], bonuses: { bowHit: 2, bowDmg: 8, unbreakable: true }, bonusEffects: ['활 명중+2', '활 추타+8', '손상되지 않음'] },
  tebe_bow:            { id: 'tebe_bow',            name: '테베 만드라고라의 활',    type: 'bow', baseAtk: 3, baseAtkLarge: 3, baseDef: 0, maxEnhance: 10, sellPrice: 10000, weight: 5000, isTwoHanded: true, classRestriction: ['elf'], bonuses: { bowDmg: 1, int: 2, wis: 1, unbreakable: true }, bonusEffects: ['활 추타+1', 'INT+2', 'WIS+1', '손상되지 않음'] },
  black_king_bow:      { id: 'black_king_bow',      name: '어둠의 군주의 장궁',              type: 'bow', baseAtk: 4, baseAtkLarge: 3, baseDef: 0, maxEnhance: 10, sellPrice: 35000, weight: 50000, isTwoHanded: true, classRestriction: ['elf'], bonuses: { bowHit: 4, bowDmg: 6, unbreakable: true }, bonusEffects: ['활 명중+4', '활 추타+6', '손상되지 않음'] },
  sayha_bow:           { id: 'sayha_bow',           name: '풍령의 주인의 활',          type: 'bow', baseAtk: 4, baseAtkLarge: 4, baseDef: 0, maxEnhance: 10, sellPrice: 25000, weight: 30000, isTwoHanded: true, classRestriction: ['elf'], bonuses: { bowHit: 2, bowDmg: 5, unbreakable: true }, bonusEffects: ['활 명중+2', '활 추타+5', '손상되지 않음'] },
  destruction_bow:     { id: 'destruction_bow',     name: '부패한 해골 궁수의 장궁',          type: 'bow', baseAtk: 4, baseAtkLarge: 3, baseDef: 0, maxEnhance: 10, sellPrice: 500,   weight: 5000, isTwoHanded: true, classRestriction: ['elf'], bonuses: { bowHit: 7, bowDmg: 5, unbreakable: true }, bonusEffects: ['활 명중+7', '활 추타+5', '손상되지 않음'] },
  salcheon_bow:        { id: 'salcheon_bow',        name: '정예 다크 엘프 패잔병의 궁',            type: 'bow', baseAtk: 5, baseAtkLarge: 5, baseDef: 0, maxEnhance: 10, sellPrice: 45000, weight: 30000, isTwoHanded: true, classRestriction: ['elf'], bonuses: { bowHit: 8, bowDmg: 8, unbreakable: true }, bonusEffects: ['활 명중+8', '활 추타+8', '손상되지 않음'], minLevel: 52 },

  // ── 지팡이 (14종, type: staff, 마법사 전용) ──
  crystal_staff:       { id: 'crystal_staff',       name: '수정 지팡이',          type: 'staff', baseAtk: 1, baseAtkLarge: 1, baseDef: 0, maxEnhance: 10, sellPrice: 1500,  weight: 15000, classRestriction: ['wizard'], bonuses: { mpr: 10, unbreakable: true }, bonusEffects: ['MPR+10', '손상되지 않음'] },
  black_wizard_staff:  { id: 'black_wizard_staff',  name: '암흑 마법사의 스태프',  type: 'staff', baseAtk: 1, baseAtkLarge: 1, baseDef: 0, maxEnhance: 10, sellPrice: 4000,  weight: 15000, classRestriction: ['wizard'], bonuses: { sp: 2, mpr: 5, unbreakable: true }, bonusEffects: ['SP+2', 'MPR+5', '손상되지 않음'] },
  raia_wand:           { id: 'raia_wand',           name: '라스타바드 조련사의 완드', type: 'staff', baseAtk: 1, baseAtkLarge: 1, baseDef: 0, maxEnhance: 10, sellPrice: 10000, weight: 15000, classRestriction: ['wizard'], bonuses: { hit: -3, sp: 1, mpr: 10, unbreakable: true, haste: true }, bonusEffects: ['명중-3', 'SP+1', 'MPR+10', '손상되지 않음', '헤이스트'] },
  black_crystal_orb:   { id: 'black_crystal_orb',   name: '칠흑의 수정구',         type: 'staff', baseAtk: 1, baseAtkLarge: 1, baseDef: 0, maxEnhance: 10, sellPrice: 1500,  weight: 15000, classRestriction: ['wizard'], bonuses: { sp: 1, unbreakable: true }, bonusEffects: ['SP+1', '손상되지 않음'] },
  demon_staff:         { id: 'demon_staff',         name: '악마의 신전 데몬 스태프',         type: 'staff', baseAtk: 1, baseAtkLarge: 1, baseDef: 0, safeEnchant: 0, maxEnhance: 10, sellPrice: 35000, weight: 1000, classRestriction: ['wizard'], bonuses: { sp: 5, unbreakable: true }, bonusEffects: ['SP+5', '손상되지 않음'] },
  ice_queen_staff:     { id: 'ice_queen_staff',     name: '얼음 여왕의 지팡이',    type: 'staff', baseAtk: 2, baseAtkLarge: 3, baseDef: 0, maxEnhance: 10, sellPrice: 20000, weight: 20000, classRestriction: ['wizard'], bonuses: { hit: -1, unbreakable: true }, bonusEffects: ['명중-1', '손상되지 않음', '아이시클 패시브'] },
  lastabad_staff:      { id: 'lastabad_staff',      name: '라스타바드 스태프',     type: 'staff', baseAtk: 2, baseAtkLarge: 3, baseDef: 0, maxEnhance: 10, sellPrice: 4000,  weight: 15000, classRestriction: ['wizard'], bonuses: { sp: 1, mpr: 8, unbreakable: true }, bonusEffects: ['SP+1', 'MPR+8', '손상되지 않음'] },
  beres_staff:         { id: 'beres_staff',         name: '베레스의 악마 지팡이',       type: 'staff', baseAtk: 2, baseAtkLarge: 3, baseDef: 0, safeEnchant: 0, maxEnhance: 10, sellPrice: 30000, weight: 15000, classRestriction: ['wizard'], bonuses: { sp: 2, mpr: 10, unbreakable: true }, bonusEffects: ['SP+2', 'MPR+10', '손상되지 않음'] },
  baphomet_staff:      { id: 'baphomet_staff',      name: '포노스 오크 주술사의 지팡이',     type: 'staff', baseAtk: 2, baseAtkLarge: 3, baseDef: 0, safeEnchant: 0, maxEnhance: 10, sellPrice: 25000, weight: 15000, classRestriction: ['wizard'], bonuses: { hit: 7, extraDmg: 5, unbreakable: true }, bonusEffects: ['명중+7', '추타+5', '손상되지 않음'] },
  mana_staff:          { id: 'mana_staff',          name: '심해의 마나 지팡이',     type: 'staff', baseAtk: 3, baseAtkLarge: 3, baseDef: 0, maxEnhance: 10, sellPrice: 20000, weight: 15000, classRestriction: ['wizard'], bonuses: { hit: -3, unbreakable: true }, bonusEffects: ['명중-3', '손상되지 않음', 'MP 흡수'] },
  steel_mana_staff:    { id: 'steel_mana_staff',    name: '지저 비홀더의 마나 지팡이', type: 'staff', baseAtk: 3, baseAtkLarge: 3, baseDef: 0, maxEnhance: 10, sellPrice: 25000, weight: 30000, classRestriction: ['wizard'], bonuses: { hit: 2, unbreakable: true }, bonusEffects: ['명중+2', '손상되지 않음', 'MP 흡수'] },
  changcheon_staff:    { id: 'changcheon_staff',    name: '심연의 수령의 지팡이',         type: 'staff', baseAtk: 8, baseAtkLarge: 5, baseDef: 0, safeEnchant: 0, maxEnhance: 10, sellPrice: 35000, weight: 80000, classRestriction: ['wizard'], bonuses: { extraDmg: 5, sp: 1, mpr: 8, unbreakable: true }, bonusEffects: ['추타+5', 'SP+1', 'MPR+8', '손상되지 않음'] },
  girtas_staff:        { id: 'girtas_staff',        name: '이계의 신 기르타스의 지팡이', type: 'staff', baseAtk: 15, baseAtkLarge: 15, baseDef: 0, safeEnchant: 0, maxEnhance: 10, sellPrice: 50000, weight: 100000, isTwoHanded: true, classRestriction: ['wizard'], bonuses: { hit: 5, extraDmg: 10, int: 2, wis: 2, mpr: 15, unbreakable: true }, bonusEffects: ['명중+5', '추타+10', 'INT+2', 'WIS+2', 'MPR+15', '손상되지 않음'] },


  /* ── 내피 (1종, type: tshirt) ── */
  tshirt                  : { id: 'tshirt', name: '훈련병의 면제 내피', type: 'tshirt', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 500, weight: 5000 },

  /* ── 갑옷 (30종, type: armor) ── */
  dark_forester_armor     : { id: 'dark_forester_armor', name: '어둠의 숲 정찰대 사슬 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 4, maxEnhance: 10, sellPrice: 3000, weight: 30000, bonuses: { mp: 10 }, bonusEffects: ['MP +10'] },
  lastabad_studded        : { id: 'lastabad_studded', name: '라스타바드 징박힌 가죽 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 4, maxEnhance: 10, sellPrice: 15000, weight: 150000 },
  bone_armor              : { id: 'bone_armor', name: '해골 무덤의 뼈갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 5, safeEnchant: 0, maxEnhance: 10, sellPrice: 15000, weight: 150000 },
  elven_chain_armor       : { id: 'elven_chain_armor', name: '요정족 사슬 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 5, safeEnchant: 6, maxEnhance: 10, sellPrice: 15000, weight: 150000, classRestriction: ['elf'] },
  demon_armor             : { id: 'demon_armor', name: '악마의 신전 데몬 가죽 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 6, maxEnhance: 10, sellPrice: 25000, weight: 250000 },
  elven_plate             : { id: 'elven_plate', name: '요정족 정예 판금 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 6, safeEnchant: 6, maxEnhance: 10, sellPrice: 25000, weight: 250000, classRestriction: ['elf'] },
  dk_armor                : { id: 'dk_armor', name: '용의 계곡 데스나이트의 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 7, maxEnhance: 10, sellPrice: 25000, weight: 250000, classRestriction: ['knight'] },
  steel_plate_armor       : { id: 'steel_plate_armor', name: '실버나이트 정예 판금 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 7, maxEnhance: 10, sellPrice: 47000, weight: 470000, classRestriction: ['knight'] },
  plate_armor             : { id: 'plate_armor', name: '기사용 강철 판금 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 7, maxEnhance: 10, sellPrice: 45000, weight: 450000, classRestriction: ['knight'] },
  kurtz_armor             : { id: 'kurtz_armor', name: '말하는 섬 커츠의 총사 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 7, maxEnhance: 10, sellPrice: 25000, weight: 250000, classRestriction: ['knight'] },
  demon_lord_robe         : { id: 'demon_lord_robe', name: '마령군왕의 보전 사슬 옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 8, safeEnchant: 6, maxEnhance: 10, sellPrice: 2000, weight: 20000 },
  crystal_armor           : { id: 'crystal_armor', name: '수정 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 8, maxEnhance: 10, sellPrice: 35000, weight: 350000, classRestriction: ['knight', 'elf'] },
  water_dragon_armor      : { id: 'water_dragon_armor', name: '수룡의 푸른 비늘 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 9, maxEnhance: 10, sellPrice: 30000, weight: 300000, bonusEffects: ['물저항+20'] },
  earth_dragon_armor      : { id: 'earth_dragon_armor', name: '지룡의 단단한 비늘 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 9, maxEnhance: 10, sellPrice: 30000, weight: 300000, bonusEffects: ['땅저항+20'] },
  wind_dragon_armor       : { id: 'wind_dragon_armor', name: '풍룡의 가벼운 비늘 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 9, maxEnhance: 10, sellPrice: 30000, weight: 300000, bonusEffects: ['바람저항+20'] },
  fire_dragon_armor       : { id: 'fire_dragon_armor', name: '화룡의 불타는 비늘 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 9, maxEnhance: 10, sellPrice: 30000, weight: 300000, bonusEffects: ['불저항+20'] },
  leather_armor           : { id: 'leather_armor', name: '가죽 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 7000, weight: 70000 }, // DEPRECATED
  orc_ring_mail           : { id: 'orc_ring_mail', name: '오크족 고리 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 25000, weight: 250000 }, // DEPRECATED
  nameless_robe           : { id: 'nameless_robe', name: '무명 로브', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 1000, weight: 10000 }, // DEPRECATED
  ring_mail               : { id: 'ring_mail', name: '고리 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 25000, weight: 250000 }, // DEPRECATED
  studded_leather_armor   : { id: 'studded_leather_armor', name: '징박힌 가죽 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 15000, weight: 150000 }, // DEPRECATED
  lastabad_leather        : { id: 'lastabad_leather', name: '라스타바드 레더 아머', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 7000, weight: 70000 }, // DEPRECATED
  scale_armor             : { id: 'scale_armor', name: '비늘 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 4, maxEnhance: 10, sellPrice: 25000, weight: 250000 }, // DEPRECATED
  orc_chain_armor         : { id: 'orc_chain_armor', name: '오크족 사슬 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 4, maxEnhance: 10, sellPrice: 30000, weight: 300000 }, // DEPRECATED
  elven_breastplate       : { id: 'elven_breastplate', name: '요정족 흉갑', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 4, safeEnchant: 6, maxEnhance: 10, sellPrice: 10000, weight: 100000 }, // DEPRECATED
  chain_armor             : { id: 'chain_armor', name: '사슬 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 5, maxEnhance: 10, sellPrice: 30000, weight: 300000 }, // DEPRECATED
  mr_chain_armor          : { id: 'mr_chain_armor', name: '마법 방어 사슬 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 5, maxEnhance: 10, sellPrice: 30000, weight: 300000 }, // DEPRECATED
  blue_pirate_armor       : { id: 'blue_pirate_armor', name: '푸른 해적 가죽갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 5, maxEnhance: 10, sellPrice: 15000, weight: 150000 }, // DEPRECATED
  band_armor              : { id: 'band_armor', name: '띠 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 6, maxEnhance: 10, sellPrice: 35000, weight: 350000 }, // DEPRECATED
  bronze_plate            : { id: 'bronze_plate', name: '청동 판금 갑옷', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 6, maxEnhance: 10, sellPrice: 45000, weight: 450000 }, // DEPRECATED

  /* ── 투구 (11종, type: helmet) ── */
  demon_helm              : { id: 'demon_helm', name: '데몬의 투구', type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 5000, weight: 50000 },
  dk_helmet               : { id: 'dk_helmet', name: '데스나이트의 투구', type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 5000, weight: 50000, classRestriction: ['knight'] },
  mr_helm                 : { id: 'mr_helm', name: '마법 방어 투구', type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 3500, weight: 35000, bonuses: { mr: 4 }, bonusEffects: ['MR +4'] },
  mugwan_helm             : { id: 'mugwan_helm', name: '무관의 투구', type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, safeEnchant: 6, maxEnhance: 10, sellPrice: 5000, weight: 50000, classRestriction: ['knight'], bonuses: { mp: 10 }, bonusEffects: ['MP +10', 'Lv40~'] },
  baranka_helm            : { id: 'baranka_helm', name: '바란카의 투구', type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 5000, weight: 50000, classRestriction: ['knight', 'elf'], bonuses: { con: 1 }, bonusEffects: ['CON +1'] },
  red_knight_hood         : { id: 'red_knight_hood', name: '붉은 기사의 두건', type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, safeEnchant: 6, maxEnhance: 10, sellPrice: 2000, weight: 20000, classRestriction: ['knight'] },
  kurtz_helmet            : { id: 'kurtz_helmet', name: '커츠의 투구', type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 5000, weight: 50000, classRestriction: ['knight'] },
  skull_helm              : { id: 'skull_helm', name: '해골투구', type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, safeEnchant: 0, maxEnhance: 10, sellPrice: 3000, weight: 30000 },
  dwarf_iron_helm         : { id: 'dwarf_iron_helm', name: '난쟁이족 철 투구', type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 4000, weight: 40000 }, // DEPRECATED
  orc_helm                : { id: 'orc_helm', name: '오크족 투구', type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 3000, weight: 30000 }, // DEPRECATED
  basic_helm              : { id: 'basic_helm', name: '투구', type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 3000, weight: 30000 }, // DEPRECATED

  /* ── 망토 (17종, type: cloak) ── */
  vampire_cloak           : { id: 'vampire_cloak', name: '뱀파이어의 망토', type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 10000, weight: 100000 },
  magic_cloak             : { id: 'magic_cloak', name: '마법 항마의 망토', type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 1000, weight: 10000, bonuses: { mr: 10 }, bonusEffects: ['MR +10'] },
  wolf_cloak              : { id: 'wolf_cloak', name: '늑대가죽 망토', type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 500, weight: 5000 },
  aden_cloak              : { id: 'aden_cloak', name: '아덴 기사단의 망토', type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 1000, weight: 10000 },
  black_tiger_cloak       : { id: 'black_tiger_cloak', name: '블랙 티거 가죽 망토', type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 500, weight: 5000, bonuses: { hpr: 2 }, bonusEffects: ['HPR+2'] },
  earth_cloak             : { id: 'earth_cloak', name: '대지의 망토', type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 2000, weight: 20000, bonuses: { mpr: 2 }, bonusEffects: ['MPR+2', '땅저항+10'] },
  water_cloak             : { id: 'water_cloak', name: '물결의 망토', type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 2000, weight: 20000, bonuses: { mpr: 2 }, bonusEffects: ['MPR+2', '물저항+10'] },
  wind_cloak              : { id: 'wind_cloak', name: '바람의 망토', type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 2000, weight: 20000, bonuses: { mpr: 2 }, bonusEffects: ['MPR+2', '바람저항+10'] },
  fire_cloak              : { id: 'fire_cloak', name: '열화의 망토', type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 2000, weight: 20000, bonuses: { mpr: 2 }, bonusEffects: ['MPR+2', '불저항+10'] },
  chaos_cloak             : { id: 'chaos_cloak', name: '혼돈의 망토', type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, safeEnchant: 0, maxEnhance: 10, sellPrice: 500, weight: 5000, bonuses: { mr: 10 }, bonusEffects: ['MR +10', 'Lv45~'] },
  protection_cloak        : { id: 'protection_cloak', name: '경비대의 가죽 보호 망토', type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 1000, weight: 10000 },
  queen_ant_wing          : { id: 'queen_ant_wing', name: '거대 여왕 개미의 금빛 날개', type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 4, maxEnhance: 10, sellPrice: 1000, weight: 10000, classRestriction: ['knight', 'elf'], bonuses: { hp: 50, mr: 15 }, bonusEffects: ['HP +50', 'MR +15'] },
  demon_lord_cloak        : { id: 'demon_lord_cloak', name: '명법군왕의 망토', type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 5, maxEnhance: 10, sellPrice: 1000, weight: 10000 },
  balrog_cloak            : { id: 'balrog_cloak', name: '발록의 핏빛 망토', type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 5, maxEnhance: 10, sellPrice: 1000, weight: 10000, bonusEffects: ['Lv52~'] },
  orc_cloak               : { id: 'orc_cloak', name: '오크족 망토', type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 1000, weight: 10000 }, // DEPRECATED
  dwarf_cloak             : { id: 'dwarf_cloak', name: '난쟁이족 망토', type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 1000, weight: 10000 }, // DEPRECATED
  elven_cloak             : { id: 'elven_cloak', name: '요정족 망토', type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, safeEnchant: 6, maxEnhance: 10, sellPrice: 1000, weight: 10000 }, // DEPRECATED

  /* ── 장갑 (16종, type: gloves) ── */
  ice_gloves              : { id: 'ice_gloves', name: '심해 빙령의 마력 장갑', type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 1800, weight: 18000, bonuses: { magicDmg: 1, mpr: 1 }, bonusEffects: ['마법 추타+1', 'MPR+1', '물저항+4'], classRestriction: ['wizard'] },
  shadow_gloves           : { id: 'shadow_gloves', name: '지저 암령의 마력 장갑', type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 1800, weight: 18000, bonuses: { magicDmg: 1, mpr: 1 }, bonusEffects: ['마법 추타+1', 'MPR+1', '땅저항+4'], classRestriction: ['wizard'] },
  flame_gloves            : { id: 'flame_gloves', name: '용계 염령의 마력 장갑', type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 1800, weight: 18000, bonuses: { magicDmg: 1, mpr: 1 }, bonusEffects: ['마법 추타+1', 'MPR+1', '불저항+4'], classRestriction: ['wizard'] },
  wind_gloves             : { id: 'wind_gloves', name: '심연 풍령의 마력 장갑', type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 1800, weight: 18000, bonuses: { magicDmg: 1, mpr: 1 }, bonusEffects: ['마법 추타+1', 'MPR+1', '바람저항+4'], classRestriction: ['wizard'] },
  power_glove             : { id: 'power_glove', name: '황혼 산맥 거인의 완력 장갑', type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 1800, weight: 18000, bonuses: { str: 2 }, bonusEffects: ['STR +2'] },
  steel_gloves            : { id: 'steel_gloves', name: '기사용 강철 장갑', type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 4000, weight: 40000, classRestriction: ['knight'] },
  yeti_gloves             : { id: 'yeti_gloves', name: '설벽인의 얼음 가죽 장갑', type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 2000, weight: 20000, bonuses: { hp: 5 }, bonusEffects: ['HP +5', '물속성 저항+10'] },
  pirate_gloves           : { id: 'pirate_gloves', name: '수습 마법사의 무늬 장갑', type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 1500, weight: 15000, classRestriction: ['wizard'] },
  demon_gloves            : { id: 'demon_gloves', name: '악마의 신전 데몬 장갑', type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 1500, weight: 15000 },
  dk_gloves               : { id: 'dk_gloves', name: '용의 계곡 데스나이트의 장갑', type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 1500, weight: 15000, classRestriction: ['knight'] },
  kurtz_gloves            : { id: 'kurtz_gloves', name: '말하는 섬 커츠의 총사 장갑', type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 1500, weight: 15000, classRestriction: ['knight'] },
  death_scale             : { id: 'death_scale', name: '부패의 신전 사멸의 비늘 장갑', type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, safeEnchant: 0, maxEnhance: 10, sellPrice: 500, weight: 5000, bonuses: { str: 1, dex: 1 }, bonusEffects: ['STR +1', 'DEX +1', 'Lv45~'] },
  chaos_touch             : { id: 'chaos_touch', name: '심연의 소굴 혼돈의 손길', type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, safeEnchant: 0, maxEnhance: 10, sellPrice: 500, weight: 5000, bonuses: { str: 1, bowHit: 5 }, bonusEffects: ['STR +1', '원거리 명중+5', 'Lv45~'] },
  assassin_gloves         : { id: 'assassin_gloves', name: '암살군왕의 흡혈 장갑', type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 4, safeEnchant: 6, maxEnhance: 10, sellPrice: 2500, weight: 25000 },
  basic_gloves            : { id: 'basic_gloves', name: '장갑', type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 1000, weight: 10000 }, // DEPRECATED
  leather_gloves          : { id: 'leather_gloves', name: '가죽 장갑', type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 500, weight: 5000 }, // DEPRECATED

  /* ── 부츠 (10종, type: boots) ── */
  lastabad_boots          : { id: 'lastabad_boots', name: '라스타바드 군용 가죽 부츠', type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 1000, weight: 10000 },
  pirate_boots            : { id: 'pirate_boots', name: '유령선 푸른 해적의 부츠', type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 1500, weight: 15000 },
  steel_boots             : { id: 'steel_boots', name: '훈련병의 강철 부츠', type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 5000, weight: 50000 },
  demon_boots             : { id: 'demon_boots', name: '데몬의 부츠', type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 1500, weight: 15000 },
  dk_boots                : { id: 'dk_boots', name: '용의 계곡 데스나이트의 부츠', type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 1500, weight: 15000, classRestriction: ['knight'] },
  baranka_boots           : { id: 'baranka_boots', name: '악마의 신전 데몬 부츠', type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 1000, weight: 10000 },
  kurtz_boots             : { id: 'kurtz_boots', name: '말하는 섬 커츠의 총사 부츠', type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 1500, weight: 15000, classRestriction: ['knight'] },
  beast_lord_boots        : { id: 'beast_lord_boots', name: '마수군왕의 사령 부츠', type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 4, safeEnchant: 6, maxEnhance: 10, sellPrice: 3000, weight: 30000 },
  short_boots             : { id: 'short_boots', name: '짧은 부츠', type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 1000, weight: 10000 }, // DEPRECATED
  boots                   : { id: 'boots', name: '부츠', type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 1500, weight: 15000 }, // DEPRECATED

  /* ── 방패 (8종, type: shield) ── */
  medusa_shield           : { id: 'medusa_shield', name: '지저 대왕 메두사의 방패', type: 'shield', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 8000, weight: 80000, bonusEffects: ['근거리 회피율 +3'] },
  steel_shield            : { id: 'steel_shield', name: '기사용 강철 방패', type: 'shield', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 14000, weight: 140000, classRestriction: ['knight'] },
  gollack_shield          : { id: 'gollack_shield', name: '골각 방패', type: 'shield', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, safeEnchant: 0, maxEnhance: 10, sellPrice: 3000, weight: 30000 },
  eva_shield              : { id: 'eva_shield', name: '에바의 방패', type: 'shield', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 5000, weight: 50000, bonuses: { hp: 20, haste: true }, bonusEffects: ['HP +20', '헤이스트', 'Lv40~'] },
  small_shield            : { id: 'small_shield', name: '작은 방패', type: 'shield', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 3000, weight: 30000 }, // DEPRECATED
  orc_shield              : { id: 'orc_shield', name: '우럭하이 방패', type: 'shield', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 5000, weight: 50000 }, // DEPRECATED
  dwarf_shield            : { id: 'dwarf_shield', name: '난쟁이족 둥근 방패', type: 'shield', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 10000, weight: 100000 }, // DEPRECATED
  large_shield            : { id: 'large_shield', name: '큰 방패', type: 'shield', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 10000, weight: 100000 }, // DEPRECATED

  /* ── 목걸이 (9종, type: necklace) ── 강화 불가 ── */
  old_str_necklace        : { id: 'old_str_necklace', name: '낡은 완력의 목걸이', type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, safeEnchant: 0, maxEnhance: 0, sellPrice: 500, weight: 5000, bonuses: { str: 1, dex: -2 }, bonusEffects: ['STR +1', 'DEX -2'] },
  old_dex_necklace        : { id: 'old_dex_necklace', name: '낡은 민첩의 목걸이', type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, safeEnchant: 0, maxEnhance: 0, sellPrice: 500, weight: 5000, bonuses: { con: -2, dex: 1 }, bonusEffects: ['CON -2', 'DEX +1'] },
  old_wis_necklace        : { id: 'old_wis_necklace', name: '낡은 지혜의 목걸이', type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, safeEnchant: 0, maxEnhance: 0, sellPrice: 500, weight: 5000, bonuses: { wis: 1 }, bonusEffects: ['WIS +1'] },
  old_con_necklace        : { id: 'old_con_necklace', name: '낡은 체력의 목걸이', type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, safeEnchant: 0, maxEnhance: 0, sellPrice: 500, weight: 5000, bonuses: { str: -2, con: 1 }, bonusEffects: ['STR -2', 'CON +1'] },
  power_necklace          : { id: 'power_necklace', name: '완력의 목걸이', type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, safeEnchant: 0, maxEnhance: 0, sellPrice: 500, weight: 5000, bonuses: { str: 1 }, bonusEffects: ['STR +1'] },
  dex_necklace            : { id: 'dex_necklace', name: '민첩의 목걸이', type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, safeEnchant: 0, maxEnhance: 0, sellPrice: 500, weight: 5000, bonuses: { dex: 1 }, bonusEffects: ['DEX +1'] },
  wis_necklace            : { id: 'wis_necklace', name: '지혜의 목걸이', type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, safeEnchant: 0, maxEnhance: 0, sellPrice: 500, weight: 5000, bonuses: { wis: 1 }, bonusEffects: ['WIS +1'] },
  health_necklace         : { id: 'health_necklace', name: '체력의 목걸이', type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, safeEnchant: 0, maxEnhance: 0, sellPrice: 500, weight: 5000, bonuses: { con: 1 }, bonusEffects: ['CON +1'] },
  orc_warrior_necklace    : { id: 'orc_warrior_necklace', name: '오크 투사의 목걸이', type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, safeEnchant: 0, maxEnhance: 0, sellPrice: 500, weight: 5000, bonuses: { hp: 20 }, bonusEffects: ['HP +20', 'Lv10~'] },

  /* ── 반지 (3종, type: ring) ── 강화 불가 ── */
  antimagic_ring          : { id: 'antimagic_ring', name: '항마의 반지', type: 'ring', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, safeEnchant: 0, maxEnhance: 0, sellPrice: 300, weight: 3000, bonuses: { mr: 5 }, bonusEffects: ['MR +5'] },
  water_ring              : { id: 'water_ring', name: '수령의 반지', type: 'ring', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, safeEnchant: 0, maxEnhance: 0, sellPrice: 300, weight: 3000, bonusEffects: ['물저항+30'] },
  banish_ring             : { id: 'banish_ring', name: '멸마의 반지', type: 'ring', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, safeEnchant: 0, maxEnhance: 0, sellPrice: 300, weight: 3000 }, // DEPRECATED

  /* ── 벨트 (8종, type: belt) ── 강화 불가 ── */
  old_soul_belt           : { id: 'old_soul_belt', name: '낡은 영혼의 벨트', type: 'belt', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, safeEnchant: 0, maxEnhance: 0, sellPrice: 500, weight: 50000, bonuses: { hp: 15, mp: 15 }, bonusEffects: ['HP +15', 'MP +15', 'Lv15~'] },
  old_body_belt           : { id: 'old_body_belt', name: '낡은 신체의 벨트', type: 'belt', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, safeEnchant: 0, maxEnhance: 0, sellPrice: 5000, weight: 50000, bonuses: { hp: 30 }, bonusEffects: ['HP +30', 'Lv15~'] },
  soul_belt               : { id: 'soul_belt', name: '영혼의 벨트', type: 'belt', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, safeEnchant: 0, maxEnhance: 0, sellPrice: 5000, weight: 50000, bonuses: { hp: 25, mp: 25 }, bonusEffects: ['HP +25', 'MP +25', 'Lv30~'] },
  body_belt               : { id: 'body_belt', name: '신체의 벨트', type: 'belt', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, safeEnchant: 0, maxEnhance: 0, sellPrice: 5000, weight: 50000, bonuses: { hp: 50 }, bonusEffects: ['HP +50', 'Lv30~'] },
  courage_belt            : { id: 'courage_belt', name: '용기의 벨트', type: 'belt', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, safeEnchant: 0, maxEnhance: 0, sellPrice: 5000, weight: 50000, classRestriction: ['knight'], bonuses: { hp: 30 }, bonusEffects: ['HP +30', 'Lv45~'] },
  shining_soul_belt       : { id: 'shining_soul_belt', name: '빛나는 영혼의 벨트', type: 'belt', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, safeEnchant: 0, maxEnhance: 0, sellPrice: 5000, weight: 50000, bonuses: { hp: 20, mp: 20, hpr: 1, mpr: 1 }, bonusEffects: ['HP +20', 'MP +20', 'HPR+1', 'MPR+1', 'Lv30~'] },
  shining_body_belt       : { id: 'shining_body_belt', name: '빛나는 신체의 벨트', type: 'belt', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, safeEnchant: 0, maxEnhance: 0, sellPrice: 5000, weight: 50000, bonuses: { hp: 50, hpr: 1 }, bonusEffects: ['HP +50', 'HPR+1', 'Lv30~'] },
  giant_ring_belt         : { id: 'giant_ring_belt', name: '에이션트 자이언트의 반지', type: 'belt', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, safeEnchant: 0, maxEnhance: 0, sellPrice: 5000, weight: 50000, bonuses: { str: 1 }, bonusEffects: ['STR +1'] },


};

// ── Equipment Templates (통합) ──
// CSV 데이터 위에 수동 정의를 덮어씀 (수동 정의 우선)
// 수동 정의에 safeEnchant 미지정 시 L1J 기본값 적용 (무기=6, 방어구=4)
function defaultSafeEnchant(t: Omit<EquipmentTemplate, 'safeEnchant'> & { safeEnchant?: number }): EquipmentTemplate {
  if (t.safeEnchant != null) return t as EquipmentTemplate;
  const isWeapon = t.type === 'weapon' || t.type === 'bow' || t.type === 'staff';
  return { ...t, safeEnchant: isWeapon ? 6 : 4 } as EquipmentTemplate;
}

// ── 선택된 L1J 무기 ID (weapons_review.txt 기반) ──
const SELECTED_CSV_WEAPON_IDS = new Set([
  'w_6','w_8','w_9','w_11','w_22','w_29','w_30','w_37','w_38','w_39',
  'w_40','w_41','w_42','w_43','w_44','w_49','w_54','w_56','w_57','w_58',
  'w_59','w_60','w_61','w_62','w_64','w_66','w_67','w_68',
  'w_115','w_116','w_117','w_118','w_119','w_121','w_122','w_123','w_124','w_126','w_127',
  'w_169','w_177','w_180','w_181','w_184','w_189','w_190','w_191',
  'w_203','w_204','w_205','w_213','w_217',
  'w_231','w_232','w_233','w_238','w_239',
  'w_264','w_266','w_267','w_707',
]);

// ── 선택된 L1J 방어구 ID (armors_review.txt 기반, 288종) ──
const SELECTED_CSV_ARMOR_IDS = new Set([
  'a_20086','a_20087','a_20088','a_20084','a_20085','a_21028','a_21029','a_21030','a_21031','a_21032',
  'a_21033','a_120085','a_20095','a_20133','a_20092','a_20152','a_20367','a_20093','a_20368','a_20108',
  'a_20119','a_20130','a_20153','a_20395','a_21172','a_21176','a_21180','a_21184','a_20127','a_20146',
  'a_20156','a_20159','a_20369','a_20109','a_20116','a_20117','a_20128','a_20144','a_20157','a_21174',
  'a_21178','a_21182','a_21186','a_120128','a_20091','a_20100','a_20150','a_20154','a_20160','a_20099',
  'a_20105','a_20129','a_20138','a_20158','a_21173','a_21177','a_21181','a_21185','a_20124','a_20137',
  'a_20151','a_120137','a_20098','a_20103','a_20104','a_20113','a_20121','a_20123','a_21218','a_20107',
  'a_20111','a_20106','a_20131','a_20390','a_20006','a_20010','a_20041','a_20042','a_20045','a_21039',
  'a_21109','a_20009','a_20011','a_20012','a_20017','a_20018','a_20020','a_20022','a_20025','a_20027',
  'a_20029','a_20033','a_20040','a_120011','a_20030','a_20048','a_20031','a_20402','a_20057','a_20062',
  'a_20049','a_21059','a_20053','a_20054','a_20059','a_20061','a_20063','a_20066','a_20068','a_20071',
  'a_20075','a_20078','a_21237','a_120054','a_120059','a_120061','a_120071','a_20055','a_20058','a_20060',
  'a_20067','a_20074','a_20465','a_120074','a_20056','a_20050','a_20069','a_20079','a_20342','a_21042',
  'a_20410','a_20178','a_20169','a_20175','a_20183','a_20190','a_21290','a_20165','a_20166','a_20167',
  'a_20184','a_20186','a_20163','a_20168','a_20174','a_20185','a_20188','a_21195','a_20172','a_20176',
  'a_20177','a_20179','a_20181','a_20187','a_20189','a_20191','a_20408','a_21041','a_20200','a_21194',
  'a_20194','a_20197','a_20198','a_20202','a_20214','a_20196','a_20199','a_20201','a_20204','a_20208',
  'a_20215','a_20216','a_20217','a_20218','a_20209','a_21040','a_20220','a_20221','a_20233','a_20235',
  'a_21110','a_20224','a_20225','a_20226','a_20227','a_20228','a_20229','a_20230','a_20236','a_20464',
  'a_20427','a_20269','a_21043','a_21044','a_21045','a_21223','a_20426','a_20243','a_20244','a_20245',
  'a_20246','a_20247','a_20248','a_20249','a_20250','a_20251','a_20252','a_20253','a_20254','a_20255',
  'a_20256','a_20257','a_20258','a_20259','a_20260','a_20261','a_20263','a_20264','a_20266','a_20267',
  'a_20268','a_20421','a_20422','a_120244','a_120245','a_120246','a_120247','a_120248','a_120249','a_120254',
  'a_120256','a_120264','a_120266','a_120267','a_120268','a_20279','a_21254','a_21257','a_21258','a_21259',
  'a_21260','a_20286','a_20299','a_21255','a_21256','a_21261','a_21262','a_21263','a_21264','a_21265',
  'a_21266','a_21267','a_21268','a_20285','a_20289','a_20290','a_20298','a_20300','a_20301','a_20302',
  'a_20303','a_20304','a_20305','a_21093','a_21094','a_120280','a_120285','a_120289','a_120300','a_120302',
  'a_120304','a_20314','a_20318','a_20306','a_20307','a_20308','a_20309','a_20310','a_20311','a_20312',
  'a_20315','a_20316','a_20319','a_21095','a_21225','a_21280','a_21281','a_21282',
]);

// ── 상점 판매 장비 ID (상점에서 구매 가능, 나머지는 필드 드랍 전용) ──
export const SHOP_EQUIPMENT_IDS = new Set([
  // 🗡️ 단검 (1종)
  'lastabad_dagger',
  // ⚔️ 한손검 (2종)
  'silver_long_sword', 'red_knight_sword',
  // 🗡️ 양손검 (1종)
  'blood_great_sword',
  // 🏹 활 (1종)
  'hunter_bow',
  // 🔮 지팡이 (2종)
  'crystal_staff', 'black_crystal_orb',
  // 👕 내피 (1종)
  'tshirt',                         // 훈련병의 면제 내피 (KEW)
  // ⛑️ 투구 (2종)
  'a_20006',                        // 기사의 철제 면갑 (K)
  'mr_helm',                        // 마법 방어 투구 (KEW, MR+4)
  // 🛡 갑옷 (3종)
  'plate_armor',                    // 기사용 강철 판금 갑옷 (K)
  'elven_chain_armor',              // 요정족 사슬 갑옷 (E, safe+6)
  'a_20111',                        // 수습 마법사의 옷 (W)
  // 🧥 망토 (2종)
  'protection_cloak',               // 경비대의 가죽 보호 망토 (KEW)
  'magic_cloak',                    // 마법 항마의 망토 (KEW, MR+10)
  // 🧤 장갑 (3종)
  'steel_gloves',                   // 기사용 강철 장갑 (K)
  'a_20191',                        // 요정족 가죽 골무 (E)
  'pirate_gloves',                  // 수습 마법사의 무늬 장갑 (W)
  // 🥾 부츠 (1종)
  'steel_boots',                    // 훈련병의 강철 부츠 (KEW)
  // 🛡️ 방패 (2종)
  'steel_shield',                   // 기사용 강철 방패 (K)
  'a_20226',                        // 술사의 기초 마력서 (W, INT+1)
  // 📿 목걸이 (5종)
  'a_20246',                        // 기초 완력의 목걸이 (STR+1)
  'a_20245',                        // 기초 민첩의 목걸이 (DEX+1)
  'a_20247',                        // 기초 지식의 목걸이 (INT+1)
  'a_20248',                        // 기초 지혜의 목걸이 (WIS+1)
  'a_20249',                        // 기초 체력의 목걸이 (CON+1)
  // 💍 반지 (2종)
  'a_20303',                        // 마법 저항의 항마 반지 (MR+5)
  'a_120280',                       // 마법 파괴의 멸마 반지 (MR+10)
  // 🪢 벨트 (3종)
  'a_20306',                        // 기초 신체의 벨트 (HP+30)
  'a_20308',                        // 기초 정신의 벨트 (MP+30)
  'a_20307',                        // 기초 영혼의 벨트 (HP+15, MP+15)
]);

// Merge: CSV filtered + hand-curated override
const merged: Record<string, EquipmentTemplate> = {};
for (const [k, v] of Object.entries(CSV_EQUIPMENT)) {
  // 무기(w_)와 방어구(a_)는 선택된 것만 포함
  if (k.startsWith('w_') && !SELECTED_CSV_WEAPON_IDS.has(k)) continue;
  if (k.startsWith('a_') && !SELECTED_CSV_ARMOR_IDS.has(k)) continue;
  merged[k] = v;
}
for (const [k, v] of Object.entries(HAND_CURATED_TEMPLATES)) {
  merged[k] = defaultSafeEnchant(v);
}
export const EQUIPMENT_TEMPLATES: Record<string, EquipmentTemplate> = merged;

// ── 세트 효과 → setData.ts로 이관됨 (L1J armor_sets.csv 34종) ──

// ── Hunt Zones (monsterData.ts 에서 생성) ──
export const HUNT_ZONES: HuntZone[] = generateHuntZones();

// ══════════════════════════════════════════════
// Enhance Config — L1J L1EnchantScroll.java 원본
// ══════════════════════════════════════════════

/**
 * 무기 강화 성공률 (L1J 원본)
 * safe_enchant 이상 ~ +8: 1/3 (33.3%)
 * +9 이상: 0.6%
 */
export function getWeaponEnchantRate(level: number): number {
  if (level >= 9) return 0.006;
  return 1 / 3;
}

/**
 * 방어구 강화 성공률 (L1J 원본)
 * safe_enchant=0: 1/3 (33.3%)
 * safe_enchant>0, +9 미만: 1/level
 * +9 이상: 0.3%
 */
export function getArmorEnchantRate(level: number, safeEnchant: number = 4): number {
  if (level >= 9) return 0.003;
  if (safeEnchant === 0) return 1 / 3;
  if (level <= 0) return 1;
  return 1 / level;
}

/** 통합 성공률 조회
 *  L1J: safe_enchant 미만 → 100% (판정 건너뜀)
 *       safe_enchant 이상 → 공식 적용
 */
export function getEnhanceRate(equipType: string, level: number, safeEnchant: number): number {
  if (level < safeEnchant) return 1; // 안전 구간: 무조건 100%
  const isWeapon = equipType === 'weapon' || equipType === 'bow' || equipType === 'staff';
  return isWeapon ? getWeaponEnchantRate(level) : getArmorEnchantRate(level, safeEnchant);
}

/** 안전 인챈트 구간 판정 (L1J: safe_enchant 미만이면 100% 성공 + 파괴 없음) */
export function isEnhanceSafe(level: number, safeEnchant: number): boolean {
  return level < safeEnchant;
}

/** 성공률 → 표시 문자열 (1% 미만은 소수점 표시) */
export function formatEnhanceRate(rate: number): string {
  const pct = rate * 100;
  if (pct >= 1) return `${Math.round(pct)}%`;
  if (pct > 0) return `${+pct.toFixed(1)}%`;
  return '0%';
}

/** 장비 타입 + 주문서 종류 → 주문서 재료 ID */
export function getScrollId(equipType: string, scrollType: import('../types').ScrollType): string {
  const isWeapon = equipType === 'weapon' || equipType === 'bow' || equipType === 'staff';
  if (scrollType === 'blessed') return isWeapon ? 'blessed_weapon_scroll' : 'blessed_armor_scroll';
  if (scrollType === 'cursed') return isWeapon ? 'cursed_weapon_scroll' : 'cursed_armor_scroll';
  return isWeapon ? 'weapon_scroll' : 'armor_scroll';
}

// ── Level XP Table (리니지 스타일) ──

/**
 * 경험치 테이블 — 앵커 포인트 기반 기하급수적 보간
 *
 * xpToReach(L) = 레벨 L-1 → L 에 필요한 경험치
 * xpForLevel(L) = 레벨 L → L+1 에 필요한 경험치 = xpToReach(L+1)
 *
 * 앵커: Lv10=4,050 / Lv30=194,400 / Lv45=729,000 / Lv49=1,190,250
 * Lv50=3,608,605 (기준점) / 이후 구간별 2배 증가
 */
function buildXpTable(): number[] {
  const xpToReach: number[] = new Array(101).fill(0);
  // level 1 = start, xpToReach[1] = 0

  // 모든 앵커 포인트 [level, xpToReach]
  const anchors: [number, number][] = [
    // Pre-50
    [2, 340],
    [10, 4_050],
    [30, 194_400],
    [45, 729_000],
    [49, 1_190_250],
    // Post-50 (BASE=3,608,605 × 2^n 배율)
    [50, 3_608_605],
    [55, 7_217_210],
    [60, 14_434_420],
    [65, 28_868_840],
    [70, 57_737_680],
    [75, 115_475_360],
    [79, 230_950_720],
    [82, 461_901_440],
    [84, 923_802_880],
    [86, 1_847_605_760],
    [88, 3_695_211_520],
  ];

  // 앵커 사이 기하급수적 보간
  for (let i = 0; i < anchors.length - 1; i++) {
    const [la, va] = anchors[i];
    const [lb, vb] = anchors[i + 1];
    for (let L = la; L <= lb; L++) {
      const t = (L - la) / (lb - la);
      xpToReach[L] = Math.round(va * Math.pow(vb / va, t));
    }
  }

  // 88+ 이상: 1024배 고정
  for (let L = 89; L <= 100; L++) {
    xpToReach[L] = 3_695_211_520;
  }

  // xpForLevel(L) = xpToReach(L+1) — 레벨 L에서 L+1로 필요한 XP
  const table: number[] = new Array(101).fill(0);
  for (let L = 1; L <= 99; L++) {
    table[L] = xpToReach[L + 1];
  }
  table[100] = 3_695_211_520;

  return table;
}

const XP_TABLE = buildXpTable();

export function xpForLevel(level: number): number {
  if (level < 1) return 0;
  if (level >= XP_TABLE.length) return XP_TABLE[XP_TABLE.length - 1];
  return XP_TABLE[level];
}

