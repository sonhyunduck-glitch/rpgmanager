/* =========================================================
   COMBAT TICK — 매 틱 전투 처리 (사냥 메인 루프 오케스트레이터)

   전투 세부 로직은 분리된 모듈에 위임:
     combatBuffs.ts         — 버프/물약/변신/패시브/MP 관리
     combatPlayerAttack.ts  — 플레이어 → 몬스터 공격 (D20 3갈래)
     combatRewards.ts       — 킬 보상 (골드, EXP, 드롭, 레벨업)
     combatMonsterAttack.ts — 몬스터 → 플레이어 반격 + 스킬 AI
   ========================================================= */
import {
  HUNT_ZONES, POTIONS, getMonstersForRoom,
} from '../data/gameData';
import { getClassCombatStyle } from '../data/classData';
import {
  finalAC, finalMR,
  rollMonsterDamage, applyMagicReduction, magicReduction,
  deathExpLossRate,
  calcHpRegenIntervalMs, calcHpRegenAmount,
  rollSpellDamage,
} from '../data/statFormulas';
import { getBestHealSpell } from '../data/playerSkillData';
import { secureRandomInt } from '../lib/random';
import { genLogId } from './helpers';
import {
  getAllEquipped,
  GUILD_BONUS_EXP_PER, GUILD_BONUS_EXP_MAX,
  GUILD_BONUS_DROP_PER, GUILD_BONUS_DROP_MAX,
} from './storeTypes';
import type { LogEntry } from '../types';
import type { GameState, SetState, GetState } from './storeTypes';

// ── 분리된 전투 모듈 ──
import { processBuffsAndPotions } from './combatBuffs';
import { executePlayerAttack } from './combatPlayerAttack';
import { processKillRewards } from './combatRewards';
import { executeMonsterAttack } from './combatMonsterAttack';
import {
  tickSpatialUpdate, RESPAWN_DELAY_MS,
  findNearestAliveMonster, findNearestAliveMonsterByType,
  PROJECTILE_SPEED_ARROW, PROJECTILE_SPEED_MAGIC,
  PROJECTILE_SPEED_MONSTER_MAGIC,
  ATTACK_RANGE_M, PLAYER_MOVE_SPEED,
} from './spatialEngine';
import type { SpatialProjectile, ProjectileType } from '../types/spatial';

type SaveFn = (state: GameState) => void;

