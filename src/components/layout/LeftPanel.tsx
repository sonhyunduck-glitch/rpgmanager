import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { LABEL, STAT_VALUE } from '../../styles/shared';
import { CLASS_CONFIGS } from '../../data/classData';
import { getSkillSlotCount } from '../../data/playerSkillData';
import { PLAYER_SKILLS } from '../../data/playerSkillData';
import { POTIONS, POTION_ORDER, xpForLevel } from '../../data/gameData';
import {
  finalAC, finalMR,
  meleeHit,
  minDamage, maxDamage,
  hpGainRange,
} from '../../data/statFormulas';
import { getAllEquipped } from '../../store/storeTypes';
import type { StatKey, Equipment } from '../../types';

/* ══════════════════════════════════════
   좌측 패널 탭 정의
   ══════════════════════════════════════ */
type LeftTab = 'stats' | 'combat' | 'equip' | 'skills' | 'buffs' | 'potions' | 'profile';

const TAB_ITEMS: { id: LeftTab | 'empty'; icon: string; label: string }[] = [
  { id: 'stats',   icon: '📊', label: '스탯' },
  { id: 'combat',  icon: '⚔️', label: '전투' },
  { id: 'equip',   icon: '🛡️', label: '장비' },
  { id: 'skills',  icon: '✨', label: '스킬' },
  { id: 'buffs',   icon: '🔮', label: '버프' },
  { id: 'potions', icon: '🧪', label: '물약' },
  { id: 'profile', icon: '👤', label: '정보' },
  { id: 'empty',   icon: '—',  label: '' },
];

const STAT_LABELS: Record<StatKey, { label: string; color: string }> = {
  str: { label: 'STR', color: 'var(--danger)' },
  dex: { label: 'DEX', color: 'var(--success)' },
  con: { label: 'CON', color: 'var(--warning)' },
  wis: { label: 'WIS', color: 'var(--info)' },
  int: { label: 'INT', color: 'var(--accent)' },
};

const CLASS_ICONS: Record<string, string> = { knight: '⚔️', elf: '🏹', wizard: '🔮' };

/* ══════════════════════════════════════
   메인 컴포넌트
   ══════════════════════════════════════ */
export default function LeftPanel() {
  const [activeTab, setActiveTab] = useState<LeftTab>('stats');

  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border-soft)',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      {/* ── 상단: 4x2 버튼 그리드 ── */}
      <div
        style={{
          flexShrink: 0,
          padding: '8px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
          gap: '5px',
        }}
      >
        {TAB_ITEMS.map((item) => {
          const isActive = item.id !== 'empty' && activeTab === item.id;
          const isEmpty = item.id === 'empty';
          return (
            <button
              key={item.id}
              onClick={() => { if (!isEmpty) setActiveTab(item.id as LeftTab); }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                padding: '7px 4px',
                border: isActive
                  ? '1px solid var(--accent)'
                  : '1px solid var(--border-soft)',
                borderRadius: 'var(--r-sm)',
                background: isActive
                  ? 'color-mix(in oklch, var(--accent) 15%, var(--bg-panel))'
                  : 'var(--bg-panel)',
                color: isActive ? 'var(--accent)' : isEmpty ? 'var(--text-faint)' : 'var(--text-mute)',
                cursor: isEmpty ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
                fontFamily: 'var(--font-ui)',
                boxShadow: isActive ? '0 0 8px oklch(0.74 0.17 55 / 0.2)' : 'none',
                opacity: isEmpty ? 0.3 : 1,
              }}
            >
              <span style={{ fontSize: '16px', lineHeight: 1 }}>{item.icon}</span>
              <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.04em' }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 하단: 콘텐츠 영역 ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 8px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          borderTop: '1px solid var(--border-soft)',
          paddingTop: '8px',
        }}
      >
        {activeTab === 'stats' && <TabStats />}
        {activeTab === 'combat' && <TabCombat />}
        {activeTab === 'equip' && <TabEquip />}
        {activeTab === 'skills' && <TabSkills />}
        {activeTab === 'buffs' && <TabBuffs />}
        {activeTab === 'potions' && <TabPotions />}
        {activeTab === 'profile' && <TabProfile />}
      </div>
    </aside>
  );
}

/* ══════════════════════════════════════
   Tab: 스탯
   ══════════════════════════════════════ */
