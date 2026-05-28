/* =========================================================
   COMBAT PLAYER ATTACK — 플레이어 → 몬스터 공격 (D20 3갈래)

   combatTick.ts에서 분리된 순수 함수 모듈.
   D20 명중, 무기 스킬, 클래스 스킬 포함.
   게임 로직 변경 없이 코드 구조만 분리.
   ========================================================= */
import {
  rollDamage, rollBowDamage, rollMagicDamage, rollMagicCritical,
  applyMagicReduction, magicReduction,
  calcPlayerHitRate, rollD20PcNpcHit,
  rollSpellDamage, calcAttrBonus,
  rollPhysicalSkillDamage,
} from '../data/statFormulas';
import { getAvailableSkills } from '../data/playerSkillData';
import { getWeaponSkill } from '../data/weaponSkillData';
import { CLASS_CONFIGS } from '../data/classData';
import { secureRandom, secureRandomInt } from '../lib/random';
import { genLogId } from './helpers';
import type {
  LogEntry, Monster, Equipment,
  PlayerClass, KnightSubclass, CombatStyle,
} from '../types';

// ══════════════════════════════════════════════
// 입출력 인터페이스
// ══════════════════════════════════════════════

export interface PlayerAttackInput {
  // 플레이어 기본
  playerClass: PlayerClass;
  level: number;
  subclass: KnightSubclass | null;
  combatStyle: CombatStyle;

  // 유효 스탯 (버프 적용 후)
  effectiveStr: number;
  effectiveDex: number;
  playerInt: number;

  // 장비 보너스
  weaponEnchant: number;
  weaponBaseDmg: number;
  equippedWeapon: Equipment | null;
  equipBonusHit: number;
  equipBonusExtraDmg: number;
  equipBonusBowHit: number;
  equipBonusBowDmg: number;
  equipBonusMagicDmg: number;

  // 버프 보너스
  skillBuffHit: number;
  skillBuffDmg: number;
  skillBuffFireDmg: number;
  totalSp: number;

  // 몬스터
  monster: Monster;
  monsterHp: number;

  // 언데드 보너스 (사전 계산)
  undeadBonus: number;
  undeadText: string;

  // 스킬 상태 (변경되어 반환)
  equippedSkills: number[];
  disabledSkills: number[];
  skillCooldowns: Record<number, number>;
  mp: number;
  maxMp: number;
  skillMpThreshold: number; // MP% 임계치 (0~100)
  materials: Record<string, number>;

  // 시간
  now: number;
}

export interface PlayerAttackResult {
  monsterHp: number;
  logs: LogEntry[];
  killed: boolean;
  playerAttackHit: boolean;
  isCrit: boolean;
  finalDmg: number;
  usedSpellName: string;
  // 변경된 상태
  mp: number;
  materials: Record<string, number>;
  skillCooldowns: Record<number, number>;
  windShackleTicks: number;  // 윈드 셰클에 의한 변경
}

// ══════════════════════════════════════════════
// 메인 함수
// ══════════════════════════════════════════════

