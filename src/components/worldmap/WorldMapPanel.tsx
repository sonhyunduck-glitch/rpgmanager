/* =========================================================
   WORLD MAP PANEL — L1J 월드맵 시각화
   지역 노드 + 연결선 + 클릭으로 사냥터 이동
   ========================================================= */
import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { HUNT_ZONES } from '../../data/gameData';
import {
  WORLD_REGIONS,
  getRegionByZoneId,
  getZoneIdsForRegion,
  type WorldRegion,
} from '../../data/mapData';
import { LABEL, BTN_PRIMARY, BTN_DISABLED } from '../../styles/shared';

// ── 상수 ──
const NODE_SIZE = 52;        // node circle diameter

export default function WorldMapPanel() {
  const level = useGameStore(s => s.level);
  const huntZoneId = useGameStore(s => s.hunt.zoneId);
  const startHunt = useGameStore(s => s.startHunt);
  const setViewMode = useGameStore(s => s.setViewMode);
  const materials = useGameStore(s => s.materials);
  const setMaterials = useGameStore(s => s.setMaterials);

  // 현재 위치한 지역
  const currentRegion = huntZoneId ? getRegionByZoneId(huntZoneId) : null;

  // 선택한 지역
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(
    currentRegion?.id ?? null
  );
  const selectedRegion = WORLD_REGIONS.find(r => r.id === selectedRegionId) ?? null;

  // 선택한 지역의 사냥터 목록
  const allZoneIds = useMemo(() => HUNT_ZONES.map(z => z.id), []);
  const regionZones = useMemo(() => {
    if (!selectedRegionId) return [];
    const zids = getZoneIdsForRegion(selectedRegionId, allZoneIds);
    return zids.map(zid => HUNT_ZONES.find(z => z.id === zid)).filter(Boolean) as typeof HUNT_ZONES;
  }, [selectedRegionId, allZoneIds]);

  // 선택한 사냥터
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const selectedZone = selectedZoneId
    ? HUNT_ZONES.find(z => z.id === selectedZoneId) ?? null
    : null;

  const handleRegionClick = (regionId: string) => {
    setSelectedRegionId(regionId);
    setSelectedZoneId(null);
  };

  const handleMove = () => {
    if (!selectedZone) return;

    // 던전 2층 이상: 주문서 1장 소모
    if (selectedZone.zoneType === 'dungeon' && selectedZone.floor && selectedZone.floor > 1) {
      const scrollId = `scroll_${selectedZone.id}`;
      const scrollCount = materials[scrollId] ?? 0;
      if (scrollCount < 1) return;
      setMaterials({ ...materials, [scrollId]: scrollCount - 1 });
    }

    startHunt(selectedZone.id);
    setViewMode('main');
  };

  // 연결선 계산 (중복 방지)
  const connections = useMemo(() => {
    const seen = new Set<string>();
    const lines: { from: WorldRegion; to: WorldRegion }[] = [];
    for (const region of WORLD_REGIONS) {
      for (const connId of region.connections) {
        const key = [region.id, connId].sort().join('-');
        if (seen.has(key)) continue;
        seen.add(key);
        const target = WORLD_REGIONS.find(r => r.id === connId);
        if (target) lines.push({ from: region, to: target });
      }
    }
    return lines;
  }, []);

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      gap: 'var(--s-3)',
      overflow: 'hidden',
    }}>
      {/* ━━━ LEFT: World Map ━━━ */}
      <div style={{
        flex: 1,
        background: 'var(--bg-panel)',
        backgroundImage: `
          radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--border-soft) 20%, transparent) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-md)',
        position: 'relative',
        overflow: 'hidden',
        minWidth: 0,
      }}>
        {/* Map title */}
        <div style={{
          position: 'absolute',
          top: 'var(--s-3)',
          left: 'var(--s-3)',
          zIndex: 10,
          ...LABEL,
          fontSize: 'var(--fs-sm)',
          color: 'var(--text-dim)',
        }}>
          아덴 대륙
        </div>

        {/* 나침반 */}
        <div style={{
          position: 'absolute',
          top: 'var(--s-3)',
          right: 'var(--s-3)',
          zIndex: 10,
          fontSize: '11px',
          color: 'var(--text-faint)',
          fontFamily: 'var(--font-mono)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
          lineHeight: 1.2,
        }}>
          <span>N</span>
          <span>·</span>
        </div>

        {/* SVG 연결선 */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        >
          {connections.map(({ from, to }, i) => (
            <line
              key={i}
              x1={`${from.position.x}%`}
              y1={`${from.position.y}%`}
              x2={`${to.position.x}%`}
              y2={`${to.position.y}%`}
              stroke="var(--border-soft)"
              strokeWidth="1.5"
              strokeDasharray="6,4"
              opacity="0.5"
            />
          ))}
        </svg>

        {/* Region nodes */}
        {WORLD_REGIONS.map(region => {
          const isCurrentRegion = currentRegion?.id === region.id;
          const isSelected = selectedRegionId === region.id;
          const isLocked = level < region.requiredLevel;

          return (
            <button
              key={region.id}
              onClick={() => !isLocked && handleRegionClick(region.id)}
              title={isLocked ? `Lv.${region.requiredLevel} 필요` : region.name}
              style={{
                position: 'absolute',
                left: `${region.position.x}%`,
                top: `${region.position.y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: isSelected ? 5 : isCurrentRegion ? 4 : 3,
                width: NODE_SIZE,
                height: NODE_SIZE,
                borderRadius: '50%',
                border: isSelected
                  ? `3px solid ${region.color}`
                  : isCurrentRegion
                    ? '3px solid var(--accent)'
                    : '2px solid var(--border-soft)',
                background: isLocked
                  ? 'var(--bg-sunken)'
                  : isSelected
                    ? `color-mix(in oklch, ${region.color} 25%, var(--bg-elevated))`
                    : 'var(--bg-elevated)',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                boxShadow: isSelected
                  ? `0 0 12px color-mix(in oklch, ${region.color} 40%, transparent)`
                  : isCurrentRegion
                    ? '0 0 8px color-mix(in oklch, var(--accent) 40%, transparent)'
                    : 'var(--shadow-sm)',
                opacity: isLocked ? 0.4 : 1,
                padding: 0,
                fontFamily: 'var(--font-ui)',
                color: 'var(--text)',
              }}
            >
              <span style={{ fontSize: '18px', lineHeight: 1 }}>
                {isLocked ? '🔒' : region.icon}
              </span>
            </button>
          );
        })}

        {/* Region name labels */}
        {WORLD_REGIONS.map(region => {
          const isLocked = level < region.requiredLevel;
          const isCurrentRegion = currentRegion?.id === region.id;
          const isSelected = selectedRegionId === region.id;

          return (
            <div
              key={`label-${region.id}`}
              style={{
                position: 'absolute',
                left: `${region.position.x}%`,
                top: `calc(${region.position.y}% + ${NODE_SIZE / 2 + 4}px)`,
                transform: 'translateX(-50%)',
                zIndex: 2,
                fontSize: '10px',
                fontWeight: isSelected || isCurrentRegion ? 700 : 500,
                color: isLocked
                  ? 'var(--text-faint)'
                  : isSelected
                    ? region.color
                    : isCurrentRegion
                      ? 'var(--accent)'
                      : 'var(--text-dim)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                textShadow: '0 1px 3px var(--bg-panel)',
                fontFamily: 'var(--font-ui)',
              }}
            >
              {region.name}
              {isCurrentRegion && (
                <span style={{
                  marginLeft: 2,
                  fontSize: '8px',
                  color: 'var(--accent)',
                }}>●</span>
              )}
              <div style={{
                fontSize: '8px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-faint)',
                marginTop: 1,
              }}>
                Lv.{region.requiredLevel}+
              </div>
            </div>
          );
        })}
      </div>

      {/* ━━━ RIGHT: Region Detail ━━━ */}
      <div style={{
        width: 260,
        flexShrink: 0,
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--s-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-3)',
        overflow: 'hidden',
      }}>
        {selectedRegion ? (
          <RegionDetail
            region={selectedRegion}
            zones={regionZones}
            currentZoneId={huntZoneId}
            selectedZoneId={selectedZoneId}
            onSelectZone={setSelectedZoneId}
            playerLevel={level}
            materials={materials}
            onMove={handleMove}
            selectedZone={selectedZone}
          />
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-mute)',
            fontSize: 'var(--fs-sm)',
            textAlign: 'center',
            lineHeight: 1.6,
          }}>
            지역을 선택하세요
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 지역 상세 패널 ── */
function RegionDetail({
  region,
  zones,
  currentZoneId,
  selectedZoneId,
  onSelectZone,
  playerLevel,
  materials,
  onMove,
  selectedZone,
}: {
  region: WorldRegion;
  zones: typeof HUNT_ZONES;
  currentZoneId: string | null;
  selectedZoneId: string | null;
  onSelectZone: (id: string) => void;
  playerLevel: number;
  materials: Record<string, number>;
  onMove: () => void;
  selectedZone: (typeof HUNT_ZONES)[number] | null;
}) {
  // 던전 그룹별로 정리
  const { fields, dungeonGroups } = useMemo(() => {
    const fields: typeof HUNT_ZONES = [];
    const dgMap = new Map<string, typeof HUNT_ZONES>();

    for (const z of zones) {
      if (z.zoneType === 'field') {
        fields.push(z);
      } else if (z.dungeonGroup) {
        if (!dgMap.has(z.dungeonGroup)) dgMap.set(z.dungeonGroup, []);
        dgMap.get(z.dungeonGroup)!.push(z);
      }
    }

    return {
      fields,
      dungeonGroups: [...dgMap.entries()].map(([gid, floors]) => ({
        groupId: gid,
        groupName: floors[0].name.replace(/\s*\d+F$/, ''),
        floors,
      })),
    };
  }, [zones]);

  // 선택한 사냥터 이동 가능 여부
  const canMove = (() => {
    if (!selectedZone) return false;
    if (playerLevel < (selectedZone.requiredLevel ?? 0)) return false;
    if (selectedZone.zoneType === 'dungeon' && selectedZone.floor && selectedZone.floor > 1) {
      const scrollId = `scroll_${selectedZone.id}`;
      return (materials[scrollId] ?? 0) >= 1;
    }
    return true;
  })();

  const [openDungeons, setOpenDungeons] = useState<Set<string>>(() => {
    // 현재 사냥 중인 던전 그룹은 기본 열기
    if (!currentZoneId) return new Set<string>();
    const zone = zones.find(z => z.id === currentZoneId);
    return zone?.dungeonGroup ? new Set([zone.dungeonGroup]) : new Set<string>();
  });

  const toggleDungeon = (gid: string) => {
    setOpenDungeons(prev => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else next.add(gid);
      return next;
    });
  };

  return (
    <>
      {/* Region header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
          <span style={{ fontSize: '20px' }}>{region.icon}</span>
          <div>
            <div style={{
              fontWeight: 800,
              fontSize: 'var(--fs-md)',
              color: region.color,
            }}>
              {region.name}
            </div>
            <div style={{
              fontSize: 'var(--fs-2xs)',
              color: 'var(--text-mute)',
              fontFamily: 'var(--font-mono)',
            }}>
              {region.nameEn}
            </div>
          </div>
        </div>
        <div style={{
          marginTop: 'var(--s-2)',
          fontSize: 'var(--fs-xs)',
          color: 'var(--text-dim)',
          lineHeight: 1.5,
        }}>
          {region.description}
        </div>
        {region.underwater && (
          <div style={{
            marginTop: 'var(--s-1)',
            fontSize: 'var(--fs-2xs)',
            color: '#29B6F6',
            fontWeight: 600,
          }}>
            🌊 수중 지역
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{
        height: 1,
        background: 'var(--border-soft)',
        flexShrink: 0,
      }} />

      {/* Zone list */}
      <div style={{
        ...LABEL,
        fontSize: 'var(--fs-2xs)',
      }}>
        사냥터 ({zones.length})
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-1)',
        minHeight: 0,
      }}>
        {/* Fields */}
        {fields.map(zone => (
          <ZoneItem
            key={zone.id}
            zone={zone}
            isSelected={zone.id === selectedZoneId}
            isCurrent={zone.id === currentZoneId}
            playerLevel={playerLevel}
            materials={materials}
            onSelect={onSelectZone}
          />
        ))}

        {/* Dungeon groups */}
        {dungeonGroups.map(({ groupId, groupName, floors }) => {
          const isOpen = openDungeons.has(groupId);
          const lvMin = floors[0].levelRange[0];
          const lvMax = floors[floors.length - 1].levelRange[1];

          return (
            <div key={groupId}>
              <button
                onClick={() => toggleDungeon(groupId)}
                style={{
                  width: '100%',
                  background: 'var(--bg-sunken)',
                  border: '1px solid var(--border-soft)',
                  borderRadius: isOpen ? 'var(--r-xs) var(--r-xs) 0 0' : 'var(--r-xs)',
                  padding: '6px 8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'var(--font-ui)',
                  color: 'var(--text)',
                  fontSize: '11px',
                }}
              >
                <span style={{
                  fontSize: '8px',
                  color: 'var(--text-mute)',
                  transform: isOpen ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.15s',
                }}>▶</span>
                <span style={{ fontWeight: 700, flex: 1 }}>
                  {groupName}
                  <span style={{
                    marginLeft: 4,
                    fontWeight: 500,
                    color: 'var(--text-mute)',
                    fontSize: '10px',
                  }}>
                    {floors.length}층
                  </span>
                </span>
                <span style={{
                  fontSize: '9px',
                  color: 'var(--text-mute)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {lvMin}~{lvMax}
                </span>
              </button>

              {isOpen && (
                <div style={{
                  borderLeft: '1px solid var(--border-soft)',
                  borderRight: '1px solid var(--border-soft)',
                  borderBottom: '1px solid var(--border-soft)',
                  borderRadius: '0 0 var(--r-xs) var(--r-xs)',
                }}>
                  {floors.map(floor => (
                    <ZoneItem
                      key={floor.id}
                      zone={floor}
                      isSelected={floor.id === selectedZoneId}
                      isCurrent={floor.id === currentZoneId}
                      playerLevel={playerLevel}
                      materials={materials}
                      onSelect={onSelectZone}
                      indent
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected zone info + move button */}
      {selectedZone && (
        <div style={{
          borderTop: '1px solid var(--border-soft)',
          paddingTop: 'var(--s-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--s-2)',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--info)' }}>
            {selectedZone.name}
          </div>
          <div style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--text-dim)',
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span>Lv.{selectedZone.levelRange[0]}~{selectedZone.levelRange[1]}</span>
            <span>몬스터 {selectedZone.monsters.length}종</span>
          </div>
          <button
            style={canMove ? BTN_PRIMARY : BTN_DISABLED}
            disabled={!canMove}
            onClick={onMove}
          >
            {selectedZone.id === currentZoneId ? '현재 사냥 중' : '이동하기'}
          </button>
        </div>
      )}
    </>
  );
}

/* ── 사냥터 아이템 ── */
function ZoneItem({
  zone,
  isSelected,
  isCurrent,
  playerLevel,
  materials,
  onSelect,
  indent,
}: {
  zone: (typeof HUNT_ZONES)[number];
  isSelected: boolean;
  isCurrent: boolean;
  playerLevel: number;
  materials: Record<string, number>;
  onSelect: (id: string) => void;
  indent?: boolean;
}) {
  const needsScroll = zone.zoneType === 'dungeon' && zone.floor != null && zone.floor > 1;
  const scrollId = needsScroll ? `scroll_${zone.id}` : '';
  const scrollCount = needsScroll ? (materials[scrollId] ?? 0) : 0;
  const hasScroll = scrollCount > 0;
  const isLocked = playerLevel < zone.requiredLevel || (needsScroll && !hasScroll);

  return (
    <button
      onClick={() => onSelect(zone.id)}
      style={{
        width: '100%',
        background: isSelected ? 'var(--bg-elevated)' : 'transparent',
        border: isSelected ? '1px solid var(--info)' : indent ? 'none' : '1px solid var(--border-soft)',
        borderBottom: indent ? '1px solid var(--border-soft)' : undefined,
        borderRadius: indent ? 0 : 'var(--r-xs)',
        padding: indent ? '5px 8px 5px 20px' : '6px 8px',
        cursor: isLocked ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        opacity: isLocked ? 0.4 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-ui)',
        color: 'var(--text)',
        fontSize: '11px',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: isSelected ? 700 : 600,
          color: isSelected ? 'var(--info)' : 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          {indent ? `${zone.floor}F` : zone.name}
          {isCurrent && (
            <span style={{
              fontSize: '8px',
              padding: '1px 4px',
              borderRadius: 'var(--r-full)',
              background: 'var(--success-soft)',
              color: 'var(--success)',
              fontWeight: 700,
            }}>
              현재
            </span>
          )}
          {needsScroll && (
            <span style={{
              fontSize: '9px',
              color: hasScroll ? 'var(--accent)' : 'var(--text-mute)',
              fontFamily: 'var(--font-mono)',
            }}>
              📜{scrollCount}
            </span>
          )}
        </div>
        <div style={{
          fontSize: '9px',
          color: 'var(--text-mute)',
          marginTop: 1,
        }}>
          Lv.{zone.levelRange[0]}~{zone.levelRange[1]}
        </div>
      </div>
    </button>
  );
}
