/* =========================================================
   STATIC GAME DATA — 몬스터, 사냥터, 장비 템플릿, 재료, 레시피
   ========================================================= */

import type { EquipmentTemplate, Material, HuntZone, Recipe, Potion } from '../types';
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
export type { EquipmentTemplate, Material, Monster, HuntZone, Recipe, EquipType, ZoneTier, Potion } from '../types';

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
  red_potion:     { id: 'red_potion',     name: '빨간 물약', healMin: 6,  healMax: 27,  buyPrice: 37,  requiredLevel: 1 },
  crimson_potion: { id: 'crimson_potion', name: '주홍 물약', healMin: 26, healMax: 68,  buyPrice: 200, requiredLevel: 1 },
  clear_potion:   { id: 'clear_potion',   name: '맑은 물약', healMin: 44, healMax: 107, buyPrice: 600, requiredLevel: 1 },
  blue_potion:    { id: 'blue_potion',    name: '파란 물약', healMin: 0,  healMax: 0,   buyPrice: 700, requiredLevel: 1,
                    buffDuration: 600 },  // L1J: 10분 MP리젠 버프
  green_potion:   { id: 'green_potion',   name: '초록 물약', healMin: 0,  healMax: 0,   buyPrice: 200, requiredLevel: 1,
                    buffDuration: 300, atkSpeedMult: 1.33, moveSpeedMult: 1.33 },
  courage_potion: { id: 'courage_potion', name: '용기의 물약', healMin: 0, healMax: 0,  buyPrice: 800, requiredLevel: 1,
                    buffDuration: 300, atkSpeedMult: 1.33 },
};
export const POTION_ORDER = ['red_potion', 'crimson_potion', 'clear_potion', 'blue_potion', 'green_potion', 'courage_potion'];
/** 힐 물약만 (자동사용 순환용) */
export const HEAL_POTION_ORDER = ['red_potion', 'crimson_potion', 'clear_potion'];

