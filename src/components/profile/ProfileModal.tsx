/* =========================================================
   PROFILE MODAL — 다른 유저 프로필 조회 오버레이
   이름 클릭 → 장비/스탯/길드 확인
   ========================================================= */
import { useEffect, useState } from 'react';
import { useGameStore, equipDisplayName } from '../../store/gameStore';
import { getPlayerProfile, getPlayerEquipment } from '../../lib/profile';
import type { PlayerProfile, PlayerEquipment } from '../../lib/profile';
import type { Equipment, EquipType, PlayerClass } from '../../types';
import { CLASS_CONFIGS } from '../../data/classData';
import {
  finalAC, finalMR, meleeHit, minDamage, maxDamage, hpGainRange, calcMaxMp,
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
  { type: 'weapon', label: '무기' },
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
];


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
      console.error('[ProfileModal] load error:', err);
      setLoading(false);
    });
  }, [viewingProfileId]);

  if (!viewingProfileId) return null;

  const isMe = viewingProfileId === myId;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={closeProfile}
    >
      <div
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-soft)',
          borderRadius: 'var(--r-md)',
          padding: 'var(--s-4)',
          width: 360, maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          gap: 'var(--s-3)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div style={{
            textAlign: 'center', padding: 'var(--s-6)',
            color: 'var(--text-mute)', fontSize: 'var(--fs-sm)',
          }}>
            Loading...
          </div>
        ) : !profile ? (
          <div style={{
            textAlign: 'center', padding: 'var(--s-6)',
            color: 'var(--text-mute)', fontSize: 'var(--fs-sm)',
          }}>
            프로필을 찾을 수 없습니다.
          </div>
        ) : (
          <>
            {/* ── 헤더: 이름 + 클래스 + 레벨 + 칭호 ── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
                {profile.player_class && (
                  <span style={{ fontSize: 'var(--fs-sm)' }}>
                    {CLASS_ICONS[profile.player_class] ?? ''}
                  </span>
                )}
                <span style={{
                  fontSize: 'var(--fs-md)', fontWeight: 700,
                  color: isMe ? 'var(--accent)' : 'var(--info)',
                  fontFamily: 'var(--font-display)',
                }}>
                  {profile.name}
                </span>
                {profile.player_class && CLASS_CONFIGS[profile.player_class as PlayerClass] && (
                  <span style={{
                    fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)',
                    fontFamily: 'var(--font-mono)',
                    padding: '1px 6px',
                    background: 'color-mix(in oklch, var(--accent) 10%, transparent)',
                    borderRadius: 'var(--r-xs)',
                  }}>
                    {CLASS_CONFIGS[profile.player_class as PlayerClass].nameKo}
                  </span>
                )}
                <span style={{
                  ...LABEL, fontSize: 'var(--fs-xs)', marginBottom: 0,
                  color: 'var(--text-dim)',
                }}>
                  Lv.{profile.level}
                </span>
              </div>
              {profile.title && (
                <div style={{
                  fontSize: 'var(--fs-xs)', color: 'var(--accent)',
                  fontFamily: 'var(--font-mono)', marginTop: 2,
                }}>
                  {profile.title}
                </div>
              )}
              <div style={{
                fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)',
                fontFamily: 'var(--font-mono)', marginTop: 4,
                display: 'flex', gap: 8,
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
              const bonusExtraDmg = (equip?.equipped ?? []).reduce((s, eq) => s + (eq.bonuses?.extraDmg ?? 0), 0);
              const bonusMr = (equip?.equipped ?? []).reduce((s, eq) => s + (eq.bonuses?.mr ?? 0), 0);
              const bonusHp = (equip?.equipped ?? []).reduce((s, eq) => s + (eq.bonuses?.hp ?? 0), 0);
              const hit = meleeHit(lv, weaponEnchant, str) + bonusHit;
              const ac = finalAC(totalDef, lv, dex, pc);
              const dmgMinS = minDamage(lv, weaponEnchant, str) + bonusExtraDmg;
              const dmgMaxS = maxDamage(weaponBaseDmgS, lv, weaponEnchant, str) + bonusExtraDmg;
              const dmgMinL = minDamage(lv, weaponEnchant, str) + bonusExtraDmg;
              const dmgMaxL = maxDamage(weaponBaseDmgL, lv, weaponEnchant, str) + bonusExtraDmg;
              const mr = finalMR(lv, wis) + bonusMr;
              const maxHp = profile.max_hp + bonusHp;
              const maxMp = calcMaxMp(lv, wis, int, pc);
              const hpRange = hpGainRange(con);
              const hpRegenR = calcHpRegenRange(lv, con);
              const equipHpr = eqList.reduce((s, eq) => s + (eq.bonuses?.hpr ?? 0), 0);
              const equipMpr = eqList.reduce((s, eq) => s + (eq.bonuses?.mpr ?? 0), 0);
              const hpRegenSec = calcHpRegenIntervalSec(lv, pc, equipHpr);
              const mpRegenAmt = calcMpRegenAmount(wis);
              const mpRegenSec = calcMpRegenIntervalSec(equipMpr);

              return (<>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
              gap: 'var(--s-1)',
            }}>
              <StatBox label="STR" value={str} color="var(--danger)" sub={`${base.str}+${profile.stat_str}`} />
              <StatBox label="DEX" value={dex} color="var(--success)" sub={`${base.dex}+${profile.stat_dex}`} />
              <StatBox label="CON" value={con} color="var(--info)" sub={`${base.con}+${profile.stat_con}`} />
              <StatBox label="WIS" value={wis} color="var(--warning)" sub={`${base.wis}+${profile.stat_wis}`} />
              <StatBox label="INT" value={int} color="var(--accent)" sub={`${base.int}+${profile.stat_int}`} />
            </div>

                <div>
                  <div style={{ ...LABEL, fontSize: 'var(--fs-2xs)', marginBottom: 'var(--s-1)' }}>
                    Combat
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <ProfileCombatCell label="HP" value={`${profile.current_hp}/${maxHp}`}
                      color={profile.current_hp > maxHp * 0.6 ? 'var(--success)' : profile.current_hp > maxHp * 0.3 ? 'var(--warning)' : 'var(--danger)'} />
                    <ProfileCombatCell label="MP" value={`0/${maxMp}`} color="var(--info)" />
                    <ProfileCombatCell label="HIT" value={`${hit}`} color="var(--text)" />
                    <ProfileCombatCell label="AC" value={`${ac}`} color="var(--success)" />
                    <ProfileCombatCell label="DMG(소)" value={`${dmgMinS}~${dmgMaxS}`} color="var(--warning)" />
                    <ProfileCombatCell label="DMG(대)" value={`${dmgMinL}~${dmgMaxL}`} color="var(--warning)" />
                    <ProfileCombatCell label="MR" value={`${mr}`} color="var(--info)" />
                    <ProfileCombatCell label="LV HP" value={`${hpRange.min}~${hpRange.max}`} color="var(--text-dim)" />
                    <ProfileCombatCell label="HPR" value={`${hpRegenR.min}~${hpRegenR.max}/${hpRegenSec}s`} color="var(--text-dim)" />
                    <ProfileCombatCell label="MPR" value={`${mpRegenAmt}/${mpRegenSec}s`} color="var(--text-dim)" />
                  </div>
                </div>
              </>);
            })()}

            {/* ── 장비 ── */}
            <div>
              <div style={{ ...LABEL, fontSize: 'var(--fs-2xs)', marginBottom: 'var(--s-1)' }}>
                Equipment
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                {EQUIP_SLOTS.map(slot => {
                  const item = equip?.equipped.find(e => e.type === slot.type);
                  return (
                    <EquipSlotRow key={slot.type} label={slot.label} item={item ?? null} />
                  );
                })}
              </div>
              {equip && (
                <div style={{
                  fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)',
                  fontFamily: 'var(--font-mono)', marginTop: 'var(--s-1)',
                }}>
                  인벤토리: {equip.inventoryCount}개
                </div>
              )}
            </div>

            {/* ── 닫기 버튼 ── */}
            <button
              onClick={closeProfile}
              style={{
                padding: '6px 0',
                border: '1px solid var(--border-soft)',
                borderRadius: 'var(--r-sm)',
                background: 'var(--bg-sunken)',
                color: 'var(--text-mute)',
                fontSize: 'var(--fs-xs)', fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
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
      borderRadius: 'var(--r-sm)',
      padding: '4px',
      textAlign: 'center',
    }}>
      <div style={{ ...LABEL, fontSize: 'var(--fs-2xs)', marginBottom: 1 }}>{label}</div>
      <div style={{ ...STAT_VALUE, fontSize: 'var(--fs-base)', color }}>{value}</div>
      {sub && <div style={{ fontSize: '9px', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>({sub})</div>}
    </div>
  );
}

