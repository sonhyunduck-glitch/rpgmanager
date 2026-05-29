/* =========================================================
   MINIMAP — 공간 기반 전투 시각화 (v2.39.24)

   SpatialState(store) → 직접 렌더링:
   - 엔티티(몬스터/플레이어) 좌표를 % 로 변환 후 렌더
   - CombatEvent 소비 → 시각 이펙트 (데미지, 킬, MISS 등)
   - 투사체(SpatialProjectile) 직접 렌더
   - 로그 파싱 없음 (순수 뷰 레이어)
   ========================================================= */
import { useEffect, useRef, useState, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { HUNT_ZONES, getMonstersForRoom, getPlayerDotColor, getTransformScrollLevel } from '../../data/gameData';
import { getClassCombatStyle } from '../../data/classData';
import { LABEL } from '../../styles/shared';
import type { ActiveBuff, CombatStyle } from '../../types';
import type { SpatialEntity, Vec2 } from '../../types/spatial';
import { monsterIndexToColor } from '../../utils/monsterColors';

/* ── 상수 ── */
const BASE_VISIBLE_MONSTERS = 10;
const MIN_VISIBLE_MONSTERS = 1;
const MAP_SIZE_M = 50;

/** 폴백: 이름 해시 → 색상 (팔레트 매핑 실패 시) */
function monsterNameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  const hue = ((hash >>> 0) * 137.508) % 360;
  return `hsl(${Math.round(hue)}, 70%, 60%)`;
}

/* ── 타입 (순수 시각 이펙트용) ── */
type MapEvent = {
  type: 'kill' | 'crit' | 'miss' | 'damage' | 'hit_taken';
  pos: { x: number; y: number };
  id: string;
  color?: string;
  dmgText?: string;
} | null;

/** 좌표: m → % 변환 */
function toPercent(pos: Vec2): { x: number; y: number } {
  return {
    x: (pos.x / MAP_SIZE_M) * 100,
    y: (pos.y / MAP_SIZE_M) * 100,
  };
}

