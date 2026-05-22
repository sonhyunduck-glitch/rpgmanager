/* =========================================================
   ZONE SELECT PANEL — 사냥터 선택 (20 스테이지)
   ========================================================= */
import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import {
  HUNT_ZONES, MATERIALS, EQUIPMENT_TEMPLATES,
  type HuntZone,
} from '../../data/gameData';
import { getMonsterDrops } from '../../data/monsterData';
import { calcHitRate, meleeHit, finalAC, acToEvasion } from '../../data/statFormulas';
import { LABEL, PANEL_FULL, BTN_PRIMARY, BTN_DISABLED } from '../../styles/shared';

export default function ZoneSelectPanel() {
  const level = useGameStore(s => s.level);
  const weapon = useGameStore(s => s.equippedWeapon);
  const getTotalDefense = useGameStore(s => s.getTotalDefense);
  const startHunt = useGameStore(s => s.startHunt);
  const setViewMode = useGameStore(s => s.setViewMode);
  const huntZoneId = useGameStore(s => s.hunt.zoneId);
  const materials = useGameStore(s => s.materials);
  const getStr = useGameStore(s => s.getStr);
  const getDex = useGameStore(s => s.getDex);

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(huntZoneId);
  const selectedZone = HUNT_ZONES.find(z => z.id === selectedZoneId) ?? null;

  const str = getStr();
  const dex = getDex();
  const weaponEnchant = weapon?.enhanceLevel ?? 0;
  const playerHit = meleeHit(level, weaponEnchant, str);
  const totalDefense = getTotalDefense();
  const playerAC = finalAC(totalDefense, level, dex);
  const playerEvasion = acToEvasion(playerAC);

  const setMaterials = useGameStore(s => s.setMaterials);

  const handleMove = () => {
    if (!selectedZone || level < selectedZone.requiredLevel) return;

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

  return (
    <div style={{
      display: 'flex',
      gap: 'var(--s-3)',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Left: Zone list */}
      <div style={{
        ...PANEL_FULL,
        flex: 1,
        minWidth: 0,
      }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--fs-md)', marginBottom: 'var(--s-2)' }}>
          사냥터 선택
        </div>
        <ZoneList
          zones={HUNT_ZONES}
          level={level}
          playerHit={playerHit}
          selectedZoneId={selectedZoneId}
          huntZoneId={huntZoneId}
          onSelect={setSelectedZoneId}
          materials={materials}
        />
      </div>

      {/* Right: Zone preview */}
      <div style={{
        ...PANEL_FULL,
        width: 240,
        flexShrink: 0,
      }}>
        {selectedZone ? (
          <ZonePreview zone={selectedZone} level={level} playerHit={playerHit} playerEvasion={playerEvasion} onMove={handleMove} materials={materials} />
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-mute)',
            fontSize: 'var(--fs-sm)',
          }}>
            사냥터를 선택하세요
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Zone Preview ── */
function ZonePreview({
  zone, level, playerHit, playerEvasion, onMove, materials,
}: {
  zone: HuntZone; level: number; playerHit: number; playerEvasion: number; onMove: () => void; materials: Record<string, number>;
}) {
  const unlocked = level >= zone.requiredLevel;

  // 던전 2층 이상: 이동주문서 필요
  const needsScroll = zone.zoneType === 'dungeon' && zone.floor != null && zone.floor > 1;
  const scrollId = needsScroll ? `scroll_${zone.id}` : '';
  const scrollCount = needsScroll ? (materials[scrollId] ?? 0) : 0;
  const hasScroll = scrollCount > 0;
  const canMove = unlocked && (!needsScroll || hasScroll);

  const regulars = zone.monsters;
  const avgHitRate = regulars.reduce(
    (s, m) => s + calcHitRate(playerHit, m.level + m.ac), 0
  ) / Math.max(1, regulars.length);

  const avgMonsterHitRate = regulars.reduce(
    (s, m) => s + calcHitRate(m.level, playerEvasion), 0
  ) / Math.max(1, regulars.length);

  const avgGoldPerKill = regulars.reduce((s, m) => s + m.goldReward, 0) / Math.max(1, regulars.length);
  const estimatedGPM = Math.round(avgGoldPerKill * 15);

  return (
    <>
      {/* Zone name */}
      <div>
        <div style={{ color: 'var(--info)', fontWeight: 800, fontSize: 14 }}>
          {zone.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 2 }}>
          Lv.{zone.levelRange[0]} ~ Lv.{zone.levelRange[1]}
          {!unlocked && (
            <span style={{ color: 'var(--danger)', marginLeft: 4 }}>
              Lv.{zone.requiredLevel} 필요
            </span>
          )}
        </div>
      </div>

      {/* Hit rates */}
      <div style={{
        display: 'flex',
        gap: 'var(--s-2)',
      }}>
        <div style={{
          flex: 1,
          padding: 'var(--s-2)',
          background: 'var(--bg-sunken)',
          borderRadius: 'var(--r-xs)',
          textAlign: 'center',
        }}>
          <div style={{ ...LABEL, fontSize: 8 }}>명중률</div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            fontWeight: 700,
            color: avgHitRate >= 0.7 ? 'var(--success)' : avgHitRate >= 0.4 ? 'var(--warning)' : 'var(--danger)',
          }}>
            {Math.round(avgHitRate * 100)}%
          </div>
        </div>
        <div style={{
          flex: 1,
          padding: 'var(--s-2)',
          background: 'var(--bg-sunken)',
          borderRadius: 'var(--r-xs)',
          textAlign: 'center',
        }}>
          <div style={{ ...LABEL, fontSize: 8 }}>피격률</div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            fontWeight: 700,
            color: avgMonsterHitRate <= 0.3 ? 'var(--success)' : avgMonsterHitRate <= 0.6 ? 'var(--warning)' : 'var(--danger)',
          }}>
            {Math.round(avgMonsterHitRate * 100)}%
          </div>
        </div>
      </div>

      {/* Monster list (scrollable) */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ ...LABEL, marginBottom: 'var(--s-1)' }}>몬스터 ({zone.monsters.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {zone.monsters.map(m => (
            <div key={m.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '2px var(--s-1)',
              background: 'transparent',
              borderRadius: 'var(--r-xs)',
              fontSize: 10,
            }}>
              <span style={{
                color: 'var(--text-dim)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {m.name}
                {m.aggressive && (
                  <span style={{ fontSize: 8, color: 'var(--danger)', marginLeft: 3, fontWeight: 700 }}>
                    선공
                  </span>
                )}
                <span style={{
                  fontSize: 8,
                  color: m.attackType === 'magic' ? 'var(--info)' : 'var(--text-mute)',
                  marginLeft: 3,
                }}>
                  {m.attackType === 'magic' ? '마법' : '근접'}
                </span>
                <span style={{
                  fontSize: 8,
                  color: m.size === 'large' ? 'var(--warning)' : 'var(--text-mute)',
                  marginLeft: 2,
                }}>
                  {m.size === 'large' ? '대' : '소'}
                </span>
                <span style={{ fontSize: 8, color: 'var(--text-mute)', marginLeft: 2 }}>
                  Lv.{m.level}
                </span>
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-mute)', flexShrink: 0 }}>
                {m.expReward}xp
              </span>
            </div>
          ))}
        </div>

        {/* Drops — 존 내 몬스터별 드롭 집계 */}
        {(() => {
          const matDrops = new Map<string, number>();
          const eqDrops = new Map<string, number>();
          for (const m of zone.monsters) {
            for (const [gameId, chance] of getMonsterDrops(m.id)) {
              if (MATERIALS[gameId]) {
                matDrops.set(gameId, Math.max(matDrops.get(gameId) ?? 0, chance));
              } else if (EQUIPMENT_TEMPLATES[gameId]) {
                eqDrops.set(gameId, Math.max(eqDrops.get(gameId) ?? 0, chance));
              }
            }
          }
          const hasMat = matDrops.size > 0;
          const hasEq = eqDrops.size > 0;
          if (!hasMat && !hasEq) return null;
          return (
            <>
              <div style={{ ...LABEL, marginTop: 'var(--s-2)', marginBottom: 'var(--s-1)' }}>드롭</div>
              {hasMat && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {[...matDrops.entries()].map(([id, rate]) => (
                    <span key={id} style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 'var(--r-full)',
                      background: 'var(--bg-panel)', color: 'var(--text-dim)',
                      border: '1px solid var(--border-soft)',
                    }}>
                      {MATERIALS[id]?.name ?? id} {rate >= 0.01 ? `${Math.round(rate * 100)}%` : `${(rate * 100).toFixed(1)}%`}
                    </span>
                  ))}
                </div>
              )}
              {hasEq && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                  {[...eqDrops.entries()].map(([id, rate]) => {
                    const tmpl = EQUIPMENT_TEMPLATES[id];
                    if (!tmpl) return null;
                    return (
                      <span key={id} style={{
                        fontSize: 9, padding: '1px 5px', borderRadius: 'var(--r-full)',
                        background: 'color-mix(in oklch, var(--accent) 15%, transparent)',
                        color: 'var(--accent)',
                        border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
                      }}>
                        {tmpl.name} {rate >= 0.01 ? `${(rate * 100).toFixed(0)}%` : `${(rate * 100).toFixed(1)}%`}
                      </span>
                    );
                  })}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Footer stats */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: 'var(--s-1) var(--s-2)',
        background: 'var(--bg-sunken)',
        borderRadius: 'var(--r-xs)',
        fontSize: 10,
      }}>
        <span style={{ color: 'var(--text-mute)' }}>골드/분 ~{estimatedGPM}G</span>
        <span style={{ color: 'var(--text-mute)', fontFamily: 'var(--font-mono)' }}>
          몬스터 {zone.monsters.length}종
        </span>
      </div>

      {/* Scroll info for dungeon floors */}
      {needsScroll && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--s-2)',
          padding: 'var(--s-2)',
          background: hasScroll
            ? 'color-mix(in oklch, var(--accent) 8%, var(--bg-sunken))'
            : 'color-mix(in oklch, var(--danger) 6%, var(--bg-sunken))',
          border: `1px solid ${hasScroll ? 'color-mix(in oklch, var(--accent) 30%, var(--border-soft))' : 'color-mix(in oklch, var(--danger) 20%, var(--border-soft))'}`,
          borderRadius: 'var(--r-xs)',
          fontSize: 10,
        }}>
          <span style={{ fontSize: 12 }}>📜</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: hasScroll ? 'var(--accent)' : 'var(--danger)',
          }}>
            {scrollCount}장
          </span>
          <span style={{ color: 'var(--text-mute)', fontSize: 9 }}>
            {hasScroll ? '이동주문서 사용' : '이동주문서 필요'}
          </span>
        </div>
      )}

      {/* Move button */}
      <button
        style={canMove ? BTN_PRIMARY : BTN_DISABLED}
        disabled={!canMove}
        onClick={onMove}
      >
        {needsScroll && hasScroll ? '📜 이동 (주문서 1장 소모)' : '이동'}
      </button>
    </>
  );
}

