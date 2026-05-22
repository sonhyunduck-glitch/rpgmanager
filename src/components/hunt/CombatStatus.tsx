/* =========================================================
   COMBAT STATUS — 플레이어 HP 바 + 몬스터 HP 바
   ========================================================= */
import { useGameStore } from '../../store/gameStore';
import { HUNT_ZONES } from '../../data/gameData';
import { LABEL, STAT_VALUE } from '../../styles/shared';
import { monsterDamageRange } from '../../data/statFormulas';

export default function CombatStatus() {
  const hunt = useGameStore((s) => s.hunt);
  const currentHp = useGameStore((s) => s.currentHp);
  const baseMaxHp = useGameStore((s) => s.maxHp);
  const getTotalHpBonus = useGameStore((s) => s.getTotalHpBonus);
  const maxHp = baseMaxHp + getTotalHpBonus();

  const zone = HUNT_ZONES.find((z) => z.id === hunt.zoneId);
  const isActive = hunt.status !== 'idle' && !!zone;

  // 현재 전투 중인 몬스터 찾기
  const monster = hunt.currentTargetId
    ? zone?.monsters.find((m) => m.id === hunt.currentTargetId)
    : null;

  const monsterHp = hunt.monsterCurrentHp;
  const monsterMaxHp = monster?.hp ?? 0;
  const monsterName = monster?.name ?? '';

  const playerHpPct = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 100;
  const monsterHpPct = monsterMaxHp > 0 ? Math.max(0, Math.min(100, (monsterHp / monsterMaxHp) * 100)) : 0;

  // 몬스터 대미지 범위
  const monsterDmg = monster
    ? monsterDamageRange(monster.damDice, monster.damDiceSides, monster.extraDam)
    : null;

  if (!isActive) return null;

  return (
    <div
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--s-2) var(--s-3)',
        flexShrink: 0,
        display: 'flex',
        gap: 'var(--s-3)',
      }}
    >
      {/* Player HP + Potion */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ ...LABEL, fontSize: 9 }}>PLAYER HP</span>
          <span
            style={{
              ...STAT_VALUE,
              fontSize: 11,
              color: hpColor(playerHpPct),
            }}
          >
            {currentHp}/{maxHp}
          </span>
        </div>
        <HpBar percent={playerHpPct} color={hpColor(playerHpPct)} glow />
      </div>

      {/* VS divider */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--s-1)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: 'var(--text-mute)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.1em',
          }}
        >
          VS
        </span>
      </div>

      {/* Monster HP */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span
            style={{
              ...LABEL,
              fontSize: 9,
              maxWidth: '60%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={monsterName ? `${monsterName} (Lv.${monster?.level})` : ''}
          >
            {monster ? `${monsterName}` : 'NO TARGET'}
          </span>
          {monster ? (
            <span
              style={{
                ...STAT_VALUE,
                fontSize: 11,
                color: monsterHpPct > 50 ? 'var(--danger)' : monsterHpPct > 25 ? 'var(--warning)' : 'var(--text-mute)',
              }}
            >
              {monsterHp}/{monsterMaxHp}
            </span>
          ) : (
            <span style={{ ...STAT_VALUE, fontSize: 11, color: 'var(--text-mute)' }}>--</span>
          )}
        </div>
        <HpBar
          percent={monsterHpPct}
          color={monsterHpPct > 50 ? 'var(--danger)' : monsterHpPct > 25 ? 'var(--warning)' : 'var(--text-mute)'}
        />
        {monster && monsterDmg && (
          <div style={{ display: 'flex', gap: 'var(--s-2)', marginTop: 3 }}>
            <span style={{ fontSize: 8, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)' }}>
              Lv.{monster.level}
            </span>
            <span style={{ fontSize: 8, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)' }}>
              DMG {monsterDmg.min}~{monsterDmg.max}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** HP 바 컴포넌트 */
function HpBar({ percent, color, glow }: { percent: number; color: string; glow?: boolean }) {
  return (
    <div
      style={{
        width: '100%',
        height: 8,
        background: 'var(--bg-sunken)',
        borderRadius: 999,
        overflow: 'hidden',
        border: '1px solid var(--border-soft)',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: `${percent}%`,
          height: '100%',
          background: `linear-gradient(90deg, ${color}, color-mix(in oklch, ${color} 70%, white))`,
          borderRadius: 999,
          transition: 'width 0.4s ease, background 0.3s ease',
          boxShadow: glow && percent > 0 ? `0 0 6px color-mix(in oklch, ${color} 40%, transparent)` : 'none',
        }}
      />
    </div>
  );
}

/** HP 퍼센트에 따른 색상 */
function hpColor(pct: number): string {
  if (pct > 60) return 'var(--success)';
  if (pct > 30) return 'var(--warning)';
  return 'var(--danger)';
}

