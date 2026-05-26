/* =========================================================
   COMBAT TICK — 매 틱 전투 처리 (사냥 메인 루프)
   ========================================================= */
import {
  HUNT_ZONES, MATERIALS, EQUIPMENT_TEMPLATES, POTIONS, POTION_ORDER,
  xpForLevel, getMonstersForRoom,
  getTransformScrollSpeed, TRANSFORM_SCROLL_DURATION,
  TRANSFORM_SCROLL_DROP_RATE, TRANSFORM_SCROLL_MAX,
} from '../data/gameData';
import { getMonsterDrops } from '../data/dropData';
import { getMonsterSkills } from '../data/monsterSkillData';
import { getWeaponSkill } from '../data/weaponSkillData';
import { getClassCombatStyle, getClassBaseStats, CLASS_CONFIGS } from '../data/classData';
import {
  rollDamage, rollHpGain,
  finalAC, finalMR,
  rollMonsterDamage, applyMagicReduction, magicReduction,
  deathExpLossRate,
  calcPlayerHitRate, rollD20PcNpcHit, rollD20NpcPcHit,
  calcPcDefense, calcMonsterHitRate,
  rollBowDamage, rollMagicDamage, rollMagicCritical, consecutiveMagicDecay,
  calcHpRegenIntervalMs, calcHpRegenAmount,
  calcMpRegenAmount, calcBluePotionMpBonus, MP_REGEN_INTERVAL_MS,
  rollSpellDamage, calcAttrBonus,
} from '../data/statFormulas';
import {
  getAvailableSkills, getBestHealSpell, getAvailableBuffs, getPassiveBuffs,
} from '../data/playerSkillData';
import { secureRandom, secureRandomInt } from '../lib/random';
import { genLogId, createEquipment } from './helpers';
import {
  RATE_GOLD, RATE_EXP, RATE_DROP, ROOM_KILL_REQ, ROOMS_PER_ZONE,
  DUNGEON_SCROLL_DROP, DUNGEON_SCROLL_MAX, getAllEquipped,
  GUILD_BONUS_EXP_PER, GUILD_BONUS_EXP_MAX,
  GUILD_BONUS_DROP_PER, GUILD_BONUS_DROP_MAX,
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
            monsterAtkAccum: 0,
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
      const combatStyle = getClassCombatStyle(state.playerClass);
      const equipBonusBowHit = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.bowHit ?? 0), 0) + state.getSetBonusBowHit();
      const equipBonusBowDmg = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.bowDmg ?? 0), 0) + state.getSetBonusBowDmg();
      const equipBonusSp = state.getSp();
      const equipBonusMagicDmg = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.magicDmg ?? 0), 0);
      const equipHpr = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.hpr ?? 0), 0);
      const equipMpr = allEquipSlots.reduce((s, eq) => s + (eq?.bonuses?.mpr ?? 0), 0);

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
      let newLastPotionUsedAt = state.lastPotionUsedAt;
      const fightTicks = isNewTarget ? 1 : hunt.currentFightTicks + 1;
      let currentJoined = [...(hunt.joinedMonsters ?? [])];
      let currentApproaching = [...(hunt.approachingMonsters ?? [])];

      // ── MP 초기화 (사냥 시작 시) ──
      let huntMp = hunt.currentMp;
      const maxMp = state.getMaxMp();
      if (huntMp <= 0 && maxMp > 0 && hunt.currentFightTicks === 0 && !hunt.currentTargetId) {
        huntMp = maxMp;
      }

      // ── 스킬 쿨다운 감소 ──
      const skillCooldowns: Record<number, number> = { ...(hunt.skillCooldowns ?? {}) };
      for (const key of Object.keys(skillCooldowns)) {
        const numKey = Number(key);
        if (skillCooldowns[numKey] > 0) skillCooldowns[numKey]--;
      }
      let monsterStunnedTicks = Math.max(0, (hunt.monsterStunnedTicks ?? 0) - 1);
      let windShackleTicks = Math.max(0, (hunt.windShackleTicks ?? 0) - 1);

      // ── 몬스터 공격속도 비율 계산 (L1J atk_speed 기반) ──
      // 플레이어 틱 간격(ms)만큼 몬스터 공격 타이머 누적
      const playerTickMs = 3000 / (state.getAtkSpeedMult?.() ?? 1);
      let monsterAtkAccum = (hunt.monsterAtkAccum ?? 0) + playerTickMs;

      // ── 버프 물약 자동 사용 ──
      const now = Date.now();
      let newActiveBuffs = [...state.activeBuffs].filter(b => b.expiresAt > now);

      // 헤이스트 그룹 중복 체크 (장비/스킬 헤이스트 있으면 초록물약 스킵)
      const hasEquipHaste = getAllEquipped(state).some(eq => eq?.bonuses?.haste);
      const HASTE_SKILL_IDS = new Set([43, 87, 149, 150]);
      const hasSkillHaste = newActiveBuffs.some(b => b.skillId && HASTE_SKILL_IDS.has(b.skillId) && b.expiresAt > now);
      const hasAnyHaste = hasEquipHaste || hasSkillHaste;

      for (const pid of POTION_ORDER) {
        const p = POTIONS[pid];
        if (!p.buffDuration) continue;
        // 클래스 제한 체크 (L1J: 용기=기사, 와퍼=요정, 지혜=마법사)
        if (p.classRestriction && !p.classRestriction.includes(state.playerClass)) continue;
        if (pid === 'blue_potion' && !state.bluePotionEnabled) continue;
        if (pid === 'green_potion' && !state.greenPotionEnabled) continue;
        // 장비/스킬 헤이스트와 초록물약 중복 불가 (L1J: 동일 haste 그룹)
        if (pid === 'green_potion' && hasAnyHaste) continue;
        // brave 계열 (용기/와퍼/지혜) — 동일 토글 사용
        if ((pid === 'courage_potion' || pid === 'elven_wafer' || pid === 'wisdom_potion') && !state.couragePotionEnabled) continue;
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
          spBonus: p.spBonus ?? 0,
        });
        newLogs.push({
          id: genLogId(), type: 'potion',
          text: `${p.name} 사용! (${p.buffDuration >= 60 ? `${Math.floor(p.buffDuration / 60)}분` : `${p.buffDuration}초`})`,
          timestamp: now,
        });
      }

      // ── 패시브 버프 상시 적용 (습득 조건 충족 시 만료 없이 활성) ──
      const passives = getPassiveBuffs(state.playerClass, state.level);
      for (const pb of passives) {
        const already = newActiveBuffs.some(b => b.skillId === pb.id);
        if (!already) {
          newActiveBuffs.push({
            potionId: `passive_${pb.id}`,
            skillId: pb.id,
            name: pb.name,
            expiresAt: now + 999_999_999,
            atkSpeedMult: pb.buffEffect?.atkSpeedMult ?? 1,
            moveSpeedMult: pb.buffEffect?.moveSpeedMult ?? 1,
            acBonus: pb.buffEffect?.acBonus,
            hitBonus: pb.buffEffect?.hitBonus,
            dmgBonus: pb.buffEffect?.dmgBonus,
            fireDmgBonus: pb.buffEffect?.fireDmgBonus,
          });
        }
      }

      // 지혜의 물약 SP 보너스 (L1J: SP+2, 마법 대미지 계수 증가)
      const buffSpBonus = newActiveBuffs.reduce((s, b) => s + (b.spBonus ?? 0), 0);
      const totalSp = equipBonusSp + buffSpBonus;

      // ── 변신주문서 자동 사용 ──
      if (state.transformScrollEnabled) {
        const existingTsBuff = newActiveBuffs.find(b => b.potionId === 'transform_scroll');
        const scrollType = state.transformScrollType ?? 'normal';
        // 타입 변경 감지: 기존 버프 이름과 현재 설정이 다르면 교체
        const wantEventName = scrollType === 'event' ? '이벤트 변신주문서' : '변신주문서';
        const needReplace = existingTsBuff && existingTsBuff.name !== wantEventName;
        if (needReplace) {
          newActiveBuffs = newActiveBuffs.filter(b => b.potionId !== 'transform_scroll');
        }
        if (!existingTsBuff || needReplace) {
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

      // ── MP 자연 회복 (벽시계 기준 16초 고정 주기) ──
      // 00:00:00 기준 16초마다 회복. 공격속도 버프와 무관.
      let lastMpRegenAt = hunt.lastMpRegenAt ?? 0;
      const mpWindow = Math.floor(now / MP_REGEN_INTERVAL_MS);
      const lastMpWindow = Math.floor(lastMpRegenAt / MP_REGEN_INTERVAL_MS);
      if (mpWindow > lastMpWindow && huntMp < maxMp) {
        let regenAmt = calcMpRegenAmount(playerWis) + equipMpr;
        // 파란 물약 버프 활성 시 추가 (L1J STATUS_BLUE_POTION: + max(1, WIS-10))
        const hasBlueBuff = newActiveBuffs.some(b => b.potionId === 'blue_potion');
        if (hasBlueBuff) {
          regenAmt += calcBluePotionMpBonus(playerWis);
        }
        huntMp = Math.min(maxMp, huntMp + regenAmt);
        lastMpRegenAt = now;
      }

      // ── 스킬 버프 자동 시전 (MP 충분 시, 슬롯 장착 스킬만, OFF 제외) ──
      const equipped = state.equippedSkills ?? [];
      const disabled = state.disabledSkills ?? [];
      if (huntMp > 0) {
        const activeSkillBuffIds = newActiveBuffs
          .filter(b => b.skillId != null && b.skillId > 0 && b.expiresAt > now)
          .map(b => b.skillId!);
        const buffSkills = getAvailableBuffs(state.playerClass, state.level, huntMp, activeSkillBuffIds)
          .filter(s => equipped.includes(s.id) && !disabled.includes(s.id));
        // 초록물약 활성 여부 (헤이스트 스킬 중복 방지용)
        const hasGreenBuff = newActiveBuffs.some(b => b.potionId === 'green_potion' && b.expiresAt > now);
        for (const buff of buffSkills) {
          if (huntMp < buff.consumeMp) continue;
          // 쿨다운 체크
          if ((skillCooldowns[buff.id] ?? 0) > 0) continue;
          // 헤이스트 스킬은 장비/초록물약 헤이스트와 중복 불가
          if (HASTE_SKILL_IDS.has(buff.id) && (hasEquipHaste || hasGreenBuff)) continue;
          // 재료 소모 체크
          if (buff.consumeItemId && buff.consumeAmount) {
            const matKey = `e_${buff.consumeItemId}`;
            const owned = newMaterials[matKey] ?? 0;
            if (owned < buff.consumeAmount) continue;
            newMaterials[matKey] = owned - buff.consumeAmount;
          }
          huntMp -= buff.consumeMp;
          newActiveBuffs.push({
            potionId: `skill_${buff.id}`,
            skillId: buff.id,
            name: buff.name,
            expiresAt: now + buff.buffDuration * 1000,
            atkSpeedMult: buff.buffEffect?.atkSpeedMult ?? 1,
            moveSpeedMult: buff.buffEffect?.moveSpeedMult ?? 1,
            acBonus: buff.buffEffect?.acBonus,
            hitBonus: buff.buffEffect?.hitBonus,
            dmgBonus: buff.buffEffect?.dmgBonus,
            fireDmgBonus: buff.buffEffect?.fireDmgBonus,
          });
          skillCooldowns[buff.id] = buff.reuseDelayTicks || 1;
          const matLabel = buff.consumeItemId === 40319 ? '정령옥' : buff.consumeItemId === 40318 ? '마력의돌' : '';
          const matText = matLabel && buff.consumeAmount ? ` (${matLabel} -${buff.consumeAmount})` : '';
          newLogs.push({
            id: genLogId(), type: 'skill',
            text: `${buff.name} 시전! (${Math.floor(buff.buffDuration / 60)}분)${matText}`,
            timestamp: now,
          });
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

      // ── 스킬 버프 보너스 수집 ──
      const skillBuffHit = newActiveBuffs
        .filter(b => b.skillId && b.expiresAt > now)
        .reduce((s, b) => s + (b.hitBonus ?? 0), 0);
      const skillBuffDmg = newActiveBuffs
        .filter(b => b.skillId && b.expiresAt > now)
        .reduce((s, b) => s + (b.dmgBonus ?? 0), 0);
      const skillBuffFireDmg = newActiveBuffs
        .filter(b => b.skillId && b.expiresAt > now)
        .reduce((s, b) => s + (b.fireDmgBonus ?? 0), 0);
      const skillBuffAc = newActiveBuffs
        .filter(b => b.skillId && b.expiresAt > now)
        .reduce((s, b) => s + (b.acBonus ?? 0), 0);
      const effectivePlayerAC = playerAC + skillBuffAc;

      // ── 플레이어 → 몬스터 공격 (3갈래 분기 — L1J D20) ──
      const isUndead = monster.undead && state.equippedWeapon?.bonuses?.undeadSlayer;
      const undeadBonus = isUndead ? secureRandomInt(1, 20) : 0;
      const undeadText = isUndead ? ` (은빛 가속 +${undeadBonus})` : '';
      let playerAttackHit = false;
      let finalDmg = 0;
      let isCrit = false;
      let usedSpellName = '';

      if (combatStyle === 'ranged_magic') {
        // ── 마법사: 에너지 볼트 기본 공격 (MP 미소모, 자동 명중, 매 틱 발동) ──
        // 스킬 마법은 클래스 스킬 섹션에서 추가로 시전됨
        playerAttackHit = true;
        const rawMagic = rollMagicDamage(
          weaponBaseDmg, playerInt, totalSp,
          state.level, state.playerClass,
        );
        const { isCrit: magicCrit } = rollMagicCritical();
        isCrit = magicCrit;
        const critDmg = isCrit ? Math.floor(rawMagic * 1.5) : rawMagic;
        const afterMr = applyMagicReduction(critDmg, monster.mr);
        finalDmg = afterMr + equipBonusMagicDmg + undeadBonus;
        usedSpellName = '에너지 볼트';
      } else {
        // ── 기사/요정: D20 명중 판정 ──
        usedSpellName = CLASS_CONFIGS[state.playerClass].atkName;
        const hitBonusForBow = combatStyle === 'ranged_bow' ? equipBonusBowHit : 0;
        const hitRate = calcPlayerHitRate(
          state.level, playerStr, playerDex,
          weaponEnchant, equipBonusHit + hitBonusForBow + skillBuffHit,
        );
        const { hit } = rollD20PcNpcHit(hitRate, monster.ac);
        playerAttackHit = hit;

        if (hit) {
          if (combatStyle === 'ranged_bow') {
            // 요정: DEX 기반 활 대미지
            const bowDmg = rollBowDamage(weaponBaseDmg, state.level, weaponEnchant, playerDex);
            // 은 화살 소모 (L1J L1Attack.java — 매 발사마다 1개 소모)
            // 기본 대미지: dmg_small=7 → random(0~6)+1 = 1~7
            // 은 재질 vs 언데드: random(0~19)+1 = 1~20 추가 (calcMaterialBlessDmg)
            let silverArrowDmg = 0;
            const silverArrowKey = 'e_40744';
            const silverArrowCount = newMaterials[silverArrowKey] ?? 0;
            if (silverArrowCount > 0) {
              newMaterials[silverArrowKey] = silverArrowCount - 1;
              silverArrowDmg = secureRandomInt(1, 7); // dmg_small=7: random(0~6)+1
              if (monster.undead) {
                silverArrowDmg += secureRandomInt(1, 20); // 은 재질 vs 언데드 보너스
              }
            }
            finalDmg = bowDmg + equipBonusExtraDmg + equipBonusBowDmg + skillBuffDmg + skillBuffFireDmg + undeadBonus + silverArrowDmg;
          } else {
            // 기사: STR 기반 근접 대미지
            finalDmg = rollDamage(weaponBaseDmg, state.level, weaponEnchant, playerStr)
              + equipBonusExtraDmg + skillBuffDmg + skillBuffFireDmg + undeadBonus;
          }
          isCrit = secureRandom() < 0.1;
          finalDmg = isCrit ? Math.floor(finalDmg * 1.5) : finalDmg;
        }
      }

      if (!playerAttackHit) {
        newLogs.push({
          id: genLogId(), type: 'miss',
          text: `${monster.name}에게 ${usedSpellName || '공격'}이(가) 빗나갔습니다!`,
          timestamp: Date.now(),
        });
      } else {
        monsterHp = Math.max(0, monsterHp - finalDmg);

        // ── 무기 특수 스킬 발동 (L1J weapon_skills.csv) ──
        // kill 체크 전에 실행 — 스킬 대미지로 처치 시에도 보상 정상 지급
        let weaponSkillDmg = 0;
        if (monsterHp > 0 && state.equippedWeapon) {
          const wSkill = getWeaponSkill(state.equippedWeapon.templateId);
          if (wSkill) {
            const effectiveProb = wSkill.probability + wSkill.probEnchant * weaponEnchant;
            if (secureRandomInt(1, 100) <= effectiveProb) {
              if (wSkill.fixDamage > 0) {
                weaponSkillDmg = wSkill.fixDamage
                  + (wSkill.randomDamage > 0 ? secureRandomInt(0, wSkill.randomDamage - 1) : 0);
                if (wSkill.enableMr && monster.mr > 0) {
                  weaponSkillDmg = applyMagicReduction(weaponSkillDmg, monster.mr);
                }
                weaponSkillDmg = Math.max(1, weaponSkillDmg);
                monsterHp = Math.max(0, monsterHp - weaponSkillDmg);
                newLogs.push({
                  id: genLogId(), type: 'battle',
                  text: `${wSkill.skillName} 발동! ${monster.name}에게 ${weaponSkillDmg} 추가 대미지${monster.mr > 0 ? ` (MR ${Math.round(magicReduction(monster.mr) * 100)}%)` : ''}`,
                  timestamp: Date.now(),
                });
              } else {
                newLogs.push({
                  id: genLogId(), type: 'battle',
                  text: `${wSkill.skillName} 발동!`,
                  timestamp: Date.now(),
                });
              }
            }
          }
        }

        // ── 클래스 스킬 사용 (트리플 애로우, 쇼크 스턴, 서클 마법 등 — 슬롯 장착 스킬만) ──
        // 우선순위: 서클0(클래스 전용) > 서클 마법(높은 서클 우선)
        if (monsterHp > 0 && huntMp > 0) {
          const classSkills = getAvailableSkills(state.playerClass, state.level)
            .filter(s => s.skillType === 'attack' && s.consumeMp <= huntMp
              && (skillCooldowns[s.id] ?? 0) <= 0 && equipped.includes(s.id) && !disabled.includes(s.id)
              && (!s.consumeItemId || (newMaterials[`e_${s.consumeItemId}`] ?? 0) >= (s.consumeAmount ?? 0)))
            .sort((a, b) => {
              // 서클0(클래스 전용) 최우선
              if (a.skillCircle === 0 && b.skillCircle !== 0) return -1;
              if (a.skillCircle !== 0 && b.skillCircle === 0) return 1;
              // 같은 종류면 높은 서클 우선
              return b.skillCircle - a.skillCircle;
            });

          if (classSkills.length > 0) {
            const classSkill = classSkills[0];
            huntMp -= classSkill.consumeMp;
            skillCooldowns[classSkill.id] = classSkill.reuseDelayTicks || 1;
            // 재료 소모
            if (classSkill.consumeItemId && classSkill.consumeAmount) {
              const matKey = `e_${classSkill.consumeItemId}`;
              newMaterials[matKey] = (newMaterials[matKey] ?? 0) - classSkill.consumeAmount;
            }
            const sMLabel = classSkill.consumeItemId === 40319 ? '정령옥' : classSkill.consumeItemId === 40318 ? '마력의돌' : '';
            const sMText = sMLabel && classSkill.consumeAmount ? ` (${sMLabel} -${classSkill.consumeAmount})` : '';

            if (classSkill.id === 132) {
              // 트리플 애로우: 3회 활 공격
              let tripleTotal = 0;
              for (let i = 0; i < 3; i++) {
                const bowDmg = rollBowDamage(weaponBaseDmg, state.level, weaponEnchant, playerDex);
                const arrowDmg = bowDmg + equipBonusExtraDmg + equipBonusBowDmg + skillBuffDmg + skillBuffFireDmg;
                tripleTotal += arrowDmg;
              }
              monsterHp = Math.max(0, monsterHp - tripleTotal);
              newLogs.push({
                id: genLogId(), type: 'skill',
                text: `${classSkill.name}! ${monster.name}에게 ${tripleTotal} 대미지 (3연발)${sMText}`,
                timestamp: Date.now(),
              });
            } else if (classSkill.id === 167) {
              // 윈드 셰클: 몬스터 공격/이동 속도 감소 3틱
              windShackleTicks = 3;
              newLogs.push({
                id: genLogId(), type: 'skill',
                text: `${classSkill.name}! ${monster.name}의 공격 속도 감소! (3턴)${sMText}`,
                timestamp: Date.now(),
              });
            } else if (classSkill.skillCircle > 0 && classSkill.damageDiceCount > 0) {
              // 서클 마법 공격 (기사/요정이 장착한 공격 마법 자동 시전)
              const classSpellAttrBonus = calcAttrBonus(classSkill.attr, monster.attr);
              const spellDmg = rollSpellDamage(
                classSkill.damageValue, classSkill.damageDice, classSkill.damageDiceCount,
                playerInt, totalSp, state.level, state.playerClass, classSpellAttrBonus,
              );
              const afterMr = applyMagicReduction(spellDmg, monster.mr);
              const skillFinalDmg = Math.max(1, afterMr);
              monsterHp = Math.max(0, monsterHp - skillFinalDmg);
              const mrPct = Math.round(magicReduction(monster.mr) * 100);
              newLogs.push({
                id: genLogId(), type: 'skill',
                text: `${classSkill.name}! ${monster.name}에게 ${skillFinalDmg} 마법 대미지${mrPct > 0 ? ` (MR ${mrPct}%)` : ''}${sMText}`,
                timestamp: Date.now(),
              });
            }
          }
        }

        if (monsterHp <= 0) {
          // ── 몬스터 처치 ──
          killed = true;

          const spellPrefixKill = usedSpellName ? `[${usedSpellName}] ` : '';
          newLogs.push({
            id: genLogId(), type: isCrit ? 'crit' : 'kill',
            text: isCrit
              ? `치명타! ${spellPrefixKill}${monster.name}을(를) 처치! (${finalDmg} dmg, Lv.${monster.level})${undeadText}`
              : `${spellPrefixKill}${monster.name}을(를) 처치. (${finalDmg} dmg, Lv.${monster.level})${undeadText}`,
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
          const goldDrop = Math.floor((monster.goldReward + secureRandomInt(0, 4)) * RATE_GOLD * guildExpMult);
          newGold += goldDrop;
          huntGold += goldDrop;
          // 훈련소는 Lv.12 이후 경험치 획득 불가
          const isTrainingCapped = zone.id === 'map_training' && newLevel >= 12;
          if (!isTrainingCapped) {
            newExp += Math.floor(monster.expReward * RATE_EXP * guildExpMult);
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
            // 순수 CON만 사용 (베이스 + 투자 스탯, 장비 CON 제외)
            const pureCon = getClassBaseStats(state.playerClass).con + state.statAllocation.con;
            const hpGain = rollHpGain(pureCon);
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

          // Monster drops (L1J drop_items.csv 기반)
          const monsterDropList = getMonsterDrops(monster.id);
          for (const [gameId, chance, minQty, maxQty] of monsterDropList) {
            if (secureRandom() >= Math.min(1, chance * RATE_DROP * guildDropMult)) continue;
            const qty = minQty + secureRandomInt(0, maxQty - minQty);

            if (gameId === '__GOLD__') {
              // 아데나 드롭 → 골드 직접 추가
              const goldAmt = Math.floor(qty * RATE_GOLD * guildExpMult);
              newGold += goldAmt;
              huntGold += goldAmt;
            } else if (MATERIALS[gameId]) {
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
              if ((newMaterials[nextScrollId] ?? 0) < DUNGEON_SCROLL_MAX && secureRandom() < DUNGEON_SCROLL_DROP) {
                newMaterials[nextScrollId] = (newMaterials[nextScrollId] ?? 0) + 1;
                const nextFloorName = zone.name.replace(/\d+F$/, `${zone.floor + 1}F`);
                newLogs.push({ id: genLogId(), type: 'loot', text: `${nextFloorName} 이동주문서`, timestamp: Date.now() });
              }
            }
            if (zone.floor > 1) {
              const curScrollId = `scroll_${zone.id}`;
              if ((newMaterials[curScrollId] ?? 0) < DUNGEON_SCROLL_MAX && secureRandom() < DUNGEON_SCROLL_DROP) {
                newMaterials[curScrollId] = (newMaterials[curScrollId] ?? 0) + 1;
                newLogs.push({ id: genLogId(), type: 'loot', text: `${zone.name} 이동주문서`, timestamp: Date.now() });
              }
            }
          }

          // 변신주문서 드롭 (Lv.12+, 3%, 최대 10장)
          if (newLevel >= 12) {
            const tsCount = newMaterials['transform_scroll'] ?? 0;
            if (tsCount < TRANSFORM_SCROLL_MAX && secureRandom() < TRANSFORM_SCROLL_DROP_RATE) {
              newMaterials['transform_scroll'] = tsCount + 1;
              gainedMats['transform_scroll'] = (gainedMats['transform_scroll'] ?? 0) + 1;
              newLogs.push({ id: genLogId(), type: 'loot', text: '변신주문서', timestamp: Date.now() });
            }
          }
        } else {
          const spellPrefix = usedSpellName ? `[${usedSpellName}] ` : '';
          newLogs.push({
            id: genLogId(), type: isCrit ? 'crit' : 'battle',
            text: isCrit
              ? `치명타! ${spellPrefix}${monster.name}에게 ${finalDmg} 대미지 (HP: ${monsterHp}/${monster.hp})${undeadText}`
              : `${spellPrefix}${monster.name}에게 ${finalDmg} 대미지 (HP: ${monsterHp}/${monster.hp})${undeadText}`,
            timestamp: Date.now(),
          });
        }
      }

      // ── 주 타겟 반격 (L1J D20 NPC→PC + atk_speed 비율 기반) ──
      let newLastMagicHitAt = hunt.lastMagicHitAt;
      let newConsecutiveMagicHits = hunt.consecutiveMagicHits;
      let evasionCount = 0; // 회피 로그 배칭 (AC 높을 때 로그 폭주 방지)

      // 몬스터 스턴 체크 (쇼크 스턴 등)
      const monsterCanAttack = monsterStunnedTicks <= 0;

      // 몬스터 공격속도: atkSpeed(ms) 도달 시 공격, 초과분 이월
      // 윈드 셰클: 공격 딜레이 1.5배 (30% 공격속도 감소)
      const effectiveMonsterAtkSpeed = windShackleTicks > 0
        ? Math.floor(monster.atkSpeed * 1.5) : monster.atkSpeed;

      if (!killed && monsterHp > 0 && newCurrentHp > 0 && monsterCanAttack) {
        // 누적 시간이 공격 딜레이에 도달할 때마다 공격 (한 틱에 여러 번 가능)
        let monsterAttackCount = 0;
        while (monsterAtkAccum >= effectiveMonsterAtkSpeed && newCurrentHp > 0) {
          monsterAtkAccum -= effectiveMonsterAtkSpeed;
          monsterAttackCount++;
          if (monsterAttackCount > 3) break; // 안전장치: 한 틱 최대 3회

          const rawMonsterDmg = rollMonsterDamage(monster.damDice, monster.damDiceSides, monster.extraDam);

          if (monster.attackType === 'magic') {
            const playerMR = finalMR(state.level, playerWis) + equipBonusMr;
            let reduced = applyMagicReduction(rawMonsterDmg, playerMR);
            const pct = Math.round(magicReduction(playerMR) * 100);

            // 연속 마법 감쇠 (L1J: 2초 내 (2/3)^n, PC 타겟만)
            const elapsed = now - newLastMagicHitAt;
            let consecutive: number;
            if (elapsed < 2000) {
              consecutive = newConsecutiveMagicHits;
            } else if (elapsed < 4000) {
              consecutive = newConsecutiveMagicHits; // 전이 구간: 유지
            } else {
              consecutive = 0;
            }
            reduced = Math.max(1, Math.floor(reduced * consecutiveMagicDecay(consecutive)));
            if (elapsed < 2000) consecutive++;
            newLastMagicHitAt = now;
            newConsecutiveMagicHits = consecutive;

            newCurrentHp = Math.max(0, newCurrentHp - reduced);
            newLogs.push({
              id: genLogId(), type: 'hit_taken',
              text: `${monster.name}의 마법 공격! -${reduced} HP (MR ${pct}% 저항) (HP: ${newCurrentHp}/${newMaxHp + hpBonus})`,
              timestamp: Date.now(),
            });
          } else {
            // 물리 몬스터: D20 명중 → AC 대미지 감소 (별도 단계)
            const mHitRate = calcMonsterHitRate(monster.level, 0);
            const { hit: monsterHits } = rollD20NpcPcHit(mHitRate, effectivePlayerAC);
            if (monsterHits) {
              // AC 기반 대미지 감소 (L1J calcPcDefense — 명중 판정과 별개)
              const acReduction = calcPcDefense(effectivePlayerAC, state.playerClass);
              const finalMonsterDmg = Math.max(1, rawMonsterDmg - acReduction);
              newCurrentHp = Math.max(0, newCurrentHp - finalMonsterDmg);
              newLogs.push({
                id: genLogId(), type: 'hit_taken',
                text: `${monster.name}의 공격! -${finalMonsterDmg} HP (HP: ${newCurrentHp}/${newMaxHp + hpBonus})`,
                timestamp: Date.now(),
              });
            } else {
              evasionCount++;
            }
          }
        }
      } else if (killed || monsterHp <= 0) {
        // 몬스터 사망 시 공격 타이머 리셋
        monsterAtkAccum = 0;
      }

      // ── 몬스터 스킬 AI (L1J mob_skills — 4종 행동 + 5종 트리거) ──
      const mobSkillCooldowns = { ...(hunt.mobSkillCooldowns ?? {}) };
      // 쿨다운 감소 (매 틱)
      for (const key of Object.keys(mobSkillCooldowns)) {
        if (mobSkillCooldowns[key] > 0) mobSkillCooldowns[key]--;
      }

      if (!killed && monsterHp > 0 && newCurrentHp > 0) {
        const npcIdMatch = monster.id.match(/^npc_(\d+)$/);
        const npcId = npcIdMatch ? parseInt(npcIdMatch[1], 10) : 0;
        const skills = getMonsterSkills(npcId);

        if (skills.length > 0) {
          for (const skill of skills) {
            const cdKey = `${monster.id}_${skill.skillName}`;
            if ((mobSkillCooldowns[cdKey] ?? 0) > 0) continue;

            // 5종 트리거 AND 체크
            const hpPct = (monsterHp / monster.hp) * 100;
            if (skill.trigger.triggerRandom > 0 && secureRandomInt(1, 100) > skill.trigger.triggerRandom) continue;
            if (skill.trigger.triggerHp != null && hpPct > skill.trigger.triggerHp) continue;
            if (skill.trigger.triggerCount != null && skill.trigger.triggerCount <= 0) continue;

            // 스킬 실행
            switch (skill.type) {
              case 'PHYSICAL_ATTACK': {
                const mult = skill.damageMult ?? 1.5;
                const rawSkDmg = rollMonsterDamage(monster.damDice, monster.damDiceSides, monster.extraDam);
                const skillDmg = Math.max(1, Math.floor(rawSkDmg * mult));
                newCurrentHp = Math.max(0, newCurrentHp - skillDmg);
                newLogs.push({
                  id: genLogId(), type: 'hit_taken',
                  text: `${monster.name}의 ${skill.skillName}! -${skillDmg} HP (HP: ${newCurrentHp}/${newMaxHp + hpBonus})`,
                  timestamp: Date.now(),
                });
                break;
              }
              case 'MAGIC_ATTACK': {
                const dice = skill.magicDice ?? 2;
                const sides = skill.magicDiceSides ?? 6;
                const bonus = skill.magicDamageBonus ?? 0;
                let dmg = 0;
                for (let i = 0; i < dice; i++) dmg += secureRandomInt(1, sides);
                dmg += bonus;
                const playerMR = finalMR(state.level, playerWis) + equipBonusMr;
                dmg = applyMagicReduction(dmg, playerMR);
                newCurrentHp = Math.max(0, newCurrentHp - dmg);
                const pct = Math.round(magicReduction(playerMR) * 100);
                newLogs.push({
                  id: genLogId(), type: 'hit_taken',
                  text: `${monster.name}의 ${skill.skillName}! -${dmg} HP (마법, MR ${pct}%) (HP: ${newCurrentHp}/${newMaxHp + hpBonus})`,
                  timestamp: Date.now(),
                });
                break;
              }
              case 'SUMMON': {
                if (skill.summonMonsterId && currentApproaching.length + currentJoined.length < 3) {
                  const count = skill.summonCount ?? 1;
                  for (let i = 0; i < count; i++) {
                    const summonId = `npc_${skill.summonMonsterId}`;
                    const summon = monsters.find(m => m.id === summonId) ?? zone.monsters.find(m => m.id === summonId);
                    if (summon) {
                      const dist = 10 + secureRandom() * 15;
                      currentApproaching.push({ monsterId: summon.id, hp: summon.hp, distanceRemaining: dist });
                    }
                  }
                  newLogs.push({
                    id: genLogId(), type: 'battle',
                    text: `${monster.name}이(가) ${skill.skillName}!`,
                    timestamp: Date.now(),
                  });
                }
                break;
              }
              case 'POLY': {
                if (skill.polyEffect === 'heal') {
                  const healAmt = skill.polyValue ?? Math.floor(monster.hp * 0.1);
                  monsterHp = Math.min(monster.hp, monsterHp + healAmt);
                  newLogs.push({
                    id: genLogId(), type: 'battle',
                    text: `${monster.name}의 ${skill.skillName}! (+${healAmt} HP, HP: ${monsterHp}/${monster.hp})`,
                    timestamp: Date.now(),
                  });
                }
                break;
              }
            }

            // 쿨다운 설정
            if (skill.cooldownTicks) {
              mobSkillCooldowns[cdKey] = skill.cooldownTicks;
            }
            break; // 틱당 1스킬만 발동
          }
        }
      }

      // ── 합류 몬스터 반격 (L1J D20) ──
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
            const jmHitRate = calcMonsterHitRate(jm.level, 0);
            const { hit: jmHit } = rollD20NpcPcHit(jmHitRate, effectivePlayerAC);
            if (jmHit) {
              const acRed = calcPcDefense(effectivePlayerAC, state.playerClass);
              const shackleRedJ = windShackleTicks > 0 ? 0.7 : 1.0;
              const jmFinalDmg = Math.max(1, Math.floor((rawJDmg - acRed) * shackleRedJ));
              newCurrentHp = Math.max(0, newCurrentHp - jmFinalDmg);
              newLogs.push({
                id: genLogId(), type: 'hit_taken',
                text: `[합류] ${jm.name}의 공격! -${jmFinalDmg} HP (HP: ${newCurrentHp}/${newMaxHp + hpBonus})`,
                timestamp: Date.now(),
              });
            } else {
              evasionCount++;
            }
          }
        }
      }

      // ── 회피 로그 배칭 (AC 높을 때 로그 폭주 방지) ──
      if (evasionCount > 0) {
        newLogs.push({
          id: genLogId(), type: 'miss',
          text: evasionCount === 1
            ? `적의 공격을 회피!`
            : `적의 공격을 ${evasionCount}회 회피!`,
          timestamp: Date.now(),
        });
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

      // ── 스킬 자동 힐 (HP 30% 이하, MP 충분 시) ──
      if (newCurrentHp > 0 && huntMp > 0) {
        const hpPct = (newCurrentHp / (newMaxHp + hpBonus)) * 100;
        if (hpPct <= 30) {
          const healSpell = getBestHealSpell(state.playerClass, state.level, huntMp, equipped, disabled);
          if (healSpell && (skillCooldowns[healSpell.id] ?? 0) <= 0) {
            huntMp -= healSpell.consumeMp;
            const healAmt = rollSpellDamage(
              healSpell.damageValue, healSpell.damageDice, healSpell.damageDiceCount,
              playerInt, totalSp, state.level, state.playerClass,
            );
            newCurrentHp = Math.min(newMaxHp + hpBonus, newCurrentHp + healAmt);
            skillCooldowns[healSpell.id] = healSpell.reuseDelayTicks || 1;
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

      // ── 물약 자동 사용 (쿨타임: 1틱 = 3초) ──
      const POTION_COOLDOWN_MS = 3000;
      const potionCooldownReady = now - state.lastPotionUsedAt >= POTION_COOLDOWN_MS;
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
      }

      // ── 상태 업데이트 ──
      set({
        gold: newGold, exp: newExp, level: newLevel, title: newTitle,
        maxHp: newMaxHp, currentHp: newCurrentHp,
        inventory: newInventory, materials: newMaterials,
        potions: newPotions, activeBuffs: newActiveBuffs,
        lastPotionUsedAt: newLastPotionUsedAt,
        combatLog: [...state.combatLog, ...newLogs].slice(-80),
        hunt: {
          ...hunt,
          kills: newKills, roomKills: newRoomKills, roomCleared: newRoomCleared,
          goldGained: huntGold, materialsGained: gainedMats, itemsFound: newItems,
          currentFightTicks: killed ? 0 : fightTicks,
          fightStartedAt: killed ? Date.now() : hunt.fightStartedAt,
          currentTargetId: nextTargetId, monsterCurrentHp: nextMonsterHp,
          joinedMonsters: currentJoined, approachingMonsters: currentApproaching,
          mobSkillCooldowns,
          lastMagicHitAt: newLastMagicHitAt,
          consecutiveMagicHits: newConsecutiveMagicHits,
          currentMp: huntMp,
          lastHpRegenAt,
          lastMpRegenAt,
          skillCooldowns,
          monsterStunnedTicks,
          windShackleTicks,
          monsterAtkAccum: killed ? 0 : monsterAtkAccum,
          // 킬 후 접속자 수에 따른 리젠 대기 (다른 유저 1명당 1틱 대기)
          regenWaitTicks: killed ? Math.max(0, state.zonePlayerCount - 1 - guildMatesInZone) : hunt.regenWaitTicks,
        },
      });

      if (killed && newKills % 10 === 0) save(get());

      if (shouldAdvanceFloor) {
        setTimeout(() => get().moveToNextFloor(false), 1500);
      }
    },
  };
}
