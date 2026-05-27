/* =========================================================
   COMBAT MONSTER ATTACK — 몬스터 → 플레이어 반격 + 스킬 AI

   combatTick.ts에서 분리된 순수 함수 모듈.
   D20 NPC→PC 명중, AC 방어, MR 감소, 연속 마법 감쇠,
   몬스터 스킬 AI (4종 행동 + 5종 트리거), 합류 몬스터 반격.
   게임 로직 변경 없이 코드 구조만 분리.
   ========================================================= */
import {
  rollMonsterDamage, applyMagicReduction, magicReduction,
  finalMR, calcMonsterHitRate, rollD20NpcPcHit, calcPcDefense,
  consecutiveMagicDecay,
} from '../data/statFormulas';
import { getMonsterSkills } from '../data/monsterSkillData';
import { secureRandom, secureRandomInt } from '../lib/random';
import { genLogId } from './helpers';
import type {
  LogEntry, Monster, PlayerClass,
  ApproachingMonster, JoinedMonster,
} from '../types';

// ══════════════════════════════════════════════
// 입출력 인터페이스
// ══════════════════════════════════════════════

export interface MonsterAttackInput {
  // 전투 상태
  killed: boolean;
  monsterHp: number;
  monster: Monster;

  // 플레이어 방어 스탯
  currentHp: number;
  maxHp: number;
  hpBonus: number;
  playerWis: number;
  playerClass: PlayerClass;
  level: number;
  equipBonusMr: number;
  effectivePlayerAC: number;

  // 몬스터 공격 타이밍
  monsterAtkAccum: number;
  effectiveMonsterAtkSpeed: number;
  monsterCanAttack: boolean;

  // 마법 연속 감쇠 추적
  lastMagicHitAt: number;
  consecutiveMagicHits: number;

  // 몬스터 스킬
  mobSkillCooldowns: Record<string, number>;

  // 합류/접근 몬스터
  currentJoined: JoinedMonster[];
  currentApproaching: ApproachingMonster[];
  justArrivedIds: Set<string>;
  windShackleTicks: number;

  // 몬스터 목록 (합류 몬스터 조회용)
  monsters: Monster[];
  zoneMonsters: Monster[];

  // 시간
  now: number;
}

export interface MonsterAttackResult {
  currentHp: number;
  monsterHp: number;
  logs: LogEntry[];
  evasionCount: number;
  lastMagicHitAt: number;
  consecutiveMagicHits: number;
  monsterAtkAccum: number;
  mobSkillCooldowns: Record<string, number>;
  currentApproaching: ApproachingMonster[];
  currentJoined: JoinedMonster[];
}

// ══════════════════════════════════════════════
// 메인 함수
// ══════════════════════════════════════════════

