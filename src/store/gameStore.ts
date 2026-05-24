/* =========================================================
   GAME STORE — Zustand (Composition Layer)
   각 액션 모듈에서 로직을 가져와 조합
   ========================================================= */
import { create } from 'zustand';
import { HUNT_ZONES } from '../data/gameData';
import { BASE_STATS, startingHp } from '../data/statFormulas';
import {
  loadState, saveState as _saveState, enforceEpochGate,
  createEquipment,
} from './helpers';
import {
  setSyncUserId, setStateGetter, setStoreSetter, markDirty,
  syncProfile, syncAllItems, syncMaterials, syncPotions,
  loadFromDB, flushNow,
} from '../lib/dbSync';
import { calcOfflineReward } from '../lib/db';
import { safeNumber } from '../lib/utils';
import type {
  Equipment, HuntSession, ScrollType,
  StatAllocation, ActiveBuff,
} from '../types';
import { getAvailableSkills, MAX_SKILL_SLOTS } from '../data/playerSkillData';

// ── 분리된 모듈 ──
import type { GameState } from './storeTypes';
import { createDerivedStats } from './derivedStats';
import { createHuntActions } from './huntActions';
import { createCombatTick } from './combatTick';
import { createEquipActions } from './equipActions';
import { createShopActions } from './shopActions';

// Re-export GameState for consumers
export type { GameState } from './storeTypes';

/** localStorage 저장 + DB 동기화 플래그 */
function saveState(state: Parameters<typeof _saveState>[0]) {
  _saveState(state);
  markDirty();
}

// ── Initial State ──
const saved = loadState();

const initialStatAllocation: StatAllocation = (saved?.statAllocation as StatAllocation) ?? {
  str: 0, dex: 0, con: 0, wis: 0, int: 0,
};
const initialCon = BASE_STATS.con + initialStatAllocation.con;
const initialMaxHp = (saved?.maxHp as number) ?? startingHp(initialCon);
const initialCurrentHp = (saved?.currentHp as number) ?? initialMaxHp;

