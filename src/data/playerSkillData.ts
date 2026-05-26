/**
 * playerSkillData.ts
 * 플레이어 스킬/마법 데이터 — L1J 3.63c skills.csv 기반
 *
 * 대상 클래스: Knight(기사), Elf(요정), Wizard(마법사)
 *
 * attr 속성값 (L1J AttrType 비트마스크):
 *   0 = 없음, 1 = 땅(earth), 2 = 불(fire), 4 = 물(water),
 *   8 = 바람(wind), 16 = 빛(light)
 *
 * skillCategory: 'magic' (서클 마법) | 'technique' (기사 전용) | 'spirit' (요정 정령)
 * skillCircle: 마법 서클 1~10 (마법), 0 = 기술/정령
 * diceCount=0 인 힐: 동적 주사위 = getMagicBonus(int) + magicLevel
 */

import { magicLevel } from './statFormulas';
import type { PlayerClass, SkillCategory } from '../types';

// ---------------------------------------------------------------------------
// 인터페이스
// ---------------------------------------------------------------------------

export interface PlayerSkill {
  id: number;                    // L1J skill id
  name: string;                  // 한글 이름
  skillCategory: SkillCategory;  // 마법/기술/정령
  skillCircle: number;           // 마법 서클 (1-10), 0 = 클래스 전용
  consumeMp: number;             // MP 소모량
  reuseDelayMs: number;          // 재사용 대기 (ms, 시간 기반)
  buffDuration: number;          // 버프 지속시간 (초), 0 = 즉발/공격
  skillType: 'attack' | 'heal' | 'buff';
  damageValue: number;           // 고정 대미지
  damageDice: number;            // 주사위 면 수 (예: 10 = d10)
  damageDiceCount: number;       // 주사위 개수 (0 = getMagicBonus+magicLevel 사용)
  attr: number;                  // 속성: 0=없음, 1=땅, 2=불, 4=물, 8=바람, 16=빛
  buffEffect?: {
    acBonus?: number;            // AC 보너스 (음수 = 방어 상승)
    atkSpeedMult?: number;       // 공격 속도 배율
    moveSpeedMult?: number;      // 이동 속도 배율
    hitBonus?: number;           // 명중 보너스
    dmgBonus?: number;           // 추가 대미지
    fireDmgBonus?: number;       // 화염 속성 대미지 추가
  };
  passive?: boolean;              // true = 패시브 (습득 즉시 상시 적용, MP 0)
  consumeItemId?: number;        // 소모 아이템 ID (40318=마력의돌, 40319=정령옥)
  consumeAmount?: number;        // 소모 수량 (기본 0)
  classes: PlayerClass[];        // 습득 가능 클래스
  requiredLevel: number;         // 최소 습득 레벨
  description: string;           // 한글 설명
}

// ---------------------------------------------------------------------------
// 스킬 데이터
// ---------------------------------------------------------------------------