/* ── 던전 사이즈 라벨 ── */
const DUNGEON_SIZE_LABEL: Record<string, string> = {
  small: '소형',
  medium: '중형',
  large: '대형',
};

/* ── Zone List — 필드 + 던전 그룹 트리 ── */
type ZoneListEntry =
  | { type: 'field'; zone: HuntZone }
  | { type: 'dungeon-group'; groupId: string; groupName: string; size: string; floors: HuntZone[] };

function ZoneList({
  zones, level, playerHit, selectedZoneId, huntZoneId, onSelect, materials,
}: {
  zones: HuntZone[];
  level: number;
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
              level={level}
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
        const unlocked = level >= floors[0].requiredLevel;
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
                opacity: unlocked ? 1 : 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--s-2)',
                fontFamily: 'var(--font-ui)',
                color: 'var(--text)',
                flexShrink: 0,
              }}
            >
              <span style={{
                fontSize: 8,
                color: 'var(--text-mute)',
                transform: isOpen ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.15s ease',
                flexShrink: 0,
              }}>▶</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 700,
                  fontSize: 12,
                  color: unlocked ? 'var(--text)' : 'var(--text-mute)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {groupName}
                  <span style={{
                    marginLeft: 6,
                    fontSize: 9,
                    color: 'var(--text-mute)',
                    fontWeight: 600,
                  }}>
                    {size} {floors.length}층
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 1 }}>
                  {lvRange}
                  {!unlocked && (
                    <span style={{ color: 'var(--danger)', marginLeft: 4 }}>
                      (Lv.{floors[0].requiredLevel} 필요)
                    </span>
                  )}
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
                    level={level}
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
  zone, level, playerHit, isSelected, isCurrent, onSelect, indent, isLast, materials,
}: {
  zone: HuntZone;
  level: number;
  playerHit: number;
  isSelected: boolean;
  isCurrent: boolean;
  onSelect: (id: string) => void;
  indent?: boolean;
  isLast?: boolean;
  materials?: Record<string, number>;
}) {
  const unlocked = level >= zone.requiredLevel;
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
        opacity: unlocked ? 1 : (needsScroll && !hasScroll ? 0.4 : 0.5),
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
        <span style={{ fontSize: 9, color: 'var(--text-mute)', flexShrink: 0 }}>└</span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700,
          fontSize: indent ? 11 : 12,
          color: unlocked ? (isSelected ? 'var(--info)' : 'var(--text)') : 'var(--text-mute)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          {needsScroll && !hasScroll && (
            <span style={{ fontSize: 9, color: 'var(--text-mute)' }}>🔒</span>
          )}
          {indent ? `${zone.floor}F` : zone.name}
          {isCurrent && (
            <span style={{
              marginLeft: 6,
              fontSize: 9,
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
              fontSize: 9,
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
        <div style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 1 }}>
          Lv.{zone.levelRange[0]}~{zone.levelRange[1]}
          {needsScroll && !hasScroll && (
            <span style={{ color: 'var(--danger)', marginLeft: 4, fontSize: 9 }}>
              이동주문서 필요
            </span>
          )}
        </div>
      </div>

      {unlocked && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: avgHit >= 0.7 ? 'var(--success)' : avgHit >= 0.4 ? 'var(--warning)' : 'var(--danger)',
          fontWeight: 700,
        }}>
          {Math.round(avgHit * 100)}%
        </span>
      )}
    </button>
  );
}