/* ── 컴포넌트 ── */
export default function Minimap() {
  const hunt = useGameStore(s => s.hunt);
  const level = useGameStore(s => s.level);
  const currentHp = useGameStore(s => s.currentHp);
  const consumeCombatEvents = useGameStore(s => s.consumeCombatEvents);
  const resumeHunt = useGameStore(s => s.resumeHunt);
  const revive = useGameStore(s => s.revive);
  const zonePlayerCount = useGameStore(s => s.zonePlayerCount);
  const zonePlayers = useGameStore(s => s.zonePlayers);
  const authUserId = useGameStore(s => s.authUserId);
  const myGuildId = useGameStore(s => s.guildId);
  const playerClass = useGameStore(s => s.playerClass);
  const combatStyle: CombatStyle = getClassCombatStyle(playerClass);

  // 같은 존 길드원 수 (본인 제외)
  const guildMatesInZone = myGuildId
    ? zonePlayers.filter(p => p.userId !== authUserId && p.guildId === myGuildId).length
    : 0;
  const strangersInZone = Math.max(0, zonePlayerCount - 1 - guildMatesInZone);
  const VISIBLE_MONSTERS = Math.max(
    MIN_VISIBLE_MONSTERS,
    BASE_VISIBLE_MONSTERS - strangersInZone,
  );

  const activeBuffs = useGameStore(s => s.activeBuffs);
  const transformScrollType = useGameStore(s => s.transformScrollType);

  const playerDotColorRaw = getPlayerDotColor(level);
  const isPlatinum = playerDotColorRaw === 'platinum';
  const playerDotColor = isPlatinum ? '#e0e0e0' : playerDotColorRaw;

  // 변신주문서 버프 활성 여부
  const now0 = Date.now();
  const tsBuff = activeBuffs.find(
    (b: ActiveBuff) => b.potionId === 'transform_scroll' && b.expiresAt > now0,
  );
  const tsActive = !!tsBuff;
  const tsIsEvent = tsActive && transformScrollType === 'event';

  const tsLevelForDot = tsIsEvent ? 80 : getTransformScrollLevel(level);
  const tsDotColorRaw = getPlayerDotColor(tsLevelForDot);
  const tsDotIsPlatinum = tsDotColorRaw === 'platinum';
  const tsDotColor = tsIsEvent ? '#F5C518' : (tsDotIsPlatinum ? '#e0e0e0' : tsDotColorRaw);

  const zone = HUNT_ZONES.find(z => z.id === hunt.zoneId);
  const currentRoom = hunt.currentRoom ?? 1;
  const isHunting = hunt.status === 'hunting';

  // 방 기반 필터링된 몬스터
  const tierMonsters = useMemo(
    () => zone ? getMonstersForRoom(zone, currentRoom) : [],
    [zone, currentRoom],
  );

  /* ── 공간 상태 (store 직접) ── */
  const spatial = hunt.spatial;
  const playerEntity = spatial.entities.get('player');
  const playerPos = playerEntity ? toPercent(playerEntity.pos) : { x: 50, y: 50 };

  // 몬스터 엔티티 목록 (렌더링용)
  const monsterEntities = useMemo(() => {
    const arr: SpatialEntity[] = [];
    spatial.entities.forEach(e => {
      if (e.type === 'monster') arr.push(e);
    });
    return arr;
  }, [spatial.entities]);

  /* ── 몬스터별 색상 맵 (인덱스 기반 팔레트) ── */
  const monsterColorMap = useMemo(() => {
    const map = new Map<number, string>();
    tierMonsters.forEach((_m, i) => {
      map.set(i, monsterIndexToColor(i));
    });
    return map;
  }, [tierMonsters]);

  /* ── 시각 이펙트 상태 (로컬 — 순수 시각, setTimeout 기반) ── */
  const [event, setEvent] = useState<MapEvent>(null);
  const [meleeImpact, setMeleeImpact] = useState<{
    id: string; pos: { x: number; y: number }; isCrit: boolean;
  } | null>(null);
  const [monsterMeleeImpact, setMonsterMeleeImpact] = useState<{
    id: string;
    targetPos: { x: number; y: number };   // 플레이어 위치
    sourcePos: { x: number; y: number };   // 몬스터 위치 (공격 방향)
    damage: number;
  } | null>(null);
  const [skillEffect, setSkillEffect] = useState<{
    id: string; pos: { x: number; y: number }; type: 'summon' | 'poly' | 'physical';
  } | null>(null);
  const [aoeBlast, setAoeBlast] = useState<{
    id: string; pos: { x: number; y: number }; radiusPct: number; color: string;
  } | null>(null);
  const [showPlayerList, setShowPlayerList] = useState(false);

  // 접속자 1명이면 팝업 자동 닫기
  useEffect(() => {
    if (zonePlayerCount <= 1) setShowPlayerList(false);
  }, [zonePlayerCount]);

  const mapRef = useRef<HTMLDivElement>(null);

  /* ── CombatEvent 소비 → 시각 이펙트 트리거 ── */
  const prevEventsRef = useRef(0);
  useEffect(() => {
    const events = spatial.combatEvents;
    if (events.length === 0) return;

    // 중복 방지: 이미 처리한 이벤트 스킵
    if (events.length === prevEventsRef.current) return;
    const newEvents = events.slice(prevEventsRef.current);
    prevEventsRef.current = events.length;

    for (const ev of newEvents) {
      const pos = toPercent(ev.pos);

      switch (ev.type) {
        case 'kill': {
          const color = ev.monsterName ? monsterNameToColor(ev.monsterName) : '#ef5350';
          setEvent({
            type: ev.isCrit ? 'crit' : 'kill',
            pos, id: ev.id, color,
            dmgText: ev.damage?.toString(),
          });
          setTimeout(() => setEvent(null), 900);
          // 근접: 킬 임팩트
          if (combatStyle === 'melee') {
            setMeleeImpact({ id: ev.id + '_imp', pos, isCrit: ev.isCrit ?? false });
            setTimeout(() => setMeleeImpact(null), 400);
          }
          break;
        }
        case 'melee_hit': {
          setMeleeImpact({ id: ev.id + '_imp', pos, isCrit: ev.isCrit ?? false });
          setTimeout(() => setMeleeImpact(null), 400);
          if (ev.damage) {
            setEvent({
              type: ev.isCrit ? 'crit' : 'damage',
              pos, id: ev.id,
              dmgText: ev.damage.toString(),
            });
            setTimeout(() => setEvent(null), 900);
          }
          break;
        }
        case 'melee_miss': {
          setEvent({ type: 'miss', pos, id: ev.id });
          setTimeout(() => setEvent(null), 900);
          break;
        }
        case 'projectile_hit': {
          if (ev.damage) {
            setEvent({
              type: ev.isCrit ? 'crit' : 'damage',
              pos, id: ev.id,
              dmgText: ev.damage.toString(),
            });
            setTimeout(() => setEvent(null), 900);
          }
          break;
        }
        case 'projectile_miss': {
          setEvent({ type: 'miss', pos, id: ev.id });
          setTimeout(() => setEvent(null), 900);
          break;
        }
        case 'monster_hit': {
          setEvent({
            type: 'hit_taken', pos: playerPos, id: ev.id,
            dmgText: ev.damage?.toString(),
          });
          setTimeout(() => setEvent(null), 900);
          // 근접 공격 모션: 몬스터 → 플레이어 방향 슬래시
          if (ev.sourcePos) {
            const srcPct = toPercent(ev.sourcePos);
            setMonsterMeleeImpact({
              id: ev.id + '_matk',
              targetPos: playerPos,
              sourcePos: srcPct,
              damage: ev.damage ?? 0,
            });
            setTimeout(() => setMonsterMeleeImpact(null), 500);
          }
          break;
        }
        case 'monster_magic_hit': {
          setEvent({
            type: 'hit_taken', pos: playerPos, id: ev.id,
            dmgText: ev.damage?.toString(),
          });
          setTimeout(() => setEvent(null), 900);
          break;
        }
        case 'dodge': {
          setEvent({ type: 'miss', pos: playerPos, id: ev.id, dmgText: 'DODGE' });
          setTimeout(() => setEvent(null), 900);
          break;
        }
        case 'summon': {
          setSkillEffect({ id: ev.id, pos, type: 'summon' });
          setTimeout(() => setSkillEffect(null), 600);
          break;
        }
        case 'heal': {
          setSkillEffect({ id: ev.id, pos, type: 'poly' });
          setTimeout(() => setSkillEffect(null), 600);
          break;
        }
        case 'monster_skill': {
          setSkillEffect({ id: ev.id, pos, type: 'physical' });
          setTimeout(() => setSkillEffect(null), 600);
          break;
        }
        case 'aoe_blast': {
          const radiusPct = ((ev.aoeRadius ?? 10) / MAP_SIZE_M) * 100;
          setAoeBlast({ id: ev.id, pos, radiusPct, color: ev.color ?? '#7c4dff' });
          setTimeout(() => setAoeBlast(null), 800);
          break;
        }
        default:
          break;
      }
    }

    // 이벤트 소비 (다음 틱에서 비워짐)
    consumeCombatEvents();
    prevEventsRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spatial.combatEvents, spatial.combatEvents.length]);

  /* ── 투사체 렌더 데이터 (공간 좌표 → %) ── */
  const projectiles = useMemo(() => {
    return spatial.projectiles.map(p => ({
      id: p.id,
      type: p.type,
      from: toPercent(p.from),
      pos: toPercent(p.pos),
      to: toPercent(p.to),
    }));
  }, [spatial.projectiles]);

  /* ── 이동 경로선 데이터 ── */
  const moveLineData = useMemo(() => {
    if (!playerEntity) return null;
    const order = spatial.moveOrders.get('player');
    if (!order) return null;
    return {
      from: toPercent(playerEntity.pos),
      to: toPercent(order.destination),
    };
  }, [playerEntity, spatial.moveOrders]);

  if (!zone) return null;

  return (
    <div
      style={{
        background: 'var(--bg-log, var(--bg-canvas))',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-md)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* ── 맵 영역 ── */}
      <div
        ref={mapRef}
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 1m×1m 그리드 (50m 맵 → 2% 간격) */}
        <div
          style={{
            position: 'absolute', inset: 0,
            backgroundImage:
              'linear-gradient(90deg, color-mix(in oklch, var(--text-mute) 10%, transparent) 1px, transparent 1px),'
              + 'linear-gradient(0deg, color-mix(in oklch, var(--text-mute) 10%, transparent) 1px, transparent 1px)',
            backgroundSize: '2% 2%',
            opacity: 0.35,
          }}
        />

        {/* 몬스터 점 — 공간 엔티티 기반 */}
        {monsterEntities.map(entity => {
          const pos = toPercent(entity.pos);
          const isDead = !entity.alive;
          const isCurrentTarget = entity.id === hunt.targetEntityId && !isDead;
          // 합류 몬스터: joinedMonsters에 포함된 monsterId와 entity.monsterId 매칭
          const isJoined = !isDead && hunt.joinedMonsters.some(
            j => j.monsterId === entity.monsterId,
          );
          const monsterIdx = entity.monsterIdx ?? 0;
          const dotColor = monsterColorMap.get(monsterIdx)
            ?? monsterIndexToColor(monsterIdx);
          const dotMonster = entity.monsterId
            ? tierMonsters.find(m => m.id === entity.monsterId)
            : tierMonsters[monsterIdx];
          const isAggressive = !!dotMonster?.aggressive;
          const isLarge = dotMonster?.size === 'large';

          // 접근 중: moveOrders에 이 엔티티 이동 명령이 있는지
          const isApproaching = !isDead && spatial.moveOrders.has(entity.id)
            && entity.id !== hunt.targetEntityId;

          // 리스폰 직후 200ms 이내: transition 없이 즉시 배치
          const justRespawned = entity.lastRespawnAt && (Date.now() - entity.lastRespawnAt < 200);

          return (
            <div
              key={entity.id}
              style={{
                position: 'absolute',
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
                transition: (isDead || justRespawned) ? 'none' : 'left 80ms linear, top 80ms linear',
                zIndex: isApproaching ? 4 : 2,
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {/* 칼 이모지 — 선공 몬스터 접근 중 */}
              {isApproaching && (
                <span
                  style={{
                    fontSize: 'var(--fs-sm)',
                    lineHeight: 1,
                    marginBottom: -2,
                    animation: 'mmAggroBounce 0.6s ease-in-out infinite',
                    filter: 'drop-shadow(0 0 3px rgba(255,60,60,0.7))',
                  }}
                >
                  {'⚔️'}
                </span>
              )}
              {/* 선공 링 — 닷 뒤에 붉은 외곽 링 (선공 몬스터만) */}
              {isAggressive && !isDead && (
                <div
                  style={{
                    position: 'absolute',
                    width: (isCurrentTarget || isJoined)
                      ? (isLarge ? 'calc(var(--mm-dot-active-lg) + 5px)' : 'calc(var(--mm-dot-active) + 5px)')
                      : (isLarge ? 'calc(var(--mm-dot-lg) + 5px)' : 'calc(var(--mm-dot) + 5px)'),
                    height: (isCurrentTarget || isJoined)
                      ? (isLarge ? 'calc(var(--mm-dot-active-lg) + 5px)' : 'calc(var(--mm-dot-active) + 5px)')
                      : (isLarge ? 'calc(var(--mm-dot-lg) + 5px)' : 'calc(var(--mm-dot) + 5px)'),
                    borderRadius: '50%',
                    border: '1.5px solid rgba(255,70,70,0.5)',
                    animation: 'mmAggroGlow 2s ease-in-out infinite',
                    pointerEvents: 'none',
                  }}
                />
              )}
              {/* 비선공 링 — 은은한 외곽 링 (비선공 몬스터만) */}
              {!isAggressive && !isDead && (
                <div
                  style={{
                    position: 'absolute',
                    width: (isCurrentTarget || isJoined)
                      ? (isLarge ? 'calc(var(--mm-dot-active-lg) + 4px)' : 'calc(var(--mm-dot-active) + 4px)')
                      : (isLarge ? 'calc(var(--mm-dot-lg) + 4px)' : 'calc(var(--mm-dot) + 4px)'),
                    height: (isCurrentTarget || isJoined)
                      ? (isLarge ? 'calc(var(--mm-dot-active-lg) + 4px)' : 'calc(var(--mm-dot-active) + 4px)')
                      : (isLarge ? 'calc(var(--mm-dot-lg) + 4px)' : 'calc(var(--mm-dot) + 4px)'),
                    borderRadius: '50%',
                    border: `1px solid ${dotColor}55`,
                    boxShadow: `0 0 3px ${dotColor}33`,
                    pointerEvents: 'none',
                  }}
                />
              )}
              {/* 닷 — large 몬스터는 큰 닷 */}
              <div
                style={{
                  width: (isCurrentTarget || isJoined)
                    ? (isLarge ? 'var(--mm-dot-active-lg)' : 'var(--mm-dot-active)')
                    : (isLarge ? 'var(--mm-dot-lg)' : 'var(--mm-dot)'),
                  height: (isCurrentTarget || isJoined)
                    ? (isLarge ? 'var(--mm-dot-active-lg)' : 'var(--mm-dot-active)')
                    : (isLarge ? 'var(--mm-dot-lg)' : 'var(--mm-dot)'),
                  borderRadius: '50%',
                  background: dotColor,
                  opacity: isDead ? 0 : ((isCurrentTarget || isJoined) ? 1 : 0.5),
                  transform: `scale(${isDead ? 0 : 1})`,
                  transition: 'opacity 0.3s ease, transform 0.3s ease',
                  boxShadow: isCurrentTarget
                    ? `0 0 8px ${dotColor}`
                    : isJoined
                      ? `0 0 6px ${dotColor}`
                      : `0 0 4px 1px ${dotColor}33`,
                  animation: (isCurrentTarget || isJoined) && isHunting ? 'mmMonsterPulse 1s infinite' : 'none',
                }}
              />
              {/* 몬스터 이름 라벨 */}
              {!isDead && dotMonster && (
                <span
                  style={{
                    marginTop: 1,
                    fontSize: '8px',
                    color: dotColor,
                    whiteSpace: 'nowrap',
                    opacity: (isCurrentTarget || isJoined) ? 0.95 : 0.6,
                    textShadow: '0 0 3px rgba(0,0,0,0.9)',
                    lineHeight: 1,
                    pointerEvents: 'none',
                  }}
                >
                  {dotMonster.name}
                </span>
              )}
            </div>
          );
        })}

        {/* 킬 버스트 이펙트 */}
        {event && (event.type === 'kill' || event.type === 'crit') && (
          <div
            key={`burst-${event.id}`}
            style={{
              position: 'absolute',
              left: `${event.pos.x}%`,
              top: `${event.pos.y}%`,
              width: event.type === 'crit' ? 'calc(var(--mm-dot-active) * 3)' : 'calc(var(--mm-dot-active) * 2.2)',
              height: event.type === 'crit' ? 'calc(var(--mm-dot-active) * 3)' : 'calc(var(--mm-dot-active) * 2.2)',
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle, ${event.color ?? 'var(--accent)'} 0%, transparent 70%)`,
              animation: 'mmBurst 0.6s ease-out forwards',
              zIndex: 3, pointerEvents: 'none',
            }}
          />
        )}

        {/* 킬 데미지 텍스트 */}
        {event?.type === 'kill' && event.dmgText && (
          <div
            key={`killdmg-${event.id}`}
            style={{
              position: 'absolute',
              left: `${event.pos.x}%`,
              top: `${event.pos.y - 6}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: 'var(--fs-base)', fontWeight: 800,
              color: event.color ?? '#ffa726',
              fontFamily: 'var(--font-mono)',
              animation: 'mmFloatUp 0.8s ease-out forwards',
              zIndex: 20, pointerEvents: 'none',
              textShadow: `0 0 6px ${event.color ?? '#ffa726'}`,
            }}
          >
            KILL {event.dmgText}
          </div>
        )}

        {/* 데미지 숫자 (일반 공격) */}
        {event?.type === 'damage' && event.dmgText && (
          <div
            key={`dmg-${event.id}`}
            style={{
              position: 'absolute',
              left: `${event.pos.x}%`,
              top: `${event.pos.y - 6}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: 'var(--fs-sm)', fontWeight: 800,
              color: 'var(--text)',
              fontFamily: 'var(--font-mono)',
              animation: 'mmFloatUp 0.8s ease-out forwards',
              zIndex: 20, pointerEvents: 'none',
              textShadow: '0 0 4px rgba(0,0,0,0.8)',
            }}
          >
            {event.dmgText}
          </div>
        )}

        {/* CRIT 텍스트 + 데미지 */}
        {event?.type === 'crit' && (
          <div
            key={`crit-${event.id}`}
            style={{
              position: 'absolute',
              left: `${event.pos.x}%`,
              top: `${event.pos.y - 6}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: 'var(--fs-base)', fontWeight: 800,
              color: 'var(--danger)',
              fontFamily: 'var(--font-mono)',
              animation: 'mmFloatUp 0.8s ease-out forwards',
              zIndex: 20, pointerEvents: 'none',
              textShadow: '0 0 6px var(--danger)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}
          >
            <span>CRIT!</span>
            {event.dmgText && <span style={{ fontSize: 'var(--fs-sm)' }}>{event.dmgText}</span>}
          </div>
        )}

        {/* MISS 텍스트 */}
        {event?.type === 'miss' && (
          <div
            key={`miss-${event.id}`}
            style={{
              position: 'absolute',
              left: `${event.pos.x}%`,
              top: `${event.pos.y - 6}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: 'var(--fs-sm)', fontWeight: 800,
              color: 'var(--text-mute)',
              fontFamily: 'var(--font-mono)',
              animation: 'mmFloatUp 0.8s ease-out forwards',
              zIndex: 20, pointerEvents: 'none',
            }}
          >
            {event.dmgText ?? 'MISS!'}
          </div>
        )}

        {/* 피격 데미지 (몬스터 → 플레이어) */}
        {event?.type === 'hit_taken' && event.dmgText && (
          <div
            key={`hit-${event.id}`}
            style={{
              position: 'absolute',
              left: `${event.pos.x}%`,
              top: `${event.pos.y - 7}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: 'var(--fs-sm)', fontWeight: 800,
              color: '#ff6b6b',
              fontFamily: 'var(--font-mono)',
              animation: 'mmFloatUp 0.8s ease-out forwards',
              zIndex: 20, pointerEvents: 'none',
              textShadow: '0 0 4px rgba(0,0,0,0.8)',
            }}
          >
            -{event.dmgText}
          </div>
        )}

        {/* 이동 경로선 (점선) */}
        {moveLineData && (
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              zIndex: 5,
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            <line
              x1={`${moveLineData.from.x}%`}
              y1={`${moveLineData.from.y}%`}
              x2={`${moveLineData.to.x}%`}
              y2={`${moveLineData.to.y}%`}
              stroke={playerDotColor}
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity="0.6"
            />
            <circle
              cx={`${moveLineData.to.x}%`}
              cy={`${moveLineData.to.y}%`}
              r="3"
              fill="none"
              stroke={playerDotColor}
              strokeWidth="1"
              opacity="0.5"
            />
          </svg>
        )}

        {/* 투사체 이펙트 — CSS bolt (공간 기반) */}
        {projectiles.map(proj => {
          const dx = proj.to.x - proj.from.x;
          const dy = proj.to.y - proj.from.y;
          const mapW = mapRef.current?.clientWidth ?? 200;
          const mapH = mapRef.current?.clientHeight ?? 200;
          const angle = Math.atan2(dy * mapH, dx * mapW) * (180 / Math.PI);
          const distPx = Math.sqrt((dx * mapW / 100) ** 2 + (dy * mapH / 100) ** 2);
          const color = proj.type === 'arrow' ? '#FFD54F'
            : proj.type === 'magic_bolt' ? '#7C4DFF'
            : proj.type === 'monster_magic' ? '#FF4444'
            : '#FF6B00';
          const dur = proj.type === 'arrow' ? '0.3s' : '0.4s';
          return (
            <div
              key={`proj-${proj.id}`}
              style={{
                position: 'absolute',
                left: `${proj.from.x}%`,
                top: `${proj.from.y}%`,
                transform: `rotate(${angle}deg)`,
                transformOrigin: '0 50%',
                zIndex: 6,
                pointerEvents: 'none' as const,
              }}
            >
              <div className="mm-bolt" style={{
                background: `linear-gradient(90deg, transparent, ${color})`,
                ['--bolt-dist' as string]: `${distPx}px`,
                animationDuration: dur,
              }} />
              <div className="mm-bolt mm-bolt-b2" style={{
                background: `linear-gradient(90deg, transparent, ${color})`,
                ['--bolt-dist' as string]: `${distPx}px`,
                animationDuration: dur,
              }} />
            </div>
          );
        })}

        {/* 근접 타격 임팩트 (기사) */}
        {meleeImpact && (
          <svg
            key={`imp-${meleeImpact.id}`}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              zIndex: 7, pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            {/* 십자 슬래시 */}
            <line
              x1={`${meleeImpact.pos.x - 2.5}%`} y1={`${meleeImpact.pos.y - 2.5}%`}
              x2={`${meleeImpact.pos.x + 2.5}%`} y2={`${meleeImpact.pos.y + 2.5}%`}
              stroke={meleeImpact.isCrit ? '#FFD54F' : '#ffffff'}
              strokeWidth={meleeImpact.isCrit ? 3 : 2}
              strokeLinecap="round"
              opacity="0.9"
            >
              <animate attributeName="opacity" from="0.9" to="0" dur="0.35s" fill="freeze" />
            </line>
            <line
              x1={`${meleeImpact.pos.x + 2.5}%`} y1={`${meleeImpact.pos.y - 2.5}%`}
              x2={`${meleeImpact.pos.x - 2.5}%`} y2={`${meleeImpact.pos.y + 2.5}%`}
              stroke={meleeImpact.isCrit ? '#FFD54F' : '#ffffff'}
              strokeWidth={meleeImpact.isCrit ? 3 : 2}
              strokeLinecap="round"
              opacity="0.9"
            >
              <animate attributeName="opacity" from="0.9" to="0" dur="0.35s" fill="freeze" />
            </line>
            {/* 충격파 링 */}
            <circle
              cx={`${meleeImpact.pos.x}%`} cy={`${meleeImpact.pos.y}%`}
              r="2"
              fill="none"
              stroke={meleeImpact.isCrit ? '#FFD54F' : 'rgba(255,255,255,0.7)'}
              strokeWidth={meleeImpact.isCrit ? 2 : 1.5}
            >
              <animate attributeName="r" from="2" to="12" dur="0.35s" fill="freeze" />
              <animate attributeName="opacity" from="0.8" to="0" dur="0.35s" fill="freeze" />
            </circle>
          </svg>
        )}

        {/* 몬스터 근접 공격 모션 (몬스터→플레이어 방향 슬래시) */}
        {monsterMeleeImpact && (() => {
          const { targetPos: tp, sourcePos: sp } = monsterMeleeImpact;
          // 공격 방향 벡터 계산 (몬스터 → 플레이어)
          const mapW = mapRef.current?.clientWidth ?? 200;
          const mapH = mapRef.current?.clientHeight ?? 200;
          const dx = (tp.x - sp.x) * mapW / 100;
          const dy = (tp.y - sp.y) * mapH / 100;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          // 정규화된 방향 (% 단위)
          const nx = (dx / dist) * 3;  // 3% 길이 슬래시
          const ny = (dy / dist) * 3;
          // 수직 방향 (크로스 슬래시용)
          const px = -ny * 0.6;
          const py = nx * 0.6;

          return (
            <svg
              key={`matk-${monsterMeleeImpact.id}`}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                zIndex: 7, pointerEvents: 'none',
                overflow: 'visible',
              }}
            >
              {/* 공격 방향 슬래시 (\ 형태) */}
              <line
                x1={`${tp.x - nx * 0.8 + px}%`} y1={`${tp.y - ny * 0.8 + py}%`}
                x2={`${tp.x + nx * 0.3 - px}%`} y2={`${tp.y + ny * 0.3 - py}%`}
                stroke="#ff5252" strokeWidth={2.5} strokeLinecap="round" opacity="0.9"
              >
                <animate attributeName="opacity" from="0.9" to="0" dur="0.4s" fill="freeze" />
              </line>
              {/* 반대 슬래시 (/ 형태) */}
              <line
                x1={`${tp.x - nx * 0.8 - px}%`} y1={`${tp.y - ny * 0.8 - py}%`}
                x2={`${tp.x + nx * 0.3 + px}%`} y2={`${tp.y + ny * 0.3 + py}%`}
                stroke="#ff5252" strokeWidth={2.5} strokeLinecap="round" opacity="0.9"
              >
                <animate attributeName="opacity" from="0.9" to="0" dur="0.4s" fill="freeze" />
              </line>
              {/* 피격 충격파 (빨간 링) */}
              <circle
                cx={`${tp.x}%`} cy={`${tp.y}%`} r="3"
                fill="none" stroke="rgba(255,82,82,0.7)" strokeWidth={1.5}
              >
                <animate attributeName="r" from="3" to="10" dur="0.4s" fill="freeze" />
                <animate attributeName="opacity" from="0.7" to="0" dur="0.4s" fill="freeze" />
              </circle>
            </svg>
          );
        })()}

        {/* 몬스터 스킬 이펙트 */}
        {skillEffect && (
          <div
            key={`eff-${skillEffect.id}`}
            style={{
              position: 'absolute',
              left: `${skillEffect.pos.x}%`,
              top: `${skillEffect.pos.y}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: 18,
              zIndex: 7,
              pointerEvents: 'none',
              animation: 'mmSkillPop 0.5s ease-out forwards',
            }}
          >
            {skillEffect.type === 'summon' && '★'}
            {skillEffect.type === 'poly' && '🛡️'}
            {skillEffect.type === 'physical' && '⚡'}
          </div>
        )}

        {/* 광역 마법 범위 원형 이펙트 */}
        {aoeBlast && (
          <div
            key={`aoe-${aoeBlast.id}`}
            style={{
              position: 'absolute',
              left: `${aoeBlast.pos.x}%`,
              top: `${aoeBlast.pos.y}%`,
              width: `${aoeBlast.radiusPct * 2}%`,
              height: `${aoeBlast.radiusPct * 2}%`,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              border: `2px solid ${aoeBlast.color}`,
              background: `radial-gradient(circle, ${aoeBlast.color}33 0%, ${aoeBlast.color}11 60%, transparent 100%)`,
              zIndex: 6,
              pointerEvents: 'none',
              animation: 'mmAoeBlast 0.8s ease-out forwards',
            }}
          />
        )}

        {/* 유저 점 */}
        <div
          style={{
            position: 'absolute',
            left: `${playerPos.x}%`,
            top: `${playerPos.y}%`,
            transform: 'translate(-50%, -50%)',
            transition: 'left 80ms linear, top 80ms linear',
            zIndex: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            pointerEvents: 'none',
          }}
        >
          <div
            className={
              tsActive && tsDotIsPlatinum && !tsIsEvent
                ? 'mm-platinum-dot'
                : isPlatinum && !tsActive
                  ? 'mm-platinum-dot'
                  : tsActive
                    ? 'mm-transform-dot'
                    : undefined
            }
            style={{
              width: tsIsEvent
                ? 'var(--mm-player-star)'
                : (tsActive && tsDotIsPlatinum) || (isPlatinum && !tsActive)
                  ? 'var(--mm-player-lg)'
                  : 'var(--mm-player)',
              height: tsIsEvent
                ? 'var(--mm-player-star)'
                : (tsActive && tsDotIsPlatinum) || (isPlatinum && !tsActive)
                  ? 'var(--mm-player-lg)'
                  : 'var(--mm-player)',
              ...(tsIsEvent
                ? { clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }
                : { borderRadius: '50%' }),
              ...((tsActive && tsDotIsPlatinum && !tsIsEvent) || (isPlatinum && !tsActive) ? {} : {
                background: tsActive ? tsDotColor : playerDotColor,
                boxShadow: tsIsEvent
                  ? `0 0 16px ${tsDotColor}, 0 0 32px ${tsDotColor}60`
                  : `0 0 ${tsActive ? 14 : (level >= 75 ? 12 : 8)}px ${
                      tsActive ? tsDotColor : playerDotColor
                    }`,
                animation: isHunting
                  ? (tsActive ? 'mmTransformPulse 1.2s infinite' : 'mmPulse 1.5s infinite')
                  : 'none',
              }),
              transition: 'clip-path 0.3s ease, border-radius 0.3s ease, background 0.3s ease, box-shadow 0.3s ease',
            }}
          />
        </div>

        {/* 존 라벨 + 접속자 */}
        <span style={{ position: 'absolute', top: 8, left: 12, ...LABEL, fontSize: 'var(--fs-xs)', opacity: 0.5 }}>
          {zone.name}
          {zonePlayerCount > 1 && (
            <span
              style={{ marginLeft: 4, color: 'var(--warning)', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); setShowPlayerList(v => !v); }}
            >
              👤{zonePlayerCount}
            </span>
          )}
        </span>

        {/* 접속자 목록 팝업 */}
        {showPlayerList && zonePlayerCount > 1 && zonePlayers.length > 0 && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: 26, left: 12, zIndex: 20,
              background: 'rgba(0,0,0,0.85)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '6px 0', minWidth: 140, maxWidth: 180,
              backdropFilter: 'blur(4px)',
            }}
          >
            <div style={{
              padding: '0 8px 4px', fontSize: 'var(--fs-xxs)', color: 'var(--text-secondary)',
              borderBottom: '1px solid var(--border)', marginBottom: 2,
            }}>
              접속자 ({zonePlayers.length})
            </div>
            {zonePlayers.map(p => {
              const isMe = p.userId === authUserId;
              const isGuildMate = !isMe && !!myGuildId && p.guildId === myGuildId;
              const classIcon = p.playerClass === 'knight' ? '⚔️' : p.playerClass === 'elf' ? '🏹' : '🔮';
              return (
                <div key={p.userId} style={{
                  padding: '3px 8px', fontSize: 'var(--fs-xxs)',
                  display: 'flex', alignItems: 'center', gap: 4,
                  color: isMe ? 'var(--accent)' : isGuildMate ? 'var(--success)' : 'var(--text-primary)',
                  opacity: isMe ? 1 : 0.85,
                }}>
                  <span>{classIcon}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isGuildMate ? '🏠 ' : ''}{p.name}{isMe ? ' (나)' : ''}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>Lv.{p.level}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* 몬스터 수 */}
        <span style={{ position: 'absolute', top: 8, right: 12, ...LABEL, fontSize: 'var(--fs-xs)', opacity: 0.5 }}>
          {VISIBLE_MONSTERS}m
        </span>

        {/* ── 전투 중지 / 사망 오버레이 ── */}
        {(() => {
          const isDead = currentHp <= 0;
          const isPaused = hunt.status === 'paused';
          if (!isDead && !isPaused) return null;
          return (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: isDead
                  ? 'radial-gradient(ellipse at center, rgba(180,30,30,0.45) 0%, rgba(0,0,0,0.65) 100%)'
                  : 'radial-gradient(ellipse at center, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                zIndex: 50,
              }}
            >
              <span style={{
                fontSize: 'var(--fs-sm)',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: isDead ? '#ff6b6b' : 'var(--warning)',
                textShadow: `0 0 8px ${isDead ? 'rgba(255,60,60,0.6)' : 'rgba(255,180,0,0.4)'}`,
                letterSpacing: 1,
              }}>
                {isDead ? '💀 사망' : '⏸ 일시정지'}
              </span>
              <button
                onClick={() => { isDead ? revive() : resumeHunt(); }}
                style={{
                  padding: '8px 24px',
                  borderRadius: 'var(--r-md)',
                  border: 'none',
                  background: isDead
                    ? 'linear-gradient(135deg, #e53935, #c62828)'
                    : 'linear-gradient(135deg, var(--success), oklch(0.66 0.16 135))',
                  color: '#fff',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 800,
                  fontFamily: 'var(--font-ui)',
                  cursor: 'pointer',
                  boxShadow: isDead
                    ? '0 0 16px rgba(229,57,53,0.5)'
                    : '0 0 16px rgba(76,175,80,0.4)',
                  transition: 'transform 0.1s ease',
                }}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
                onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                {isDead ? '부활하기' : '▶ 사냥 시작'}
              </button>
            </div>
          );
        })()}
      </div>


      {/* CSS Animations */}
      <style>{`
        @keyframes mmPulse {
          0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.5; transform: translate(-50%, -50%) scale(1.3); }
        }
        @keyframes mmMonsterPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.4); }
        }
        @keyframes mmAggroBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes mmAggroGlow {
          0%, 100% { box-shadow: 0 0 3px 0px rgba(255,60,60,0.3); border-color: rgba(255,70,70,0.45); }
          50% { box-shadow: 0 0 6px 1px rgba(255,60,60,0.6); border-color: rgba(255,70,70,0.75); }
        }
        @keyframes mmBurst {
          0% { opacity: 0.9; transform: translate(-50%, -50%) scale(0.5); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(3.5); }
        }
        @keyframes mmFloatUp {
          0% { opacity: 1; transform: translate(-50%, -50%) translateY(0); }
          100% { opacity: 0; transform: translate(-50%, -50%) translateY(-18px); }
        }
        @keyframes mmPlatinumShift {
          0%   { background: #e0e7ff; box-shadow: 0 0 14px #e0e7ff, 0 0 4px #fff; }
          15%  { background: #c8b6ff; box-shadow: 0 0 16px #c8b6ff, 0 0 5px #e8daff; }
          30%  { background: #bde0fe; box-shadow: 0 0 14px #bde0fe, 0 0 4px #e0f7ff; }
          45%  { background: #ffffff; box-shadow: 0 0 18px #ffffff, 0 0 6px #e0e7ff; }
          60%  { background: #d0f0fd; box-shadow: 0 0 14px #d0f0fd, 0 0 4px #b8ecff; }
          75%  { background: #e2d4f0; box-shadow: 0 0 16px #e2d4f0, 0 0 5px #f0e8ff; }
          90%  { background: #f0f4ff; box-shadow: 0 0 18px #f0f4ff, 0 0 6px #fff; }
          100% { background: #e0e7ff; box-shadow: 0 0 14px #e0e7ff, 0 0 4px #fff; }
        }
        @keyframes mmPlatinumPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50%      { transform: translate(-50%, -50%) scale(1.5); }
        }
        @keyframes mmTransformPulse {
          0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.5); }
        }
        @keyframes mmSkillPop {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
          40% { opacity: 1; transform: translate(-50%, -50%) scale(1.3); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.8); }
        }
        .mm-bolt {
          position: absolute;
          width: 12px; height: 2px;
          border-radius: 2px;
          pointer-events: none;
          animation: mmBolt 0.35s linear forwards;
        }
        .mm-bolt-b2 { animation-delay: .08s; opacity: .7; }
        @keyframes mmAoeBlast {
          0%   { transform: translate(-50%, -50%) scale(0.3); opacity: 0.9; }
          40%  { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
          100% { transform: translate(-50%, -50%) scale(1.2); opacity: 0; }
        }
        @keyframes mmBolt {
          0%   { transform: translateX(0); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 0.9; }
          100% { transform: translateX(var(--bolt-dist, 80px)); opacity: 0; }
        }
        .mm-transform-dot {
          animation: mmTransformPulse 1.2s ease-in-out infinite;
        }
        .mm-platinum-dot {
          animation:
            mmPlatinumShift 2.4s ease-in-out infinite,
            mmPlatinumPulse 1.2s ease-in-out infinite;
          border-radius: 50%;
        }
      `}</style>
    </div>
  );
}
