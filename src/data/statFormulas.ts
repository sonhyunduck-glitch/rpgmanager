/* =========================================================
   STAT FORMULAS — 5-스탯 시스템 (STR, DEX, CON, WIS, INT)
   L1J 3.63c 원본 공식 최대 반영
   ========================================================= */
import { secureRandom, secureRandomInt } from '../lib/random';
import type { PlayerClass } from '../types';

// ── 최대 소지 무게 ──

/**
 * 최대 소지 무게 (L1J 기반)
 * L1J: 150 * STR + 1000 (기본 공식)
 * weight 단위: L1J의 1/10 단위 그대로 사용
 */
export function maxCarryWeight(str: number): number {
  return 150 * str + 1000;
}

// ── 초기 스탯 (레벨 1 기본값 — 기사 기준, 클래스별은 classData.ts) ──

export const BASE_STATS = {
  str: 16,
  dex: 12,
  con: 14,
  wis: 9,
  int: 8,
} as const;

// ── STR 관련 ──

/**
 * STR 보너스 — 근거리 추가 대미지 보너스
 * STR 14 이하: +0 / 15~16: +1 / 17~18: +2 / ...
 */
export function strBonus(str: number): number {
  if (str <= 14) return 0;
  return Math.floor((str - 13) / 2);
}

/**
 * 근거리 추가 대미지
 * = 인챈트 +1당 +1 + 10레벨당 +1 + STR 보너스
 */
export function meleeAdditionalDamage(
  level: number,
  enchantLevel: number,
  str: number,
): number {
  return enchantLevel + Math.floor(level / 10) + strBonus(str);
}

/** 대미지 최소값: 1 + 근거리 추가 대미지 */
export function minDamage(
  level: number,
  enchantLevel: number,
  str: number,
): number {
  return 1 + meleeAdditionalDamage(level, enchantLevel, str);
}

/** 대미지 최대값: 무기 기본타격치 + 근거리 추가 대미지 */
export function maxDamage(
  weaponBaseDamage: number,
  level: number,
  enchantLevel: number,
  str: number,
): number {
  return weaponBaseDamage + meleeAdditionalDamage(level, enchantLevel, str);
}

/** 대미지 굴림 (min ~ max 랜덤) */
export function rollDamage(
  weaponBaseDamage: number,
  level: number,
  enchantLevel: number,
  str: number,
): number {
  const min = minDamage(level, enchantLevel, str);
  const max = maxDamage(weaponBaseDamage, level, enchantLevel, str);
  return secureRandomInt(min, max);
}

// ── CON 관련 ──

/**
 * 레벨업 시 HP 증가 범위
 * CON 15: 6~12, CON 16: 7~13, ... → min = CON - 9, max = CON - 3
 */
export function hpGainRange(con: number): { min: number; max: number } {
  return { min: con - 9, max: con - 3 };
}

/** 레벨업 시 HP 증가 굴림 */
export function rollHpGain(con: number): number {
  const { min, max } = hpGainRange(con);
  return secureRandomInt(min, max);
}

/** 초기 HP (레벨 1) = max(16, CON + 1) */
export function startingHp(con: number): number {
  return Math.max(16, con + 1);
}

// ══════════════════════════════════════════════
// AC 시스템 (L1J CalcStat.java + L1Attack.java)
// ══════════════════════════════════════════════

/**
 * 기본 AC 계산 (L1J CalcStat.calcAc 원본)
 * DEX 구간별 다른 레벨 제수 — 높은 DEX일수록 레벨당 AC 감소↑
 *
 * 맨몸 AC = 10, 레벨/DEX로 감소
 * DEX ≤9:   10 - level/8
 * DEX 10-12: 10 - level/7
 * DEX 13-15: 10 - level/6
 * DEX 16-17: 10 - level/5
 * DEX ≥18:  10 - level/4
 */
export function calcBaseAc(level: number, dex: number): number {
  let divisor: number;
  if (dex <= 9) divisor = 8;
  else if (dex <= 12) divisor = 7;
  else if (dex <= 15) divisor = 6;
  else if (dex <= 17) divisor = 5;
  else divisor = 4; // dex >= 18
  return 10 - Math.floor(level / divisor);
}

