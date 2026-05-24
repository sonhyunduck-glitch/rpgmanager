/* =========================================================
   TYPE DEFINITIONS — 모든 게임 타입 중앙 관리
   ========================================================= */

// ── Class ──
export type PlayerClass = 'knight' | 'elf' | 'wizard';
export type CombatStyle = 'melee' | 'ranged_bow' | 'ranged_magic';

// ── Player Stats ──
export type StatKey = 'str' | 'dex' | 'con' | 'wis' | 'int';

/** 각 스탯에 분배한 포인트 (기본 스탯 미포함) */
export interface StatAllocation {
  str: number;
  dex: number;
  con: number;
  wis: number;
  int: number;
}

// ── Equipment ──
export type EquipType = 'weapon' | 'bow' | 'staff' | 'tshirt' | 'helmet' | 'armor' | 'cloak' | 'gloves' | 'boots' | 'shield' | 'necklace' | 'ring' | 'belt' | 'earring';

/** 장비 보너스 스탯 (장착 시 적용) */
export interface EquipBonuses {
  hit?: number;          // 명중 보너스
  extraDmg?: number;     // 추타 보너스
  hp?: number;           // HP 보너스
  mr?: number;           // MR 보너스 (고정값)
  str?: number;          // STR 보너스
  dex?: number;          // DEX 보너스
  con?: number;          // CON 보너스
  wis?: number;          // WIS 보너스
  int?: number;          // INT 보너스
  unbreakable?: boolean; // 비손상 (몬스터에 의한 장비 파괴 면제)
  undeadSlayer?: boolean; // 언데드 추타 (은 재질 등)
  // 클래스 확장
  bowHit?: number;       // 활 명중 보너스
  bowDmg?: number;       // 활 추가 대미지
  sp?: number;           // SP(마법 강화) 보너스
  magicDmg?: number;     // 마법 추가 대미지
  // Phase 1 추가
  mp?: number;           // MP 보너스
  haste?: boolean;       // 헤이스트 (공격속도 증가)
  doubleDmgChance?: number; // 이중 타격 확률 (%, L1J double_dmg_chance)
}

export interface EquipmentTemplate {
  id: string;
  name: string;
  type: EquipType;
  baseAtk: number;          // 소형 타격치
  baseAtkLarge: number;     // 대형 타격치
  baseDef: number;          // AC 감소
  safeEnchant: number;      // 안전 강화 수치 (이 미만 100% 성공 + 파괴 없음, L1J safe_enchant)
  maxEnhance: number;
  sellPrice: number;
  bonuses?: EquipBonuses;
  bonusEffects?: string[];  // UI 표시용 텍스트
  classRestriction?: PlayerClass[];  // 장착 가능 클래스 (없으면 전체)
  minLevel?: number;       // 최소 장착 레벨 (0 또는 미지정 = 제한 없음)
}

export interface Equipment {
  uid: string;
  templateId: string;
  name: string;
  type: EquipType;
  baseAtk: number;          // 소형 타격치
  baseAtkLarge: number;     // 대형 타격치
  baseDef: number;          // AC 감소
  enhanceLevel: number;
  safeEnchant: number;      // 안전 강화 수치 (L1J safe_enchant)
  maxEnhance: number;
  bonuses: EquipBonuses;
  bonusEffects: string[];   // UI 표시용 텍스트
  sellPrice: number;
}

// ── Hunting ──
export interface Material {
  id: string;
  name: string;
  sellPrice: number;
}

export type MonsterSize = 'small' | 'large';
export type MonsterAttackType = 'melee' | 'magic';

// ── 몬스터 스킬 AI (L1J L1MobSkillUse.java 기반) ──
export type MobSkillType = 'PHYSICAL_ATTACK' | 'MAGIC_ATTACK' | 'SUMMON' | 'POLY';

export interface MobSkillTrigger {
  triggerRandom: number;        // 발동 확률 (0~100)
  triggerHp?: number;           // HP% 이하일 때 (0~100)
  triggerCompanionHp?: number;  // 동료 HP% 이하 (0~100)
  triggerRange?: number;        // 거리 조건 (m)
  triggerCount?: number;        // 최대 발동 횟수 (0=무한)
}

