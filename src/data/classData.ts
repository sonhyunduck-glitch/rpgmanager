/* =========================================================
   CLASS DATA — 3클래스 설정 (Single Source of Truth)
   L1J 3.63c ClassFeature 기반

   Knight: 근접 전투, 방패, AC방어 /2
   Elf:    원거리(활), DEX 대미지, AC방어 /3
   Wizard: 원거리(마법), 자동 명중, AC방어 /5
   ========================================================= */
import type { PlayerClass, CombatStyle, EquipType, StatKey } from '../types';

export interface ClassConfig {
  id: PlayerClass;
  nameKo: string;
  nameEn: string;
  description: string;
  combatStyle: CombatStyle;
  baseStats: { str: number; dex: number; con: number; wis: number; int: number };
  allowedWeaponTypes: EquipType[];
  canUseShield: boolean;
  startingGear: {
    weapon: string;
    armor?: string;
    helmet?: string;
    shield?: string;
  };
  primaryStat: StatKey;
  recommendedStats: string;
  initialPoints: number;     // 클래스별 초기 분배 가능 포인트
  // L1J 원본 참조
  acDefenseDivisor: number;  // AC 방어 다이스 제수 (2/3/5) — calcPcDefense
  magicLevelCap: number;     // 마법 레벨 상한
  // 공격 속도 (기사=1.0 기준)
  baseAtkSpeedDiv: number;   // 기본 공격 속도 제수 (높을수록 느림: 기사 1.0, 요정 1.2, 마법사 1.3)
  atkName: string;           // 기본 공격 이름 (로그 표시용)
}

export const CLASS_CONFIGS: Record<PlayerClass, ClassConfig> = {
  knight: {
    id: 'knight',
    nameKo: '기사',
    nameEn: 'Knight',
    description: '강인한 체력과 강력한 근접 공격. 방패 사용 가능.',
    combatStyle: 'melee',
    baseStats: { str: 16, dex: 12, con: 14, wis: 9, int: 8 },
    allowedWeaponTypes: ['weapon'],
    canUseShield: true,
    startingGear: {
      weapon: 'silver_long_sword',
      armor: 'bone_armor',
      helmet: 'skull_helm',
      shield: 'gollack_shield',
    },
    primaryStat: 'str',
    recommendedStats: 'STR > CON > DEX > WIS',
    initialPoints: 4,
    acDefenseDivisor: 2,
    magicLevelCap: 1,
    baseAtkSpeedDiv: 1.0,
    atkName: '공격',
  },
  elf: {
    id: 'elf',
    nameKo: '요정',
    nameEn: 'Elf',
    description: '민첩한 원거리 공격. 활로 먼 거리에서 사냥.',
    combatStyle: 'ranged_bow',
    baseStats: { str: 11, dex: 12, con: 12, wis: 12, int: 12 },
    allowedWeaponTypes: ['bow'],
    canUseShield: false,
    startingGear: {
      weapon: 'hunter_bow',
      armor: 'bone_armor',
    },
    primaryStat: 'dex',
    recommendedStats: 'DEX > WIS > CON > STR',
    initialPoints: 7,
    acDefenseDivisor: 3,
    magicLevelCap: 6,
    baseAtkSpeedDiv: 1.2,
    atkName: '화살',
  },
  wizard: {
    id: 'wizard',
    nameKo: '마법사',
    nameEn: 'Wizard',
    description: '강력한 마법 공격. 자동 명중, MR로만 방어 가능.',
    combatStyle: 'ranged_magic',
    baseStats: { str: 8, dex: 7, con: 12, wis: 12, int: 12 },
    allowedWeaponTypes: ['staff'],
    canUseShield: false,
    startingGear: {
      weapon: 'crystal_staff',
      armor: 'bone_armor',
    },
    primaryStat: 'int',
    recommendedStats: 'INT > WIS > CON > DEX',
    initialPoints: 16,
    acDefenseDivisor: 5,
    magicLevelCap: 10,
    baseAtkSpeedDiv: 1.3,
    atkName: '에너지 볼트',
  },
};

// ── 유틸 함수 ──

export function getClassBaseStats(pc: PlayerClass) {
  return CLASS_CONFIGS[pc].baseStats;
}

export function getClassCombatStyle(pc: PlayerClass): CombatStyle {
  return CLASS_CONFIGS[pc].combatStyle;
}

/** 캐릭터 생성 시 스탯 상한 (base + 투자 합산) — 기사 STR만 20, 나머지 18 */
export function getStatCap(pc: PlayerClass, stat: StatKey): number {
  if (pc === 'knight' && stat === 'str') return 20;
  return 18;
}

/**
 * 클래스가 해당 장비를 장착할 수 있는지 확인
 *
 * L1J 원본: 개별 아이템의 use_knight/use_elf/use_wizard 플래그가
 * 장착 가능 여부를 결정 (classRestriction).
 * 타입 기반 일괄 제한은 L1J에 없음.
 *
 * @param classRestriction 아이템별 장착 가능 클래스 (없으면 전체 허용)
 */
export function canClassEquip(pc: PlayerClass, _eqType: EquipType, classRestriction?: PlayerClass[]): boolean {
  if (classRestriction && !classRestriction.includes(pc)) return false;
  return true;
}
