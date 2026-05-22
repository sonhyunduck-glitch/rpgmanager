/* =========================================================
   COMBAT TICK — 매 틱 전투 처리 (사냥 메인 루프)
   ========================================================= */
import {
  HUNT_ZONES, MATERIALS, EQUIPMENT_TEMPLATES, POTIONS, POTION_ORDER,
  xpForLevel, getMonstersForRoom,
  getTransformScrollSpeed, TRANSFORM_SCROLL_DURATION,
  TRANSFORM_SCROLL_DROP_RATE, TRANSFORM_SCROLL_MAX,
} from '../data/gameData';
import { getMonsterDrops } from '../data/monsterData';
import {
  meleeHit, rollHit, rollDamage, rollHpGain,
  finalAC, acToEvasion, finalMR,
  calcHitRate, rollMonsterDamage, applyMagicReduction, magicReduction,
  deathExpLossRate,
} from '../data/statFormulas';
import { genLogId, createEquipment } from './helpers';
import {
  RATE_GOLD, RATE_EXP, RATE_DROP, ROOM_KILL_REQ, ROOMS_PER_ZONE,
  DUNGEON_SCROLL_DROP, DUNGEON_SCROLL_MAX, getAllEquipped,
} from './storeTypes';
import type { LogEntry } from '../types';
import type { GameState, SetState, GetState } from './storeTypes';

type SaveFn = (state: GameState) => void;

