/* =========================================================
   PROFILE PANEL — 다른 유저 프로필 조회 (우측 패널 내 표시)
   이름 클릭 → 장비/스탯/길드 확인
   ========================================================= */
import { useEffect, useState } from 'react';
import { useGameStore, equipDisplayName } from '../../store/gameStore';
import { getPlayerProfile, getPlayerEquipment } from '../../lib/profile';
import type { PlayerProfile, PlayerEquipment } from '../../lib/profile';
import type { Equipment, EquipType, PlayerClass } from '../../types';
import { CLASS_CONFIGS } from '../../data/classData';
import {
  finalAC, finalMR, meleeHit, minDamage, maxDamage,
  bowMinDamage, bowMaxDamage, calcPlayerHitRate, magicDamageRange,
  hpGainRange, calcMaxMp,
  calcHpRegenRange, calcHpRegenIntervalSec, calcMpRegenAmount, calcMpRegenIntervalSec,
} from '../../data/statFormulas';
import { LABEL, STAT_VALUE } from '../../styles/shared';
import { timeAgo, dateFmt } from '../../lib/utils';

const CLASS_ICONS: Record<string, string> = {
  knight: '⚔️',
  elf: '🏹',
  wizard: '🔮',
};

/* ── 장비 슬롯 순서 ── */
const EQUIP_SLOTS: { type: EquipType; label: string }[] = [
  { type: 'weapon', label: '무기' },  // bow, staff도 이 슬롯에 표시
  { type: 'tshirt', label: '티셔츠' },
  { type: 'helmet', label: '투구' },
  { type: 'armor', label: '갑옷' },
  { type: 'cloak', label: '망토' },
  { type: 'gloves', label: '장갑' },
  { type: 'boots', label: '부츠' },
  { type: 'shield', label: '방패' },
  { type: 'necklace', label: '목걸이' },
  { type: 'ring', label: '반지' },
  { type: 'belt', label: '벨트' },
  { type: 'earring', label: '귀걸이' },
];

/** 무기 슬롯 타입인지 (weapon, bow, staff 모두 '무기' 슬롯) */
const WEAPON_TYPES: Set<string> = new Set(['weapon', 'bow', 'staff']);


