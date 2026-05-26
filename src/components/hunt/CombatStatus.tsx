/* =========================================================
   COMBAT STATUS — 플레이어 HP/MP 바  ↔  VS  ↔  몬스터 HP 바
   디자인: hunt-app.jsx 핸드오프 기반
   ========================================================= */
import { useGameStore } from '../../store/gameStore';
import { HUNT_ZONES } from '../../data/gameData';
import { monsterDamageRange } from '../../data/statFormulas';

/** 속성 아이콘/색상 매핑 (L1J AttrType) */
const ATTR_META: Record<number, { icon: string; label: string; color: string }> = {
  1: { icon: '🌍', label: '땅', color: '#8D6E63' },
  2: { icon: '🔥', label: '불', color: '#FF7043' },
  4: { icon: '💧', label: '물', color: '#42A5F5' },
  8: { icon: '🌪️', label: '바람', color: '#66BB6A' },
};

/* ── 스타일 상수 ── */
const S = {
  wrap: {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-soft)',
    borderRadius: 'var(--r-md)',
    padding: 'var(--s-2) var(--s-3)',
    flexShrink: 0,
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gap: 'var(--s-3)',
    alignItems: 'center',
  } as React.CSSProperties,

  sideLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--fs-xs)',
    color: 'var(--text-mute)',
    marginBottom: 4,
  } as React.CSSProperties,

  name: {
    fontWeight: 600,
    color: 'var(--text)',
    fontSize: 'var(--fs-sm)',
  } as React.CSSProperties,

  hpNum: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--fs-sm)',
    fontWeight: 600,
    color: 'var(--text)',
  } as React.CSSProperties,

  vs: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--fs-xs)',
    fontWeight: 700,
    color: 'var(--accent)',
    padding: '4px 10px',
    border: '1px solid color-mix(in oklch, var(--accent) 40%, transparent)',
    borderRadius: 'var(--r-full)',
    background: 'color-mix(in oklch, var(--accent) 6%, transparent)',
    letterSpacing: '0.1em',
    flexShrink: 0,
  } as React.CSSProperties,

  statusBadge: {
    width: 16,
    height: 16,
    borderRadius: 3,
    border: '1px solid currentColor',
    display: 'grid',
    placeItems: 'center',
    fontFamily: 'var(--font-mono)',
    fontSize: 8,
    flexShrink: 0,
  } as React.CSSProperties,

  mpLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    color: 'var(--text-mute)',
    marginTop: 3,
    marginBottom: 2,
  } as React.CSSProperties,

  lvTag: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    padding: '1px 5px',
    background: 'var(--bg-sunken)',
    color: 'var(--danger)',
    borderRadius: 3,
    flexShrink: 0,
  } as React.CSSProperties,
};