export interface MobSkill {
  type: MobSkillType;
  trigger: MobSkillTrigger;
  // PHYSICAL_ATTACK: 특수 물리 공격 (대미지 배율)
  damageMult?: number;          // 1.5 = 150% 대미지
  // MAGIC_ATTACK: 마법 공격
  magicDice?: number;           // 주사위 수
  magicDiceSides?: number;      // 주사위 면수
  magicDamageBonus?: number;    // 고정 추가 대미지
  magicElement?: string;        // 속성 (fire/water/wind/earth)
  // SUMMON: 소환
  summonMonsterId?: string;     // 소환할 몬스터 ID
  summonCount?: number;         // 소환 수
  // POLY: 변신 (자기 강화) — L1J TYPE_POLY(4)
  polyEffect?: string;          // 'haste' | 'shield' | 'heal' | 'ac_boost'
  polyValue?: number;           // 효과 수치
  // 공통
  skillName: string;            // 로그 표시용 이름
  cooldownTicks?: number;       // 쿨다운 (틱 단위, 기본 0)
}

export interface Monster {
  id: string;
  name: string;
  level: number;
  hp: number;
  mp: number;
  ac: number;           // AC (낮을수록 회피 높음, 음수 가능)
  mr: number;           // 마법 저항
  size: MonsterSize;    // 소형/대형 — 무기 데미지 적용 구분
  attackType: MonsterAttackType; // 근거리/마법 — 플레이어 방어 판정 구분
  str: number;          // 근거리 공격력 (소형: lv+5, 대형/전사/골렘: lv+12)
  int: number;          // 마법 공격력 (마법형: min(35, lv+8), 비마법: 2)
  damDice: number;      // N (주사위 개수)
  damDiceSides: number; // S (주사위 면수, 크기 기반: S=5, L=8, 골렘/거인=10)
  extraDam: number;     // B (STR/INT 보너스 기반 추가 대미지)
  undead?: boolean;     // 언데드 속성
  aggressive: boolean;  // 선공 여부 (true: 플레이어에게 접근 후 선제공격)
  moveSpeed: number;    // 이동속도 (1m당 초, 낮을수록 빠름, 0.4~1.0)
  expReward: number;
  goldReward: number;
  skills?: MobSkill[];          // 몬스터 스킬 목록
}

export type ZoneTier = 'beginner' | 'intermediate' | 'advanced';

export interface HuntZone {
  id: string;
  name: string;
  levelRange: [number, number];
  requiredLevel: number;
  tier: ZoneTier;
  monsters: Monster[];
  dropMaterials: { materialId: string; rate: number; minQty: number; maxQty: number }[];
  dropEquipments: { templateId: string; rate: number }[];
  description: string;
  zoneType: 'field' | 'dungeon';
  dungeonSize?: 'small' | 'medium' | 'large';
  floor?: number;
  maxFloor?: number;
  dungeonGroup?: string;
}

export interface JoinedMonster {
  monsterId: string;
  hp: number;
}

export interface ApproachingMonster {
  monsterId: string;
  hp: number;
  distanceRemaining: number;  // 남은 거리 (m) — 매 틱 감소, 0 이하면 도착
}

export interface HuntSession {
  zoneId: string | null;
  status: 'idle' | 'hunting' | 'paused';
  currentRoom: number;       // 1~5: 현재 방 번호
  roomKills: number;         // 현재 방 킬 수
  roomCleared: number;       // 0~5: 클리어한 최고 방 번호
  kills: number;
  goldGained: number;
  materialsGained: Record<string, number>;
  itemsFound: number;
  avgKillTime: number;
  currentFightTicks: number;
  fightStartedAt: number;    // 현재 전투 시작 시각 (Date.now())
  startedAt: number;
  currentTargetId: string | null;
  monsterCurrentHp: number;
  joinedMonsters: JoinedMonster[];
  approachingMonsters: ApproachingMonster[];
  mobSkillCooldowns: Record<string, number>;  // skillKey → 남은 쿨다운 틱
  lastMagicHitAt: number;       // 마법 연속 감쇠 추적 (timestamp)
  consecutiveMagicHits: number; // 연속 마법 피격 횟수
  // MP system
  currentMp: number;           // 현재 MP
  mpRegenPoint: number;        // MP 리젠 포인트 누적 (L1J: 64 도달 시 회복)
  // Skill tracking
  skillCooldowns: Record<number, number>;  // skillId → remaining cooldown ticks
  monsterStunnedTicks: number; // 몬스터 스턴 남은 틱
  windShackleTicks: number;    // 윈드 셰클 남은 틱 (몬스터 공격속도 감소)
}

