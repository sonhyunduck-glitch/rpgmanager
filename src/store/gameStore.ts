/* =========================================================
   GAME STORE — Zustand
   4-스탯 시스템 (STR, DEX, CON, WIS) 기반
   ========================================================= */
import { create } from 'zustand';
import {
  MATERIALS, HUNT_ZONES, RECIPES,
  getScrollId, getEnhanceRate, isEnhanceSafe,
  xpForLevel, getMonstersForRoom,
  POTIONS, POTION_ORDER, EQUIPMENT_TEMPLATES,
  getLevelSpeedMult, getActiveSets,
} from '../data/gameData';
import { getMonsterDrops } from '../data/monsterData';
import {
  BASE_STATS,
  meleeHit, rollHit, rollDamage,
  rollHpGain, startingHp,
  totalStatPoints,
  finalAC, acToEvasion, finalMR,
  calcHitRate, rollMonsterDamage, applyMagicReduction, magicReduction,
  deathExpLossRate,
} from '../data/statFormulas';
import type {
  Equipment, QueueItem, LogEntry, HuntSession,
  EnhanceResult, ViewMode, ForgeTab, ScrollType,
  StatAllocation, StatKey, ActiveBuff,
} from '../types';
import {
  genLogId, createEquipment, equipStat,
  loadState, saveState as _saveState,
} from './helpers';
import {
  setSyncUserId, setStateGetter, markDirty,
  syncProfile, syncAllItems, syncMaterials, syncPotions,
  loadFromDB, flushNow,
} from '../lib/dbSync';
import { calcOfflineReward } from '../lib/db';
import { safeNumber } from '../lib/utils';

/** localStorage 저장 + DB 동기화 플래그 */
function saveState(state: Parameters<typeof _saveState>[0]) {
  _saveState(state);
  markDirty();
}

// ── 획득 배율 (1.0 = 기본, 2.0 = 2배) ──
const RATE_GOLD = 1.0;        // 골드 획득 배율
const RATE_EXP  = 1.0;        // 경험치 획득 배율
const RATE_DROP = 1.0;        // 아이템 드롭률 배율

// ── 방(Room) 진행 ──
const ROOM_KILL_REQ = 5;             // 방 클리어에 필요한 킬 수
const ROOMS_PER_ZONE = 5;            // 존/층당 방 수
const DUNGEON_SCROLL_DROP = 0.05;    // 이동주문서 드롭률 (5%)
const DUNGEON_SCROLL_MAX = 3;        // 층별 최대 보유 수

// ── GameState Interface ──

export interface GameState {
  // Auth
  authUserId: string | null;
  initFromDB: (userId: string) => Promise<void>;
  logout: () => Promise<void>;

  // Player
  playerName: string;
  level: number;
  exp: number;
  gold: number;
  title: string;

  // Stats (4-스탯 시스템)
  statAllocation: StatAllocation;   // 분배한 포인트 (기본 스탯 미포함)
  maxHp: number;                    // 누적 HP (레벨업마다 CON 기반 증가)
  currentHp: number;                // 현재 HP

  // Equipment (12 슬롯)
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

  // Inventory
  inventory: Equipment[];
  inventoryCapacity: number;
  materials: Record<string, number>;

  // Hunt
  hunt: HuntSession;
  combatLog: LogEntry[];

  // Potions
  potions: Record<string, number>;
  selectedPotionId: string;
  potionAutoUse: boolean;
  potionAutoThreshold: number;   // 0~100 (HP % 이하이면 사용)
  potionAutoBuy: boolean;

  // Buffs
  activeBuffs: ActiveBuff[];
  greenPotionEnabled: boolean;
  couragePotionEnabled: boolean;

  // Queue
  queue: QueueItem[];
  queueCapacity: number;

  // Movement
  isPlayerMoving: boolean;   // 미니맵 좌표 기반 이동 중 여부 (true: 전투 스킵)

  // UI State
  viewMode: ViewMode;
  forgeTab: ForgeTab;
  enhanceResult: EnhanceResult | null;
  enhanceTargetUid: string | null;
  enhanceAnim: { uid: string; fromLevel: number; toLevel: number; destroyed?: boolean; scrollType?: ScrollType } | null;
  viewingProfileId: string | null;  // 프로필 모달 대상 유저 ID
  offlineReward: import('../lib/db').OfflineReward | null;  // 오프라인 보상 모달

  // ── Derived Stat Getters ──
  /** 실제 STR = 기본값 + 분배 포인트 */
  getStr: () => number;
  getDex: () => number;
  getCon: () => number;
  getWis: () => number;
  /** 남은 분배 가능 포인트 */
  getRemainingPoints: () => number;
  /** 전체 방어 슬롯 합산 AC 감소량 (세트 보너스 포함) */
  getTotalDefense: () => number;
  /** 세트 효과 HP 보너스 합산 */
  getSetBonusHp: () => number;
  /** 장비+세트 HP 보너스 합산 (UI 표시용) */
  getTotalHpBonus: () => number;
  /** 현재 공격속도 배율 (버프 포함) */
  getAtkSpeedMult: () => number;
  /** 현재 이동속도 배율 (버프 포함) */
  getMoveSpeedMult: () => number;

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

  // Movement
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

  // Profile
  openProfile: (userId: string) => void;
  closeProfile: () => void;

  // Offline reward
  claimOfflineReward: () => void;
  dismissOfflineReward: () => void;
}

// ── Initial State ──
const saved = loadState();

const initialStatAllocation: StatAllocation = (saved?.statAllocation as StatAllocation) ?? {
  str: 0, dex: 0, con: 0, wis: 0,
};
const initialCon = BASE_STATS.con + initialStatAllocation.con;
const initialMaxHp = (saved?.maxHp as number) ?? startingHp(initialCon);
const initialCurrentHp = (saved?.currentHp as number) ?? initialMaxHp;

