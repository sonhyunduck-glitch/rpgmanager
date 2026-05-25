import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { LABEL, STAT_VALUE } from '../../styles/shared';
import { CLASS_CONFIGS } from '../../data/classData';
import { MAX_SKILL_SLOTS, PLAYER_SKILLS } from '../../data/playerSkillData';
import { POTIONS, HEAL_POTION_ORDER, xpForLevel, getTransformScrollSpeed, getBravePotionId } from '../../data/gameData';
import {
  finalAC, finalMR,
  meleeHit,
  minDamage, maxDamage,
  bowMinDamage, bowMaxDamage,
  calcPlayerHitRate,
  magicDamageRange,
  hpGainRange,
  calcHpRegenRange, calcHpRegenIntervalSec,
  calcMpRegenAmount, calcBluePotionMpBonus, calcMpRegenIntervalSec,
} from '../../data/statFormulas';
import { getAllEquipped } from '../../store/storeTypes';
import { useTimer } from '../hunt/BuffPotionButton';
import type { StatKey, Equipment, ActiveBuff } from '../../types';

/* ═══════════════════════════════
   폰트 크기 상수 — 단일 기준
   모바일/PC 동일하게 적용
   ═══════════════════════════════ */
const F = {
  label: 'var(--fs-xs)',   // 라벨 (STR, HP, Weapon 등)
  value: 'var(--fs-sm)',   // 수치 (20, 487/512 등)
  title: 'var(--fs-xs)',   // 섹션 제목
  btn:   '9px',            // 그리드 버튼 라벨
  tiny:  'var(--fs-2xs)',  // 보조 텍스트 (배분 표시 등)
} as const;

/* ═══════════════════════════════
   탭 정의 (이모지 없음, 텍스트만)
   ═══════════════════════════════ */
type LeftTab = 'stats' | 'equip' | 'skills' | 'buffs' | 'consumables' | 'profile';

const TAB_ITEMS: { id: LeftTab | 'empty'; label: string }[] = [
  { id: 'stats',       label: '스탯' },
  { id: 'equip',       label: '장비' },
  { id: 'skills',      label: '스킬' },
  { id: 'buffs',       label: '버프' },
  { id: 'consumables', label: '소모품' },
  { id: 'profile',     label: '정보' },
  { id: 'empty',       label: '' },
  { id: 'empty',       label: '' },
];

const STAT_LABELS: Record<StatKey, { label: string; color: string }> = {
  str: { label: 'STR', color: 'var(--danger)' },
  dex: { label: 'DEX', color: 'var(--success)' },
  con: { label: 'CON', color: 'var(--warning)' },
  wis: { label: 'WIS', color: 'var(--info)' },
  int: { label: 'INT', color: 'var(--accent)' },
};

const CLASS_ICONS: Record<string, string> = { knight: '⚔️', elf: '🏹', wizard: '🔮' };

/* ═══════════════════════════════
   메인 컴포넌트
   ═══════════════════════════════ */
export default function LeftPanel() {
  const [activeTab, setActiveTab] = useState<LeftTab>('stats');

  return (
    <aside style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-elevated)',
      borderRight: '1px solid var(--border-soft)',
      overflow: 'hidden', minWidth: 0,
    }}>
      {/* 상단: 4x2 버튼 그리드 */}
      <div style={{
        flexShrink: 0, padding: '6px',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
        gap: '4px',
      }}>
        {TAB_ITEMS.map((item, i) => {
          const isActive = item.id !== 'empty' && activeTab === item.id;
          const isEmpty = item.id === 'empty';
          return (
            <button
              key={`${item.id}-${i}`}
              onClick={() => { if (!isEmpty) setActiveTab(item.id as LeftTab); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '6px 2px',
                border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                borderRadius: 'var(--r-sm)',
                background: isActive
                  ? 'color-mix(in oklch, var(--accent) 15%, var(--bg-panel))'
                  : 'var(--bg-panel)',
                color: isActive ? 'var(--accent)' : isEmpty ? 'var(--text-faint)' : 'var(--text-mute)',
                cursor: isEmpty ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
                fontFamily: 'var(--font-ui)',
                fontSize: F.btn, fontWeight: 600,
                boxShadow: isActive ? '0 0 6px oklch(0.74 0.17 55 / 0.2)' : 'none',
                opacity: isEmpty ? 0.25 : 1,
              }}
            >
              {isEmpty ? '—' : item.label}
            </button>
          );
        })}
      </div>

      {/* 하단: 콘텐츠 영역 */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '0 6px 6px', paddingTop: '6px',
        display: 'flex', flexDirection: 'column', gap: '5px',
        borderTop: '1px solid var(--border-soft)',
      }}>
        {activeTab === 'stats' && <TabStats />}
        {activeTab === 'equip' && <TabEquip />}
        {activeTab === 'skills' && <TabSkills />}
        {activeTab === 'buffs' && <TabBuffs />}
        {activeTab === 'consumables' && <TabConsumables />}
        {activeTab === 'profile' && <TabProfile />}
      </div>
    </aside>
  );
}

