/* =========================================================
   TYPE DEFINITIONS — 모든 게임 타입 중앙 관리
   ========================================================= */

// ── Player Stats ──
export type StatKey = 'str' | 'dex' | 'con' | 'wis';

/** 각 스탯에 분배한 포인트 (기본 스탯 미포함) */
export interface StatAllocation {
  str: number;
  dex: number;
  con: number;
  wis: number;
}

// ── Equipment ──
export type EquipType = 'weapon' | 'tshirt' | 'helmet' | 'armor' | 'cloak' | 'gloves' | 'boots' | 'shield' | 'necklace' | 'ring' | 'belt';

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
  unbreakable?: boolean; // 비손상 (몬스터에 의한 장비 파괴 면제)
  undeadSlayer?: boolean; // 언데드 추타 (은 재질 등)
}

export interface EquipmentTemplate {
  id: string;
  name: string;
  type: EquipType;
  baseAtk: number;          // 소형 타격치
  baseAtkLarge: number;     // 대형 타격치
  baseDef: number;          // AC 감소
  maxEnhance: number;
  sellPrice: number;
  bonuses?: EquipBonuses;
  bonusEffects?: string[];  // UI 표시용 텍스트
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
  type: 'enter' | 'encounter' | 'battle' | 'kill' | 'loot' | 'find' | 'crit' | 'levelup' | 'miss' | 'hit_taken' | 'death' | 'potion' | 'join' | 'approach';
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
export type ViewMode = 'main' | 'inventory' | 'zones' | 'craft' | 'shop' | 'trade';
export type ShopTab = 'potion' | 'weapon' | 'armor' | 'accessory' | 'scroll';
export type ForgeTab = 'enhance' | 'craft';
