/* =========================================================
   MONSTER SKILL DATA — 몬스터 스킬 정의
   L1J mob_skills 기반, 게임 밸런스 조정

   설계 원칙:
   - Lv.1~15 몬스터: 스킬 없음 (초보자 보호)
   - Lv.16~30: 1개 (단순 스킬)
   - Lv.31~50: 1~2개 (조합 가능)
   - 보스급(던전 마지막 방): 2~3개 (복합 AI)

   키: npcId (monsterData.ts의 CSV_MONSTERS 첫번째 컬럼)
   ========================================================= */
import type { MobSkill } from '../types';

/**
 * npcId → 보유 스킬 매핑
 */
export const MONSTER_SKILLS: Record<number, MobSkill[]> = {

  // ══════════════════════════════════════
  // Lv.16~20 — 단순 스킬 1개
  // ══════════════════════════════════════

  // 구울(Lv.16): HP 50% 이하 → 30% 확률 강타
  45157: [{
    type: 'PHYSICAL_ATTACK',
    trigger: { triggerRandom: 30, triggerHp: 50 },
    damageMult: 1.5,
    skillName: '역병의 일격',
    cooldownMs: 9000,
  }],

  // 흑기사(Lv.16): 25% 확률 강타
  45165: [{
    type: 'PHYSICAL_ATTACK',
    trigger: { triggerRandom: 25 },
    damageMult: 1.4,
    skillName: '어둠의 칼날',
    cooldownMs: 12000,
  }],

  // 라이칸 스로프(Lv.17): 20% 확률 마법 공격
  45173: [{
    type: 'MAGIC_ATTACK',
    trigger: { triggerRandom: 20 },
    magicDice: 2, magicDiceSides: 6, magicDamageBonus: 3,
    skillName: '암흑의 저주',
    cooldownMs: 12000,
  }],

  // 도펠 갱어(Lv.19): 30% 확률 강타
  45189: [{
    type: 'PHYSICAL_ATTACK',
    trigger: { triggerRandom: 30 },
    damageMult: 1.5,
    skillName: '분신 공격',
    cooldownMs: 9000,
  }],

  // 산적 부두목(Lv.20): HP 40% 이하 → 동료 소환
  45194: [{
    type: 'SUMMON',
    trigger: { triggerRandom: 50, triggerHp: 40, triggerCount: 1 },
    summonMonsterId: '45197', // 산적
    summonCount: 1,
    skillName: '부하 호출',
  }],

  // ══════════════════════════════════════
  // Lv.21~30 — 단순~복합 스킬
  // ══════════════════════════════════════

  // 오우거(Lv.22): 25% 확률 강타 1.6배
  45215: [{
    type: 'PHYSICAL_ATTACK',
    trigger: { triggerRandom: 25 },
    damageMult: 1.6,
    skillName: '대지 강타',
    cooldownMs: 9000,
  }],

  // 라미아(Lv.24): 마법 공격 (2d6+5)
  45239: [{
    type: 'MAGIC_ATTACK',
    trigger: { triggerRandom: 35 },
    magicDice: 2, magicDiceSides: 6, magicDamageBonus: 5,
    skillName: '독안개',
    cooldownMs: 12000,
  }],

  // 시렌(Lv.28): 마법 공격 (2d8+8)
  45250: [{
    type: 'MAGIC_ATTACK',
    trigger: { triggerRandom: 40 },
    magicDice: 2, magicDiceSides: 8, magicDamageBonus: 8,
    skillName: '환혹의 노래',
    cooldownMs: 9000,
  }],

  // ══════════════════════════════════════
  // Lv.31~50 — 복합 스킬 1~2개
  // ══════════════════════════════════════

  // 그리핀(Lv.33): 강타 + HP 30% 소환
  45810: [
    {
      type: 'PHYSICAL_ATTACK',
      trigger: { triggerRandom: 25 },
      damageMult: 1.8,
      skillName: '급강하',
      cooldownMs: 12000,
    },
    {
      type: 'SUMMON',
      trigger: { triggerRandom: 50, triggerHp: 30, triggerCount: 1 },
      summonMonsterId: '45811',
      summonCount: 1,
      skillName: '구원 요청',
    },
  ],

  // 서큐버스(Lv.35): 마법 공격 + 자기 치유
  45823: [
    {
      type: 'MAGIC_ATTACK',
      trigger: { triggerRandom: 40 },
      magicDice: 3, magicDiceSides: 6, magicDamageBonus: 8,
      skillName: '매혹의 손길',
      cooldownMs: 9000,
    },
    {
      type: 'POLY',
      trigger: { triggerRandom: 25, triggerHp: 40 },
      polyEffect: 'heal',
      polyValue: 40,
      skillName: '생명 흡수',
      cooldownMs: 15000,
    },
  ],

  // 자이언트 웜(Lv.38): 강타 1.8배 + 마법
  45321: [
    {
      type: 'PHYSICAL_ATTACK',
      trigger: { triggerRandom: 30 },
      damageMult: 1.8,
      skillName: '대지진',
      cooldownMs: 9000,
    },
    {
      type: 'MAGIC_ATTACK',
      trigger: { triggerRandom: 25, triggerHp: 60 },
      magicDice: 3, magicDiceSides: 8, magicDamageBonus: 10,
      skillName: '독액 분사',
      cooldownMs: 12000,
    },
  ],

  // ══════════════════════════════════════
  // Lv.50+ — 보스급 복합 AI
  // ══════════════════════════════════════

  // 리치(Lv.52): 마법 + 치유 + 소환
  45601: [
    {
      type: 'MAGIC_ATTACK',
      trigger: { triggerRandom: 50 },
      magicDice: 3, magicDiceSides: 8, magicDamageBonus: 12,
      skillName: '데스 볼트',
      cooldownMs: 9000,
    },
    {
      type: 'POLY',
      trigger: { triggerRandom: 30, triggerHp: 40 },
      polyEffect: 'heal',
      polyValue: 60,
      skillName: '어둠의 치유',
      cooldownMs: 15000,
    },
    {
      type: 'SUMMON',
      trigger: { triggerRandom: 40, triggerHp: 25, triggerCount: 2 },
      summonMonsterId: '45107', // 해골
      summonCount: 1,
      skillName: '망자 소환',
    },
  ],
};

/**
 * npcId로 스킬 목록 조회
 * 없으면 빈 배열 반환 (스킬 없는 몬스터)
 */
export function getMonsterSkills(npcId: number): MobSkill[] {
  return MONSTER_SKILLS[npcId] ?? [];
}
