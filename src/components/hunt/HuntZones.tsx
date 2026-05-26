/* =========================================================
   HUNT ZONES — 사냥터 카드 (zone-card 디자인 핸드오프 기반)
   방 진행(floor buttons) + 명중률 게이지 + 정보 그리드
   ========================================================= */
import { useGameStore } from '../../store/gameStore';
import { HUNT_ZONES } from '../../data/gameData';
import { calcHitRate, meleeHit } from '../../data/statFormulas';

function formatKillTime(ms: number): string {
  if (ms <= 0) return '--';
  return `${(ms / 1000).toFixed(1)}s`;
}

const ROOMS_PER_ZONE = 5;
const ROOM_KILL_REQ = 5;

export default function HuntZones() {
  const level = useGameStore((s) => s.level);
  const hunt = useGameStore((s) => s.hunt);
  const weapon = useGameStore((s) => s.equippedWeapon);
  const currentHp = useGameStore((s) => s.currentHp);
  const materials = useGameStore((s) => s.materials);
  const pauseHunt = useGameStore((s) => s.pauseHunt);
  const resumeHunt = useGameStore((s) => s.resumeHunt);
  const revive = useGameStore((s) => s.revive);
  const setViewMode = useGameStore((s) => s.setViewMode);
  const moveToRoom = useGameStore((s) => s.moveToRoom);
  const moveToNextFloor = useGameStore((s) => s.moveToNextFloor);
  const startHunt = useGameStore((s) => s.startHunt);
  const setMaterials = useGameStore((s) => s.setMaterials);
  const getStr = useGameStore((s) => s.getStr);

  const currentZone = HUNT_ZONES.find((z) => z.id === hunt.zoneId);
  const currentIdx = HUNT_ZONES.findIndex((z) => z.id === hunt.zoneId);
  const nextZone = currentIdx >= 0 && currentIdx < HUNT_ZONES.length - 1
    ? HUNT_ZONES[currentIdx + 1]
    : null;

  // 던전: 같은 던전 그룹의 다음 층
  const nextFloorZone = currentZone?.zoneType === 'dungeon' && currentZone.floor && currentZone.maxFloor && currentZone.floor < currentZone.maxFloor
    ? HUNT_ZONES.find(z => z.dungeonGroup === currentZone.dungeonGroup && z.floor === currentZone.floor! + 1)
    : null;

  const isHunting = hunt.status === 'hunting';
  const isPaused = hunt.status === 'paused';
  const isDead = currentHp <= 0;
  const isActive = hunt.status !== 'idle' && !!currentZone;

  const str = getStr();
  const weaponEnchant = weapon?.enhanceLevel ?? 0;
  const playerMeleeHit = meleeHit(level, weaponEnchant, str);

  // 현재 존 명중률
  const currentHitRate = currentZone
    ? (() => {
        const regulars = currentZone.monsters;
        return regulars.reduce((s, m) => s + calcHitRate(playerMeleeHit, m.level + m.ac), 0)
          / Math.max(1, regulars.length);
      })()
    : 0;
  const hitRatePct = Math.round(currentHitRate * 100);

  // 다음 존 명중률
  const displayNextZone = nextFloorZone ?? nextZone;

  const currentRoom = hunt.currentRoom ?? 1;
  const roomKills = hunt.roomKills ?? 0;
  const roomCleared = hunt.roomCleared ?? 0;
  const allRoomsCleared = roomCleared >= ROOMS_PER_ZONE;
  const totalMaterials = Object.values(hunt.materialsGained ?? {}).reduce((a, b) => a + b, 0);

  // 다음 층 주문서 수
  const nextFloorScrollCount = currentZone?.zoneType === 'dungeon' && currentZone.floor && currentZone.maxFloor && currentZone.floor < currentZone.maxFloor
    ? (materials[`scroll_${currentZone.dungeonGroup}_${currentZone.floor + 1}f`] ?? 0)
    : 0;

  // 다음 사냥터 이동 가능 여부
  const canMoveNext = (() => {
    if (!displayNextZone) return false;
    if (nextFloorZone) {
      return allRoomsCleared || nextFloorScrollCount > 0;
    }
    if (nextZone?.zoneType === 'dungeon' && nextZone.floor && nextZone.floor > 1) {
      const scrollId = `scroll_${nextZone.id}`;
      return (materials[scrollId] ?? 0) >= 1;
    }
    return true;
  })();

  // 사냥 시간 (분)
  const elapsed = hunt.startedAt > 0
    ? Math.max(1, Math.floor((Date.now() - hunt.startedAt) / 60000))
    : 0;

  /* ── 존 미선택 ── */
  if (!currentZone) {
    return (
      <div style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--s-3) var(--s-4)',
        flexShrink: 0,
      }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--s-2)',
            padding: 'var(--s-4)',
            background: 'var(--bg-sunken)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--r-sm)',
            cursor: 'pointer',
          }}
          onClick={() => setViewMode('zones')}
        >
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-mute)' }}>
            사냥터를 선택하세요
          </span>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent)' }}>→ Zones</span>
        </div>
      </div>
    );
  }

  const isTrainingCapped = currentZone.id === 'map_training' && level >= 12;

  const handleZoneClick = () => {
    if (isDead) { revive(); return; }
    if (isHunting) pauseHunt();
    else if (isPaused) resumeHunt();
  };

  const handleNextMove = () => {
    if (!displayNextZone) return;
    if (nextFloorZone) {
      if (allRoomsCleared) {
        moveToNextFloor(false);
      } else if (nextFloorScrollCount > 0) {
        moveToNextFloor(true);
      }
      return;
    }
    if (nextZone) {
      if (nextZone.zoneType === 'dungeon' && nextZone.floor && nextZone.floor > 1) {
        const scrollId = `scroll_${nextZone.id}`;
        const scrollCount = materials[scrollId] ?? 0;
        if (scrollCount < 1) return;
        setMaterials({ ...materials, [scrollId]: scrollCount - 1 });
      }
      startHunt(nextZone.id);
    }
  };

  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-md)',
      padding: '12px 14px',
      flexShrink: 0,
    }}>
      {/* ── Header: 이름 + 레벨 + 상태 ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginBottom: 8,
          cursor: isActive ? 'pointer' : 'default',
        }}
        onClick={handleZoneClick}
      >
        <span style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text)',
          fontFamily: 'var(--font-display)',
        }}>
          {currentZone.name}
        </span>

        {isActive && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: isDead ? 'var(--danger)' : isHunting ? 'var(--success)' : 'var(--warning)',
              boxShadow: `0 0 5px ${isDead ? 'var(--danger)' : isHunting ? 'var(--success)' : 'var(--warning)'}`,
              animation: isDead ? 'hzPulse 1s infinite' : isHunting ? 'hzPulse 1.5s infinite' : 'none',
            }} />
          </span>
        )}

        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          color: 'var(--text-mute)',
          marginLeft: 'auto',
        }}>
          Lv.{currentZone.levelRange[0]}~{currentZone.levelRange[1]}
        </span>
      </div>

      {isTrainingCapped && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--warning)',
          fontWeight: 700,
          marginBottom: 6,
        }}>
          ⚠ EXP 획득 불가 (Lv.12+)
        </div>
      )}

      {/* ── Floor buttons ── */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 8,
      }}>
        {Array.from({ length: ROOMS_PER_ZONE }, (_, i) => {
          const room = i + 1;
          const isCleared = room <= roomCleared;
          const isCurrent = room === currentRoom;
          const isLocked = room > roomCleared + 1;

          return (
            <button
              key={room}
              disabled={isLocked}
              onClick={(e) => {
                e.stopPropagation();
                if (!isLocked && !isCurrent) moveToRoom(room);
              }}
              style={{
                flex: 1,
                aspectRatio: '1.5',
                background: isCurrent
                  ? 'color-mix(in oklch, var(--accent) 8%, transparent)'
                  : 'var(--bg-sunken)',
                border: isCurrent
                  ? '1px solid color-mix(in oklch, var(--accent) 50%, transparent)'
                  : '1px solid var(--border-soft)',
                borderRadius: 4,
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: isCurrent ? 700 : 400,
                color: isCurrent
                  ? 'var(--accent)'
                  : isCleared
                    ? 'var(--success)'
                    : 'var(--text-mute)',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                opacity: isLocked ? 0.4 : 1,
                padding: 0,
                transition: 'all 0.12s',
              }}
            >
              {room}구역
            </button>
          );
        })}
      </div>

      {/* ── Hit rate gauge ── */}
      <div style={{
        height: 3,
        background: 'var(--bg-sunken)',
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 6,
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, hitRatePct)}%`,
          background: hitRatePct >= 70 ? 'var(--success)' : hitRatePct >= 40 ? 'var(--warning)' : 'var(--danger)',
          borderRadius: 2,
          boxShadow: hitRatePct >= 70
            ? '0 0 4px color-mix(in oklch, var(--success) 30%, transparent)'
            : 'none',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* ── Hit rate + death label ── */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--text-mute)',
        marginBottom: 8,
      }}>
        명중률{' '}
        <span style={{
          fontWeight: 700,
          color: hitRatePct >= 70 ? 'var(--success)' : hitRatePct >= 40 ? 'var(--warning)' : 'var(--danger)',
        }}>
          {hitRatePct}%
        </span>
        {' · '}
        <span style={{
          fontWeight: 700,
          color: isDead ? 'var(--danger)' : isHunting ? 'var(--success)' : isPaused ? 'var(--warning)' : 'var(--text-mute)',
        }}>
          {isDead ? '사망 — 클릭하여 부활' : isHunting ? 'Hunting' : isPaused ? 'Paused' : 'Idle'}
        </span>
      </div>

      {/* ── Info grid ── */}
      {isActive && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          columnGap: 12,
          rowGap: 4,
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
        }}>
          <InfoRow label="KILLS" value={hunt.kills.toLocaleString()} color="var(--accent)" />
          <InfoRow label="GOLD" value={formatGold(hunt.goldGained)} color="var(--accent)" />
          <InfoRow label="MATS" value={String(totalMaterials)} />
          <InfoRow label="ITEMS" value={String(hunt.itemsFound)} />
          <InfoRow label="AVG" value={formatKillTime(hunt.avgKillTime ?? 0)} color="var(--success)" />
          <InfoRow label="TIME" value={elapsed > 0 ? `${elapsed}m` : '--'} />
        </div>
      )}

      {/* ── Room progress ── */}
      {isActive && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 8,
        }}>
          <div style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background: 'color-mix(in oklch, var(--text-mute) 12%, transparent)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, (roomKills / ROOM_KILL_REQ) * 100)}%`,
              background: allRoomsCleared ? 'var(--success)' : 'var(--accent)',
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: currentRoom <= roomCleared ? 'var(--success)' : (roomKills >= ROOM_KILL_REQ ? 'var(--success)' : 'var(--accent)'),
            flexShrink: 0,
          }}>
            {currentRoom <= roomCleared
              ? `${ROOM_KILL_REQ}/${ROOM_KILL_REQ} ✓`
              : `${roomKills}/${ROOM_KILL_REQ}`}
          </span>
        </div>
      )}

      {/* ── Next zone / scroll hint ── */}
      {displayNextZone && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px dashed var(--border-soft)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            color: canMoveNext ? 'var(--success)' : 'var(--text-mute)',
            cursor: canMoveNext ? 'pointer' : 'default',
          }}
          onClick={handleNextMove}
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6" />
            <path d="M8 5v3l2 2" />
          </svg>
          {nextFloorZone ? (
            canMoveNext
              ? (allRoomsCleared
                  ? `▲ ${displayNextZone.name} 이동`
                  : `📜 주문서 이동 (${nextFloorScrollCount}장)`)
              : `방 클리어 또는 📜 주문서 필요`
          ) : (
            canMoveNext
              ? `▶ ${displayNextZone.name} 이동`
              : `${displayNextZone.name} (조건 미충족)`
          )}
        </div>
      )}

      <style>{`
        @keyframes hzPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

/* ── Info grid row ── */
function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <>
      <span style={{ color: 'var(--text-mute)' }}>{label}</span>
      <span style={{ color: color ?? 'var(--text)', fontWeight: color ? 600 : 400 }}>{value}</span>
    </>
  );
}

function formatGold(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return n.toLocaleString();
}
