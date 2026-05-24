/* =========================================================
   HUNT ZONES — 현재 사냥터(좌: 정보 + 방 진행) | 다음 사냥터
   반응형: 좁은 패널에서 세로 배치
   ========================================================= */
import { useRef, useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { HUNT_ZONES } from '../../data/gameData';
import { LABEL } from '../../styles/shared';
import { calcHitRate, meleeHit } from '../../data/statFormulas';

function formatKillTime(ms: number): string {
  if (ms <= 0) return '--';
  return `${(ms / 1000).toFixed(1)}s`;
}

const ROOMS_PER_ZONE = 5;
const ROOM_KILL_REQ = 5;
const COMPACT_BREAKPOINT = 280;

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

  // ── 반응형 감지 ──
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(999);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerW(el.clientWidth);
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setContainerW(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isCompact = containerW < COMPACT_BREAKPOINT;

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

  // 다음 존 명중률 (다음 층 또는 다음 맵)
  const displayNextZone = nextFloorZone ?? nextZone;
  const nextZoneHitRate = displayNextZone
    ? (() => {
        const regulars = displayNextZone.monsters;
        return regulars.reduce((s, m) => s + calcHitRate(playerMeleeHit, m.level + m.ac), 0)
          / Math.max(1, regulars.length);
      })()
    : 0;

  const currentRoom = hunt.currentRoom ?? 1;
  const roomKills = hunt.roomKills ?? 0;
  const roomCleared = hunt.roomCleared ?? 0;
  const allRoomsCleared = roomCleared >= ROOMS_PER_ZONE;

  const totalMaterials = Object.values(hunt.materialsGained ?? {}).reduce((a, b) => a + b, 0);

  // 다음 층 주문서 수
  const nextFloorScrollCount = currentZone?.zoneType === 'dungeon' && currentZone.floor && currentZone.maxFloor && currentZone.floor < currentZone.maxFloor
    ? (materials[`scroll_${currentZone.dungeonGroup}_${currentZone.floor + 1}f`] ?? 0)
    : 0;

  /* ── 존 미선택 ── */
  if (!currentZone) {
    return (
      <div
        ref={containerRef}
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-soft)',
          borderRadius: 'var(--r-md)',
          padding: 'var(--s-3) var(--s-4)',
          flexShrink: 0,
        }}
      >
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

  const isDungeon = currentZone.zoneType === 'dungeon';
  const accentColor = isDungeon ? 'var(--warning)' : 'var(--accent)';
  const isTrainingCapped = currentZone.id === 'map_training' && level >= 12;

  // 다음 사냥터 이동 가능 여부
  const canMoveNext = (() => {
    if (!displayNextZone) return false;
    if (nextFloorZone) {
      // 던전: 전체 클리어 OR 주문서 보유
      return allRoomsCleared || nextFloorScrollCount > 0;
    }
    // 필드 → 다음 존
    if (nextZone?.zoneType === 'dungeon' && nextZone.floor && nextZone.floor > 1) {
      const scrollId = `scroll_${nextZone.id}`;
      return (materials[scrollId] ?? 0) >= 1;
    }
    return true;
  })();

  return (
    <div
      ref={containerRef}
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--s-2) var(--s-3)',
        flexShrink: 0,
      }}
    >
      {/* compact: 세로 배치 / wide: 가로 배치 */}
      <div style={{
        display: 'flex',
        flexDirection: isCompact ? 'column' : 'row',
        gap: 'var(--s-2)',
      }}>
        {/* ── 현재 사냥터 ── */}
        <div
          style={{
            flex: isCompact ? undefined : 3,
            minWidth: 0,
            background: isActive
              ? `color-mix(in oklch, ${accentColor} 8%, var(--bg-panel))`
              : 'var(--bg-sunken)',
            border: isActive
              ? `1.5px solid ${accentColor}`
              : '1px solid var(--border-soft)',
            borderRadius: 'var(--r-md)',
            padding: 'var(--s-2) var(--s-3)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: isActive
              ? `0 0 10px color-mix(in oklch, ${accentColor} 20%, transparent)`
              : 'none',
            overflow: 'hidden',
          }}
          onClick={() => {
            if (isDead) { revive(); return; }
            if (isHunting) pauseHunt();
            else if (isPaused) resumeHunt();
          }}
        >
          {/* compact: 이름 위, 방 아래 / wide: 가로 */}
          <div style={{
            display: 'flex',
            flexDirection: isCompact ? 'column' : 'row',
            gap: 'var(--s-2)',
          }}>
            {/* 맵이름 + 레벨 + 상태 */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div
                style={{
                  fontSize: 'var(--fs-base)',
                  fontWeight: 700,
                  color: isActive ? accentColor : 'var(--text)',
                  fontFamily: 'var(--font-display)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {currentZone.name}
              </div>
              <div style={{ ...LABEL, fontSize: 'var(--fs-xs)', marginTop: 2 }}>
                Lv.{currentZone.levelRange[0]}~{currentZone.levelRange[1]}
                {isTrainingCapped && (
                  <span style={{ color: 'var(--warning)', fontWeight: 700, marginLeft: 6 }}>
                    ⚠ EXP 획득 불가
                  </span>
                )}
              </div>
              {isActive && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                  <span
                    style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: isDead ? 'var(--danger)' : isHunting ? 'var(--success)' : 'var(--warning)',
                      boxShadow: `0 0 5px ${isDead ? 'var(--danger)' : isHunting ? 'var(--success)' : 'var(--warning)'}`,
                      animation: isDead ? 'hzPulse 1s infinite' : isHunting ? 'hzPulse 1.5s infinite' : 'none',
                    }}
                  />
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--fs-xs)',
                    color: isDead ? 'var(--danger)' : isHunting ? 'var(--success)' : 'var(--warning)',
                  }}>
                    {isDead ? '클릭하여 부활' : isHunting ? 'Hunting' : 'Paused'}
                  </span>
                </div>
              )}
            </div>

            {/* Room 진행 바 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isCompact ? 'flex-start' : 'center',
                gap: 4,
                flexShrink: 0,
                padding: '2px 0',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Room 노드 트랙 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {Array.from({ length: ROOMS_PER_ZONE }, (_, i) => {
                  const room = i + 1;
                  const isCleared = room <= roomCleared;
                  const isCurrent = room === currentRoom;
                  const isLocked = room > roomCleared + 1;

                  return (
                    <div key={room} style={{ display: 'flex', alignItems: 'center' }}>
                      {i > 0 && (
                        <div style={{
                          width: isCompact ? 4 : 8, height: 1,
                          background: isCleared || isCurrent ? 'var(--success)' : 'var(--border-soft)',
                        }} />
                      )}
                      <button
                        disabled={isLocked}
                        onClick={() => {
                          if (!isLocked && !isCurrent) moveToRoom(room);
                        }}
                        style={{
                          width: 'var(--s-5)', height: 'var(--s-5)',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 'var(--fs-xs)',
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                          cursor: isLocked ? 'default' : 'pointer',
                          transition: 'all 0.15s',
                          padding: 0,
                          ...(isCurrent ? {
                            background: `color-mix(in oklch, ${accentColor} 18%, transparent)`,
                            border: `1.5px solid ${accentColor}`,
                            color: accentColor,
                            boxShadow: `0 0 8px color-mix(in oklch, ${accentColor} 25%, transparent)`,
                          } : isCleared ? {
                            background: 'color-mix(in oklch, var(--success) 12%, transparent)',
                            border: '1px solid var(--success)',
                            color: 'var(--success)',
                          } : {
                            background: 'color-mix(in oklch, var(--text-mute) 5%, transparent)',
                            border: '1px solid var(--border-soft)',
                            color: 'var(--text-mute)',
                            opacity: 0.4,
                          }),
                        }}
                      >
                        {room}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Room 킬 진행 바 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                <div style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: 'color-mix(in oklch, var(--text-mute) 12%, transparent)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, (roomKills / ROOM_KILL_REQ) * 100)}%`,
                    background: allRoomsCleared ? 'var(--success)' : accentColor,
                    borderRadius: 2,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <span style={{
                  fontSize: 'var(--fs-2xs)', fontFamily: 'var(--font-mono)', fontWeight: 700,
                  color: currentRoom <= roomCleared ? 'var(--success)' : (roomKills >= ROOM_KILL_REQ ? 'var(--success)' : accentColor),
                  flexShrink: 0,
                }}>
                  {currentRoom <= roomCleared
                    ? `${ROOM_KILL_REQ}/${ROOM_KILL_REQ} ✓`
                    : `${roomKills}/${ROOM_KILL_REQ}`}
                </span>
              </div>
            </div>
          </div>

          {/* ── 서머리 인라인 ── */}
          {isActive && (
            <>
              <div style={{
                height: 1,
                background: `color-mix(in oklch, ${accentColor} 15%, var(--border-soft))`,
                margin: '6px 0 4px',
              }} />
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: isCompact ? '2px 4px' : 4,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <SummaryItem label="KILLS" value={hunt.kills} color="var(--text)" />
                {!isCompact && <Dot />}
                <SummaryItem label="GOLD" value={hunt.goldGained.toLocaleString()} color="var(--accent)" />
                {!isCompact && <Dot />}
                <SummaryItem label="MATS" value={totalMaterials} color="var(--info)" />
                {!isCompact && <Dot />}
                <SummaryItem label="ITEMS" value={hunt.itemsFound} color="var(--success)" />
                {!isCompact && <Dot />}
                <SummaryItem label="AVG" value={formatKillTime(hunt.avgKillTime ?? 0)} color="var(--text)" />
              </div>
            </>
          )}
        </div>

        {/* ── 다음 사냥터 / 다음 층 ── */}
        <div
          style={{
            flex: isCompact ? undefined : 2,
            minWidth: 0,
            background: canMoveNext
              ? 'color-mix(in oklch, var(--success) 6%, var(--bg-sunken))'
              : 'var(--bg-sunken)',
            border: canMoveNext
              ? '1px solid var(--success)'
              : '1px solid var(--border-soft)',
            borderRadius: 'var(--r-md)',
            padding: 'var(--s-2) var(--s-3)',
            overflow: 'hidden',
            cursor: canMoveNext ? 'pointer' : 'default',
            opacity: canMoveNext ? 1 : displayNextZone ? 0.6 : 0.4,
          }}
          onClick={() => {
            if (!displayNextZone) return;

            // 던전 다음 층
            if (nextFloorZone) {
              if (allRoomsCleared) {
                // 전체 클리어 → 무료 이동
                moveToNextFloor(false);
              } else if (nextFloorScrollCount > 0) {
                // 주문서 보유 → 주문서 사용 이동
                moveToNextFloor(true);
              }
              // 조건 미충족 → 아무것도 안 함
              return;
            }

            // 필드 → 다음 필드: 바로 이동
            if (nextZone) {
              // 던전 2층+ 이면 주문서 소모
              if (nextZone.zoneType === 'dungeon' && nextZone.floor && nextZone.floor > 1) {
                const scrollId = `scroll_${nextZone.id}`;
                const scrollCount = materials[scrollId] ?? 0;
                if (scrollCount < 1) return;
                setMaterials({ ...materials, [scrollId]: scrollCount - 1 });
              }
              startHunt(nextZone.id);
            }
          }}
        >
          <div style={{ ...LABEL, fontSize: 'var(--fs-2xs)', marginBottom: 3 }}>
            {nextFloorZone ? '다음 층' : '다음 사냥터'}
          </div>
          {displayNextZone ? (
            <>
              <div
                style={{
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 700,
                  color: canMoveNext ? 'var(--success)' : 'var(--text-dim)',
                  fontFamily: 'var(--font-display)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayNextZone.name}
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-mute)', marginTop: 2 }}>
                Lv.{displayNextZone.levelRange[0]}~{displayNextZone.levelRange[1]}
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: 'var(--text-mute)' }}>명중 </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: nextZoneHitRate >= 0.7 ? 'var(--success)' : nextZoneHitRate >= 0.4 ? 'var(--warning)' : 'var(--danger)',
                  }}
                >
                  {Math.round(nextZoneHitRate * 100)}%
                </span>
              </div>
              {/* 이동 방법 안내 */}
              <div style={{ fontSize: 'var(--fs-xs)', marginTop: 3, fontWeight: 700 }}>
                {canMoveNext ? (
                  <span style={{ color: 'var(--success)' }}>
                    {nextFloorZone
                      ? (allRoomsCleared ? '▲ 클릭하여 이동' : `📜 주문서 이동 (${nextFloorScrollCount}장)`)
                      : '▶ 클릭하여 이동'}
                  </span>
                ) : nextFloorZone ? (
                  <span style={{ color: 'var(--text-mute)' }}>
                    방 클리어 또는 📜 주문서 필요
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-mute)', marginTop: 4 }}>
              {allRoomsCleared ? '최종 층 클리어!' : '최종 사냥터'}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes hzPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

/* ── 서머리 인라인 헬퍼 ── */
function SummaryItem({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
      <span style={{ ...LABEL, fontSize: 'var(--fs-2xs)', marginBottom: 0 }}>{label}</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--fs-xs)', color,
      }}>{value}</span>
    </div>
  );
}

function Dot() {
  return <span style={{ color: 'var(--border-soft)', fontSize: 'var(--fs-2xs)' }}>·</span>;
}