export const useGameStore = create<GameState>((set, get) => ({
  // ── Auth ──
  authUserId: null,

  initFromDB: async (userId: string) => {
    enforceEpochGate();
    setSyncUserId(userId);
    setStateGetter(() => get() as unknown as Record<string, unknown>);
    setStoreSetter((partial) => set(partial as Partial<GameState>));

    const dbData = await loadFromDB();
    if (dbData && dbData.profile) {
      const p = dbData.profile as Record<string, any>;
      const dbItems = dbData.items as any[];
      const equipped: Record<string, Equipment | null> = {};
      const inv: Equipment[] = [];

      for (const row of dbItems) {
        const eq: Equipment = {
          uid: row.uid, templateId: row.template_id,
          name: row.name, type: row.type,
          baseAtk: row.base_atk, baseAtkLarge: row.base_atk_large,
          baseDef: row.base_def, enhanceLevel: row.enhance_level,
          safeEnchant: row.safe_enchant ?? ((['weapon','bow','staff'].includes(row.type)) ? 6 : 4),
          maxEnhance: row.max_enhance, bonuses: row.bonuses ?? {},
          bonusEffects: row.bonus_effects ?? [], sellPrice: row.sell_price,
          weight: row.weight ?? 0,
        };
        if (row.equipped && row.equipped_slot) equipped[row.equipped_slot] = eq;
        else inv.push(eq);
      }

      const hasDBItems = dbItems.length > 0;

      set({
        authUserId: userId,
        playerClass: (p.player_class as import('../types').PlayerClass) ?? get().playerClass,
        playerName: p.name ?? get().playerName,
        level: p.level ?? get().level,
        exp: safeNumber(p.exp, get().exp),
        gold: safeNumber(p.gold, get().gold),
        title: p.title ?? get().title,
        currentHp: p.current_hp ?? get().currentHp,
        maxHp: p.max_hp ?? get().maxHp,
        statAllocation: {
          str: p.stat_str ?? 0, dex: p.stat_dex ?? 0,
          con: p.stat_con ?? 0, wis: p.stat_wis ?? 0,
          int: p.stat_int ?? 0,
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
          equippedEarring: equipped['earring'] ?? null,
          inventory: inv,
        } : {}),
        materials: Object.keys(dbData.materials).length > 0 ? dbData.materials : get().materials,
        potions: Object.keys(dbData.potions).length > 0 ? dbData.potions : get().potions,
        selectedPotionId: p.selected_potion ?? get().selectedPotionId,
        potionAutoUse: p.potion_auto_use ?? get().potionAutoUse,
        potionAutoThreshold: p.potion_auto_threshold ?? get().potionAutoThreshold,
        potionAutoBuy: p.potion_auto_buy ?? get().potionAutoBuy,
      });

      if (!hasDBItems) {
        const s = get();
        syncAllItems(s.inventory, {
          equippedWeapon: s.equippedWeapon, equippedTshirt: s.equippedTshirt,
          equippedArmor: s.equippedArmor, equippedHelmet: s.equippedHelmet,
          equippedCloak: s.equippedCloak, equippedGloves: s.equippedGloves,
          equippedBoots: s.equippedBoots, equippedShield: s.equippedShield,
          equippedNecklace: s.equippedNecklace, equippedRing: s.equippedRing,
          equippedRing2: s.equippedRing2, equippedBelt: s.equippedBelt,
          equippedEarring: s.equippedEarring,
        });
        syncMaterials(s.materials);
        syncPotions(s.potions);
        syncProfile(s as any);
      }
    } else {
      // DB에 프로필이 없음 — CharacterCreateScreen에서 생성 후 진입하므로
      // 여기 도달하면 프로필이 방금 생성된 직후
      const { supabase } = await import('../lib/supabase');
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, player_class')
        .eq('id', userId)
        .maybeSingle();

      const metaName = profile?.name ?? '모험가';
      const metaClass = (profile?.player_class as import('../types').PlayerClass) ?? 'knight';

      if (!profile) {
        await supabase.from('profiles').upsert({
          id: userId, name: metaName,
        }, { onConflict: 'id' });
      }

      set({ authUserId: userId, playerName: metaName, playerClass: metaClass });
      const s = get();
      syncAllItems(s.inventory, {
        equippedWeapon: s.equippedWeapon, equippedTshirt: s.equippedTshirt,
        equippedArmor: s.equippedArmor, equippedHelmet: s.equippedHelmet,
        equippedCloak: s.equippedCloak, equippedGloves: s.equippedGloves,
        equippedBoots: s.equippedBoots, equippedShield: s.equippedShield,
        equippedNecklace: s.equippedNecklace, equippedRing: s.equippedRing,
        equippedRing2: s.equippedRing2, equippedBelt: s.equippedBelt,
        equippedEarring: s.equippedEarring,
      });
      syncMaterials(s.materials);
      syncPotions(s.potions);
    }

    // 오프라인 보상
    if (dbData?.profile) {
      const p = dbData.profile as Record<string, any>;
      const lastZoneId = p.last_zone_id as string | null;
      const lastActiveAt = p.last_active_at as string;
      const zone = lastZoneId ? HUNT_ZONES.find(z => z.id === lastZoneId) : null;
      const s = get();
      const reward = calcOfflineReward(
        lastActiveAt, lastZoneId,
        zone ? { name: zone.name, monsters: zone.monsters, dropMaterials: zone.dropMaterials } : null,
        {
          potions: s.potions,
          selectedPotionId: s.selectedPotionId,
          potionAutoUse: s.potionAutoUse,
          greenPotionEnabled: s.greenPotionEnabled,
          couragePotionEnabled: s.couragePotionEnabled,
          transformScrollEnabled: s.transformScrollEnabled,
          transformScrollType: s.transformScrollType,
          materials: s.materials,
          level: s.level,
        },
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

  // ── Player State ──
  playerClass: (saved?.playerClass as import('../types').PlayerClass) ?? 'knight',
  playerName: (saved?.playerName as string) ?? '초보 모험가',
  level: (saved?.level as number) ?? 1,
  exp: (saved?.exp as number) ?? 0,
  gold: (saved?.gold as number) ?? 100,
  title: (saved?.title as string) ?? '뉴비',

  statAllocation: initialStatAllocation,
  maxHp: initialMaxHp,
  currentHp: initialCurrentHp,
  maxMp: (saved?.maxMp as number) ?? 16,
  currentMp: (saved?.currentMp as number) ?? 16,

  // ── Equipment ──
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
  equippedEarring: (saved?.equippedEarring as Equipment) ?? null,

  // ── Inventory ──
  inventory: (saved?.inventory as Equipment[]) ?? [],
  inventoryCapacity: 100,
  materials: (saved?.materials as Record<string, number>) ?? {},

  // ── Hunt ──
  hunt: (() => {
    const h = saved?.hunt as any;
    if (!h) return {
      zoneId: null, status: 'idle', currentRoom: 1,
      roomKills: 0, roomCleared: 0, kills: 0,
      goldGained: 0, materialsGained: {}, itemsFound: 0,
      avgKillTime: 0, currentFightTicks: 0, fightStartedAt: 0,
      startedAt: 0, currentTargetId: null, monsterCurrentHp: 0,
      joinedMonsters: [], approachingMonsters: [],
      mobSkillCooldowns: {}, lastMagicHitAt: 0, consecutiveMagicHits: 0,
      hpRegenPoint: 0, currentMp: 0, mpRegenPoint: 0, skillCooldowns: {}, monsterStunnedTicks: 0, windShackleTicks: 0,
    } as HuntSession;
    return {
      ...h,
      currentRoom: h.currentRoom ?? 1,
      roomKills: h.roomKills ?? 0,
      roomCleared: h.roomCleared ?? 0,
      mobSkillCooldowns: h.mobSkillCooldowns ?? {},
      lastMagicHitAt: h.lastMagicHitAt ?? 0,
      consecutiveMagicHits: h.consecutiveMagicHits ?? 0,
      currentMp: h.currentMp ?? 0,
      skillCooldowns: h.skillCooldowns ?? {},
      monsterStunnedTicks: h.monsterStunnedTicks ?? 0,
      windShackleTicks: h.windShackleTicks ?? 0,
    } as HuntSession;
  })(),
  combatLog: [],
  zonePlayerCount: 1,

  // ── Queue ──
  queue: (saved?.queue as any[]) ?? [],
  queueCapacity: (saved?.queueCapacity as number) ?? 6,

  // ── Potions ──
  potions: (saved?.potions as Record<string, number>) ?? { red_potion: 300, green_potion: 50, blue_potion: 50 },
  selectedPotionId: (saved?.selectedPotionId as string) ?? 'red_potion',
  potionAutoUse: (saved?.potionAutoUse as boolean) ?? true,
  potionAutoThreshold: (saved?.potionAutoThreshold as number) ?? 50,
  potionAutoBuy: (saved?.potionAutoBuy as boolean) ?? true,
  lastPotionUsedAt: 0,
  bluePotionEnabled: (saved?.bluePotionEnabled as boolean) ?? true,

  // ── Skills ──
  equippedSkills: (saved?.equippedSkills as number[]) ?? [],
  disabledSkills: (saved?.disabledSkills as number[]) ?? [],

  // ── Buffs ──
  activeBuffs: (saved?.activeBuffs as ActiveBuff[]) ?? [],
  greenPotionEnabled: (saved?.greenPotionEnabled as boolean) ?? true,
  couragePotionEnabled: (saved?.couragePotionEnabled as boolean) ?? true,
  transformScrollEnabled: (saved?.transformScrollEnabled as boolean) ?? true,
  transformScrollType: (saved?.transformScrollType as 'normal' | 'event') ?? 'normal',

  // ── Movement ──
  isPlayerMoving: false,
  setPlayerMoving: (moving) => set({ isPlayerMoving: moving }),

  // ── UI ──
  viewMode: 'main',
  enhanceResult: null,
  enhanceTargetUid: null,
  enhanceAnim: null,
  enhanceScrollType: 'normal' as ScrollType,
  viewingProfileId: null,
  offlineReward: null,

  setViewMode: (mode) => set({ viewMode: mode, viewingProfileId: null }),

  // ── Profile ──
  openProfile: (userId) => set({ viewingProfileId: userId }),
  closeProfile: () => set({ viewingProfileId: null }),

  // ── Offline Reward ──
  claimOfflineReward: () => {
    const state = get();
    const reward = state.offlineReward;
    if (!reward) return;
    const newMaterials = { ...state.materials };
    const newPotions = { ...state.potions };

    // 획득 재료 추가
    for (const [matId, qty] of Object.entries(reward.materials)) {
      newMaterials[matId] = (newMaterials[matId] ?? 0) + qty;
    }
    // 소모 물약 차감
    for (const [pid, qty] of Object.entries(reward.potionsUsed)) {
      newPotions[pid] = Math.max(0, (newPotions[pid] ?? 0) - qty);
    }
    // 소모 주문서 차감 (materials에서)
    for (const [sid, qty] of Object.entries(reward.scrollsUsed)) {
      newMaterials[sid] = Math.max(0, (newMaterials[sid] ?? 0) - qty);
    }

    set({
      gold: state.gold + reward.gold,
      exp: state.exp + reward.exp,
      materials: newMaterials,
      potions: newPotions,
      offlineReward: null,
    });
    saveState(get());
    void flushNow(); // 즉시 DB 동기화 → last_active_at 갱신 (재접속 시 중복 보상 방지)
  },
  dismissOfflineReward: () => set({ offlineReward: null }),

  // ── Skill Actions ──
  equipSkill: (skillId: number, slotIndex: number) => {
    const state = get();
    const maxSlots = MAX_SKILL_SLOTS;
    if (slotIndex < 0 || slotIndex >= maxSlots) return;
    const available = getAvailableSkills(state.playerClass, state.level);
    if (!available.find(s => s.id === skillId)) return;
    const newSlots = [...state.equippedSkills];
    // 패딩: 슬롯 배열이 짧으면 0으로 채움
    while (newSlots.length < maxSlots) newSlots.push(0);
    // 이미 다른 슬롯에 있으면 제거 (중복 방지)
    const existIdx = newSlots.indexOf(skillId);
    if (existIdx !== -1) newSlots[existIdx] = 0;
    newSlots[slotIndex] = skillId;
    set({ equippedSkills: newSlots });
    saveState(get());
  },

  unequipSkill: (slotIndex: number) => {
    const state = get();
    const newSlots = [...state.equippedSkills];
    if (slotIndex < 0 || slotIndex >= newSlots.length) return;
    newSlots[slotIndex] = 0;
    set({ equippedSkills: newSlots });
    saveState(get());
  },

  autoEquipSkills: () => {
    const state = get();
    const maxSlots = MAX_SKILL_SLOTS;
    const available = getAvailableSkills(state.playerClass, state.level);
    // 우선순위: 버프 → 힐 → 공격(높은 서클 우선) → 클래스 전용
    const buffs = available.filter(s => s.skillType === 'buff').sort((a, b) => b.skillCircle - a.skillCircle);
    const heals = available.filter(s => s.skillType === 'heal').sort((a, b) => b.skillCircle - a.skillCircle);
    const attacks = available.filter(s => s.skillType === 'attack').sort((a, b) => b.skillCircle - a.skillCircle);
    const ordered = [...buffs, ...heals, ...attacks];
    const newSlots: number[] = [];
    const used = new Set<number>();
    for (const skill of ordered) {
      if (newSlots.length >= maxSlots) break;
      if (used.has(skill.id)) continue;
      newSlots.push(skill.id);
      used.add(skill.id);
    }
    while (newSlots.length < maxSlots) newSlots.push(0);
    set({ equippedSkills: newSlots, disabledSkills: [] });
    saveState(get());
  },

  toggleSkillEnabled: (skillId: number) => {
    const state = get();
    const disabled = [...(state.disabledSkills ?? [])];
    const idx = disabled.indexOf(skillId);
    if (idx === -1) {
      disabled.push(skillId);
    } else {
      disabled.splice(idx, 1);
    }
    set({ disabledSkills: disabled });
    saveState(get());
  },

  // ── Composed Actions ──
  ...createDerivedStats(get),
  ...createHuntActions(set, get, saveState),
  ...createCombatTick(set, get, saveState),
  ...createEquipActions(set, get, saveState),
  ...createShopActions(set, get, saveState),
}));

// Dev: expose store for debugging
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).__gameStore = useGameStore;
}

// Re-exports for backward compatibility
export { equipStat, equipDisplayName, createEquipment } from './helpers';
export type { Equipment, QueueItem } from '../types';
