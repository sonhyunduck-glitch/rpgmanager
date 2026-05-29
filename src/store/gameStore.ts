/* =========================================================
   GAME STORE — Zustand (Composition Layer)
   각 액션 모듈에서 로직을 가져와 조합
   ========================================================= */
import { create } from 'zustand';
import { HUNT_ZONES, getBravePotionId, getMonstersForRoom, POTIONS } from '../data/gameData';
import { BASE_STATS, startingHp } from '../data/statFormulas';
import {
  loadState, saveState as _saveState, enforceEpochGate,
  createEquipment, STORAGE_KEY,
} from './helpers';
import {
  setSyncUserId, setStateGetter, setStoreSetter, markDirty,
  syncProfile, syncAllItems, syncMaterials, syncPotions,
  loadFromDB, flushNow, stampLastActive,
} from '../lib/dbSync';
import { calcOfflineReward } from '../lib/db';
import { getMonsterDrops } from '../data/dropData';
import { safeNumber } from '../lib/utils';
import type {
  Equipment, HuntSession, ScrollType,
  StatAllocation, ActiveBuff,
} from '../types';
import { getAvailableSkills, MAX_SKILL_SLOTS, PLAYER_SKILLS } from '../data/playerSkillData';
import { CLASS_CONFIGS, getClassCombatStyle } from '../data/classData';

// ── 분리된 모듈 ──
import type { GameState } from './storeTypes';
import { createDerivedStats } from './derivedStats';
import { createHuntActions } from './huntActions';
import { createCombatTick } from './combatTick';
import { createEquipActions } from './equipActions';
import { createShopActions } from './shopActions';
import {
  createEmptySpatialState, initHuntSpatialState, tickSpatialUpdate,
  findAggroMonstersInRange, distance,
  PLAYER_MOVE_SPEED, AGGRO_RANGE_M,
} from './spatialEngine';

// Re-export GameState for consumers
export type { GameState } from './storeTypes';