// ── Materials ──
export const MATERIALS: Record<string, Material> = {
  iron_ore:       { id: 'iron_ore',       name: '철광석',       sellPrice: 2 },
  old_leather:    { id: 'old_leather',    name: '낡은 가죽',   sellPrice: 1 },
  mithril_shard:  { id: 'mithril_shard',  name: '미스릴 파편', sellPrice: 5 },
  orc_seal:       { id: 'orc_seal',       name: '오크의 인장', sellPrice: 15 },
  soul_stone:     { id: 'soul_stone',     name: '영혼석',       sellPrice: 10 },
  cursed_iron:    { id: 'cursed_iron',    name: '저주받은 철', sellPrice: 8 },
  slime_gel:      { id: 'slime_gel',      name: '점액질',       sellPrice: 1 },
  wood_piece:     { id: 'wood_piece',     name: '나무 조각',   sellPrice: 1 },

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
  /* ── 무기 (17종) ──
     이름               작/큰  추타 명중  재질    손상   클래스     특징
     ───────────────────────────────────────────────────────────────────
     단검                4/4    -   +2   철     비손상  전클래스   극초반 기본 무기
     은장검              8/12   -    -   은     손상   군/기/요   초반 언데드 파밍 가성비
     장검               10/11   -    -   철     손상   군/기/요   상점제 표준 무기
     글라디우스          12/8    -    -   철     손상   군/기/요   작은 몹 특화 초반용
     시미터             12/10   -    -   철     손상   군/기/요   글라디우스 상위 호환
     카타나             12/12   -   +1   철     비손상  군/기/요/다 밸런스+비손상, 광산/화산 필수
     레이피어            11/6   -   +1   은     손상   군/기/요   요정 국민 사냥 무기
     오리하르콘 단검      7/7   +2    -   오리   비손상  전클래스   공속+언데드 파밍 종결자
     무관의 장검         13/10  +2   +1   철     비손상  군/기     안전 인챈트 6, 안정적
     고대 정령의 검      15/15   -    -   미스릴  비손상  요정      요정 전용 탑티어, 대소형 밸런스
     싸울아비 장검       16/10   -   +4   철     손상   군/기     기사의 상징, 압도적 명중
     데스블레이드        16/10   -   +2   은     비손상  군/기/요   올라운더 명품 무기
     커츠의 검           15/11  +4   +5   철     손상   군/기     라이트닝 볼트 발동
     고대의 검           35/20   -   -5   철     손상   군/기     작몹 35 타격치, 명중 패널티
     바람의 칼날 단검    18/12  +5   +3   은     비손상  전클래스   한손검 최상위, HP 흡수
     데스나이트의 불검   18/10  +4   +6   철     손상   기사      기사 종결, 헬파이어 발동
     집행자의 손검       28/33  +23  +5   블랙   비손상  기사      신화급, 추타+23
  */

  // ── 한손검 (8종) ──
  mail_breaker:        { id: 'mail_breaker',        name: '메일 브레이커',       type: 'weapon', baseAtk: 4,  baseAtkLarge: 5,  baseDef: 0, maxEnhance: 10,  sellPrice: 10,   weight: 40000,  bonuses: { hit: 10, undeadSlayer: true }, bonusEffects: ['명중+10', '언데드 추타'] },
  silver_sword:        { id: 'silver_sword',        name: '은검',               type: 'weapon', baseAtk: 7,  baseAtkLarge: 7,  baseDef: 0, maxEnhance: 10,  sellPrice: 900,   weight: 40000,  bonuses: { undeadSlayer: true }, bonusEffects: ['언데드 추타'] },
  silver_long_sword:   { id: 'silver_long_sword',   name: '은장검',             type: 'weapon', baseAtk: 8,  baseAtkLarge: 12, baseDef: 0, maxEnhance: 10,  sellPrice: 6500,   weight: 50000,  bonuses: { undeadSlayer: true }, bonusEffects: ['언데드 추타'] },
  damascus_sword:      { id: 'damascus_sword',      name: '다마스커스 검',       type: 'weapon', baseAtk: 10, baseAtkLarge: 11, baseDef: 0, maxEnhance: 10,  sellPrice: 2500,  weight: 45000,  bonuses: { unbreakable: true }, bonusEffects: ['손상되지 않음'] },
  katana:              { id: 'katana',              name: '일본도',             type: 'weapon', baseAtk: 10, baseAtkLarge: 12, baseDef: 0, maxEnhance: 10,  sellPrice: 10000,  weight: 40000,  bonuses: { hit: 1 }, bonusEffects: ['명중+1'] },
  rapier:              { id: 'rapier',              name: '레이피어',           type: 'weapon', baseAtk: 11, baseAtkLarge: 6,  baseDef: 0, maxEnhance: 10,  sellPrice: 150,  weight: 60000,  bonuses: { undeadSlayer: true }, bonusEffects: ['언데드 추타'] },
  oriharukon_sword:    { id: 'oriharukon_sword',    name: '싸울아비 장검',       type: 'weapon', baseAtk: 16, baseAtkLarge: 10, baseDef: 0, maxEnhance: 10,  sellPrice: 17500,  weight: 120000,  bonuses: { hit: 2 }, bonusEffects: ['명중+2'] },
  dk_flame_sword:      { id: 'dk_flame_sword',      name: '데스나이트의 불검',   type: 'weapon', baseAtk: 16, baseAtkLarge: 10, baseDef: 0, maxEnhance: 10,  sellPrice: 800,  weight: 40000,  bonuses: { hit: 5, extraDmg: 2, unbreakable: true }, bonusEffects: ['손상되지 않음', '명중+5', '추타+2'] },

  // ── 양손검 (4종) ──
  ancient_sword:       { id: 'ancient_sword',       name: '고대의 검',          type: 'weapon', baseAtk: 35, baseAtkLarge: 20, baseDef: 0, maxEnhance: 0,  sellPrice: 1500, weight: 30000,  bonuses: { hit: 5 }, bonusEffects: ['명중+5', '강화 불가'] },
  duke_two_hand:       { id: 'duke_two_hand',       name: '무관의 양손검',       type: 'weapon', baseAtk: 14, baseAtkLarge: 18, baseDef: 0, maxEnhance: 10,  sellPrice: 500,  weight: 150000,  bonuses: { hit: 1, extraDmg: 2 }, bonusEffects: ['명중+1', '추타+2'] },
  dragon_slayer:       { id: 'dragon_slayer',       name: '드래곤 슬레이어',     type: 'weapon', baseAtk: 17, baseAtkLarge: 14, baseDef: 0, maxEnhance: 10,  sellPrice: 1000, weight: 180000,  bonuses: { extraDmg: 3, unbreakable: true }, bonusEffects: ['손상되지 않음', '추타+3'] },
  ancient_great_sword: { id: 'ancient_great_sword', name: '고대의 대검',        type: 'weapon', baseAtk: 24, baseAtkLarge: 42, baseDef: 0, maxEnhance: 0,  sellPrice: 2500, weight: 70000,  bonuses: { hit: 3 }, bonusEffects: ['명중+3', '강화 불가'] },

  // ── 활 (요정 전용, type: bow) ──
  wooden_bow:            { id: 'wooden_bow',            name: '나무 활',             type: 'bow',   baseAtk: 6,  baseAtkLarge: 8,  baseDef: 0, maxEnhance: 10, sellPrice: 50,   weight: 30000,  classRestriction: ['elf'] },
  long_bow:              { id: 'long_bow',              name: '롱 보우',             type: 'bow',   baseAtk: 8,  baseAtkLarge: 10, baseDef: 0, maxEnhance: 10, sellPrice: 500,  weight: 40000,  classRestriction: ['elf'] },
  elven_bow:             { id: 'elven_bow',             name: '요정 활',             type: 'bow',   baseAtk: 12, baseAtkLarge: 14, baseDef: 0, maxEnhance: 10, sellPrice: 5000, weight: 30000,  classRestriction: ['elf'], bonuses: { bowHit: 2 }, bonusEffects: ['활 명중+2'] },
  ancient_elven_bow:     { id: 'ancient_elven_bow',     name: '고대 정령의 활',       type: 'bow',   baseAtk: 15, baseAtkLarge: 18, baseDef: 0, maxEnhance: 10, sellPrice: 20000, weight: 30000,  classRestriction: ['elf'], bonuses: { bowHit: 3, bowDmg: 2 }, bonusEffects: ['활 명중+3', '활 추타+2'] },

  // ── 지팡이 (마법사 전용, type: staff) ──
  oak_staff:             { id: 'oak_staff',             name: '참나무 지팡이',        type: 'staff', baseAtk: 4,  baseAtkLarge: 4,  baseDef: 0, maxEnhance: 10, sellPrice: 50,   weight: 15000,  classRestriction: ['wizard'], bonuses: { mr: 2, sp: 1 }, bonusEffects: ['MR+2', 'SP+1'] },
  mithril_staff:         { id: 'mithril_staff',         name: '미스릴 지팡이',        type: 'staff', baseAtk: 6,  baseAtkLarge: 6,  baseDef: 0, maxEnhance: 10, sellPrice: 2000,  weight: 15000,  classRestriction: ['wizard'], bonuses: { mr: 4, sp: 2, magicDmg: 1 }, bonusEffects: ['MR+4', 'SP+2', '마법 추가대미지+1'] },
  ancient_staff:         { id: 'ancient_staff',         name: '고대의 지팡이',        type: 'staff', baseAtk: 8,  baseAtkLarge: 8,  baseDef: 0, maxEnhance: 10, sellPrice: 15000, weight: 15000,  classRestriction: ['wizard'], bonuses: { mr: 6, sp: 3, magicDmg: 3 }, bonusEffects: ['MR+6', 'SP+3', '마법 추가대미지+3'] },

  /* ── 티셔츠 (1종, type: tshirt) ── 별도 슬롯 */
  tshirt:                  { id: 'tshirt',                  name: '티셔츠',           type: 'tshirt',   baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 3, weight: 5000 },

  /* ── 갑옷 (49종, type: armor) ──
     미구현 옵션은 주석으로 보관:
     - 고대의 판금 갑옷: 16AC +0, HP 회복량 +1, 기사 전용 (Lv.45~), 잊혀진 판금 갑옷 제작
     - 라스타바드 체인 메일: 6AC +4, 기사 전용
     - 맘보 코트: 3AC +4, STR -1/CHA +2/물 속성 저항+10/불 속성 저항-10/동빙 내성+40
     - 무관의 갑옷: 4AC +6, HP +50/HP 회복량 +10, 기사 전용 (Lv.40~)
     - 바란카의 갑옷: 8AC +4, STR +1/DEX +1/CHA -2, 기사 전용
     - 바포메트의 갑옷: 8AC +4, 기사 전용
     - 발라카스의 마갑주: 11AC +4, STR +2/DEX +1/HP +100/MP +50/HP·MP 회복/불 속성 저항+50, 기사 전용
     - 상아탑의 가죽 갑옷: 4AC +4, 거래 불가
     - 야히의 갑옷: 0AC +0, 거래 불가, 군/기/요/마 (Lv.52~)
     - 어둠의 집행자 판금 갑옷: 15AC +0, DEX +1/HP 회복량 +2, 기사 전용 (Lv.45~)
     - 잊혀진 판금 갑옷: 1AC +0, 기사 전용 (Lv.45~)
     - 죽음의 갑옷: 8AC +0, STR +2/DEX +2/WIS -2/CHA -2/HP 회복량 +5, 군주/기사 (Lv.45~)
     - 플레이트웜 껍질 갑옷: 8AC +4, 기사 전용
  */
  leather_vest:            { id: 'leather_vest',            name: '가죽조끼',              type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 15, weight: 30000 },
  leather_armor:           { id: 'leather_armor',           name: '가죽 갑옷',             type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 50, weight: 70000 },
  orc_ring_mail:           { id: 'orc_ring_mail',           name: '오크족 고리 갑옷',       type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 100, weight: 250000 },
  studded_vest:            { id: 'studded_vest',            name: '징박은 가죽조끼',        type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 35, weight: 130000 },
  nameless_robe:           { id: 'nameless_robe',           name: '무명 로브',             type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 500, weight: 10000,   bonuses: { mr: 4 }, bonusEffects: ['MR +4'] },
  ring_mail:               { id: 'ring_mail',               name: '고리 갑옷',             type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 250, weight: 250000 },
  studded_leather_armor:   { id: 'studded_leather_armor',   name: '징박힌 가죽 갑옷',       type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 150, weight: 150000 },
  belted_vest:             { id: 'belted_vest',             name: '벨트달린 가죽조끼',      type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 60, weight: 50000 },
  wooden_armor:            { id: 'wooden_armor',            name: '나무 갑옷',             type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 55, weight: 80000 },
  lastabad_leather:        { id: 'lastabad_leather',        name: '라스타바드 레더 아머',    type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 750, weight: 70000 },
  scale_armor:             { id: 'scale_armor',             name: '비늘 갑옷',             type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 4, maxEnhance: 10, sellPrice: 1000, weight: 250000 },
  orc_chain_armor:         { id: 'orc_chain_armor',         name: '오크족 사슬 갑옷',       type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 4, maxEnhance: 10, sellPrice: 400, weight: 300000 },
  dark_forester_armor:     { id: 'dark_forester_armor',     name: '다크 포레스터의 갑옷',    type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 4, maxEnhance: 10, sellPrice: 150, weight: 30000,  bonuses: { mp: 10 }, bonusEffects: ['MP +10'] },
  lastabad_studded:        { id: 'lastabad_studded',        name: '라스타바드 징박힌 레더 아머', type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 4, maxEnhance: 10, sellPrice: 1000, weight: 150000 },
  elven_breastplate:       { id: 'elven_breastplate',       name: '요정족 흉갑',            type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 4, maxEnhance: 10, sellPrice: 500, weight: 100000 },
  chain_armor:             { id: 'chain_armor',             name: '사슬 갑옷',             type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 5, maxEnhance: 10, sellPrice: 3000, weight: 300000 },
  mr_chain_armor:          { id: 'mr_chain_armor',          name: '마법 방어 사슬 갑옷',    type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 5, maxEnhance: 10, sellPrice: 4000, weight: 300000,  bonuses: { mr: 4 }, bonusEffects: ['MR +4'] },
  bone_armor:              { id: 'bone_armor',              name: '뼈갑옷',                type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 5, maxEnhance: 0, sellPrice: 1000, weight: 150000 },
  blue_pirate_armor:       { id: 'blue_pirate_armor',       name: '푸른 해적 가죽갑옷',     type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 5, maxEnhance: 10, sellPrice: 200, weight: 150000 },
  elven_chain_armor:       { id: 'elven_chain_armor',       name: '요정족 사슬 갑옷',       type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 5, maxEnhance: 10, sellPrice: 280, weight: 150000 },
  band_armor:              { id: 'band_armor',              name: '띠 갑옷',               type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 6, maxEnhance: 10, sellPrice: 5750, weight: 350000 },
  demon_armor:             { id: 'demon_armor',             name: '데몬의 갑옷',            type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 6, maxEnhance: 10, sellPrice: 21000, weight: 250000 },
  heavy_scale_armor:       { id: 'heavy_scale_armor',       name: '중 비늘 갑옷',           type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 6, maxEnhance: 10, sellPrice: 320, weight: 300000 },
  bronze_plate:            { id: 'bronze_plate',            name: '청동 판금 갑옷',         type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 6, maxEnhance: 10, sellPrice: 9000, weight: 450000 },
  elven_plate:             { id: 'elven_plate',             name: '요정족 판금 갑옷',       type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 6, maxEnhance: 10, sellPrice: 450, weight: 250000 },
  dk_armor:                { id: 'dk_armor',                name: '데스나이트의 갑옷',      type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 7, maxEnhance: 10, sellPrice: 600, weight: 250000 },
  steel_plate_armor:       { id: 'steel_plate_armor',       name: '강철 판금 갑옷',         type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 7, maxEnhance: 10, sellPrice: 500, weight: 470000 },
  plate_armor:             { id: 'plate_armor',             name: '판금 갑옷',             type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 7, maxEnhance: 10, sellPrice: 18500, weight: 450000 },
  kurtz_armor:             { id: 'kurtz_armor',             name: '커츠의 갑옷',            type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 7, maxEnhance: 10, sellPrice: 1200, weight: 250000 },
  phantom_armor:           { id: 'phantom_armor',           name: '환상의 갑옷',            type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 7, maxEnhance: 10, sellPrice: 800, weight: 300000 },
  demon_lord_robe:         { id: 'demon_lord_robe',         name: '마령군왕의 로브',         type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 8, maxEnhance: 10, sellPrice: 1800, weight: 20000 },
  crystal_armor:           { id: 'crystal_armor',           name: '수정 갑옷',             type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 8, maxEnhance: 10, sellPrice: 40000, weight: 350000 },
  water_dragon_armor:      { id: 'water_dragon_armor',      name: '수룡 비늘 갑옷',         type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 9, maxEnhance: 10, sellPrice: 4500, weight: 300000, bonusEffects: ['물 속성 저항+20 (미구현)'] },
  earth_dragon_armor:      { id: 'earth_dragon_armor',      name: '지룡 비늘 갑옷',         type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 9, maxEnhance: 10, sellPrice: 5000, weight: 300000, bonusEffects: ['땅 속성 저항+20 (미구현)'] },
  wind_dragon_armor:       { id: 'wind_dragon_armor',       name: '풍룡 비늘 갑옷',         type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 9, maxEnhance: 10, sellPrice: 5500, weight: 300000, bonusEffects: ['바람 속성 저항+20 (미구현)'] },
  fire_dragon_armor:       { id: 'fire_dragon_armor',       name: '화룡 비늘 갑옷',         type: 'armor', baseAtk: 0, baseAtkLarge: 0, baseDef: 9, maxEnhance: 10, sellPrice: 8000, weight: 300000, bonusEffects: ['불 속성 저항+20 (미구현)'] },

  /* ── 투구 (29종, type: helmet) ──
     미구현 옵션은 주석으로 보관:
     - 기사의 두건: 거래불가/삭제불가, 강화불가, 기사 전용
     - 기사의 면갑: 3AC +4, 기사 전용
     - 낡은 바람의 투구: 1AC +4, Lv.30~, 기사/요정/마법사
     - 마법의 투구: 신속: 1AC +4, 헤이스트/인챈트 덱스테리티(MP 절반)
     - 마법의 투구: 치유: 1AC +4, 힐/익스트라 힐(MP 절반)
     - 마법의 투구: 힘: 1AC +4, 디텍션/인챈트 웨폰/인챈트 마이티(MP 절반)
     - 맘보 모자: 1AC +4, CHA+1, 동빙 내성+8
     - 밤의 시야: 0AC +0, 거래불가, 기사 전용
     - 상아탑의 가죽 투구: 2AC +4, 거래불가
     - 야히의 투구: 0AC +0, 거래불가, Lv.52~
     - 인프라비전 투구: 1AC +4, 군주/기사/마법사
     - 혼돈의 투구: 1AC +0, Lv.45~, 스턴 내성+9
  */
  leather_hat:             { id: 'leather_hat',             name: '가죽모자',           type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 10, weight: 10000 },
  leather_helmet:          { id: 'leather_helmet',          name: '가죽투구',           type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 25, weight: 30000 },
  steel_helm:              { id: 'steel_helm',              name: '강철 면갑',           type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 300, weight: 50000 },
  dwarf_iron_helm:         { id: 'dwarf_iron_helm',         name: '난쟁이족 철 투구',     type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 250, weight: 40000 },
  demon_helm:              { id: 'demon_helm',              name: '데몬의 투구',         type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 200, weight: 50000 },
  dk_helmet:               { id: 'dk_helmet',               name: '데스나이트의 투구',    type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 1500, weight: 50000 },
  mr_helm:                 { id: 'mr_helm',                 name: '마법 방어 투구',       type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 1250, weight: 35000,  bonuses: { mr: 4 }, bonusEffects: ['MR +4'] },
  mugwan_helm:             { id: 'mugwan_helm',             name: '무관의 투구',          type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 1750, weight: 50000 },
  baranka_helm:            { id: 'baranka_helm',            name: '바란카의 투구',        type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 400, weight: 50000,  bonuses: { con: 1 }, bonusEffects: ['CON +1'] },
  red_knight_hood:         { id: 'red_knight_hood',         name: '붉은 기사의 두건',     type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 600, weight: 20000 },
  orc_helm:                { id: 'orc_helm',                name: '오크족 투구',          type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 75, weight: 30000 },
  studded_leather_hat:     { id: 'studded_leather_hat',     name: '징박은 가죽모자',      type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 70, weight: 20000 },
  kurtz_helmet:            { id: 'kurtz_helmet',            name: '커츠의 투구',          type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 1000, weight: 50000 },
  basic_helm:              { id: 'basic_helm',              name: '투구',                type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 100, weight: 30000 },
  blue_pirate_hood:        { id: 'blue_pirate_hood',        name: '푸른 해적 두건',       type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 150, weight: 15000 },
  skull_helm:              { id: 'skull_helm',              name: '해골투구',             type: 'helmet', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 0, sellPrice: 500, weight: 30000 },

  /* ── 망토 (28종, type: cloak) ──
     미구현 옵션은 주석으로 보관:
     - (저주) 마법 망토: 1AC +4, MR +10, 저주 메커니즘 미구현
     - (축) 마법 망토: 1AC +4, MR +10, 축복 메커니즘 미구현
     - (축) 투명 망토: 1AC +4, 투명화 미구현, 린드비오르/발라카스 드랍
     - 무관의 망토: 2AC +4, HP +20/HP 회복량 +3, 기사 전용 (Lv.40~)
     - 바다의 망토: 2AC +4, CHA +1, CHA 미구현
     - 붉은 기사의 망토: 1AC +4, CHA +1, CHA 미구현 (Lv.15~)
     - 상아탑의 망토: 2AC +4, HP -5/MP +15, 음수 HP 미구현
     - 야히의 망토: 0AC +0, 거래 불가 (Lv.52~)
     - 죽음의 망토: 3AC +0, STR +1/HP +100/MP +50/HP 회복량 -10, 음수 HP회복 미구현 (Lv.45~)
     - 투명 망토: 1AC +4, 투명화 미구현, 보스 몬스터 드랍
  */
  orc_cloak:               { id: 'orc_cloak',               name: '오크족 망토',              type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 25, weight: 10000 },
  dwarf_cloak:             { id: 'dwarf_cloak',             name: '난쟁이족 망토',            type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 52, weight: 10000 },
  vampire_cloak:           { id: 'vampire_cloak',           name: '뱀파이어의 망토',           type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 25, weight: 100000 },
  oil_cloak:               { id: 'oil_cloak',               name: '기름 망토',                type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 80, weight: 10000,   bonuses: { hp: 10 }, bonusEffects: ['HP +10'] },
  elven_cloak:             { id: 'elven_cloak',             name: '요정족 망토',              type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 600, weight: 10000 },
  magic_cloak:             { id: 'magic_cloak',             name: '마법 망토',                type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 100, weight: 10000,  bonuses: { mr: 10 }, bonusEffects: ['MR +10'] },
  wolf_cloak:              { id: 'wolf_cloak',              name: '늑대가죽 망토',             type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 500, weight: 5000 },
  aden_cloak:              { id: 'aden_cloak',              name: '아덴 기사단의 망토',        type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 550, weight: 10000 },
  black_tiger_cloak:       { id: 'black_tiger_cloak',       name: '블랙 티거 가죽 망토',       type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 600, weight: 5000,  bonuses: { hpr: 2 }, bonusEffects: ['HPR+2'] },
  earth_cloak:             { id: 'earth_cloak',             name: '대지의 망토',              type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 700, weight: 20000,  bonuses: { mpr: 2 }, bonusEffects: ['MPR+2'] },
  water_cloak:             { id: 'water_cloak',             name: '물결의 망토',              type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 700, weight: 20000,  bonuses: { mpr: 2 }, bonusEffects: ['MPR+2'] },
  wind_cloak:              { id: 'wind_cloak',              name: '바람의 망토',              type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 700, weight: 20000,  bonuses: { mpr: 2 }, bonusEffects: ['MPR+2'] },
  fire_cloak:              { id: 'fire_cloak',              name: '열화의 망토',              type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 700, weight: 20000,  bonuses: { mpr: 2 }, bonusEffects: ['MPR+2'] },
  chaos_cloak:             { id: 'chaos_cloak',             name: '혼돈의 망토',              type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 0, sellPrice: 900, weight: 5000,  bonuses: { mr: 10 }, bonusEffects: ['MR +10'] },
  protection_cloak:        { id: 'protection_cloak',        name: '보호 망토',                type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 10000, weight: 10000 },
  queen_ant_wing:          { id: 'queen_ant_wing',          name: '거대 여왕 개미의 금빛 날개', type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 4, maxEnhance: 10, sellPrice: 3000, weight: 10000, bonuses: { hp: 50, mr: 15 }, bonusEffects: ['HP +50', 'MR +15'] },
  demon_lord_cloak:        { id: 'demon_lord_cloak',        name: '명법군왕의 망토',           type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 5, maxEnhance: 10, sellPrice: 4000, weight: 10000 },
  balrog_cloak:            { id: 'balrog_cloak',            name: '발록의 핏빛 망토',          type: 'cloak', baseAtk: 0, baseAtkLarge: 0, baseDef: 5, maxEnhance: 10, sellPrice: 5000, weight: 10000 },

  /* ── 장갑 (25종, type: gloves) ──
     미구현 옵션은 주석으로 보관:
     - (축) 장갑: 0AC +4, 축복 메커니즘 미구현
     - 리자드맨 영웅의 장갑: 2AC +0, DEX +1/CHA -2/원거리 명중 +1, CHA/원거리 미구현
     - 무관의 장갑: 1AC +6, HP +10, 기사 전용 (Lv.40~)
     - 바란카의 장갑: 3AC +4, 기사/요정 착용
     - 상아탑의 가죽 장갑: 2AC +4, 거래 불가
     - 수정 장갑: 3AC +4, 물 속성 저항 +4, 기사 전용
     - 야히의 장갑: 0AC +0, 거래 불가 (Lv.52~)
     - 타락의 장갑: 2AC +4, CON +1/HP +100, 군주/기사 착용
     - 활 골무: 0AC +4, 원거리 명중 +2, 원거리 시스템 미구현
  */
  basic_gloves:            { id: 'basic_gloves',            name: '장갑',                type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 4000, weight: 10000 },
  leather_gloves:          { id: 'leather_gloves',          name: '가죽 장갑',           type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 4000, weight: 5000 },
  ice_gloves:              { id: 'ice_gloves',              name: '빙령의 장갑',          type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 50000, weight: 18000,  bonuses: { str: 1, mpr: 1 }, bonusEffects: ['STR +1', 'MPR+1'] },
  shadow_gloves:           { id: 'shadow_gloves',           name: '암령의 장갑',          type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 50000, weight: 18000,  bonuses: { str: 1, mpr: 1 }, bonusEffects: ['STR +1', 'MPR+1'] },
  flame_gloves:            { id: 'flame_gloves',            name: '염령의 장갑',          type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 50000, weight: 18000,  bonuses: { str: 1, mpr: 1 }, bonusEffects: ['STR +1', 'MPR+1'] },
  wind_gloves:             { id: 'wind_gloves',             name: '풍령의 장갑',          type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 50000, weight: 18000,  bonuses: { str: 1, mpr: 1 }, bonusEffects: ['STR +1', 'MPR+1'] },
  power_glove:             { id: 'power_glove',             name: '파워 글로브',          type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 400, weight: 18000,  bonuses: { str: 2 }, bonusEffects: ['STR +2'] },
  steel_gloves:            { id: 'steel_gloves',            name: '강철 장갑',            type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 55, weight: 40000 },
  yeti_gloves:             { id: 'yeti_gloves',             name: '설인 장갑',            type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 80, weight: 20000,   bonuses: { hp: 5 }, bonusEffects: ['HP +5', '동빙 내성+8 (미구현)'] },
  pirate_gloves:           { id: 'pirate_gloves',           name: '푸른 해적 장갑',        type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 4000, weight: 15000 },
  demon_gloves:            { id: 'demon_gloves',            name: '데몬의 장갑',           type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 200, weight: 15000 },
  dk_gloves:               { id: 'dk_gloves',               name: '데스나이트의 장갑',      type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 280, weight: 15000 },
  kurtz_gloves:            { id: 'kurtz_gloves',            name: '커츠의 장갑',           type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 900, weight: 15000 },
  death_scale:             { id: 'death_scale',             name: '죽음의 비늘',           type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 0, sellPrice: 1500, weight: 5000, bonuses: { str: 1, dex: 1 }, bonusEffects: ['STR +1', 'DEX +1', 'CHA -2 (미구현)'] },
  chaos_touch:             { id: 'chaos_touch',             name: '혼돈의 손길',           type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 0, sellPrice: 1200, weight: 5000, bonuses: { str: 1 }, bonusEffects: ['STR +1', '원거리 명중+5 (미구현)'] },
  assassin_gloves:         { id: 'assassin_gloves',         name: '암살군왕의 장갑',        type: 'gloves', baseAtk: 0, baseAtkLarge: 0, baseDef: 4, maxEnhance: 10, sellPrice: 3000, weight: 25000 },

  /* ── 부츠 (21종, type: boots) ──
     미구현 옵션은 주석으로 보관:
     - (저주) 짧은 부츠: 1AC +4, 저주 메커니즘 미구현
     - 다크 포레스터의 부츠: 2AC +4, HP +30, 기사/요정 착용
     - 무관의 부츠: 2AC +6, HP +20, 기사 전용 (Lv.40~)
     - 베레스의 부츠: 2AC +6, STR +1, 기사/요정 착용
     - 상아탑의 가죽샌달: 2AC +4, 거래 불가
     - 수중 부츠: 2AC +4, MP 회복량 +1/수중 호흡, 수중 호흡 미구현
     - 야히의 부츠: 0AC +0, 거래 불가 (Lv.52~)
  */
  leather_sandals:         { id: 'leather_sandals',         name: '가죽샌달',              type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 10, sellPrice: 8, weight: 8000 },
  studded_sandals:         { id: 'studded_sandals',         name: '징박은 가죽샌달',        type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 20, weight: 10000 },
  short_boots:             { id: 'short_boots',             name: '짧은 부츠',             type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 150, weight: 10000 },
  boots:                   { id: 'boots',                   name: '부츠',                  type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 1000, weight: 15000 },
  leather_boots:           { id: 'leather_boots',           name: '가죽부츠',              type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 65, weight: 10000 },
  lastabad_boots:          { id: 'lastabad_boots',          name: '라스타바드 부츠',        type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 750, weight: 10000 },
  pirate_boots:            { id: 'pirate_boots',            name: '푸른 해적 부츠',         type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 1500, weight: 15000 },
  steel_boots:             { id: 'steel_boots',             name: '강철 부츠',             type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 320, weight: 50000 },
  demon_boots:             { id: 'demon_boots',             name: '데몬의 부츠',            type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 350, weight: 15000 },
  dk_boots:                { id: 'dk_boots',                name: '데스나이트의 부츠',       type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 400, weight: 15000 },
  baranka_boots:           { id: 'baranka_boots',           name: '바란카의 부츠',          type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 450, weight: 10000 },
  kurtz_boots:             { id: 'kurtz_boots',             name: '커츠의 부츠',            type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 1100, weight: 15000 },
  beast_lord_boots:        { id: 'beast_lord_boots',        name: '마수군왕의 부츠',         type: 'boots', baseAtk: 0, baseAtkLarge: 0, baseDef: 4, maxEnhance: 10, sellPrice: 2500, weight: 30000 },

  /* ── 방패 (21종, type: shield) ──
     미구현 옵션은 주석으로 보관:
     - 라스타바드 라운드 실드: 2AC +4, 군주/기사/요정 착용
     - 무관의 방패: 2AC +6, HP +10/HP 회복량 +4, 기사 전용 (Lv.40~)
     - 반사 방패: 2AC +4, 반사 효과(광선형 마법 방어) 미구현
     - 붉은 기사의 방패: 2AC +6, 반사 효과, 기사 전용 (Lv.30~)
     - 사각 방패: 3AC +4, 기사 전용
     - 상아탑의 가죽방패: 3AC +4, 거래 불가
     - 요정족 방패: 2AC +6, 요정 착용 시 MR +5, 기/요/마 착용
     - 은기사의 방패: 2AC +4, MR +4, 기사 전용
     - 죽음의 보호구 조각: 1AC +0, 스턴 내성 +3, 군주/기사/요정 착용
  */
  small_shield:            { id: 'small_shield',            name: '작은 방패',             type: 'shield', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 30, weight: 30000 },
  leather_shield:          { id: 'leather_shield',          name: '가죽방패',              type: 'shield', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 15, weight: 25000 },
  wooden_shield:           { id: 'wooden_shield',           name: '나무방패',              type: 'shield', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 18, weight: 30000 },
  orc_shield:              { id: 'orc_shield',              name: '우럭하이 방패',          type: 'shield', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 10, sellPrice: 45, weight: 50000 },
  dwarf_shield:            { id: 'dwarf_shield',            name: '난쟁이족 둥근 방패',     type: 'shield', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 125, weight: 100000 },
  studded_shield:          { id: 'studded_shield',          name: '징박은 가죽방패',        type: 'shield', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 50, weight: 35000 },
  large_shield:            { id: 'large_shield',            name: '큰 방패',               type: 'shield', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 600, weight: 100000 },
  medusa_shield:           { id: 'medusa_shield',           name: '메두사 방패',            type: 'shield', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 10, sellPrice: 120, weight: 80000,  bonusEffects: ['석화 내성+30 (미구현)'] },
  steel_shield:            { id: 'steel_shield',            name: '강철 방패',             type: 'shield', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 350, weight: 140000 },
  gollack_shield:          { id: 'gollack_shield',          name: '골각방패',              type: 'shield', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 0, sellPrice: 200, weight: 30000 },
  eva_shield:              { id: 'eva_shield',              name: '에바의 방패',            type: 'shield', baseAtk: 0, baseAtkLarge: 0, baseDef: 3, maxEnhance: 10, sellPrice: 1300, weight: 50000, bonuses: { hp: 20 }, bonusEffects: ['HP +20', '헤이스트 (미구현)'] },

  /* ── 목걸이 (17종, type: necklace) ── 강화 불가
     미구현 옵션은 주석으로 보관:
     - 계곡의 증표: 0AC, HP +5/MP +5, 거래 불가, 기사/요정 착용
     - 낡은 매력의 목걸이: 0AC, INT -2/CHA +1, INT/CHA 미구현
     - 낡은 지식의 목걸이: 0AC, WIS -2/INT +1, INT 미구현
     - 매력의 목걸이: 0AC, CHA +1, CHA 미구현
     - 지식의 목걸이: 0AC, INT +1, INT 미구현
  */
  old_str_necklace:        { id: 'old_str_necklace',        name: '낡은 완력의 목걸이',     type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 15, weight: 5000,  bonuses: { str: 1, dex: -2 }, bonusEffects: ['STR +1', 'DEX -2'] },
  old_dex_necklace:        { id: 'old_dex_necklace',        name: '낡은 민첩의 목걸이',     type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 15, weight: 5000,  bonuses: { dex: 1, con: -2 }, bonusEffects: ['DEX +1', 'CON -2'] },
  old_wis_necklace:        { id: 'old_wis_necklace',        name: '낡은 지혜의 목걸이',     type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 15, weight: 5000,  bonuses: { wis: 1 }, bonusEffects: ['WIS +1', 'CHA -2 (미구현)'] },
  old_con_necklace:        { id: 'old_con_necklace',        name: '낡은 체력의 목걸이',     type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 15, weight: 5000,  bonuses: { con: 1, str: -2 }, bonusEffects: ['CON +1', 'STR -2'] },
  power_necklace:          { id: 'power_necklace',          name: '완력의 목걸이',          type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 5000, weight: 5000,  bonuses: { str: 1 }, bonusEffects: ['STR +1'] },
  dex_necklace:            { id: 'dex_necklace',            name: '민첩의 목걸이',          type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 5000, weight: 5000,  bonuses: { dex: 1 }, bonusEffects: ['DEX +1'] },
  wis_necklace:            { id: 'wis_necklace',            name: '지혜의 목걸이',          type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 5000, weight: 5000,  bonuses: { wis: 1 }, bonusEffects: ['WIS +1'] },
  health_necklace:         { id: 'health_necklace',         name: '체력의 목걸이',          type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 5000, weight: 5000,  bonuses: { con: 1 }, bonusEffects: ['CON +1'] },
  orc_warrior_necklace:    { id: 'orc_warrior_necklace',    name: '오크 투사의 목걸이',      type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 32500, weight: 5000,  bonuses: { hp: 20 }, bonusEffects: ['HP +20'] },
  elder_necklace:          { id: 'elder_necklace',          name: '장로의 목걸이',          type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 45, weight: 5000,  bonuses: { mp: 30, mpr: 1 }, bonusEffects: ['MP +30', 'MPR+1'] },
  antimagic_necklace:      { id: 'antimagic_necklace',      name: '항마의 목걸이',          type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 300, weight: 5000 },
  guardian_necklace:       { id: 'guardian_necklace',       name: '수호의 목걸이',          type: 'necklace', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 0, sellPrice: 1000, weight: 5000 },

  /* ── 반지 (8종, type: ring) ── 강화 불가
     미구현 옵션은 주석으로 보관:
     - 변신 조종 반지: 0AC, 변신 기능 미구현
     - 상아탑의 반지: 1AC +0, 거래 불가, 군/기/요/마 착용
     - 순간이동 조종 반지: 0AC, 텔레포트 기능 미구현
  */
  elder_ring:              { id: 'elder_ring',              name: '장로의 반지',            type: 'ring', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 45, weight: 3000,    bonuses: { mp: 10, mpr: 1 }, bonusEffects: ['MP +10', 'MPR+1'] },
  antimagic_ring:          { id: 'antimagic_ring',          name: '항마의 반지',            type: 'ring', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 1000, weight: 3000,   bonuses: { mr: 5 }, bonusEffects: ['MR +5'] },
  water_ring:              { id: 'water_ring',              name: '수령의 반지',            type: 'ring', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 1000, weight: 3000,   bonusEffects: ['물 속성 저항+30 (미구현)'] },
  banish_ring:             { id: 'banish_ring',             name: '멸마의 반지',            type: 'ring', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 1500, weight: 3000,  bonuses: { mr: 10 }, bonusEffects: ['MR +10'] },
  guardian_ring:           { id: 'guardian_ring',           name: '수호의 반지',            type: 'ring', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 0, sellPrice: 950, weight: 3000 },

  /* ── 벨트 (18종, type: belt) ── 강화 불가
     미구현 옵션은 주석으로 보관:
     - (축) 낡은 정신의 벨트: 0AC, MP +30, 축복/MP 미구현 (Lv.15~)
     - 낡은 정신의 벨트: 0AC, MP +30, MP 미구현 (Lv.15~)
     - 빛나는 정신의 벨트: 0AC, MP +50/MP 회복량 +1, MP 미구현 (Lv.30~)
     - 수호의 벨트: 0AC, 무게 한도+400/세트: 수호, PC방 한정
     - 영양 만점 허리끈: 0AC, 군/기/요/마 착용
     - 오우거의 벨트: 0AC, 무게 한도+1000, 무게 미구현
     - 정신의 벨트: 0AC, MP +50, MP 미구현 (Lv.30~)
     - 타이탄의 벨트: 0AC, 무게 한도+2000, 기사 전용
     - 트롤의 벨트: 0AC, 무게 한도+500, 군주/기사/요정 착용
     - 항마의 벨트: 0AC, 무게 한도+400/세트: 항마, PC방 한정
  */
  old_soul_belt:           { id: 'old_soul_belt',           name: '낡은 영혼의 벨트',       type: 'belt', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 7500, weight: 50000,   bonuses: { hp: 15, mp: 15 }, bonusEffects: ['HP +15', 'MP +15'] },
  old_body_belt:           { id: 'old_body_belt',           name: '낡은 신체의 벨트',       type: 'belt', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 7500, weight: 50000,   bonuses: { hp: 30 }, bonusEffects: ['HP +30'] },
  soul_belt:               { id: 'soul_belt',               name: '영혼의 벨트',            type: 'belt', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 15000, weight: 50000,   bonuses: { hp: 25, mp: 25 }, bonusEffects: ['HP +25', 'MP +25'] },
  body_belt:               { id: 'body_belt',               name: '신체의 벨트',            type: 'belt', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 8000, weight: 50000,   bonuses: { hp: 50 }, bonusEffects: ['HP +50'] },
  courage_belt:            { id: 'courage_belt',            name: '용기의 벨트',            type: 'belt', baseAtk: 0, baseAtkLarge: 0, baseDef: 1, maxEnhance: 0, sellPrice: 300, weight: 50000,  bonuses: { hp: 30 }, bonusEffects: ['HP +30'] },
  shining_soul_belt:       { id: 'shining_soul_belt',       name: '빛나는 영혼의 벨트',      type: 'belt', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 800, weight: 50000,  bonuses: { hp: 20, mp: 20, hpr: 1, mpr: 1 }, bonusEffects: ['HP +20', 'MP +20', 'HPR+1', 'MPR+1'] },
  shining_body_belt:       { id: 'shining_body_belt',       name: '빛나는 신체의 벨트',      type: 'belt', baseAtk: 0, baseAtkLarge: 0, baseDef: 0, maxEnhance: 0, sellPrice: 1100, weight: 50000, bonuses: { hp: 50, hpr: 1 }, bonusEffects: ['HP +50', 'HPR+1'] },
  giant_ring_belt:         { id: 'giant_ring_belt',         name: '에이션트 자이언트의 반지', type: 'belt', baseAtk: 0, baseAtkLarge: 0, baseDef: 2, maxEnhance: 0, sellPrice: 1500, weight: 50000, bonuses: { str: 1 }, bonusEffects: ['STR +1'] },
};

