/* =========================================================
   WORLD MAP PANEL — L1J 월드맵 시각화
   지역 노드 + 연결선 + 클릭으로 사냥터 이동
   반응형: 모바일에서 하단 시트 오버레이
   ========================================================= */
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
const NODE_SIZE = 52;
const NODE_SIZE_MOBILE = 17;
const MOBILE_BREAKPOINT = 600;

// ── 모바일 전용 노드 위치 (14개 전체 재배치) ──
// 데스크톱 좌표는 넓은 맵에 최적화되어 모바일에서 노드가 겹침.
// 모바일에서는 모든 노드를 균일 간격으로 재배치하여 겹침 방지.
// 최소 노드간 거리 ~14% 이상 확보.
const MOBILE_POS: Record<string, { x: number; y: number }> = {
  // 최남단 (시작 지역)
  jade_island:    { x: 8,  y: 92 },
  talking_island: { x: 35, y: 90 },
  // 하단 (초반)
  gludio:         { x: 15, y: 75 },
  silver_knight:  { x: 45, y: 72 },
  lastabad:       { x: 80, y: 72 },
  // 중단 (중반)
  orc_forest:     { x: 8,  y: 55 },
  dark_forest:    { x: 28, y: 55 },
  mutant_forest:  { x: 58, y: 50 },
  underwater:     { x: 88, y: 55 },
  // 상단 (중핵)
  desert:         { x: 12, y: 38 },
  giran:          { x: 42, y: 35 },
  heine:          { x: 75, y: 35 },
  // 최상단 (고레벨)
  dragon_valley:  { x: 30, y: 18 },
  fertia:         { x: 48, y: 5  },
};

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

  // ── 반응형 감지 ──
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(999);

  // 터치 디바이스 + 화면 짧은 변 ≤500px → 폰 확정
  // 강제 가로모드에서 컨테이너가 600px+ 되어도 폰은 폰
  const [isPhone] = useState(() => {
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (!isTouch) return false;
    const shorter = Math.min(window.screen.width, window.screen.height);
    return shorter <= 500;
  });

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

  const isMobile = containerW < MOBILE_BREAKPOINT || isPhone;
  const nodeSize = isMobile ? NODE_SIZE_MOBILE : NODE_SIZE;

  // 지역 위치 (모바일 보정 적용)
  const getPos = useCallback((region: WorldRegion) => {
    if (isMobile && MOBILE_POS[region.id]) return MOBILE_POS[region.id];
    return region.position;
  }, [isMobile]);

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
    <div ref={containerRef} style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      height: '100%',
      gap: isMobile ? 0 : 'var(--s-3)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* ━━━ MAP AREA ━━━ */}
      <div style={{
        flex: 1,
        background: 'var(--bg-panel)',
        backgroundImage: `
          radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--border-soft) 20%, transparent) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px',
        border: '1px solid var(--border-soft)',
        borderRadius: isMobile ? 'var(--r-md)' : 'var(--r-md)',
        position: 'relative',
        overflow: 'hidden',
        minWidth: 0,
        minHeight: 0,
      }}>
        {/* Map title */}
        <div style={{
          position: 'absolute',
          top: 'var(--s-2)',
          left: 'var(--s-2)',
          zIndex: 10,
          ...LABEL,
          fontSize: isMobile ? 'var(--fs-xs)' : 'var(--fs-sm)',
          color: 'var(--text-dim)',
        }}>
          아덴 대륙
        </div>

        {/* 나침반 */}
        <div style={{
          position: 'absolute',
          top: 'var(--s-2)',
          right: 'var(--s-2)',
          zIndex: 10,
          fontSize: isMobile ? '9px' : '11px',
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
          {connections.map(({ from, to }, i) => {
            const fp = getPos(from);
            const tp = getPos(to);
            return (
              <line
                key={i}
                x1={`${fp.x}%`}
                y1={`${fp.y}%`}
                x2={`${tp.x}%`}
                y2={`${tp.y}%`}
                stroke="var(--border-soft)"
                strokeWidth={isMobile ? 1 : 1.5}
                strokeDasharray={isMobile ? '4,3' : '6,4'}
                opacity="0.5"
              />
            );
          })}
        </svg>

        {/* Region nodes */}
        {WORLD_REGIONS.map(region => {
          const isCurrentRegion = currentRegion?.id === region.id;
          const isSelected = selectedRegionId === region.id;
          const isLocked = level < region.requiredLevel;
          const pos = getPos(region);

          return (
            <button
              key={region.id}
              onClick={() => !isLocked && handleRegionClick(region.id)}
              title={isLocked ? `Lv.${region.requiredLevel} 필요` : region.name}
              style={{
                position: 'absolute',
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: isSelected ? 5 : isCurrentRegion ? 4 : 3,
                width: nodeSize,
                height: nodeSize,
                borderRadius: '50%',
                border: isSelected
                  ? `${isMobile ? 1.5 : 3}px solid ${region.color}`
                  : isCurrentRegion
                    ? `${isMobile ? 1.5 : 3}px solid var(--accent)`
                    : `${isMobile ? 1 : 2}px solid var(--border-soft)`,
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
                  ? `0 0 ${isMobile ? 5 : 12}px color-mix(in oklch, ${region.color} 40%, transparent)`
                  : isCurrentRegion
                    ? `0 0 ${isMobile ? 4 : 8}px color-mix(in oklch, var(--accent) 40%, transparent)`
                    : 'var(--shadow-sm)',
                opacity: isLocked ? 0.4 : 1,
                padding: 0,
                fontFamily: 'var(--font-ui)',
                color: 'var(--text)',
              }}
            >
              <span style={{ fontSize: isMobile ? '9px' : '18px', lineHeight: 1 }}>
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
          const pos = getPos(region);

          return (
            <div
              key={`label-${region.id}`}
              style={{
                position: 'absolute',
                left: `${pos.x}%`,
                top: `calc(${pos.y}% + ${nodeSize / 2 + (isMobile ? 1 : 3)}px)`,
                transform: 'translateX(-50%)',
                zIndex: 2,
                fontSize: isMobile ? '8px' : '10px',
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
                lineHeight: 1.3,
                textAlign: 'center',
              }}
            >
              {region.name}
              {isCurrentRegion && (
                <span style={{
                  marginLeft: 2,
                  fontSize: isMobile ? '6px' : '8px',
                  color: 'var(--accent)',
                }}>●</span>
              )}
              {/* 모바일: Lv 숨김으로 라벨 높이 축소 → 겹침 방지 */}
              {!isMobile && (
                <div style={{
                  fontSize: '8px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-faint)',
                  marginTop: 1,
                }}>
                  Lv.{region.requiredLevel}+
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ━━━ REGION DETAIL ━━━ */}
      {isMobile ? (
        /* ── 모바일: 하단 시트 오버레이 ── */
        selectedRegion && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: '55%',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-soft)',
            borderBottom: 'none',
            borderRadius: 'var(--r-md) var(--r-md) 0 0',
            padding: '0 var(--s-3) var(--s-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--s-2)',
            overflow: 'hidden',
            zIndex: 20,
            boxShadow: '0 -4px 20px rgba(0,0,0,0.35)',
          }}>
            {/* 닫기 핸들 */}
            <div
              onClick={() => setSelectedRegionId(null)}
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '8px 0 4px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <div style={{
                width: 32,
                height: 4,
                borderRadius: 2,
                background: 'var(--border-soft)',
              }} />
            </div>

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
              compact
            />
          </div>
        )
      ) : (
        /* ── 데스크톱: 우측 패널 ── */
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
      )}
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
  compact,
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
  compact?: boolean;
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
          <span style={{ fontSize: compact ? '16px' : '20px' }}>{region.icon}</span>
          <div>
            <div style={{
              fontWeight: 800,
              fontSize: compact ? 'var(--fs-sm)' : 'var(--fs-md)',
              color: region.color,
            }}>
              {region.name}
            </div>
            {!compact && (
              <div style={{
                fontSize: 'var(--fs-2xs)',
                color: 'var(--text-mute)',
                fontFamily: 'var(--font-mono)',
              }}>
                {region.nameEn}
              </div>
            )}
          </div>
        </div>
        {!compact && (
          <div style={{
            marginTop: 'var(--s-2)',
            fontSize: 'var(--fs-xs)',
            color: 'var(--text-dim)',
            lineHeight: 1.5,
          }}>
            {region.description}
          </div>
        )}
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
          paddingTop: 'var(--s-2)',
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