export default function CombatStatus() {
  const hunt = useGameStore((s) => s.hunt);
  const currentHp = useGameStore((s) => s.currentHp);
  const baseMaxHp = useGameStore((s) => s.maxHp);
  const getTotalHpBonus = useGameStore((s) => s.getTotalHpBonus);
  const maxHp = baseMaxHp + getTotalHpBonus();
  const getMaxMp = useGameStore((s) => s.getMaxMp);
  const maxMp = getMaxMp();
  const currentMp = hunt.currentMp;
  const activeBuffs = useGameStore((s) => s.activeBuffs);

  const zone = HUNT_ZONES.find((z) => z.id === hunt.zoneId);
  const isActive = hunt.status !== 'idle' && !!zone;

  const monster = hunt.currentTargetId
    ? zone?.monsters.find((m) => m.id === hunt.currentTargetId)
    : null;

  const monsterHp = hunt.monsterCurrentHp;
  const monsterMaxHp = monster?.hp ?? 0;
  const monsterName = monster?.name ?? '';

  const playerHpPct = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 100;
  const playerMpPct = maxMp > 0 ? Math.max(0, Math.min(100, (currentMp / maxMp) * 100)) : 0;
  const monsterHpPct = monsterMaxHp > 0 ? Math.max(0, Math.min(100, (monsterHp / monsterMaxHp) * 100)) : 0;

  const monsterDmg = monster
    ? monsterDamageRange(monster.damDice, monster.damDiceSides, monster.extraDam)
    : null;

  if (!isActive) return null;

  return (
    <div style={S.wrap}>
      {/* ━━━ Player HP/MP ━━━ */}
      <div style={{ minWidth: 0 }}>
        {/* Label row */}
        <div style={S.sideLabel}>
          <span style={S.name}>PLAYER HP</span>
          {/* 상태 효과 뱃지 */}
          <div style={{ display: 'inline-flex', gap: 3 }}>
            {activeBuffs.length > 0 && activeBuffs.slice(0, 3).map((buff, i) => {
              const isTransform = buff.potionId === 'transform_scroll';
              const isGreen = buff.potionId === 'green_potion';
              const isCourage = buff.potionId === 'courage_potion';
              const badgeColor = isTransform ? 'var(--accent)' :
                                 isGreen ? 'var(--success)' :
                                 isCourage ? 'var(--danger)' : 'var(--info)';
              return (
                <span key={i} style={{
                  ...S.statusBadge,
                  color: badgeColor,
                  background: `color-mix(in oklch, ${badgeColor} 10%, transparent)`,
                }} title={buff.name}>
                  {isTransform ? '⚜' : isGreen ? '+' : isCourage ? '⚔' : '✦'}
                </span>
              );
            })}
          </div>
          <span style={{ marginLeft: 'auto', ...S.hpNum, color: hpColor(playerHpPct) }}>
            {currentHp}<span style={{ color: 'var(--text-mute)' }}>/{maxHp}</span>
          </span>
        </div>

        {/* HP Bar */}
        <HpBar percent={playerHpPct} color={hpColor(playerHpPct)} glow />

        {/* MP Bar */}
        {maxMp > 0 && (
          <>
            <div style={S.mpLabel}>
              <span>MP</span>
              <span>{currentMp}/{maxMp}</span>
            </div>
            <MpBar percent={playerMpPct} />
          </>
        )}
      </div>

      {/* ━━━ VS ━━━ */}
      <span style={S.vs}>VS</span>

      {/* ━━━ Monster HP ━━━ */}
      <div style={{ minWidth: 0 }}>
        {/* Label row — 우측 정렬 */}
        <div style={{ ...S.sideLabel, justifyContent: 'flex-end' }}>
          {monster ? (
            <span style={{ ...S.hpNum, marginRight: 'auto', color: monsterHpColor(monsterHpPct) }}>
              {monsterHp}<span style={{ color: 'var(--text-mute)' }}>/{monsterMaxHp}</span>
            </span>
          ) : (
            <span style={{ ...S.hpNum, marginRight: 'auto', color: 'var(--text-mute)' }}>--</span>
          )}
          {monster && <span style={S.lvTag}>Lv.{monster.level}</span>}
          {monster?.attr && monster.attr > 0 && ATTR_META[monster.attr] && (
            <span style={{
              ...S.statusBadge,
              color: ATTR_META[monster.attr].color,
              background: `${ATTR_META[monster.attr].color}1a`,
            }} title={ATTR_META[monster.attr].label}>
              {ATTR_META[monster.attr].icon}
            </span>
          )}
          <span style={{
            ...S.name,
            maxWidth: '50%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }} title={monsterName}>
            {monsterName || 'NO TARGET'}
          </span>
        </div>

        {/* HP Bar */}
        <HpBar percent={monsterHpPct} color="var(--danger)" enemy />

        {/* DMG 바 */}
        {monster && monsterDmg && (
          <div style={S.mpLabel}>
            <span>DMG</span>
            <span>{monsterDmg.min}~{monsterDmg.max}</span>
          </div>
        )}
        {monster && monsterDmg && (
          <div style={{
            height: 4,
            background: 'var(--bg-sunken)',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, monsterHpPct)}%`,
              background: 'linear-gradient(90deg, var(--danger), #a8333d)',
              borderRadius: 2,
              transition: 'width 0.25s',
            }} />
          </div>
        )}
      </div>
    </div>
  );
}

/** HP 바 — 16px, 그라디언트, 글로우 */
function HpBar({ percent, color, glow, enemy }: {
  percent: number; color: string; glow?: boolean; enemy?: boolean;
}) {
  const gradEnd = enemy ? '#a8333d' : `color-mix(in oklch, ${color} 60%, var(--success))`;
  return (
    <div style={{
      width: '100%',
      height: 14,
      background: 'var(--bg-sunken)',
      borderRadius: 4,
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{
        width: `${percent}%`,
        height: '100%',
        background: enemy
          ? `linear-gradient(180deg, var(--danger) 0%, ${gradEnd} 100%)`
          : `linear-gradient(180deg, ${color} 0%, color-mix(in oklch, ${color} 70%, black) 100%)`,
        borderRadius: 3,
        transition: 'width 0.25s ease',
        boxShadow: (glow || enemy) && percent > 0
          ? `0 0 6px color-mix(in oklch, ${color} 40%, transparent)`
          : 'none',
      }} />
    </div>
  );
}

/** MP 바 — 4px, 파랑→시안 그라디언트 */
function MpBar({ percent }: { percent: number }) {
  return (
    <div style={{
      height: 4,
      background: 'var(--bg-sunken)',
      borderRadius: 2,
      overflow: 'hidden',
    }}>
      <div style={{
        height: '100%',
        width: `${percent}%`,
        background: 'linear-gradient(90deg, var(--info), oklch(0.78 0.14 195))',
        borderRadius: 2,
        transition: 'width 0.25s',
        boxShadow: percent > 0 ? '0 0 4px color-mix(in oklch, var(--info) 30%, transparent)' : 'none',
      }} />
    </div>
  );
}

/** HP 퍼센트에 따른 색상 */
function hpColor(pct: number): string {
  if (pct > 60) return 'var(--success)';
  if (pct > 30) return 'var(--warning)';
  return 'var(--danger)';
}

/** 몬스터 HP 색상 (항상 빨간 계열) */
function monsterHpColor(pct: number): string {
  if (pct > 50) return 'var(--danger)';
  if (pct > 25) return 'var(--warning)';
  return 'var(--text-mute)';
}