/* ═══════════════════════════════
   Tab: 스탯 + 전투 (통합)
   ═══════════════════════════════ */
function TabStats() {
  const allocateStat = useGameStore(s => s.allocateStat);
  const getStr = useGameStore(s => s.getStr);
  const getDex = useGameStore(s => s.getDex);
  const getCon = useGameStore(s => s.getCon);
  const getWis = useGameStore(s => s.getWis);
  const getInt = useGameStore(s => s.getInt);
  const getRemainingPoints = useGameStore(s => s.getRemainingPoints);
  const statAllocation = useGameStore(s => s.statAllocation);
  const playerClass = useGameStore(s => s.playerClass);
  const level = useGameStore(s => s.level);
  const baseMaxHp = useGameStore(s => s.maxHp);
  const currentHp = useGameStore(s => s.currentHp);
  const getTotalHpBonus = useGameStore(s => s.getTotalHpBonus);
  const getTotalDefense = useGameStore(s => s.getTotalDefense);
  const equippedWeapon = useGameStore(s => s.equippedWeapon);
  const hunt = useGameStore(s => s.hunt);
  const getMaxMp = useGameStore(s => s.getMaxMp);

  const baseStats = CLASS_CONFIGS[playerClass].baseStats;
  const statValues: Record<StatKey, number> = {
    str: getStr(), dex: getDex(), con: getCon(), wis: getWis(), int: getInt(),
  };
  const remaining = getRemainingPoints();

  // 전투 스탯
  const maxHp = baseMaxHp + getTotalHpBonus();
  const str = getStr(); const dex = getDex(); const con = getCon(); const wis = getWis();
  const weaponEnchant = equippedWeapon?.enhanceLevel ?? 0;
  const weaponBaseDmgS = equippedWeapon?.baseAtk ?? 0;
  const weaponBaseDmgL = equippedWeapon?.baseAtkLarge ?? 0;
  const totalDefense = getTotalDefense();
  const state = useGameStore.getState();
  const allSlots = getAllEquipped(state);
  const bonusHit = allSlots.reduce((s, eq) => s + (eq?.bonuses?.hit ?? 0), 0);
  const bonusBowHit = allSlots.reduce((s, eq) => s + (eq?.bonuses?.bowHit ?? 0), 0);
  const bonusBowDmg = allSlots.reduce((s, eq) => s + (eq?.bonuses?.bowDmg ?? 0), 0);
  const bonusExtraDmg = allSlots.reduce((s, eq) => s + (eq?.bonuses?.extraDmg ?? 0), 0);
  const bonusMr = allSlots.reduce((s, eq) => s + (eq?.bonuses?.mr ?? 0), 0);
  const bonusSp = allSlots.reduce((s, eq) => s + (eq?.bonuses?.sp ?? 0), 0);
  const intStat = useGameStore.getState().getInt();

  // ── 클래스별 전투 스탯 분기 ──
  const combatStyle = CLASS_CONFIGS[playerClass].combatStyle;

  let hit: number;
  let dmgMinS: number;
  let dmgMaxS: number;
  let dmgMinL: number;
  let dmgMaxL: number;
  let dmgLabel1: string;
  let dmgLabel2: string;
  let hitLabel: string;

  if (combatStyle === 'ranged_bow') {
    // ── 요정: DEX 기반 활 대미지, D20 hitRate ──
    hit = calcPlayerHitRate(level, str, dex, weaponEnchant, bonusHit + bonusBowHit);
    dmgMinS = bowMinDamage(level, weaponEnchant, dex) + bonusExtraDmg + bonusBowDmg;
    dmgMaxS = bowMaxDamage(weaponBaseDmgS, level, weaponEnchant, dex) + bonusExtraDmg + bonusBowDmg;
    dmgMinL = bowMinDamage(level, weaponEnchant, dex) + bonusExtraDmg + bonusBowDmg;
    dmgMaxL = bowMaxDamage(weaponBaseDmgL, level, weaponEnchant, dex) + bonusExtraDmg + bonusBowDmg;
    hitLabel = 'HIT';
    dmgLabel1 = 'DMG(소)';
    dmgLabel2 = 'DMG(대)';
  } else if (combatStyle === 'ranged_magic') {
    // ── 마법사: INT 기반 마법 대미지, 자동 명중 ──
    hit = -1; // 자동 명중 표시용
    const magicRange = magicDamageRange(weaponBaseDmgS, intStat, bonusSp, level, playerClass);
    const magicAvg = Math.round((magicRange.min + magicRange.max) / 2);
    dmgMinS = magicAvg; // 평균 대미지 (UI 표시용)
    dmgMaxS = magicRange.max;
    dmgMinL = magicRange.min; // min~max 범위 보관
    dmgMaxL = magicRange.max;
    hitLabel = 'HIT';
    dmgLabel1 = 'E.BOLT';
    dmgLabel2 = 'SP';
  } else {
    // ── 기사: STR 기반 근거리 대미지 ──
    hit = meleeHit(level, weaponEnchant, str) + bonusHit;
    dmgMinS = minDamage(level, weaponEnchant, str) + bonusExtraDmg;
    dmgMaxS = maxDamage(weaponBaseDmgS, level, weaponEnchant, str) + bonusExtraDmg;
    dmgMinL = minDamage(level, weaponEnchant, str) + bonusExtraDmg;
    dmgMaxL = maxDamage(weaponBaseDmgL, level, weaponEnchant, str) + bonusExtraDmg;
    hitLabel = 'HIT';
    dmgLabel1 = 'DMG(소)';
    dmgLabel2 = 'DMG(대)';
  }
  const ac = finalAC(totalDefense, level, dex, playerClass);
  const mr = finalMR(level, wis) + bonusMr;
  const hpRange = hpGainRange(con);
  const maxMp = getMaxMp();
  const activeBuffs = useGameStore(s => s.activeBuffs);
  const hasBlueBuff = activeBuffs.some(b => b.potionId === 'blue_potion' && b.expiresAt > Date.now());

  // 장비 HPR/MPR 보너스
  const equipHpr = allSlots.reduce((s, eq) => s + (eq?.bonuses?.hpr ?? 0), 0);
  const equipMpr = allSlots.reduce((s, eq) => s + (eq?.bonuses?.mpr ?? 0), 0);
  // HP 리젠 (L1J: 장비 HPR은 회복량에 가산, 주기는 고정)
  const hpRegenRange = calcHpRegenRange(level, con);
  const hpRegenSec = calcHpRegenIntervalSec(level, playerClass);
  // MP 리젠 (L1J: 장비 MPR은 회복량에 가산, 주기 고정 16초)
  const mpRegenBase = calcMpRegenAmount(wis);
  const mpRegenBlueBonus = hasBlueBuff ? calcBluePotionMpBonus(wis) : 0;
  const mpRegenTotal = mpRegenBase + equipMpr + mpRegenBlueBonus;
  const mpRegenSec = calcMpRegenIntervalSec();

  return (
    <>
      {/* 스탯 포인트 */}
      {remaining > 0 && (
        <div style={{
          background: 'color-mix(in oklch, var(--accent) 12%, transparent)',
          border: '1px solid color-mix(in oklch, var(--accent) 40%, transparent)',
          borderRadius: 'var(--r-sm)',
          padding: '4px 8px', textAlign: 'center',
          fontSize: F.value, color: 'var(--accent)', fontWeight: 600,
        }}>
          스탯 포인트: {remaining}
        </div>
      )}

      {/* 5 스탯 */}
      <SectionTitle>Stats</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {(Object.keys(STAT_LABELS) as StatKey[]).map((key) => {
          const { label, color } = STAT_LABELS[key];
          const base = (baseStats as Record<string, number>)[key] ?? 0;
          const alloc = statAllocation[key];
          return (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'var(--bg-panel)', border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)', padding: '4px 6px',
            }}>
              <span style={{ ...LABEL, fontSize: F.label, color, minWidth: 26 }}>{label}</span>
              <span style={{ ...STAT_VALUE, fontSize: F.value, color }}>{statValues[key]}</span>
              <span style={{ fontSize: F.tiny, color: 'var(--text-faint)' }}>({base}+{alloc})</span>
              {remaining > 0 && (
                <button onClick={() => allocateStat(key)} style={{
                  marginLeft: 'auto', width: 20, height: 20,
                  borderRadius: '50%', border: `1px solid ${color}`,
                  background: 'transparent', color,
                  fontSize: F.tiny, fontWeight: 700,
                  cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', padding: 0,
                }} title={`${label} +1`}>+</button>
              )}
            </div>
          );
        })}
      </div>

      {/* 전투 스탯 */}
      <SectionTitle>Combat</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
        <CombatCell label="HP" value={`${currentHp}/${maxHp}`}
          color={currentHp > maxHp * 0.6 ? 'var(--success)' : currentHp > maxHp * 0.3 ? 'var(--warning)' : 'var(--danger)'} />
        <CombatCell label="MP" value={`${hunt.currentMp}/${maxMp}`} color="var(--info)" />
        <CombatCell label={hitLabel} value={hit === -1 ? '자동' : hit} color={hit === -1 ? 'var(--info)' : 'var(--text)'} />
        <CombatCell label="AC" value={ac} color="var(--success)" />
        {combatStyle === 'ranged_magic' ? (
          <>
            <CombatCell label={dmgLabel1} value={`~${dmgMinS}`} color="var(--info)" />
            <CombatCell label={dmgLabel2} value={`+${bonusSp}`} color="var(--info)" />
          </>
        ) : (
          <>
            <CombatCell label={dmgLabel1} value={`${dmgMinS}~${dmgMaxS}`} color="var(--warning)" />
            <CombatCell label={dmgLabel2} value={`${dmgMinL}~${dmgMaxL}`} color="var(--warning)" />
          </>
        )}
        <CombatCell label="MR" value={mr} color="var(--info)" />
        <CombatCell label="LV HP" value={`${hpRange.min}~${hpRange.max}`} color="var(--text-dim)" />
        <CombatCell label="HPR" value={`${hpRegenRange.min + equipHpr}~${hpRegenRange.max + equipHpr}/${hpRegenSec}s`} color="var(--text-dim)" />
        <CombatCell label="MPR" value={`${mpRegenTotal}/${mpRegenSec}s${hasBlueBuff ? ' ★' : ''}`} color="var(--text-dim)" />
      </div>
    </>
  );
}