/* ── 전투 스탯 셀 ── */
function ProfileCombatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '3px 6px',
      background: 'var(--bg-sunken)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-xs)',
    }}>
      <span style={{ ...LABEL, fontSize: 'var(--fs-2xs)', marginBottom: 0, color: 'var(--text-mute)' }}>
        {label}
      </span>
      <span style={{ ...STAT_VALUE, fontSize: 'var(--fs-xs)', color, fontFamily: 'var(--font-mono)' }}>
        {value}
      </span>
    </div>
  );
}

/* ── 장비 슬롯 행 ── */
function EquipSlotRow({ label, item }: { label: string; item: Equipment | null }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '3px 6px',
      borderRadius: 'var(--r-xs)',
      background: item ? 'color-mix(in oklch, var(--accent) 4%, transparent)' : 'transparent',
    }}>
      <span style={{
        ...LABEL, fontSize: 'var(--fs-2xs)', marginBottom: 0,
        minWidth: 36, textAlign: 'right',
        color: item ? 'var(--text-mute)' : 'var(--border-soft)',
      }}>
        {label}
      </span>
      {item ? (
        <>
          <span style={{
            fontSize: 'var(--fs-xs)', fontWeight: 600,
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
            fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)',
            fontFamily: 'var(--font-mono)', flexShrink: 0,
          }}>
            {item.baseAtk > 0 ? `ATK ${item.baseAtk}` : `AC ${item.baseDef}`}
          </span>
        </>
      ) : (
        <span style={{
          fontSize: 'var(--fs-xs)', fontStyle: 'italic',
          color: 'var(--border-soft)',
        }}>
          비어있음
        </span>
      )}
    </div>
  );
}