export const useGameStore = create<GameState>((set, get) => ({
  // Auth
  authUserId: null,

  initFromDB: async (userId: string) => {
    setSyncUserId(userId);
    setStateGetter(() => get() as unknown as Record<string, unknown>);

    const dbData = await loadFromDB();
    if (dbData && dbData.profile) {
      const p = dbData.profile as Record<string, any>;

      // DB에 아이템이 있으면 DB 기준으로 장착/인벤 복원
      const dbItems = dbData.items as any[];
      const equipped: Record<string, Equipment | null> = {};
      const inv: Equipment[] = [];

      for (const row of dbItems) {
        const eq: Equipment = {
          uid: row.uid,
          templateId: row.template_id,
          name: row.name,
          type: row.type,
          baseAtk: row.base_atk,
          baseAtkLarge: row.base_atk_large,
          baseDef: row.base_def,
          enhanceLevel: row.enhance_level,
          maxEnhance: row.max_enhance,
          bonuses: row.bonuses ?? {},
          bonusEffects: row.bonus_effects ?? [],
          sellPrice: row.sell_price,
        };
        if (row.equipped && row.equipped_slot) {
          equipped[row.equipped_slot] = eq;
        } else {
          inv.push(eq);
        }
      }

      const hasDBItems = dbItems.length > 0;

      set({
        authUserId: userId,
        playerName: p.name ?? get().playerName,
        level: p.level ?? get().level,
        exp: safeNumber(p.exp, get().exp),
        gold: safeNumber(p.gold, get().gold),
        title: p.title ?? get().title,
        currentHp: p.current_hp ?? get().currentHp,
        maxHp: p.max_hp ?? get().maxHp,
        statAllocation: {
          str: p.stat_str ?? 0,
          dex: p.stat_dex ?? 0,
          con: p.stat_con ?? 0,
          wis: p.stat_wis ?? 0,
        },
        ...(hasDBItems ? {
          equippedWeapon: equipped['weapon'] ?? null,
          equippedTshirt: equipped['tshirt'] ?? null,
          equippedArmor: equipped['armor'] ?? null,
          equippedHelmet: equipped['helmet'] ?? null,
          equippedCloak: equipped['cloak'] ?? null,
          equippedGloves: equipped['gloves'] ?? null,
          equippedBoots: equipped['boots'] ?? null,
          equippedShield: equipped['shield'] ?? null,
          equippedNecklace: equipped['necklace'] ?? null,
          equippedRing: equipped['ring'] ?? null,
          equippedRing2: equipped['ring2'] ?? null,
          equippedBelt: equipped['belt'] ?? null,
          inventory: inv,
        } : {}),
        materials: Object.keys(dbData.materials).length > 0 ? dbData.materials : get().materials,
        potions: Object.keys(dbData.potions).length > 0 ? dbData.potions : get().potions,
        selectedPotionId: p.selected_potion ?? get().selectedPotionId,
        potionAutoUse: p.potion_auto_use ?? get().potionAutoUse,
        potionAutoThreshold: p.potion_auto_threshold ?? get().potionAutoThreshold,
        potionAutoBuy: p.potion_auto_buy ?? get().potionAutoBuy,
      });

      // DB에 아이템이 없으면 localStorage 데이터를 DB에 마이그레이션
      if (!hasDBItems) {
        const s = get();
        syncAllItems(s.inventory, {
          equippedWeapon: s.equippedWeapon, equippedTshirt: s.equippedTshirt,
          equippedArmor: s.equippedArmor, equippedHelmet: s.equippedHelmet,
          equippedCloak: s.equippedCloak, equippedGloves: s.equippedGloves,
          equippedBoots: s.equippedBoots, equippedShield: s.equippedShield,
          equippedNecklace: s.equippedNecklace, equippedRing: s.equippedRing,
          equippedRing2: s.equippedRing2, equippedBelt: s.equippedBelt,
        });
        syncMaterials(s.materials);
        syncPotions(s.potions);
        syncProfile(s as any);
      }
    } else {
      // DB에 프로필 없음 → localStorage 데이터로 프로필+아이템 생성
      set({ authUserId: userId });
      const s = get();
      syncProfile(s as any);
      syncAllItems(s.inventory, {
        equippedWeapon: s.equippedWeapon, equippedTshirt: s.equippedTshirt,
        equippedArmor: s.equippedArmor, equippedHelmet: s.equippedHelmet,
        equippedCloak: s.equippedCloak, equippedGloves: s.equippedGloves,
        equippedBoots: s.equippedBoots, equippedShield: s.equippedShield,
        equippedNecklace: s.equippedNecklace, equippedRing: s.equippedRing,
        equippedRing2: s.equippedRing2, equippedBelt: s.equippedBelt,
      });
      syncMaterials(s.materials);
      syncPotions(s.potions);
    }

    // 오프라인 보상 계산
    if (dbData?.profile) {
      const p = dbData.profile as Record<string, any>;
      const lastZoneId = p.last_zone_id as string | null;
      const lastActiveAt = p.last_active_at as string;
      const zone = lastZoneId ? HUNT_ZONES.find(z => z.id === lastZoneId) : null;
      const reward = calcOfflineReward(
        lastActiveAt,
        lastZoneId,
        zone ? {
          name: zone.name,
          monsters: zone.monsters,
          dropMaterials: zone.dropMaterials,
        } : null,
      );
      if (reward) set({ offlineReward: reward });
    }

    saveState(get());
  },

  logout: async () => {
    await flushNow();
    setSyncUserId(null);
    set({ authUserId: null });
  },

  // Player
  playerName: (saved?.playerName as string) ?? '초보 모험가',
  level: (saved?.level as number) ?? 1,
  exp: (saved?.exp as number) ?? 0,
  gold: (saved?.gold as number) ?? 100,
  title: (saved?.title as string) ?? '뉴비',

  // Stats
  statAllocation: initialStatAllocation,
  maxHp: initialMaxHp,
  currentHp: initialCurrentHp,

  // Equipment
  equippedWeapon: (saved?.equippedWeapon as Equipment) ?? createEquipment('silver_long_sword'),
  equippedTshirt: (saved?.equippedTshirt as Equipment) ?? createEquipment('tshirt'),
  equippedArmor: (saved?.equippedArmor as Equipment) ?? createEquipment('bone_armor'),
  equippedHelmet: (saved?.equippedHelmet as Equipment) ?? createEquipment('skull_helm'),
  equippedCloak: (saved?.equippedCloak as Equipment) ?? null,
  equippedGloves: (saved?.equippedGloves as Equipment) ?? null,
  equippedBoots: (saved?.equippedBoots as Equipment) ?? null,
  equippedShield: (saved?.equippedShield as Equipment) ?? createEquipment('gollack_shield'),
  equippedNecklace: (saved?.equippedNecklace as Equipment) ?? null,
  equippedRing: (saved?.equippedRing as Equipment) ?? null,
  equippedRing2: (saved?.equippedRing2 as Equipment) ?? null,
  equippedBelt: (saved?.equippedBelt as Equipment) ?? null,

  // Inventory
  inventory: (saved?.inventory as Equipment[]) ?? [],
  inventoryCapacity: 100,
  materials: (saved?.materials as Record<string, number>) ?? {},

  // Hunt (마이그레이션: 구버전 huntTier → currentRoom)
  hunt: (() => {
    const h = saved?.hunt as any;
    if (!h) return {
      zoneId: null,
      status: 'idle',
      currentRoom: 1,
      roomKills: 0,
      roomCleared: 0,
      kills: 0,
      goldGained: 0,
      materialsGained: {},
      itemsFound: 0,
      avgKillTime: 0,
      currentFightTicks: 0,
      fightStartedAt: 0,
      startedAt: 0,
      currentTargetId: null,
      monsterCurrentHp: 0,
      joinedMonsters: [],
      approachingMonsters: [],
    } as HuntSession;
    return {
      ...h,
      currentRoom: h.currentRoom ?? 1,
      roomKills: h.roomKills ?? 0,
      roomCleared: h.roomCleared ?? 0,
    } as HuntSession;
  })(),
  combatLog: [],

  // Queue
  queue: (saved?.queue as QueueItem[]) ?? [],
  queueCapacity: (saved?.queueCapacity as number) ?? 6,

  // Potions
  potions: (saved?.potions as Record<string, number>) ?? { red_potion: 300, green_potion: 50 },
  selectedPotionId: (saved?.selectedPotionId as string) ?? 'red_potion',
  potionAutoUse: (saved?.potionAutoUse as boolean) ?? true,
  potionAutoThreshold: (saved?.potionAutoThreshold as number) ?? 50,
  potionAutoBuy: (saved?.potionAutoBuy as boolean) ?? true,

  // Buffs
  activeBuffs: (saved?.activeBuffs as ActiveBuff[]) ?? [],
  greenPotionEnabled: (saved?.greenPotionEnabled as boolean) ?? true,
  couragePotionEnabled: (saved?.couragePotionEnabled as boolean) ?? true,

  // Movement
  isPlayerMoving: false,

  // UI
  viewMode: 'main',
  forgeTab: 'enhance',
  enhanceResult: null,
  enhanceTargetUid: null,
  enhanceAnim: null,
  enhanceScrollType: 'normal' as ScrollType,
  viewingProfileId: null,
  offlineReward: null,

  // ── Derived Stat Getters ──

  getStr: () => {
    const s = get();
    const allEq = [s.equippedWeapon, s.equippedTshirt, s.equippedArmor, s.equippedHelmet, s.equippedCloak,
      s.equippedGloves, s.equippedBoots, s.equippedShield, s.equippedNecklace, s.equippedRing, s.equippedRing2, s.equippedBelt];
    const bonus = allEq.reduce((sum, eq) => sum + (eq?.bonuses?.str ?? 0), 0);
    return BASE_STATS.str + s.statAllocation.str + bonus;
  },
  getDex: () => {
    const s = get();
    const allEq = [s.equippedWeapon, s.equippedTshirt, s.equippedArmor, s.equippedHelmet, s.equippedCloak,
      s.equippedGloves, s.equippedBoots, s.equippedShield, s.equippedNecklace, s.equippedRing, s.equippedRing2, s.equippedBelt];
    const bonus = allEq.reduce((sum, eq) => sum + (eq?.bonuses?.dex ?? 0), 0);
    return BASE_STATS.dex + s.statAllocation.dex + bonus;
  },
  getCon: () => {
    const s = get();
    const allEq = [s.equippedWeapon, s.equippedTshirt, s.equippedArmor, s.equippedHelmet, s.equippedCloak,
      s.equippedGloves, s.equippedBoots, s.equippedShield, s.equippedNecklace, s.equippedRing, s.equippedRing2, s.equippedBelt];
    const bonus = allEq.reduce((sum, eq) => sum + (eq?.bonuses?.con ?? 0), 0);
    return BASE_STATS.con + s.statAllocation.con + bonus;
  },
  getWis: () => {
    const s = get();
    const allEq = [s.equippedWeapon, s.equippedTshirt, s.equippedArmor, s.equippedHelmet, s.equippedCloak,
      s.equippedGloves, s.equippedBoots, s.equippedShield, s.equippedNecklace, s.equippedRing, s.equippedRing2, s.equippedBelt];
    const bonus = allEq.reduce((sum, eq) => sum + (eq?.bonuses?.wis ?? 0), 0);
    return BASE_STATS.wis + s.statAllocation.wis + bonus;
  },
  getRemainingPoints: () => {
    const { level, statAllocation } = get();
    const total = totalStatPoints(level);
    const used = statAllocation.str + statAllocation.dex + statAllocation.con + statAllocation.wis;
    return total - used;
  },

  getTotalDefense: () => {
    const s = get();
    const slots = [s.equippedTshirt, s.equippedArmor, s.equippedHelmet, s.equippedCloak, s.equippedGloves,
      s.equippedBoots, s.equippedShield, s.equippedNecklace, s.equippedRing, s.equippedRing2, s.equippedBelt];
    const baseDef = slots.reduce((total, eq) => eq ? total + equipStat(eq) : total, 0);
    // 세트 보너스 AC
    const allEquipped = [s.equippedWeapon, ...slots].filter((e): e is Equipment => e !== null);
    const templateIds = allEquipped.map(e => e.templateId);
    const setAcBonus = getActiveSets(templateIds).reduce((sum, set) => sum + (set.bonuses.ac ?? 0), 0);
    return baseDef + setAcBonus;
  },

  getSetBonusHp: () => {
    const s = get();
    const allEquipped = [s.equippedWeapon, s.equippedTshirt, s.equippedArmor, s.equippedHelmet,
      s.equippedCloak, s.equippedGloves, s.equippedBoots, s.equippedShield,
      s.equippedNecklace, s.equippedRing, s.equippedRing2, s.equippedBelt]
      .filter((e): e is Equipment => e !== null);
    const templateIds = allEquipped.map(e => e.templateId);
    return getActiveSets(templateIds).reduce((sum, set) => sum + (set.bonuses.hp ?? 0), 0);
  },

  getTotalHpBonus: () => {
    const s = get();
    const allEquipSlots = [s.equippedWeapon, s.equippedTshirt, s.equippedArmor, s.equippedHelmet,
      s.equippedCloak, s.equippedGloves, s.equippedBoots, s.equippedShield,
      s.equippedNecklace, s.equippedRing, s.equippedRing2, s.equippedBelt];
    const equipBonusHp = allEquipSlots.reduce((sum, eq) => sum + (eq?.bonuses?.hp ?? 0), 0);
    return equipBonusHp + s.getSetBonusHp();
  },

  getAtkSpeedMult: () => {
    const { level, activeBuffs } = get();
    const now = Date.now();
    // 곱연산: levelSpeed × haste × courage × ...
    const levelMult = getLevelSpeedMult(level);
    const buffMult = activeBuffs
      .filter(b => b.expiresAt > now)
      .reduce((mult, b) => mult * b.atkSpeedMult, 1);
    return levelMult * buffMult;
  },

  getMoveSpeedMult: () => {
    const now = Date.now();
    return get().activeBuffs
      .filter(b => b.expiresAt > now)
      .reduce((max, b) => Math.max(max, b.moveSpeedMult), 1);
  },

  // ── Actions ──

  setViewMode: (mode) => set({ viewMode: mode }),
  setForgeTab: (tab) => set({ forgeTab: tab }),

  /** 방 이동 (클리어한 방 또는 다음 방으로) — 현재 타겟 초기화 */
  moveToRoom: (room) => {
    const state = get();
    // 이동 가능: 클리어한 방 이하 또는 다음 미클리어 방
    if (room < 1 || room > ROOMS_PER_ZONE) return;
    if (room > state.hunt.roomCleared + 1) return;
    set({
      hunt: {
        ...state.hunt,
        currentRoom: room,
        roomKills: 0,
        currentTargetId: null,
        monsterCurrentHp: 0,
        currentFightTicks: 0,
        fightStartedAt: 0,
        joinedMonsters: [],
        approachingMonsters: [],
      },
    });
    saveState(get());
  },

  /** 스탯 포인트 1 배분 */
  allocateStat: (stat) => {
    const state = get();
    const remaining = state.getRemainingPoints();
    if (remaining <= 0) return;

    const oldCon = BASE_STATS.con + state.statAllocation.con;
    const newAllocation = { ...state.statAllocation, [stat]: state.statAllocation[stat] + 1 };
    const newCon = BASE_STATS.con + newAllocation.con;

    // CON 증가 시 HP 보너스 즉시 적용 (레벨업 시 얻었을 HP 1회분 추가)
    let newMaxHp = state.maxHp;
    if (stat === 'con' && newCon > oldCon) {
      newMaxHp += 1; // CON 1 증가당 maxHp +1 즉시 보너스
    }

    set({ statAllocation: newAllocation, maxHp: newMaxHp });
    saveState(get());
  },

  startHunt: (zoneId) => {
    const zone = HUNT_ZONES.find(z => z.id === zoneId);
    if (!zone) return;
    const state = get();
    if (state.level < zone.requiredLevel) return;
    if (state.currentHp <= 0) return; // 사망 상태에서 사냥 불가

    const entry: LogEntry = {
      id: genLogId(), type: 'enter',
      text: `${zone.name}에 진입했습니다.`,
      timestamp: Date.now(),
    };

    set({
      hunt: {
        zoneId,
        status: 'hunting',
        currentRoom: 1,
        roomKills: 0,
        roomCleared: 0,
        kills: 0,
        goldGained: 0,
        materialsGained: {},
        itemsFound: 0,
        avgKillTime: 0,
        currentFightTicks: 0,
        fightStartedAt: 0,
        startedAt: Date.now(),
        currentTargetId: null,
        monsterCurrentHp: 0,
        joinedMonsters: [],
        approachingMonsters: [],
      },
      combatLog: [entry],
    });
  },

  moveToNextFloor: (useScroll) => {
    const state = get();
    const zone = HUNT_ZONES.find(z => z.id === state.hunt.zoneId);
    if (!zone || zone.zoneType !== 'dungeon' || !zone.floor || !zone.maxFloor) return;
    if (zone.floor >= zone.maxFloor) return;

    const nextFloorId = `${zone.dungeonGroup}_${zone.floor + 1}f`;
    if (useScroll) {
      const scrollId = `scroll_${nextFloorId}`;
      if ((state.materials[scrollId] ?? 0) < 1) return;
      set({ materials: { ...state.materials, [scrollId]: state.materials[scrollId] - 1 } });
    } else {
      // 모든 방 클리어 필요
      if (state.hunt.roomCleared < ROOMS_PER_ZONE) return;
    }
    // startHunt이 room/kills를 초기화
    get().startHunt(nextFloorId);
  },

  pauseHunt: () => set(s => ({
    hunt: { ...s.hunt, status: 'paused' },
  })),

  resumeHunt: () => {
    const state = get();
    if (state.currentHp <= 0) return; // 사망 상태에서 재개 불가
    set({ hunt: { ...state.hunt, status: 'hunting' } });
  },

  revive: () => {
    const state = get();
    if (state.currentHp > 0) return; // 이미 살아있음
    set({ currentHp: state.maxHp + state.getTotalHpBonus() });
    saveState(get());
  },

  /** 미니맵에서 호출: 선공 몬스터가 5m 이내 → 접근 시작 */
  startApproach: (monsterId, distanceM) => {
    const state = get();
    const hunt = state.hunt;
    if (hunt.status !== 'hunting' || state.currentHp <= 0) return false;

    const joined = hunt.joinedMonsters;
    const approaching = hunt.approachingMonsters;
    if (joined.length + approaching.length >= 2) return false;

    const inFightIds = new Set([
      hunt.currentTargetId,
      ...joined.map(j => j.monsterId),
      ...approaching.map(a => a.monsterId),
    ]);
    if (inFightIds.has(monsterId)) return false;

    const zone = HUNT_ZONES.find(z => z.id === hunt.zoneId);
    if (!zone) return false;
    let monsters = getMonstersForRoom(zone, hunt.currentRoom ?? 1);
    if (monsters.length === 0) monsters = zone.monsters;
    const monster = monsters.find(m => m.id === monsterId);
    if (!monster || !monster.aggressive) return false;

    set({
      hunt: {
        ...hunt,
        approachingMonsters: [...approaching, {
          monsterId: monster.id,
          hp: monster.hp,
          distanceRemaining: distanceM,
        }],
      },
    });
    return true;
  },

  tickHunt: () => {
    const state = get();
    const { hunt } = state;
    if (hunt.status !== 'hunting' || !hunt.zoneId) return;

    // ── 이동 중이면 전투 스킵 (Minimap 좌표 기반 제어) ──
    if (state.isPlayerMoving) return;

    const zone = HUNT_ZONES.find(z => z.id === hunt.zoneId)!;

    // ── 몬스터 선택 (방 기반 필터링) ──
    let monsters = getMonstersForRoom(zone, hunt.currentRoom ?? 1);
    // 빈 배열 방어: 존 전체 몬스터 사용
    if (monsters.length === 0) monsters = zone.monsters;
    if (monsters.length === 0) return; // 몬스터 없으면 스킵

    let monster;
    let monsterHp = hunt.monsterCurrentHp;
    let isNewTarget = false;

    if (hunt.currentTargetId) {
      // 기존 타겟 유지
      const prev = monsters.find(m => m.id === hunt.currentTargetId);
      if (prev && monsterHp > 0) {
        monster = prev;
      } else {
        // 타겟이 사라짐 → 새 타겟
        monster = monsters[Math.floor(Math.random() * monsters.length)];
        monsterHp = monster.hp;
        isNewTarget = true;
      }
    } else {
      // 새 타겟 선택
      monster = monsters[Math.floor(Math.random() * monsters.length)];
      monsterHp = monster.hp;
      isNewTarget = true;
    }

    // ── 새 타겟 발견 → HP바 표시 + 선공 몬스터는 선제 공격 ──
    if (isNewTarget) {
      const encounterLogs: LogEntry[] = [];
      let encounterHp = state.currentHp;
      let encounterGold = state.gold;

      encounterLogs.push({
        id: genLogId(), type: 'encounter',
        text: `${monster.name}을(를) 발견! (Lv.${monster.level})`,
        timestamp: Date.now(),
      });

      // ── 선공 몬스터: 돌진 선제 공격 ──
      if (monster.aggressive) {
        const rawDmg = rollMonsterDamage(monster.damDice, monster.damDiceSides, monster.extraDam);
        const chargeMult = 0.8 / monster.moveSpeed;
        const chargeRaw = Math.max(1, Math.round(rawDmg * chargeMult));
        const multStr = Math.abs(chargeMult - 1) > 0.01 ? ` x${chargeMult.toFixed(1)}` : '';

        let chargeDmg: number;
        let chargeLog: string;

        if (monster.attackType === 'magic') {
          const allSlots = [state.equippedWeapon, state.equippedTshirt, state.equippedArmor, state.equippedHelmet,
            state.equippedCloak, state.equippedGloves, state.equippedBoots, state.equippedShield,
            state.equippedNecklace, state.equippedRing, state.equippedRing2, state.equippedBelt];
          const bonusMr = allSlots.reduce((s, eq) => s + (eq?.bonuses?.mr ?? 0), 0);
          const playerMR = finalMR(state.level, state.getWis()) + bonusMr;
          chargeDmg = applyMagicReduction(chargeRaw, playerMR);
          const pct = Math.round(magicReduction(playerMR) * 100);
          chargeLog = `${monster.name}의 마법 돌진! -${chargeDmg} HP (MR ${pct}% 저항${multStr})`;
        } else {
          chargeDmg = chargeRaw;
          chargeLog = `${monster.name}이(가) 돌진! -${chargeDmg} HP${multStr}`;
        }

        encounterHp = Math.max(0, encounterHp - chargeDmg);
        encounterLogs.push({
          id: genLogId(), type: 'hit_taken',
          text: `${chargeLog} (HP: ${encounterHp}/${state.maxHp + state.getTotalHpBonus()})`,
          timestamp: Date.now(),
        });

        // 선제 공격으로 사망
        if (encounterHp <= 0) {
          const lossRate = deathExpLossRate(state.level);
          const expLoss = Math.floor(state.exp * lossRate);
          const newExp = Math.max(0, state.exp - expLoss);

          encounterLogs.push({
            id: genLogId(), type: 'death',
            text: `사망! 경험치 ${expLoss.toLocaleString()} 손실 (${Math.round(lossRate * 100)}%).`,
            timestamp: Date.now(),
          });

          set({
            exp: newExp,
            currentHp: encounterHp,
            combatLog: [...state.combatLog, ...encounterLogs].slice(-100),
            hunt: {
              ...hunt,
              currentTargetId: null,
              monsterCurrentHp: 0,
              currentFightTicks: 0,
              fightStartedAt: 0,
              status: 'paused',
              joinedMonsters: [],
              approachingMonsters: [],
            },
          } as Partial<GameState>);
          saveState(get());
          return;
        }
      }

      set({
        currentHp: encounterHp,
        gold: encounterGold,
        hunt: {
          ...hunt,
          currentTargetId: monster.id,
          monsterCurrentHp: monsterHp,
          currentFightTicks: 0,
          fightStartedAt: Date.now(),
        },
        combatLog: [...state.combatLog, ...encounterLogs].slice(-100),
      } as Partial<GameState>);
      saveState(get());
      return;
    }

    // ── 플레이어 전투 스탯 계산 ──
    const playerStr = state.getStr();
    const playerDex = state.getDex();
    const playerCon = state.getCon();
    const playerWis = state.getWis();
    const weaponEnchant = state.equippedWeapon?.enhanceLevel ?? 0;
    const weaponBaseDmg = monster.size === 'large'
      ? (state.equippedWeapon?.baseAtkLarge ?? 0)
      : (state.equippedWeapon?.baseAtk ?? 0);
    const armorDef = state.getTotalDefense();

    // 장비 보너스 합산
    const allEquipSlots = [state.equippedWeapon, state.equippedTshirt, state.equippedArmor, state.equippedHelmet,
      state.equippedCloak, state.equippedGloves, state.equippedBoots, state.equippedShield,
      state.equippedNecklace, state.equippedRing, state.equippedRing2, state.equippedBelt];
    const equipBonusHit = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.hit ?? 0), 0);
    const equipBonusExtraDmg = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.extraDmg ?? 0), 0);
    const equipBonusMr = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.mr ?? 0), 0);
    const equipBonusHp = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.hp ?? 0), 0);
    const setBonusHp = state.getSetBonusHp();
    const hpBonus = equipBonusHp + setBonusHp; // 장비+세트 HP 보너스

    const playerMeleeHit = meleeHit(state.level, weaponEnchant, playerStr) + equipBonusHit;
    const monsterEvasion = monster.level + monster.ac;

    // 플레이어 회피 (몬스터 명중 판정용)
    const playerAC = finalAC(armorDef, state.level, playerDex);
    const playerEvasion = acToEvasion(playerAC);

    const newLogs: LogEntry[] = [];
    const newMaterials = { ...state.materials };
    const newPotions = { ...state.potions };
    const gainedMats: Record<string, number> = { ...hunt.materialsGained };
    let newGold = state.gold;
    let huntGold = hunt.goldGained;
    let newExp = state.exp;
    let newLevel = state.level;
    let newTitle = state.title;
    let newItems = hunt.itemsFound;
    let newMaxHp = state.maxHp;
    let newCurrentHp = state.currentHp;
    const newInventory = [...state.inventory];
    let newKills = hunt.kills;
    let newRoomKills = hunt.roomKills;
    let newRoomCleared = hunt.roomCleared;
    let shouldAdvanceFloor = false;
    let killed = false;
    let fightTicks = isNewTarget ? 1 : hunt.currentFightTicks + 1;
    let currentJoined = [...(hunt.joinedMonsters ?? [])];
    let currentApproaching = [...(hunt.approachingMonsters ?? [])];

    // ── 0) 버프 물약 자동 사용 (토글 ON인 것만) ──
    const now = Date.now();
    let newActiveBuffs = [...state.activeBuffs].filter(b => b.expiresAt > now);

    for (const pid of POTION_ORDER) {
      const p = POTIONS[pid];
      if (!p.buffDuration) continue; // 힐 물약은 스킵
      // 토글 플래그 확인
      if (pid === 'green_potion' && !state.greenPotionEnabled) continue;
      if (pid === 'courage_potion' && !state.couragePotionEnabled) continue;
      if (state.level < p.requiredLevel) continue;
      const alreadyActive = newActiveBuffs.some(b => b.potionId === pid);
      if (alreadyActive) continue;
      const pCount = newPotions[pid] ?? 0;
      if (pCount <= 0) continue;
      newPotions[pid] = pCount - 1;
      newActiveBuffs.push({
        potionId: pid,
        name: p.name,
        expiresAt: now + p.buffDuration * 1000,
        atkSpeedMult: p.atkSpeedMult ?? 1,
        moveSpeedMult: p.moveSpeedMult ?? 1,
      });
      newLogs.push({
        id: genLogId(), type: 'potion',
        text: `${p.name} 사용! (${p.buffDuration}초)`,
        timestamp: now,
      });
    }

    // 공격속도 배율은 App.tsx의 틱 간격에 반영됨 (곱연산으로 틱 주기 단축)
    // 여기서는 매 틱 1회 공격

    // ── 0.5a) 접근 중인 몬스터: 매 틱 이동 + 도착 체크 ──
    const justArrivedIds = new Set<string>(); // 이번 틱에 도착한 몬스터 — 2.5 반격 스킵용
    if (newCurrentHp > 0 && currentApproaching.length > 0) {
      const tickSec = 3 / (state.getAtkSpeedMult?.() ?? 1); // 실제 틱 간격 (초)
      const stillApproaching: typeof currentApproaching = [];
      for (const ap of currentApproaching) {
        const joiner = monsters.find(m => m.id === ap.monsterId) ?? zone.monsters.find(m => m.id === ap.monsterId);
        if (!joiner) continue;

        // 이동: 남은 거리 감소 (tickSec / moveSpeed = 이번 틱에 이동한 m)
        ap.distanceRemaining -= tickSec / joiner.moveSpeed;

        if (ap.distanceRemaining > 0 || currentJoined.length >= 2) {
          // 아직 미도착 or 합류 슬롯 꽉 참 → 계속 접근
          stillApproaching.push(ap);
          continue;
        }

        // ── 도착 → 합류 + 돌진 ──
        const rawDmg = rollMonsterDamage(joiner.damDice, joiner.damDiceSides, joiner.extraDam);
        const chargeMult = 0.8 / joiner.moveSpeed;
        const chargeRaw = Math.max(1, Math.round(rawDmg * chargeMult));
        const multStr = Math.abs(chargeMult - 1) > 0.01 ? ` x${chargeMult.toFixed(1)}` : '';

        let chargeDmg: number;
        if (joiner.attackType === 'magic') {
          const playerMR = finalMR(state.level, playerWis) + equipBonusMr;
          chargeDmg = applyMagicReduction(chargeRaw, playerMR);
          const pct = Math.round(magicReduction(playerMR) * 100);
          newLogs.push({
            id: genLogId(), type: 'join',
            text: `${joiner.name} 도착! 마법 돌진 -${chargeDmg} HP (MR ${pct}%${multStr})`,
            timestamp: Date.now(),
          });
        } else {
          chargeDmg = chargeRaw;
          newLogs.push({
            id: genLogId(), type: 'join',
            text: `${joiner.name} 도착! 돌진 -${chargeDmg} HP${multStr}`,
            timestamp: Date.now(),
          });
        }

        newCurrentHp = Math.max(0, newCurrentHp - chargeDmg);
        justArrivedIds.add(joiner.id); // 도착 틱에는 돌진만, 2.5 반격 스킵
        currentJoined = [...currentJoined, { monsterId: joiner.id, hp: joiner.hp }];

        if (newCurrentHp <= 0) {
          const lossRate = deathExpLossRate(newLevel);
          const expLoss = Math.floor(newExp * lossRate);
          newExp = Math.max(0, newExp - expLoss);
          newLogs.push({
            id: genLogId(), type: 'death',
            text: `사망! 경험치 ${expLoss.toLocaleString()} 손실 (${Math.round(lossRate * 100)}%).`,
            timestamp: Date.now(),
          });
          set({
            gold: newGold, exp: newExp, level: newLevel, title: newTitle,
            maxHp: newMaxHp, currentHp: 0,
            inventory: newInventory, materials: newMaterials, potions: newPotions,
            activeBuffs: newActiveBuffs,
            combatLog: [...state.combatLog, ...newLogs].slice(-80),
            hunt: {
              ...hunt, kills: newKills, goldGained: huntGold,
              materialsGained: gainedMats, itemsFound: newItems,
              currentFightTicks: 0, fightStartedAt: 0, currentTargetId: null,
              monsterCurrentHp: 0, status: 'paused',
              joinedMonsters: [], approachingMonsters: [],
            },
          } as Partial<GameState>);
          saveState(get());
          return;
        }
      }
      currentApproaching = stillApproaching;
    }

    // (0.5b 제거 — 접근 감지는 미니맵 좌표 기반으로 Minimap 컴포넌트에서 처리)

    // ── 1) 플레이어 → 몬스터 명중 판정 ──
    const { hit: isHit, rate: hitRate } = rollHit(playerMeleeHit, monsterEvasion);

    if (!isHit) {
      newLogs.push({
        id: genLogId(), type: 'miss',
        text: `${monster.name}에게 공격이 빗나갔습니다! (명중률 ${Math.round(hitRate * 100)}%)`,
        timestamp: Date.now(),
      });
    } else {
      // 대미지 굴림 (장비 추타 보너스 + 언데드 추타 적용)
      const isUndead = monster.undead && state.equippedWeapon?.bonuses?.undeadSlayer;
      const undeadBonus = isUndead ? Math.floor(Math.random() * 20) + 1 : 0;
      const damage = rollDamage(weaponBaseDmg, state.level, weaponEnchant, playerStr) + equipBonusExtraDmg + undeadBonus;
      const isCrit = Math.random() < 0.1;
      const finalDmg = isCrit ? Math.floor(damage * 1.5) : damage;
      const undeadText = isUndead ? ` (은빛 가속 +${undeadBonus})` : '';
      monsterHp = Math.max(0, monsterHp - finalDmg);

      if (monsterHp <= 0) {
        // ── 몬스터 처치 ──
        killed = true;

        newLogs.push({
          id: genLogId(),
          type: isCrit ? 'crit' : 'kill',
          text: isCrit
            ? `치명타! ${monster.name}을(를) 처치! (${finalDmg} dmg, Lv.${monster.level})${undeadText}`
            : `${monster.name}을(를) 처치. (${finalDmg} dmg, Lv.${monster.level})${undeadText}`,
          timestamp: Date.now(),
        });

        newKills++;
        newRoomKills++;

        // 방 클리어 체크
        if (newRoomKills >= ROOM_KILL_REQ && hunt.currentRoom > newRoomCleared) {
          newRoomCleared = Math.max(newRoomCleared, hunt.currentRoom);
          const roomNum = hunt.currentRoom;
          if (newRoomCleared < ROOMS_PER_ZONE) {
            newLogs.push({
              id: genLogId(), type: 'enter',
              text: `Room ${roomNum} 클리어! → Room ${roomNum + 1} 해금`,
              timestamp: Date.now(),
            });
          } else {
            // 모든 방 클리어
            if (zone.zoneType === 'dungeon' && zone.floor && zone.maxFloor && zone.floor < zone.maxFloor) {
              shouldAdvanceFloor = true;
              newLogs.push({
                id: genLogId(), type: 'enter',
                text: `모든 방 클리어! → 다음 층 이동...`,
                timestamp: Date.now(),
              });
            } else {
              newLogs.push({
                id: genLogId(), type: 'enter',
                text: `모든 방 클리어!`,
                timestamp: Date.now(),
              });
            }
          }
        }

        // 평균 킬 타임 갱신 (실제 경과 시간)
        const thisKillMs = hunt.fightStartedAt > 0
          ? Date.now() - hunt.fightStartedAt
          : fightTicks * 3000; // fallback
        hunt.avgKillTime = newKills === 1
          ? thisKillMs
          : ((hunt.avgKillTime * (newKills - 1)) + thisKillMs) / newKills;

        // Gold & EXP (배율 적용)
        const goldDrop = Math.floor((monster.goldReward + Math.floor(Math.random() * 5)) * RATE_GOLD);
        newGold += goldDrop;
        huntGold += goldDrop;
        newExp += Math.floor(monster.expReward * RATE_EXP);

        newLogs.push({
          id: genLogId(), type: 'loot',
          text: `${goldDrop} 골드`,
          timestamp: Date.now(),
        });

        // Level up check
        while (newExp >= xpForLevel(newLevel)) {
          newExp -= xpForLevel(newLevel);
          newLevel++;

          const hpGain = rollHpGain(playerCon);
          newMaxHp += hpGain;
          newCurrentHp = newMaxHp + hpBonus; // 레벨업 시 HP 전체 회복 (장비+세트 보너스 포함)

          const hasStatPoint = newLevel >= 50;
          newLogs.push({
            id: genLogId(), type: 'levelup',
            text: `레벨 업! Lv.${newLevel} 달성! (HP +${hpGain}${hasStatPoint ? ', 스탯 포인트 +1' : ''})`,
            timestamp: Date.now(),
          });

          if (newLevel >= 20) newTitle = '숙련 모험가';
          if (newLevel >= 30) newTitle = '베테랑';
        }

        // Monster-based drops (CSV 원본 드롭률, 배율 적용)
        const monsterDropList = getMonsterDrops(monster.id);
        for (const [gameId, chance, minQty, maxQty] of monsterDropList) {
          if (Math.random() >= Math.min(1, chance * RATE_DROP)) continue;
          const qty = minQty + Math.floor(Math.random() * (maxQty - minQty + 1));

          // 재료/강화스크롤 → materials, 장비 → inventory
          if (MATERIALS[gameId]) {
            const matName = MATERIALS[gameId].name;
            newMaterials[gameId] = (newMaterials[gameId] ?? 0) + qty;
            gainedMats[gameId] = (gainedMats[gameId] ?? 0) + qty;
            newLogs.push({ id: genLogId(), type: 'loot', text: `${matName} x${qty}`, timestamp: Date.now() });
          } else if (EQUIPMENT_TEMPLATES[gameId]) {
            const eq = createEquipment(gameId);
            newItems++;
            if (newInventory.length < state.inventoryCapacity) {
              newInventory.push(eq);
              newLogs.push({ id: genLogId(), type: 'find', text: `${eq.name} 획득 → 인벤토리`, timestamp: Date.now() });
            }
          }
        }

        // 던전 이동주문서 드롭 (층별, 각 5%, cap 3)
        if (zone.zoneType === 'dungeon' && zone.floor && zone.maxFloor) {
          // 다음 층 주문서 (마지막 층 아닐 때)
          if (zone.floor < zone.maxFloor) {
            const nextScrollId = `scroll_${zone.dungeonGroup}_${zone.floor + 1}f`;
            if ((newMaterials[nextScrollId] ?? 0) < DUNGEON_SCROLL_MAX && Math.random() < DUNGEON_SCROLL_DROP) {
              newMaterials[nextScrollId] = (newMaterials[nextScrollId] ?? 0) + 1;
              const nextFloorName = zone.name.replace(/\d+F$/, `${zone.floor + 1}F`);
              newLogs.push({ id: genLogId(), type: 'loot', text: `${nextFloorName} 이동주문서`, timestamp: Date.now() });
            }
          }
          // 현재 층 주문서 (1층 제외 — 1층은 항상 무료)
          if (zone.floor > 1) {
            const curScrollId = `scroll_${zone.id}`;
            if ((newMaterials[curScrollId] ?? 0) < DUNGEON_SCROLL_MAX && Math.random() < DUNGEON_SCROLL_DROP) {
              newMaterials[curScrollId] = (newMaterials[curScrollId] ?? 0) + 1;
              newLogs.push({ id: genLogId(), type: 'loot', text: `${zone.name} 이동주문서`, timestamp: Date.now() });
            }
          }
        }
      } else {
        // 몬스터 생존 — 대미지 로그 (미니맵 이벤트 감지용, CombatLog UI에서 필터링)
        newLogs.push({
          id: genLogId(), type: isCrit ? 'crit' : 'battle',
          text: isCrit
            ? `치명타! ${monster.name}에게 ${finalDmg} 대미지 (HP: ${monsterHp}/${monster.hp})${undeadText}`
            : `${monster.name}에게 ${finalDmg} 대미지 (HP: ${monsterHp}/${monster.hp})${undeadText}`,
          timestamp: Date.now(),
        });
      }
    }
    // ── 2) 주 타겟 반격 (살아있을 때만) ──
    if (!killed && monsterHp > 0 && newCurrentHp > 0) {
      const rawMonsterDmg = rollMonsterDamage(monster.damDice, monster.damDiceSides, monster.extraDam);

      if (monster.attackType === 'magic') {
        const playerMR = finalMR(state.level, playerWis) + equipBonusMr;
        const reduced = applyMagicReduction(rawMonsterDmg, playerMR);
        const pct = Math.round(magicReduction(playerMR) * 100);
        newCurrentHp = Math.max(0, newCurrentHp - reduced);
        newLogs.push({
          id: genLogId(), type: 'hit_taken',
          text: `${monster.name}의 마법 공격! -${reduced} HP (MR ${pct}% 저항) (HP: ${newCurrentHp}/${newMaxHp + hpBonus})`,
          timestamp: Date.now(),
        });
      } else {
        const monsterHitRate = calcHitRate(monster.level, playerEvasion);
        const monsterHits = Math.random() < monsterHitRate;
        if (monsterHits) {
          newCurrentHp = Math.max(0, newCurrentHp - rawMonsterDmg);
          newLogs.push({
            id: genLogId(), type: 'hit_taken',
            text: `${monster.name}의 공격! -${rawMonsterDmg} HP (HP: ${newCurrentHp}/${newMaxHp + hpBonus})`,
            timestamp: Date.now(),
          });
        } else {
          newLogs.push({
            id: genLogId(), type: 'miss',
            text: `${monster.name}의 공격을 회피! (회피율 ${Math.round((1 - monsterHitRate) * 100)}%)`,
            timestamp: Date.now(),
          });
        }
      }
    }

    // ── 2.5) 합류 몬스터 반격 (이번 틱에 도착한 몬스터는 돌진만 하고 스킵) ──
    if (newCurrentHp > 0 && currentJoined.length > 0) {
      for (const joined of currentJoined) {
        if (newCurrentHp <= 0) break;
        if (justArrivedIds.has(joined.monsterId)) continue;
        const jm = monsters.find(m => m.id === joined.monsterId) ?? zone.monsters.find(m => m.id === joined.monsterId);
        if (!jm) continue;
        const rawJDmg = rollMonsterDamage(jm.damDice, jm.damDiceSides, jm.extraDam);

        if (jm.attackType === 'magic') {
          const playerMR = finalMR(state.level, playerWis) + equipBonusMr;
          const reduced = applyMagicReduction(rawJDmg, playerMR);
          const pct = Math.round(magicReduction(playerMR) * 100);
          newCurrentHp = Math.max(0, newCurrentHp - reduced);
          newLogs.push({
            id: genLogId(), type: 'hit_taken',
            text: `[합류] ${jm.name}의 마법 공격! -${reduced} HP (MR ${pct}%) (HP: ${newCurrentHp}/${newMaxHp + hpBonus})`,
            timestamp: Date.now(),
          });
        } else {
          const jmHitRate = calcHitRate(jm.level, playerEvasion);
          if (Math.random() < jmHitRate) {
            newCurrentHp = Math.max(0, newCurrentHp - rawJDmg);
            newLogs.push({
              id: genLogId(), type: 'hit_taken',
              text: `[합류] ${jm.name}의 공격! -${rawJDmg} HP (HP: ${newCurrentHp}/${newMaxHp + hpBonus})`,
              timestamp: Date.now(),
            });
          } else {
            newLogs.push({
              id: genLogId(), type: 'miss',
              text: `[합류] ${jm.name}의 공격을 회피!`,
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    // ── 2.9) 플레이어 사망 (주 타겟 또는 합류 몬스터에 의해) ──
    if (newCurrentHp <= 0) {
      const lossRate = deathExpLossRate(newLevel);
      const expLoss = Math.floor(newExp * lossRate);
      newExp = Math.max(0, newExp - expLoss);
      newCurrentHp = 0;
      newLogs.push({
        id: genLogId(), type: 'death',
        text: `사망! 경험치 ${expLoss.toLocaleString()} 손실 (${Math.round(lossRate * 100)}%).`,
        timestamp: Date.now(),
      });
      set({
        gold: newGold, exp: newExp, level: newLevel, title: newTitle,
        maxHp: newMaxHp, currentHp: 0,
        inventory: newInventory, materials: newMaterials,
        potions: newPotions, activeBuffs: newActiveBuffs,
        combatLog: [...state.combatLog, ...newLogs].slice(-80),
        hunt: {
          ...hunt, kills: newKills, goldGained: huntGold,
          materialsGained: gainedMats, itemsFound: newItems,
          currentFightTicks: 0, fightStartedAt: 0, currentTargetId: null,
          monsterCurrentHp: 0, status: 'paused',
          joinedMonsters: [], approachingMonsters: [],
        },
      } as Partial<GameState>);
      saveState(get());
      return;
    }

    // ── 3) 물약 자동 사용 ──
    if (newCurrentHp > 0 && newCurrentHp < newMaxHp + hpBonus && state.potionAutoUse) {
      const hpPct = (newCurrentHp / (newMaxHp + hpBonus)) * 100;
      if (hpPct <= state.potionAutoThreshold) {
        const pid = state.selectedPotionId;
        let pCount = newPotions[pid] ?? 0;

        // 자동 보충: 물약 떨어졌으면 10개 구매
        if (pCount <= 0 && state.potionAutoBuy) {
          const potion = POTIONS[pid];
          if (potion) {
            const buyQty = 10;
            const cost = potion.buyPrice * buyQty;
            if (newGold >= cost) {
              newGold -= cost;
              pCount += buyQty;
              newPotions[pid] = pCount;
            }
          }
        }

        if (pCount > 0) {
          const potion = POTIONS[pid];
          if (potion) {
            const heal = potion.healMin + Math.floor(Math.random() * (potion.healMax - potion.healMin + 1));
            newCurrentHp = Math.min(newMaxHp + hpBonus, newCurrentHp + heal);
            newPotions[pid] = pCount - 1;
            newLogs.push({
              id: genLogId(), type: 'potion',
              text: `${potion.name} 사용! HP +${heal} (HP: ${newCurrentHp}/${newMaxHp + hpBonus})`,
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    // ── 킬 후 다음 타겟 — 합류 몬스터 승격 or 새 타겟 ──
    let nextTargetId: string | null = killed ? null : monster.id;
    let nextMonsterHp = killed ? 0 : monsterHp;

    if (killed) {
      if (currentJoined.length > 0) {
        // 합류 몬스터 중 첫 번째를 주 타겟으로 승격
        const [promoted, ...remaining] = currentJoined;
        const promotedMonster = monsters.find(m => m.id === promoted.monsterId)
          ?? zone.monsters.find(m => m.id === promoted.monsterId);
        if (promotedMonster) {
          nextTargetId = promotedMonster.id;
          nextMonsterHp = promoted.hp;
          currentJoined = remaining;
          newLogs.push({
            id: genLogId(), type: 'battle',
            text: `${promotedMonster.name}이(가) 주 타겟으로! (Lv.${promotedMonster.level})`,
            timestamp: Date.now(),
          });
        } else {
          currentJoined = [];
          const nextMonster = monsters[Math.floor(Math.random() * monsters.length)];
          nextTargetId = nextMonster.id;
          nextMonsterHp = nextMonster.hp;
          newLogs.push({
            id: genLogId(), type: 'encounter',
            text: `${nextMonster.name}을(를) 발견! (Lv.${nextMonster.level})`,
            timestamp: Date.now(),
          });
        }
      } else {
        // 합류 몬스터 없음 → 새 타겟
        const nextMonster = monsters[Math.floor(Math.random() * monsters.length)];
        nextTargetId = nextMonster.id;
        nextMonsterHp = nextMonster.hp;
        newLogs.push({
          id: genLogId(), type: 'encounter',
          text: `${nextMonster.name}을(를) 발견! (Lv.${nextMonster.level})`,
          timestamp: Date.now(),
        });
      }
    }

    // ── 상태 업데이트 ──
    set({
      gold: newGold,
      exp: newExp,
      level: newLevel,
      title: newTitle,
      maxHp: newMaxHp,
      currentHp: newCurrentHp,
      inventory: newInventory,
      materials: newMaterials,
      potions: newPotions,
      activeBuffs: newActiveBuffs,
      combatLog: [...state.combatLog, ...newLogs].slice(-80),
      hunt: {
        ...hunt,
        kills: newKills,
        roomKills: newRoomKills,
        roomCleared: newRoomCleared,
        goldGained: huntGold,
        materialsGained: gainedMats,
        itemsFound: newItems,
        currentFightTicks: killed ? 0 : fightTicks,
        fightStartedAt: killed ? Date.now() : hunt.fightStartedAt,
        currentTargetId: nextTargetId,
        monsterCurrentHp: nextMonsterHp,
        joinedMonsters: currentJoined,
        approachingMonsters: currentApproaching,
      },
    });

    // Auto-save every 10 kills
    if (killed && newKills % 10 === 0) saveState(get());

    // 모든 방 클리어 → 던전 다음 층 자동 이동
    if (shouldAdvanceFloor) {
      setTimeout(() => get().moveToNextFloor(false), 1500);
    }
  },

  processQueueItem: (id, action) => {
    const state = get();
    const item = state.queue.find(q => q.id === id);
    if (!item) return;

    const newQueue = state.queue.filter(q => q.id !== id);
    let updates: Partial<GameState> = { queue: newQueue };

    if (action === 'equip') {
      const eq = item.item;
      const slotKeys: Record<string, string> = {
        weapon: 'equippedWeapon', tshirt: 'equippedTshirt', armor: 'equippedArmor', helmet: 'equippedHelmet',
        cloak: 'equippedCloak', gloves: 'equippedGloves', boots: 'equippedBoots',
        shield: 'equippedShield', necklace: 'equippedNecklace', ring: 'equippedRing', belt: 'equippedBelt',
      };
      // 반지: ring1 비면 ring1, 아니면 ring2
      let slotKey = slotKeys[eq.type];
      if (eq.type === 'ring' && state.equippedRing) slotKey = 'equippedRing2';
      if (slotKey) {
        const old = (state as unknown as Record<string, unknown>)[slotKey] as Equipment | null;
        (updates as unknown as Record<string, unknown>)[slotKey] = eq;
        if (old && state.inventory.length < state.inventoryCapacity) {
          updates.inventory = [...state.inventory, old];
        } else if (old) {
          updates.gold = state.gold + old.sellPrice;
        }
      }
    } else if (action === 'sell') {
      updates.gold = (updates.gold ?? state.gold) + item.priceIfSold;
    } else if (action === 'keep') {
      // Keep: move to inventory if there's space
      if (state.inventory.length < state.inventoryCapacity) {
        updates.inventory = [...(updates.inventory ?? state.inventory), item.item];
      }
    }

    // Resume hunting if queue was full and now has space
    if (state.hunt.status === 'paused' && newQueue.length < state.queueCapacity) {
      updates.hunt = { ...state.hunt, status: 'hunting' };
    }

    set(updates as GameState);
    saveState(get());
  },

  bulkSellLow: () => {
    const state = get();
    let goldGained = 0;
    const remaining: QueueItem[] = [];

    for (const q of state.queue) {
      if (q.recommendation === 'sell') {
        goldGained += q.priceIfSold;
      } else {
        remaining.push(q);
      }
    }

    const updates: Partial<GameState> = {
      queue: remaining,
      gold: state.gold + goldGained,
    };

    if (state.hunt.status === 'paused' && remaining.length < state.queueCapacity) {
      updates.hunt = { ...state.hunt, status: 'hunting' };
    }

    set(updates as GameState);
    saveState(get());
  },

  tryEnhance: (uid, scrollType) => {
    const state = get();
    // Find the equipment (모든 장착 슬롯 + 인벤토리)
    let eq: Equipment | null = null;
    const allSlotKeys = ['equippedWeapon', 'equippedTshirt', 'equippedArmor', 'equippedHelmet', 'equippedCloak',
      'equippedGloves', 'equippedBoots', 'equippedShield', 'equippedNecklace', 'equippedRing', 'equippedRing2', 'equippedBelt'] as const;
    for (const key of allSlotKeys) {
      const s = state[key];
      if (s?.uid === uid) { eq = s; break; }
    }
    if (!eq) eq = state.inventory.find(e => e.uid === uid) ?? null;
    if (!eq) return;

    const level = eq.enhanceLevel;

    // 저주받은 주문서: -1 인첸 (0이면 사용 불가)
    if (scrollType === 'cursed') {
      if (level <= 0) return;
    } else {
      // 일반/축복: 최대 강화 도달 시 사용 불가
      if (level >= eq.maxEnhance) return;
    }

    // 주문서 소모
    const scrollId = getScrollId(eq.type, scrollType);
    const scrollName = MATERIALS[scrollId]?.name ?? scrollId;
    if ((state.materials[scrollId] ?? 0) < 1) return;

    const newMaterials = { ...state.materials, [scrollId]: (state.materials[scrollId] ?? 0) - 1 };

    const successRate = getEnhanceRate(eq.type, level);
    const safe = isEnhanceSafe(eq.type, level);

    let success: boolean;
    let destroyed = false;
    let updated: Equipment;

    if (scrollType === 'cursed') {
      // 저주받은 주문서: 항상 성공, -1
      success = true;
      updated = { ...eq, enhanceLevel: level - 1 };
    } else if (scrollType === 'blessed') {
      if (safe) {
        // 안전 구간: 확정 성공, +1 ~ +3
        success = true;
        const bonus = 1 + Math.floor(Math.random() * 3);
        const newLevel = Math.min(eq.enhanceLevel + bonus, eq.maxEnhance);
        updated = { ...eq, enhanceLevel: newLevel };
      } else {
        // 파괴 구간: 기존 성공률 적용, 성공 시 +1~+2, 실패 시 파괴
        success = Math.random() < successRate;
        if (success) {
          const bonus = 1 + Math.floor(Math.random() * 2);
          const newLevel = Math.min(eq.enhanceLevel + bonus, eq.maxEnhance);
          updated = { ...eq, enhanceLevel: newLevel };
        } else {
          destroyed = true;
          updated = { ...eq };
        }
      }
    } else {
      // 일반 주문서: 기존 성공률 적용
      success = Math.random() < successRate;
      if (success) {
        updated = { ...eq, enhanceLevel: level + 1 };
      } else if (!safe) {
        // 파괴 구간에서 실패 → 파괴
        destroyed = true;
        updated = { ...eq };
      } else {
        // 안전 구간 실패 → 변화 없음
        updated = { ...eq };
      }
    }

    const statBefore = equipStat(eq);
    const statAfter = destroyed ? 0 : equipStat(updated);

    // Apply update
    const updates: Partial<GameState> = { materials: newMaterials, enhanceScrollType: scrollType };

    // 강화 애니메이션: 축복 룰렛 / 파괴 시 0으로 추락
    if (scrollType === 'blessed' || destroyed) {
      (updates as GameState).enhanceAnim = { uid, fromLevel: level, toLevel: destroyed ? 0 : updated.enhanceLevel, destroyed, scrollType };
    } else {
      (updates as GameState).enhanceAnim = null;
    }

    // 애니메이션이 있을 경우 장비 업데이트를 clearEnhanceAnim으로 지연
    const hasAnim = (updates as GameState).enhanceAnim != null;
    if (hasAnim) {
      // 파괴/축복 성공 모두 애니메이션 완료 후 반영
    } else if (!destroyed) {
      let slotFound = false;
      for (const key of allSlotKeys) {
        if (state[key]?.uid === uid) {
          (updates as unknown as Record<string, unknown>)[key] = updated;
          slotFound = true;
          break;
        }
      }
      if (!slotFound) updates.inventory = state.inventory.map(e => e.uid === uid ? updated : e);
    }

    (updates as GameState).enhanceResult = {
      success,
      destroyed,
      itemName: eq.name,
      equipType: eq.type,
      fromLevel: level,
      toLevel: destroyed ? -1 : updated.enhanceLevel,
      statBefore,
      statAfter,
      scrollUsed: scrollName,
      scrollType,
      successRate,
    };

    set(updates as GameState);
    saveState(get());
  },

  closeEnhanceResult: () => set({ enhanceResult: null }),
  setEnhanceTarget: (uid) => set({ enhanceTargetUid: uid }),
  clearEnhanceAnim: () => {
    const state = get();
    const anim = state.enhanceAnim;
    if (!anim) { set({ enhanceAnim: null }); return; }

    const uid = anim.uid;
    const updates: Partial<GameState> = { enhanceAnim: null };
    const slotKeys = ['equippedWeapon', 'equippedTshirt', 'equippedArmor', 'equippedHelmet', 'equippedCloak',
      'equippedGloves', 'equippedBoots', 'equippedShield', 'equippedNecklace', 'equippedRing', 'equippedRing2', 'equippedBelt'] as const;

    if (anim.destroyed) {
      // 애니메이션 완료 후 파괴된 아이템 실제 제거
      let slotFound = false;
      for (const key of slotKeys) {
        if (state[key]?.uid === uid) {
          (updates as unknown as Record<string, unknown>)[key] = null;
          slotFound = true;
          break;
        }
      }
      if (!slotFound) updates.inventory = state.inventory.filter(e => e.uid !== uid);
    } else if (anim.toLevel > 0) {
      // 축복 성공 등 — 애니메이션 완료 후 레벨 반영
      let slotFound = false;
      for (const key of slotKeys) {
        const eq = state[key];
        if (eq?.uid === uid) {
          (updates as unknown as Record<string, unknown>)[key] = { ...eq, enhanceLevel: anim.toLevel };
          slotFound = true;
          break;
        }
      }
      if (!slotFound) {
        updates.inventory = state.inventory.map(e =>
          e.uid === uid ? { ...e, enhanceLevel: anim.toLevel } : e
        );
      }
    }

    set(updates as GameState);
    saveState(get());
  },

  tryCraft: (recipeId) => {
    const state = get();
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;
    if (state.level < recipe.requiredLevel) return;
    if (state.gold < recipe.goldCost) return;
    if (state.inventory.length >= state.inventoryCapacity) return;

    // Check materials
    for (const req of recipe.materials) {
      if ((state.materials[req.materialId] ?? 0) < req.quantity) return;
    }

    // Consume
    const newMaterials = { ...state.materials };
    for (const req of recipe.materials) {
      newMaterials[req.materialId] -= req.quantity;
    }

    const newEquip = createEquipment(recipe.resultTemplateId);

    set({
      gold: state.gold - recipe.goldCost,
      materials: newMaterials,
      inventory: [...state.inventory, newEquip],
    });
    saveState(get());
  },

  sellFromInventory: (uid) => {
    const state = get();
    const eq = state.inventory.find(e => e.uid === uid);
    if (!eq) return;
    set({
      inventory: state.inventory.filter(e => e.uid !== uid),
      gold: state.gold + eq.sellPrice,
    });
    saveState(get());
  },

  equipFromInventory: (uid) => {
    const state = get();
    const eq = state.inventory.find(e => e.uid === uid);
    if (!eq) return;

    const newInventory = state.inventory.filter(e => e.uid !== uid);
    const updates: Partial<GameState> = { inventory: newInventory };

    const slotKeys: Record<string, string> = {
      weapon: 'equippedWeapon', tshirt: 'equippedTshirt', armor: 'equippedArmor', helmet: 'equippedHelmet',
      cloak: 'equippedCloak', gloves: 'equippedGloves', boots: 'equippedBoots',
      shield: 'equippedShield', necklace: 'equippedNecklace', ring: 'equippedRing', belt: 'equippedBelt',
    };
    // 반지: ring1 비면 ring1, 아니면 ring2 교체
    let slotKey = slotKeys[eq.type];
    if (eq.type === 'ring' && state.equippedRing) slotKey = 'equippedRing2';
    if (slotKey) {
      const old = (state as unknown as Record<string, unknown>)[slotKey] as Equipment | null;
      if (old) newInventory.push(old);
      (updates as unknown as Record<string, unknown>)[slotKey] = eq;
    }

    updates.inventory = newInventory;
    set(updates as GameState);
    saveState(get());
  },

  unequipToInventory: (uid) => {
    const state = get();
    if (state.inventory.length >= state.inventoryCapacity) return;

    const allSlots = [
      'equippedWeapon', 'equippedTshirt', 'equippedArmor', 'equippedHelmet',
      'equippedCloak', 'equippedGloves', 'equippedBoots',
      'equippedShield', 'equippedNecklace', 'equippedRing', 'equippedRing2', 'equippedBelt',
    ];

    const updates: Partial<GameState> = {};
    for (const slotKey of allSlots) {
      const eq = (state as unknown as Record<string, unknown>)[slotKey] as Equipment | null;
      if (eq?.uid === uid) {
        (updates as unknown as Record<string, unknown>)[slotKey] = null;
        updates.inventory = [...state.inventory, eq];
        break;
      }
    }
    if (!updates.inventory) return; // uid not found in any slot
    set(updates as GameState);
    saveState(get());
  },

  // ── Potion Actions ──

  buyPotion: (id, qty) => {
    const state = get();
    const potion = POTIONS[id];
    if (!potion) return;
    const cost = potion.buyPrice * qty;
    if (state.gold < cost) return;
    if (state.level < potion.requiredLevel) return;
    set({
      gold: state.gold - cost,
      potions: { ...state.potions, [id]: (state.potions[id] ?? 0) + qty },
    });
    saveState(get());
  },

  setPlayerMoving: (moving) => set({ isPlayerMoving: moving }),

  buyEquipFromShop: (templateId) => {
    const state = get();
    const tmpl = EQUIPMENT_TEMPLATES[templateId];
    if (!tmpl) return;
    const shopPrice = tmpl.sellPrice * 2;
    if (state.gold < shopPrice) return;
    if (state.inventory.length >= state.inventoryCapacity) return;
    const newEquip = createEquipment(templateId);
    set({
      gold: state.gold - shopPrice,
      inventory: [...state.inventory, newEquip],
    });
    saveState(get());
  },

  buyMaterial: (materialId, qty, unitPrice) => {
    const state = get();
    const totalCost = unitPrice * qty;
    if (state.gold < totalCost) return;
    set({
      gold: state.gold - totalCost,
      materials: { ...state.materials, [materialId]: (state.materials[materialId] ?? 0) + qty },
    });
    saveState(get());
  },
  setMaterials: (m) => {
    set({ materials: m });
    saveState(get());
  },

  setSelectedPotion: (id) => {
    set({ selectedPotionId: id });
    saveState(get());
  },

  togglePotionAutoUse: () => {
    set(s => ({ potionAutoUse: !s.potionAutoUse }));
    saveState(get());
  },

  setPotionAutoThreshold: (pct) => {
    set({ potionAutoThreshold: Math.max(10, Math.min(90, pct)) });
    saveState(get());
  },

  togglePotionAutoBuy: () => {
    set(s => ({ potionAutoBuy: !s.potionAutoBuy }));
    saveState(get());
  },

  toggleGreenPotion: () => {
    set(s => ({ greenPotionEnabled: !s.greenPotionEnabled }));
    saveState(get());
  },

  toggleCouragePotion: () => {
    set(s => ({ couragePotionEnabled: !s.couragePotionEnabled }));
    saveState(get());
  },

  // ── Profile ──
  openProfile: (userId) => set({ viewingProfileId: userId }),
  closeProfile: () => set({ viewingProfileId: null }),

  // ── Offline Reward ──
  claimOfflineReward: () => {
    const state = get();
    const reward = state.offlineReward;
    if (!reward) return;

    const newMaterials = { ...state.materials };
    for (const [matId, qty] of Object.entries(reward.materials)) {
      newMaterials[matId] = (newMaterials[matId] ?? 0) + qty;
    }

    set({
      gold: state.gold + reward.gold,
      exp: state.exp + reward.exp,
      materials: newMaterials,
      offlineReward: null,
    });
    saveState(get());
  },

  dismissOfflineReward: () => set({ offlineReward: null }),
}));

// Dev: expose store for debugging (production 빌드에서는 제외)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).__gameStore = useGameStore;
}

// Re-export helpers for backward compatibility
export { equipStat, equipDisplayName, createEquipment } from './helpers';

// Re-export types for backward compatibility
export type { Equipment, QueueItem, LogEntry, ViewMode, ForgeTab, EnhanceResult } from '../types';
