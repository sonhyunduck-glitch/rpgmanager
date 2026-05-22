/* =========================================================
   HUNT ZONES — 현재 사냥터(좌: 정보 + 방 진행) | 다음 사냥터
   ========================================================= */
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
          <span style={{ fontSize: 11, color: 'var(--text-mute)' }}>
            사냥터를 선택하세요
          </span>
          <span style={{ fontSize: 9, color: 'var(--accent)' }}>→ Zones</span>
        </div>
      </div>
    );
  }

  const isDungeon = currentZone.zoneType === 'dungeon';
  const accentColor = isDungeon ? 'var(--warning)' : 'var(--accent)';

  return (
    <div
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--s-2) var(--s-3)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
        {/* ── 현재 사냥터 ── */}
        <div
          style={{
            flex: 3,
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
          <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
            {/* 좌측: 맵이름 + 레벨 + 상태 */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div
                style={{
                  fontSize: 13,
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
              <div style={{ ...LABEL, fontSize: 9, marginTop: 2 }}>
                Lv.{currentZone.levelRange[0]}~{currentZone.levelRange[1]}
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
                    fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 9,
                    color: isDead ? 'var(--danger)' : isHunting ? 'var(--success)' : 'var(--warning)',
                  }}>
                    {isDead ? '클릭하여 부활' : isHunting ? 'Hunting' : 'Paused'}
                  </span>
                </div>
              )}
            </div>

            {/* 우측: Room 진행 바 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
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
                          width: 8, height: 1,
                          background: isCleared || isCurrent ? 'var(--success)' : 'var(--border-soft)',
                        }} />
                      )}
                      <button
                        disabled={isLocked}
                        onClick={() => {
                          if (!isLocked && !isCurrent) moveToRoom(room);
                        }}
                        style={{
                          width: 22, height: 22,
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
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
                  fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
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
                  display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'space-between',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <SummaryItem label="KILLS" value={hunt.kills} color="var(--text)" />
                <Dot />
                <SummaryItem label="GOLD" value={hunt.goldGained.toLocaleString()} color="var(--accent)" />
                <Dot />
                <SummaryItem label="MATS" value={totalMaterials} color="var(--info)" />
                <Dot />
                <SummaryItem label="ITEMS" value={hunt.itemsFound} color="var(--success)" />
                <Dot />
                <SummaryItem label="AVG" value={formatKillTime(hunt.avgKillTime ?? 0)} color="var(--text)" />
              </div>
            </>
          )}
        </div>

        {/* ── 다음 사냥터 / 다음 층 ── */}
        <div
          style={{
            flex: 2,
            minWidth: 0,
            background: allRoomsCleared && nextFloorZone
              ? 'color-mix(in oklch, var(--success) 6%, var(--bg-sunken))'
              : 'var(--bg-sunken)',
            border: allRoomsCleared && nextFloorZone
              ? '1px solid var(--success)'
              : '1px solid var(--border-soft)',
            borderRadius: 'var(--r-md)',
            padding: 'var(--s-2) var(--s-3)',
            overflow: 'hidden',
            cursor: displayNextZone ? 'pointer' : 'default',
            opacity: displayNextZone ? 1 : 0.5,
          }}
          onClick={() => {
            if (allRoomsCleared && nextFloorZone) {
              // 전체 클리어 + 다음 층 있음 → 자동 이동 (이미 setTimeout으로 처리됨)
              return;
            }
            if (displayNextZone) setViewMode('zones');
          }}
        >
          <div style={{ ...LABEL, fontSize: 8, marginBottom: 3 }}>
            {nextFloorZone ? 'NEXT FLOOR' : 'NEXT MAP'}
          </div>
          {displayNextZone ? (
            <>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: allRoomsCleared && nextFloorZone ? 'var(--success)' : 'var(--text-dim)',
                  fontFamily: 'var(--font-display)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayNextZone.name}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-mute)', marginTop: 2 }}>
                Lv.{displayNextZone.levelRange[0]}~{displayNextZone.levelRange[1]}
              </div>
              <div style={{ fontSize: 9, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                {/* 주문서 표시 (던전일 때) */}
                {nextFloorZone && nextFloorScrollCount > 0 && (
                  <>
                    <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      📜 {nextFloorScrollCount}장
                    </span>
                    <span style={{ color: 'var(--border-soft)' }}>|</span>
                  </>
                )}
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
                {/* 레벨 제한 없음 */}
              </div>
              {/* 주문서 이동 버튼 (던전, 주문서 보유 시) */}
              {nextFloorZone && nextFloorScrollCount > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); moveToNextFloor(true); }}
                  style={{
                    marginTop: 4,
                    fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                    padding: '2px 8px',
                    border: '1px solid var(--accent)',
                    borderRadius: 'var(--r-xs)',
                    background: 'color-mix(in oklch, var(--accent) 12%, transparent)',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  📜 이동
                </button>
              )}
            </>
          ) : (
            <div style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 4 }}>
              {allRoomsCleared ? '최종 층 클리어!' : '최종 스테이지'}
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
      <span style={{ ...LABEL, fontSize: 7, marginBottom: 0 }}>{label}</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 10, color,
      }}>{value}</span>
    </div>
  );
}

function Dot() {
  return <span style={{ color: 'var(--border-soft)', fontSize: 8 }}>·</span>;
}