/**
 * DEX 원본 AC 보너스 (L1J resetOriginalAc — 클래스별)
 * 캐릭터 기본 DEX에서 추가 AC 보너스 (0 ~ -3)
 */
export function calcOriginalDexAcBonus(dex: number, playerClass: PlayerClass): number {
  switch (playerClass) {
    case 'knight':
      if (dex >= 15) return -3;
      if (dex >= 13) return -1;
      return 0;
    case 'elf':
      if (dex >= 18) return -2;
      if (dex >= 15) return -1;
      return 0;
    case 'wizard':
      if (dex >= 10) return -2;
      if (dex >= 8) return -1;
      return 0;
  }
}

/**
 * 최종 AC 계산 (L1J 원본 기반)
 * = calcBaseAc(level, dex) - totalArmorDef + dexAcBonus
 *
 * ⚠️ L1J에서 장비 AC는 음수값(예: -7)이 직접 가산되지만,
 *    우리 게임은 양수 baseDef를 감산하므로 수학적으로 동일.
 */
export function finalAC(
  totalArmorDef: number,
  level: number,
  dex: number,
  playerClass: PlayerClass,
): number {
  return calcBaseAc(level, dex) - totalArmorDef + calcOriginalDexAcBonus(dex, playerClass);
}

/**
 * AC 기반 대미지 감소 (L1J calcPcDefense 원본)
 *
 * ⚠️ 명중 판정과 별개! 명중 후 대미지에서 차감하는 단계.
 *
 * acDef = max(0, 10 - playerAC)
 * acDefMax = 클래스별 상한 (Knight /2, Elf /3, Wizard /5)
 * 감소량 = random(0 ~ acDefMax)
 */
export function calcPcDefense(playerAC: number, playerClass: PlayerClass): number {
  const acDef = Math.max(0, 10 - playerAC);
  let acDefMax: number;
  switch (playerClass) {
    case 'knight': acDefMax = Math.floor(acDef / 2); break;
    case 'elf':    acDefMax = Math.floor(acDef / 3); break;
    case 'wizard': acDefMax = Math.floor(acDef / 5); break;
  }
  return secureRandomInt(0, acDefMax);
}

// ── WIS 관련 ──

/**
 * WIS에 의한 MR 보너스 — WIS 12 이하: 0, 13부터 WIS 1당 MR +2
 */
export function wisMrBonus(wis: number): number {
  if (wis <= 12) return 0;
  return (wis - 12) * 2;
}

/** 최종 MR = floor(level/6) + wisMrBonus */
export function finalMR(level: number, wis: number): number {
  return Math.floor(level / 6) + wisMrBonus(wis);
}

/**
 * MR 기반 마법 데미지 감소율
 * 감소율 = MR / (MR + 50)
 * MR 0 → 0%, MR 25 → 33%, MR 50 → 50%, MR 100 → 67%
 */
export function magicReduction(mr: number): number {
  if (mr <= 0) return 0;
  return mr / (mr + 50);
}

/** 마법 데미지에 MR 감소 적용 */
export function applyMagicReduction(rawDmg: number, mr: number): number {
  return Math.max(1, Math.round(rawDmg * (1 - magicReduction(mr))));
}

// ── 사망 경험치 손실률 ──

/**
 * 사망 시 경험치 손실률 (레벨 기반)
 * Lv.44 이하: 10%, Lv.45: 9%, Lv.46: 8%, Lv.47: 7%, Lv.48: 6%, Lv.49+: 5%
 */
export function deathExpLossRate(level: number): number {
  if (level <= 44) return 0.10;
  if (level <= 48) return (54 - level) / 100; // 45→9%, 46→8%, 47→7%, 48→6%
  return 0.05;
}

// ── 근거리 명중 ──

/** 근거리 명중 = 레벨 + 인챈트 레벨 + STR */
export function meleeHit(
  level: number,
  enchantLevel: number,
  str: number,
): number {
  return level + enchantLevel + str;
}

// ── 명중률 (2구간 공식) ──

/**
 * 명중률 계산 (PvE 공식)
 * 기본 70% + (playerHit - monsterEvade) * 3%
 * 최소 5%, 최대 95%
 */