export function executeMonsterAttack(input: MonsterAttackInput): MonsterAttackResult {
  const {
    killed, monster,
    maxHp, hpBonus, playerWis, playerClass, level,
    equipBonusMr, effectivePlayerAC,
    effectiveMonsterAtkSpeed, monsterCanAttack,
    justArrivedIds, windShackleTicks,
    monsters, zoneMonsters, now,
  } = input;

  const logs: LogEntry[] = [];
  let currentHp = input.currentHp;
  let monsterHp = input.monsterHp;
  let monsterAtkAccum = input.monsterAtkAccum;
  let lastMagicHitAt = input.lastMagicHitAt;
  let consecutiveMagicHits = input.consecutiveMagicHits;
  const mobSkillCooldowns = { ...input.mobSkillCooldowns };
  let currentApproaching = [...input.currentApproaching];
  let currentJoined = [...input.currentJoined];
  let evasionCount = 0;

  // ══════════════════════════════════════════════
  // 주 타겟 반격 (L1J D20 NPC→PC + atk_speed 비율 기반)
  // ══════════════════════════════════════════════

  if (!killed && monsterHp > 0 && currentHp > 0 && monsterCanAttack) {
    // 누적 시간이 공격 딜레이에 도달할 때마다 공격 (한 틱에 여러 번 가능)
    let monsterAttackCount = 0;
    while (monsterAtkAccum >= effectiveMonsterAtkSpeed && currentHp > 0) {
      monsterAtkAccum -= effectiveMonsterAtkSpeed;
      monsterAttackCount++;
      if (monsterAttackCount > 3) break; // 안전장치: 한 틱 최대 3회

      const rawMonsterDmg = rollMonsterDamage(monster.damDice, monster.damDiceSides, monster.extraDam);

      if (monster.attackType === 'magic') {
        const playerMR = finalMR(level, playerWis) + equipBonusMr;
        let reduced = applyMagicReduction(rawMonsterDmg, playerMR);
        const pct = Math.round(magicReduction(playerMR) * 100);

        // 연속 마법 감쇠 (L1J: 2초 내 (2/3)^n, PC 타겟만)
        const elapsed = now - lastMagicHitAt;
        let consecutive: number;
        if (elapsed < 2000) {
          consecutive = consecutiveMagicHits;
        } else if (elapsed < 4000) {
          consecutive = consecutiveMagicHits; // 전이 구간: 유지
        } else {
          consecutive = 0;
        }
        reduced = Math.max(1, Math.floor(reduced * consecutiveMagicDecay(consecutive)));
        if (elapsed < 2000) consecutive++;
        lastMagicHitAt = now;
        consecutiveMagicHits = consecutive;

        currentHp = Math.max(0, currentHp - reduced);
        logs.push({
          id: genLogId(), type: 'hit_taken',
          text: `${monster.name}의 마법 공격! -${reduced} HP (MR ${pct}% 저항) (HP: ${currentHp}/${maxHp + hpBonus})`,
          timestamp: Date.now(),
        });
      } else {
        // 물리 몬스터: D20 명중 → AC 대미지 감소 (별도 단계)
        const mHitRate = calcMonsterHitRate(monster.level, 0);
        const { hit: monsterHits } = rollD20NpcPcHit(mHitRate, effectivePlayerAC);
        if (monsterHits) {
          // AC 기반 대미지 감소 (L1J calcPcDefense — 명중 판정과 별개)
          const acReduction = calcPcDefense(effectivePlayerAC, playerClass);
          const finalMonsterDmg = Math.max(1, rawMonsterDmg - acReduction);
          currentHp = Math.max(0, currentHp - finalMonsterDmg);
          logs.push({
            id: genLogId(), type: 'hit_taken',
            text: `${monster.name}의 공격! -${finalMonsterDmg} HP (HP: ${currentHp}/${maxHp + hpBonus})`,
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

  // ══════════════════════════════════════════════
  // 몬스터 스킬 AI (L1J mob_skills — 4종 행동 + 5종 트리거)
  // ══════════════════════════════════════════════

  if (!killed && monsterHp > 0 && currentHp > 0) {
    const npcIdMatch = monster.id.match(/^npc_(\d+)$/);
    const npcId = npcIdMatch ? parseInt(npcIdMatch[1], 10) : 0;
    const skills = getMonsterSkills(npcId);

    if (skills.length > 0) {
      for (const skill of skills) {
        const cdKey = `${monster.id}_${skill.skillName}`;
        if ((mobSkillCooldowns[cdKey] ?? 0) > now) continue;

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
            currentHp = Math.max(0, currentHp - skillDmg);
            logs.push({
              id: genLogId(), type: 'hit_taken',
              text: `${monster.name}의 ${skill.skillName}! -${skillDmg} HP (HP: ${currentHp}/${maxHp + hpBonus})`,
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
            const playerMR = finalMR(level, playerWis) + equipBonusMr;
            dmg = applyMagicReduction(dmg, playerMR);
            currentHp = Math.max(0, currentHp - dmg);
            const pct = Math.round(magicReduction(playerMR) * 100);
            logs.push({
              id: genLogId(), type: 'hit_taken',
              text: `${monster.name}의 ${skill.skillName}! -${dmg} HP (마법, MR ${pct}%) (HP: ${currentHp}/${maxHp + hpBonus})`,
              timestamp: Date.now(),
            });
            break;
          }
          case 'SUMMON': {
            if (skill.summonMonsterId && currentApproaching.length + currentJoined.length < 3) {
              const count = skill.summonCount ?? 1;
              for (let i = 0; i < count; i++) {
                const summonId = `npc_${skill.summonMonsterId}`;
                const summon = monsters.find(m => m.id === summonId) ?? zoneMonsters.find(m => m.id === summonId);
                if (summon) {
                  const dist = 10 + secureRandom() * 15;
                  currentApproaching.push({ monsterId: summon.id, hp: summon.hp, distanceRemaining: dist });
                }
              }
              logs.push({
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
              logs.push({
                id: genLogId(), type: 'battle',
                text: `${monster.name}의 ${skill.skillName}! (+${healAmt} HP, HP: ${monsterHp}/${monster.hp})`,
                timestamp: Date.now(),
              });
            }
            break;
          }
        }

        // 쿨다운 설정
        if (skill.cooldownMs) {
          mobSkillCooldowns[cdKey] = now + skill.cooldownMs;
        }
        break; // 틱당 1스킬만 발동
      }
    }
  }

  // ══════════════════════════════════════════════
  // 합류 몬스터 반격 (L1J D20)
  // ══════════════════════════════════════════════

  if (currentHp > 0 && currentJoined.length > 0) {
    for (const joined of currentJoined) {
      if (currentHp <= 0) break;
      if (justArrivedIds.has(joined.monsterId)) continue;
      const jm = monsters.find(m => m.id === joined.monsterId) ?? zoneMonsters.find(m => m.id === joined.monsterId);
      if (!jm) continue;
      const rawJDmg = rollMonsterDamage(jm.damDice, jm.damDiceSides, jm.extraDam);

      if (jm.attackType === 'magic') {
        const playerMR = finalMR(level, playerWis) + equipBonusMr;
        const reduced = applyMagicReduction(rawJDmg, playerMR);
        const pct = Math.round(magicReduction(playerMR) * 100);
        currentHp = Math.max(0, currentHp - reduced);
        logs.push({
          id: genLogId(), type: 'hit_taken',
          text: `[합류] ${jm.name}의 마법 공격! -${reduced} HP (MR ${pct}%) (HP: ${currentHp}/${maxHp + hpBonus})`,
          timestamp: Date.now(),
        });
      } else {
        const jmHitRate = calcMonsterHitRate(jm.level, 0);
        const { hit: jmHit } = rollD20NpcPcHit(jmHitRate, effectivePlayerAC);
        if (jmHit) {
          const acRed = calcPcDefense(effectivePlayerAC, playerClass);
          const shackleRedJ = windShackleTicks > 0 ? 0.7 : 1.0;
          const jmFinalDmg = Math.max(1, Math.floor((rawJDmg - acRed) * shackleRedJ));
          currentHp = Math.max(0, currentHp - jmFinalDmg);
          logs.push({
            id: genLogId(), type: 'hit_taken',
            text: `[합류] ${jm.name}의 공격! -${jmFinalDmg} HP (HP: ${currentHp}/${maxHp + hpBonus})`,
            timestamp: Date.now(),
          });
        } else {
          evasionCount++;
        }
      }
    }
  }

  return {
    currentHp,
    monsterHp,
    logs,
    evasionCount,
    lastMagicHitAt,
    consecutiveMagicHits,
    monsterAtkAccum,
    mobSkillCooldowns,
    currentApproaching,
    currentJoined,
  };
}
