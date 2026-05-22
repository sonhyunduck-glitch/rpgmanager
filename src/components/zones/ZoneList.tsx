/* =========================================================
   ZONE LIST — 필드 + 던전 그룹 트리 (접기/펼치기)
   ========================================================= */
import { useState, useMemo } from 'react';
import { calcHitRate } from '../../data/statFormulas';
import type { HuntZone } from '../../data/gameData';

/* ── 던전 사이즈 라벨 ── */
const DUNGEON_SIZE_LABEL: Record<string, string> = {
  small: '소형',
  medium: '중형',
  large: '대형',
};

/* ── Zone List Entry ── */
type ZoneListEntry =
  | { type: 'field'; zone: HuntZone }
  | { type: 'dungeon-group'; groupId: string; groupName: string; size: string; floors: HuntZone[] };

export default function ZoneList({
  zones, playerHit, selectedZoneId, huntZoneId, onSelect, materials,
}: {
  zones: HuntZone[];
  playerHit: number;
  selectedZoneId: string | null;
  huntZoneId: string | null;
  onSelect: (id: string) => void;
  materials: Record<string, number>;
}) {
  const entries = useMemo(() => {
    const result: ZoneListEntry[] = [];
    const dungeonGroups = new Map<string, HuntZone[]>();

    for (const z of zones) {
      if (z.zoneType === 'field') {
        result.push({ type: 'field', zone: z });
      } else if (z.dungeonGroup) {
        if (!dungeonGroups.has(z.dungeonGroup)) dungeonGroups.set(z.dungeonGroup, []);
        dungeonGroups.get(z.dungeonGroup)!.push(z);
      }
    }

    // 던전 그룹을 첫 번째 층의 requiredLevel 순서대로 삽입
    const sortedGroups = [...dungeonGroups.entries()]
      .sort((a, b) => a[1][0].requiredLevel - b[1][0].requiredLevel);

    // 필드 사이에 던전 그룹을 requiredLevel 기준으로 섞어 배치
    const mixed: ZoneListEntry[] = [];
    let gi = 0;
    for (const entry of result) {
      // 현재 필드보다 앞에 와야 할 던전 그룹 삽입
      while (gi < sortedGroups.length) {
        const [gId, floors] = sortedGroups[gi];
        if (floors[0].requiredLevel <= (entry.type === 'field' ? entry.zone.requiredLevel : 0)) {
          const baseName = floors[0].name.replace(/\s*\d+F$/, '');
          mixed.push({
            type: 'dungeon-group',
            groupId: gId,
            groupName: baseName,
            size: DUNGEON_SIZE_LABEL[floors[0].dungeonSize ?? ''] ?? '',
            floors,
          });
          gi++;
        } else break;
      }
      mixed.push(entry);
    }
    // 남은 던전 그룹
    while (gi < sortedGroups.length) {
      const [gId, floors] = sortedGroups[gi];
      const baseName = floors[0].name.replace(/\s*\d+F$/, '');
      mixed.push({
        type: 'dungeon-group',
        groupId: gId,
        groupName: baseName,
        size: DUNGEON_SIZE_LABEL[floors[0].dungeonSize ?? ''] ?? '',
        floors,
      });
      gi++;
    }

    return mixed;
  }, [zones]);

  // 열린 던전 그룹 추적
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    // 현재 사냥 중인 던전 그룹은 기본으로 열기
    const zone = zones.find(z => z.id === huntZoneId);
    return zone?.dungeonGroup ? new Set([zone.dungeonGroup]) : new Set();
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--s-1)',
    }}>
      {entries.map(entry => {
        if (entry.type === 'field') {
          return (
            <ZoneButton
              key={entry.zone.id}
              zone={entry.zone}
              playerHit={playerHit}
              isSelected={entry.zone.id === selectedZoneId}
              isCurrent={entry.zone.id === huntZoneId}
              onSelect={onSelect}
            />
          );
        }

        // 던전 그룹
        const { groupId, groupName, size, floors } = entry;
        const isOpen = openGroups.has(groupId);
        const lvRange = `Lv.${floors[0].levelRange[0]}~${floors[floors.length - 1].levelRange[1]}`;

        return (
          <div key={groupId}>
            {/* 던전 그룹 헤더 */}
            <button
              onClick={(e) => {
                const el = e.currentTarget as HTMLElement;
                toggleGroup(groupId);
                // 펼칠 때 그룹 헤더+층 목록이 보이도록 스크롤
                if (!isOpen) {
                  requestAnimationFrame(() => {
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  });
                }
              }}
              style={{
                width: '100%',
                background: 'var(--bg-sunken)',
                border: '1px solid var(--border-soft)',
                borderRadius: isOpen ? 'var(--r-sm) var(--r-sm) 0 0' : 'var(--r-sm)',
                padding: 'var(--s-2) var(--s-3)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--s-2)',
                fontFamily: 'var(--font-ui)',
                color: 'var(--text)',
                flexShrink: 0,
              }}
            >
              <span style={{
                fontSize: 'var(--fs-2xs)',
                color: 'var(--text-mute)',
                transform: isOpen ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.15s ease',
                flexShrink: 0,
              }}>▶</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 700,
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {groupName}
                  <span style={{
                    marginLeft: 6,
                    fontSize: 'var(--fs-xs)',
                    color: 'var(--text-mute)',
                    fontWeight: 600,
                  }}>
                    {size} {floors.length}층
                  </span>
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-mute)', marginTop: 1 }}>
                  {lvRange}
                </div>
              </div>
            </button>

            {/* 던전 층 목록 (펼침) */}
            {isOpen && (
              <div style={{
                borderLeft: '1px solid var(--border-soft)',
                borderRight: '1px solid var(--border-soft)',
                borderBottom: '1px solid var(--border-soft)',
                borderRadius: '0 0 var(--r-sm) var(--r-sm)',
                overflow: 'hidden',
              }}>
                {floors.map((floor, fi) => (
                  <ZoneButton
                    key={floor.id}
                    zone={floor}
                    playerHit={playerHit}
                    isSelected={floor.id === selectedZoneId}
                    isCurrent={floor.id === huntZoneId}
                    onSelect={onSelect}
                    indent
                    isLast={fi === floors.length - 1}
                    materials={materials}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── 개별 존 버튼 ── */
function ZoneButton({
  zone, playerHit, isSelected, isCurrent, onSelect, indent, isLast, materials,
}: {
  zone: HuntZone;
  playerHit: number;
  isSelected: boolean;
  isCurrent: boolean;
  onSelect: (id: string) => void;
  indent?: boolean;
  isLast?: boolean;
  materials?: Record<string, number>;
}) {
  const regulars = zone.monsters;
  const avgHit = regulars.reduce(
    (s, m) => s + calcHitRate(playerHit, m.level + m.ac), 0
  ) / Math.max(1, regulars.length);

  // 던전 2층 이상: 이동주문서 필요
  const needsScroll = zone.zoneType === 'dungeon' && zone.floor != null && zone.floor > 1;
  const scrollId = needsScroll ? `scroll_${zone.id}` : '';
  const scrollCount = needsScroll && materials ? (materials[scrollId] ?? 0) : 0;
  const hasScroll = scrollCount > 0;

  return (
    <button
      onClick={() => onSelect(zone.id)}
      style={{
        width: '100%',
        background: isSelected ? 'var(--bg-elevated)' : indent ? 'var(--bg-panel)' : 'var(--bg-sunken)',
        border: isSelected
          ? '1px solid var(--info)'
          : indent ? 'none' : '1px solid var(--border-soft)',
        borderBottom: indent && !isLast ? '1px solid var(--border-soft)' : undefined,
        borderRadius: indent ? 0 : 'var(--r-sm)',
        padding: indent ? 'var(--s-1) var(--s-3) var(--s-1) var(--s-4)' : 'var(--s-2) var(--s-3)',
        cursor: 'pointer',
        textAlign: 'left',
        opacity: needsScroll && !hasScroll ? 0.4 : 1,
        transition: 'all var(--dur) var(--ease-out)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--s-3)',
        fontFamily: 'var(--font-ui)',
        color: 'var(--text)',
        flexShrink: 0,
      }}
    >
      {indent && (
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-mute)', flexShrink: 0 }}>└</span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700,
          fontSize: indent ? 11 : 12,
          color: isSelected ? 'var(--info)' : 'var(--text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          {needsScroll && !hasScroll && (
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-mute)' }}>🔒</span>
          )}
          {indent ? `${zone.floor}F` : zone.name}
          {isCurrent && (
            <span style={{
              marginLeft: 6,
              fontSize: 'var(--fs-xs)',
              padding: '1px 6px',
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
              marginLeft: 4,
              fontSize: 'var(--fs-xs)',
              padding: '1px 5px',
              borderRadius: 'var(--r-full)',
              background: hasScroll
                ? 'color-mix(in oklch, var(--accent) 15%, transparent)'
                : 'color-mix(in oklch, var(--text-mute) 10%, transparent)',
              color: hasScroll ? 'var(--accent)' : 'var(--text-mute)',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
            }}>
              📜{scrollCount}
            </span>
          )}
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-mute)', marginTop: 1 }}>
          Lv.{zone.levelRange[0]}~{zone.levelRange[1]}
          {needsScroll && !hasScroll && (
            <span style={{ color: 'var(--danger)', marginLeft: 4, fontSize: 'var(--fs-xs)' }}>
              이동주문서 필요
            </span>
          )}
        </div>
      </div>

      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-xs)',
        color: avgHit >= 0.7 ? 'var(--success)' : avgHit >= 0.4 ? 'var(--warning)' : 'var(--danger)',
        fontWeight: 700,
      }}>
        {Math.round(avgHit * 100)}%
      </span>
    </button>
  );
}