export function createCombatTick(set: SetState, get: GetState, save: SaveFn) {
  return {
    tickHunt: () => {
      const state = get();
      const { hunt } = state;
      if (hunt.status !== 'hunting' || !hunt.zoneId) return;

      const zone = HUNT_ZONES.find(z => z.id === hunt.zoneId)!;
      const combatStyle = getClassCombatStyle(state.playerClass);

      // ── 길드 동접 보너스 계산 (틱당 1회) ──
      const myGuildId = state.guildId;
      const guildMatesInZone = myGuildId
        ? state.zonePlayers.filter(p => p.userId !== state.authUserId && p.guildId === myGuildId).length
        : 0;
      const guildExpMult = 1.0 + Math.min(guildMatesInZone * GUILD_BONUS_EXP_PER, GUILD_BONUS_EXP_MAX);
      const guildDropMult = 1.0 + Math.min(guildMatesInZone * GUILD_BONUS_DROP_PER, GUILD_BONUS_DROP_MAX);

      // ── 몬스터 리젠 대기 (접속자 수에 따른 딜레이) ──
      if (hunt.regenWaitTicks > 0) {
        set({
          hunt: { ...hunt, regenWaitTicks: hunt.regenWaitTicks - 1 },
        });
        return; // 대기 중 — 틱 스킵
      }

      // ══════════════════════════════════════════════
      // Phase 0: 공간 상태 동기 (리스폰만 — 이동/투사체는 tickSpatial이 60ms 간격 처리)
      // ══════════════════════════════════════════════

      const spatialNow = Date.now();
      // 리스폰 시 랜덤 몬스터 종류 결정용
      let _respawnMonsters = getMonstersForRoom(zone, hunt.currentRoom ?? 1);
      if (_respawnMonsters.length === 0) _respawnMonsters = zone.monsters;
      const _respawnMonsterIds = _respawnMonsters.map(m => m.id);
      // delta=0: 이동/투사체 전진 없이 리스폰 체크 + combatEvent 수집만
      const spatialResult = tickSpatialUpdate(hunt.spatial, 0, spatialNow, _respawnMonsterIds);

      // 공간 상태를 로컬 변수에 보관 (Phase 7에서 최종 merge)
      let updatedSpatial = {
        ...hunt.spatial,
        entities: spatialResult.entities,
        projectiles: spatialResult.projectiles,
        moveOrders: spatialResult.moveOrders,
        combatEvents: [
          ...hunt.spatial.combatEvents,
          ...spatialResult.combatEvents,
        ],
      };

      // ── Phase 0.5: 플레이어 이동 중이면 공간만 커밋 ──
      // moveOrder가 존재 = 아직 목표에 도착하지 않음 → 전투 건너뜀
      if (updatedSpatial.moveOrders.has('player')) {
        set({ hunt: { ...hunt, spatial: updatedSpatial } });
        return;
      }

      // ── 이동속도 (버프 배율 적용) ──
      const moveSpeedMult = state.getMoveSpeedMult?.() ?? 1;
      const effectiveMoveSpeed = PLAYER_MOVE_SPEED * moveSpeedMult;

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
          monster = monsters[secureRandomInt(0, monsters.length - 1)];
          monsterHp = monster.hp;
          isNewTarget = true;
        }
      } else {
        monster = monsters[secureRandomInt(0, monsters.length - 1)];
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
                spatial: updatedSpatial, targetEntityId: null,
              },
            } as Partial<GameState>);
            save(get());
            return;
          }
        }

        // ── 새 타겟 공간 연결: spatial entity 매칭 + moveOrder 발행 ──
        const playerEnt = updatedSpatial.entities.get('player');
        let newTargetEntityId: string | null = null;
        if (playerEnt) {
          newTargetEntityId = findNearestAliveMonsterByType(
            updatedSpatial.entities, playerEnt.pos, monster.id,
          ) ?? findNearestAliveMonster(updatedSpatial.entities, playerEnt.pos) ?? null;
          // 이동 명령 발행 (타겟으로 이동)
          if (newTargetEntityId) {
            const targetEnt = updatedSpatial.entities.get(newTargetEntityId)!;
            const stopDist = combatStyle === 'melee' ? 0 : ATTACK_RANGE_M;
            const newMoveOrders = new Map(updatedSpatial.moveOrders);
            newMoveOrders.set('player', {
              entityId: 'player',
              destination: { ...targetEnt.pos },
              speed: effectiveMoveSpeed,
              stopDistance: stopDist,
              onArrival: 'attack' as const,
            });
            updatedSpatial = { ...updatedSpatial, moveOrders: newMoveOrders };
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
            monsterAtkAccum: 0,
            spatial: updatedSpatial,
            targetEntityId: newTargetEntityId,
          },
          combatLog: [...state.combatLog, ...encounterLogs].slice(-100),
        } as Partial<GameState>);
        save(get());
        return;
      }

      // ══════════════════════════════════════════════
      // 플레이어 전투 스탯 수집
      // ══════════════════════════════════════════════

      const playerStr = state.getStr();
      const playerDex = state.getDex();
      const playerCon = state.getCon();
      const playerWis = state.getWis();
      const playerInt = state.getInt();
      const weaponEnchant = state.equippedWeapon?.enhanceLevel ?? 0;
      const weaponBaseDmg = monster.size === 'large'
        ? (state.equippedWeapon?.baseAtkLarge ?? 0)
        : (state.equippedWeapon?.baseAtk ?? 0);
      const armorDef = state.getTotalDefense();

      const allEquipSlots = getAllEquipped(state);
      const equipBonusHit = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.hit ?? 0), 0) + state.getSetBonusHit();
      const equipBonusExtraDmg = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.extraDmg ?? 0), 0) + state.getSetBonusDmg();
      const equipBonusMr = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.mr ?? 0), 0) + state.getSetBonusMr();
      const equipBonusHp = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.hp ?? 0), 0);
      const setBonusHp = state.getSetBonusHp();
      const hpBonus = equipBonusHp + setBonusHp;

      const playerAC = finalAC(armorDef, state.level, playerDex, state.playerClass);
      const equipBonusBowHit = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.bowHit ?? 0), 0) + state.getSetBonusBowHit();
      const equipBonusBowDmg = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.bowDmg ?? 0), 0) + state.getSetBonusBowDmg();
      const equipBonusSp = state.getSp();
      const equipBonusMagicDmg = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.magicDmg ?? 0), 0);
      const equipHpr = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.hpr ?? 0), 0);
      const equipMpr = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.mpr ?? 0), 0);

      const newLogs: LogEntry[] = [];
      let newMaterials = { ...state.materials };
      let newPotions = { ...state.potions };
      const gainedMats: Record<string, number> = { ...hunt.materialsGained };
      let newGold = state.gold;
      let huntGold = hunt.goldGained;
      let newExp = state.exp;
      let newLevel = state.level;
      let newTitle = state.title;
      let newItems = hunt.itemsFound;
      let newMaxHp = state.maxHp;
      let newCurrentHp = state.currentHp;
      let newInventory = [...state.inventory];
      let newKills = hunt.kills;
      let newRoomKills = hunt.roomKills;
      let newRoomCleared = hunt.roomCleared;
      let shouldAdvanceFloor = false;
      let killed = false;
      let newLastPotionUsedAt = state.lastPotionUsedAt;
      let newLastPotionCooldownMs = state.lastPotionCooldownMs;
      const fightTicks = isNewTarget ? 1 : hunt.currentFightTicks + 1;
      let currentJoined = [...(hunt.joinedMonsters ?? [])];
      let currentApproaching = [...(hunt.approachingMonsters ?? [])];

      // ── MP 초기화 (사냥 시작 시) ──
      let huntMp = hunt.currentMp;
      const maxMp = state.getMaxMp();
      if (huntMp <= 0 && maxMp > 0 && hunt.currentFightTicks === 0 && !hunt.currentTargetId) {
        huntMp = maxMp;
      }

      // ── 스킬 쿨다운 (타임스탬프 기반 — now와 비교) ──
      let skillCooldowns: Record<number, number> = { ...(hunt.skillCooldowns ?? {}) };
      let monsterStunnedTicks = Math.max(0, (hunt.monsterStunnedTicks ?? 0) - 1);
      let windShackleTicks = Math.max(0, (hunt.windShackleTicks ?? 0) - 1);

      // ── 몬스터 공격속도 비율 계산 (L1J atk_speed 기반) ──
      const playerTickMs = 3000 / (state.getAtkSpeedMult?.() ?? 1);
      let monsterAtkAccum = (hunt.monsterAtkAccum ?? 0) + playerTickMs;

      const now = Date.now();

      // ══════════════════════════════════════════════
      // Phase 1: 버프/물약/변신/패시브/MP (분리 모듈)
      // ══════════════════════════════════════════════

      const hasEquipHaste = allEquipSlots.some(eq => eq?.bonuses?.haste);

      const buffResult = processBuffsAndPotions({
        playerClass: state.playerClass,
        level: state.level,
        subclass: state.subclass,
        activeBuffs: state.activeBuffs,
        equippedSkills: state.equippedSkills ?? [],
        disabledSkills: state.disabledSkills ?? [],
        skillMpThreshold: state.skillMpThreshold ?? 0,
        transformScrollEnabled: state.transformScrollEnabled,
        transformScrollType: state.transformScrollType,
        bluePotionEnabled: state.bluePotionEnabled,
        greenPotionEnabled: state.greenPotionEnabled,
        couragePotionEnabled: state.couragePotionEnabled,
        hasEquipHaste,
        equipBonusSp,
        equipMpr,
        playerWis,
        currentMp: huntMp,
        maxMp,
        lastMpRegenAt: hunt.lastMpRegenAt ?? 0,
        skillCooldowns,
        materials: newMaterials,
        potions: newPotions,
        now,
      });

      // 버프 결과 병합
      const newActiveBuffs = buffResult.activeBuffs;
      huntMp = buffResult.mp;
      newMaterials = buffResult.materials;
      newPotions = buffResult.potions;
      newLogs.push(...buffResult.logs);
      skillCooldowns = buffResult.skillCooldowns;
      let lastMpRegenAt = buffResult.lastMpRegenAt;
      const totalSp = buffResult.totalSp;

      // 버프 적용된 유효 스탯
      const effectiveStr = playerStr + buffResult.skillBuffStr;
      const effectiveDex = playerDex + buffResult.skillBuffDex;
      const effectivePlayerAC = (buffResult.skillBuffDex > 0
        ? finalAC(armorDef, state.level, effectiveDex, state.playerClass)
        : playerAC) + buffResult.skillBuffAc;

      // ══════════════════════════════════════════════
      // Phase 2: 접근 중인 몬스터 처리
      // ══════════════════════════════════════════════

      const justArrivedIds = new Set<string>();
      if (newCurrentHp > 0 && currentApproaching.length > 0) {
        const tickSec = 3 / (state.getAtkSpeedMult?.() ?? 1);
        const stillApproaching: typeof currentApproaching = [];
        for (const ap of currentApproaching) {
          const joiner = monsters.find(m => m.id === ap.monsterId) ?? zone.monsters.find(m => m.id === ap.monsterId);
          if (!joiner) continue;

          ap.distanceRemaining -= tickSec / joiner.moveSpeed;

          if (ap.distanceRemaining > 0 || currentJoined.length >= 5) {
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
                spatial: updatedSpatial, targetEntityId: null,
              },
            } as Partial<GameState>);
            save(get());
            return;
          }
        }
        currentApproaching = stillApproaching;
      }

      // ══════════════════════════════════════════════
      // Phase 3: 플레이어 → 몬스터 공격 (분리 모듈)
      // ══════════════════════════════════════════════

      const isUndead = monster.undead && state.equippedWeapon?.bonuses?.undeadSlayer;
      const undeadBonus = isUndead ? secureRandomInt(1, 20) : 0;
      const undeadText = isUndead ? ` (은빛 가속 +${undeadBonus})` : '';

      const attackResult = executePlayerAttack({
        playerClass: state.playerClass,
        level: state.level,
        subclass: state.subclass,
        combatStyle,
        effectiveStr,
        effectiveDex,
        playerInt,
        weaponEnchant,
        weaponBaseDmg,
        equippedWeapon: state.equippedWeapon,
        equipBonusHit,
        equipBonusExtraDmg,
        equipBonusBowHit,
        equipBonusBowDmg,
        equipBonusMagicDmg,
        skillBuffHit: buffResult.skillBuffHit,
        skillBuffDmg: buffResult.skillBuffDmg,
        skillBuffFireDmg: buffResult.skillBuffFireDmg,
        totalSp,
        monster,
        monsterHp,
        undeadBonus,
        undeadText,
        equippedSkills: state.equippedSkills ?? [],
        disabledSkills: state.disabledSkills ?? [],
        skillCooldowns,
        mp: huntMp,
        maxMp,
        skillMpThreshold: state.skillMpThreshold ?? 0,
        materials: newMaterials,
        joinedMonsters: currentJoined,
        approachingMonsters: currentApproaching,
        allMonsters: monsters,
        now,
      }, windShackleTicks);

      // 공격 결과 병합
      monsterHp = attackResult.monsterHp;
      newLogs.push(...attackResult.logs);
      killed = attackResult.killed;
      huntMp = attackResult.mp;
      newMaterials = attackResult.materials;
      skillCooldowns = attackResult.skillCooldowns;
      windShackleTicks = attackResult.windShackleTicks;

      // 광역 대미지 적용 (합류/접근 몬스터 HP 차감)
      if (attackResult.aoeDamages.length > 0) {
        for (const aoe of attackResult.aoeDamages) {
          // 합류 몬스터 HP 차감
          const jIdx = currentJoined.findIndex(j => j.monsterId === aoe.monsterId);
          if (jIdx >= 0) {
            currentJoined[jIdx] = {
              ...currentJoined[jIdx],
              hp: Math.max(0, currentJoined[jIdx].hp - aoe.damage),
            };
            // 합류 몬스터 사망 시 제거
            if (currentJoined[jIdx].hp <= 0) {
              currentJoined.splice(jIdx, 1);
              newKills++;
            }
            continue;
          }
          // 접근 몬스터 HP 차감
          const aIdx = currentApproaching.findIndex(a => a.monsterId === aoe.monsterId);
          if (aIdx >= 0) {
            currentApproaching[aIdx] = {
              ...currentApproaching[aIdx],
              hp: Math.max(0, currentApproaching[aIdx].hp - aoe.damage),
            };
            // 접근 몬스터 사망 시 제거
            if (currentApproaching[aIdx].hp <= 0) {
              currentApproaching.splice(aIdx, 1);
              newKills++;
            }
          }
        }
      }

      // ── Phase 3.5: 원거리 공격 투사체 생성 (공간 시각 데이터) ──
      // 대미지는 이미 적용됨 — 투사체는 Minimap 렌더링용
      if (combatStyle !== 'melee' && attackResult.playerAttackHit && hunt.targetEntityId) {
        const plEnt = updatedSpatial.entities.get('player');
        const tgEnt = updatedSpatial.entities.get(hunt.targetEntityId);
        if (plEnt && tgEnt) {
          const projType: ProjectileType = combatStyle === 'ranged_bow' ? 'arrow' : 'magic_bolt';
          const projSpeed = combatStyle === 'ranged_bow' ? PROJECTILE_SPEED_ARROW : PROJECTILE_SPEED_MAGIC;
          const proj: SpatialProjectile = {
            id: `proj_${spatialNow}_player`,
            type: projType,
            from: { ...plEnt.pos },
            to: { ...tgEnt.pos },
            targetEntityId: hunt.targetEntityId,
            pos: { ...plEnt.pos },
            speed: projSpeed,
            progress: 0,
            payload: {
              damage: attackResult.finalDmg,
              isCrit: attackResult.isCrit,
              isHit: true,
              spellName: attackResult.usedSpellName,
              logText: '',
              logType: attackResult.isCrit ? 'crit' : 'battle',
            },
          };
          updatedSpatial = {
            ...updatedSpatial,
            projectiles: [...updatedSpatial.projectiles, proj],
          };
        }
      }

      // ── Phase 3.7: 플레이어 공격 CombatEvent 생성 (Minimap 시각 이벤트) ──
      if (hunt.targetEntityId) {
        const tgEntForEv = updatedSpatial.entities.get(hunt.targetEntityId);
        if (tgEntForEv) {
          if (attackResult.killed) {
            // 킬 이벤트 (color는 Minimap에서 monsterName으로 계산)
            updatedSpatial = {
              ...updatedSpatial,
              combatEvents: [...updatedSpatial.combatEvents, {
                id: `cev_${spatialNow}_kill`,
                type: 'kill',
                pos: { ...tgEntForEv.pos },
                damage: attackResult.finalDmg,
                isCrit: attackResult.isCrit,
                monsterName: monster.name,
                timestamp: spatialNow,
              }],
            };
          } else if (attackResult.playerAttackHit) {
            // 명중 (비킬)
            const evType = combatStyle === 'melee' ? 'melee_hit' as const : 'projectile_hit' as const;
            updatedSpatial = {
              ...updatedSpatial,
              combatEvents: [...updatedSpatial.combatEvents, {
                id: `cev_${spatialNow}_phit`,
                type: evType,
                pos: { ...tgEntForEv.pos },
                damage: attackResult.finalDmg,
                isCrit: attackResult.isCrit,
                monsterName: monster.name,
                timestamp: spatialNow,
              }],
            };
          } else {
            // 빗나감
            const evType = combatStyle === 'melee' ? 'melee_miss' as const : 'projectile_miss' as const;
            updatedSpatial = {
              ...updatedSpatial,
              combatEvents: [...updatedSpatial.combatEvents, {
                id: `cev_${spatialNow}_pmiss`,
                type: evType,
                pos: { ...tgEntForEv.pos },
                monsterName: monster.name,
                timestamp: spatialNow,
              }],
            };
          }
        }
      }

      // ══════════════════════════════════════════════
      // Phase 4: 킬 보상 또는 대미지 로그
      // ══════════════════════════════════════════════

      let avgKillTime = hunt.avgKillTime;

      if (killed) {
        const rewardResult = processKillRewards({
          isCrit: attackResult.isCrit,
          finalDmg: attackResult.finalDmg,
          usedSpellName: attackResult.usedSpellName,
          undeadText,
          monster,
          zone,
          currentRoom: hunt.currentRoom,
          guildExpMult,
          guildDropMult,
          gold: newGold,
          huntGold,
          exp: newExp,
          level: newLevel,
          title: newTitle,
          maxHp: newMaxHp,
          currentHp: newCurrentHp,
          hpBonus,
          inventory: newInventory,
          inventoryCapacity: state.inventoryCapacity,
          materials: newMaterials,
          gainedMats,
          itemsFound: newItems,
          kills: newKills,
          roomKills: newRoomKills,
          roomCleared: newRoomCleared,
          playerClass: state.playerClass,
          statAllocationCon: state.statAllocation.con,
          fightStartedAt: hunt.fightStartedAt,
          fightTicks,
          avgKillTime: hunt.avgKillTime,
        });

        // 보상 결과 병합
        newGold = rewardResult.gold;
        huntGold = rewardResult.huntGold;
        newExp = rewardResult.exp;
        newLevel = rewardResult.level;
        newTitle = rewardResult.title;
        newMaxHp = rewardResult.maxHp;
        newCurrentHp = rewardResult.currentHp;
        newInventory = rewardResult.inventory;
        newMaterials = rewardResult.materials;
        Object.assign(gainedMats, rewardResult.gainedMats);
        newItems = rewardResult.itemsFound;
        newKills = rewardResult.kills;
        newRoomKills = rewardResult.roomKills;
        newRoomCleared = rewardResult.roomCleared;
        shouldAdvanceFloor = rewardResult.shouldAdvanceFloor;
        avgKillTime = rewardResult.avgKillTime;
        newLogs.push(...rewardResult.logs);

        // 기사 Lv.30 전직 트리거 (오케스트레이터에서 setTimeout 처리)
        if (rewardResult.pendingSubclassChoice && !state.subclass) {
          setTimeout(() => {
            const s = get();
            if (s.playerClass === 'knight' && !s.subclass && s.level >= 30) {
              set({ pendingSubclassChoice: true });
            }
          }, 500);
        }
      } else if (attackResult.playerAttackHit) {
        // 비킬 대미지 로그
        const spellPrefix = attackResult.usedSpellName ? `[${attackResult.usedSpellName}] ` : '';
        newLogs.push({
          id: genLogId(), type: attackResult.isCrit ? 'crit' : 'battle',
          text: attackResult.isCrit
            ? `치명타! ${spellPrefix}${monster.name}에게 ${attackResult.finalDmg} 대미지 (HP: ${monsterHp}/${monster.hp})${undeadText}`
            : `${spellPrefix}${monster.name}에게 ${attackResult.finalDmg} 대미지 (HP: ${monsterHp}/${monster.hp})${undeadText}`,
          timestamp: Date.now(),
        });
      }

      // ══════════════════════════════════════════════
      // Phase 5: 몬스터 반격 + 스킬 AI + 합류 반격 (분리 모듈)
      // ══════════════════════════════════════════════

      const monsterCanAttack = monsterStunnedTicks <= 0;
      const effectiveMonsterAtkSpeed = windShackleTicks > 0
        ? Math.floor(monster.atkSpeed * 1.5) : monster.atkSpeed;

      // ── Phase 5 사전: 몬스터 공격 전 상태 스냅샷 (공간 이벤트 감지용) ──
      const hpBeforeMonster = newCurrentHp;
      const approachingLenBefore = currentApproaching.length;

      const monsterResult = executeMonsterAttack({
        killed,
        monsterHp,
        monster,
        currentHp: newCurrentHp,
        maxHp: newMaxHp,
        hpBonus,
        playerWis,
        playerClass: state.playerClass,
        level: state.level,
        equipBonusMr,
        effectivePlayerAC,
        monsterAtkAccum,
        effectiveMonsterAtkSpeed,
        monsterCanAttack,
        lastMagicHitAt: hunt.lastMagicHitAt,
        consecutiveMagicHits: hunt.consecutiveMagicHits,
        mobSkillCooldowns: { ...(hunt.mobSkillCooldowns ?? {}) },
        currentJoined,
        currentApproaching,
        justArrivedIds,
        windShackleTicks,
        monsters,
        zoneMonsters: zone.monsters,
        now,
      });

      // 몬스터 결과 병합
      newCurrentHp = monsterResult.currentHp;
      monsterHp = monsterResult.monsterHp;
      newLogs.push(...monsterResult.logs);
      monsterAtkAccum = monsterResult.monsterAtkAccum;
      currentApproaching = monsterResult.currentApproaching;
      currentJoined = monsterResult.currentJoined;

      // ── 회피 로그 배칭 (AC 높을 때 로그 폭주 방지) ──
      if (monsterResult.evasionCount > 0) {
        newLogs.push({
          id: genLogId(), type: 'miss',
          text: monsterResult.evasionCount === 1
            ? `적의 공격을 회피!`
            : `적의 공격을 ${monsterResult.evasionCount}회 회피!`,
          timestamp: Date.now(),
        });
      }

      // ── Phase 5.5: 몬스터 반격 공간 이벤트 (역방향 투사체 + CombatEvent) ──
      // 대미지는 이미 적용됨 — 공간 데이터는 Minimap 렌더링용
      if (hunt.targetEntityId) {
        const tgEnt = updatedSpatial.entities.get(hunt.targetEntityId);
        const plEnt = updatedSpatial.entities.get('player');
        if (tgEnt && plEnt) {
          const hpDelta = hpBeforeMonster - newCurrentHp;

          // (A) 마법 몬스터 반격 → 역방향 투사체
          if (monster.attackType === 'magic' && hpDelta > 0 && !killed) {
            const revProj: SpatialProjectile = {
              id: `proj_${spatialNow}_monster`,
              type: 'monster_magic',
              from: { ...tgEnt.pos },
              to: { ...plEnt.pos },
              targetEntityId: 'player',
              pos: { ...tgEnt.pos },
              speed: PROJECTILE_SPEED_MONSTER_MAGIC,
              progress: 0,
              payload: {
                damage: hpDelta,
                isCrit: false,
                isHit: true,
                logText: '',
                logType: 'hit_taken',
              },
            };
            updatedSpatial = {
              ...updatedSpatial,
              projectiles: [...updatedSpatial.projectiles, revProj],
            };
          }

          // (B) 물리 몬스터 명중 → CombatEvent (피격 이펙트 + 공격 모션)
          if (monster.attackType !== 'magic' && hpDelta > 0 && !killed) {
            updatedSpatial = {
              ...updatedSpatial,
              combatEvents: [...updatedSpatial.combatEvents, {
                id: `cev_${spatialNow}_mhit`,
                type: 'monster_hit',
                pos: { ...plEnt.pos },
                sourcePos: { ...tgEnt.pos },   // 몬스터 위치 (공격 방향 표시용)
                damage: hpDelta,
                monsterName: monster.name,
                timestamp: spatialNow,
              }],
            };
          }

          // (C) 몬스터 스킬: SUMMON 감지 (approaching 증가)
          if (currentApproaching.length > approachingLenBefore) {
            updatedSpatial = {
              ...updatedSpatial,
              combatEvents: [...updatedSpatial.combatEvents, {
                id: `cev_${spatialNow}_summon`,
                type: 'summon',
                pos: { ...tgEnt.pos },
                monsterName: monster.name,
                timestamp: spatialNow,
              }],
            };
          }

          // (D) 회피 → CombatEvent
          if (monsterResult.evasionCount > 0) {
            updatedSpatial = {
              ...updatedSpatial,
              combatEvents: [...updatedSpatial.combatEvents, {
                id: `cev_${spatialNow}_dodge`,
                type: 'dodge',
                pos: { ...plEnt.pos },
                timestamp: spatialNow,
              }],
            };
          }
        }
      }

      // ══════════════════════════════════════════════
      // Phase 6: 사망 / 힐 / 회복 / 물약
      // ══════════════════════════════════════════════

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
            spatial: updatedSpatial, targetEntityId: null,
          },
        } as Partial<GameState>);
        save(get());
        return;
      }

      // ── 스킬 자동 힐 (HP 30% 이하, MP 충분 시) ──
      const equipped = state.equippedSkills ?? [];
      const disabled = state.disabledSkills ?? [];
      if (newCurrentHp > 0 && huntMp > 0) {
        const hpPct = (newCurrentHp / (newMaxHp + hpBonus)) * 100;
        if (hpPct <= 30) {
          const healSpell = getBestHealSpell(state.playerClass, state.level, huntMp, equipped, disabled, state.subclass);
          if (healSpell && (skillCooldowns[healSpell.id] ?? 0) <= now) {
            huntMp -= healSpell.consumeMp;
            const healAmt = rollSpellDamage(
              healSpell.damageValue, healSpell.damageDice, healSpell.damageDiceCount,
              playerInt, totalSp, state.level, state.playerClass,
            );
            newCurrentHp = Math.min(newMaxHp + hpBonus, newCurrentHp + healAmt);
            skillCooldowns[healSpell.id] = now + (healSpell.reuseDelayMs || 3000);
            newLogs.push({
              id: genLogId(), type: 'skill',
              text: `${healSpell.name} 시전! HP +${healAmt} (HP: ${newCurrentHp}/${newMaxHp + hpBonus})`,
              timestamp: now,
            });
          }
        }
      }

      // ── HP 자연 회복 (벽시계 기준 레벨별 고정 주기) ──
      let lastHpRegenAt = hunt.lastHpRegenAt ?? 0;
      if (newCurrentHp > 0 && newCurrentHp < newMaxHp + hpBonus) {
        const hpIntervalMs = calcHpRegenIntervalMs(state.level, state.playerClass);
        const hpWindow = Math.floor(now / hpIntervalMs);
        const lastHpWindow = Math.floor(lastHpRegenAt / hpIntervalMs);
        if (hpWindow > lastHpWindow) {
          const hpRegen = calcHpRegenAmount(state.level, playerCon) + equipHpr;
          newCurrentHp = Math.min(newMaxHp + hpBonus, newCurrentHp + hpRegen);
          lastHpRegenAt = now;
        }
      }

      // ── 물약 자동 사용 (물약별 쿨타임 차등) ──
      const potionCooldownReady = now - state.lastPotionUsedAt >= (state.lastPotionCooldownMs || 3000);
      if (newCurrentHp > 0 && newCurrentHp < newMaxHp + hpBonus && state.potionAutoUse && potionCooldownReady) {
        const hpPct = (newCurrentHp / (newMaxHp + hpBonus)) * 100;
        if (hpPct <= state.potionAutoThreshold) {
          const pid = state.selectedPotionId;
          const pCount = newPotions[pid] ?? 0;

          if (pCount > 0) {
            const potion = POTIONS[pid];
            if (potion) {
              const heal = potion.healMin + secureRandomInt(0, potion.healMax - potion.healMin);
              newCurrentHp = Math.min(newMaxHp + hpBonus, newCurrentHp + heal);
              newPotions[pid] = pCount - 1;
              newLastPotionUsedAt = now;
              newLastPotionCooldownMs = potion.cooldownMs ?? 3000;
              newLogs.push({
                id: genLogId(), type: 'potion',
                text: `${potion.name} 사용! HP +${heal} (HP: ${newCurrentHp}/${newMaxHp + hpBonus})`,
                timestamp: Date.now(),
              });
            }
          }
        }
      }

      // ══════════════════════════════════════════════
      // Phase 7: 다음 타겟 선택 + 상태 업데이트
      // ══════════════════════════════════════════════

      let nextTargetId: string | null = killed ? null : monster.id;
      let nextMonsterHp = killed ? 0 : monsterHp;
      let nextTargetEntityId: string | null = killed ? null : hunt.targetEntityId;

      if (killed) {
        // ── 킬 시 공간 상태에서 몬스터 사망 처리 ──
        if (hunt.targetEntityId) {
          const deadEntity = updatedSpatial.entities.get(hunt.targetEntityId);
          if (deadEntity) {
            const newEntities = new Map(updatedSpatial.entities);
            newEntities.set(hunt.targetEntityId, {
              ...deadEntity,
              alive: false,
              respawnAt: spatialNow + RESPAWN_DELAY_MS,
            });
            updatedSpatial = { ...updatedSpatial, entities: newEntities };
          }
        }

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
            const nextMonster = monsters[secureRandomInt(0, monsters.length - 1)];
            nextTargetId = nextMonster.id;
            nextMonsterHp = nextMonster.hp;
            newLogs.push({
              id: genLogId(), type: 'encounter',
              text: `${nextMonster.name}을(를) 발견! (Lv.${nextMonster.level})`,
              timestamp: Date.now(),
            });
          }
        } else {
          const nextMonster = monsters[secureRandomInt(0, monsters.length - 1)];
          nextTargetId = nextMonster.id;
          nextMonsterHp = nextMonster.hp;
          newLogs.push({
            id: genLogId(), type: 'encounter',
            text: `${nextMonster.name}을(를) 발견! (Lv.${nextMonster.level})`,
            timestamp: Date.now(),
          });
        }

        // ── 다음 타겟 공간 연결 + moveOrder 발행 ──
        const plEntK = updatedSpatial.entities.get('player');
        if (plEntK && nextTargetId) {
          nextTargetEntityId = findNearestAliveMonsterByType(
            updatedSpatial.entities, plEntK.pos, nextTargetId,
          ) ?? findNearestAliveMonster(updatedSpatial.entities, plEntK.pos) ?? null;
          if (nextTargetEntityId) {
            const tgtEnt = updatedSpatial.entities.get(nextTargetEntityId)!;
            const stopDist = combatStyle === 'melee' ? 0 : ATTACK_RANGE_M;
            const newMO = new Map(updatedSpatial.moveOrders);
            newMO.set('player', {
              entityId: 'player',
              destination: { ...tgtEnt.pos },
              speed: effectiveMoveSpeed,
              stopDistance: stopDist,
              onArrival: 'attack' as const,
            });
            updatedSpatial = { ...updatedSpatial, moveOrders: newMO };
          }
        }
      }

      // ── 상태 업데이트 ──
      set({
        gold: newGold, exp: newExp, level: newLevel, title: newTitle,
        maxHp: newMaxHp, currentHp: newCurrentHp,
        inventory: newInventory, materials: newMaterials,
        potions: newPotions, activeBuffs: newActiveBuffs,
        lastPotionUsedAt: newLastPotionUsedAt,
        lastPotionCooldownMs: newLastPotionCooldownMs,
        combatLog: [...state.combatLog, ...newLogs].slice(-80),
        hunt: {
          ...hunt,
          kills: newKills, roomKills: newRoomKills, roomCleared: newRoomCleared,
          goldGained: huntGold, materialsGained: gainedMats, itemsFound: newItems,
          currentFightTicks: killed ? 0 : fightTicks,
          fightStartedAt: killed ? Date.now() : hunt.fightStartedAt,
          currentTargetId: nextTargetId, monsterCurrentHp: nextMonsterHp,
          targetEntityId: nextTargetEntityId,
          joinedMonsters: currentJoined, approachingMonsters: currentApproaching,
          mobSkillCooldowns: monsterResult.mobSkillCooldowns,
          lastMagicHitAt: monsterResult.lastMagicHitAt,
          consecutiveMagicHits: monsterResult.consecutiveMagicHits,
          currentMp: huntMp,
          lastHpRegenAt,
          lastMpRegenAt,
          skillCooldowns,
          monsterStunnedTicks,
          windShackleTicks,
          monsterAtkAccum: killed ? 0 : monsterAtkAccum,
          avgKillTime,
          // 킬 후 접속자 수에 따른 리젠 대기 (다른 유저 1명당 1틱 대기)
          regenWaitTicks: killed ? Math.max(0, state.zonePlayerCount - 1 - guildMatesInZone) : hunt.regenWaitTicks,
          // 공간 상태 (Phase 0 결과 + 킬 처리)
          spatial: updatedSpatial,
        },
      });

      if (killed && newKills % 10 === 0) save(get());

      if (shouldAdvanceFloor) {
        setTimeout(() => get().moveToNextFloor(false), 1500);
      }
    },
  };
}