// ── Equipment Templates (통합) ──
// CSV 데이터 위에 수동 정의를 덮어씀 (수동 정의 우선)
// 수동 정의에 safeEnchant 미지정 시 L1J 기본값 적용 (무기=6, 방어구=4)
function defaultSafeEnchant(t: Omit<EquipmentTemplate, 'safeEnchant'> & { safeEnchant?: number }): EquipmentTemplate {
  if (t.safeEnchant != null) return t as EquipmentTemplate;
  const isWeapon = t.type === 'weapon' || t.type === 'bow' || t.type === 'staff';
  return { ...t, safeEnchant: isWeapon ? 6 : 4 } as EquipmentTemplate;
}

const merged: Record<string, EquipmentTemplate> = { ...CSV_EQUIPMENT };
for (const [k, v] of Object.entries(HAND_CURATED_TEMPLATES)) {
  merged[k] = defaultSafeEnchant(v);
}
export const EQUIPMENT_TEMPLATES: Record<string, EquipmentTemplate> = merged;

// ── 세트 효과 → setData.ts로 이관됨 (L1J armor_sets.csv 34종) ──

// ── Hunt Zones (monsterData.ts 에서 생성) ──
export const HUNT_ZONES: HuntZone[] = generateHuntZones();

// ── Recipes ──
export const RECIPES: Recipe[] = [
  {
    id: 'recipe_katana',
    resultTemplateId: 'katana',
    materials: [{ materialId: 'iron_ore', quantity: 20 }, { materialId: 'old_leather', quantity: 5 }],
    goldCost: 300,
    requiredLevel: 8,
  },
  {
    id: 'recipe_chain_armor',
    resultTemplateId: 'chain_armor',
    materials: [{ materialId: 'iron_ore', quantity: 30 }],
    goldCost: 500,
    requiredLevel: 10,
  },
  {
    id: 'recipe_dragon_slayer',
    resultTemplateId: 'dragon_slayer',
    materials: [{ materialId: 'mithril_shard', quantity: 15 }, { materialId: 'iron_ore', quantity: 20 }],
    goldCost: 1000,
    requiredLevel: 15,
  },
  {
    id: 'recipe_plate_armor',
    resultTemplateId: 'plate_armor',
    materials: [{ materialId: 'mithril_shard', quantity: 15 }, { materialId: 'old_leather', quantity: 10 }],
    goldCost: 800,
    requiredLevel: 18,
  },
  {
    id: 'recipe_ancient_great_sword',
    resultTemplateId: 'ancient_great_sword',
    materials: [{ materialId: 'mithril_shard', quantity: 25 }, { materialId: 'orc_seal', quantity: 5 }, { materialId: 'soul_stone', quantity: 10 }],
    goldCost: 2000,
    requiredLevel: 28,
  },
  {
    id: 'recipe_dk_flame_sword',
    resultTemplateId: 'dk_flame_sword',
    materials: [{ materialId: 'soul_stone', quantity: 30 }, { materialId: 'cursed_iron', quantity: 20 }, { materialId: 'orc_seal', quantity: 10 }],
    goldCost: 5000,
    requiredLevel: 35,
  },
];

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