export function calcHitRate(hit: number, evasion: number): number {
  const rate = 0.70 + (hit - evasion) * 0.03;
  return Math.max(0.05, Math.min(0.95, rate));
}

/** 명중 판정 — calcHitRate 결과로 적중 여부 반환 */
export function rollHit(
  hit: number,
  evasion: number,
): { hit: boolean; rate: number } {
  const rate = calcHitRate(hit, evasion);
  return { hit: secureRandom() < rate, rate };
}

// ── 스탯 포인트 ──

/**
 * 사용 가능한 총 스탯 포인트 (클래스별 초기 포인트)
 * 기사: 4, 요정: 7, 마법사: 16
 * 레벨 50 이후: 레벨당 +1
 */
export function totalStatPoints(level: number, initialPoints: number = 4): number {
  return initialPoints + Math.max(0, level - 49);
}

// ── 몬스터 대미지 (NdS + B) ──

/** 몬스터 주사위 개수 — 레벨 10당 +1 */
export function monsterDamDice(level: number): number {
  return 1 + Math.floor(level / 10);
}

/**
 * 몬스터 주사위 면수 — 크기 기반
 * 소형(S): d5, 대형(L): d8, 골렘/거인: d10
 */
export function monsterDamDiceSides(size: 'small' | 'large', name: string): number {
  if (name.includes('골렘') || name.includes('거인')) return 10;
  return size === 'large' ? 8 : 5;
}

/**
 * 몬스터 STR/INT 보너스 → 추가 대미지
 * 플레이어 strBonus와 동일 공식: stat ≤ 14 → 0, 이후 2당 +1
 */
export function monsterBonusDamage(stat: number): number {
  if (stat <= 14) return 0;
  return Math.floor((stat - 13) / 2);
}

/** 몬스터 대미지 굴림 — NdS + B */
export function rollMonsterDamage(
  dice: number, sides: number, extra: number,
): number {
  let total = extra;
  for (let i = 0; i < dice; i++) {
    total += secureRandomInt(1, sides);
  }
  return total;
}

/** 몬스터 대미지 범위 — min = N + B, max = N×S + B */
export function monsterDamageRange(
  dice: number, sides: number, extra: number,
): { min: number; max: number } {
  return { min: dice + extra, max: dice * sides + extra };
}

// ══════════════════════════════════════════════
// L1J STR/DEX 룩업 테이블 (L1Attack.java 원본 그대로)
// ⚠️ 임의 수정 금지 — L1J 3.63c 소스에서 1:1 추출
// ══════════════════════════════════════════════

// strHit[59]: 인덱스 0 = STR 1 (접근: strHit[str - 1])
// L1Attack.java lines 198-201
export const STR_HIT_TABLE: number[] = [
  /* STR 1-7  */ -2, -2, -2, -2, -2, -2, -2,
  /* STR 8-10 */ -2, -1, -1,
  /* STR 11-12 */ 0, 0,
  /* STR 13-14 */ 1, 1,
  /* STR 15-16 */ 2, 2,
  /* STR 17-18 */ 3, 3,
  /* STR 19-20 */ 4, 4,
  /* STR 21-23 */ 5, 5, 5,
  /* STR 24-26 */ 6, 6, 6,
  /* STR 27-29 */ 7, 7, 7,
  /* STR 30-32 */ 8, 8, 8,
  /* STR 33-35 */ 9, 9, 9,
  /* STR 36-38 */ 10, 10, 10,
  /* STR 39-41 */ 11, 11, 11,
  /* STR 42-44 */ 12, 12, 12,
  /* STR 45-47 */ 13, 13, 13,
  /* STR 48-50 */ 14, 14, 14,
  /* STR 51-53 */ 15, 15, 15,
  /* STR 54-56 */ 16, 16, 16,
  /* STR 57-59 */ 17, 17, 17,
]; // 59 elements

