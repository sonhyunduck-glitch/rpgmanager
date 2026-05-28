/* =========================================================
   SPATIAL TYPES — 공간 기반 전투 시스템 타입 정의

   모든 공간 좌표는 미터(m) 단위. 맵 크기 50m × 50m.
   Minimap은 m → % 변환하여 렌더링.
   ========================================================= */
import type { LogEntry, PlayerClass, KnightSubclass, CombatStyle, Equipment, ActiveBuff } from './index';

// ══════════════════════════════════════════════
// 기본 공간 타입
// ══════════════════════════════════════════════

/** 2D 좌표 (미터 단위, 0 ~ mapSize) */
export interface Vec2 {
  x: number;
  y: number;
}

// ══════════════════════════════════════════════
// 엔티티 (맵 위의 모든 객체)
// ══════════════════════════════════════════════

export type EntityType = 'player' | 'monster';

export interface SpatialEntity {
  id: string;
  type: EntityType;
  pos: Vec2;
  hitRadius: number;       // 히트 영역 반지름 (m) — 플레이어 0.5, 일반 0.8, 대형 1.2
  alive: boolean;
  // 몬스터 전용
  monsterIdx?: number;     // tierMonsters 인덱스 (Minimap 색상/이름용)
  monsterId?: string;      // 게임 데이터 조회용 (npc_xxxxx)
  respawnAt?: number;      // 사망 후 리스폰 시각 (timestamp, ms)
  lastRespawnAt?: number;  // 마지막 리스폰 시각 (Minimap transition 방지용)
}

// ══════════════════════════════════════════════
// 투사체
// ══════════════════════════════════════════════

export type ProjectileType = 'arrow' | 'magic_bolt' | 'monster_magic' | 'monster_skill';

export interface SpatialProjectile {
  id: string;
  type: ProjectileType;
  from: Vec2;              // 발사 위치
  to: Vec2;                // 목표 위치 (발사 시점)
  targetEntityId: string;  // 피격 대상 엔티티
  pos: Vec2;               // 현재 위치
  speed: number;           // m/s
  progress: number;        // 0~1 (도달 시 1)
  payload: CombatPayload;  // 도달 시 적용할 전투 데이터
}

/** 투사체에 실린 전투 데이터 (발사 시 L1J 공식으로 계산, 도달 시 적용) */
export interface CombatPayload {
  damage: number;          // 최종 대미지 (이미 계산됨)
  isCrit: boolean;
  isHit: boolean;          // false = miss (투사체는 날아가지만 대미지 0)
  spellName?: string;
  logText: string;         // 전투 로그 텍스트
  logType: LogEntry['type'];
}

// ══════════════════════════════════════════════
// 충돌/전투 이벤트 (Minimap이 소비하는 시각 이벤트)
// ══════════════════════════════════════════════

export type CombatEventType =
  | 'melee_hit'         // 근접 명중
  | 'melee_miss'        // 근접 빗나감
  | 'projectile_hit'    // 투사체 명중
  | 'projectile_miss'   // 투사체 빗나감 (miss 투사체 도달)
  | 'monster_hit'       // 몬스터 → 플레이어 물리 피격
  | 'monster_magic_hit' // 몬스터 → 플레이어 마법 피격
  | 'monster_skill'     // 몬스터 스킬 발동
  | 'kill'              // 처치
  | 'dodge'             // 플레이어 회피
  | 'summon'            // 몬스터 소환
  | 'heal'              // 몬스터 자가 치유
  | 'projectile_fire';  // 투사체 발사 (시각 트리거용)

export interface CombatEvent {
  id: string;
  type: CombatEventType;
  pos: Vec2;
  sourcePos?: Vec2;        // 공격 원점 (몬스터→플레이어 공격 방향 표시용)
  damage?: number;
  isCrit?: boolean;
  monsterName?: string;
  skillName?: string;
  color?: string;          // 이펙트 색상 (몬스터 닷 색상)
  projectileType?: ProjectileType;
  timestamp: number;
}

// ══════════════════════════════════════════════
// 이동 명령
// ══════════════════════════════════════════════

export type ArrivalAction = 'attack' | 'join' | 'idle';

