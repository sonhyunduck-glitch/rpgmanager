import { useGameStore } from '../../store/gameStore';
import { LABEL, STAT_VALUE } from '../../styles/shared';
import SlotCard from '../ui/SlotCard';
import {
  finalAC, finalMR,
  meleeHit,
  minDamage, maxDamage,
  hpGainRange,
} from '../../data/statFormulas';
import type { StatKey } from '../../types';

const STAT_LABELS: Record<StatKey, { label: string; full: string; color: string }> = {
  str: { label: 'STR', full: '힘', color: 'var(--danger)' },
  dex: { label: 'DEX', full: '민첩', color: 'var(--success)' },
  con: { label: 'CON', full: '체력', color: 'var(--warning)' },
  wis: { label: 'WIS', full: '지혜', color: 'var(--info)' },
};

export default function LeftPanel() {
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
  const getTotalDefense = useGameStore((s) => s.getTotalDefense);
  const level = useGameStore((s) => s.level);
  const baseMaxHp = useGameStore((s) => s.maxHp);
  const currentHp = useGameStore((s) => s.currentHp);
  const getTotalHpBonus = useGameStore((s) => s.getTotalHpBonus);
  const maxHp = baseMaxHp + getTotalHpBonus();
  const allocateStat = useGameStore((s) => s.allocateStat);
  const getStr = useGameStore((s) => s.getStr);
  const getDex = useGameStore((s) => s.getDex);
  const getCon = useGameStore((s) => s.getCon);
  const getWis = useGameStore((s) => s.getWis);
  const getRemainingPoints = useGameStore((s) => s.getRemainingPoints);

  const str = getStr();
  const dex = getDex();
  const con = getCon();
  const wis = getWis();
  const remaining = getRemainingPoints();

  const weaponEnchant = equippedWeapon?.enhanceLevel ?? 0;
  const weaponBaseDmgS = equippedWeapon?.baseAtk ?? 0;
  const weaponBaseDmgL = equippedWeapon?.baseAtkLarge ?? 0;
  const totalDefense = getTotalDefense();

  // 장비 보너스 합산
  const allSlots = [equippedWeapon, equippedTshirt, equippedArmor, equippedHelmet,
    equippedCloak, equippedGloves, equippedBoots, equippedShield,
    equippedNecklace, equippedRing, equippedRing2, equippedBelt];
  const bonusHit = allSlots.reduce((s, eq) => s + (eq?.bonuses?.hit ?? 0), 0);
  const bonusExtraDmg = allSlots.reduce((s, eq) => s + (eq?.bonuses?.extraDmg ?? 0), 0);
  const bonusMr = allSlots.reduce((s, eq) => s + (eq?.bonuses?.mr ?? 0), 0);

  // Derived stats
  const hit = meleeHit(level, weaponEnchant, str) + bonusHit;
  const dmgMinS = minDamage(level, weaponEnchant, str) + bonusExtraDmg;
  const dmgMaxS = maxDamage(weaponBaseDmgS, level, weaponEnchant, str) + bonusExtraDmg;
  const dmgMinL = minDamage(level, weaponEnchant, str) + bonusExtraDmg;
  const dmgMaxL = maxDamage(weaponBaseDmgL, level, weaponEnchant, str) + bonusExtraDmg;
  const ac = finalAC(totalDefense, level, dex);
  const mr = finalMR(level, wis) + bonusMr;
  const hpRange = hpGainRange(con);

  const statValues: Record<StatKey, number> = { str, dex, con, wis };

  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-3)',
        padding: 'var(--s-4)',
        background: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border-soft)',
        overflow: 'auto',
        minWidth: 0,
      }}
    >
      {/* Character Stats */}
      <div style={LABEL}>Character Stats</div>

      {/* 스탯 포인트 잔여 */}
      {remaining > 0 && (
        <div
          style={{
            background: 'color-mix(in oklch, var(--accent) 12%, transparent)',
            border: '1px solid color-mix(in oklch, var(--accent) 40%, transparent)',
            borderRadius: 'var(--r-sm)',
            padding: 'var(--s-2) var(--s-3)',
            textAlign: 'center',
            fontSize: 'var(--fs-sm)',
            color: 'var(--accent)',
            fontWeight: 600,
          }}
        >
          스탯 포인트: {remaining}
        </div>
      )}

      {/* 4 Core Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-1)' }}>
        {(Object.keys(STAT_LABELS) as StatKey[]).map((key) => {
          const { label, color } = STAT_LABELS[key];
          return (
            <div
              key={key}
              style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-soft)',
                borderRadius: 'var(--r-sm)',
                padding: 'var(--s-2)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--s-2)',
              }}
            >
              <span style={{ ...LABEL, fontSize: 'var(--fs-xs)', color, minWidth: 28 }}>{label}</span>
              <span style={{ ...STAT_VALUE, fontSize: 'var(--fs-md)', color }}>
                {statValues[key]}
              </span>
              {remaining > 0 && (
                <button
                  onClick={() => allocateStat(key)}
                  style={{
                    marginLeft: 'auto',
                    width: 'var(--s-5)',
                    height: 'var(--s-5)',
                    borderRadius: '50%',
                    border: `1px solid ${color}`,
                    background: 'transparent',
                    color,
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                    padding: 0,
                    transition: 'all 0.15s ease',
                  }}
                  title={`${label} +1`}
                >
                  +
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Derived Combat Stats */}
      <div
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-soft)',
          borderRadius: 'var(--r-md)',
          padding: 'var(--s-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--s-2)',
        }}
      >
        <div style={{ ...LABEL, fontSize: 'var(--fs-xs)' }}>Combat Stats</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-2)' }}>
          <MiniStat label="HP" value={`${currentHp}/${maxHp}`} color={currentHp > maxHp * 0.6 ? 'var(--success)' : currentHp > maxHp * 0.3 ? 'var(--warning)' : 'var(--danger)'} />
          <MiniStat label="HIT" value={hit} color="var(--text)" />
          <MiniStat label="DMG(소)" value={`${dmgMinS}~${dmgMaxS}`} color="var(--warning)" />
          <MiniStat label="DMG(대)" value={`${dmgMinL}~${dmgMaxL}`} color="var(--warning)" />
          <MiniStat label="AC" value={ac} color="var(--success)" />
          <MiniStat label="MR" value={mr} color="var(--info)" />
          <MiniStat label="LV HP" value={`${hpRange.min}~${hpRange.max}`} color="var(--text-dim)" />
        </div>
      </div>

      {/* Equipment */}
      <div style={LABEL}>Equipment</div>

      <SlotCard label="Weapon" equipment={equippedWeapon} />
      <SlotCard label="T-shirt" equipment={equippedTshirt} />
      <SlotCard label="Helmet" equipment={equippedHelmet} />
      <SlotCard label="Armor" equipment={equippedArmor} />
      <SlotCard label="Cloak" equipment={equippedCloak} />
      <SlotCard label="Gloves" equipment={equippedGloves} />
      <SlotCard label="Boots" equipment={equippedBoots} />
      <SlotCard label="Shield" equipment={equippedShield} />
      <SlotCard label="Necklace" equipment={equippedNecklace} />
      <SlotCard label="Ring 1" equipment={equippedRing} />
      <SlotCard label="Ring 2" equipment={equippedRing2} />
      <SlotCard label="Belt" equipment={equippedBelt} />
    </aside>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ ...LABEL, fontSize: 'var(--fs-2xs)' }}>{label}</span>
      <span style={{ ...STAT_VALUE, fontSize: 'var(--fs-sm)', color }}>{value}</span>
    </div>
  );
}
