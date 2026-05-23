/* =========================================================
   WEAPON SKILL DATA — L1J weapon_skills.csv 기반
   소스: data/weapon_skills.csv (18 entries, 17 weapons)

   무기 특수 스킬: 공격 시 확률적으로 추가 마법 대미지 발동.
   L1J L1WeaponSkill.java + weapon_skills 테이블 원본.

   ⚠️ 발동 확률 = probability + (probEnchant × 인챈트 레벨)
   ⚠️ 대미지 = fixDamage + random(0 ~ randomDamage-1), MR 감소 적용
   ⚠️ fixDamage=0인 무기는 상태이상 전용 (대미지 없음)
   ========================================================= */

// ── 무기 스킬 인터페이스 ──
export interface WeaponSkill {
  skillName: string;         // 스킬 이름 (로그 표시용)
  probability: number;       // 기본 발동 확률 (%)
  probEnchant: number;       // 인챈트 레벨당 추가 확률 (%)
  fixDamage: number;         // 고정 대미지
  randomDamage: number;      // 랜덤 대미지 범위 (0 ~ N-1)
  enableMr: boolean;         // MR 감소 적용 여부
  element: string;           // 속성 (fire/water/wind/earth/lightning/none)
}

// ── 무기 템플릿 ID → 스킬 매핑 ──
// L1J weapon_skills.csv 원본 데이터 1:1 반영
// ⚠️ 임의 수정 금지 — L1J 3.63c 데이터 원본

export const WEAPON_SKILLS: Record<string, WeaponSkill> = {
  // ═══════════════════════════════════════
  // 침묵의 검 (L1J #47) — 사일런스
  // 상태이상 전용 (대미지 없음)
  // ═══════════════════════════════════════
  'w_47': {
    skillName: '사일런스',
    probability: 2,
    probEnchant: 0,
    fixDamage: 0,
    randomDamage: 0,
    enableMr: true,
    element: 'none',
  },

  // ═══════════════════════════════════════
  // 커츠의 검 (L1J #54) — 콜 라이트닝
  // 15%, 35~59 대미지, 번개 속성
  // ═══════════════════════════════════════
  'w_54': {
    skillName: '콜 라이트닝',
    probability: 15,
    probEnchant: 0,
    fixDamage: 35,
    randomDamage: 25,
    enableMr: true,
    element: 'lightning',
  },

  // ═══════════════════════════════════════
  // 데스 나이트의 불검 (L1J #58) — 선 버스트
  // 7%, 75~89 대미지, 화염 속성
  // CSV (w_58) + 수작업 (dk_flame_sword) 둘 다 매핑
  // ═══════════════════════════════════════
  'w_58': {
    skillName: '선 버스트',
    probability: 7,
    probEnchant: 0,
    fixDamage: 75,
    randomDamage: 15,
    enableMr: true,
    element: 'fire',
  },
  'dk_flame_sword': {
    skillName: '선 버스트',
    probability: 7,
    probEnchant: 0,
    fixDamage: 75,
    randomDamage: 15,
    enableMr: true,
    element: 'fire',
  },

  // ═══════════════════════════════════════
  // 얼음 여왕의 지팡이 (L1J #121) — 콘 오브 콜드
  // 25% + 인챈트×2%, 95~149 대미지, 수속성
  // ⚠️ 유일하게 probEnchant > 0 (인챈트 +9 = 43% 발동)
  // ═══════════════════════════════════════
  'w_121': {
    skillName: '콘 오브 콜드',
    probability: 25,
    probEnchant: 2,
    fixDamage: 95,
    randomDamage: 55,
    enableMr: true,
    element: 'water',
  },

  // ═══════════════════════════════════════
  // 발록의 양손 검 (L1J #203) — 미티어
  // 15%, 90~179 대미지, 지속성 — 최대 대미지 범위
  // ═══════════════════════════════════════
  'w_203': {
    skillName: '미티어',
    probability: 15,
    probEnchant: 0,
    fixDamage: 90,
    randomDamage: 90,
    enableMr: true,
    element: 'earth',
  },

  // ═══════════════════════════════════════
  // 달의 장궁 (L1J #205) — 달의 장궁 효과
  // 5%, 8 고정 대미지, 무속성 (활 전용, arrow_type=1)
  // ═══════════════════════════════════════
  'w_205': {
    skillName: '달빛 화살',
    probability: 5,
    probEnchant: 0,
    fixDamage: 8,
    randomDamage: 0,
    enableMr: true,
    element: 'none',
  },

  // ═══════════════════════════════════════
  // 할로윈 무기 3종 (L1J #256~258) — 할로윈 효과
  // 8%, 35~59 대미지, 화염 속성, skill_id=6006
  // ═══════════════════════════════════════
  'w_256': {
    skillName: '할로윈 플레임',
    probability: 8,
    probEnchant: 0,
    fixDamage: 35,
    randomDamage: 25,
    enableMr: true,
    element: 'fire',
  },
  'w_257': {
    skillName: '할로윈 플레임',
    probability: 8,
    probEnchant: 0,
    fixDamage: 35,
    randomDamage: 25,
    enableMr: true,
    element: 'fire',
  },
  'w_258': {
    skillName: '할로윈 플레임',
    probability: 8,
    probEnchant: 0,
    fixDamage: 35,
    randomDamage: 25,
    enableMr: true,
    element: 'fire',
  },

  // ═══════════════════════════════════════
  // 행운의 도끼 (L1J #303) — 할로윈 효과 (동일 스킬)
  // 8%, 35~59 대미지, 화염 속성
  // ═══════════════════════════════════════
  'w_303': {
    skillName: '할로윈 플레임',
    probability: 8,
    probEnchant: 0,
    fixDamage: 35,
    randomDamage: 25,
    enableMr: true,
    element: 'fire',
  },

  // ═══════════════════════════════════════
  // 숨겨진 마족 무기 (L1J #304~306)
  // #304: 소드 — 8%, 35~59, 화염 (skill_id=6006)
  // #305: 보우 — 8%, 윈드 셰클 (대미지 없음, 바람 속성)
  // #306: 스태프 — 8%, 윈드 셰클 (대미지 없음, 바람 속성)
  // ═══════════════════════════════════════
  'w_304': {
    skillName: '마족의 불꽃',
    probability: 8,
    probEnchant: 0,
    fixDamage: 35,
    randomDamage: 25,
    enableMr: true,
    element: 'fire',
  },
  'w_305': {
    skillName: '윈드 셰클',
    probability: 8,
    probEnchant: 0,
    fixDamage: 0,
    randomDamage: 0,
    enableMr: true,
    element: 'wind',
  },
  'w_306': {
    skillName: '윈드 셰클',
    probability: 8,
    probEnchant: 0,
    fixDamage: 0,
    randomDamage: 0,
    enableMr: true,
    element: 'wind',
  },

  // ═══════════════════════════════════════
  // ⚠️ 누락 무기 (게임에 해당 무기 타입 미지원):
  //   L1J #76  론드의 이도류    (dualsword)
  //   L1J #307 숨겨진 마족의 크로우    (claw)
  //   L1J #308 숨겨진 마족의 체인 소드 (chainsword)
  //   L1J #309 숨겨진 마족의 키 링크   (kiringku)
  // → 무기 타입 추가 시 여기에 스킬 매핑 추가
  // ═══════════════════════════════════════
};

/**
 * 무기 템플릿 ID로 스킬 조회
 * 없으면 undefined (스킬 없는 무기)
 */
export function getWeaponSkill(templateId: string): WeaponSkill | undefined {
  return WEAPON_SKILLS[templateId];
}