export default function ProfileModal() {
  const viewingProfileId = useGameStore(s => s.viewingProfileId);
  const closeProfile = useGameStore(s => s.closeProfile);
  const myId = useGameStore(s => s.authUserId);

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [equip, setEquip] = useState<PlayerEquipment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!viewingProfileId) return;
    setLoading(true);
    setProfile(null);
    setEquip(null);

    Promise.all([
      getPlayerProfile(viewingProfileId),
      getPlayerEquipment(viewingProfileId),
    ]).then(([p, e]) => {
      setProfile(p);
      setEquip(e);
      setLoading(false);
    }).catch((err) => {
      console.error('[ProfilePanel] load error:', err);
      setLoading(false);
    });
  }, [viewingProfileId]);

  if (!viewingProfileId) return null;

  const isMe = viewingProfileId === myId;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--bg-canvas)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-md)',
      }}
    >
      {/* 상단 헤더: 닫기 버튼 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
          borderBottom: '1px solid var(--border-soft)',
          background: 'var(--bg-sunken)',
          flexShrink: 0,
        }}
      >
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-mute)',
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          Profile
        </span>
        <button
          onClick={closeProfile}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-mute)',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: 'var(--r-xs)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          ✕
        </button>
      </div>

      {/* 스크롤 가능 컨텐츠 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {loading ? (
          <div style={{
            textAlign: 'center', padding: 'var(--s-6)',
            color: 'var(--text-mute)', fontSize: 11,
          }}>
            Loading...
          </div>
        ) : !profile ? (
          <div style={{
            textAlign: 'center', padding: 'var(--s-6)',
            color: 'var(--text-mute)', fontSize: 11,
          }}>
            프로필을 찾을 수 없습니다.
          </div>
        ) : (
          <>
            {/* ── 헤더: 이름 + 클래스 + 레벨 + 칭호 ── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {profile.player_class && (
                  <span style={{ fontSize: 12 }}>
                    {CLASS_ICONS[profile.player_class] ?? ''}
                  </span>
                )}
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: isMe ? 'var(--accent)' : 'var(--info)',
                  fontFamily: 'var(--font-display)',
                }}>
                  {profile.name}
                </span>
                {profile.player_class && CLASS_CONFIGS[profile.player_class as PlayerClass] && (
                  <span style={{
                    fontSize: 9, color: 'var(--text-mute)',
                    fontFamily: 'var(--font-mono)',
                    padding: '0px 4px',
                    background: 'color-mix(in oklch, var(--accent) 10%, transparent)',
                    borderRadius: 'var(--r-xs)',
                  }}>
                    {CLASS_CONFIGS[profile.player_class as PlayerClass].nameKo}
                  </span>
                )}
                <span style={{
                  fontSize: 10, color: 'var(--text-dim)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  Lv.{profile.level}
                </span>
              </div>
              {profile.title && (
                <div style={{
                  fontSize: 9, color: 'var(--accent)',
                  fontFamily: 'var(--font-mono)', marginTop: 1,
                }}>
                  {profile.title}
                </div>
              )}
              <div style={{
                fontSize: 9, color: 'var(--text-mute)',
                fontFamily: 'var(--font-mono)', marginTop: 2,
                display: 'flex', gap: 6, flexWrap: 'wrap',
              }}>
                {profile.guild_name && (
                  <span>길드: <span style={{ color: 'var(--info)' }}>{profile.guild_name}</span></span>
                )}
                <span>접속: {timeAgo(profile.last_active_at)}</span>
                <span>가입: {dateFmt(profile.created_at)}</span>
              </div>
            </div>

            {/* ── 스탯 + 전투 스탯 ── */}
            {(() => {
              const pc = (profile.player_class as PlayerClass) ?? 'knight';
              const base = CLASS_CONFIGS[pc].baseStats;
              const eqList = equip?.equipped ?? [];
              const eqStatBonus = (key: 'str' | 'dex' | 'con' | 'wis' | 'int') =>
                eqList.reduce((s, eq) => s + (eq.bonuses?.[key] ?? 0), 0);
              const lv = profile.level;
              const str = base.str + profile.stat_str + eqStatBonus('str');
              const dex = base.dex + profile.stat_dex + eqStatBonus('dex');
              const con = base.con + profile.stat_con + eqStatBonus('con');
              const wis = base.wis + profile.stat_wis + eqStatBonus('wis');
              const int = base.int + profile.stat_int + eqStatBonus('int');

              const weapon = equip?.equipped.find(e => e.type === 'weapon' || e.type === 'bow' || e.type === 'staff') ?? null;
              const weaponEnchant = weapon?.enhanceLevel ?? 0;
              const weaponBaseDmgS = weapon?.baseAtk ?? 0;
              const weaponBaseDmgL = weapon?.baseAtkLarge ?? 0;
              const totalDef = (equip?.equipped ?? []).reduce((s, eq) => s + (eq.baseDef ?? 0) + (eq.enhanceLevel > 0 && eq.baseDef > 0 ? eq.enhanceLevel : 0), 0);
              const bonusHit = (equip?.equipped ?? []).reduce((s, eq) => s + (eq.bonuses?.hit ?? 0), 0);
              const bonusBowHit = (equip?.equipped ?? []).reduce((s, eq) => s + (eq.bonuses?.bowHit ?? 0), 0);
              const bonusBowDmg = (equip?.equipped ?? []).reduce((s, eq) => s + (eq.bonuses?.bowDmg ?? 0), 0);
              const bonusExtraDmg = (equip?.equipped ?? []).reduce((s, eq) => s + (eq.bonuses?.extraDmg ?? 0), 0);
              const bonusMr = (equip?.equipped ?? []).reduce((s, eq) => s + (eq.bonuses?.mr ?? 0), 0);
              const bonusHp = (equip?.equipped ?? []).reduce((s, eq) => s + (eq.bonuses?.hp ?? 0), 0);
              const bonusSp = (equip?.equipped ?? []).reduce((s, eq) => s + (eq.bonuses?.sp ?? 0), 0);
              const pCombatStyle = CLASS_CONFIGS[pc].combatStyle;

              let pHit: number | string;
              let pDmgMinS: number;
              let pDmgMaxS: number;
              let pDmgMinL: number;
              let pDmgMaxL: number;
              let pDmgLabel1: string;
              let pDmgLabel2: string;

              if (pCombatStyle === 'ranged_bow') {
                pHit = calcPlayerHitRate(lv, str, dex, weaponEnchant, bonusHit + bonusBowHit);
                pDmgMinS = bowMinDamage(lv, weaponEnchant, dex) + bonusExtraDmg + bonusBowDmg;
                pDmgMaxS = bowMaxDamage(weaponBaseDmgS, lv, weaponEnchant, dex) + bonusExtraDmg + bonusBowDmg;
                pDmgMinL = bowMinDamage(lv, weaponEnchant, dex) + bonusExtraDmg + bonusBowDmg;
                pDmgMaxL = bowMaxDamage(weaponBaseDmgL, lv, weaponEnchant, dex) + bonusExtraDmg + bonusBowDmg;
                pDmgLabel1 = 'DMG(소)';
                pDmgLabel2 = 'DMG(대)';
              } else if (pCombatStyle === 'ranged_magic') {
                pHit = '자동';
                const mRange = magicDamageRange(weaponBaseDmgS, int, bonusSp, lv, pc);
                pDmgMinS = mRange.min;
                pDmgMaxS = mRange.max;
                pDmgMinL = mRange.min;
                pDmgMaxL = mRange.max;
                pDmgLabel1 = 'M.DMG';
                pDmgLabel2 = 'SP';
              } else {
                pHit = meleeHit(lv, weaponEnchant, str) + bonusHit;
                pDmgMinS = minDamage(lv, weaponEnchant, str) + bonusExtraDmg;
                pDmgMaxS = maxDamage(weaponBaseDmgS, lv, weaponEnchant, str) + bonusExtraDmg;
                pDmgMinL = minDamage(lv, weaponEnchant, str) + bonusExtraDmg;
                pDmgMaxL = maxDamage(weaponBaseDmgL, lv, weaponEnchant, str) + bonusExtraDmg;
                pDmgLabel1 = 'DMG(소)';
                pDmgLabel2 = 'DMG(대)';
              }

              const ac = finalAC(totalDef, lv, dex, pc);
              const mr = finalMR(lv, wis) + bonusMr;
              const maxHp = profile.max_hp + bonusHp;
              const maxMp = calcMaxMp(lv, wis, int, pc);
              const hpRange = hpGainRange(con);
              const hpRegenR = calcHpRegenRange(lv, con);
              const equipHpr = eqList.reduce((s, eq) => s + (eq.bonuses?.hpr ?? 0), 0);
              const equipMpr = eqList.reduce((s, eq) => s + (eq.bonuses?.mpr ?? 0), 0);
              const hpRegenSec = calcHpRegenIntervalSec(lv, pc);
              const mpRegenAmt = calcMpRegenAmount(wis) + equipMpr;
              const mpRegenSec = calcMpRegenIntervalSec();

              return (<>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
              gap: 2,
            }}>
              <StatBox label="STR" value={str} color="var(--danger)" sub={`${base.str}+${profile.stat_str}`} />
              <StatBox label="DEX" value={dex} color="var(--success)" sub={`${base.dex}+${profile.stat_dex}`} />
              <StatBox label="CON" value={con} color="var(--info)" sub={`${base.con}+${profile.stat_con}`} />
              <StatBox label="WIS" value={wis} color="var(--warning)" sub={`${base.wis}+${profile.stat_wis}`} />
              <StatBox label="INT" value={int} color="var(--accent)" sub={`${base.int}+${profile.stat_int}`} />
            </div>

                <div>
                  <div style={{ ...LABEL, fontSize: 9, marginBottom: 2 }}>
                    Combat
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <ProfileCombatCell label="HP" value={`${profile.current_hp}/${maxHp}`}
                      color={profile.current_hp > maxHp * 0.6 ? 'var(--success)' : profile.current_hp > maxHp * 0.3 ? 'var(--warning)' : 'var(--danger)'} />
                    <ProfileCombatCell label="MP" value={`0/${maxMp}`} color="var(--info)" />
                    <ProfileCombatCell label="HIT" value={`${pHit}`} color={pHit === '자동' ? 'var(--info)' : 'var(--text)'} />
                    <ProfileCombatCell label="AC" value={`${ac}`} color="var(--success)" />
                    {pCombatStyle === 'ranged_magic' ? (
                      <>
                        <ProfileCombatCell label={pDmgLabel1} value={`${pDmgMinS}~${pDmgMaxS}`} color="var(--info)" />
                        <ProfileCombatCell label={pDmgLabel2} value={`${bonusSp}`} color="var(--info)" />
                      </>
                    ) : (
                      <>
                        <ProfileCombatCell label={pDmgLabel1} value={`${pDmgMinS}~${pDmgMaxS}`} color="var(--warning)" />
                        <ProfileCombatCell label={pDmgLabel2} value={`${pDmgMinL}~${pDmgMaxL}`} color="var(--warning)" />
                      </>
                    )}
                    <ProfileCombatCell label="MR" value={`${mr}`} color="var(--info)" />
                    <ProfileCombatCell label="LV HP" value={`${hpRange.min}~${hpRange.max}`} color="var(--text-dim)" />
                    <ProfileCombatCell label="HPR" value={`${hpRegenR.min + equipHpr}~${hpRegenR.max + equipHpr}/${hpRegenSec}s`} color="var(--text-dim)" />
                    <ProfileCombatCell label="MPR" value={`${mpRegenAmt}/${mpRegenSec}s`} color="var(--text-dim)" />
                  </div>
                </div>
              </>);
            })()}

            {/* ── 장비 ── */}
            <div>
              <div style={{ ...LABEL, fontSize: 9, marginBottom: 2 }}>
                Equipment
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 1,
              }}>
                {EQUIP_SLOTS.map(slot => {
                  const item = equip?.equipped.find(e =>
                    slot.type === 'weapon' ? WEAPON_TYPES.has(e.type) : e.type === slot.type
                  );
                  return (
                    <EquipSlotRow key={slot.type} label={slot.label} item={item ?? null} />
                  );
                })}
              </div>
              {equip && (
                <div style={{
                  fontSize: 9, color: 'var(--text-mute)',
                  fontFamily: 'var(--font-mono)', marginTop: 2,
                }}>
                  인벤토리: {equip.inventoryCount}개
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── 스탯 박스 ── */
function StatBox({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div style={{
      background: 'var(--bg-sunken)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-xs)',
      padding: '3px 2px',
      textAlign: 'center',
    }}>
      <div style={{ ...LABEL, fontSize: 9, marginBottom: 0 }}>{label}</div>
      <div style={{ ...STAT_VALUE, fontSize: 12, color }}>{value}</div>
      {sub && <div style={{ fontSize: 8, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>({sub})</div>}
    </div>
  );
}

/* ── 전투 스탯 셀 ── */
function ProfileCombatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '2px 5px',
      background: 'var(--bg-sunken)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-xs)',
    }}>
      <span style={{ ...LABEL, fontSize: 9, marginBottom: 0, color: 'var(--text-mute)' }}>
        {label}
      </span>
      <span style={{ ...STAT_VALUE, fontSize: 10, color, fontFamily: 'var(--font-mono)' }}>
        {value}
      </span>
    </div>
  );
}

