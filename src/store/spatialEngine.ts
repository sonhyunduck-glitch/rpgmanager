/* =========================================================
   SPATIAL ENGINE — 순수 공간 계산 모듈

   게임 로직(L1J 전투 공식)과 완전 독립적.
   좌표 이동, 충돌 판정, 투사체 전진, 랜덤 좌표 생성.
   모든 좌표는 미터(m) 단위 — 맵 50m × 50m.
   ========================================================= */
import type { Vec2, SpatialEntity, SpatialProjectile, MoveOrder, SpatialState, CombatPayload, CombatEvent } from '../types/spatial';

// ══════════════════════════════════════════════
// 기본 수학
// ══════════════════════════════════════════════

/** 두 점 사이 거리 (m) */
export function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 두 점 사이 거리의 제곱 (비교용 — sqrt 생략 최적화) */
export function distanceSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** a에서 b 방향의 단위 벡터 (a=b일 경우 {0,0}) */
export function direction(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

// ══════════════════════════════════════════════
// 충돌 판정
// ══════════════════════════════════════════════

/** 두 엔티티의 히트 영역 겹침 여부 (원형 충돌) */
export function checkCollision(a: SpatialEntity, b: SpatialEntity): boolean {
  const combinedRadius = a.hitRadius + b.hitRadius;
  return distanceSq(a.pos, b.pos) <= combinedRadius * combinedRadius;
}

/** 점이 엔티티의 히트 영역 안에 있는지 */
export function isInsideHitArea(point: Vec2, entity: SpatialEntity): boolean {
  return distanceSq(point, entity.pos) <= entity.hitRadius * entity.hitRadius;
}

// ══════════════════════════════════════════════
// 엔티티 이동
// ══════════════════════════════════════════════

/**
 * 엔티티를 이동 명령에 따라 이동.
 * 직접 entity.pos를 수정하지 않고 새 위치를 반환.
 *
 * @returns { newPos, arrived } — 새 좌표와 도착 여부
 */
export function moveEntity(
  currentPos: Vec2,
  order: MoveOrder,
  deltaTimeSec: number,
): { newPos: Vec2; arrived: boolean } {
  const dist = distance(currentPos, order.destination);
  const stopDist = order.stopDistance ?? 0;
  const remaining = dist - stopDist;

  // 이미 도착
  if (remaining <= 0.1) {
    return { newPos: currentPos, arrived: true };
  }

  const moveAmount = order.speed * deltaTimeSec;

  if (moveAmount >= remaining) {
    // 이번 프레임에 도착: 정확한 정지 위치로 스냅
    const dir = direction(currentPos, order.destination);
    const snapDist = dist - stopDist;
    return {
      newPos: {
        x: currentPos.x + dir.x * snapDist,
        y: currentPos.y + dir.y * snapDist,
      },
      arrived: true,
    };
  }

  // 이동 중
  const dir = direction(currentPos, order.destination);
  return {
    newPos: {
      x: currentPos.x + dir.x * moveAmount,
      y: currentPos.y + dir.y * moveAmount,
    },
    arrived: false,
  };
}

// ══════════════════════════════════════════════
// 투사체 전진
// ══════════════════════════════════════════════

/**
 * 투사체를 목표 방향으로 전진.
 * 직접 proj를 수정하지 않고 새 상태를 반환.
 *
 * @returns { newPos, newProgress, arrived }
 */
export function advanceProjectile(
  proj: SpatialProjectile,
  deltaTimeSec: number,
): { newPos: Vec2; newProgress: number; arrived: boolean } {
  const totalDist = distance(proj.from, proj.to);
  if (totalDist <= 0.01) {
    return { newPos: { ...proj.to }, newProgress: 1, arrived: true };
  }

  const progressInc = (proj.speed * deltaTimeSec) / totalDist;
  const newProgress = Math.min(1, proj.progress + progressInc);
  const newPos: Vec2 = {
    x: proj.from.x + (proj.to.x - proj.from.x) * newProgress,
    y: proj.from.y + (proj.to.y - proj.from.y) * newProgress,
  };

  return { newPos, newProgress, arrived: newProgress >= 1 };
}

// ══════════════════════════════════════════════
// 좌표 생성
// ══════════════════════════════════════════════

/** 맵 경계 내 안전 마진 (m) — 가장자리에서 이 거리만큼 안쪽 */
const EDGE_MARGIN = 4; // m

/**
 * 맵 경계 내 랜덤 좌표 생성.
 * avoidPos가 지정되면 minDistance(m) 이상 떨어진 곳에 배치.
 * 최대 20회 시도 후 실패하면 맵 가장자리에 배치.
 */
export function randomMapPos(
  mapSize: number,
  avoidPos?: Vec2,
  minDistance: number = 0,
): Vec2 {
  const min = EDGE_MARGIN;
  const max = mapSize - EDGE_MARGIN;

  for (let tries = 0; tries < 20; tries++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 9 + Math.random() * 16; // 9~25m from center
    const x = Math.max(min, Math.min(max, mapSize / 2 + Math.cos(angle) * r));
    const y = Math.max(min, Math.min(max, mapSize / 2 + Math.sin(angle) * r * 0.7));

    if (avoidPos && minDistance > 0) {
      if (distance({ x, y }, avoidPos) < minDistance) continue;
    }
    return { x, y };
  }

  // 20회 실패 → 맵 가장자리
  const edge = Math.random() < 0.5 ? min : max;
  return { x: edge, y: min + Math.random() * (max - min) };
}

/**
 * 현재 위치 근처로 랜덤 이동 (로밍용).
 * maxRange(m) 이내, 맵 경계 내.
 */
export function nudgePosition(pos: Vec2, maxRange: number, mapSize: number): Vec2 {
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * maxRange;
  const min = EDGE_MARGIN - 1; // 약간 여유
  const max = mapSize - EDGE_MARGIN + 1;
  return {
    x: Math.max(min, Math.min(max, pos.x + Math.cos(angle) * dist)),
    y: Math.max(min, Math.min(max, pos.y + Math.sin(angle) * dist)),
  };
}

// ══════════════════════════════════════════════
// 엔티티 검색
// ══════════════════════════════════════════════

/**
 * 주어진 위치에서 가장 가까운 살아있는 몬스터 엔티티 ID.
 * excludeId를 제외하고 검색.
 */
export function findNearestAliveMonster(
  entities: Map<string, SpatialEntity>,
  fromPos: Vec2,
  excludeId?: string,
): string | null {
  let nearestId: string | null = null;
  let nearestDistSq = Infinity;

  for (const [id, entity] of entities) {
    if (entity.type !== 'monster') continue;
    if (!entity.alive) continue;
    if (id === excludeId) continue;

    const dSq = distanceSq(fromPos, entity.pos);
    if (dSq < nearestDistSq) {
      nearestDistSq = dSq;
      nearestId = id;
    }
  }

  return nearestId;
}

/**
 * 주어진 위치에서 가장 가까운, 특정 monsterId를 가진 살아있는 몬스터 엔티티 ID.
 * 같은 종류의 몬스터 중 가장 가까운 것을 선택.
 */
export function findNearestAliveMonsterByType(
  entities: Map<string, SpatialEntity>,
  fromPos: Vec2,
  monsterId: string,
  excludeId?: string,
): string | null {
  let nearestId: string | null = null;
  let nearestDistSq = Infinity;

  for (const [id, entity] of entities) {
    if (entity.type !== 'monster') continue;
    if (!entity.alive) continue;
    if (entity.monsterId !== monsterId) continue;
    if (id === excludeId) continue;

    const dSq = distanceSq(fromPos, entity.pos);
    if (dSq < nearestDistSq) {
      nearestDistSq = dSq;
      nearestId = id;
    }
  }

  return nearestId;
}

/**
 * 지정 반경 내 살아있는 선공 몬스터 목록.
 * excludeIds에 포함된 엔티티는 제외.
 */
export function findAggroMonstersInRange(
  entities: Map<string, SpatialEntity>,
  centerPos: Vec2,
  rangeM: number,
  excludeIds: Set<string>,
  isAggressive: (entity: SpatialEntity) => boolean,
): string[] {
  const result: string[] = [];
  const rangeSq = rangeM * rangeM;

  for (const [id, entity] of entities) {
    if (entity.type !== 'monster') continue;
    if (!entity.alive) continue;
    if (excludeIds.has(id)) continue;
    if (!isAggressive(entity)) continue;

    if (distanceSq(centerPos, entity.pos) <= rangeSq) {
      result.push(id);
    }
  }

  return result;
}

// ══════════════════════════════════════════════
// m ↔ % 변환 유틸
// ══════════════════════════════════════════════

/** 미터 → 퍼센트 (Minimap 렌더링용) */
export function mToPercent(pos: Vec2, mapSize: number): { x: number; y: number } {
  return {
    x: (pos.x / mapSize) * 100,
    y: (pos.y / mapSize) * 100,
  };
}

/** 퍼센트 → 미터 */
export function percentToM(pct: { x: number; y: number }, mapSize: number): Vec2 {
  return {
    x: (pct.x / 100) * mapSize,
    y: (pct.y / 100) * mapSize,
  };
}

// ══════════════════════════════════════════════
// 상수
// ══════════════════════════════════════════════

/** 기본 맵 크기 (m) */
export const DEFAULT_MAP_SIZE = 50;

/** 히트 반지름 */
export const HIT_RADIUS_PLAYER = 0.5;
export const HIT_RADIUS_MONSTER_SMALL = 0.8;
export const HIT_RADIUS_MONSTER_LARGE = 1.2;

/** 원거리 공격 거리 (m) */
export const ATTACK_RANGE_M = 8;

/** 투사체 속도 (m/s) */
export const PROJECTILE_SPEED_ARROW = 25;       // 요정 화살
export const PROJECTILE_SPEED_MAGIC = 20;       // 마법사 볼트
export const PROJECTILE_SPEED_MONSTER_MAGIC = 18;// 몬스터 마법
export const PROJECTILE_SPEED_MONSTER_SKILL = 15;// 몬스터 스킬

/** 리스폰 딜레이 (ms) */
export const RESPAWN_DELAY_MS = 10_000;

/** 플레이어 기본 이동 속도 (m/s) — 버프 배율 별도 적용 */
export const PLAYER_MOVE_SPEED = 4;

/** 선공 어그로 감지 거리 (m) */
export const AGGRO_RANGE_M = 5;

/** 몬스터 로밍 범위 (m) */
export const MONSTER_ROAM_RANGE_M = 2;

/** 리스폰 안전 거리 (플레이어로부터 m) */
export const RESPAWN_SAFE_DISTANCE_M = 10;

// ══════════════════════════════════════════════
// 팩토리 함수
// ══════════════════════════════════════════════

/** 비어있는 초기 SpatialState 생성 */
export function createEmptySpatialState(): SpatialState {
  return {
    entities: new Map(),
    projectiles: [],
    moveOrders: new Map(),
    combatEvents: [],
    mapSize: DEFAULT_MAP_SIZE,
  };
}

/**
 * 사냥 시작 시 공간 상태 초기화
 * - 플레이어 엔티티 (맵 중앙)
 * - VISIBLE_MONSTERS개의 몬스터 엔티티 (랜덤 배치)
 * - 가장 가까운 몬스터로 이동 명령 발행
 *
 * @param monsterIds     방에 등장하는 몬스터 ID 목록 (tierMonsters[].id)
 * @param visibleCount   미니맵에 표시할 몬스터 닷 수 (VISIBLE_MONSTERS)
 * @param combatStyle    'melee' | 'ranged_bow' | 'ranged_magic'
 * @param playerMoveSpeed 플레이어 이동 속도 (m/s)
 */
export function initHuntSpatialState(
  monsterIds: string[],
  visibleCount: number,
  combatStyle: string,
  playerMoveSpeed: number,
): SpatialState {
  const entities = new Map<string, SpatialEntity>();
  const moveOrders = new Map<string, MoveOrder>();
  const mapSize = DEFAULT_MAP_SIZE;
  const monsterCount = monsterIds.length;

  // 플레이어: 맵 중앙
  const playerPos: Vec2 = { x: mapSize / 2, y: mapSize / 2 };
  entities.set('player', {
    id: 'player',
    type: 'player',
    pos: { ...playerPos },
    hitRadius: HIT_RADIUS_PLAYER,
    alive: true,
  });

  // 몬스터 닷 배치 (플레이어로부터 최소 5m 이상 떨어진 곳)
  for (let i = 0; i < visibleCount; i++) {
    const entityId = `monster_${i}`;
    const monsterIdx = monsterCount > 0 ? Math.floor(Math.random() * monsterCount) : 0;
    const pos = randomMapPos(mapSize, playerPos, 5);
    entities.set(entityId, {
      id: entityId,
      type: 'monster',
      pos,
      hitRadius: HIT_RADIUS_MONSTER_SMALL,
      alive: true,
      monsterIdx,
      monsterId: monsterCount > 0 ? monsterIds[monsterIdx] : undefined,
    });
  }

  // 가장 가까운 몬스터로 이동 명령
  const nearestId = findNearestAliveMonster(entities, playerPos);
  if (nearestId) {
    const nearestEntity = entities.get(nearestId)!;
    const stopDist = combatStyle === 'melee' ? 0 : ATTACK_RANGE_M;
    moveOrders.set('player', {
      entityId: 'player',
      destination: { ...nearestEntity.pos },
      speed: playerMoveSpeed,
      stopDistance: stopDist,
      onArrival: 'attack',
    });
  }

  return {
    entities,
    projectiles: [],
    moveOrders,
    combatEvents: [],
    mapSize,
  };
}

// ══════════════════════════════════════════════
// 틱 공간 업데이트
// ══════════════════════════════════════════════

/** 투사체 도달 이벤트 */
export interface ProjectileArrival {
  projectile: SpatialProjectile;
  payload: CombatPayload;
}

/** 이동 도착 이벤트 */
export interface MoveArrival {
  entityId: string;
  onArrival: string;  // 'attack' | 'join' | 'idle'
}

/** tickSpatialUpdate 결과 */
export interface SpatialTickResult {
  entities: Map<string, SpatialEntity>;
  projectiles: SpatialProjectile[];
  moveOrders: Map<string, MoveOrder>;
  combatEvents: CombatEvent[];
  projectileArrivals: ProjectileArrival[];
  moveArrivals: MoveArrival[];
}

/**
 * 매 틱 공간 상태 업데이트 (순수 함수).
 *
 * 1. 이동 명령 처리 → 엔티티 좌표 업데이트
 * 2. 투사체 전진 → 도달 시 페이로드 수집
 * 3. 사망한 몬스터 리스폰 체크
 *
 * @param spatial   현재 공간 상태
 * @param deltaSec  이번 틱의 경과 시간 (초)
 * @param now       현재 타임스탬프 (ms)
 */
export function tickSpatialUpdate(
  spatial: SpatialState,
  deltaSec: number,
  now: number,
  monsterIds?: string[],
): SpatialTickResult {
  // 불변 복사
  const entities = new Map(spatial.entities);
  const moveOrders = new Map(spatial.moveOrders);
  const combatEvents: CombatEvent[] = [];
  const projectileArrivals: ProjectileArrival[] = [];
  const moveArrivals: MoveArrival[] = [];

  // ── 1. 이동 명령 처리 ──
  for (const [entityId, order] of moveOrders) {
    const entity = entities.get(entityId);
    if (!entity || !entity.alive) {
      moveOrders.delete(entityId);
      continue;
    }

    const { newPos, arrived } = moveEntity(entity.pos, order, deltaSec);

    // 엔티티 좌표 업데이트 (불변)
    entities.set(entityId, { ...entity, pos: newPos });

    if (arrived) {
      moveOrders.delete(entityId);
      if (order.onArrival) {
        moveArrivals.push({ entityId, onArrival: order.onArrival });
      }
    }
  }

  // ── 2. 투사체 전진 ──
  const remainingProjectiles: SpatialProjectile[] = [];

  for (const proj of spatial.projectiles) {
    const { newPos, newProgress, arrived } = advanceProjectile(proj, deltaSec);

    if (arrived) {
      // 도달 → 페이로드 수집 (호출자가 대미지 적용)
      projectileArrivals.push({
        projectile: { ...proj, pos: newPos, progress: newProgress },
        payload: proj.payload,
      });
      // 시각 이벤트 생성
      const evType = proj.payload.isHit ? 'projectile_hit' : 'projectile_miss';
      combatEvents.push({
        id: `ce_${now}_${proj.id}`,
        type: evType as CombatEvent['type'],
        pos: newPos,
        damage: proj.payload.isHit ? proj.payload.damage : undefined,
        isCrit: proj.payload.isCrit,
        skillName: proj.payload.spellName,
        timestamp: now,
      });
    } else {
      // 아직 비행 중
      remainingProjectiles.push({
        ...proj,
        pos: newPos,
        progress: newProgress,
      });
    }
  }

  // ── 3. 몬스터 리스폰 체크 ──
  for (const [id, entity] of entities) {
    if (entity.type !== 'monster') continue;
    if (entity.alive) continue;
    if (entity.respawnAt && entity.respawnAt <= now) {
      // 리스폰: 새 위치 + 랜덤 몬스터 종류로 부활
      const playerEntity = entities.get('player');
      const playerPos = playerEntity?.pos ?? { x: spatial.mapSize / 2, y: spatial.mapSize / 2 };
      const newPos = randomMapPos(spatial.mapSize, playerPos, RESPAWN_SAFE_DISTANCE_M);
      const monsterCount = monsterIds?.length ?? 0;
      const newMonsterIdx = monsterCount > 0 ? Math.floor(Math.random() * monsterCount) : (entity.monsterIdx ?? 0);
      const newMonsterId = monsterCount > 0 ? monsterIds![newMonsterIdx] : entity.monsterId;
      entities.set(id, {
        ...entity,
        pos: newPos,
        alive: true,
        respawnAt: undefined,
        lastRespawnAt: now,
        monsterIdx: newMonsterIdx,
        monsterId: newMonsterId,
      });
    }
  }

  return {
    entities,
    projectiles: remainingProjectiles,
    moveOrders,
    combatEvents,
    projectileArrivals,
    moveArrivals,
  };
}