// dexHit[60]: 인덱스 0 = DEX 1 (접근: dexHit[dex - 1])
// L1Attack.java lines 202-205
export const DEX_HIT_TABLE: number[] = [
  /* DEX 1-6  */ -2, -2, -2, -2, -2, -2,
  /* DEX 7-8  */ -1, -1,
  /* DEX 9-10 */ 0, 0,
  /* DEX 11-12 */ 1, 1,
  /* DEX 13-14 */ 2, 2,
  /* DEX 15-16 */ 3, 3,
  /* DEX 17-18 */ 4, 4,
  /* DEX 19   */ 5,
  /* DEX 20   */ 6,
  /* DEX 21   */ 7,
  /* DEX 22   */ 8,
  /* DEX 23   */ 9,
  /* DEX 24   */ 10,
  /* DEX 25   */ 11,
  /* DEX 26   */ 12,
  /* DEX 27   */ 13,
  /* DEX 28   */ 14,
  /* DEX 29   */ 15,
  /* DEX 30   */ 16,
  /* DEX 31   */ 17,
  /* DEX 32   */ 18,
  /* DEX 33-35 */ 19, 19, 19,
  /* DEX 36-38 */ 20, 20, 20,
  /* DEX 39-41 */ 21, 21, 21,
  /* DEX 42-44 */ 22, 22, 22,
  /* DEX 45-47 */ 23, 23, 23,
  /* DEX 48-50 */ 24, 24, 24,
  /* DEX 51-53 */ 25, 25, 25,
  /* DEX 54-56 */ 26, 26, 26,
  /* DEX 57-59 */ 27, 27, 27,
  /* DEX 60   */ 28,
]; // 60 elements

// strDmg[60]: 인덱스 = STR 값 (접근: strDmg[str])
// L1Attack.java lines 207-240 (static initializer 연산 결과)
export const STR_DMG_TABLE: number[] = [
  /* STR 0-9  */ -6, -5, -5, -4, -4, -3, -3, -2, -2, -1,
  /* STR 10-19 */ -1, 0, 0, 1, 1, 2, 2, 3, 3, 4,
  /* STR 20-29 */ 4, 5, 5, 6, 6, 6, 7, 7, 7, 8,
  /* STR 30-39 */ 8, 9, 9, 10, 11, 11, 11, 12, 12, 12,
  /* STR 40-49 */ 12, 13, 13, 13, 13, 14, 14, 14, 14, 15,
  /* STR 50-59 */ 15, 15, 15, 16, 16, 16, 16, 17, 17, 17,
]; // 게임 실사용 구간 0~59

// dexDmg[60]: 인덱스 = DEX 값 (접근: dexDmg[dex])
// L1Attack.java lines 242-272 (static initializer 연산 결과)
export const DEX_DMG_TABLE: number[] = [
  /* DEX 0-9  */ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  /* DEX 10-19 */ 0, 0, 0, 0, 0, 1, 2, 3, 4, 4,
  /* DEX 20-29 */ 4, 5, 5, 5, 6, 6, 6, 7, 7, 7,
  /* DEX 30-39 */ 8, 8, 8, 9, 9, 9, 10, 10, 10, 10,
  /* DEX 40-49 */ 11, 11, 11, 11, 12, 12, 12, 12, 13, 13,
  /* DEX 50-59 */ 13, 13, 14, 14, 14, 14, 15, 15, 15, 15,
]; // 게임 실사용 구간 0~59

/** 안전한 룩업 (배열 범위 초과 방지) */
function lookupStat(table: number[], idx: number): number {
  const clamped = Math.max(0, Math.min(idx, table.length - 1));
  return table[clamped];
}

// ══════════════════════════════════════════════
// D20 명중 시스템 (L1Attack.java calcPcNpcHit 기반)
// ══════════════════════════════════════════════

/**
 * 플레이어 hitRate 계산 (L1J calcPcNpcHit lines 619-634)
 *
 * L1J 원본: hitRate = level + strHit[str-1] + dexHit[dex-1]
 *           + weaponAddHit + hitup + floor(enchant/2)
 *
 * ⚠️ STR과 DEX 모두 hitRate에 기여 (무기 종류 무관)
 *    활은 bowHitup, 검은 hitup 사용 (장비 보너스 슬롯만 다름)
 *    인챈트는 floor(enchant/2)만 기여 (전체 아님)
 */
