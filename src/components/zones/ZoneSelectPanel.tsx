/* =========================================================
   ZONE SELECT PANEL — 사냥터 선택 (디자인 핸드오프 기반)
   카드 그리드 + 상세 사이드바 + 지역 탭 + 검색/필터
   ========================================================= */
import { useState, useMemo, useRef, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { HUNT_ZONES, MATERIALS, EQUIPMENT_TEMPLATES } from '../../data/gameData';
import type { HuntZone, Monster } from '../../data/gameData';
import { getMonsterDrops } from '../../data/dropData';
import { calcHitRate, meleeHit } from '../../data/statFormulas';
import { useCompact } from '../../lib/useCompact';
import WorldMapPanel from '../worldmap/WorldMapPanel';
import { monsterIndexToColor } from '../../utils/monsterColors';

/* ═══════════════════════════════════════════
   상수 & 타입
   ═══════════════════════════════════════════ */
type RegionId = 'all' | 'beginner' | 'intermediate' | 'advanced' | 'dungeon';
type SortKey = 'lvAsc' | 'lvDesc' | 'gold' | 'rec';
type PageView = 'cards' | 'worldmap';

const REGIONS: { id: RegionId; name: string; lv: string }[] = [
  { id: 'all', name: '전체', lv: '' },
  { id: 'beginner', name: '초급', lv: 'Lv.1~14' },
  { id: 'intermediate', name: '중급', lv: 'Lv.14~26' },
  { id: 'advanced', name: '상급', lv: 'Lv.26+' },
  { id: 'dungeon', name: '던전', lv: '' },
];

const ESTIMATED_KILLS_HR = 120;


/* ═══════════════════════════════════════════
   유틸 함수
   ═══════════════════════════════════════════ */
function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function monsterDotClass(m: Monster): string {
  if (m.attackType === 'magic') return 'p';
  if (m.aggressive) return 'r';
  if (m.size === 'large') return 'c';
  return 'g';
}

function generateDots(zone: HuntZone): { x: number; y: number; cls: string; monsterIdx: number }[] {
  const dots: { x: number; y: number; cls: string; monsterIdx: number }[] = [];
  const monsters = zone.monsters.slice(0, 10);
  for (let mi = 0; mi < monsters.length; mi++) {
    const m = monsters[mi];
    const cnt = Math.min(2, mi < 4 ? 2 : 1);
    for (let j = 0; j < cnt; j++) {
      const h = stableHash(`${zone.id}_${m.id}_${j}`);
      dots.push({
        x: 10 + (h % 78),
        y: 12 + ((h >>> 8) % 74),
        cls: monsterDotClass(m),
        monsterIdx: mi,
      });
    }
  }
  return dots.slice(0, 12);
}

function estimateRewards(monsters: Monster[]) {
  if (!monsters.length) return { goldHr: 0, expHr: 0 };
  const avgG = monsters.reduce((s, m) => s + m.goldReward, 0) / monsters.length;
  const avgE = monsters.reduce((s, m) => s + m.expReward, 0) / monsters.length;
  return {
    goldHr: Math.round(avgG * ESTIMATED_KILLS_HR),
    expHr: Math.round(avgE * ESTIMATED_KILLS_HR),
  };
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'k';
  return n.toLocaleString();
}

function fmtFull(n: number): string { return n.toLocaleString('en-US'); }

function matchRegion(zone: HuntZone, r: RegionId): boolean {
  if (r === 'all') return true;
  if (r === 'dungeon') return zone.zoneType === 'dungeon';
  return zone.tier === r;
}

function matchSearch(zone: HuntZone, q: string): boolean {
  if (!q) return true;
  const lq = q.toLowerCase();
  return zone.name.toLowerCase().includes(lq)
    || zone.monsters.some(m => m.name.toLowerCase().includes(lq));
}

function isRecommended(zone: HuntZone, lv: number): boolean {
  return lv >= zone.requiredLevel && lv <= zone.levelRange[1] + 3;
}

function rateToColor(rate: number): string {
  if (rate >= 0.10) return 'var(--text-mute)';
  if (rate >= 0.03) return 'var(--rare-rare, var(--info))';
  if (rate >= 0.005) return 'var(--rare-epic, oklch(0.68 0.20 305))';
  return 'var(--rare-legendary, var(--accent))';
}

/* ═══════════════════════════════════════════
   ZoneCard — 사냥터 카드 (미니맵 + 정보 + 이동)
   ═══════════════════════════════════════════ */
function ZoneCard({ zone, selected, onSelect, onGo, isHere, playerLevel, playerHit, materials }: {
  zone: HuntZone;
  selected: boolean;
  onSelect: (id: string) => void;
  onGo: (zone: HuntZone) => void;
  isHere: boolean;
  playerLevel: number;
  playerHit: number;
  materials: Record<string, number>;
}) {
  const dots = useMemo(() => generateDots(zone), [zone]);
  const rewards = useMemo(() => estimateRewards(zone.monsters), [zone.monsters]);
  const isLocked = playerLevel < zone.requiredLevel;
  const rec = isRecommended(zone, playerLevel);
  const matchLv = playerLevel >= zone.levelRange[0] && playerLevel <= zone.levelRange[1] + 5;
  const isHard = zone.levelRange[0] > playerLevel + 5;

  const avgHit = zone.monsters.length > 0
    ? zone.monsters.reduce((s, m) => s + calcHitRate(playerHit, m.level + m.ac), 0) / zone.monsters.length
    : 0;
  const hitPct = Math.round(avgHit * 100);

  const needsScroll = zone.zoneType === 'dungeon' && zone.floor != null && zone.floor > 1;
  const scrollId = needsScroll ? `scroll_${zone.id}` : '';
  const scrollCount = needsScroll ? (materials[scrollId] ?? 0) : 0;

  return (
    <div
      onClick={() => onSelect(zone.id)}
      style={{
        background: 'var(--bg-panel)',
        border: selected
          ? '1px solid color-mix(in oklch, var(--accent) 60%, transparent)'
          : '1px solid var(--border-soft)',
        borderRadius: 8,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.12s, transform 0.12s, box-shadow 0.12s',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        opacity: isLocked ? 0.55 : 1,
        boxShadow: selected ? '0 0 0 1px color-mix(in oklch, var(--accent) 25%, transparent)' : 'none',
      }}
    >
      {/* 사냥중 플래그 */}
      {isHere && (
        <span style={{
          position: 'absolute', top: 8, right: 8, zIndex: 2,
          padding: '2px 8px',
          background: 'var(--accent)', color: '#1a1100',
          fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700,
          borderRadius: 100, letterSpacing: '0.04em',
        }}>사냥중</span>
      )}

      {/* 미니맵 */}
      <div style={{
        height: 96,
        background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(255,255,255,0.02), transparent), var(--bg-sunken)',
        borderBottom: '1px solid var(--border-soft)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {zone.floor != null && (
          <span style={{
            position: 'absolute', top: 4, left: 6,
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: 'var(--accent)', letterSpacing: '0.04em',
          }}>{zone.floor}F</span>
        )}
        <span style={{
          position: 'absolute', bottom: 5, right: 8,
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: 'var(--text-faint)',
        }}>8M</span>

        {/* 명중률 뱃지 */}
        <span style={{
          position: 'absolute', top: 4, right: isHere ? 56 : 6,
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
          padding: '1px 5px', borderRadius: 3,
          background: 'color-mix(in oklch, var(--bg-sunken) 80%, transparent)',
          color: hitPct >= 70 ? 'var(--success)' : hitPct >= 40 ? 'var(--warning)' : 'var(--danger)',
        }}>{hitPct}%</span>

        <div style={{ position: 'relative', width: '90%', height: 64, margin: '16px auto 0' }}>
          {dots.map((d, i) => (
            <span key={i} style={{
              position: 'absolute',
              left: `${d.x}%`, top: `${d.y}%`,
              width: 7, height: 7, borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              background: monsterIndexToColor(d.monsterIdx),
              boxShadow: `0 0 4px ${monsterIndexToColor(d.monsterIdx)}80`,
            }} />
          ))}
          {/* 현재 존이면 유저 닷 */}
          {isHere && (
            <span style={{
              position: 'absolute',
              left: '42%', top: '55%',
              width: 12, height: 12, borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'transparent',
              border: '1.5px solid var(--accent)',
              boxShadow: '0 0 8px color-mix(in oklch, var(--accent) 60%, transparent)',
            }} />
          )}
        </div>
      </div>

      {/* 본문 */}
      <div style={{ padding: '11px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* 이름 + 레벨 */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span style={{
            fontSize: 13.5, fontWeight: 600, color: 'var(--text)',
            fontFamily: 'var(--font-display)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{zone.name}</span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10.5, marginLeft: 'auto', flexShrink: 0,
            color: matchLv ? 'var(--success)' : isHard ? 'var(--danger)' : 'var(--text-mute)',
          }}>Lv.{zone.levelRange[0]}~{zone.levelRange[1]}</span>
        </div>

        {/* 태그 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {rec && (
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 3,
              color: 'var(--accent)',
              border: '1px solid color-mix(in oklch, var(--accent) 40%, transparent)',
              background: 'color-mix(in oklch, var(--accent) 5%, transparent)',
            }}>★ 추천</span>
          )}
          {zone.zoneType === 'dungeon' && (
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 3,
              color: 'oklch(0.68 0.20 305)',
              border: '1px solid oklch(0.68 0.20 305 / 0.3)',
              background: 'var(--bg-elevated)',
            }}>던전</span>
          )}
          {zone.monsters.some(m => m.aggressive) && (
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 3,
              color: 'var(--danger)',
              border: '1px solid color-mix(in oklch, var(--danger) 30%, transparent)',
              background: 'var(--bg-elevated)',
            }}>선공</span>
          )}
          {zone.monsters.some(m => m.attackType === 'magic') && (
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 3,
              color: 'var(--info)',
              border: '1px solid color-mix(in oklch, var(--info) 30%, transparent)',
              background: 'var(--bg-elevated)',
            }}>마법</span>
          )}
          {needsScroll && (
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 3,
              fontFamily: 'var(--font-mono)',
              color: scrollCount > 0 ? 'var(--accent)' : 'var(--text-mute)',
              border: `1px solid ${scrollCount > 0 ? 'color-mix(in oklch, var(--accent) 40%, transparent)' : 'var(--border-soft)'}`,
              background: 'var(--bg-elevated)',
            }}>📜{scrollCount}</span>
          )}
        </div>

        {/* 통계 */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 4, marginTop: 4,
          paddingTop: 8, borderTop: '1px dashed var(--border-soft)',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
            <span style={{ color: 'var(--text-faint)', display: 'block', letterSpacing: '0.04em', textTransform: 'uppercase' as const, fontSize: 9 }}>G/시</span>
            <span style={{ color: 'var(--accent)', fontSize: 11 }}>{fmtNum(rewards.goldHr)}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
            <span style={{ color: 'var(--text-faint)', display: 'block', letterSpacing: '0.04em', textTransform: 'uppercase' as const, fontSize: 9 }}>XP/시</span>
            <span style={{ color: 'var(--info)', fontSize: 11 }}>{fmtNum(rewards.expHr)}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
            <span style={{ color: 'var(--text-faint)', display: 'block', letterSpacing: '0.04em', textTransform: 'uppercase' as const, fontSize: 9 }}>몬스터</span>
            <span style={{ color: 'var(--text)', fontSize: 11 }}>{zone.monsters.length}종</span>
          </div>
        </div>

        {/* 이동 버튼 */}
        <button
          onClick={(e) => { e.stopPropagation(); if (!isLocked && !isHere) onGo(zone); }}
          disabled={isLocked}
          style={{
            marginTop: 6, padding: '7px 0', borderRadius: 4,
            fontSize: 11.5, fontWeight: 600,
            transition: 'all 0.1s',
            border: isHere
              ? '1px solid color-mix(in oklch, var(--accent) 45%, transparent)'
              : '1px solid color-mix(in oklch, var(--success) 35%, transparent)',
            background: isHere
              ? 'color-mix(in oklch, var(--accent) 10%, transparent)'
              : 'color-mix(in oklch, var(--success) 8%, transparent)',
            color: isHere ? 'var(--accent)' : 'var(--success)',
            cursor: isLocked || isHere ? 'default' : 'pointer',
          }}
        >
          {isHere ? '현재 위치' : isLocked ? '잠금' : '이동'}
        </button>
      </div>

      {/* 잠금 오버레이 */}
      {isLocked && !isHere && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'grid', placeItems: 'center',
          background: 'rgba(6,8,11,0.55)',
          color: 'var(--text-faint)',
          fontFamily: 'var(--font-mono)', fontSize: 11,
          backdropFilter: 'blur(1px)',
          zIndex: 3,
        }}>★ Lv.{zone.requiredLevel} 필요</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   ZoneDetail — 선택 존 상세 사이드바
   ═══════════════════════════════════════════ */
function ZoneDetail({ zone, onGo, isHere, playerLevel, playerHit }: {
  zone: HuntZone | null;
  onGo: (zone: HuntZone) => void;
  isHere: boolean;
  playerLevel: number;
  playerHit: number;
}) {
  if (!zone) return (
    <div style={{
      background: 'var(--bg-panel)', border: '1px solid var(--border-soft)',
      borderRadius: 8, padding: 40, textAlign: 'center',
      color: 'var(--text-faint)', fontSize: 12,
    }}>사냥터를 선택하세요</div>
  );

  const dots = useMemo(() => generateDots(zone), [zone]);
  const rewards = useMemo(() => estimateRewards(zone.monsters), [zone.monsters]);
  const isLocked = playerLevel < zone.requiredLevel;

  const avgHit = zone.monsters.length > 0
    ? zone.monsters.reduce((s, m) => s + calcHitRate(playerHit, m.level + m.ac), 0) / zone.monsters.length
    : 0;

  const needsScroll = zone.zoneType === 'dungeon' && zone.floor != null && zone.floor > 1;

  /* 드롭 집계 */
  const drops = useMemo(() => {
    const matDrops = new Map<string, { name: string; rate: number }>();
    const eqDrops = new Map<string, { name: string; rate: number }>();
    for (const m of zone.monsters) {
      for (const [gameId, chance] of getMonsterDrops(m.id)) {
        if (gameId === '__GOLD__') continue;
        const mat = MATERIALS[gameId];
        const eq = EQUIPMENT_TEMPLATES[gameId];
        if (mat) matDrops.set(gameId, { name: mat.name, rate: Math.max(matDrops.get(gameId)?.rate ?? 0, chance) });
        else if (eq) eqDrops.set(gameId, { name: eq.name, rate: Math.max(eqDrops.get(gameId)?.rate ?? 0, chance) });
      }
    }
    return { matDrops, eqDrops };
  }, [zone]);

  const allDrops = [
    ...[...drops.matDrops.values()],
    ...[...drops.eqDrops.values()],
  ].sort((a, b) => b.rate - a.rate).slice(0, 10);

  return (
    <div style={{
      position: 'sticky', top: 14,
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-soft)',
      borderRadius: 8, overflow: 'hidden',
      alignSelf: 'start',
    }}>
      {/* 큰 미니맵 */}
      <div style={{
        height: 200,
        background: 'radial-gradient(ellipse 70% 50% at 50% 60%, rgba(255,255,255,0.025), transparent), var(--bg-sunken)',
        borderBottom: '1px solid var(--border-soft)',
        position: 'relative', overflow: 'hidden',
      }}>
        <span style={{
          position: 'absolute', top: 10, left: 12,
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--text-mute)', letterSpacing: '0.04em',
        }}>{zone.name} · 미리보기</span>
        <span style={{
          position: 'absolute', bottom: 10, right: 12,
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)',
        }}>16M × 12M</span>
        <div style={{ position: 'absolute', inset: 18 }}>
          {dots.map((d, i) => (
            <span key={i} style={{
              position: 'absolute',
              left: `${d.x}%`, top: `${d.y}%`,
              width: 8, height: 8, borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              background: monsterIndexToColor(d.monsterIdx),
              boxShadow: `0 0 4px ${monsterIndexToColor(d.monsterIdx)}80`,
            }} />
          ))}
          {isHere && (
            <span style={{
              position: 'absolute', left: '42%', top: '55%',
              width: 14, height: 14, borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'transparent',
              border: '1.5px solid var(--accent)',
              boxShadow: '0 0 10px color-mix(in oklch, var(--accent) 70%, transparent)',
            }} />
          )}
        </div>
      </div>

      {/* 헤더 */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-soft)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
          {zone.name}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-mute)',
          marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap',
        }}>
          <span>Lv.{zone.levelRange[0]}~{zone.levelRange[1]}</span>
          <span>· {zone.zoneType === 'dungeon' ? '던전' : '필드'}</span>
          <span>· 명중 <span style={{
            color: avgHit >= 0.7 ? 'var(--success)' : avgHit >= 0.4 ? 'var(--warning)' : 'var(--danger)',
            fontWeight: 600,
          }}>{Math.round(avgHit * 100)}%</span></span>
        </div>
      </div>

      {/* 예상 보상 */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-soft)' }}>
        <h5 style={{
          margin: '0 0 8px', fontFamily: 'var(--font-mono)', fontSize: 9.5,
          color: 'var(--text-mute)', textTransform: 'uppercase' as const,
          letterSpacing: '0.12em', fontWeight: 600,
        }}>예상 보상 (시간당)</h5>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
          <DetailRow label="골드" value={`${fmtFull(rewards.goldHr)} G`} color="var(--accent)" />
          <DetailRow label="경험치" value={fmtFull(rewards.expHr)} color="var(--info)" />
          <DetailRow label="몬스터" value={`${zone.monsters.length}종`} />
          <DetailRow label="명중률" value={`${Math.round(avgHit * 100)}%`}
            color={avgHit >= 0.7 ? 'var(--success)' : avgHit >= 0.4 ? 'var(--warning)' : 'var(--danger)'} />
        </div>
      </div>

      {/* 몬스터 목록 */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-soft)' }}>
        <h5 style={{
          margin: '0 0 8px', fontFamily: 'var(--font-mono)', fontSize: 9.5,
          color: 'var(--text-mute)', textTransform: 'uppercase' as const,
          letterSpacing: '0.12em', fontWeight: 600,
        }}>몬스터 ({zone.monsters.length})</h5>
        {zone.monsters.map((m, mi) => (
          <div key={m.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 0',
            borderBottom: '1px dashed var(--border-soft)',
            fontSize: 12,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: monsterIndexToColor(mi),
            }} />
            <span style={{
              flex: 1, minWidth: 0, color: 'var(--text)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {m.name}
              {m.aggressive && (
                <span style={{ fontSize: 9, color: 'var(--danger)', marginLeft: 4, fontWeight: 700 }}>선공</span>
              )}
              {m.attackType === 'magic' && (
                <span style={{ fontSize: 9, color: 'var(--info)', marginLeft: 4 }}>마법</span>
              )}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-mute)' }}>
              Lv.{m.level}
            </span>
          </div>
        ))}
        {zone.monsters.length > 0 && (
          <div style={{
            borderBottom: 'none',
          }} />
        )}
      </div>

      {/* 드롭 아이템 */}
      {allDrops.length > 0 && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-soft)' }}>
          <h5 style={{
            margin: '0 0 8px', fontFamily: 'var(--font-mono)', fontSize: 9.5,
            color: 'var(--text-mute)', textTransform: 'uppercase' as const,
            letterSpacing: '0.12em', fontWeight: 600,
          }}>드랍 아이템</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {allDrops.map((d, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)', fontSize: 11,
              }}>
                <span style={{ color: rateToColor(d.rate) }}>{d.name}</span>
                <span style={{ color: 'var(--text)' }}>
                  {d.rate >= 0.01 ? `${Math.round(d.rate * 100)}%` : `${(d.rate * 100).toFixed(1)}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 푸터 — 이동 버튼 */}
      <div style={{
        padding: '12px 14px',
        borderTop: '1px solid var(--border-soft)',
        display: 'flex', flexDirection: 'column', gap: 6,
        background: 'color-mix(in oklch, var(--accent) 3%, transparent)',
      }}>
        <button
          onClick={() => { if (!isHere && !isLocked) onGo(zone); }}
          disabled={isLocked}
          style={{
            padding: 11, borderRadius: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontWeight: 700, fontSize: 13,
            transition: 'all 0.1s',
            ...(isHere ? {
              background: 'color-mix(in oklch, var(--accent) 10%, transparent)',
              border: '1px solid color-mix(in oklch, var(--accent) 45%, transparent)',
              color: 'var(--accent)',
              cursor: 'default',
            } : {
              background: 'var(--success)',
              border: '1px solid var(--success)',
              color: '#082a14',
              cursor: isLocked ? 'not-allowed' : 'pointer',
            }),
          }}
        >
          {isHere ? (
            <>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="2" fill="currentColor" />
              </svg>
              현재 사냥중
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 8h10M8 3l5 5-5 5" />
              </svg>
              이 사냥터로 이동
            </>
          )}
        </button>

        {needsScroll && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: 7, borderRadius: 4,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)',
            fontSize: 11, color: 'var(--text-mute)',
          }}>
            <span>📜</span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 700,
              color: (zone.floor && zone.floor > 1)
                ? 'var(--accent)' : 'var(--text-mute)',
            }}>이동주문서 필요</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Detail panel 보상 행 ── */
function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      fontFamily: 'var(--font-mono)', fontSize: 11.5,
    }}>
      <span style={{ color: 'var(--text-mute)' }}>{label}</span>
      <span style={{ color: color ?? 'var(--text)', fontWeight: color ? 600 : 400 }}>{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MobileZoneCard — 모바일 전용 존 카드 (디자인 핸드오프)
   ═══════════════════════════════════════════ */
function MobileZoneCard({ zone, onGo, isHere, playerLevel, materials }: {
  zone: HuntZone;
  onGo: (zone: HuntZone) => void;
  isHere: boolean;
  playerLevel: number;
  materials: Record<string, number>;
}) {
  const dots = useMemo(() => generateDots(zone), [zone]);
  const rewards = useMemo(() => estimateRewards(zone.monsters), [zone.monsters]);
  const isLocked = playerLevel < zone.requiredLevel;
  const rec = isRecommended(zone, playerLevel);
  const matchLv = playerLevel >= zone.levelRange[0] && playerLevel <= zone.levelRange[1] + 5;
  const isHard = zone.levelRange[0] > playerLevel + 5;

  const needsScroll = zone.zoneType === 'dungeon' && zone.floor != null && zone.floor > 1;
  const scrollId = needsScroll ? `scroll_${zone.id}` : '';
  const scrollCount = needsScroll ? (materials[scrollId] ?? 0) : 0;

  const borderColor = isHere
    ? 'oklch(0.74 0.17 55 / 0.6)'
    : rec ? 'oklch(0.74 0.17 55 / 0.4)' : 'var(--border-soft)';

  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: `1px solid ${borderColor}`,
      borderRadius: 10,
      overflow: 'hidden',
      position: 'relative',
      opacity: isLocked ? 0.55 : 1,
      boxShadow: isHere ? '0 0 0 1px oklch(0.74 0.17 55 / 0.2)' : 'none',
    }}>
      {/* 사냥중 플래그 */}
      {isHere && (
        <span style={{
          position: 'absolute', top: 8, right: 10, zIndex: 2,
          padding: '2px 8px',
          background: 'var(--accent)', color: '#000',
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
          borderRadius: 100,
        }}>사냥중</span>
      )}

      {/* 미니맵 */}
      <div style={{
        height: 80,
        background: 'radial-gradient(ellipse 60% 50% at 50% 50%, oklch(0.18 0.018 60 / 0.4), transparent), var(--bg-sunken)',
        borderBottom: '1px solid var(--border-soft)',
        position: 'relative', overflow: 'hidden',
      }}>
        {zone.floor != null && (
          <span style={{
            position: 'absolute', top: 4, left: 6,
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: 'var(--accent)',
          }}>{zone.floor}F</span>
        )}
        <span style={{
          position: 'absolute', bottom: 4, right: 6,
          fontFamily: 'var(--font-mono)', fontSize: 8.5,
          color: 'var(--text-faint)',
        }}>8M</span>

        <div style={{ position: 'relative', width: '88%', height: 56, margin: '12px auto 0' }}>
          {dots.map((d, i) => (
            <span key={i} style={{
              position: 'absolute',
              left: `${d.x}%`, top: `${d.y}%`,
              width: 6, height: 6, borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              background: monsterIndexToColor(d.monsterIdx),
              boxShadow: `0 0 4px ${monsterIndexToColor(d.monsterIdx)}80`,
            }} />
          ))}
          {isHere && (
            <span style={{
              position: 'absolute', left: '50%', top: '65%',
              width: 10, height: 10, borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'transparent',
              border: '1.5px solid var(--accent)',
              boxShadow: '0 0 8px oklch(0.74 0.17 55 / 0.6)',
            }} />
          )}
        </div>
      </div>

      {/* 본문 */}
      <div style={{ padding: '10px 12px' }}>
        {/* 이름 + 레벨 */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8,
          marginBottom: 6,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            {zone.name}
          </span>
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-mono)', fontSize: 10.5,
            color: matchLv ? 'var(--success)' : isHard ? 'var(--danger)' : 'var(--text-mute)',
          }}>Lv.{zone.levelRange[0]}~{zone.levelRange[1]}</span>
        </div>

        {/* 태그 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {rec && (
            <span style={{
              fontSize: 9.5, padding: '1px 6px', borderRadius: 3,
              color: 'var(--accent)',
              border: '1px solid oklch(0.74 0.17 55 / 0.4)',
              background: 'oklch(0.74 0.17 55 / 0.06)',
            }}>★ 추천</span>
          )}
          {zone.zoneType === 'dungeon' && (
            <span style={{
              fontSize: 9.5, padding: '1px 6px', borderRadius: 3,
              color: 'oklch(0.68 0.20 305)',
              border: '1px solid oklch(0.68 0.20 305 / 0.3)',
              background: 'var(--bg-deep)',
            }}>던전</span>
          )}
          {zone.monsters.some(m => m.aggressive) && (
            <span style={{
              fontSize: 9.5, padding: '1px 6px', borderRadius: 3,
              color: 'var(--danger)',
              border: '1px solid oklch(0.66 0.21 25 / 0.3)',
              background: 'var(--bg-deep)',
            }}>선공</span>
          )}
          {zone.monsters.some(m => m.attackType === 'magic') && (
            <span style={{
              fontSize: 9.5, padding: '1px 6px', borderRadius: 3,
              color: 'var(--info)',
              border: '1px solid var(--border-soft)',
              background: 'var(--bg-deep)',
            }}>마법</span>
          )}
          {needsScroll && (
            <span style={{
              fontSize: 9.5, padding: '1px 6px', borderRadius: 3,
              fontFamily: 'var(--font-mono)',
              color: scrollCount > 0 ? 'var(--accent)' : 'var(--text-mute)',
              border: `1px solid ${scrollCount > 0 ? 'oklch(0.74 0.17 55 / 0.4)' : 'var(--border-soft)'}`,
              background: 'var(--bg-deep)',
            }}>📜{scrollCount}</span>
          )}
        </div>

        {/* 통계 */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 4, paddingTop: 8, marginBottom: 10,
          borderTop: '1px dashed var(--border-soft)',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)' }}>
            <span style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>G/시</span>
            <span style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 600 }}>{fmtNum(rewards.goldHr)}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)' }}>
            <span style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>XP/시</span>
            <span style={{ fontSize: 11.5, color: 'var(--info)', fontWeight: 600 }}>{fmtNum(rewards.expHr)}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)' }}>
            <span style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>몬스터</span>
            <span style={{ fontSize: 11.5, color: 'var(--text)', fontWeight: 600 }}>{zone.monsters.length}종</span>
          </div>
        </div>

        {/* 이동 버튼 */}
        <button
          onClick={(e) => { e.stopPropagation(); if (!isLocked && !isHere) onGo(zone); }}
          disabled={isLocked}
          style={{
            width: '100%', padding: 10, borderRadius: 6,
            fontSize: 12.5, fontWeight: 700,
            border: 'none', cursor: isLocked || isHere ? 'default' : 'pointer',
            ...(isHere ? {
              background: 'oklch(0.74 0.17 55 / 0.15)',
              border: '1px solid oklch(0.74 0.17 55 / 0.4)',
              color: 'var(--accent)',
            } : isLocked ? {
              background: 'var(--bg-deep)',
              border: '1px solid var(--border-soft)',
              color: 'var(--text-faint)',
            } : {
              background: 'linear-gradient(135deg, var(--success), oklch(0.66 0.16 135))',
              color: '#fff',
            }),
          }}
        >
          {isHere ? '현재 위치'
            : isLocked ? `★ Lv.${zone.requiredLevel} 필요`
            : needsScroll ? `이동 (주문서 ${scrollCount > 0 ? scrollCount : 0})`
            : '이동'}
        </button>
      </div>

      {/* 잠금 오버레이 */}
      {isLocked && !isHere && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'grid', placeItems: 'center',
          background: 'rgba(6,8,11,0.55)',
          color: 'var(--text-faint)',
          fontFamily: 'var(--font-mono)', fontSize: 11,
          backdropFilter: 'blur(1px)',
          zIndex: 3,
        }}>★ Lv.{zone.requiredLevel} 필요</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   메인 컴포넌트
   ═══════════════════════════════════════════ */
export default function ZoneSelectPanel() {
  const level = useGameStore(s => s.level);
  const hunt = useGameStore(s => s.hunt);
  const weapon = useGameStore(s => s.equippedWeapon);
  const startHunt = useGameStore(s => s.startHunt);
  const setViewMode = useGameStore(s => s.setViewMode);
  const materials = useGameStore(s => s.materials);
  const setMaterials = useGameStore(s => s.setMaterials);
  const getStr = useGameStore(s => s.getStr);

  const str = getStr();
  const weaponEnchant = weapon?.enhanceLevel ?? 0;
  const playerHit = meleeHit(level, weaponEnchant, str);

  const huntZoneId = hunt.zoneId;
  const currentZone = HUNT_ZONES.find(z => z.id === huntZoneId) ?? null;

  const compact = useCompact();
  const [pageView, setPageView] = useState<PageView>('cards');
  const [region, setRegion] = useState<RegionId>('all');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(huntZoneId);
  const [recOnly, setRecOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('lvAsc');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedZone = useMemo(() => HUNT_ZONES.find(z => z.id === selectedId) ?? null, [selectedId]);

  /* 필터 + 정렬 */
  const rows = useMemo(() => {
    let r = HUNT_ZONES.slice();
    if (region !== 'all') r = r.filter(z => matchRegion(z, region));
    if (q) r = r.filter(z => matchSearch(z, q));
    if (recOnly) r = r.filter(z => isRecommended(z, level));

    r.sort((a, b) => {
      switch (sortKey) {
        case 'lvAsc': return a.requiredLevel - b.requiredLevel;
        case 'lvDesc': return b.requiredLevel - a.requiredLevel;
        case 'gold': {
          const ag = estimateRewards(a.monsters).goldHr;
          const bg = estimateRewards(b.monsters).goldHr;
          return bg - ag;
        }
        case 'rec': {
          const ar = isRecommended(a, level) ? 0 : 1;
          const br = isRecommended(b, level) ? 0 : 1;
          return ar - br || a.requiredLevel - b.requiredLevel;
        }
        default: return 0;
      }
    });
    return r;
  }, [region, q, sortKey, recOnly, level]);

  /* 이동 처리 */
  const handleGo = useCallback((zone: HuntZone) => {
    // 던전 2층 이상 → 주문서 소모
    if (zone.zoneType === 'dungeon' && zone.floor && zone.floor > 1) {
      const scrollId = `scroll_${zone.id}`;
      const scrollCount = materials[scrollId] ?? 0;
      if (scrollCount < 1) return;
      setMaterials({ ...materials, [scrollId]: scrollCount - 1 });
    }
    startHunt(zone.id);
    setToast(`${zone.name}(으)로 이동합니다`);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
    setViewMode('main');
  }, [materials, setMaterials, startHunt, setViewMode]);

  /* 월드맵 뷰 */
  if (pageView === 'worldmap') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
            사냥터
          </span>
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            <ViewToggleBtn label="카드" active={false} onClick={() => setPageView('cards')} />
            <ViewToggleBtn label="월드맵" active onClick={() => {}} />
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <WorldMapPanel />
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     모바일 카드 뷰 (디자인 핸드오프 기반)
     ═══════════════════════════════════════════ */
  if (compact) {
    const regionCounts = useMemo(() => {
      const counts: Record<RegionId, number> = { all: HUNT_ZONES.length, beginner: 0, intermediate: 0, advanced: 0, dungeon: 0 };
      for (const z of HUNT_ZONES) {
        if (z.zoneType === 'dungeon') counts.dungeon++;
        else if (z.tier === 'beginner') counts.beginner++;
        else if (z.tier === 'intermediate') counts.intermediate++;
        else if (z.tier === 'advanced') counts.advanced++;
      }
      return counts;
    }, []);

    const huntDuration = hunt.startedAt && hunt.status !== 'idle'
      ? Math.floor((Date.now() - hunt.startedAt) / 60000)
      : 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 16 }}>
        {/* ── 타이틀 ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>사냥터</span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-mute)',
          }}>{rows.length}개</span>
        </div>

        {/* ── 현재 위치 카드 (here-card) ── */}
        {currentZone && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 12px',
            background: 'oklch(0.74 0.17 55 / 0.08)',
            border: '1px solid oklch(0.74 0.17 55 / 0.3)',
            borderRadius: 8,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: 'var(--success)',
              boxShadow: '0 0 6px var(--success)',
              animation: 'zspPulse 1.4s ease-in-out infinite',
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--text-mute)',
                textTransform: 'uppercase' as const, letterSpacing: '0.08em',
              }}>현재 위치</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                {currentZone.name}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>
                {huntDuration > 0 ? `${huntDuration}분 사냥중` : '대기중'}
                {hunt.avgKillTime > 0 && ` · ${(hunt.avgKillTime / 1000).toFixed(1)}s 평균`}
                {hunt.kills > 0 && ` · KILLS ${hunt.kills}`}
              </div>
            </div>
          </div>
        )}

        {/* ── 칩 필터 ── */}
        <div style={{
          display: 'flex', gap: 6,
          overflowX: 'auto', scrollbarWidth: 'none',
          paddingBottom: 2,
        }}>
          {REGIONS.map(r => {
            const active = region === r.id;
            const cnt = regionCounts[r.id];
            return (
              <button
                key={r.id}
                onClick={() => setRegion(r.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 100,
                  fontSize: 12, fontWeight: active ? 600 : 400,
                  color: active ? 'var(--accent)' : 'var(--text-mute)',
                  background: active
                    ? 'color-mix(in oklch, var(--accent) 12%, transparent)'
                    : 'var(--bg-panel)',
                  border: active
                    ? '1px solid color-mix(in oklch, var(--accent) 40%, transparent)'
                    : '1px solid var(--border-soft)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  transition: 'all 0.12s',
                }}
              >
                {r.name}
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: active ? 'var(--accent)' : 'var(--text-faint)',
                }}>{cnt}</span>
              </button>
            );
          })}
        </div>

        {/* ── 존 리스트 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(z => (
            <MobileZoneCard
              key={z.id}
              zone={z}
              onGo={handleGo}
              isHere={huntZoneId === z.id}
              playerLevel={level}
              materials={materials}
            />
          ))}
          {rows.length === 0 && (
            <div style={{
              padding: 40, textAlign: 'center',
              color: 'var(--text-faint)', fontSize: 13,
            }}>
              조건에 맞는 사냥터가 없습니다.
            </div>
          )}
        </div>

        <style>{`
          @keyframes zspPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.35; }
          }
          @keyframes zspFadeIn {
            from { opacity: 0; transform: translateX(-50%) translateY(8px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
        `}</style>

        {/* ── 토스트 ── */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px',
            background: 'var(--bg-panel)',
            border: '1px solid color-mix(in oklch, var(--success) 40%, transparent)',
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            fontSize: 13, color: 'var(--success)', fontWeight: 600,
            zIndex: 9999,
            animation: 'zspFadeIn 0.2s ease-out',
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 8l3 3 7-7" />
            </svg>
            {toast}
          </div>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     데스크톱 카드 뷰 (기존 유지)
     ═══════════════════════════════════════════ */
  return (
    <div style={{
      padding: '18px 22px 32px',
      display: 'flex', flexDirection: 'column',
      minHeight: '100%',
      overflow: 'auto',
    }}>
      {/* ── 브레드크럼 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        marginBottom: 14, paddingBottom: 12,
        borderBottom: '1px solid var(--border-soft)',
        flexWrap: 'wrap',
      }}>
        <span style={{
          fontSize: 17, fontWeight: 600, color: 'var(--text)',
          fontFamily: 'var(--font-display)',
          display: 'inline-flex', alignItems: 'baseline', gap: 8,
        }}>
          사냥터
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)',
            padding: '2px 8px', borderRadius: 100, background: 'var(--bg-elevated)',
          }}>{rows.length}개</span>
        </span>

        {currentZone && (
          <span style={{
            marginLeft: 'auto',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 12px',
            border: '1px solid color-mix(in oklch, var(--accent) 35%, transparent)',
            background: 'color-mix(in oklch, var(--accent) 6%, transparent)',
            borderRadius: 6,
            color: 'var(--accent)', fontSize: 11.5,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--success)',
              boxShadow: '0 0 6px var(--success)',
              animation: 'zspPulse 1.6s ease-in-out infinite',
            }} />
            현재 위치{' '}
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{currentZone.name}</span>
            {hunt.avgKillTime > 0 && (
              <span style={{ color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                {(hunt.avgKillTime / 1000).toFixed(1)}s 평균
              </span>
            )}
          </span>
        )}

        <div style={{ display: 'flex', gap: 4 }}>
          <ViewToggleBtn label="카드" active onClick={() => {}} />
          <ViewToggleBtn label="월드맵" active={false} onClick={() => setPageView('worldmap')} />
        </div>
      </div>

      {/* ── 지역 탭 ── */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 14,
        borderBottom: '1px solid var(--border-soft)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        {REGIONS.map(r => (
          <button
            key={r.id}
            onClick={() => setRegion(r.id)}
            style={{
              padding: '9px 16px',
              color: region === r.id ? 'var(--accent)' : 'var(--text-mute)',
              fontSize: 12.5, fontWeight: 500,
              fontFamily: 'var(--font-ui)',
              borderBottom: region === r.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
              transition: 'color 0.12s, border-color 0.12s',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', borderBottomStyle: 'solid',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            {r.name}
            {r.lv && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: region === r.id ? 'color-mix(in oklch, var(--accent) 70%, transparent)' : 'var(--text-faint)',
              }}>{r.lv}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── 툴바 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {/* 검색 */}
        <div style={{
          flex: 1, minWidth: 140,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px',
          background: 'var(--bg-panel)', border: '1px solid var(--border-soft)', borderRadius: 6,
        }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--text-faint)" strokeWidth="1.6">
            <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" />
          </svg>
          <input
            placeholder="지역/몬스터 검색"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{
              flex: 1, fontSize: 12.5,
              color: 'var(--text)', fontFamily: 'var(--font-ui)',
              background: 'transparent', border: 'none', outline: 'none',
            }}
          />
        </div>

        {/* 추천 필터 */}
        <button
          onClick={() => setRecOnly(v => !v)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 11px',
            background: recOnly ? 'color-mix(in oklch, var(--accent) 5%, transparent)' : 'var(--bg-panel)',
            border: recOnly
              ? '1px solid color-mix(in oklch, var(--accent) 40%, transparent)'
              : '1px solid var(--border-soft)',
            borderRadius: 6,
            fontSize: 11.5,
            color: recOnly ? 'var(--accent)' : 'var(--text-mute)',
            cursor: 'pointer',
            transition: 'all 0.12s',
          }}
        >
          내 레벨 추천만
        </button>

        {/* 정렬 */}
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          style={{
            padding: '7px 28px 7px 11px',
            background: 'var(--bg-panel)', border: '1px solid var(--border-soft)', borderRadius: 6,
            fontSize: 11.5, color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%237c8696' d='M1.5 3.5L5 7l3.5-3.5z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
          }}
        >
          <option value="lvAsc">레벨 ↑</option>
          <option value="lvDesc">레벨 ↓</option>
          <option value="gold">골드/시 ↓</option>
          <option value="rec">추천 우선</option>
        </select>
      </div>

      {/* ── 메인 바디: 카드 그리드 + 디테일 ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 340px',
        gap: 14,
        alignItems: 'start',
      }}>
        {/* 카드 그리드 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 10,
        }}>
          {rows.map(z => (
            <ZoneCard
              key={z.id}
              zone={z}
              selected={selectedId === z.id}
              onSelect={setSelectedId}
              onGo={handleGo}
              isHere={huntZoneId === z.id}
              playerLevel={level}
              playerHit={playerHit}
              materials={materials}
            />
          ))}
          {rows.length === 0 && (
            <div style={{
              padding: 60, textAlign: 'center',
              color: 'var(--text-faint)', gridColumn: '1 / -1',
              fontSize: 13,
            }}>
              조건에 맞는 사냥터가 없습니다.
            </div>
          )}
        </div>

        {/* 디테일 사이드바 */}
        <ZoneDetail
          zone={selectedZone}
          onGo={handleGo}
          isHere={huntZoneId === selectedZone?.id}
          playerLevel={level}
          playerHit={playerHit}
        />
      </div>

      {/* ── 토스트 ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 20px',
          background: 'var(--bg-panel)',
          border: '1px solid color-mix(in oklch, var(--success) 40%, transparent)',
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          fontSize: 13, color: 'var(--success)', fontWeight: 600,
          zIndex: 9999,
          animation: 'zspFadeIn 0.2s ease-out',
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 8l3 3 7-7" />
          </svg>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes zspPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes zspFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ── 뷰 토글 버튼 ── */
function ViewToggleBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 5,
        fontSize: 11, fontWeight: active ? 600 : 400,
        fontFamily: 'var(--font-mono)',
        background: active ? 'var(--bg-elevated)' : 'transparent',
        border: active ? '1px solid var(--border-soft)' : '1px solid transparent',
        color: active ? 'var(--accent)' : 'var(--text-mute)',
        cursor: active ? 'default' : 'pointer',
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  );
}