export interface MoveOrder {
  entityId: string;
  destination: Vec2;
  speed: number;           // m/s
  stopDistance?: number;    // 목표까지 이 거리에서 정지 (원거리: ATTACK_RANGE_M)
  onArrival?: ArrivalAction;
}

// ══════════════════════════════════════════════
// 공간 상태 (Zustand store에 통합)
// ══════════════════════════════════════════════

export interface SpatialState {
  entities: Map<string, SpatialEntity>;
  projectiles: SpatialProjectile[];
  moveOrders: Map<string, MoveOrder>;
  combatEvents: CombatEvent[];    // Minimap이 소비 후 비움
  mapSize: number;                // 50 (m)
}

// ══════════════════════════════════════════════
// 전투 컨텍스트 (분리된 모듈 간 공유 읽기 전용 데이터)
// ══════════════════════════════════════════════

/** combatTick에서 한 번 수집하여 하위 모듈에 전달 */
export interface CombatContext {
  // 플레이어 기본
  level: number;
  playerClass: PlayerClass;
  subclass: KnightSubclass | null;
  combatStyle: CombatStyle;

  // 순수 스탯 (베이스 + 투자)
  str: number;
  dex: number;
  con: number;
  wis: number;
  int: number;

  // 버프 적용 후 유효 스탯
  effectiveStr: number;
  effectiveDex: number;

  // AC
  playerAC: number;
  effectivePlayerAC: number;

  // 장비 보너스 (한 번 수집)
  weaponEnchant: number;
  weaponBaseDmg: number;
  equipBonusHit: number;
  equipBonusExtraDmg: number;
  equipBonusMr: number;
  equipBonusHp: number;
  equipBonusBowHit: number;
  equipBonusBowDmg: number;
  equipBonusSp: number;
  equipBonusMagicDmg: number;
  equipHpr: number;
  equipMpr: number;

  // 버프 보너스
  skillBuffHit: number;
  skillBuffDmg: number;
  skillBuffFireDmg: number;
  skillBuffAc: number;
  totalSp: number;

  // 스킬 상태
  equippedSkills: number[];
  disabledSkills: number[];

  // 장비
  equippedWeapon: Equipment | null;

  // 타이밍
  now: number;
}

// ══════════════════════════════════════════════
// 분리 모듈 결과 타입
// ══════════════════════════════════════════════

/** 플레이어 공격 결과 (combatPlayerAttack.ts) */
export interface PlayerAttackResult {
  monsterHp: number;
  logs: LogEntry[];
  killed: boolean;
  isCrit: boolean;
  finalDmg: number;
  usedSpellName: string;
  // 원거리: 투사체 생성 정보
  projectile?: SpatialProjectile;
  // 스킬 상태 변경
  mp: number;
  materials: Record<string, number>;
  skillCooldowns: Record<number, number>;
  monsterStunnedTicks: number;
  windShackleTicks: number;
}

/** 몬스터 반격 결과 (combatMonsterAttack.ts) */
export interface MonsterAttackResult {
  currentHp: number;
  logs: LogEntry[];
  evasionCount: number;
  lastMagicHitAt: number;
  consecutiveMagicHits: number;
  monsterAtkAccum: number;
  // 마법 몬스터: 역방향 투사체
  projectiles?: SpatialProjectile[];
  // 몬스터 스킬 관련
  monsterHp: number;              // 스킬 heal 등으로 변경될 수 있음
  mobSkillCooldowns: Record<string, number>;
  approachingMonsters: { monsterId: string; hp: number; distanceRemaining: number }[];
  joinedMonsters: { monsterId: string; hp: number }[];
}

/** 버프/물약 처리 결과 (combatBuffs.ts) */
export interface BuffResult {
  activeBuffs: ActiveBuff[];
  mp: number;
  materials: Record<string, number>;
  potions: Record<string, number>;
  logs: LogEntry[];
  skillCooldowns: Record<number, number>;
  lastMpRegenAt: number;
}

/** 킬 보상 결과 (combatRewards.ts) */
export interface RewardResult {
  gold: number;
  exp: number;
  level: number;
  title: string;
  maxHp: number;
  currentHp: number;
  inventory: Equipment[];
  materials: Record<string, number>;
  logs: LogEntry[];
  kills: number;
  roomKills: number;
  roomCleared: number;
  shouldAdvanceFloor: boolean;
  pendingSubclassChoice: boolean;
}