export function calcPlayerHitRate(
  level: number, str: number, dex: number,
  enchantLevel: number, equipBonusHit: number,
): number {
  return level
    + lookupStat(STR_HIT_TABLE, str - 1)   // strHit[str-1]
    + lookupStat(DEX_HIT_TABLE, dex - 1)   // dexHit[dex-1]
    + Math.floor(enchantLevel / 2)          // 인챈트/2 (정수 나눗셈)
    + equipBonusHit;                        // weaponAddHit + hitup
}
// 마법사는 자동 명중이므로 이 함수 미사용

/**
 * D20 PC→NPC 명중 판정 (L1J calcPcNpcHit 원본)
 *
 * 공격자: random(1~20) + hitRate - 10
 * 방어자: 10 - monsterAC  ← ⚠️ 결정적 (랜덤 아님!)
 *
 * Fumble: attackDice <= hitRate - 9 → 무조건 빗나감
 * Critical: attackDice >= hitRate + 10 → 무조건 명중
 * 그 외: attackDice > defenderDice → 명중
 */
export function rollD20PcNpcHit(
  hitRate: number,
  monsterAC: number,
): { hit: boolean; attackDice: number; defenderDice: number } {
  const attackDice = secureRandomInt(1, 20) + hitRate - 10;
  const defenderDice = 10 - monsterAC; // ← 고정값! (AC -5 → 15)

  const fumble = hitRate - 9;
  const critical = hitRate + 10;

  let hit: boolean;
  if (attackDice <= fumble) {
    hit = false;
  } else if (attackDice >= critical) {
    hit = true;
  } else {
    hit = attackDice > defenderDice;
  }

  return { hit, attackDice, defenderDice };
}

// ⚠️ rollBowErCheck 삭제 — L1J PvE(calcPcNpcHit)에서 ER 체크 없음
// ER은 PvP(calcPcPcHit)에서만 적용됨. 우리 게임은 PvE이므로 불필요.

/**
 * D20 NPC→PC 명중 판정 (L1J calcNpcPcHit 원본)
 *
 * ⚠️ defenderDice에 클래스별 AC 캡 없음! (그건 대미지 감소에서 적용)
 *
 * 공격자: random(1~20) + hitRate - 1  ← -10이 아닌 -1! (NPC +9 보정)
 * 방어자:
 *   AC >= 0: 10 - AC (고정)
 *   AC <  0: 10 + random(1~|AC|) (랜덤!)
 *
 * Fumble: attackDice <= hitRate  (hitRate-0)
 * Critical: attackDice >= hitRate + 19
 */
export function rollD20NpcPcHit(
  monsterHitRate: number,
  playerAC: number,
): { hit: boolean; attackDice: number; defenderDice: number } {
  const attackDice = secureRandomInt(1, 20) + monsterHitRate - 1;

  let defenderDice: number;
  if (playerAC >= 0) {
    defenderDice = 10 - playerAC;
  } else {
    // AC < 0: 방어 다이스에 랜덤 요소 (클래스 캡 없음 — L1J 원본)
    const absAC = -playerAC;
    defenderDice = 10 + secureRandomInt(1, absAC);
  }

  const fumble = monsterHitRate;
  const critical = monsterHitRate + 19;

  let hit: boolean;
  if (attackDice <= fumble) {
    hit = false;
  } else if (attackDice >= critical) {
    hit = true;
  } else {
    hit = attackDice > defenderDice;
  }

  return { hit, attackDice, defenderDice };
}

// ══════════════════════════════════════════════
// DEX 기반 활 대미지 (L1J 원본)
// ══════════════════════════════════════════════

/** DEX 기반 추가 대미지 — 룩업 테이블 사용 */
export function dexDmgBonus(dex: number): number {
  return lookupStat(DEX_DMG_TABLE, dex);
}

/** 활 추가 대미지 = floor(인챈트/2) + 레벨/10 + DEX 대미지 보너스 */
export function rangedAdditionalDamage(
  level: number, enchantLevel: number, dex: number,
): number {
  return Math.floor(enchantLevel / 2) + Math.floor(level / 10) + dexDmgBonus(dex);
}

/** 활 대미지 굴림 = (1 + 추가) ~ (bowBase + 추가) */
export function rollBowDamage(
  bowBaseDmg: number, level: number, enchantLevel: number, dex: number,
): number {
  const additional = rangedAdditionalDamage(level, enchantLevel, dex);
  const min = 1 + additional;
  const max = bowBaseDmg + additional;
  return secureRandomInt(min, max);
}