export const PLAYER_SKILLS: PlayerSkill[] = [
  // =========================================================================
  // 공유 마법 — 서클 1~10 (위저드 전용 고서클 포함)
  // 레벨 제한은 requiredLevel=1, 실제 게이팅은 magicLevel 체크로 수행
  // =========================================================================

  // ── 서클 1 ────────────────────────────────────────────────────────────────
  // ⚠️ 에너지 볼트(id:4)는 마법사 기본 공격으로 분리됨 (MP 미소모, classData.atkName)
  // 스킬 슬롯에 장착하는 시전 마법이 아님
  // 공격
  {
    id: 6,
    name: '아이스 대거',
    skillCategory: 'magic',
    skillCircle: 1,
    consumeMp: 4,
    reuseDelayMs: 0, // L1J reuse_delay: 10ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 10,
    damageDice: 10,
    damageDiceCount: 1,
    attr: 4, // 물
    classes: ['wizard', 'elf'],
    requiredLevel: 1,
    description: '얼음 단검을 발사',
  },
  {
    id: 7,
    name: '윈드 커터',
    skillCategory: 'magic',
    skillCircle: 1,
    consumeMp: 4,
    reuseDelayMs: 0,
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 10,
    damageDice: 10,
    damageDiceCount: 1,
    attr: 8, // 바람
    classes: ['wizard', 'elf'],
    requiredLevel: 1,
    description: '바람의 칼날을 발사',
  },
  // 힐
  {
    id: 1,
    name: '힐',
    skillCategory: 'magic',
    skillCircle: 1,
    consumeMp: 4,
    reuseDelayMs: 0, // L1J reuse_delay: 10ms
    buffDuration: 0,
    skillType: 'heal',
    damageValue: 2,
    damageDice: 4,
    damageDiceCount: 0, // 동적: getMagicBonus + magicLevel
    attr: 4, // 물
    classes: ['wizard', 'elf', 'knight'],
    requiredLevel: 1,
    description: '생명력을 회복',
  },
  // 버프
  {
    id: 3,
    name: '실드',
    skillCategory: 'magic',
    skillCircle: 1,
    consumeMp: 0,
    reuseDelayMs: 0,
    buffDuration: 0,
    skillType: 'buff',
    passive: true,
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 0,
    buffEffect: { acBonus: -2 },
    classes: ['wizard', 'elf', 'knight'],
    requiredLevel: 1,
    description: '마법 방패로 AC -2',
  },
  {
    id: 8,
    name: '홀리 웨폰',
    skillCategory: 'magic',
    skillCircle: 1,
    consumeMp: 0,
    reuseDelayMs: 0,
    buffDuration: 0,
    skillType: 'buff',
    passive: true,
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 0,
    buffEffect: { dmgBonus: 1 },
    classes: ['wizard', 'elf', 'knight'],
    requiredLevel: 1,
    description: '무기에 신성한 힘을 부여 (언데드 추가 대미지)',
  },

  // ── 서클 2 ────────────────────────────────────────────────────────────────
  {
    id: 15,
    name: '파이어 애로우',
    skillCategory: 'magic',
    skillCircle: 2,
    consumeMp: 6,
    reuseDelayMs: 0,
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 10,
    damageDice: 10,
    damageDiceCount: 2,
    attr: 2, // 불
    classes: ['wizard', 'elf'],
    requiredLevel: 1,
    description: '화염 화살을 발사',
  },
  {
    id: 16,
    name: '스탈락',
    skillCategory: 'magic',
    skillCircle: 2,
    consumeMp: 6,
    reuseDelayMs: 0,
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 10,
    damageDice: 10,
    damageDiceCount: 2,
    attr: 1, // 땅
    classes: ['wizard', 'elf'],
    requiredLevel: 1,
    description: '암석을 떨어뜨려 공격',
  },
  // 공격
  {
    id: 10,
    name: '칠 터치',
    skillCategory: 'magic',
    skillCircle: 2,
    consumeMp: 8,
    reuseDelayMs: 0, // L1J reuse_delay: 0ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 10,
    damageDice: 10,
    damageDiceCount: 2,
    attr: 4, // 물
    classes: ['wizard', 'elf'],
    requiredLevel: 1,
    description: '냉기의 손길로 공격',
  },
  // 버프
  {
    id: 12,
    name: '인챈트 웨폰',
    skillCategory: 'magic',
    skillCircle: 2,
    consumeMp: 0,
    reuseDelayMs: 0,
    buffDuration: 0,
    skillType: 'buff',
    passive: true,
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 2, // 불
    buffEffect: { dmgBonus: 2 },
    classes: ['wizard'],
    requiredLevel: 1,
    description: '무기를 마법으로 강화 (+2 추가 대미지)',
  },

  // ── 서클 3 ────────────────────────────────────────────────────────────────
  {
    id: 17,
    name: '라이트닝',
    skillCategory: 'magic',
    skillCircle: 3,
    consumeMp: 20,
    reuseDelayMs: 6000, // L1J reuse_delay: 1000ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 0,
    damageDice: 10,
    damageDiceCount: 4,
    attr: 8, // 바람
    classes: ['wizard', 'elf'],
    requiredLevel: 1,
    description: '번개를 내리쳐 공격',
  },
  {
    id: 22,
    name: '프로즌 클라우드',
    skillCategory: 'magic',
    skillCircle: 3,
    consumeMp: 20,
    reuseDelayMs: 3000, // L1J reuse_delay: 300ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 0,
    damageDice: 4,
    damageDiceCount: 8,
    attr: 4, // 물
    classes: ['wizard', 'elf'],
    requiredLevel: 1,
    description: '얼음 구름으로 공격',
  },
  // 버프
  {
    id: 21,
    name: '블레스드 아머',
    skillCategory: 'magic',
    skillCircle: 3,
    consumeMp: 0,
    reuseDelayMs: 0,
    buffDuration: 0,
    skillType: 'buff',
    passive: true,
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 0,
    buffEffect: { acBonus: -3 },
    classes: ['wizard'],
    requiredLevel: 1,
    description: '방어구를 마법으로 강화 (AC -3)',
  },
  // 힐
  {
    id: 19,
    name: '익스트라 힐',
    skillCategory: 'magic',
    skillCircle: 3,
    consumeMp: 15,
    reuseDelayMs: 0, // L1J reuse_delay: 0ms
    buffDuration: 0,
    skillType: 'heal',
    damageValue: 4,
    damageDice: 8,
    damageDiceCount: 0, // 동적
    attr: 4, // 물
    classes: ['wizard', 'elf'],
    requiredLevel: 1,
    description: '향상된 치유 마법',
  },

  // ── 서클 4 ────────────────────────────────────────────────────────────────
  {
    id: 25,
    name: '파이어볼',
    skillCategory: 'magic',
    skillCircle: 4,
    consumeMp: 20,
    reuseDelayMs: 6000, // L1J reuse_delay: 1000ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 0,
    damageDice: 9,
    damageDiceCount: 5,
    attr: 2, // 불
    classes: ['wizard'],
    requiredLevel: 1,
    description: '거대한 화염구를 발사',
  },
  {
    id: 28,
    name: '뱀파이어릭 터치',
    skillCategory: 'magic',
    skillCircle: 4,
    consumeMp: 12,
    reuseDelayMs: 0, // L1J reuse_delay: 100ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 15,
    damageDice: 10,
    damageDiceCount: 3,
    attr: 4, // 물
    classes: ['wizard'],
    requiredLevel: 1,
    description: '생명력을 흡수하는 어둠의 손길',
  },
  {
    id: 30,
    name: '어스 재일',
    skillCategory: 'magic',
    skillCircle: 4,
    consumeMp: 24,
    reuseDelayMs: 3000, // L1J reuse_delay: 400ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 0,
    damageDice: 8,
    damageDiceCount: 5,
    attr: 1, // 땅
    classes: ['wizard'],
    requiredLevel: 1,
    description: '대지의 감옥으로 공격',
  },
  // 버프
  {
    id: 26,
    name: '인챈트 덱스터리티',
    skillCategory: 'magic',
    skillCircle: 4,
    consumeMp: 0,
    reuseDelayMs: 0,
    buffDuration: 0,
    skillType: 'buff',
    passive: true,
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 8, // 바람
    classes: ['wizard'],
    requiredLevel: 1,
    description: '민첩성 증가 버프',
  },

  // ── 서클 5 ────────────────────────────────────────────────────────────────
  {
    id: 34,
    name: '콜 라이트닝',
    skillCategory: 'magic',
    skillCircle: 5,
    consumeMp: 18,
    reuseDelayMs: 3000, // L1J reuse_delay: 400ms (콘 오브 콜드와 동일 서클)
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 40,
    damageDice: 8,
    damageDiceCount: 5,
    attr: 8, // 바람
    classes: ['wizard'],
    requiredLevel: 1,
    description: '강력한 낙뢰를 소환',
  },
  {
    id: 38,
    name: '콘 오브 콜드',
    skillCategory: 'magic',
    skillCircle: 5,
    consumeMp: 18,
    reuseDelayMs: 3000, // L1J reuse_delay: 400ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 40,
    damageDice: 6,
    damageDiceCount: 5,
    attr: 4, // 물
    classes: ['wizard'],
    requiredLevel: 1,
    description: '극한의 냉기를 방사',
  },
  // 힐
  {
    id: 35,
    name: '그레이터 힐',
    skillCategory: 'magic',
    skillCircle: 5,
    consumeMp: 20,
    reuseDelayMs: 0, // L1J reuse_delay: 200ms
    buffDuration: 0,
    skillType: 'heal',
    damageValue: 10,
    damageDice: 8,
    damageDiceCount: 0, // 동적
    attr: 4, // 물
    classes: ['wizard'],
    requiredLevel: 1,
    description: '강력한 치유 마법',
  },

  // ── 서클 6 ────────────────────────────────────────────────────────────────
  {
    id: 45,
    name: '이럽션',
    skillCategory: 'magic',
    skillCircle: 6,
    consumeMp: 20,
    reuseDelayMs: 3000, // L1J reuse_delay: 400ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 50,
    damageDice: 3,
    damageDiceCount: 5,
    attr: 1, // 땅
    classes: ['wizard'],
    requiredLevel: 1,
    description: '지면을 폭발시켜 공격',
  },
  {
    id: 46,
    name: '선 버스트',
    skillCategory: 'magic',
    skillCircle: 6,
    consumeMp: 20,
    reuseDelayMs: 3000, // L1J reuse_delay: 500ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 40,
    damageDice: 5,
    damageDiceCount: 16,
    attr: 2, // 불
    classes: ['wizard'],
    requiredLevel: 1,
    description: '태양의 불꽃으로 공격',
  },
  // 버프
  {
    id: 43,
    name: '헤이스트',
    skillCategory: 'magic',
    skillCircle: 6,
    consumeMp: 0,
    reuseDelayMs: 0,
    buffDuration: 0,
    skillType: 'buff',
    passive: true,
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 8, // 바람
    buffEffect: { atkSpeedMult: 1.33, moveSpeedMult: 1.33 },
    classes: ['wizard', 'elf'],
    requiredLevel: 1,
    description: '공격·이동 속도 33% 증가',
  },
  {
    id: 42,
    name: '인챈트 마이티',
    skillCategory: 'magic',
    skillCircle: 6,
    consumeMp: 0,
    reuseDelayMs: 0,
    buffDuration: 0,
    skillType: 'buff',
    passive: true,
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 2, // 불
    classes: ['wizard'],
    requiredLevel: 1,
    description: '힘 증가 버프',
  },

  // ── 서클 7 ────────────────────────────────────────────────────────────────
  {
    id: 50,
    name: '아이스 랜스',
    skillCategory: 'magic',
    skillCircle: 7,
    consumeMp: 36,
    reuseDelayMs: 6000, // L1J reuse_delay: 1000ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 50,
    damageDice: 5,
    damageDiceCount: 6,
    attr: 4, // 물
    classes: ['wizard'],
    requiredLevel: 1,
    description: '얼음 창을 투척',
  },
  {
    id: 53,
    name: '토네이도',
    skillCategory: 'magic',
    skillCircle: 7,
    consumeMp: 40,
    reuseDelayMs: 6000, // L1J reuse_delay: 1000ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 20,
    damageDice: 10,
    damageDiceCount: 5,
    attr: 8, // 바람
    classes: ['wizard'],
    requiredLevel: 1,
    description: '거대한 회오리바람으로 공격',
  },

  // ── 서클 8 ────────────────────────────────────────────────────────────────
  // 공격
  {
    id: 58,
    name: '파이어월',
    skillCategory: 'magic',
    skillCircle: 8,
    consumeMp: 60,
    reuseDelayMs: 0, // L1J reuse_delay: 0ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 41,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 2, // 불
    classes: ['wizard'],
    requiredLevel: 1,
    description: '화염의 벽으로 공격',
  },
  {
    id: 59,
    name: '블리자드',
    skillCategory: 'magic',
    skillCircle: 8,
    consumeMp: 60,
    reuseDelayMs: 9000, // L1J reuse_delay: 1500ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 3,
    damageDice: 10,
    damageDiceCount: 3,
    attr: 4, // 물
    classes: ['wizard'],
    requiredLevel: 1,
    description: '눈보라를 소환하여 광역 공격',
  },
  {
    id: 62,
    name: '어스 퀘이크',
    skillCategory: 'magic',
    skillCircle: 8,
    consumeMp: 40,
    reuseDelayMs: 3000, // L1J reuse_delay: 500ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 40,
    damageDice: 10,
    damageDiceCount: 6,
    attr: 1, // 땅
    classes: ['wizard'],
    requiredLevel: 1,
    description: '대지진으로 광역 공격',
  },
  // 힐
  {
    id: 57,
    name: '풀 힐',
    skillCategory: 'magic',
    skillCircle: 8,
    consumeMp: 48,
    reuseDelayMs: 3000, // L1J reuse_delay: 500ms → 1 tick
    buffDuration: 0,
    skillType: 'heal',
    damageValue: 12,
    damageDice: 12,
    damageDiceCount: 0, // 동적
    attr: 0,
    classes: ['wizard'],
    requiredLevel: 1,
    description: '최상급 치유 마법',
  },

  // ── 서클 9 ────────────────────────────────────────────────────────────────
  {
    id: 65,
    name: '라이트닝 스톰',
    skillCategory: 'magic',
    skillCircle: 9,
    consumeMp: 48,
    reuseDelayMs: 3000, // L1J reuse_delay: 500ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 35,
    damageDice: 10,
    damageDiceCount: 5,
    attr: 8, // 바람
    classes: ['wizard'],
    requiredLevel: 1,
    description: '폭풍우의 번개를 소환',
  },
  {
    id: 70,
    name: '파이어 스톰',
    skillCategory: 'magic',
    skillCircle: 9,
    consumeMp: 48,
    reuseDelayMs: 3000, // L1J reuse_delay: 400ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 30,
    damageDice: 15,
    damageDiceCount: 8,
    attr: 2, // 불
    classes: ['wizard'],
    requiredLevel: 1,
    description: '화염 폭풍으로 광역 공격',
  },

  // ── 서클 10 ───────────────────────────────────────────────────────────────
  {
    id: 74,
    name: '미티어 스트라이크',
    skillCategory: 'magic',
    skillCircle: 10,
    consumeMp: 60,
    reuseDelayMs: 9000, // L1J reuse_delay: 1500ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 80,
    damageDice: 15,
    damageDiceCount: 10,
    attr: 2, // 불
    classes: ['wizard'],
    requiredLevel: 1,
    description: '유성을 소환해 분쇄',
  },
  {
    id: 77,
    name: '디스인티그레이트',
    skillCategory: 'magic',
    skillCircle: 10,
    consumeMp: 70,
    reuseDelayMs: 15000, // L1J reuse_delay: 5000ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 125,
    damageDice: 18,
    damageDiceCount: 9,
    attr: 16, // 빛
    classes: ['wizard'],
    requiredLevel: 1,
    description: '분자를 분해하는 극대 마법',
  },

  // =========================================================================
  // 엘프 정령 스킬 (클래스 전용, skillCategory='spirit', skillCircle=0)
  // 바람(attr=8) + 무속성(attr=0) 정령만 유지 — 불/땅/물 속성 정령 제거
  // =========================================================================

  {
    id: 129,
    name: '레지스트 매직',
    skillCategory: 'spirit',
    skillCircle: 0,
    consumeMp: 5,
    consumeItemId: 40319, consumeAmount: 1, // 정령옥
    reuseDelayMs: 0, // L1J reuse_delay: 0ms
    buffDuration: 1200, // 20분
    skillType: 'buff',
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 0,
    classes: ['elf'],
    requiredLevel: 8,
    description: '마법 저항력 증가',
  },
  /** 특수 처리: HP를 소모하여 MP로 전환 */
  {
    id: 130,
    name: '바디 투 마인드',
    skillCategory: 'spirit',
    skillCircle: 0,
    consumeMp: 0,
    reuseDelayMs: 3000, // L1J reuse_delay: 400ms
    buffDuration: 0,
    skillType: 'heal',
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 0,
    classes: ['elf'],
    requiredLevel: 12,
    description: 'HP 8을 소모하여 MP로 전환',
  },
  /** 특수 처리: 3회 활 공격 (스펠 대미지가 아닌 물리 공격 3회) */
  {
    id: 132,
    name: '트리플 애로우',
    skillCategory: 'spirit',
    skillCircle: 0,
    consumeMp: 15,
    reuseDelayMs: 3000, // L1J reuse_delay: 400ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 0,
    classes: ['elf'],
    requiredLevel: 24,
    description: '3발의 화살을 동시에 발사 (3회 공격)',
  },
  /** 특수 처리: 디버프 — 몬스터 속성 방어력 감소 */
  {
    id: 133,
    name: '엘리멘탈 폴다운',
    skillCategory: 'spirit',
    skillCircle: 0,
    consumeMp: 10,
    reuseDelayMs: 0, // L1J reuse_delay: 0ms
    buffDuration: 32,
    skillType: 'buff',
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 0,
    classes: ['elf'],
    requiredLevel: 16,
    description: '몬스터의 속성 방어력을 감소',
  },
  {
    id: 137,
    name: '클리어 마인드',
    skillCategory: 'spirit',
    skillCircle: 0,
    consumeMp: 10,
    consumeItemId: 40319, consumeAmount: 1, // 정령옥
    reuseDelayMs: 0, // L1J reuse_delay: 0ms
    buffDuration: 1200, // 20분
    skillType: 'buff',
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 0,
    classes: ['elf'],
    requiredLevel: 24,
    description: '정신 집중력 증가',
  },
  {
    id: 138,
    name: '레지스트 엘리멘트',
    skillCategory: 'spirit',
    skillCircle: 0,
    consumeMp: 10,
    consumeItemId: 40319, consumeAmount: 1, // 정령옥
    reuseDelayMs: 0, // L1J reuse_delay: 0ms
    buffDuration: 1200, // 20분
    skillType: 'buff',
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 0,
    classes: ['elf'],
    requiredLevel: 24,
    description: '속성 저항력 증가',
  },
  {
    id: 147,
    name: '프로텍션 프롬 엘리멘트',
    skillCategory: 'spirit',
    skillCircle: 0,
    consumeMp: 6,
    consumeItemId: 40319, consumeAmount: 1, // 정령옥
    reuseDelayMs: 0, // L1J reuse_delay: 0ms
    buffDuration: 64,
    skillType: 'buff',
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 0,
    classes: ['elf'],
    requiredLevel: 28,
    description: '속성 공격으로부터 보호',
  },
  {
    id: 149,
    name: '윈드 샷',
    skillCategory: 'spirit',
    skillCircle: 0,
    consumeMp: 15,
    reuseDelayMs: 0,
    buffDuration: 1200, // 20분
    skillType: 'buff',
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 8, // 바람
    buffEffect: { atkSpeedMult: 1.25 },
    classes: ['elf'],
    requiredLevel: 32,
    description: '원거리 공격 속도 25% 증가',
  },
  {
    id: 150,
    name: '윈드 워크',
    skillCategory: 'spirit',
    skillCircle: 0,
    consumeMp: 15,
    reuseDelayMs: 0, // L1J reuse_delay: 0ms
    buffDuration: 960, // 16분
    skillType: 'buff',
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 8, // 바람
    buffEffect: { atkSpeedMult: 1.33 },
    classes: ['elf'],
    requiredLevel: 28,
    description: '바람의 힘으로 공격 속도 증가',
  },
  /** 특수 처리: 디버프 — 몬스터 버프 제거 */
  {
    id: 153,
    name: '이레이즈 매직',
    skillCategory: 'spirit',
    skillCircle: 0,
    consumeMp: 18,
    consumeItemId: 40319, consumeAmount: 1, // 정령옥
    reuseDelayMs: 0, // L1J reuse_delay: 0ms
    buffDuration: 32,
    skillType: 'buff',
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 0,
    classes: ['elf'],
    requiredLevel: 32,
    description: '적의 마법 효과를 제거',
  },
  {
    id: 156,
    name: '아이 오브 스톰',
    skillCategory: 'spirit',
    skillCircle: 0,
    consumeMp: 40,
    reuseDelayMs: 0, // L1J reuse_delay: 0ms
    buffDuration: 960, // 16분
    skillType: 'buff',
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 8, // 바람
    classes: ['elf'],
    requiredLevel: 36,
    description: '폭풍의 눈으로 파티원 바람 공격력 증가',
  },
  {
    id: 166,
    name: '스톰 샷',
    skillCategory: 'spirit',
    skillCircle: 0,
    consumeMp: 30,
    reuseDelayMs: 0, // L1J reuse_delay: 0ms
    buffDuration: 960, // 16분
    skillType: 'buff',
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 8, // 바람
    classes: ['elf'],
    requiredLevel: 48,
    description: '폭풍의 힘으로 원거리 공격 강화',
  },
  /** 특수 처리: 디버프 — 몬스터의 이동/공격 속도 감소 (수 틱간 지속) */
  {
    id: 167,
    name: '윈드 셰클',
    skillCategory: 'spirit',
    skillCircle: 0,
    consumeMp: 15,
    consumeItemId: 40319, consumeAmount: 1, // 정령옥
    reuseDelayMs: 21000, // L1J reuse_delay: 20000ms
    buffDuration: 0,
    skillType: 'attack',
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 8, // 바람
    classes: ['elf'],
    requiredLevel: 40,
    description: '바람의 족쇄로 적의 이동/공격 속도 감소',
  },
  {
    id: 174,
    name: '스트라이커 게일',
    skillCategory: 'spirit',
    skillCircle: 0,
    consumeMp: 15,
    consumeItemId: 40319, consumeAmount: 3, // 정령옥 ×3
    reuseDelayMs: 0,
    buffDuration: 1200, // 20분
    skillType: 'buff',
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 8, // 바람
    buffEffect: { hitBonus: 3, dmgBonus: 3 },
    classes: ['elf'],
    requiredLevel: 44,
    description: '명중 +3, 추타 +3 증가',
  },

  // =========================================================================
  // 기사 기술 스킬 (클래스 전용, skillCategory='technique', skillCircle=0)
  // L1J: 기사는 버프(방어/공속/추타)로 싸우는 물리 클래스
  //       Lv.50부터 마법사 1서클 마법 사용 가능 (magicLevel=1)
  // =========================================================================

  {
    id: 87,
    name: '쇼크 스턴',
    skillCategory: 'technique',
    skillCircle: 0,
    consumeMp: 15,
    reuseDelayMs: 9000, // L1J reuse_delay: 1500ms
    buffDuration: 64,
    skillType: 'buff',
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 0,
    buffEffect: { atkSpeedMult: 1.33 },
    classes: ['knight'],
    requiredLevel: 20,
    description: '전투 집중으로 공격 속도 증가 (×1.33)',
  },
  {
    id: 88,
    name: '리덕션 아머',
    skillCategory: 'technique',
    skillCircle: 0,
    consumeMp: 7,
    reuseDelayMs: 12000, // L1J reuse_delay: 3000ms
    buffDuration: 192,
    skillType: 'buff',
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 0,
    buffEffect: { acBonus: -3 },
    classes: ['knight'],
    requiredLevel: 15,
    description: '대미지 경감 방어 (AC -3)',
  },
  {
    id: 89,
    name: '바운스 어택',
    skillCategory: 'technique',
    skillCircle: 0,
    consumeMp: 10,
    reuseDelayMs: 15000, // L1J reuse_delay: 5000ms
    buffDuration: 64,
    skillType: 'buff',
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 0,
    buffEffect: { dmgBonus: 5 },
    classes: ['knight'],
    requiredLevel: 20,
    description: '반격 태세로 추가 대미지 (+5)',
  },
  {
    id: 90,
    name: '솔리드 캐리지',
    skillCategory: 'technique',
    skillCircle: 0,
    consumeMp: 10,
    reuseDelayMs: 12000, // L1J reuse_delay: 3000ms
    buffDuration: 64,
    skillType: 'buff',
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 0,
    buffEffect: { acBonus: -2 },
    classes: ['knight'],
    requiredLevel: 25,
    description: '견고한 자세로 방어력 증가 (AC -2)',
  },
  {
    id: 91,
    name: '카운터 배리어',
    skillCategory: 'technique',
    skillCircle: 0,
    consumeMp: 10,
    reuseDelayMs: 0, // L1J reuse_delay: 0ms
    buffDuration: 64,
    skillType: 'buff',
    damageValue: 0,
    damageDice: 0,
    damageDiceCount: 0,
    attr: 0,
    buffEffect: { acBonus: -1 },
    classes: ['knight'],
    requiredLevel: 30,
    description: '반격 방어막 (AC -1)',
  },
];

