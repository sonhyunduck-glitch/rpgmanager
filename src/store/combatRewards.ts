/* =========================================================
   COMBAT REWARDS — 킬 보상 (골드, EXP, 드롭, 레벨업)

   combatTick.ts에서 분리된 순수 함수 모듈.
   몬스터 처치 시 보상 처리.
   게임 로직 변경 없이 코드 구조만 분리.
   ========================================================= */
import {
  xpForLevel, MATERIALS, EQUIPMENT_TEMPLATES,
  TRANSFORM_SCROLL_DROP_RATE, TRANSFORM_SCROLL_MAX,
} from '../data/gameData';
import { getMonsterDrops } from '../data/dropData';
import { getClassBaseStats } from '../data/classData';
import { rollHpGain } from '../data/statFormulas';
import { secureRandom, secureRandomInt } from '../lib/random';
import { genLogId, createEquipment } from './helpers';
import {
  RATE_GOLD, RATE_EXP, RATE_DROP, ROOM_KILL_REQ, ROOMS_PER_ZONE,
  DUNGEON_SCROLL_DROP, DUNGEON_SCROLL_MAX,
} from './storeTypes';
import type { LogEntry, Monster, HuntZone, Equipment, PlayerClass } from '../types';

// ══════════════════════════════════════════════
// 입출력 인터페이스
// ══════════════════════════════════════════════

export interface RewardInput {
  // 공격 결과
  isCrit: boolean;
  finalDmg: number;
  usedSpellName: string;
  undeadText: string;

  // 몬스터 & 존
  monster: Monster;
  zone: HuntZone;
  currentRoom: number;

  // 길드 보너스
  guildExpMult: number;
  guildDropMult: number;

  // 현재 상태 (변경되어 반환)
  gold: number;
  huntGold: number;
  exp: number;
  level: number;
  title: string;
  maxHp: number;
  currentHp: number;
  hpBonus: number;
  inventory: Equipment[];
  inventoryCapacity: number;
  materials: Record<string, number>;
  gainedMats: Record<string, number>;
  itemsFound: number;
  kills: number;
  roomKills: number;
  roomCleared: number;

  // 플레이어 정보 (레벨업 HP 계산용)
  playerClass: PlayerClass;
  statAllocationCon: number;

  // 사냥 세션 정보
  fightStartedAt: number;
  fightTicks: number;
  avgKillTime: number;
}

export interface RewardResult {
  gold: number;
  huntGold: number;
  exp: number;
  level: number;
  title: string;
  maxHp: number;
  currentHp: number;
  inventory: Equipment[];
  materials: Record<string, number>;
  gainedMats: Record<string, number>;
  itemsFound: number;
  kills: number;
  roomKills: number;
  roomCleared: number;
  shouldAdvanceFloor: boolean;
  avgKillTime: number;
  logs: LogEntry[];
  // 기사 Lv.30 전직 트리거 플래그
  pendingSubclassChoice: boolean;
}

// ══════════════════════════════════════════════
// 메인 함수
// ══════════════════════════════════════════════