function TabStats() {
  const allocateStat = useGameStore((s) => s.allocateStat);
  const getStr = useGameStore((s) => s.getStr);
  const getDex = useGameStore((s) => s.getDex);
  const getCon = useGameStore((s) => s.getCon);
  const getWis = useGameStore((s) => s.getWis);
  const getInt = useGameStore((s) => s.getInt);
  const getRemainingPoints = useGameStore((s) => s.getRemainingPoints);
  const statAllocation = useGameStore((s) => s.statAllocation);
  const playerClass = useGameStore((s) => s.playerClass);

  const baseStats = CLASS_CONFIGS[playerClass].baseStats;
  const statValues: Record<StatKey, number> = {
    str: getStr(), dex: getDex(), con: getCon(), wis: getWis(), int: getInt(),
  };
  const remaining = getRemainingPoints();

  return (
    <>
      <SectionTitle>Character Stats</SectionTitle>

      {remaining > 0 && (
        <div
          style={{
            background: 'color-mix(in oklch, var(--accent) 12%, transparent)',
            border: '1px solid color-mix(in oklch, var(--accent) 40%, transparent)',
            borderRadius: 'var(--r-sm)',
            padding: '5px 10px',
            textAlign: 'center',
            fontSize: 'var(--fs-sm)',
            color: 'var(--accent)',
            fontWeight: 600,
          }}
        >
          스탯 포인트: {remaining}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {(Object.keys(STAT_LABELS) as StatKey[]).map((key) => {
          const { label, color } = STAT_LABELS[key];
          const base = (baseStats as Record<string, number>)[key] ?? 0;
          const alloc = statAllocation[key];
          return (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-soft)',
                borderRadius: 'var(--r-sm)',
                padding: '5px 8px',
              }}
            >
              <span style={{ ...LABEL, fontSize: 'var(--fs-xs)', color, minWidth: 30 }}>{label}</span>
              <span style={{ ...STAT_VALUE, fontSize: 'var(--fs-md)', color }}>{statValues[key]}</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }}>
                ({base}+{alloc})
              </span>
              {remaining > 0 && (
                <button
                  onClick={() => allocateStat(key)}
                  style={{
                    marginLeft: 'auto', width: 22, height: 22,
                    borderRadius: '50%', border: `1px solid ${color}`,
                    background: 'transparent', color,
                    fontSize: 'var(--fs-xs)', fontWeight: 700,
                    cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    padding: 0, transition: 'all 0.15s ease',
                  }}
                  title={`${label} +1`}
                >+</button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ══════════════════════════════════════
   Tab: 전투
   ══════════════════════════════════════ */
function TabCombat() {
  const level = useGameStore((s) => s.level);
  const baseMaxHp = useGameStore((s) => s.maxHp);
  const currentHp = useGameStore((s) => s.currentHp);
  const getTotalHpBonus = useGameStore((s) => s.getTotalHpBonus);
  const getTotalDefense = useGameStore((s) => s.getTotalDefense);
  const getStr = useGameStore((s) => s.getStr);
  const getDex = useGameStore((s) => s.getDex);
  const getCon = useGameStore((s) => s.getCon);
  const getWis = useGameStore((s) => s.getWis);
  const equippedWeapon = useGameStore((s) => s.equippedWeapon);
  const playerClass = useGameStore((s) => s.playerClass);
  const hunt = useGameStore((s) => s.hunt);
  const getMaxMp = useGameStore((s) => s.getMaxMp);

  const maxHp = baseMaxHp + getTotalHpBonus();
  const str = getStr();
  const dex = getDex();
  const con = getCon();
  const wis = getWis();
  const weaponEnchant = equippedWeapon?.enhanceLevel ?? 0;
  const weaponBaseDmgS = equippedWeapon?.baseAtk ?? 0;
  const weaponBaseDmgL = equippedWeapon?.baseAtkLarge ?? 0;
  const totalDefense = getTotalDefense();

  const state = useGameStore.getState();
  const allSlots = getAllEquipped(state);
  const bonusHit = allSlots.reduce((s, eq) => s + (eq?.bonuses?.hit ?? 0), 0);
  const bonusExtraDmg = allSlots.reduce((s, eq) => s + (eq?.bonuses?.extraDmg ?? 0), 0);
  const bonusMr = allSlots.reduce((s, eq) => s + (eq?.bonuses?.mr ?? 0), 0);

  const hit = meleeHit(level, weaponEnchant, str) + bonusHit;
  const dmgMinS = minDamage(level, weaponEnchant, str) + bonusExtraDmg;
  const dmgMaxS = maxDamage(weaponBaseDmgS, level, weaponEnchant, str) + bonusExtraDmg;
  const dmgMinL = minDamage(level, weaponEnchant, str) + bonusExtraDmg;
  const dmgMaxL = maxDamage(weaponBaseDmgL, level, weaponEnchant, str) + bonusExtraDmg;
  const ac = finalAC(totalDefense, level, dex, playerClass);
  const mr = finalMR(level, wis) + bonusMr;
  const hpRange = hpGainRange(con);
  const maxMp = getMaxMp();

  return (
    <>
      <SectionTitle>Combat Stats</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
        <CombatCell label="HP" value={`${currentHp}/${maxHp}`}
          color={currentHp > maxHp * 0.6 ? 'var(--success)' : currentHp > maxHp * 0.3 ? 'var(--warning)' : 'var(--danger)'} />
        <CombatCell label="MP" value={`${hunt.currentMp}/${maxMp}`} color="oklch(0.65 0.20 300)" />
        <CombatCell label="HIT" value={hit} color="var(--text)" />
        <CombatCell label="AC" value={ac} color="var(--success)" />
        <CombatCell label="DMG(소)" value={`${dmgMinS}~${dmgMaxS}`} color="var(--warning)" />
        <CombatCell label="DMG(대)" value={`${dmgMinL}~${dmgMaxL}`} color="var(--warning)" />
        <CombatCell label="MR" value={mr} color="var(--info)" />
        <CombatCell label="LV HP" value={`${hpRange.min}~${hpRange.max}`} color="var(--text-dim)" />
      </div>
    </>
  );
}

/* ══════════════════════════════════════
   Tab: 장비
   ══════════════════════════════════════ */
function TabEquip() {
  const equippedWeapon = useGameStore((s) => s.equippedWeapon);
  const equippedTshirt = useGameStore((s) => s.equippedTshirt);
  const equippedHelmet = useGameStore((s) => s.equippedHelmet);
  const equippedArmor = useGameStore((s) => s.equippedArmor);
  const equippedCloak = useGameStore((s) => s.equippedCloak);
  const equippedGloves = useGameStore((s) => s.equippedGloves);
  const equippedBoots = useGameStore((s) => s.equippedBoots);
  const equippedShield = useGameStore((s) => s.equippedShield);
  const equippedNecklace = useGameStore((s) => s.equippedNecklace);
  const equippedRing = useGameStore((s) => s.equippedRing);
  const equippedRing2 = useGameStore((s) => s.equippedRing2);
  const equippedBelt = useGameStore((s) => s.equippedBelt);
  const equippedEarring = useGameStore((s) => s.equippedEarring);

  const slots: { label: string; eq: Equipment | null }[] = [
    { label: 'Weapon', eq: equippedWeapon },
    { label: 'T-shirt', eq: equippedTshirt },
    { label: 'Helmet', eq: equippedHelmet },
    { label: 'Armor', eq: equippedArmor },
    { label: 'Cloak', eq: equippedCloak },
    { label: 'Gloves', eq: equippedGloves },
    { label: 'Boots', eq: equippedBoots },
    { label: 'Shield', eq: equippedShield },
    { label: 'Necklace', eq: equippedNecklace },
    { label: 'Ring 1', eq: equippedRing },
    { label: 'Ring 2', eq: equippedRing2 },
    { label: 'Belt', eq: equippedBelt },
    { label: 'Earring', eq: equippedEarring },
  ];

  return (
    <>
      <SectionTitle>Equipment</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {slots.map(({ label, eq }) => (
          <EquipRow key={label} label={label} equipment={eq} />
        ))}
      </div>
    </>
  );
}

function EquipRow({ label, equipment }: { label: string; equipment: Equipment | null }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 8px',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-sm)',
      }}
    >
      <span style={{
        ...LABEL, fontSize: 'var(--fs-2xs)', minWidth: 48,
        color: 'var(--text-mute)',
      }}>{label}</span>
      {equipment ? (
        <>
          <span style={{
            fontSize: 'var(--fs-sm)', fontWeight: 600,
            color: 'var(--text-dim)', flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {equipment.name}
          </span>
          {equipment.enhanceLevel > 0 && (
            <span style={{
              ...STAT_VALUE, fontSize: 'var(--fs-xs)',
              color: 'var(--accent)',
            }}>+{equipment.enhanceLevel}</span>
          )}
        </>
      ) : (
        <span style={{
          fontSize: 'var(--fs-sm)', color: 'var(--text-faint)',
          fontStyle: 'italic', flex: 1,
        }}>— empty —</span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   Tab: 스킬
   ══════════════════════════════════════ */
function TabSkills() {
  const equippedSkills = useGameStore((s) => s.equippedSkills);
  const level = useGameStore((s) => s.level);
  const maxSlots = getSkillSlotCount(level);
  const filledCount = equippedSkills.filter(id => id > 0).length;

  // 잠긴 슬롯 정보
  const lockedSlots: { slot: number; reqLevel: number }[] = [];
  const slotLevels = [1, 1, 1, 1, 20, 30, 40, 50];
  for (let i = maxSlots; i < 8; i++) {
    lockedSlots.push({ slot: i + 1, reqLevel: slotLevels[i] });
  }

  return (
    <>
      <SectionTitle>Equipped Skills ({filledCount}/{maxSlots})</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {Array.from({ length: maxSlots }).map((_, i) => {
          const skillId = equippedSkills[i] ?? 0;
          const skill = skillId > 0 ? PLAYER_SKILLS.find(s => s.id === skillId) : null;
          return (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 8px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-soft)',
                borderRadius: 'var(--r-sm)',
                opacity: skill ? 1 : 0.5,
              }}
            >
              <span style={{
                width: 18, height: 18, borderRadius: 'var(--r-xs)',
                background: 'var(--bg-sunken)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)',
                fontWeight: 700, color: 'var(--text-mute)', flexShrink: 0,
              }}>{i + 1}</span>
              <span style={{
                fontSize: 'var(--fs-sm)', fontWeight: 600, flex: 1,
                color: skill ? 'var(--text-dim)' : 'var(--text-faint)',
                fontStyle: skill ? 'normal' : 'italic',
              }}>
                {skill ? skill.name : '— 빈 슬롯 —'}
              </span>
              {skill && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)',
                  color: 'oklch(0.65 0.20 300)',
                }}>MP {skill.consumeMp}</span>
              )}
            </div>
          );
        })}
      </div>
      {lockedSlots.length > 0 && (
        <div style={{
          textAlign: 'center', fontSize: 'var(--fs-xs)',
          color: 'var(--text-faint)', marginTop: '4px', opacity: 0.5,
        }}>
          {lockedSlots.map(({ slot, reqLevel }) => `🔒 슬롯 ${slot} (Lv.${reqLevel})`).join(' · ')}
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════
   Tab: 버프
   ══════════════════════════════════════ */
function TabBuffs() {
  const activeBuffs = useGameStore((s) => s.activeBuffs);
  const now = Date.now();
  const alive = activeBuffs.filter(b => b.expiresAt > now);

  // 총 효과 요약
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {alive.map((b, i) => {
              const remainSec = Math.max(0, Math.floor((b.expiresAt - now) / 1000));
              const min = Math.floor(remainSec / 60);
              const sec = remainSec % 60;
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 8px',
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 'var(--r-sm)',
                  }}
                >
                  <span style={{ fontSize: '13px' }}>
                    {b.skillId ? '✨' : b.potionId === 'transform_scroll' ? '🐺' : '🧪'}
                  </span>
                  <span style={{
                    fontSize: 'var(--fs-sm)', fontWeight: 600,
                    color: 'var(--text-dim)', flex: 1,
                  }}>{b.name}</span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)',
                    color: 'var(--text-mute)',
                  }}>{min}:{sec.toString().padStart(2, '0')}</span>
                </div>
              );
            })}
          </div>

          {/* 효과 요약 */}
          <div style={{
            textAlign: 'center', fontSize: 'var(--fs-xs)',
            color: 'var(--text-faint)', padding: '4px',
            fontStyle: 'italic',
          }}>
            {totalAtkSpeed !== 1 && `ATK SPD x${totalAtkSpeed.toFixed(2)}`}
            {totalAc !== 0 && ` · AC ${totalAc > 0 ? '+' : ''}${totalAc}`}
            {totalHit !== 0 && ` · HIT +${totalHit}`}
            {totalDmg !== 0 && ` · DMG +${totalDmg}`}
          </div>
        </>
      )}
    </>
  );
}