// ---------------------------------------------------------------------------
// 헬퍼 함수
// ---------------------------------------------------------------------------

/** 스킬 슬롯 수 — 고정 16칸 (레벨 제한 없음) */
export function getSkillSlotCount(_level: number): number {
  return 16;
}

/** 최대 스킬 슬롯 수 */
export const MAX_SKILL_SLOTS = 16;

/**
 * 특정 클래스가 해당 레벨에서 사용할 수 있는 모든 스킬 반환
 * - requiredLevel 이하인지 확인
 * - 마법 서클 스킬은 magicLevel 이하인지 확인
 */
export function getAvailableSkills(
  playerClass: PlayerClass,
  level: number,
): PlayerSkill[] {
  const mlvl = magicLevel(level, playerClass);
  return PLAYER_SKILLS.filter(skill => {
    if (!skill.classes.includes(playerClass)) return false;
    if (skill.requiredLevel > level) return false;
    // 마법 서클 스킬: 충분한 magicLevel 필요
    if (skill.skillCircle > 0 && skill.skillCircle > mlvl) return false;
    return true;
  });
}

/**
 * 사용 가능한 가장 강력한 공격 마법 반환 (MP 충분한 것 중 최고 서클)
 * ⚠️ equippedIds/disabledIds를 전달하면 장착+활성 스킬만 후보에 포함
 *    → "장착 안 된 최강 스킬" 반환 후 fallback 되는 버그 방지
 */