export function createCombatTick(set: SetState, get: GetState, save: SaveFn) {
  return {
    tickHunt: () => {
      const state = get();
      const { hunt } = state;
      if (hunt.status !== 'hunting' || !hunt.zoneId) return;
      if (state.isPlayerMoving) return;

      const zone = HUNT_ZONES.find(z => z.id === hunt.zoneId)!;

      // ── 몬스터 선택 ──
      let monsters = getMonstersForRoom(zone, hunt.currentRoom ?? 1);
      if (monsters.length === 0) monsters = zone.monsters;
      if (monsters.length === 0) return;

      let monster;
      let monsterHp = hunt.monsterCurrentHp;
      let isNewTarget = false;

      if (hunt.currentTargetId) {
        const prev = monsters.find(m => m.id === hunt.currentTargetId);
        if (prev && monsterHp > 0) {
          monster = prev;
        } else {
          monster = monsters[Math.floor(Math.random() * monsters.length)];
          monsterHp = monster.hp;
          isNewTarget = true;
        }
      } else {
        monster = monsters[Math.floor(Math.random() * monsters.length)];
        monsterHp = monster.hp;
        isNewTarget = true;
      }

      // ── 새 타겟 → 선공 몬스터 돌진 ──
      if (isNewTarget) {
        const encounterLogs: LogEntry[] = [];
        let encounterHp = state.currentHp;
        const encounterGold = state.gold;

        encounterLogs.push({
          id: genLogId(), type: 'encounter',
          text: `${monster.name}을(를) 발견! (Lv.${monster.level})`,
          timestamp: Date.now(),
        });

        if (monster.aggressive) {
          const rawDmg = rollMonsterDamage(monster.damDice, monster.damDiceSides, monster.extraDam);
          const chargeMult = 0.8 / monster.moveSpeed;
          const chargeRaw = Math.max(1, Math.round(rawDmg * chargeMult));
          const multStr = Math.abs(chargeMult - 1) > 0.01 ? ` x${chargeMult.toFixed(1)}` : '';

          let chargeDmg: number;
          let chargeLog: string;

          if (monster.attackType === 'magic') {
            const allSlots = getAllEquipped(state);
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
                currentTargetId: null, monsterCurrentHp: 0,
                currentFightTicks: 0, fightStartedAt: 0, status: 'paused',
                joinedMonsters: [], approachingMonsters: [],
              },
            } as Partial<GameState>);
            save(get());
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
        save(get());
        return;
      }

      // ── 플레이어 전투 스탯 ──
      const playerStr = state.getStr();
      const playerDex = state.getDex();
      const playerCon = state.getCon();
      const playerWis = state.getWis();
      const weaponEnchant = state.equippedWeapon?.enhanceLevel ?? 0;
      const weaponBaseDmg = monster.size === 'large'
        ? (state.equippedWeapon?.baseAtkLarge ?? 0)
        : (state.equippedWeapon?.baseAtk ?? 0);
      const armorDef = state.getTotalDefense();

      const allEquipSlots = getAllEquipped(state);
      const equipBonusHit = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.hit ?? 0), 0);
      const equipBonusExtraDmg = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.extraDmg ?? 0), 0);
      const equipBonusMr = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.mr ?? 0), 0);
      const equipBonusHp = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.hp ?? 0), 0);
      const setBonusHp = state.getSetBonusHp();
      const hpBonus = equipBonusHp + setBonusHp;

      const playerMeleeHit = meleeHit(state.level, weaponEnchant, playerStr) + equipBonusHit;
      const monsterEvasion = monster.level + monster.ac;
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
      const fightTicks = isNewTarget ? 1 : hunt.currentFightTicks + 1;
      let currentJoined = [...(hunt.joinedMonsters ?? [])];
      let currentApproaching = [...(hunt.approachingMonsters ?? [])];

      // ── 버프 물약 자동 사용 ──
      const now = Date.now();
      let newActiveBuffs = [...state.activeBuffs].filter(b => b.expiresAt > now);

      for (const pid of POTION_ORDER) {
        const p = POTIONS[pid];
        if (!p.buffDuration) continue;
        if (pid === 'green_potion' && !state.greenPotionEnabled) continue;
        if (pid === 'courage_potion' && !state.couragePotionEnabled) continue;
        const alreadyActive = newActiveBuffs.some(b => b.potionId === pid);
        if (alreadyActive) continue;
        const pCount = newPotions[pid] ?? 0;
        if (pCount <= 0) continue;
        newPotions[pid] = pCount - 1;
        newActiveBuffs.push({
          potionId: pid, name: p.name,
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

      // ── 변신주문서 자동 사용 ──
      if (state.transformScrollEnabled) {
        const hasTransformBuff = newActiveBuffs.some(b => b.potionId === 'transform_scroll');
        if (!hasTransformBuff) {
          const scrollType = state.transformScrollType ?? 'normal';
          const scrollId = scrollType === 'event' ? 'event_transform_scroll' : 'transform_scroll';
          const scrollCount = newMaterials[scrollId] ?? 0;
          if (scrollCount > 0) {
            newMaterials[scrollId] = scrollCount - 1;
            const speeds = scrollType === 'event'
              ? getTransformScrollSpeed(80)   // 이벤트: Lv.80 고정
              : getTransformScrollSpeed(newLevel);
            const scrollName = scrollType === 'event' ? '이벤트 변신주문서' : '변신주문서';
            newActiveBuffs.push({
              potionId: 'transform_scroll',
              name: scrollName,
              expiresAt: now + TRANSFORM_SCROLL_DURATION * 1000,
              atkSpeedMult: speeds.atk,
              moveSpeedMult: speeds.move,
            });
            newLogs.push({
              id: genLogId(), type: 'potion',
              text: `${scrollName} 사용! (${Math.floor(TRANSFORM_SCROLL_DURATION / 60)}분)`,
              timestamp: now,
            });
          }
        }
      }

      // ── 접근 중인 몬스터 처리 ──
      const justArrivedIds = new Set<string>();
      if (newCurrentHp > 0 && currentApproaching.length > 0) {
        const tickSec = 3 / (state.getAtkSpeedMult?.() ?? 1);
        const stillApproaching: typeof currentApproaching = [];
        for (const ap of currentApproaching) {
          const joiner = monsters.find(m => m.id === ap.monsterId) ?? zone.monsters.find(m => m.id === ap.monsterId);
          if (!joiner) continue;

          ap.distanceRemaining -= tickSec / joiner.moveSpeed;

          if (ap.distanceRemaining > 0 || currentJoined.length >= 2) {
            stillApproaching.push(ap);
            continue;
          }

          // 도착 → 합류 + 돌진
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
          justArrivedIds.add(joiner.id);
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
            save(get());
            return;
          }
        }
        currentApproaching = stillApproaching;
      }

      // ── 플레이어 → 몬스터 명중 판정 ──
      const { hit: isHit, rate: hitRate } = rollHit(playerMeleeHit, monsterEvasion);

      if (!isHit) {
        newLogs.push({
          id: genLogId(), type: 'miss',
          text: `${monster.name}에게 공격이 빗나갔습니다! (명중률 ${Math.round(hitRate * 100)}%)`,
          timestamp: Date.now(),
        });
      } else {
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
            id: genLogId(), type: isCrit ? 'crit' : 'kill',
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

          // 평균 킬 타임
          const thisKillMs = hunt.fightStartedAt > 0
            ? Date.now() - hunt.fightStartedAt
            : fightTicks * 3000;
          hunt.avgKillTime = newKills === 1
            ? thisKillMs
            : ((hunt.avgKillTime * (newKills - 1)) + thisKillMs) / newKills;

          // Gold & EXP
          const goldDrop = Math.floor((monster.goldReward + Math.floor(Math.random() * 5)) * RATE_GOLD);
          newGold += goldDrop;
          huntGold += goldDrop;
          // 훈련소는 Lv.12 이후 경험치 획득 불가
          const isTrainingCapped = zone.id === 'map_training' && newLevel >= 12;
          if (!isTrainingCapped) {
            newExp += Math.floor(monster.expReward * RATE_EXP);
          }

          newLogs.push({
            id: genLogId(), type: 'loot',
            text: `${goldDrop} 골드`,
            timestamp: Date.now(),
          });

          // Level up
          while (newExp >= xpForLevel(newLevel)) {
            newExp -= xpForLevel(newLevel);
            newLevel++;
            const hpGain = rollHpGain(playerCon);
            newMaxHp += hpGain;
            newCurrentHp = newMaxHp + hpBonus;
            const hasStatPoint = newLevel >= 50;
            newLogs.push({
              id: genLogId(), type: 'levelup',
              text: `레벨 업! Lv.${newLevel} 달성! (HP +${hpGain}${hasStatPoint ? ', 스탯 포인트 +1' : ''})`,
              timestamp: Date.now(),
            });
            if (newLevel >= 20) newTitle = '숙련 모험가';
            if (newLevel >= 30) newTitle = '베테랑';
          }

          // Monster drops
          const monsterDropList = getMonsterDrops(monster.id);
          for (const [gameId, chance, minQty, maxQty] of monsterDropList) {
            if (Math.random() >= Math.min(1, chance * RATE_DROP)) continue;
            const qty = minQty + Math.floor(Math.random() * (maxQty - minQty + 1));

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

          // 던전 이동주문서 드롭
          if (zone.zoneType === 'dungeon' && zone.floor && zone.maxFloor) {
            if (zone.floor < zone.maxFloor) {
              const nextScrollId = `scroll_${zone.dungeonGroup}_${zone.floor + 1}f`;
              if ((newMaterials[nextScrollId] ?? 0) < DUNGEON_SCROLL_MAX && Math.random() < DUNGEON_SCROLL_DROP) {
                newMaterials[nextScrollId] = (newMaterials[nextScrollId] ?? 0) + 1;
                const nextFloorName = zone.name.replace(/\d+F$/, `${zone.floor + 1}F`);
                newLogs.push({ id: genLogId(), type: 'loot', text: `${nextFloorName} 이동주문서`, timestamp: Date.now() });
              }
            }
            if (zone.floor > 1) {
              const curScrollId = `scroll_${zone.id}`;
              if ((newMaterials[curScrollId] ?? 0) < DUNGEON_SCROLL_MAX && Math.random() < DUNGEON_SCROLL_DROP) {
                newMaterials[curScrollId] = (newMaterials[curScrollId] ?? 0) + 1;
                newLogs.push({ id: genLogId(), type: 'loot', text: `${zone.name} 이동주문서`, timestamp: Date.now() });
              }
            }
          }

          // 변신주문서 드롭 (Lv.12+, 3%, 최대 10장)
          if (newLevel >= 12) {
            const tsCount = newMaterials['transform_scroll'] ?? 0;
            if (tsCount < TRANSFORM_SCROLL_MAX && Math.random() < TRANSFORM_SCROLL_DROP_RATE) {
              newMaterials['transform_scroll'] = tsCount + 1;
              gainedMats['transform_scroll'] = (gainedMats['transform_scroll'] ?? 0) + 1;
              newLogs.push({ id: genLogId(), type: 'loot', text: '변신주문서', timestamp: Date.now() });
            }
          }
        } else {
          newLogs.push({
            id: genLogId(), type: isCrit ? 'crit' : 'battle',
            text: isCrit
              ? `치명타! ${monster.name}에게 ${finalDmg} 대미지 (HP: ${monsterHp}/${monster.hp})${undeadText}`
              : `${monster.name}에게 ${finalDmg} 대미지 (HP: ${monsterHp}/${monster.hp})${undeadText}`,
            timestamp: Date.now(),
          });
        }
      }

      // ── 주 타겟 반격 ──
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

      // ── 합류 몬스터 반격 ──
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

      // ── 사망 처리 ──
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
        save(get());
        return;
      }

      // ── 물약 자동 사용 ──
      if (newCurrentHp > 0 && newCurrentHp < newMaxHp + hpBonus && state.potionAutoUse) {
        const hpPct = (newCurrentHp / (newMaxHp + hpBonus)) * 100;
        if (hpPct <= state.potionAutoThreshold) {
          const pid = state.selectedPotionId;
          const pCount = newPotions[pid] ?? 0;

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

      // ── 다음 타겟 선택 ──
      let nextTargetId: string | null = killed ? null : monster.id;
      let nextMonsterHp = killed ? 0 : monsterHp;

      if (killed) {
        if (currentJoined.length > 0) {
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
        gold: newGold, exp: newExp, level: newLevel, title: newTitle,
        maxHp: newMaxHp, currentHp: newCurrentHp,
        inventory: newInventory, materials: newMaterials,
        potions: newPotions, activeBuffs: newActiveBuffs,
        combatLog: [...state.combatLog, ...newLogs].slice(-80),
        hunt: {
          ...hunt,
          kills: newKills, roomKills: newRoomKills, roomCleared: newRoomCleared,
          goldGained: huntGold, materialsGained: gainedMats, itemsFound: newItems,
          currentFightTicks: killed ? 0 : fightTicks,
          fightStartedAt: killed ? Date.now() : hunt.fightStartedAt,
          currentTargetId: nextTargetId, monsterCurrentHp: nextMonsterHp,
          joinedMonsters: currentJoined, approachingMonsters: currentApproaching,
        },
      });

      if (killed && newKills % 10 === 0) save(get());

      if (shouldAdvanceFloor) {
        setTimeout(() => get().moveToNextFloor(false), 1500);
      }
    },
  };
}