// ══════════════════════════════════════════════
// WIS/INT 기반 마법 (L1J L1Magic.java + L1Character.java)
// ══════════════════════════════════════════════

/**
 * 마법 레벨 (클래스별)
 * L1J L1Character.getMagicLevel(): level/4 (정수 나눗셈)
 * 클래스별 상한은 게임 밸런스 — Knight=level/50, Elf=min(6,level/8)
 * Wizard는 원본 level/4 사용 (상한 10은 우리 게임 추가)
 */
export function magicLevel(level: number, playerClass: PlayerClass): number {
  switch (playerClass) {
    case 'knight': return Math.floor(level / 50);
    case 'elf':    return Math.min(6, Math.floor(level / 8));
    case 'wizard': return Math.min(10, Math.floor(level / 4));
  }
}

/**
 * 마법 보너스 (L1J L1Character.getMagicBonus() 원본)
 * ⚠️ INT 기반 룩업 테이블 — floor(wis/6)이 아님!
 *
 * INT ≤5: -2 | 6-8: -1 | 9-11: 0 | 12-14: 1 | 15-17: 2
 * INT 18-24: INT-15 | 25-35: 10 | 36-42: 11 | 43-49: 12
 * INT 50: 13 | INT ≥51: INT-37
 */
export function getMagicBonus(int: number): number {
  if (int <= 5) return -2;
  if (int <= 8) return -1;
  if (int <= 11) return 0;
  if (int <= 14) return 1;
  if (int <= 17) return 2;
  if (int <= 24) return int - 15;
  if (int <= 35) return 10;
  if (int <= 42) return 11;
  if (int <= 49) return 12;
  if (int <= 50) return 13;
  return int - 37;
}

/**
 * 마법 확률 주사위 수 (L1J L1Magic.java)
 * = getMagicBonus(INT) + magicLevel
 *
 * ⚠️ 이것은 마법 "명중 확률" 판정용이지, 대미지 주사위 수가 아님!
 *    대미지 주사위 수는 스킬 템플릿의 getDamageDiceCount()에서 결정.
 *    Wizard +1, Elf -1 보정도 확률용에만 적용됨.
 */
export function calcMagicProbabilityDice(
  int: number, level: number, playerClass: PlayerClass,
): number {
  let dice = getMagicBonus(int) + magicLevel(level, playerClass);
  if (playerClass === 'wizard') dice += 1;
  if (playerClass === 'elf') dice -= 1;
  return Math.max(1, dice);
}

/**
 * 마법 대미지 계수 (L1J L1Magic.java calcMagicDiceDamage 원본)
 * coefficient = 1.0 + attrDefence + (charaIntelligence + itemSP - 12) * 3.0 / 32.0
 *
 * ⚠️ 파라미터 주의:
 *   - int: 캐릭터 INT (마법 공격력 — 독립 스탯)
 *   - sp: 장비 SP 보너스 합산
 *   - attrBonus: 속성 약점 +0.5, 내성 -0.5 (기본 0)
 */
export function magicCoefficient(int: number, sp: number, attrBonus: number = 0): number {
  return 1.0 + attrBonus + ((int + sp - 12) * 3.0) / 32.0;
}

/**
 * 마법 대미지 굴림 (L1J L1Magic.java 기반)
 *
 * 1) diceCount개의 d6 굴림 (diceCount = 스킬 템플릿 기반)
 *    → 우리 게임: magicBonus(INT) + magicLevel로 간소화
 * 2) + staffBase (지팡이 기본 대미지)
 * 3) × coefficient
 * 4) 크리티컬 체크 (별도)
 * 5) MR 감소 (별도)
 */
export function rollMagicDamage(
  staffBaseDmg: number,
  int: number, sp: number,
  level: number, playerClass: PlayerClass,
  attrBonus?: number,
): number {
  // 대미지 주사위 수: L1J에서는 스킬 템플릿 기반이지만,
  // 우리 게임은 오토배틀이므로 magicBonus+magicLevel로 간소화
  const diceCount = Math.max(1,
    getMagicBonus(int) + magicLevel(level, playerClass));
  const coeff = magicCoefficient(int, sp, attrBonus);
  let total = 0;
  for (let i = 0; i < diceCount; i++) {
    total += secureRandomInt(1, 6); // d6
  }
  total += staffBaseDmg;
  return Math.max(1, Math.floor(total * coeff));
}