export function executePlayerAttack(input: PlayerAttackInput, windShackleTicks: number): PlayerAttackResult {
  const {
    playerClass, level, subclass, combatStyle,
    effectiveStr, effectiveDex, playerInt,
    weaponEnchant, weaponBaseDmg, equippedWeapon,
    equipBonusHit, equipBonusExtraDmg, equipBonusBowHit, equipBonusBowDmg, equipBonusMagicDmg,
    skillBuffHit, skillBuffDmg, skillBuffFireDmg, totalSp,
    monster, undeadBonus,
    equippedSkills, disabledSkills, now,
  } = input;

  const logs: LogEntry[] = [];
  const materials = input.materials;     // 호출자가 복사본 전달
  const skillCooldowns = input.skillCooldowns; // 호출자가 복사본 전달
  let monsterHp = input.monsterHp;
  let huntMp = input.mp;
  let newWindShackleTicks = windShackleTicks;

  let playerAttackHit = false;
  let finalDmg = 0;
  let isCrit = false;
  let usedSpellName = '';

  // ── 플레이어 → 몬스터 공격 (3갈래 분기 — L1J D20) ──

  if (combatStyle === 'ranged_magic') {
    // ── 마법사: 에너지 볼트 기본 공격 (MP 미소모, 자동 명중, 매 틱 발동) ──
    playerAttackHit = true;
    const rawMagic = rollMagicDamage(
      weaponBaseDmg, playerInt, totalSp,
      level, playerClass,
    );
    const { isCrit: magicCrit } = rollMagicCritical();
    isCrit = magicCrit;
    const critDmg = isCrit ? Math.floor(rawMagic * 1.5) : rawMagic;
    const afterMr = applyMagicReduction(critDmg, monster.mr);
    finalDmg = afterMr + equipBonusMagicDmg + undeadBonus;
    usedSpellName = '에너지 볼트';
  } else {
    // ── 기사/요정: D20 명중 판정 ──
    usedSpellName = CLASS_CONFIGS[playerClass].atkName;
    const hitBonusForBow = combatStyle === 'ranged_bow' ? equipBonusBowHit : 0;
    const hitRate = calcPlayerHitRate(
      level, effectiveStr, effectiveDex,
      weaponEnchant, equipBonusHit + hitBonusForBow + skillBuffHit,
    );
    const { hit } = rollD20PcNpcHit(hitRate, monster.ac);
    playerAttackHit = hit;

    if (hit) {
      if (combatStyle === 'ranged_bow') {
        // 요정: DEX 기반 활 대미지
        const bowDmg = rollBowDamage(weaponBaseDmg, level, weaponEnchant, effectiveDex);
        // 은 화살 소모 (L1J L1Attack.java — 매 발사마다 1개 소모)
        let silverArrowDmg = 0;
        const silverArrowKey = 'e_40744';
        const silverArrowCount = materials[silverArrowKey] ?? 0;
        if (silverArrowCount > 0) {
          materials[silverArrowKey] = silverArrowCount - 1;
          silverArrowDmg = secureRandomInt(1, 7); // dmg_small=7: random(0~6)+1
          if (monster.undead) {
            silverArrowDmg += secureRandomInt(1, 20); // 은 재질 vs 언데드 보너스
          }
        }
        finalDmg = bowDmg + equipBonusExtraDmg + equipBonusBowDmg + skillBuffDmg + skillBuffFireDmg + undeadBonus + silverArrowDmg;
      } else {
        // 기사: STR 기반 근접 대미지
        finalDmg = rollDamage(weaponBaseDmg, level, weaponEnchant, effectiveStr)
          + equipBonusExtraDmg + skillBuffDmg + skillBuffFireDmg + undeadBonus;
      }
      isCrit = secureRandom() < 0.1;
      finalDmg = isCrit ? Math.floor(finalDmg * 1.5) : finalDmg;
    }
  }

  if (!playerAttackHit) {
    logs.push({
      id: genLogId(), type: 'miss',
      text: `${monster.name}에게 ${usedSpellName || '공격'}이(가) 빗나갔습니다!`,
      timestamp: Date.now(),
    });
  } else {
    monsterHp = Math.max(0, monsterHp - finalDmg);

    // ── 무기 특수 스킬 발동 (L1J weapon_skills.csv) ──
    if (monsterHp > 0 && equippedWeapon) {
      const wSkill = getWeaponSkill(equippedWeapon.templateId);
      if (wSkill) {
        const effectiveProb = wSkill.probability + wSkill.probEnchant * weaponEnchant;
        if (secureRandomInt(1, 100) <= effectiveProb) {
          if (wSkill.fixDamage > 0) {
            let weaponSkillDmg = wSkill.fixDamage
              + (wSkill.randomDamage > 0 ? secureRandomInt(0, wSkill.randomDamage - 1) : 0);
            if (wSkill.enableMr && monster.mr > 0) {
              weaponSkillDmg = applyMagicReduction(weaponSkillDmg, monster.mr);
            }
            weaponSkillDmg = Math.max(1, weaponSkillDmg);
            monsterHp = Math.max(0, monsterHp - weaponSkillDmg);
            logs.push({
              id: genLogId(), type: 'battle',
              text: `${wSkill.skillName} 발동! ${monster.name}에게 ${weaponSkillDmg} 추가 대미지${monster.mr > 0 ? ` (MR ${Math.round(magicReduction(monster.mr) * 100)}%)` : ''}`,
              timestamp: Date.now(),
            });
          } else {
            logs.push({
              id: genLogId(), type: 'battle',
              text: `${wSkill.skillName} 발동!`,
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    // ── 클래스 스킬 사용 (슬롯 순서대로 + MP% 임계치) ──
    const equipped = equippedSkills ?? [];
    const disabled = disabledSkills ?? [];
    const mpPct = input.maxMp > 0 ? (huntMp / input.maxMp) * 100 : 0;
    const mpThreshold = input.skillMpThreshold ?? 0;
    if (monsterHp > 0 && huntMp > 0 && mpPct >= mpThreshold) {
      // 사용 가능한 공격 스킬 필터
      const allAttackSkills = getAvailableSkills(playerClass, level, subclass)
        .filter(s => s.skillType === 'attack' && s.consumeMp <= huntMp
          && (skillCooldowns[s.id] ?? 0) <= now && equipped.includes(s.id) && !disabled.includes(s.id)
          && (!s.consumeItemId || (materials[`e_${s.consumeItemId}`] ?? 0) >= (s.consumeAmount ?? 0)));

      // 슬롯 순서대로 정렬 (equippedSkills 배열 인덱스 = 슬롯 번호)
      const attackSkillMap = new Map(allAttackSkills.map(s => [s.id, s]));
      let classSkill = null as typeof allAttackSkills[0] | null;
      for (const slotId of equipped) {
        if (slotId > 0 && attackSkillMap.has(slotId)) {
          classSkill = attackSkillMap.get(slotId)!;
          break;
        }
      }

      if (classSkill) {
        huntMp -= classSkill.consumeMp;
        skillCooldowns[classSkill.id] = now + (classSkill.reuseDelayMs || 3000);
        // 재료 소모
        if (classSkill.consumeItemId && classSkill.consumeAmount) {
          const matKey = `e_${classSkill.consumeItemId}`;
          materials[matKey] = (materials[matKey] ?? 0) - classSkill.consumeAmount;
        }
        const sMLabel = classSkill.consumeItemId === 40319 ? '정령옥' : classSkill.consumeItemId === 40318 ? '마력의돌' : '';
        const sMText = sMLabel && classSkill.consumeAmount ? ` (${sMLabel} -${classSkill.consumeAmount})` : '';

        if (classSkill.id === 132) {
          // 트리플 애로우: 3회 활 공격
          let tripleTotal = 0;
          for (let i = 0; i < 3; i++) {
            const bowDmg = rollBowDamage(weaponBaseDmg, level, weaponEnchant, effectiveDex);
            const arrowDmg = bowDmg + equipBonusExtraDmg + equipBonusBowDmg + skillBuffDmg + skillBuffFireDmg;
            tripleTotal += arrowDmg;
          }
          monsterHp = Math.max(0, monsterHp - tripleTotal);
          logs.push({
            id: genLogId(), type: 'skill',
            text: `${classSkill.name}! ${monster.name}에게 ${tripleTotal} 대미지 (3연발)${sMText}`,
            timestamp: Date.now(),
          });
        } else if (classSkill.id === 167) {
          // 윈드 셰클: 몬스터 공격/이동 속도 감소 3틱
          newWindShackleTicks = 3;
          logs.push({
            id: genLogId(), type: 'skill',
            text: `${classSkill.name}! ${monster.name}의 공격 속도 감소! (3턴)${sMText}`,
            timestamp: Date.now(),
          });
        } else if (classSkill.skillCircle > 0 && classSkill.damageDiceCount > 0) {
          // 서클 마법 공격 (기사/요정이 장착한 공격 마법 자동 시전)
          const classSpellAttrBonus = calcAttrBonus(classSkill.attr, monster.attr);
          const spellDmg = rollSpellDamage(
            classSkill.damageValue, classSkill.damageDice, classSkill.damageDiceCount,
            playerInt, totalSp, level, playerClass, classSpellAttrBonus,
          );
          const afterMr = applyMagicReduction(spellDmg, monster.mr);
          const skillFinalDmg = Math.max(1, afterMr);
          monsterHp = Math.max(0, monsterHp - skillFinalDmg);
          const mrPct = Math.round(magicReduction(monster.mr) * 100);
          logs.push({
            id: genLogId(), type: 'skill',
            text: `${classSkill.name}! ${monster.name}에게 ${skillFinalDmg} 마법 대미지${mrPct > 0 ? ` (MR ${mrPct}%)` : ''}${sMText}`,
            timestamp: Date.now(),
          });
        } else if (classSkill.skillCategory === 'technique' && classSkill.skillType === 'attack') {
          // 공격형 기사: STR 기반 물리 스킬 (MR 무시)
          const physDmg = rollPhysicalSkillDamage(
            classSkill.damageValue, classSkill.damageDice, classSkill.damageDiceCount,
            level, weaponEnchant, effectiveStr,
          );
          const physFinal = physDmg + equipBonusExtraDmg + skillBuffDmg + skillBuffFireDmg + undeadBonus;
          monsterHp = Math.max(0, monsterHp - physFinal);
          logs.push({
            id: genLogId(), type: 'skill',
            text: `${classSkill.name}! ${monster.name}에게 ${physFinal} 물리 대미지${sMText}`,
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  const killed = monsterHp <= 0;

  return {
    monsterHp,
    logs,
    killed,
    playerAttackHit,
    isCrit,
    finalDmg,
    usedSpellName,
    mp: huntMp,
    materials,
    skillCooldowns,
    windShackleTicks: newWindShackleTicks,
  };
}