/* ═══════════════════════════════
   Tab: 장비
   ═══════════════════════════════ */
function TabEquip() {
  const equippedWeapon = useGameStore(s => s.equippedWeapon);
  const equippedTshirt = useGameStore(s => s.equippedTshirt);
  const equippedHelmet = useGameStore(s => s.equippedHelmet);
  const equippedArmor = useGameStore(s => s.equippedArmor);
  const equippedCloak = useGameStore(s => s.equippedCloak);
  const equippedGloves = useGameStore(s => s.equippedGloves);
  const equippedBoots = useGameStore(s => s.equippedBoots);
  const equippedShield = useGameStore(s => s.equippedShield);
  const equippedNecklace = useGameStore(s => s.equippedNecklace);
  const equippedRing = useGameStore(s => s.equippedRing);
  const equippedRing2 = useGameStore(s => s.equippedRing2);
  const equippedBelt = useGameStore(s => s.equippedBelt);
  const equippedEarring = useGameStore(s => s.equippedEarring);

  const slots: { label: string; eq: Equipment | null }[] = [
    { label: 'Weapon', eq: equippedWeapon }, { label: 'T-shirt', eq: equippedTshirt },
    { label: 'Helmet', eq: equippedHelmet }, { label: 'Armor', eq: equippedArmor },
    { label: 'Cloak', eq: equippedCloak }, { label: 'Gloves', eq: equippedGloves },
    { label: 'Boots', eq: equippedBoots }, { label: 'Shield', eq: equippedShield },
    { label: 'Necklace', eq: equippedNecklace }, { label: 'Ring 1', eq: equippedRing },
    { label: 'Ring 2', eq: equippedRing2 }, { label: 'Belt', eq: equippedBelt },
    { label: 'Earring', eq: equippedEarring },
  ];

  return (
    <>
      <SectionTitle>Equipment</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {slots.map(({ label, eq }) => (
          <EquipRow key={label} label={label} equipment={eq} />
        ))}
      </div>
    </>
  );
}