/* ══════════════════════════════════════
   Tab: 물약
   ══════════════════════════════════════ */
const POTION_ICONS: Record<string, string> = {
  red_potion: '🔴', crimson_potion: '🟠', clear_potion: '🔵',
  green_potion: '🟢', courage_potion: '🟡',
};

function TabPotions() {
  const potions = useGameStore((s) => s.potions);
  const potionAutoUse = useGameStore((s) => s.potionAutoUse);
  const potionAutoThreshold = useGameStore((s) => s.potionAutoThreshold);
  const selectedPotionId = useGameStore((s) => s.selectedPotionId);

  const selectedName = POTIONS[selectedPotionId]?.name ?? selectedPotionId;

  return (
    <>
      <SectionTitle>Potions</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {POTION_ORDER.map((pid) => {
          const p = POTIONS[pid];
          if (!p) return null;
          const count = potions[pid] ?? 0;
          return (
            <div
              key={pid}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 8px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-soft)',
                borderRadius: 'var(--r-sm)',
              }}
            >
              <span style={{ fontSize: '14px' }}>{POTION_ICONS[pid] ?? '🧪'}</span>
              <span style={{
                fontSize: 'var(--fs-sm)', fontWeight: 600,
                color: 'var(--text-dim)', flex: 1,
              }}>{p.name}</span>
              <span style={{
                ...STAT_VALUE, fontSize: 'var(--fs-sm)',
                color: count > 0 ? 'var(--accent)' : 'var(--text-faint)',
              }}>x{count}</span>
            </div>
          );
        })}
      </div>

      {/* 자동 사용 상태 */}
      {potionAutoUse && (
        <div style={{
          padding: '5px 8px',
          background: 'color-mix(in oklch, var(--success) 10%, transparent)',
          border: '1px solid color-mix(in oklch, var(--success) 30%, transparent)',
          borderRadius: 'var(--r-sm)',
          fontSize: 'var(--fs-xs)', color: 'var(--success)',
          textAlign: 'center',
        }}>
          자동 사용: HP {potionAutoThreshold}% 이하 → {selectedName}
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════
   Tab: 정보
   ══════════════════════════════════════ */
function TabProfile() {
  const playerName = useGameStore((s) => s.playerName);
  const playerClass = useGameStore((s) => s.playerClass);
  const level = useGameStore((s) => s.level);
  const title = useGameStore((s) => s.title);
  const gold = useGameStore((s) => s.gold);
  const exp = useGameStore((s) => s.exp);
  const hunt = useGameStore((s) => s.hunt);

  const needed = xpForLevel(level);
  const expPct = needed > 0 ? ((exp / needed) * 100).toFixed(1) : '0.0';
  const classConfig = CLASS_CONFIGS[playerClass];

  return (
    <>
      <SectionTitle>Player Info</SectionTitle>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '6px',
        padding: '10px',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-md)',
      }}>
        <ProfileRow label="Name" value={playerName} color="var(--info)" />
        <ProfileRow label="Class" value={`${CLASS_ICONS[playerClass] ?? ''} ${classConfig.nameKo} (${classConfig.nameEn})`} />
        <ProfileRow label="Level" value={`Lv. ${level}`} />
        {title && <ProfileRow label="Title" value={title} color="var(--accent)" />}
        <ProfileRow label="Gold" value={`$${gold.toLocaleString()}`} color="var(--accent)" />
        <ProfileRow label="EXP" value={`${expPct}%`} />
        <ProfileRow label="Kills" value={hunt.kills.toLocaleString()} />
      </div>
    </>
  );
}

/* ══════════════════════════════════════
   공통 서브 컴포넌트
   ══════════════════════════════════════ */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      ...LABEL, fontSize: 'var(--fs-xs)',
      marginBottom: '2px',
    }}>{children}</div>
  );
}

function CombatCell({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '4px 8px',
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-xs)',
    }}>
      <span style={{ ...LABEL, fontSize: 'var(--fs-2xs)' }}>{label}</span>
      <span style={{ ...STAT_VALUE, fontSize: 'var(--fs-sm)', color }}>{value}</span>
    </div>
  );
}

function ProfileRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ ...LABEL, fontSize: 'var(--fs-xs)' }}>{label}</span>
      <span style={{
        fontSize: 'var(--fs-sm)', fontWeight: 600,
        color: color ?? 'var(--text-dim)',
      }}>{value}</span>
    </div>
  );
}

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      textAlign: 'center', color: 'var(--text-faint)',
      fontSize: 'var(--fs-sm)', fontStyle: 'italic',
      padding: 'var(--s-6)',
    }}>{children}</div>
  );
}
