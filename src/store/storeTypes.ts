/* =========================================================
   STORE TYPES — GameState 인터페이스 + 상수
   ========================================================= */
import type {
  Equipment, QueueItem, LogEntry, HuntSession,
  EnhanceResult, ViewMode, ForgeTab, ScrollType,
  StatAllocation, StatKey, ActiveBuff, PlayerClass,
} from '../types';
import type { OfflineReward } from '../lib/db';

// ── 획득 배율 (테스트) ──
export const RATE_GOLD = 10.0;
export const RATE_EXP  = 3.0;
export const RATE_DROP = 5.0;

// ── 방(Room) 진행 ──
export const ROOM_KILL_REQ = 5;
export const ROOMS_PER_ZONE = 5;
export const DUNGEON_SCROLL_DROP = 0.05;
export const DUNGEON_SCROLL_MAX = 3;

// ── 장비 슬롯 키 ──
export const ALL_EQUIP_SLOT_KEYS = [
  'equippedWeapon', 'equippedTshirt', 'equippedArmor', 'equippedHelmet', 'equippedCloak',
  'equippedGloves', 'equippedBoots', 'equippedShield', 'equippedNecklace', 'equippedRing',
  'equippedRing2', 'equippedBelt', 'equippedEarring',
] as const;

export type EquipSlotKey = typeof ALL_EQUIP_SLOT_KEYS[number];

/** 장비 타입 → 슬롯 키 매핑 */
export const EQUIP_TYPE_TO_SLOT: Record<string, EquipSlotKey> = {
  weapon: 'equippedWeapon', bow: 'equippedWeapon', staff: 'equippedWeapon',
  tshirt: 'equippedTshirt', armor: 'equippedArmor',
  helmet: 'equippedHelmet', cloak: 'equippedCloak', gloves: 'equippedGloves',
  boots: 'equippedBoots', shield: 'equippedShield', necklace: 'equippedNecklace',
  ring: 'equippedRing', belt: 'equippedBelt', earring: 'equippedEarring',
};

// ── Zustand set/get 타입 ──
export type SetState = {
  (partial: Partial<GameState> | ((state: GameState) => Partial<GameState>)): void;
};
export type GetState = () => GameState;

/** 모든 장착 장비를 배열로 반환 */
export function getAllEquipped(s: GameState): (Equipment | null)[] {
  return [
    s.equippedWeapon, s.equippedTshirt, s.equippedArmor, s.equippedHelmet,
    s.equippedCloak, s.equippedGloves, s.equippedBoots, s.equippedShield,
    s.equippedNecklace, s.equippedRing, s.equippedRing2, s.equippedBelt,
    s.equippedEarring,
  ];
}

// ── GameState Interface ──

export interface GameState {
  // Auth
  authUserId: string | null;
  initFromDB: (userId: string) => Promise<void>;
  logout: () => Promise<void>;

  // Player
  playerClass: PlayerClass;
  playerName: string;
  level: number;
  exp: number;
  gold: number;
  title: string;

  // Stats (5-스탯 시스템)
  statAllocation: StatAllocation;
  maxHp: number;
  currentHp: number;
  maxMp: number;
  currentMp: number;

  // Equipment (13 슬롯)
  equippedWeapon: Equipment | null;
  equippedTshirt: Equipment | null;
  equippedArmor: Equipment | null;
  equippedHelmet: Equipment | null;
  equippedCloak: Equipment | null;
  equippedGloves: Equipment | null;
  equippedBoots: Equipment | null;
  equippedShield: Equipment | null;
  equippedNecklace: Equipment | null;
  equippedRing: Equipment | null;
  equippedRing2: Equipment | null;
  equippedBelt: Equipment | null;
  equippedEarring: Equipment | null;

  // Inventory
  inventory: Equipment[];
  inventoryCapacity: number;
  materials: Record<string, number>;

  // Hunt
  hunt: HuntSession;
  combatLog: LogEntry[];
  zonePlayerCount: number;   // 현재 존 접속자 수 (리젠 수 조절용)