function EquipRow({ label, equipment }: { label: string; equipment: Equipment | null }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '4px',
      padding: '3px 6px', background: 'var(--bg-panel)',
      border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)',
    }}>
      <span style={{ ...LABEL, fontSize: F.tiny, minWidth: 44, color: 'var(--text-mute)' }}>{label}</span>
      {equipment ? (
        <>
          <span style={{
            fontSize: F.value, fontWeight: 600, color: 'var(--text-dim)',
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{equipment.name}</span>
          {equipment.enhanceLevel > 0 && (
            <span style={{ ...STAT_VALUE, fontSize: F.tiny, color: 'var(--accent)' }}>
              +{equipment.enhanceLevel}
            </span>
          )}
        </>
      ) : (
        <span style={{ fontSize: F.value, color: 'var(--text-faint)', fontStyle: 'italic', flex: 1 }}>
          —
        </span>
      )}
    </div>
  );
}

/* ═══════════════════════════════
   Tab: 스킬
   ═══════════════════════════════ */
function TabSkills() {
  const equippedSkills = useGameStore(s => s.equippedSkills);
  const disabledSkills = useGameStore(s => s.disabledSkills);
  const hunt = useGameStore(s => s.hunt);
  const toggleSkillEnabled = useGameStore(s => s.toggleSkillEnabled);
  const cooldowns = hunt.skillCooldowns ?? {};
  const maxSlots = MAX_SKILL_SLOTS;
  const filledCount = equippedSkills.filter(id => id > 0).length;

  // 쿨다운 진행 중이면 리렌더 (1초마다)
  const hasCooldown = equippedSkills.some(id => id > 0 && (cooldowns[id] ?? 0) > 0);
  useTimer(hasCooldown);

  return (
    <>
      <SectionTitle>Equipped Skills ({filledCount}/{maxSlots})</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {Array.from({ length: maxSlots }).map((_, i) => {
          const skillId = equippedSkills[i] ?? 0;
          const skill = skillId > 0 ? PLAYER_SKILLS.find(s => s.id === skillId) : null;
          const isDisabled = skill ? (disabledSkills ?? []).includes(skill.id) : false;
          const cdRemain = skill ? (cooldowns[skill.id] ?? 0) : 0;
          const cdMax = skill ? Math.max(skill.reuseDelayTicks, 1) : 0;
          const onCooldown = cdRemain > 0;
          const cdPct = onCooldown ? (cdRemain / cdMax) * 100 : 0;

          return (
            <div key={i} style={{
              position: 'relative', overflow: 'hidden',
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '3px 6px', background: 'var(--bg-panel)',
              border: onCooldown ? '1px solid color-mix(in oklch, var(--danger) 60%, transparent)' : '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)',
              opacity: skill ? (isDisabled ? 0.45 : 1) : 0.5,
            }}>
              {/* 쿨다운 프로그레스 바 (배경) */}
              {onCooldown && !isDisabled && (
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${cdPct}%`,
                  background: 'color-mix(in oklch, var(--danger) 35%, transparent)',
                  transition: 'width 0.3s ease',
                  pointerEvents: 'none',
                }} />
              )}
              <span style={{
                position: 'relative', zIndex: 1,
                width: 16, height: 16, borderRadius: 'var(--r-xs)',
                background: 'var(--bg-sunken)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: F.tiny,
                fontWeight: 700, color: 'var(--text-mute)', flexShrink: 0,
              }}>{i + 1}</span>
              <span style={{
                position: 'relative', zIndex: 1,
                fontSize: F.value, fontWeight: 600, flex: 1,
                color: isDisabled ? 'var(--text-faint)' : onCooldown ? 'var(--danger)' : skill ? 'var(--text-dim)' : 'var(--text-faint)',
                fontStyle: skill ? 'normal' : 'italic',
                textDecoration: isDisabled ? 'line-through' : 'none',
              }}>{skill ? skill.name : '—'}</span>
              {skill && (
                <>
                  <span style={{
                    position: 'relative', zIndex: 1,
                    fontFamily: 'var(--font-mono)', fontSize: F.tiny,
                    color: isDisabled ? 'var(--text-faint)' : onCooldown ? 'var(--danger)' : 'var(--info)',
                  }}>
                    {onCooldown && !isDisabled ? `${cdRemain * 3}s` : `MP ${skill.consumeMp}`}
                  </span>
                  {/* ON/OFF 토글 스위치 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSkillEnabled(skill.id); }}
                    style={{
                      position: 'relative', zIndex: 1,
                      width: 28, height: 14, borderRadius: 7,
                      border: 'none', cursor: 'pointer', flexShrink: 0,
                      background: isDisabled ? 'var(--bg-sunken)' : 'var(--accent)',
                      transition: 'background 0.15s ease',
                      padding: 0,
                    }}
                    title={isDisabled ? 'OFF — 전투 중 사용 안 함' : 'ON — 전투 중 자동 시전'}
                  >
                    <span style={{
                      display: 'block',
                      width: 10, height: 10,
                      borderRadius: '50%',
                      background: '#fff',
                      transform: isDisabled ? 'translateX(2px)' : 'translateX(16px)',
                      transition: 'transform 0.15s ease',
                    }} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ═══════════════════════════════
   Tab: 버프
   ═══════════════════════════════ */
function TabBuffs() {
  const activeBuffs = useGameStore(s => s.activeBuffs);
  const now = Date.now();
  const alive = activeBuffs.filter(b => b.expiresAt > now);
  useTimer(alive.length > 0);

  const totalAtkSpeed = alive.reduce((s, b) => s * (b.atkSpeedMult ?? 1), 1);
  const totalAc = alive.reduce((s, b) => s + (b.acBonus ?? 0), 0);
  const totalHit = alive.reduce((s, b) => s + (b.hitBonus ?? 0), 0);
  const totalDmg = alive.reduce((s, b) => s + (b.dmgBonus ?? 0), 0);

  return (
    <>
      <SectionTitle>Active Buffs</SectionTitle>
      {alive.length === 0 ? (
        <EmptyMsg>활성 버프 없음</EmptyMsg>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {alive.map((b, i) => {
              const isPassive = b.potionId?.startsWith('passive_');
              const remainSec = Math.max(0, Math.floor((b.expiresAt - now) / 1000));
              const min = Math.floor(remainSec / 60);
              const sec = remainSec % 60;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '3px 6px', background: 'var(--bg-panel)',
                  border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)',
                }}>
                  <span style={{ fontSize: F.value, fontWeight: 600, color: 'var(--text-dim)', flex: 1 }}>
                    {b.name}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: F.tiny, color: 'var(--text-mute)' }}>
                    {isPassive ? '상시' : `${min}:${sec.toString().padStart(2, '0')}`}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{
            textAlign: 'center', fontSize: F.tiny, color: 'var(--text-faint)',
            padding: '2px', fontStyle: 'italic',
          }}>
            {[
              totalAtkSpeed !== 1 ? `ATK SPD x${totalAtkSpeed.toFixed(2)}` : '',
              totalAc !== 0 ? `AC ${totalAc > 0 ? '+' : ''}${totalAc}` : '',
              totalHit !== 0 ? `HIT +${totalHit}` : '',
              totalDmg !== 0 ? `DMG +${totalDmg}` : '',
            ].filter(Boolean).join(' · ')}
          </div>
        </>
      )}
    </>
  );
}

/* ═══════════════════════════════
   Tab: 소모품 (물약 + 자동설정 + 변신주문서)
   ═══════════════════════════════ */
const POTION_COLORS: Record<string, string> = {
  red_potion: '#ef5350', crimson_potion: '#ff7043', clear_potion: '#80cbc4',
  blue_potion: '#42a5f5', green_potion: '#66bb6a', courage_potion: '#ab47bc',
};
const THRESHOLDS = [30, 50, 70];

function TabConsumables() {
  const potions = useGameStore(s => s.potions);
  const materials = useGameStore(s => s.materials);
  const selectedPotionId = useGameStore(s => s.selectedPotionId);
  const potionAutoUse = useGameStore(s => s.potionAutoUse);
  const potionAutoThreshold = useGameStore(s => s.potionAutoThreshold);
  const bluePotionEnabled = useGameStore(s => s.bluePotionEnabled);

  const greenPotionEnabled = useGameStore(s => s.greenPotionEnabled);
  const couragePotionEnabled = useGameStore(s => s.couragePotionEnabled);
  const transformScrollEnabled = useGameStore(s => s.transformScrollEnabled);
  const transformScrollType = useGameStore(s => s.transformScrollType);
  const activeBuffs = useGameStore(s => s.activeBuffs);
  const level = useGameStore(s => s.level);
  const playerClass = useGameStore(s => s.playerClass);

  const setSelectedPotion = useGameStore(s => s.setSelectedPotion);
  const togglePotionAutoUse = useGameStore(s => s.togglePotionAutoUse);
  const setPotionAutoThreshold = useGameStore(s => s.setPotionAutoThreshold);
  const toggleBluePotion = useGameStore(s => s.toggleBluePotion);

  const toggleGreenPotion = useGameStore(s => s.toggleGreenPotion);
  const toggleCouragePotion = useGameStore(s => s.toggleCouragePotion);
  const toggleTransformScroll = useGameStore(s => s.toggleTransformScroll);
  const setTransformScrollType = useGameStore(s => s.setTransformScrollType);

  const now = Date.now();
  const tsBuff = activeBuffs.find((b: ActiveBuff) => b.potionId === 'transform_scroll' && b.expiresAt > now);
  const tsRemaining = tsBuff ? Math.max(0, Math.ceil((tsBuff.expiresAt - now) / 1000)) : 0;
  useTimer(!!tsBuff);

  const normalCount = materials['transform_scroll'] ?? 0;
  const eventCount = materials['event_transform_scroll'] ?? 0;
  const normalSpeed = getTransformScrollSpeed(level);
  const eventSpeed = getTransformScrollSpeed(80);

  return (
    <>
      {/* ── 체력 물약 ── */}
      <SectionTitle>체력 물약</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {HEAL_POTION_ORDER.map((pid) => {
          const p = POTIONS[pid];
          const count = potions[pid] ?? 0;
          const color = POTION_COLORS[pid];
          const selected = selectedPotionId === pid;
          return (
            <button key={pid} onClick={() => setSelectedPotion(pid)} style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '3px 6px', background: 'var(--bg-panel)',
              border: selected ? `1.5px solid ${color}` : '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)', cursor: 'pointer', transition: 'all 0.12s',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: F.value, fontWeight: 600, color: selected ? color : 'var(--text-dim)', flex: 1, textAlign: 'left' }}>
                {p.name}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: F.tiny, color: 'var(--text-faint)' }}>
                {p.healMin}~{p.healMax}
              </span>
              <span style={{ ...STAT_VALUE, fontSize: F.tiny, color: count > 0 ? 'var(--accent)' : 'var(--danger)' }}>
                x{count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 자동 사용 */}
      <ToggleRow label="자동 사용" active={potionAutoUse} onToggle={togglePotionAutoUse} />

      {/* 임계값 */}
      {potionAutoUse && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '3px',
          padding: '3px 6px', background: 'var(--bg-panel)',
          border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)',
        }}>
          <span style={{ fontSize: F.value, fontWeight: 600, color: 'var(--text-dim)', flex: 1 }}>HP 임계값</span>
          {THRESHOLDS.map(t => (
            <button key={t} onClick={() => setPotionAutoThreshold(t)} style={{
              padding: '2px 6px', borderRadius: 'var(--r-xs)',
              border: potionAutoThreshold === t ? '1px solid var(--warning)' : '1px solid var(--border-soft)',
              background: potionAutoThreshold === t ? 'color-mix(in oklch, var(--warning) 15%, transparent)' : 'var(--bg-sunken)',
              color: potionAutoThreshold === t ? 'var(--warning)' : 'var(--text-mute)',
              fontSize: F.tiny, fontWeight: 700, fontFamily: 'var(--font-mono)', cursor: 'pointer',
            }}>{t}%</button>
          ))}
        </div>
      )}

      {/* ── 버프 물약 ── */}
      <SectionTitle>버프 물약</SectionTitle>
      <BuffPotionRow label="파란 물약" count={potions['blue_potion'] ?? 0}
        color="#42a5f5" enabled={bluePotionEnabled} onToggle={toggleBluePotion}
        buff={activeBuffs.find((b: ActiveBuff) => b.potionId === 'blue_potion' && b.expiresAt > now)} />
      <BuffPotionRow label="초록 물약" count={potions['green_potion'] ?? 0}
        color="#66bb6a" enabled={greenPotionEnabled} onToggle={toggleGreenPotion}
        buff={activeBuffs.find((b: ActiveBuff) => b.potionId === 'green_potion' && b.expiresAt > now)} />
      {(() => {
        const bpId = getBravePotionId(playerClass);
        const bp = POTIONS[bpId];
        const bpColor = bpId === 'elven_wafer' ? '#81c784' : bpId === 'wisdom_potion' ? '#7986cb' : '#ab47bc';
        return (
          <BuffPotionRow label={bp.name} count={potions[bpId] ?? 0}
            color={bpColor} enabled={couragePotionEnabled} onToggle={toggleCouragePotion}
            buff={activeBuffs.find((b: ActiveBuff) => b.potionId === bpId && b.expiresAt > now)} />
        );
      })()}

      {/* ── 변신주문서 ── */}
      <SectionTitle>변신주문서</SectionTitle>
      {/* 일반 / 이벤트 선택 */}
      {(['normal', 'event'] as const).map(type => {
        const isEvent = type === 'event';
        const selected = transformScrollType === type;
        const count = isEvent ? eventCount : normalCount;
        const speed = isEvent ? eventSpeed : normalSpeed;
        const color = isEvent ? '#F5C518' : '#00e5ff';
        return (
          <button key={type} onClick={() => setTransformScrollType(type)} style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '3px 6px', background: 'var(--bg-panel)',
            border: selected ? `1.5px solid ${color}` : '1px solid var(--border-soft)',
            borderRadius: 'var(--r-sm)', cursor: 'pointer', transition: 'all 0.12s',
            marginBottom: '2px',
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              border: selected ? `2px solid ${color}` : '2px solid var(--text-mute)',
              background: selected ? color : 'transparent', flexShrink: 0,
            }} />
            <span style={{ fontSize: F.value, fontWeight: 600, color: selected ? color : 'var(--text-dim)', flex: 1, textAlign: 'left' }}>
              {isEvent ? '이벤트' : '일반'}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: F.tiny, color: 'var(--text-faint)' }}>
              x{speed.atk.toFixed(1)}/x{speed.move.toFixed(1)}
            </span>
            <span style={{ ...STAT_VALUE, fontSize: F.tiny, color: count > 0 ? color : 'var(--danger)' }}>
              x{count}
            </span>
          </button>
        );
      })}

      <ToggleRow label="자동 사용" active={transformScrollEnabled} onToggle={toggleTransformScroll} />

      {tsBuff && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '3px 6px', background: 'var(--bg-panel)',
          border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)',
        }}>
          <span style={{ fontSize: F.value, fontWeight: 600, color: 'var(--text-dim)', flex: 1 }}>
            {tsBuff.name}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: F.tiny, color: '#00e5ff' }}>
            {Math.floor(tsRemaining / 60)}:{String(tsRemaining % 60).padStart(2, '0')}
          </span>
        </div>
      )}
    </>
  );
}

/* 버프 물약 행 */
function BuffPotionRow({ label, count, color, enabled, onToggle, buff }: {
  label: string; count: number; color: string; enabled: boolean;
  onToggle: () => void; buff: ActiveBuff | undefined;
}) {
  const remaining = buff ? Math.max(0, Math.ceil((buff.expiresAt - Date.now()) / 1000)) : 0;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '4px',
      padding: '3px 6px', background: 'var(--bg-panel)',
      border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)',
      marginBottom: '2px',
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
        boxShadow: enabled && buff ? `0 0 4px ${color}` : 'none' }} />
      <span style={{ fontSize: F.value, fontWeight: 600, color: 'var(--text-dim)', flex: 1 }}>{label}</span>
      {buff && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: F.tiny, color }}>
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
        </span>
      )}
      <span style={{ ...STAT_VALUE, fontSize: F.tiny, color: count > 0 ? 'var(--accent)' : 'var(--text-faint)' }}>
        x{count}
      </span>
      <button onClick={onToggle} style={{
        padding: '1px 6px', borderRadius: 'var(--r-xs)',
        border: enabled ? '1px solid var(--success)' : '1px solid var(--border-soft)',
        background: enabled ? 'color-mix(in oklch, var(--success) 15%, transparent)' : 'var(--bg-sunken)',
        color: enabled ? 'var(--success)' : 'var(--text-mute)',
        fontSize: F.tiny, fontWeight: 700, fontFamily: 'var(--font-mono)', cursor: 'pointer',
      }}>{enabled ? 'ON' : 'OFF'}</button>
    </div>
  );
}

/* ═══════════════════════════════
   Tab: 정보
   ═══════════════════════════════ */
function TabProfile() {
  const playerName = useGameStore(s => s.playerName);
  const playerClass = useGameStore(s => s.playerClass);
  const level = useGameStore(s => s.level);
  const title = useGameStore(s => s.title);
  const gold = useGameStore(s => s.gold);
  const exp = useGameStore(s => s.exp);
  const hunt = useGameStore(s => s.hunt);
  const needed = xpForLevel(level);
  const expPct = needed > 0 ? ((exp / needed) * 100).toFixed(1) : '0.0';
  const classConfig = CLASS_CONFIGS[playerClass];

  return (
    <>
      <SectionTitle>Player Info</SectionTitle>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '4px',
        padding: '6px', background: 'var(--bg-panel)',
        border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)',
      }}>
        <ProfileRow label="Name" value={playerName} color="var(--info)" />
        <ProfileRow label="Class" value={`${CLASS_ICONS[playerClass] ?? ''} ${classConfig.nameKo}`} />
        <ProfileRow label="Level" value={`Lv. ${level}`} />
        {title && <ProfileRow label="Title" value={title} color="var(--accent)" />}
        <ProfileRow label="Gold" value={`$${gold.toLocaleString()}`} color="var(--accent)" />
        <ProfileRow label="EXP" value={`${expPct}%`} />
        <ProfileRow label="Kills" value={hunt.kills.toLocaleString()} />
      </div>
    </>
  );
}

/* ═══════════════════════════════
   공통 서브 컴포넌트
   ═══════════════════════════════ */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ ...LABEL, fontSize: F.title, marginBottom: '1px' }}>{children}</div>;
}

function CombatCell({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '3px 6px', background: 'var(--bg-panel)',
      border: '1px solid var(--border-soft)', borderRadius: 'var(--r-xs)',
    }}>
      <span style={{ ...LABEL, fontSize: F.tiny }}>{label}</span>
      <span style={{ ...STAT_VALUE, fontSize: F.value, color }}>{value}</span>
    </div>
  );
}

function ProfileRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ ...LABEL, fontSize: F.label }}>{label}</span>
      <span style={{ fontSize: F.value, fontWeight: 600, color: color ?? 'var(--text-dim)' }}>{value}</span>
    </div>
  );
}

function ToggleRow({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '4px',
      padding: '3px 6px', background: 'var(--bg-panel)',
      border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)',
      marginBottom: '2px',
    }}>
      <span style={{ fontSize: F.value, fontWeight: 600, color: 'var(--text-dim)', flex: 1 }}>{label}</span>
      <button onClick={onToggle} style={{
        padding: '1px 8px', borderRadius: 'var(--r-xs)',
        border: active ? '1px solid var(--success)' : '1px solid var(--border-soft)',
        background: active ? 'color-mix(in oklch, var(--success) 15%, transparent)' : 'var(--bg-sunken)',
        color: active ? 'var(--success)' : 'var(--text-mute)',
        fontSize: F.tiny, fontWeight: 700, fontFamily: 'var(--font-mono)', cursor: 'pointer',
      }}>{active ? 'ON' : 'OFF'}</button>
    </div>
  );
}

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      textAlign: 'center', color: 'var(--text-faint)',
      fontSize: F.value, fontStyle: 'italic', padding: 'var(--s-6)',
    }}>{children}</div>
  );
}