export function getBestAttackSpell(
  playerClass: PlayerClass,
  level: number,
  currentMp: number,
  cooldowns?: Record<number, number>,
  equippedIds?: number[],
  disabledIds?: number[],
): PlayerSkill | null {
  let available = getAvailableSkills(playerClass, level)
    .filter(s => s.skillType === 'attack' && s.consumeMp <= currentMp && s.skillCircle > 0
      && (cooldowns ? (cooldowns[s.id] ?? 0) <= Date.now() : true));
  if (equippedIds) available = available.filter(s => equippedIds.includes(s.id));
  if (disabledIds) available = available.filter(s => !disabledIds.includes(s.id));
  available.sort((a, b) => b.skillCircle - a.skillCircle); // 높은 서클 우선
  return available[0] ?? null;
}

/**
 * 사용 가능한 가장 강력한 힐 마법 반환
 * ⚠️ equippedIds/disabledIds를 전달하면 장착+활성 스킬만 후보에 포함
 */
export function getBestHealSpell(
  playerClass: PlayerClass,
  level: number,
  currentMp: number,
  equippedIds?: number[],
  disabledIds?: number[],
): PlayerSkill | null {
  let available = getAvailableSkills(playerClass, level)
    .filter(s => s.skillType === 'heal' && s.consumeMp <= currentMp);
  if (equippedIds) available = available.filter(s => equippedIds.includes(s.id));
  if (disabledIds) available = available.filter(s => !disabledIds.includes(s.id));
  available.sort((a, b) => b.skillCircle - a.skillCircle); // 높은 서클 우선
  return available[0] ?? null;
}

/**
 * 현재 활성화되지 않은 버프 스킬 목록 반환
 */
export function getAvailableBuffs(
  playerClass: PlayerClass,
  level: number,
  currentMp: number,
  activeSkillBuffIds: number[],
): PlayerSkill[] {
  return getAvailableSkills(playerClass, level)
    .filter(s =>
      s.skillType === 'buff' &&
      !s.passive &&            // 패시브 제외 (상시 적용)
      s.buffDuration > 0 &&
      s.consumeMp <= currentMp &&
      !activeSkillBuffIds.includes(s.id),
    );
}

/**
 * 패시브 버프 목록 반환 (습득 조건 충족 시 상시 적용)
 */
export function getPassiveBuffs(
  playerClass: PlayerClass,
  level: number,
): PlayerSkill[] {
  return getAvailableSkills(playerClass, level)
    .filter(s => s.passive && s.skillType === 'buff');
}