/** 클래스별 초기 물약 지급 */
function getStartingPotions(playerClass: import('../types').PlayerClass): Record<string, number> {
  return {
    red_potion: 300, green_potion: 50, blue_potion: 50,
    [getBravePotionId(playerClass)]: 50,
  };
}

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
  dbReady: false,

  initFromDB: async (userId: string) => {
    enforceEpochGate();

    // ⚠️ setSyncUserId는 DB 로드 완료 후 호출 (레이스 컨디션 방지)
    //    타이머를 여기서 시작하면 DB 로드 전에 구 데이터가 flush될 위험
    setStateGetter(() => get() as unknown as Record<string, unknown>);
    setStoreSetter((partial) => set(partial as Partial<GameState>));

    // DB 로드 전에 userId만 등록 (loadFromDB 내부에서 _userId 필요)
    setSyncUserId(userId, true);  // skipTimer=true: 타이머 시작하지 않음

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
        if (row.is_two_handed) eq.isTwoHanded = true;
        if (row.equipped && row.equipped_slot) equipped[row.equipped_slot] = eq;
        else inv.push(eq);
      }

      const hasDBItems = dbItems.length > 0;
      const dbPlayerClass = (p.player_class as import('../types').PlayerClass) ?? 'knight';

      // ⚠️ 진행 데이터: localStorage vs DB 중 더 진행된 값 사용
      //    이유: beforeunload에서 flushNow()는 비동기 fire-and-forget이라
      //    새로고침/탭 닫기 시 DB 저장이 미완료될 수 있음.
      //    localStorage는 동기 저장이므로 항상 최신.
      //    level/exp/maxHp는 단조 증가 → Math.max 안전.
      //    gold/currentHp는 감소 가능하지만 localStorage가 더 최신이므로 우선.
      const dbLevel = p.level ?? 1;
      const lsLevel = safeNumber(saved?.level, 0);
      const mergedLevel = Math.max(dbLevel, lsLevel);

      const dbExp = safeNumber(p.exp, 0);
      const lsExp = safeNumber(saved?.exp, 0);
      // 같은 레벨이면 exp도 max, 레벨이 다르면 높은 레벨 쪽 exp 사용
      const mergedExp = mergedLevel > dbLevel ? lsExp
        : mergedLevel > lsLevel ? dbExp
        : Math.max(dbExp, lsExp);

      const dbGold = safeNumber(p.gold, 0);
      const lsGold = safeNumber(saved?.gold, 0);
      // gold는 감소 가능(상점 구매) — 레벨이 localStorage가 더 높으면 localStorage 우선
      const mergedGold = mergedLevel > dbLevel ? lsGold : dbGold;

      const dbMaxHp = p.max_hp ?? startingHp(BASE_STATS.con);
      const lsMaxHp = safeNumber(saved?.maxHp, 0);
      const mergedMaxHp = Math.max(dbMaxHp, lsMaxHp);

      const dbCurrentHp = p.current_hp ?? mergedMaxHp;
      const lsCurrentHp = safeNumber(saved?.currentHp, 0);
      // currentHp: 레벨이 localStorage가 더 높으면 localStorage 우선
      const mergedCurrentHp = mergedLevel > dbLevel
        ? Math.min(lsCurrentHp, mergedMaxHp)
        : Math.min(dbCurrentHp, mergedMaxHp);

      // 스탯 할당: 레벨이 localStorage가 더 높으면 localStorage 우선
      const lsStats = saved?.statAllocation as StatAllocation | undefined;
      const mergedStats = (mergedLevel > dbLevel && lsStats)
        ? lsStats
        : {
            str: p.stat_str ?? 0, dex: p.stat_dex ?? 0,
            con: p.stat_con ?? 0, wis: p.stat_wis ?? 0,
            int: p.stat_int ?? 0,
          };

      set({
        authUserId: userId,
        playerClass: dbPlayerClass,
        subclass: (p.subclass as import('../types').KnightSubclass) ?? null,
        pendingSubclassChoice: false,
        playerName: p.name ?? '모험가',
        guildId: p.guild_id ?? null,
        level: mergedLevel,
        exp: mergedExp,
        gold: mergedGold,
        title: p.title ?? '뉴비',
        currentHp: mergedCurrentHp,
        maxHp: mergedMaxHp,
        statAllocation: mergedStats,
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
        // ⚠️ DB가 진실 — 빈 객체도 그대로 사용 (재료/포션 0개 = 정당한 상태)
        materials: dbData.materials,
        potions: Object.keys(dbData.potions).length > 0 ? dbData.potions : getStartingPotions(dbPlayerClass),
        // ⚠️ 물약 설정: localStorage → DB → 기본값 순서 (localStorage 우선!)
        //    이유: beforeunload 시 DB flush가 미완료될 수 있어 DB 값이 구 값일 수 있음.
        //    localStorage는 동기 저장이므로 항상 최신. DB 무효값('red_s' 등)도 자동 폴백.
        selectedPotionId: (saved?.selectedPotionId && POTIONS[saved.selectedPotionId as string])
          ? (saved.selectedPotionId as string)
          : (p.selected_potion && POTIONS[p.selected_potion])
            ? p.selected_potion
            : 'red_potion',
        potionAutoUse: saved?.potionAutoUse != null ? (saved.potionAutoUse as boolean) : (p.potion_auto_use ?? true),
        potionAutoThreshold: saved?.potionAutoThreshold != null ? (saved.potionAutoThreshold as number) : (p.potion_auto_threshold ?? 50),
        potionAutoBuy: saved?.potionAutoBuy != null ? (saved.potionAutoBuy as boolean) : (p.potion_auto_buy ?? true),
      });

      // 길드 이름 비동기 로드
      if (p.guild_id) {
        import('../lib/guild').then(({ getGuild }) =>
          getGuild(p.guild_id).then(g => set({ guildName: g?.name ?? null }))
        ).catch(() => {});
      }

      if (!hasDBItems) {
        // ⚠️ DB에 아이템이 없는 신규 캐릭터 — 클래스별 시작 장비 생성
        // localStorage에 이전 계정 장비가 남아 있을 수 있으므로 반드시 새로 생성
        const gear = CLASS_CONFIGS[dbPlayerClass].startingGear;
        const freshWeapon = createEquipment(gear.weapon);
        const freshArmor = gear.armor ? createEquipment(gear.armor) : null;
        const freshHelmet = gear.helmet ? createEquipment(gear.helmet) : null;
        const freshShield = gear.shield ? createEquipment(gear.shield) : null;

        set({
          equippedWeapon: freshWeapon,
          equippedArmor: freshArmor,
          equippedHelmet: freshHelmet,
          equippedShield: freshShield,
          equippedTshirt: null, equippedCloak: null,
          equippedGloves: null, equippedBoots: null,
          equippedNecklace: null, equippedRing: null,
          equippedRing2: null, equippedBelt: null,
          equippedEarring: null,
          inventory: [],
          materials: {},
          potions: getStartingPotions(dbPlayerClass),
        });

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

      // ⚠️ 클래스별 시작 장비로 초기화 — localStorage 잔존 데이터 사용 금지
      const gear = CLASS_CONFIGS[metaClass].startingGear;
      const freshWeapon = createEquipment(gear.weapon);
      const freshArmor = gear.armor ? createEquipment(gear.armor) : null;
      const freshHelmet = gear.helmet ? createEquipment(gear.helmet) : null;
      const freshShield = gear.shield ? createEquipment(gear.shield) : null;

      set({
        authUserId: userId, playerName: metaName, playerClass: metaClass,
        subclass: null, pendingSubclassChoice: false,
        equippedWeapon: freshWeapon, equippedArmor: freshArmor,
        equippedHelmet: freshHelmet, equippedShield: freshShield,
        equippedTshirt: null, equippedCloak: null,
        equippedGloves: null, equippedBoots: null,
        equippedNecklace: null, equippedRing: null,
        equippedRing2: null, equippedBelt: null,
        equippedEarring: null,
        inventory: [], materials: {},
        potions: getStartingPotions(metaClass),
      });

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
    // ⚠️ 버전 업데이트 직후 리로드인지 확인 (2분 이내면 오프라인 보상 스킵)
    //    업데이트 시 forceUpdate()가 flushNow()로 last_active_at를 갱신하지만,
    //    Supabase 읽기 복제 지연으로 loadFromDB()가 구 값을 읽을 수 있음 → 중복 보상 방지
    const versionUpdateAt = (saved as Record<string, unknown> | null)?._versionUpdateAt as number | undefined;
    const isRecentVersionUpdate = versionUpdateAt && (Date.now() - versionUpdateAt < 120_000);

    // 1) localStorage에 미수령 보상이 있으면 그것을 복원 (stampLastActive 이후 새로고침 케이스)
    const cachedReward = saved?.offlineReward as import('../lib/db').OfflineReward | null;
    if (cachedReward && cachedReward.kills > 0) {
      set({ offlineReward: cachedReward });
    } else if (dbData?.profile && !isRecentVersionUpdate) {
      // 2) 캐시 없으면 DB last_active_at 기반으로 새로 계산
      //    ⚠️ 버전 업데이트 직후면 스킵 (중복 보상 방지)
      const p = dbData.profile as Record<string, any>;
      // ⚠️ localStorage의 hunt.zoneId를 우선 사용 (모바일 화면 잠금 → 탭 킬 시
      //    DB last_zone_id가 이전 동기화 시점의 존일 수 있음)
      const savedZoneId = (saved as Record<string, any>)?.hunt?.zoneId as string | undefined;
      const lastZoneId = savedZoneId || (p.last_zone_id as string | null);
      const lastActiveAt = p.last_active_at as string;
      const zone = lastZoneId ? HUNT_ZONES.find(z => z.id === lastZoneId) : null;
      const s = get();
      const reward = calcOfflineReward(
        lastActiveAt, lastZoneId,
        zone ? {
          name: zone.name,
          monsters: zone.monsters,
          dropMaterials: zone.dropMaterials,
          monsterDrops: Object.fromEntries(zone.monsters.map(m => [m.id, getMonsterDrops(m.id)])),
        } : null,
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
      if (reward) {
        set({ offlineReward: reward });
        // ⚠️ 즉시 last_active_at 갱신 — 새로고침 시 중복 보상 방지
        //    보상은 localStorage + offlineReward 상태에 보관되어 있으므로
        //    수령 전 새로고침해도 DB 재계산 되지 않고 캐시에서 복원
        stampLastActive(userId).catch(() => {});
      }
    }

    set({ dbReady: true });

    // ⚠️ localStorage 캐시 갱신
    _saveState(get());

    // ⚠️ localStorage 값이 DB보다 진행됐으면 즉시 DB 동기화
    //    (이전 세션에서 flushNow()가 미완료된 경우 복구)
    if (dbData?.profile) {
      const pp = dbData.profile as Record<string, any>;
      const s = get();
      if (s.level > (pp.level ?? 0) || s.exp > safeNumber(pp.exp, 0) || s.gold !== safeNumber(pp.gold, 0)) {
        markDirty();
      }
    }

    // ⚠️ 30초 동기화 타이머를 DB 로드 완료 후에 시작
    //    이제 Zustand에 DB 데이터가 반영된 상태이므로 안전
    setSyncUserId(userId);
  },

  logout: async () => {
    await flushNow();
    setSyncUserId(null);
    // 로그아웃 시 localStorage 삭제 — 다른 계정 로그인 시 장비 복사 방지
    localStorage.removeItem(STORAGE_KEY);
    // ⚠️ Zustand 전체 리셋 — 메모리에 이전 계정 데이터 잔존 방지
    //    authUserId만 null로 하면 다음 계정 로그인 시 get() 폴백에서 이전 계정 값 참조
    set({
      authUserId: null,
      dbReady: false,
      playerClass: 'knight',
      subclass: null,
      pendingSubclassChoice: false,
      playerName: '초보 모험가',
      guildId: null,
      guildName: null,
      level: 1,
      exp: 0,
      gold: 0,
      title: '뉴비',
      statAllocation: { str: 0, dex: 0, con: 0, wis: 0, int: 0 },
      maxHp: startingHp(BASE_STATS.con),
      currentHp: startingHp(BASE_STATS.con),
      maxMp: 16,
      currentMp: 16,
      equippedWeapon: null,
      equippedTshirt: null,
      equippedArmor: null,
      equippedHelmet: null,
      equippedCloak: null,
      equippedGloves: null,
      equippedBoots: null,
      equippedShield: null,
      equippedNecklace: null,
      equippedRing: null,
      equippedRing2: null,
      equippedBelt: null,
      equippedEarring: null,
      inventory: [],
      materials: {},
      potions: {},
      queue: [],
      combatLog: [],
      activeBuffs: [],
      equippedSkills: [],
      disabledSkills: [],
      hunt: {
        zoneId: null, status: 'idle', currentRoom: 1,
        roomKills: 0, roomCleared: 0, kills: 0,
        goldGained: 0, materialsGained: {}, itemsFound: 0,
        avgKillTime: 0, currentFightTicks: 0, fightStartedAt: 0,
        startedAt: 0, currentTargetId: null, monsterCurrentHp: 0,
        joinedMonsters: [], approachingMonsters: [],
        mobSkillCooldowns: {}, lastMagicHitAt: 0, consecutiveMagicHits: 0,
        currentMp: 0, lastHpRegenAt: 0, lastMpRegenAt: 0, skillCooldowns: {},
        monsterStunnedTicks: 0, windShackleTicks: 0, regenWaitTicks: 0,
        monsterAtkAccum: 0,
        spatial: createEmptySpatialState(),
        playerEntityId: 'player',
        targetEntityId: null,
      } as HuntSession,
      offlineReward: null,
      viewMode: 'main',
      viewingProfileId: null,
    });
  },

  // ── Player State ──
  playerClass: (saved?.playerClass as import('../types').PlayerClass) ?? 'knight',
  subclass: (saved?.subclass as import('../types').KnightSubclass) ?? null,
  pendingSubclassChoice: false,
  playerName: (saved?.playerName as string) ?? '초보 모험가',
  guildId: null,
  guildName: null,
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
      currentMp: 0, lastHpRegenAt: 0, lastMpRegenAt: 0, skillCooldowns: {},
      monsterStunnedTicks: 0, windShackleTicks: 0, regenWaitTicks: 0, monsterAtkAccum: 0,
      spatial: createEmptySpatialState(),
      playerEntityId: 'player',
      targetEntityId: null,
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
      regenWaitTicks: h.regenWaitTicks ?? 0,
      monsterAtkAccum: h.monsterAtkAccum ?? 0,
      // 공간 상태 (Map은 JSON 직렬화 불가 — 항상 새로 생성)
      // hunting 중 재접속이면 몬스터 엔티티 배치 필요
      spatial: (() => {
        if (h.status === 'hunting' && h.zoneId) {
          const z = HUNT_ZONES.find(z => z.id === h.zoneId);
          if (z) {
            const room = h.currentRoom ?? 1;
            const tm = getMonstersForRoom(z, room);
            const pc = (saved?.playerClass as string) ?? 'knight';
            const cs = getClassCombatStyle(pc as import('../types').PlayerClass);
            const vis = Math.max(1, 15);
            return initHuntSpatialState(tm.map(m => m.id), vis, cs, PLAYER_MOVE_SPEED);
          }
        }
        return createEmptySpatialState();
      })(),
      playerEntityId: 'player',
      targetEntityId: null,
    } as HuntSession;
  })(),
  combatLog: [],
  zonePlayerCount: 1,
  zonePlayers: [],

  // ── Queue ──
  queue: (saved?.queue as any[]) ?? [],
  queueCapacity: (saved?.queueCapacity as number) ?? 6,

  // ── Potions ──
  potions: (saved?.potions as Record<string, number>) ?? getStartingPotions((saved?.playerClass as import('../types').PlayerClass) ?? 'knight'),
  selectedPotionId: (saved?.selectedPotionId as string) ?? 'red_potion',
  potionAutoUse: (saved?.potionAutoUse as boolean) ?? true,
  potionAutoThreshold: (saved?.potionAutoThreshold as number) ?? 50,
  potionAutoBuy: (saved?.potionAutoBuy as boolean) ?? true,
  lastPotionUsedAt: 0,
  lastPotionCooldownMs: 0,
  bluePotionEnabled: (saved?.bluePotionEnabled as boolean) ?? true,

  // ── Skills ──
  equippedSkills: (saved?.equippedSkills as number[]) ?? [],
  disabledSkills: (saved?.disabledSkills as number[]) ?? [],
  skillMpThreshold: (saved?.skillMpThreshold as number) ?? 0,

  // ── Buffs ──
  activeBuffs: (saved?.activeBuffs as ActiveBuff[]) ?? [],
  greenPotionEnabled: (saved?.greenPotionEnabled as boolean) ?? true,
  couragePotionEnabled: (saved?.couragePotionEnabled as boolean) ?? true,
  transformScrollEnabled: (saved?.transformScrollEnabled as boolean) ?? true,
  transformScrollType: (saved?.transformScrollType as 'normal' | 'event') ?? 'normal',

  // ── Spatial Combat ──
  consumeCombatEvents: () => {
    const hunt = get().hunt;
    if (hunt.spatial.combatEvents.length === 0) return;
    set({
      hunt: {
        ...hunt,
        spatial: {
          ...hunt.spatial,
          combatEvents: [],
        },
      },
    });
  },

  /* 고빈도 공간 업데이트 (60ms 간격)
     — 이동 + 투사체 보간
     — 선공 몬스터 실시간 감지 + 동족인식 */
  tickSpatial: () => {
    const state = get();
    const { hunt } = state;
    if (hunt.status !== 'hunting' || !hunt.zoneId) return;

    const now = Date.now();
    const deltaSec = 0.06; // 60ms 고정
    const hasSpatialWork = hunt.spatial.moveOrders.size > 0 || hunt.spatial.projectiles.length > 0;

    // ── 1. 공간 업데이트 (이동/투사체가 있을 때만) ──
    let entities = hunt.spatial.entities;
    let projectiles = hunt.spatial.projectiles;
    let moveOrders = hunt.spatial.moveOrders;
    let combatEvents = hunt.spatial.combatEvents;

    // 리스폰 시 랜덤 몬스터 종류 결정용
    const _zone = HUNT_ZONES.find(z => z.id === hunt.zoneId);
    let _roomMonsters = _zone ? getMonstersForRoom(_zone, hunt.currentRoom ?? 1) : [];
    if (_roomMonsters.length === 0 && _zone) _roomMonsters = _zone.monsters;
    const _monsterIds = _roomMonsters.map(m => m.id);

    if (hasSpatialWork) {
      // ⚠️ 선공 몬스터 실시간 추적: 접근 중인 몬스터의 목적지를 플레이어 현재 위치로 갱신
      //    기존: 어그로 시점의 플레이어 위치 스냅샷 → 플레이어 이동 시 빗나감
      //    변경: 매 틱 플레이어 현재 좌표로 destination 갱신 → 실시간 추적
      let spatialInput = hunt.spatial;
      const pEnt = hunt.spatial.entities.get('player');
      if (pEnt) {
        const updatedOrders = new Map(spatialInput.moveOrders);
        let changed = false;
        for (const [entityId, order] of updatedOrders) {
          if (entityId === 'player' || order.onArrival !== 'join') continue;
          if (order.destination.x !== pEnt.pos.x || order.destination.y !== pEnt.pos.y) {
            updatedOrders.set(entityId, { ...order, destination: { ...pEnt.pos } });
            changed = true;
          }
        }
        if (changed) spatialInput = { ...spatialInput, moveOrders: updatedOrders };
      }
      const result = tickSpatialUpdate(spatialInput, deltaSec, now, _monsterIds);
      entities = result.entities;
      projectiles = result.projectiles;
      moveOrders = result.moveOrders;
      combatEvents = [...hunt.spatial.combatEvents, ...result.combatEvents];
    }

    // ── 2. 선공 몬스터 실시간 감지 + 동족인식 ──
    let approachingChanged = false;
    let newApproaching = hunt.approachingMonsters ?? [];
    const currentJoined = hunt.joinedMonsters ?? [];

    const playerEnt = entities.get('player');
    if (playerEnt && state.currentHp > 0
      && newApproaching.length + currentJoined.length < 5) {
      const zone = _zone;
      if (zone) {
        const monsters = _roomMonsters;

        // 이미 전투/이동 중인 엔티티 ID 제외
        const excludeIds = new Set<string>();
        if (hunt.targetEntityId) excludeIds.add(hunt.targetEntityId);
        for (const [eid] of moveOrders) {
          if (eid !== 'player') excludeIds.add(eid);
        }
        // 이미 접근 중인 몬스터 엔티티도 제외
        for (const [entId, entity] of entities) {
          if (entity.type !== 'monster' || !entity.alive) continue;
          if (!entity.monsterId) continue;
          if (newApproaching.some(ap => ap.monsterId === entity.monsterId
            && moveOrders.has(entId))) {
            excludeIds.add(entId);
          }
        }
        // 이미 플레이어 근처에 있는 몬스터 = 합류 완료 (재접근 불필요)
        // 합류 몬스터는 플레이어 위치에 도착한 상태이므로 거리 ~0.
        // 리스폰 몬스터는 10m+ 떨어져 있으므로 영향 없음.
        for (const [entId, entity] of entities) {
          if (entity.type !== 'monster' || !entity.alive) continue;
          if (excludeIds.has(entId)) continue;
          if (distance(entity.pos, playerEnt.pos) < 1.5) {
            excludeIds.add(entId);
          }
        }

        // ⭐ 동족인식 우선! (B)→(A) 순서로 처리
        // 동족인식 같은 이름 몬스터가 먼저 슬롯을 차지해야
        // 근접 감지의 다른 이름 몬스터에 밀리지 않음

        // (B) 동족인식: 현재 타겟이 선공이면, 같은 이름 선공 몬스터 (거리 무관, 최우선)
        const aggroIds: string[] = [];
        if (hunt.currentTargetId) {
          const targetMon = monsters.find(m => m.id === hunt.currentTargetId)
            ?? zone.monsters.find(m => m.id === hunt.currentTargetId);
          if (targetMon?.aggressive) {
            for (const [entId, entity] of entities) {
              if (entity.type !== 'monster' || !entity.alive) continue;
              if (excludeIds.has(entId)) continue;
              if (!entity.monsterId) continue;
              const m = monsters.find(x => x.id === entity.monsterId)
                ?? zone.monsters.find(x => x.id === entity.monsterId);
              if (!m?.aggressive || m.name !== targetMon.name) continue;
              aggroIds.push(entId);
            }
          }
        }

        // (A) 근접 감지: AGGRO_RANGE_M(5m) 이내 선공 몬스터 (동족인식 이후 나머지 슬롯)
        const proximityIds = findAggroMonstersInRange(
          entities, playerEnt.pos, AGGRO_RANGE_M, excludeIds,
          (entity) => {
            if (!entity.monsterId) return false;
            const m = monsters.find(x => x.id === entity.monsterId)
              ?? zone.monsters.find(x => x.id === entity.monsterId);
            return !!m?.aggressive;
          },
        );
        for (const pid of proximityIds) {
          if (!aggroIds.includes(pid)) aggroIds.push(pid);
        }

        // 새 접근 몬스터 추가 (상한 5까지)
        if (aggroIds.length > 0) {
          newApproaching = [...newApproaching];
          const newMoveOrders = new Map(moveOrders);
          for (const entityId of aggroIds) {
            if (newApproaching.length + currentJoined.length >= 5) break;
            const entity = entities.get(entityId);
            if (!entity?.monsterId) continue;
            const m = monsters.find(x => x.id === entity.monsterId)
              ?? zone.monsters.find(x => x.id === entity.monsterId);
            if (!m) continue;

            const dist = distance(entity.pos, playerEnt.pos);
            newApproaching.push({
              monsterId: m.id, hp: m.hp, distanceRemaining: dist,
            });
            newMoveOrders.set(entityId, {
              entityId,
              destination: { ...playerEnt.pos },
              speed: 1 / (m.moveSpeed || 1),
              stopDistance: 0,
              onArrival: 'join' as const,
            });
          }
          moveOrders = newMoveOrders;
          approachingChanged = true;
        }
      }
    }

    // ── 3. 변경사항 없으면 스킵 ──
    if (!hasSpatialWork && !approachingChanged) return;

    // ── 4. 상태 업데이트 ──
    set({
      hunt: {
        ...hunt,
        ...(approachingChanged ? { approachingMonsters: newApproaching } : {}),
        spatial: {
          ...hunt.spatial,
          entities,
          projectiles,
          moveOrders,
          combatEvents,
        },
      },
    });
  },

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
    // 획득 장비 추가 (인벤토리 용량 내)
    const newInventory = [...state.inventory];
    for (const item of (reward.items ?? [])) {
      if (newInventory.length >= state.inventoryCapacity) break;
      newInventory.push(createEquipment(item.templateId));
    }

    set({
      gold: state.gold + reward.gold,
      exp: state.exp + reward.exp,
      materials: newMaterials,
      potions: newPotions,
      inventory: newInventory,
      offlineReward: null,
    });
    saveState(get());
    void flushNow(); // 즉시 DB 동기화 → last_active_at 갱신 (재접속 시 중복 보상 방지)
  },
  dismissOfflineReward: () => {
    set({ offlineReward: null });
    _saveState(get());
  },

  // ── Skill Actions ──
  equipSkill: (skillId: number, slotIndex: number) => {
    const state = get();
    const maxSlots = MAX_SKILL_SLOTS;
    if (slotIndex < 0 || slotIndex >= maxSlots) return;
    const available = getAvailableSkills(state.playerClass, state.level, state.subclass);
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
    const available = getAvailableSkills(state.playerClass, state.level, state.subclass);
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

  setSkillMpThreshold: (pct: number) => {
    set({ skillMpThreshold: Math.max(0, Math.min(100, pct)) });
    saveState(get());
  },

  // ── Subclass Actions ──
  selectSubclass: (subclass: import('../types').KnightSubclass) => {
    const state = get();
    if (state.playerClass !== 'knight' || state.level < 30 || state.subclass) return;

    // 반대 서브클래스 스킬 제거
    const otherSkillIds = new Set(
      PLAYER_SKILLS
        .filter(s => s.subclassRestriction && s.subclassRestriction !== subclass)
        .map(s => s.id),
    );
    const newEquipped = state.equippedSkills.map(id => otherSkillIds.has(id) ? 0 : id);

    set({
      subclass,
      pendingSubclassChoice: false,
      equippedSkills: newEquipped,
    });
    saveState(get());
  },
  dismissSubclassChoice: () => set({ pendingSubclassChoice: false }),

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
