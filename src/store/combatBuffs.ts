/* =========================================================
   COMBAT BUFFS — 버프/물약/변신/패시브/MP 관리

   combatTick.ts에서 분리된 순수 함수 모듈.
   게임 로직 변경 없이 코드 구조만 분리.
   ========================================================= */
import {
  POTIONS, POTION_ORDER,
  getTransformScrollSpeed, TRANSFORM_SCROLL_DURATION,
} from '../data/gameData';
import {
  getPassiveBuffs, getAvailableBuffs,
} from '../data/playerSkillData';
import {
  calcMpRegenAmount, calcBluePotionMpBonus, MP_REGEN_INTERVAL_MS,
} from '../data/statFormulas';
import { genLogId } from './helpers';
import type { LogEntry, ActiveBuff, PlayerClass, KnightSubclass } from '../types';

// ══════════════════════════════════════════════
// 입출력 인터페이스
// ══════════════════════════════════════════════

export interface BuffProcessInput {
  // 플레이어 상태
  playerClass: PlayerClass;
  level: number;
  subclass: KnightSubclass | null;
  activeBuffs: ActiveBuff[];
  equippedSkills: number[];
  disabledSkills: number[];

  // 토글 설정
  transformScrollEnabled: boolean;
  transformScrollType?: string;
  bluePotionEnabled: boolean;
  greenPotionEnabled: boolean;
  couragePotionEnabled: boolean;

  // 장비 파생값 (사전 계산)
  hasEquipHaste: boolean;
  equipBonusSp: number;
  equipMpr: number;
  playerWis: number;

  // 사냥 세션
  currentMp: number;
  maxMp: number;
  lastMpRegenAt: number;
  skillCooldowns: Record<number, number>;

  // 복사본 (변경되어 반환)
  materials: Record<string, number>;
  potions: Record<string, number>;

  // 시간
  now: number;
}

export interface BuffProcessResult {
  activeBuffs: ActiveBuff[];
  mp: number;
  materials: Record<string, number>;
  potions: Record<string, number>;
  logs: LogEntry[];
  skillCooldowns: Record<number, number>;
  lastMpRegenAt: number;
  totalSp: number;
  // 스킬 버프 보너스 (오케스트레이터가 유효 스탯 계산에 사용)
  skillBuffHit: number;
  skillBuffDmg: number;
  skillBuffFireDmg: number;
  skillBuffAc: number;
  skillBuffStr: number;
  skillBuffDex: number;
}

// ══════════════════════════════════════════════
// 메인 함수
// ══════════════════════════════════════════════

