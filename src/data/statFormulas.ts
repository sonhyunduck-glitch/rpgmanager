/* =========================================================
   STAT FORMULAS — 4-스탯 시스템 (STR, DEX, CON, WIS)
   ========================================================= */

// ── 초기 스탯 (레벨 1 기본값) ──

export const BASE_STATS = {
  str: 16,
  dex: 12,
  con: 14,
  wis: 9,
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
  return min + Math.floor(Math.random() * (max - min + 1));
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
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** 초기 HP (레벨 1) = max(16, CON + 1) */
export function startingHp(con: number): number {
  return Math.max(16, con + 1);
}

// ── DEX 관련 ──

/**
 * DEX에 의한 AC 보너스 (음수 = AC 감소 = 회피 향상)
 * ≤15: 0 / 16~18: -1 / 19~22: -2 / 23~26: -3 / 27~30: -4
 * 31~34: -5 / 35~38: -6 / 39~42: -7 / ...
 */
export function dexAcBonus(dex: number): number {
  if (dex <= 15) return 0;
  if (dex <= 18) return -1;
  return -(2 + Math.floor((dex - 19) / 4));
}

/**
 * 최종 AC = 10 - 방어구AC감소 - floor(level/7) + dexAcBonus
 * 값이 낮을수록 공격에 대한 회피율 증가
 */
export function finalAC(
  armorAcReduction: number,
  level: number,
  dex: number,
): number {
  return 10 - armorAcReduction - Math.floor(level / 7) + dexAcBonus(dex);
}

/**
 * AC에서 회피(evasion) 유도
 * AC 10 = 기본(비무장) → evasion 0
 * AC가 낮을수록 evasion 증가 (D&D/리니지 스타일)
 * AC 5 → evasion 5, AC 0 → 10, AC -10 → 20, AC -65 → 75
 */
export function acToEvasion(ac: number): number {
  return Math.max(0, 10 - ac);
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
  return { hit: Math.random() < rate, rate };
}

// ── 스탯 포인트 ──

/**
 * 사용 가능한 총 스탯 포인트
 * 레벨 1: 4 포인트
 * 레벨 2~49: 추가 없음
 * 레벨 50 이후: 레벨당 +1
 */
export function totalStatPoints(level: number): number {
  return 4 + Math.max(0, level - 49);
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
    total += 1 + Math.floor(Math.random() * sides);
  }
  return total;
}

/** 몬스터 대미지 범위 — min = N + B, max = N×S + B */
export function monsterDamageRange(
  dice: number, sides: number, extra: number,
): { min: number; max: number } {
  return { min: dice + extra, max: dice * sides + extra };
}