// ── Queue & Log ──
export interface QueueItem {
  id: string;
  item: Equipment;
  recommendation: 'equip' | 'sell' | 'keep';
  priceIfSold: number;
  statDiff: number;
}

export interface LogEntry {
  id: string;
  type: 'enter' | 'encounter' | 'battle' | 'kill' | 'loot' | 'find' | 'crit' | 'levelup' | 'miss' | 'hit_taken' | 'death' | 'potion' | 'join' | 'approach' | 'skill';
  text: string;
  timestamp: number;
}

// ── Potions ──
export interface Potion {
  id: string;
  name: string;
  healMin: number;
  healMax: number;
  buyPrice: number;
  requiredLevel: number;
  // MP 회복 물약 전용
  // 버프 물약 전용 (buffDuration이 있으면 버프 물약)
  buffDuration?: number;      // 초
  atkSpeedMult?: number;      // 공격속도 배율
  moveSpeedMult?: number;     // 이동속도 배율
}

export interface ActiveBuff {
  potionId: string;
  name: string;
  expiresAt: number;          // Date.now() + duration
  atkSpeedMult: number;
  moveSpeedMult: number;
  // Skill buff effects (from player skills)
  skillId?: number;            // Skill source (for skill buffs, 0 for potion buffs)
  acBonus?: number;            // AC bonus (negative = better defense)
  hitBonus?: number;           // Hit rate bonus
  dmgBonus?: number;           // Damage bonus
  fireDmgBonus?: number;       // Fire element damage added to attacks
}

// ── Crafting ──
export interface Recipe {
  id: string;
  resultTemplateId: string;
  materials: { materialId: string; quantity: number }[];
  goldCost: number;
  requiredLevel: number;
}

// ── Enhance ──
export type ScrollType = 'normal' | 'blessed' | 'cursed';

export interface EnhanceResult {
  success: boolean;
  destroyed: boolean;
  safeFailure?: boolean;     // +9 이상 안전 실패 (아이템 유지, 레벨 변동 없음)
  itemName: string;
  equipType: string;        // 'weapon' | 'armor' etc.
  fromLevel: number;
  toLevel: number;           // -1 = 파괴
  statBefore: number;
  statAfter: number;
  scrollUsed: string;        // 사용한 주문서 이름
  scrollType: ScrollType;
  successRate: number;
}

// ── Chat ──
export interface ChatMessage {
  id: number;
  channel: string;
  userId: string;
  userName: string;
  userLevel: number;
  guildName: string | null;
  text: string;
  createdAt: string;
}

// ── Trade ──
export type TradeListingStatus = 'active' | 'sold' | 'cancelled';

export interface TradeListing {
  id: string;
  seller_id: string;
  seller_name: string;
  seller_level: number;
  item_uid: string;
  item_name: string;
  item_type: string;
  item_data: Equipment;       // 장비 전체 정보
  price: number;
  status: TradeListingStatus;
  buyer_id: string | null;
  buyer_name: string | null;
  created_at: string;
  completed_at: string | null;
}

// ── UI State ──
export type ViewMode = 'main' | 'inventory' | 'zones' | 'craft' | 'shop' | 'trade' | 'skills';
export type ShopTab = 'potion' | 'weapon' | 'armor' | 'accessory' | 'scroll' | 'consumable';
export type ForgeTab = 'enhance' | 'craft';