export function processBuffsAndPotions(input: BuffProcessInput): BuffProcessResult {
  const {
    playerClass, level, subclass, equippedSkills, disabledSkills,
    transformScrollEnabled, transformScrollType,
    bluePotionEnabled, greenPotionEnabled, couragePotionEnabled,
    hasEquipHaste, equipBonusSp, equipMpr, playerWis,
    maxMp, now,
  } = input;

  const logs: LogEntry[] = [];
  const materials = input.materials;   // 이미 호출자가 복사본 전달
  const potions = input.potions;       // 이미 호출자가 복사본 전달
  const skillCooldowns = input.skillCooldowns; // 이미 호출자가 복사본 전달
  let huntMp = input.currentMp;
  let lastMpRegenAt = input.lastMpRegenAt;

  // ── 버프 물약 자동 사용 ──
  let newActiveBuffs = [...input.activeBuffs].filter(b => b.expiresAt > now);

  // 헤이스트 그룹 중복 체크 (장비/스킬 헤이스트 있으면 초록물약 스킵)
  const HASTE_SKILL_IDS = new Set([43, 87, 149, 150]);
  const hasSkillHaste = newActiveBuffs.some(b => b.skillId && HASTE_SKILL_IDS.has(b.skillId) && b.expiresAt > now);
  const hasAnyHaste = hasEquipHaste || hasSkillHaste;

  for (const pid of POTION_ORDER) {
    const p = POTIONS[pid];
    if (!p.buffDuration) continue;
    // 클래스 제한 체크 (L1J: 용기=기사, 와퍼=요정, 지혜=마법사)
    if (p.classRestriction && !p.classRestriction.includes(playerClass)) continue;
    if (pid === 'blue_potion' && !bluePotionEnabled) continue;
    if (pid === 'green_potion' && !greenPotionEnabled) continue;
    // 장비/스킬 헤이스트와 초록물약 중복 불가 (L1J: 동일 haste 그룹)
    if (pid === 'green_potion' && hasAnyHaste) continue;
    // brave 계열 (용기/와퍼/지혜) — 동일 토글 사용
    if ((pid === 'courage_potion' || pid === 'elven_wafer' || pid === 'wisdom_potion') && !couragePotionEnabled) continue;
    const alreadyActive = newActiveBuffs.some(b => b.potionId === pid);
    if (alreadyActive) continue;
    const pCount = potions[pid] ?? 0;
    if (pCount <= 0) continue;
    potions[pid] = pCount - 1;
    newActiveBuffs.push({
      potionId: pid, name: p.name,
      expiresAt: now + p.buffDuration * 1000,
      atkSpeedMult: p.atkSpeedMult ?? 1,
      moveSpeedMult: p.moveSpeedMult ?? 1,
      spBonus: p.spBonus ?? 0,
    });
    logs.push({
      id: genLogId(), type: 'potion',
      text: `${p.name} 사용! (${p.buffDuration >= 60 ? `${Math.floor(p.buffDuration / 60)}분` : `${p.buffDuration}초`})`,
      timestamp: now,
    });
  }

  // ── 패시브 버프 상시 적용 (습득 조건 충족 시 만료 없이 활성) ──
  const passives = getPassiveBuffs(playerClass, level, subclass);
  const validPassiveIds = new Set(passives.map(pb => pb.id));
  // 현재 클래스/레벨에서 무효한 패시브 제거 (이전 버전 잔존 데이터 정리)
  newActiveBuffs = newActiveBuffs.filter(b =>
    !b.potionId?.startsWith('passive_') || validPassiveIds.has(b.skillId ?? 0),
  );
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
        strBonus: pb.buffEffect?.strBonus,
        dexBonus: pb.buffEffect?.dexBonus,
      });
    }
  }

  // 지혜의 물약 SP 보너스 (L1J: SP+2, 마법 대미지 계수 증가)
  const buffSpBonus = newActiveBuffs.reduce((s, b) => s + (b.spBonus ?? 0), 0);
  const totalSp = equipBonusSp + buffSpBonus;

  // ── 변신주문서 자동 사용 ──
  if (transformScrollEnabled) {
    const existingTsBuff = newActiveBuffs.find(b => b.potionId === 'transform_scroll');
    const scrollType = transformScrollType ?? 'normal';
    // 타입 변경 감지: 기존 버프 이름과 현재 설정이 다르면 교체
    const wantEventName = scrollType === 'event' ? '이벤트 변신주문서' : '변신주문서';
    const needReplace = existingTsBuff && existingTsBuff.name !== wantEventName;
    if (needReplace) {
      newActiveBuffs = newActiveBuffs.filter(b => b.potionId !== 'transform_scroll');
    }
    if (!existingTsBuff || needReplace) {
      const scrollId = scrollType === 'event' ? 'event_transform_scroll' : 'transform_scroll';
      const scrollCount = materials[scrollId] ?? 0;
      if (scrollCount > 0) {
        materials[scrollId] = scrollCount - 1;
        const speeds = scrollType === 'event'
          ? getTransformScrollSpeed(80)   // 이벤트: Lv.80 고정
          : getTransformScrollSpeed(level);
        const scrollName = scrollType === 'event' ? '이벤트 변신주문서' : '변신주문서';
        newActiveBuffs.push({
          potionId: 'transform_scroll',
          name: scrollName,
          expiresAt: now + TRANSFORM_SCROLL_DURATION * 1000,
          atkSpeedMult: speeds.atk,
          moveSpeedMult: speeds.move,
        });
        logs.push({
          id: genLogId(), type: 'potion',
          text: `${scrollName} 사용! (${Math.floor(TRANSFORM_SCROLL_DURATION / 60)}분)`,
          timestamp: now,
        });
      }
    }
  }

  // ── MP 자연 회복 (벽시계 기준 16초 고정 주기) ──
  // 00:00:00 기준 16초마다 회복. 공격속도 버프와 무관.
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
  const equipped = equippedSkills ?? [];
  const disabled = disabledSkills ?? [];
  if (huntMp > 0) {
    const activeSkillBuffIds = newActiveBuffs
      .filter(b => b.skillId != null && b.skillId > 0 && b.expiresAt > now)
      .map(b => b.skillId!);
    const buffSkills = getAvailableBuffs(playerClass, level, huntMp, activeSkillBuffIds, subclass)
      .filter(s => equipped.includes(s.id) && !disabled.includes(s.id));
    // 초록물약 활성 여부 (헤이스트 스킬 중복 방지용)
    const hasGreenBuff = newActiveBuffs.some(b => b.potionId === 'green_potion' && b.expiresAt > now);
    for (const buff of buffSkills) {
      if (huntMp < buff.consumeMp) continue;
      // 쿨다운 체크 (타임스탬프 기반)
      if ((skillCooldowns[buff.id] ?? 0) > now) continue;
      // 헤이스트 스킬은 장비/초록물약 헤이스트와 중복 불가
      if (HASTE_SKILL_IDS.has(buff.id) && (hasEquipHaste || hasGreenBuff)) continue;
      // 재료 소모 체크
      if (buff.consumeItemId && buff.consumeAmount) {
        const matKey = `e_${buff.consumeItemId}`;
        const owned = materials[matKey] ?? 0;
        if (owned < buff.consumeAmount) continue;
        materials[matKey] = owned - buff.consumeAmount;
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
        strBonus: buff.buffEffect?.strBonus,
        dexBonus: buff.buffEffect?.dexBonus,
      });
      skillCooldowns[buff.id] = now + (buff.reuseDelayMs || 3000);
      const matLabel = buff.consumeItemId === 40319 ? '정령옥' : buff.consumeItemId === 40318 ? '마력의돌' : '';
      const matText = matLabel && buff.consumeAmount ? ` (${matLabel} -${buff.consumeAmount})` : '';
      logs.push({
        id: genLogId(), type: 'skill',
        text: `${buff.name} 시전! (${Math.floor(buff.buffDuration / 60)}분)${matText}`,
        timestamp: now,
      });
    }
  }

  // ── 스킬 버프 보너스 수집 ──
  const activeSkillBuffs = newActiveBuffs.filter(b => b.skillId && b.expiresAt > now);
  const skillBuffHit = activeSkillBuffs.reduce((s, b) => s + (b.hitBonus ?? 0), 0);
  const skillBuffDmg = activeSkillBuffs.reduce((s, b) => s + (b.dmgBonus ?? 0), 0);
  const skillBuffFireDmg = activeSkillBuffs.reduce((s, b) => s + (b.fireDmgBonus ?? 0), 0);
  const skillBuffAc = activeSkillBuffs.reduce((s, b) => s + (b.acBonus ?? 0), 0);
  const skillBuffStr = activeSkillBuffs.reduce((s, b) => s + (b.strBonus ?? 0), 0);
  const skillBuffDex = activeSkillBuffs.reduce((s, b) => s + (b.dexBonus ?? 0), 0);

  return {
    activeBuffs: newActiveBuffs,
    mp: huntMp,
    materials,
    potions,
    logs,
    skillCooldowns,
    lastMpRegenAt,
    totalSp,
    skillBuffHit,
    skillBuffDmg,
    skillBuffFireDmg,
    skillBuffAc,
    skillBuffStr,
    skillBuffDex,
  };
}