/**
 * 마법 크리티컬 판정 (L1J 원본)
 * 조건: 사용 마법이 Lv.6 이하
 * 확률: (10 + magicCritical)% → 우리 게임: 고정 10%
 * 효과: 1.5배
 */
export function rollMagicCritical(): { isCrit: boolean } {
  return { isCrit: secureRandom() < 0.10 };
}

/**
 * 연속 마법 감쇠 (L1J 원본)
 * 2초 내 연속 마법 피격 시 데미지 × (2/3)^n
 * n = 연속 피격 횟수 (인덱스 상한 8)
 * 2~4초: 전이 구간 (이전 n 유지하되 증가 안 함)
 * PC 타겟에만 적용 (NPC에는 미적용)
 */
export function consecutiveMagicDecay(consecutiveHits: number): number {
  if (consecutiveHits <= 0) return 1.0;
  const capped = Math.min(consecutiveHits, 8); // 인덱스 상한 8
  return Math.pow(2 / 3, capped);
}

// ── 몬스터 hitRate (D20용) ──

/** 몬스터 hitRate = level + hitup (L1J calcNpcPcHit) */
export function calcMonsterHitRate(monsterLevel: number, monsterHitup: number): number {
  return monsterLevel + monsterHitup;
}

// ══════════════════════════════════════════════
// ⚠️ 하위 호환 (deprecated) — 소비자 업데이트 후 삭제 예정
// ══════════════════════════════════════════════

/**
 * @deprecated D20 시스템 도입으로 사용 안 함. calcPlayerHitRate + rollD20PcNpcHit 사용.
 * 소비자(combatTick, LeftPanel 등) 업데이트 후 삭제 예정.
 */
export function acToEvasion(ac: number): number {
  return ac;
}

// ══════════════════════════════════════════════
// MP 시스템 (L1J 기반)
// ══════════════════════════════════════════════

/**
 * 최대 MP 계산 (L1J L1PcInstance 기반 간소화)
 *
 * Wizard: 16 + level×3 + floor(INT/3) — 마법 주력, 높은 MP
 * Elf:    8 + floor(level×1.5) + floor(WIS/4) — 정령 마법, 중간 MP
 * Knight: 4 + floor(level/3) + floor(WIS/6) — 기사 스킬, 낮은 MP
 */
export function calcMaxMp(level: number, wis: number, int: number, playerClass: PlayerClass): number {
  switch (playerClass) {
    case 'wizard': return 16 + level * 3 + Math.floor(int / 3);
    case 'elf':    return 8 + Math.floor(level * 1.5) + Math.floor(wis / 4);
    case 'knight': return 4 + Math.floor(level / 3) + Math.floor(wis / 6);
  }
}

/**
 * MP 자연 회복 — L1J MpRegeneration.java 원본
 *
 * L1J 구조:
 *   1초마다 _curPoint(기본 4) 누적 → _regenPoint ≥ 64 → MP 회복
 *   → 64/4 = 16초마다 1회 회복
 *
 * 우리 게임 적용 (1틱 = 3초):
 *   매 틱 _curPoint(=4)×3 = 12 포인트 누적
 *   64/12 ≈ 5.33틱(≈16초)마다 1회 회복
 *
 * 회복량 (L1J MpRegeneration.regenMp 원본):
 *   WIS 1-14:  1 MP
 *   WIS 15-16: 2 MP
 *   WIS 17+:   3 MP
 */

// ══════════════════════════════════════════════
// HP/MP 자연 회복 (벽시계 기준 고정 주기)
//
// L1J 포인트 누적 방식 대신 단순화:
// 00:00:00 기준 N초마다 회복 (공격속도 버프 영향 없음)
//
// MP: 고정 16초 주기
// HP: 레벨/클래스별 가변 주기 (L1J lvlTable 기반)
// ══════════════════════════════════════════════

// ── HP 리젠 (L1J HpRegeneration.java) ──