export function processKillRewards(input: RewardInput): RewardResult {
  const {
    isCrit, finalDmg, usedSpellName, undeadText,
    monster, zone, currentRoom,
    guildExpMult, guildDropMult,
    hpBonus, inventoryCapacity,
    playerClass, statAllocationCon,
    fightStartedAt, fightTicks,
  } = input;

  const logs: LogEntry[] = [];
  let gold = input.gold;
  let huntGold = input.huntGold;
  let exp = input.exp;
  let level = input.level;
  let title = input.title;
  let maxHp = input.maxHp;
  let currentHp = input.currentHp;
  const inventory = [...input.inventory];
  const materials = input.materials;     // 호출자가 복사본 전달
  const gainedMats = input.gainedMats;   // 호출자가 복사본 전달
  let itemsFound = input.itemsFound;
  let kills = input.kills;
  let roomKills = input.roomKills;
  let roomCleared = input.roomCleared;
  let shouldAdvanceFloor = false;
  let pendingSubclassChoice = false;

  // ── 킬 로그 ──
  const spellPrefixKill = usedSpellName ? `[${usedSpellName}] ` : '';
  logs.push({
    id: genLogId(), type: isCrit ? 'crit' : 'kill',
    text: isCrit
      ? `치명타! ${spellPrefixKill}${monster.name}을(를) 처치! (${finalDmg} dmg, Lv.${monster.level})${undeadText}`
      : `${spellPrefixKill}${monster.name}을(를) 처치. (${finalDmg} dmg, Lv.${monster.level})${undeadText}`,
    timestamp: Date.now(),
  });

  kills++;
  roomKills++;

  // 방 클리어 체크
  if (roomKills >= ROOM_KILL_REQ && currentRoom > roomCleared) {
    roomCleared = Math.max(roomCleared, currentRoom);
    const roomNum = currentRoom;
    if (roomCleared < ROOMS_PER_ZONE) {
      logs.push({
        id: genLogId(), type: 'enter',
        text: `Room ${roomNum} 클리어! → Room ${roomNum + 1} 해금`,
        timestamp: Date.now(),
      });
    } else {
      if (zone.zoneType === 'dungeon' && zone.floor && zone.maxFloor && zone.floor < zone.maxFloor) {
        shouldAdvanceFloor = true;
        logs.push({
          id: genLogId(), type: 'enter',
          text: `모든 방 클리어! → 다음 층 이동...`,
          timestamp: Date.now(),
        });
      } else {
        logs.push({
          id: genLogId(), type: 'enter',
          text: `모든 방 클리어!`,
          timestamp: Date.now(),
        });
      }
    }
  }

  // 평균 킬 타임
  const thisKillMs = fightStartedAt > 0
    ? Date.now() - fightStartedAt
    : fightTicks * 3000;
  const avgKillTime = kills === 1
    ? thisKillMs
    : ((input.avgKillTime * (kills - 1)) + thisKillMs) / kills;

  // Gold & EXP
  const goldDrop = Math.floor((monster.goldReward + secureRandomInt(0, 4)) * RATE_GOLD * guildExpMult);
  gold += goldDrop;
  huntGold += goldDrop;
  // 훈련소는 Lv.12 이후 경험치 획득 불가
  const isTrainingCapped = zone.id === 'map_training' && level >= 12;
  if (!isTrainingCapped) {
    exp += Math.floor(monster.expReward * RATE_EXP * guildExpMult);
  }

  logs.push({
    id: genLogId(), type: 'loot',
    text: `${goldDrop} 골드`,
    timestamp: Date.now(),
  });

  // Level up
  while (exp >= xpForLevel(level)) {
    exp -= xpForLevel(level);
    level++;
    // 순수 CON만 사용 (베이스 + 투자 스탯, 장비 CON 제외)
    const pureCon = getClassBaseStats(playerClass).con + statAllocationCon;
    const hpGain = rollHpGain(pureCon);
    maxHp += hpGain;
    currentHp = maxHp + hpBonus;
    const hasStatPoint = level >= 50;
    logs.push({
      id: genLogId(), type: 'levelup',
      text: `레벨 업! Lv.${level} 달성! (HP +${hpGain}${hasStatPoint ? ', 스탯 포인트 +1' : ''})`,
      timestamp: Date.now(),
    });
    if (level >= 20) title = '숙련 모험가';
    if (level >= 30) title = '베테랑';
    // 기사 Lv.30 전직 트리거 (오케스트레이터가 setTimeout으로 처리)
    if (level === 30 && playerClass === 'knight') {
      pendingSubclassChoice = true;
    }
  }

  // Monster drops (L1J drop_items.csv 기반)
  const monsterDropList = getMonsterDrops(monster.id);
  for (const [gameId, chance, minQty, maxQty] of monsterDropList) {
    if (secureRandom() >= Math.min(1, chance * RATE_DROP * guildDropMult)) continue;
    const qty = minQty + secureRandomInt(0, maxQty - minQty);

    if (gameId === '__GOLD__') {
      // 아데나 드롭 → 골드 직접 추가
      const goldAmt = Math.floor(qty * RATE_GOLD * guildExpMult);
      gold += goldAmt;
      huntGold += goldAmt;
    } else if (MATERIALS[gameId]) {
      const matName = MATERIALS[gameId].name;
      materials[gameId] = (materials[gameId] ?? 0) + qty;
      gainedMats[gameId] = (gainedMats[gameId] ?? 0) + qty;
      logs.push({ id: genLogId(), type: 'loot', text: `${matName} x${qty}`, timestamp: Date.now() });
    } else if (EQUIPMENT_TEMPLATES[gameId]) {
      const eq = createEquipment(gameId);
      itemsFound++;
      if (inventory.length < inventoryCapacity) {
        inventory.push(eq);
        logs.push({ id: genLogId(), type: 'find', text: `${eq.name} 획득 → 인벤토리`, timestamp: Date.now() });
      }
    }
  }

  // 던전 이동주문서 드롭
  if (zone.zoneType === 'dungeon' && zone.floor && zone.maxFloor) {
    if (zone.floor < zone.maxFloor) {
      const nextScrollId = `scroll_${zone.dungeonGroup}_${zone.floor + 1}f`;
      if ((materials[nextScrollId] ?? 0) < DUNGEON_SCROLL_MAX && secureRandom() < DUNGEON_SCROLL_DROP) {
        materials[nextScrollId] = (materials[nextScrollId] ?? 0) + 1;
        const nextFloorName = zone.name.replace(/\d+F$/, `${zone.floor + 1}F`);
        logs.push({ id: genLogId(), type: 'loot', text: `${nextFloorName} 이동주문서`, timestamp: Date.now() });
      }
    }
    if (zone.floor > 1) {
      const curScrollId = `scroll_${zone.id}`;
      if ((materials[curScrollId] ?? 0) < DUNGEON_SCROLL_MAX && secureRandom() < DUNGEON_SCROLL_DROP) {
        materials[curScrollId] = (materials[curScrollId] ?? 0) + 1;
        logs.push({ id: genLogId(), type: 'loot', text: `${zone.name} 이동주문서`, timestamp: Date.now() });
      }
    }
  }

  // 변신주문서 드롭 (Lv.12+, 3%, 최대 10장)
  if (level >= 12) {
    const tsCount = materials['transform_scroll'] ?? 0;
    if (tsCount < TRANSFORM_SCROLL_MAX && secureRandom() < TRANSFORM_SCROLL_DROP_RATE) {
      materials['transform_scroll'] = tsCount + 1;
      gainedMats['transform_scroll'] = (gainedMats['transform_scroll'] ?? 0) + 1;
      logs.push({ id: genLogId(), type: 'loot', text: '변신주문서', timestamp: Date.now() });
    }
  }

  return {
    gold, huntGold, exp, level, title,
    maxHp, currentHp, inventory,
    materials, gainedMats, itemsFound,
    kills, roomKills, roomCleared,
    shouldAdvanceFloor, avgKillTime, logs,
    pendingSubclassChoice,
  };
}
