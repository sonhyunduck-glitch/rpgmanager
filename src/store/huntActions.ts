/* =========================================================
   HUNT ACTIONS — 사냥 생명주기 (시작/일시정지/부활/층 이동)
   ========================================================= */
import { HUNT_ZONES, getMonstersForRoom } from '../data/gameData';
import { getClassBaseStats } from '../data/classData';
import { getAvailableSkills, MAX_SKILL_SLOTS } from '../data/playerSkillData';
import { genLogId } from './helpers';
import { ROOMS_PER_ZONE } from './storeTypes';
import { upsertZonePresence, getZonePlayerCount, removeZonePresence } from '../lib/db';
import type { LogEntry } from '../types';
import type { GameState, SetState, GetState } from './storeTypes';

type SaveFn = (state: GameState) => void;

export function createHuntActions(set: SetState, get: GetState, save: SaveFn) {
  return {
    /** 방 이동 (클리어한 방 또는 다음 방으로) */
    moveToRoom: (room: number) => {
      const state = get();
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
      save(get());
    },

    /** 스탯 포인트 1 배분 */
    allocateStat: (stat: 'str' | 'dex' | 'con' | 'wis' | 'int') => {
      const state = get();
      const remaining = state.getRemainingPoints();
      if (remaining <= 0) return;

      const base = getClassBaseStats(state.playerClass);
      const oldCon = base.con + state.statAllocation.con;
      const newAllocation = { ...state.statAllocation, [stat]: state.statAllocation[stat] + 1 };
      const newCon = base.con + newAllocation.con;

      let newMaxHp = state.maxHp;
      if (stat === 'con' && newCon > oldCon) {
        newMaxHp += 1;
      }

      set({ statAllocation: newAllocation, maxHp: newMaxHp });
      save(get());

      // 레벨 1 + 모든 초기 스탯 배분 완료 → 훈련소 자동 입장
      const afterState = get();
      if (afterState.level === 1 && afterState.getRemainingPoints() <= 0 && afterState.hunt.status === 'idle') {
        afterState.startHunt('map_training');
      }
    },

    startHunt: (zoneId: string) => {
      const zone = HUNT_ZONES.find(z => z.id === zoneId);
      if (!zone) return;
      const state = get();
      if (state.currentHp <= 0) return;

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
          mobSkillCooldowns: {},
          lastMagicHitAt: 0,
          consecutiveMagicHits: 0,
          hpRegenPoint: 0,
          currentMp: 0,
          mpRegenPoint: 0,
          lastTickAt: Date.now(),
          skillCooldowns: {},
          monsterStunnedTicks: 0,
          windShackleTicks: 0,
        },
        combatLog: [entry],
      });

      // 스킬 슬롯 비어있으면 자동 배치
      const afterHunt = get();
      if (!afterHunt.equippedSkills || afterHunt.equippedSkills.filter(id => id > 0).length === 0) {
        const maxSlots = MAX_SKILL_SLOTS;
        const available = getAvailableSkills(afterHunt.playerClass, afterHunt.level);
        const buffs = available.filter(s => s.skillType === 'buff').sort((a, b) => b.skillCircle - a.skillCircle);
        const heals = available.filter(s => s.skillType === 'heal').sort((a, b) => b.skillCircle - a.skillCircle);
        const attacks = available.filter(s => s.skillType === 'attack').sort((a, b) => b.skillCircle - a.skillCircle);
        const ordered = [...buffs, ...heals, ...attacks];
        const autoSlots: number[] = [];
        const used = new Set<number>();
        for (const skill of ordered) {
          if (autoSlots.length >= maxSlots) break;
          if (used.has(skill.id)) continue;
          autoSlots.push(skill.id);
          used.add(skill.id);
        }
        while (autoSlots.length < maxSlots) autoSlots.push(0);
        set({ equippedSkills: autoSlots });
      }

      // 존 접속자 추적 (훈련소 제외, 비동기)
      const userId = get().authUserId;
      if (userId && zoneId !== 'map_training') {
        upsertZonePresence(userId, zoneId)
          .then(() => getZonePlayerCount(zoneId))
          .then(count => set({ zonePlayerCount: Math.max(1, count) }))
          .catch(() => set({ zonePlayerCount: 1 }));
      } else {
        set({ zonePlayerCount: 1 });
      }
    },

    moveToNextFloor: (useScroll: boolean) => {
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
        if (state.hunt.roomCleared < ROOMS_PER_ZONE) return;
      }
      get().startHunt(nextFloorId);
    },

    pauseHunt: () => {
      const userId = get().authUserId;
      if (userId) removeZonePresence(userId).catch(() => {});
      set(s => ({
        hunt: { ...s.hunt, status: 'paused' as const },
        zonePlayerCount: 1,
      }));
      save(get());
    },

    resumeHunt: () => {
      const state = get();
      if (state.currentHp <= 0) return;
      set({ hunt: { ...state.hunt, status: 'hunting', lastTickAt: Date.now() } });
      save(get());
    },

    revive: () => {
      const state = get();
      if (state.currentHp > 0) return;
      set({ currentHp: state.maxHp + state.getTotalHpBonus() });
      save(get());
    },

    /** 미니맵에서 호출: 선공 몬스터 접근 시작 */
    startApproach: (monsterId: string, distanceM: number): boolean => {
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
  };
}