  // Potions
  potions: Record<string, number>;
  selectedPotionId: string;
  potionAutoUse: boolean;
  potionAutoThreshold: number;
  lastPotionUsedAt: number;    // 물약 쿨타임 (timestamp)
  potionAutoBuy: boolean;

  // Skills
  equippedSkills: number[];  // 슬롯에 장착된 스킬 ID 목록 (최대 8)

  // Buffs
  activeBuffs: ActiveBuff[];
  greenPotionEnabled: boolean;
  couragePotionEnabled: boolean;
  transformScrollEnabled: boolean;
  transformScrollType: 'normal' | 'event';

  // Queue
  queue: QueueItem[];
  queueCapacity: number;

  // Movement
  isPlayerMoving: boolean;

  // UI State
  viewMode: ViewMode;
  forgeTab: ForgeTab;
  enhanceResult: EnhanceResult | null;
  enhanceTargetUid: string | null;
  enhanceAnim: { uid: string; fromLevel: number; toLevel: number; destroyed?: boolean; scrollType?: ScrollType } | null;
  viewingProfileId: string | null;
  offlineReward: OfflineReward | null;

  // ── Derived Stat Getters ──
  getStr: () => number;
  getDex: () => number;
  getCon: () => number;
  getWis: () => number;
  getInt: () => number;
  getSp: () => number;
  getRemainingPoints: () => number;
  getTotalDefense: () => number;
  getSetBonusHp: () => number;
  getSetBonusMr: () => number;
  getSetBonusHit: () => number;
  getSetBonusDmg: () => number;
  getSetBonusBowHit: () => number;
  getSetBonusBowDmg: () => number;
  getTotalHpBonus: () => number;
  getAtkSpeedMult: () => number;
  getMoveSpeedMult: () => number;
  getMaxMp: () => number;

  // ── Actions ──
  setViewMode: (mode: ViewMode) => void;
  setForgeTab: (tab: ForgeTab) => void;
  allocateStat: (stat: StatKey) => void;
  moveToRoom: (room: number) => void;
  startHunt: (zoneId: string) => void;
  moveToNextFloor: (useScroll: boolean) => void;
  pauseHunt: () => void;
  resumeHunt: () => void;
  startApproach: (monsterId: string, distanceM: number) => boolean;
  revive: () => void;
  tickHunt: () => void;
  processQueueItem: (id: string, action: 'equip' | 'sell' | 'keep') => void;
  bulkSellLow: () => void;
  tryEnhance: (uid: string, scrollType: ScrollType) => void;
  closeEnhanceResult: () => void;
  setEnhanceTarget: (uid: string | null) => void;
  clearEnhanceAnim: () => void;
  enhanceScrollType: ScrollType;
  tryCraft: (recipeId: string) => void;
  sellFromInventory: (uid: string) => void;
  equipFromInventory: (uid: string) => void;
  unequipToInventory: (uid: string) => void;
  setPlayerMoving: (moving: boolean) => void;

  // Shop actions
  buyPotion: (id: string, qty: number) => void;
  buyEquipFromShop: (templateId: string) => void;
  buyMaterial: (materialId: string, qty: number, unitPrice: number) => void;
  setMaterials: (m: Record<string, number>) => void;
  setSelectedPotion: (id: string) => void;
  togglePotionAutoUse: () => void;
  setPotionAutoThreshold: (pct: number) => void;
  togglePotionAutoBuy: () => void;
  toggleGreenPotion: () => void;
  toggleCouragePotion: () => void;
  toggleTransformScroll: () => void;
  setTransformScrollType: (type: 'normal' | 'event') => void;

  // Skill actions
  equipSkill: (skillId: number, slotIndex: number) => void;
  unequipSkill: (slotIndex: number) => void;
  autoEquipSkills: () => void;

  // Profile
  openProfile: (userId: string) => void;
  closeProfile: () => void;

  // Offline reward
  claimOfflineReward: () => void;
  dismissOfflineReward: () => void;
}