/**
 * HP 리젠 주기 테이블 (초) — L1J lvlTable 원본
 * 레벨이 높을수록 짧은 주기 (빠른 회복)
 *
 * L1J: lvlTable = { 30, 25, 20, 16, 14, 12, 11, 10, 9, 3, 2 }
 * L1J 원본은 이 값 × 4 = _regenMax, 그리고 4pt/sec → 결국 lvlTable초 주기
 */
const HP_REGEN_LVL_TABLE = [30, 25, 20, 16, 14, 12, 11, 10, 9, 3, 2];

/**
 * HP 회복량 (L1J HpRegeneration.regenHp 원본, CON 기반)
 *
 * Lv.11 이하 또는 CON ≤ 13: 항상 1 HP
 * Lv.12+ AND CON 14+: 1 ~ (CON - 12) HP (상한 14)
 */
export function calcHpRegenAmount(level: number, con: number): number {
  if (level <= 11 || con <= 13) return 1;
  const maxBonus = Math.min(14, con - 12);
  return 1 + Math.floor(Math.random() * maxBonus); // 1 ~ maxBonus
}

/** HP 회복량 범위 (UI 표시용) */
export function calcHpRegenRange(level: number, con: number): { min: number; max: number } {
  if (level <= 11 || con <= 13) return { min: 1, max: 1 };
  const maxBonus = Math.min(14, con - 12);
  return { min: 1, max: maxBonus };
}

/**
 * HP 리젠 주기 (초) — L1J lvlTable 기반
 * 장비 HPR은 주기가 아닌 회복량에 가산
 */
export function calcHpRegenIntervalSec(level: number, playerClass: PlayerClass): number {
  let idx: number;
  if (playerClass === 'knight' && level >= 30) {
    idx = 10; // Knight Lv.30+: value 2
  } else {
    idx = Math.min(9, Math.max(0, level - 1)); // 0~9 (Lv.1~10+)
  }
  return HP_REGEN_LVL_TABLE[idx];
}

/** HP 리젠 주기 (ms) */
export function calcHpRegenIntervalMs(level: number, playerClass: PlayerClass): number {
  return calcHpRegenIntervalSec(level, playerClass) * 1000;
}

// ── MP 리젠 (L1J MpRegeneration.java) ──

/** MP 리젠 고정 주기 (ms) — 16초 */
export const MP_REGEN_INTERVAL_MS = 16_000;

/** MP 리젠 주기 (초 단위, UI 표시용) */
export function calcMpRegenIntervalSec(): number {
  return MP_REGEN_INTERVAL_MS / 1000; // 16
}

/** MP 회복량 (L1J MpRegeneration.regenMp 원본 WIS 기반) */
export function calcMpRegenAmount(wis: number): number {
  if (wis >= 17) return 3;
  if (wis >= 15) return 2;
  return 1;
}

/**
 * 파란 물약 버프 시 추가 MP 회복량 (L1J 원본)
 * STATUS_BLUE_POTION 활성 시: + max(1, WIS - 10)
 */
export function calcBluePotionMpBonus(wis: number): number {
  return Math.max(1, wis - 10);
}

/**
 * 마법 대미지 굴림 — 스킬별 (L1J L1Magic.java calcMagicDiceDamage 기반)
 *
 * attack 스킬: raw = damageValue + damageDiceCount × d(damageDice)
 * heal 스킬 (diceCount=0): diceCount = max(1, getMagicBonus(int) + magicLevel)
 *
 * 최종: floor(raw × coefficient)
 * coefficient = 1.0 + (INT + SP - 12) * 3.0 / 32.0
 */
export function rollSpellDamage(
  damageValue: number,
  damageDice: number,
  damageDiceCount: number,
  int: number,
  sp: number,
  level: number,
  playerClass: PlayerClass,
): number {
  let diceCount = damageDiceCount;
  // diceCount=0 → 동적 주사위 (힐 등)
  if (diceCount === 0) {
    diceCount = Math.max(1, getMagicBonus(int) + magicLevel(level, playerClass));
  }

  let total = damageValue;
  for (let i = 0; i < diceCount; i++) {
    total += secureRandomInt(1, damageDice); // 1 ~ damageDice
  }

  const coeff = magicCoefficient(int, sp);
  return Math.max(1, Math.floor(total * coeff));
}