/* ── 장비 슬롯 행 ── */
function EquipSlotRow({ label, item }: { label: string; item: Equipment | null }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '2px 5px',
      borderRadius: 'var(--r-xs)',
      background: item ? 'color-mix(in oklch, var(--accent) 4%, transparent)' : 'transparent',
    }}>
      <span style={{
        ...LABEL, fontSize: 9, marginBottom: 0,
        minWidth: 30, textAlign: 'right',
        color: item ? 'var(--text-mute)' : 'var(--border-soft)',
      }}>
        {label}
      </span>
      {item ? (
        <>
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: item.enhanceLevel >= 7 ? 'var(--warning)'
              : item.enhanceLevel > 0 ? 'var(--accent)'
              : 'var(--text)',
            fontFamily: 'var(--font-display)',
            flex: 1, minWidth: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {equipDisplayName(item)}
          </span>
          <span style={{
            fontSize: 9, color: 'var(--text-mute)',
            fontFamily: 'var(--font-mono)', flexShrink: 0,
          }}>
            {item.baseAtk > 0 ? `ATK ${item.baseAtk}` : `AC ${item.baseDef}`}
          </span>
        </>
      ) : (
        <span style={{
          fontSize: 10, fontStyle: 'italic',
          color: 'var(--border-soft)',
        }}>
          비어있음
        </span>
      )}
    </div>
  );
}
