/* =========================================================
   MINIMAP — 유저가 몬스터를 찾아 이동하며 전투
   - 몬스터(색상점): 종류별 색상으로 흩어져 있음
   - 유저(파란점): 현재 타겟 몬스터로 이동
   - 전투중: 타겟 몬스터 점 반짝임
   - 처치 → 버스트 + 즉시삭제 → 0.5초후 다음 몬스터로 이동
   - 리스폰: 3초 후 새 위치/종류로 재출현
   - MISS / CRIT 텍스트 표시
   - 하단 범례: 현재 보이는 몬스터 정보
   ========================================================= */
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { HUNT_ZONES, getMonstersForRoom, getPlayerDotColor } from '../../data/gameData';
import { LABEL } from '../../styles/shared';

/* ── 상수 ── */
const VISIBLE_MONSTERS = 8;
const RESPAWN_DELAY = 3000;
const MAP_SIZE_M = 50;          // 맵 한 변 = 50m (화면 크기 무관)
const MOVE_SPEED = 0.5;         // 1m당 0.5초
const MONSTER_MOVE_MIN = 3000;       // 몬스터 개별 이동 최소 간격 (ms)
const MONSTER_MOVE_MAX = 7000;       // 몬스터 개별 이동 최대 간격 (ms)
const MONSTER_MOVE_RANGE_M = 2;      // 이동 반경 (m)

/* ── 몬스터 색상 팔레트 (12색) ── */
const MONSTER_PALETTE = [
  '#ef5350', // red
  '#ff7043', // orange
  '#ffa726', // amber
  '#66bb6a', // green
  '#26a69a', // teal
  '#42a5f5', // blue
  '#7e57c2', // purple
  '#ec407a', // pink
  '#26c6da', // cyan
  '#8d6e63', // brown
  '#78909c', // blue-grey
  '#d4e157', // lime
];

/* ── 타입 ── */
interface MapDot {
  x: number;
  y: number;
  monsterIdx: number; // index into zone.monsters
}

type MapEvent = {
  type: 'kill' | 'crit' | 'miss' | 'damage' | 'hit_taken';
  pos: { x: number; y: number };
  id: string;
  color?: string;
  dmgText?: string;
} | null;

interface MoveInfo {
  from: { x: number; y: number };
  to: { x: number; y: number };
  timeMs: number;
  distM: number;
  aggressive?: boolean;   // 선공 몬스터 접근 표시용
  monsterColor?: string;  // 선공 시 화살표 색상
}

/** 로그 텍스트에서 데미지 숫자 추출 */
function extractDamage(text: string): string | null {
  // "~에게 7 대미지" or "~처치! (8 dmg,"
  const m = text.match(/(\d+)\s*(대미지|dmg)/);
  return m ? m[1] : null;
}

/** 피격 로그에서 데미지 추출: "-5 HP" */
function extractHitDamage(text: string): string | null {
  const m = text.match(/-(\d+)\s*HP/);
  return m ? m[1] : null;
}

/* ── 유틸 ── */
const RESPAWN_SAFE_M = 10;  // 유저 주변 리스폰 금지 반경 (m)
const RESPAWN_SAFE_PCT = (RESPAWN_SAFE_M / MAP_SIZE_M) * 100; // → 20%

function randomScatterPos(playerPos?: { x: number; y: number }): { x: number; y: number } {
  for (let tries = 0; tries < 20; tries++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 18 + Math.random() * 32;
    const x = Math.max(8, Math.min(92, 50 + Math.cos(angle) * r));
    const y = Math.max(10, Math.min(85, 50 + Math.sin(angle) * r * 0.7));
    if (playerPos) {
      const dx = x - playerPos.x;
      const dy = y - playerPos.y;
      if (Math.sqrt(dx * dx + dy * dy) < RESPAWN_SAFE_PCT) continue;
    }
    return { x, y };
  }
  // 20회 시도 후에도 못 찾으면 맵 가장자리에 배치
  const edge = Math.random() < 0.5 ? 10 : 90;
  return { x: edge, y: 10 + Math.random() * 70 };
}

function pickNextAlive(
  dots: MapDot[],
  deadSet: Set<number>,
  excludeIdx: number,
  playerPos: { x: number; y: number },
): number {
  const alive = dots
    .map((_, i) => i)
    .filter(i => i !== excludeIdx && !deadSet.has(i));
  if (alive.length === 0) return -1;
  // 가장 가까운 몬스터 선택
  let nearest = alive[0];
  let nearestDist = Infinity;
  for (const i of alive) {
    const dx = dots[i].x - playerPos.x;
    const dy = dots[i].y - playerPos.y;
    const dist = dx * dx + dy * dy;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = i;
    }
  }
  return nearest;
}

function randomMonsterIdx(count: number): number {
  return Math.floor(Math.random() * count);
}

/** 현재 위치 근처로 랜덤 이동 (2m 이내, 맵 범위 내) */
function nudgePos(pos: { x: number; y: number }): { x: number; y: number } {
  const angle = Math.random() * Math.PI * 2;
  const maxPct = (MONSTER_MOVE_RANGE_M / MAP_SIZE_M) * 100; // 2m → 4%
  const dist = Math.random() * maxPct;
  return {
    x: Math.max(6, Math.min(94, pos.x + Math.cos(angle) * dist)),
    y: Math.max(8, Math.min(88, pos.y + Math.sin(angle) * dist)),
  };
}

/* ── 컴포넌트 ── */
export default function Minimap() {
  const hunt = useGameStore(s => s.hunt);
  const combatLog = useGameStore(s => s.combatLog);
  const level = useGameStore(s => s.level);
  const setPlayerMoving = useGameStore(s => s.setPlayerMoving);
  const getMoveSpeedMult = useGameStore(s => s.getMoveSpeedMult);
  const startApproach = useGameStore(s => s.startApproach);

  const playerDotColorRaw = getPlayerDotColor(level);
  const isPlatinum = playerDotColorRaw === 'platinum';
  const playerDotColor = isPlatinum ? '#e0e0e0' : playerDotColorRaw;

  const zone = HUNT_ZONES.find(z => z.id === hunt.zoneId);
  const currentRoom = hunt.currentRoom ?? 1;
  const isHunting = hunt.status === 'hunting';

  // 방 기반 필터링된 몬스터
  const tierMonsters = useMemo(
    () => zone ? getMonstersForRoom(zone, currentRoom) : [],
    [zone, currentRoom],
  );

  /* ── 상태 ── */
  const [dots, setDots] = useState<MapDot[]>([]);
  const [deadSet, setDeadSet] = useState<Set<number>>(new Set());
  const [playerPos, setPlayerPos] = useState({ x: 50, y: 50 });
  const [targetIdx, setTargetIdx] = useState<number>(0);
  const [event, setEvent] = useState<MapEvent>(null);
  const [moveInfo, setMoveInfo] = useState<MoveInfo | null>(null);
  const [moveDurationMs, setMoveDurationMs] = useState(600);
  // 접근 중인 몬스터 닷의 CSS transition duration (index → ms)
  const [dotApproachDuration, setDotApproachDuration] = useState<Map<number, number>>(new Map());
  // 합류 중인 몬스터 닷 인덱스
  const [joinedDotIdxs, setJoinedDotIdxs] = useState<Set<number>>(new Set());

  const mapRef = useRef<HTMLDivElement>(null);
  const prevZoneId = useRef<string | null>(null);
  const prevRoom = useRef<number | null>(null);
  const lastLogId = useRef<string | null>(null);

  // 로밍 타이머 콜백이 항상 최신 값을 참조하도록 ref 유지
  const targetIdxRef = useRef(targetIdx);
  const deadSetRef = useRef(deadSet);
  const playerPosRef = useRef(playerPos);
  targetIdxRef.current = targetIdx;
  deadSetRef.current = deadSet;
  playerPosRef.current = playerPos;
  const joinedDotIdxsRef = useRef(joinedDotIdxs);
  joinedDotIdxsRef.current = joinedDotIdxs;
  // 접근 중인 닷 인덱스 (ref: 즉시 반영, 재진입 방지)
  const approachingDotIdxsRef = useRef<Set<number>>(new Set());
  // 좌표 도착 예정 시각 (CSS transition 완료 시점)
  const arrivalTimeRef = useRef(0);

  /** 두 점(%)의 거리를 m 단위로 계산 */
  const calcDistM = useCallback((a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dxM = (a.x - b.x) / 100 * MAP_SIZE_M;
    const dyM = (a.y - b.y) / 100 * MAP_SIZE_M;
    return Math.sqrt(dxM * dxM + dyM * dyM);
  }, []);

  /** 두 점 사이의 거리(m)와 이동시간(ms) 계산 — 화면 크기 무관, 이속버프 적용 */
  const calcMoveTime = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dxM = (to.x - from.x) / 100 * MAP_SIZE_M;
    const dyM = (to.y - from.y) / 100 * MAP_SIZE_M;
    const distM = Math.max(1, Math.round(Math.sqrt(dxM * dxM + dyM * dyM)));
    const speedMult = getMoveSpeedMult();
    const timeMs = Math.max(300, Math.round(distM * (MOVE_SPEED / speedMult) * 1000));
    return { distM, timeMs };
  }, [getMoveSpeedMult]);


  /* ── 몬스터별 색상 맵 (티어 필터링된 몬스터 기준) ── */
  const monsterColorMap = useMemo(() => {
    const map = new Map<number, string>();
    tierMonsters.forEach((_, i) => {
      map.set(i, MONSTER_PALETTE[i % MONSTER_PALETTE.length]);
    });
    return map;
  }, [tierMonsters]);


  /* ── 존 변경 or 티어 변경 → 초기화 ── */
  useEffect(() => {
    if (zone?.id !== prevZoneId.current || currentRoom !== prevRoom.current) {
      prevZoneId.current = zone?.id ?? null;
      prevRoom.current = currentRoom;
      lastLogId.current = combatLog.length > 0 ? combatLog[combatLog.length - 1].id : null;
      const monsterCount = tierMonsters.length || 1;
      const initialDots: MapDot[] = Array.from({ length: VISIBLE_MONSTERS }, () => ({
        ...randomScatterPos(),
        monsterIdx: randomMonsterIdx(monsterCount),
      }));
      setDots(initialDots);
      setDeadSet(new Set());
      setEvent(null);
      setTargetIdx(0);
      setJoinedDotIdxs(new Set());
      setDotApproachDuration(new Map());
      approachingDotIdxsRef.current = new Set();
      setPlayerPos(initialDots[0] ?? { x: 50, y: 50 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone?.id, currentRoom, tierMonsters.length]);

  /* ── 몬스터 개별 랜덤 이동 ── */
  const roamTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    if (!isHunting || dots.length === 0) {
      roamTimers.current.forEach(t => clearTimeout(t));
      roamTimers.current.clear();
      return;
    }

    function scheduleRoam(idx: number) {
      const delay = MONSTER_MOVE_MIN + Math.random() * (MONSTER_MOVE_MAX - MONSTER_MOVE_MIN);
      const timer = setTimeout(() => {
        roamTimers.current.delete(idx);
        // ref로 최신 상태 체크 → 타겟·사망·합류 몬스터 확실히 정지
        if (deadSetRef.current.has(idx) || idx === targetIdxRef.current || joinedDotIdxsRef.current.has(idx)) {
          scheduleRoam(idx);
          return;
        }
        setDots(prev => {
          const next = [...prev];
          next[idx] = { ...next[idx], ...nudgePos(next[idx]) };
          return next;
        });
        scheduleRoam(idx);
      }, delay);
      roamTimers.current.set(idx, timer);
    }

    for (let i = 0; i < dots.length; i++) {
      if (!roamTimers.current.has(i)) {
        scheduleRoam(i);
      }
    }

    return () => {
      roamTimers.current.forEach(t => clearTimeout(t));
      roamTimers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHunting, dots.length]);

  /* ── 타겟 변경 시 해당 몬스터 로밍 타이머 즉시 취소 ── */
  useEffect(() => {
    const timer = roamTimers.current.get(targetIdx);
    if (timer) {
      clearTimeout(timer);
      roamTimers.current.delete(targetIdx);
    }
  }, [targetIdx]);

  /* ── 좌표 도착 감지: playerPos가 타겟에 도달 + CSS transition 완료 → 전투 시작 ── */
  const isPlayerMoving = useGameStore(s => s.isPlayerMoving);
  useEffect(() => {
    if (!isPlayerMoving || !isHunting) return;
    if (targetIdx < 0 || targetIdx >= dots.length || deadSet.has(targetIdx)) {
      setPlayerMoving(false);
      return;
    }
    const target = dots[targetIdx];
    const dx = Math.abs(playerPos.x - target.x);
    const dy = Math.abs(playerPos.y - target.y);
    if (dx < 1 && dy < 1) {
      // 좌표 도달 확인 — CSS transition 완료까지 대기 (이속버프 반영)
      const remaining = arrivalTimeRef.current - Date.now();
      if (remaining <= 0) {
        setPlayerMoving(false);
      } else {
        const timer = setTimeout(() => setPlayerMoving(false), remaining);
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerPos, targetIdx, dots, deadSet, isPlayerMoving, isHunting]);

  /* ── 같은 타겟이 로밍으로 이동했으면 플레이어 추적 이동 ── */
  const prevTargetPos = useRef<{ x: number; y: number } | null>(null);
  const prevTrackedIdx = useRef<number>(-1);
  useEffect(() => {
    if (!isHunting || targetIdx < 0 || targetIdx >= dots.length || deadSet.has(targetIdx)) {
      prevTargetPos.current = null;
      prevTrackedIdx.current = -1;
      return;
    }
    const target = dots[targetIdx];

    // 타겟이 바뀐 경우 → 위치만 기록 (킬/발견 핸들러가 이미 이동 처리함)
    if (prevTrackedIdx.current !== targetIdx) {
      prevTrackedIdx.current = targetIdx;
      prevTargetPos.current = { x: target.x, y: target.y };
      return;
    }

    const prev = prevTargetPos.current;
    prevTargetPos.current = { x: target.x, y: target.y };

    if (!prev) return;
    const dx = Math.abs(target.x - prev.x);
    const dy = Math.abs(target.y - prev.y);
    if (dx < 0.5 && dy < 0.5) return; // 변화 없음

    // 같은 타겟이 로밍으로 이동함 → 플레이어가 새 위치로 추적
    const curPlayer = playerPosRef.current;
    const { distM, timeMs } = calcMoveTime(curPlayer, target);
    setMoveInfo({ from: { ...curPlayer }, to: { x: target.x, y: target.y }, timeMs, distM });
    setMoveDurationMs(timeMs);
    setPlayerMoving(true);
    arrivalTimeRef.current = Date.now() + timeMs;
    setTimeout(() => setPlayerPos({ x: target.x, y: target.y }), 50);
    setTimeout(() => setMoveInfo(null), timeMs + 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dots, targetIdx, isHunting]);

  /* ── 전투 로그 감지 ── */
  useEffect(() => {
    if (combatLog.length === 0) return;

    let startIdx = 0;
    if (lastLogId.current) {
      const idx = combatLog.findIndex(e => e.id === lastLogId.current);
      if (idx >= 0) startIdx = idx + 1;
      else startIdx = Math.max(0, combatLog.length - 6);
    }

    if (startIdx >= combatLog.length) return;
    lastLogId.current = combatLog[combatLog.length - 1].id;

    const newEntries = combatLog.slice(startIdx);

    // enter 이벤트 체크
    const enterEntry = newEntries.find(e => e.type === 'enter');
    if (enterEntry) {
      setPlayerPos({ x: 50, y: 50 });
      setEvent(null);
      return;
    }

    // ── join 로그 처리 (도착 시 합류 표시) ──
    const joinEntry = newEntries.find(e => e.type === 'join');
    if (joinEntry) {
      // 유저 근처에 도착한 닷 → 합류 표시 (접근 ref에서도 제거)
      const nearPlayer = dots
        .map((d, i) => ({ i, dist: Math.abs(d.x - playerPos.x) + Math.abs(d.y - playerPos.y) }))
        .filter(d => d.i !== targetIdx && !deadSet.has(d.i) && !joinedDotIdxs.has(d.i))
        .sort((a, b) => a.dist - b.dist);
      if (nearPlayer.length > 0) {
        const arrivedIdx = nearPlayer[0].i;
        setJoinedDotIdxs(prev => new Set(prev).add(arrivedIdx));
        approachingDotIdxsRef.current.delete(arrivedIdx);
        setDotApproachDuration(prev => { const n = new Map(prev); n.delete(arrivedIdx); return n; });
      }
      const dmg = extractHitDamage(joinEntry.text);
      if (dmg) {
        setEvent({ type: 'hit_taken', pos: playerPos, id: joinEntry.id, dmgText: dmg });
        setTimeout(() => setEvent(null), 900);
      }
    }

    // ── 이벤트 처리 (else-if 체인 — return 없이 항상 끝까지 진행) ──
    const combatEntry = newEntries.find(
      e => e.type === 'kill' || e.type === 'encounter' || e.type === 'battle' || e.type === 'crit' || e.type === 'miss' || e.type === 'hit_taken' || e.type === 'death',
    );

    const currentTarget = dots[targetIdx];
    const targetColor = currentTarget ? (monsterColorMap.get(currentTarget.monsterIdx) ?? '#ef5350') : '#ef5350';

    // 킬 여부 판정: kill 타입 OR crit+처치
    const isKillEvent = combatEntry && (
      combatEntry.type === 'kill' ||
      (combatEntry.type === 'crit' && combatEntry.text.includes('처치'))
    );

    /** ── 유저→타겟 이동 헬퍼 (주 타겟은 항상 유저가 이동, 좌표 도착 감지) ── */
    const movePlayerToTarget = (nextI: number) => {
      const dest = dots[nextI];
      setTargetIdx(nextI);

      const { distM, timeMs } = calcMoveTime(playerPos, dest);
      setMoveInfo({
        from: { ...playerPos },
        to: { x: dest.x, y: dest.y },
        timeMs, distM,
      });
      setMoveDurationMs(timeMs);
      setPlayerMoving(true);
      arrivalTimeRef.current = Date.now() + timeMs;  // CSS transition 완료 시점
      // playerPos를 목적지로 설정 (CSS transition이 시각적 이동 담당)
      setTimeout(() => setPlayerPos({ x: dest.x, y: dest.y }), 50);
      setTimeout(() => setMoveInfo(null), timeMs + 200);
    };

    /** ── 킬 처리 헬퍼 (kill / crit+kill 공용) ── */
    const handleKill = () => {
      if (!currentTarget) return;
      const killDmg = extractDamage(combatEntry!.text);
      setEvent({
        type: combatEntry!.type === 'crit' ? 'crit' : 'kill',
        pos: currentTarget, id: combatEntry!.id, color: targetColor,
        dmgText: killDmg ?? undefined,
      });

      const killedIdx = targetIdx;
      const updatedDeadSet = new Set(deadSet);
      updatedDeadSet.add(killedIdx);

      // ── 합류 몬스터 승격 감지: "XXX이(가) 주 타겟으로!" 로그 ──
      const promotionLog = newEntries.find(
        e => e.type === 'battle' && e.text.includes('주 타겟으로'),
      );
      let promotedDotIdx = -1;
      if (promotionLog && joinedDotIdxs.size > 0) {
        const nameMatch = promotionLog.text.match(/^(.+?)이\(가\) 주 타겟으로/);
        const promotedName = nameMatch ? nameMatch[1] : null;
        // 이름 매칭으로 승격 닷 찾기
        if (promotedName) {
          for (const jIdx of joinedDotIdxs) {
            const d = dots[jIdx];
            if (d && tierMonsters[d.monsterIdx]?.name === promotedName) {
              promotedDotIdx = jIdx;
              break;
            }
          }
        }
        // 이름 매칭 실패 시 첫 번째 합류 닷 승격
        if (promotedDotIdx < 0) {
          const first = joinedDotIdxs.values().next();
          if (!first.done) promotedDotIdx = first.value;
        }
      }

      // 합류/접근 몬스터: 승격 닷만 살리고 나머지 죽임
      for (const jIdx of joinedDotIdxs) {
        if (jIdx !== promotedDotIdx) updatedDeadSet.add(jIdx);
      }
      for (const aIdx of approachingDotIdxsRef.current) updatedDeadSet.add(aIdx);
      setDeadSet(updatedDeadSet);
      setJoinedDotIdxs(new Set());
      approachingDotIdxsRef.current = new Set();
      setDotApproachDuration(new Map());

      if (promotedDotIdx >= 0) {
        // 승격: 합류 몬스터가 새 주 타겟 (이미 플레이어 근처 → 이동 불필요)
        setTargetIdx(promotedDotIdx);
      } else {
        // 승격 없음: 다음 가장 가까운 몬스터로 이동
        const nextI = pickNextAlive(dots, updatedDeadSet, killedIdx, playerPos);
        if (nextI >= 0) movePlayerToTarget(nextI);
      }

      // 리스폰 (승격된 닷은 updatedDeadSet에 없으므로 제외됨)
      const respawnIdxs = [...updatedDeadSet];
      const respawnPlayerPos = { ...playerPos }; // 캡처: 리스폰 시점의 유저 위치
      setTimeout(() => {
        const monsterCount = tierMonsters.length || 1;
        setDots(prev => {
          const next = [...prev];
          for (const idx of respawnIdxs) {
            if (idx < next.length) {
              next[idx] = { ...randomScatterPos(respawnPlayerPos), monsterIdx: randomMonsterIdx(monsterCount) };
            }
          }
          return next;
        });
        setTimeout(() => {
          setDeadSet(prev => {
            const next = new Set(prev);
            for (const idx of respawnIdxs) next.delete(idx);
            return next;
          });
        }, 50);
      }, RESPAWN_DELAY);

      setTimeout(() => setEvent(null), 900);
    };

    /** ── 다음 타겟 이동 헬퍼 (발견 시) ── */
    const handleDiscover = () => {
      const nextI = pickNextAlive(dots, deadSet, targetIdx, playerPos);
      if (nextI < 0) return;
      movePlayerToTarget(nextI);
    };

    // ── 이벤트 분기 (else-if 체인 → return 없음 → proximity 항상 실행) ──
    if (combatEntry && currentTarget) {
      if (isKillEvent) {
        // ── 킬 (일반킬 + 크리티컬킬) ──
        handleKill();
      } else if (combatEntry.type === 'encounter') {
        // ── 발견 (킬에 의한 발견은 handleKill에서 이미 처리됨) ──
        // 같은 배치에 킬이 있으면 스킵 (중복 방지)
        const hasKillInBatch = newEntries.some(e => e.type === 'kill' || (e.type === 'crit' && e.text.includes('처치')));
        if (!hasKillInBatch) {
          handleDiscover();
        }
      } else if (combatEntry.type === 'miss' && combatEntry.text.includes('빗나갔')) {
        setEvent({ type: 'miss', pos: currentTarget, id: combatEntry.id, color: targetColor });
        setTimeout(() => setEvent(null), 900);
      } else if (combatEntry.type === 'miss' && combatEntry.text.includes('회피')) {
        setEvent({ type: 'miss', pos: playerPos, id: combatEntry.id, dmgText: 'DODGE' });
        setTimeout(() => setEvent(null), 900);
      } else if (combatEntry.type === 'hit_taken') {
        const dmg = extractHitDamage(combatEntry.text);
        if (dmg) {
          setEvent({ type: 'hit_taken', pos: playerPos, id: combatEntry.id, dmgText: dmg });
          setTimeout(() => setEvent(null), 900);
        }
      } else if (combatEntry.type === 'crit') {
        // 크리티컬 (비킬) — 데미지만 표시
        const dmg = extractDamage(combatEntry.text);
        setEvent({ type: 'crit', pos: currentTarget, id: combatEntry.id, color: targetColor, dmgText: dmg ?? undefined });
        setTimeout(() => setEvent(null), 900);
      } else if (combatEntry.type === 'battle') {
        // 일반 공격 데미지
        const dmg = extractDamage(combatEntry.text);
        if (dmg) {
          setEvent({ type: 'damage', pos: currentTarget, id: combatEntry.id, color: targetColor, dmgText: dmg });
          setTimeout(() => setEvent(null), 900);
        }
      }
      // death: 아무것도 안 함
    }

    // ── 좌표 기반 선공 몬스터 감지: 5m 이내 → 접근 시작 (매 틱 항상 실행) ──
    if (isHunting && !deadSet.has(targetIdx)) {
      const AGGRO_RANGE_M = 5;
      for (let i = 0; i < dots.length; i++) {
        if (i === targetIdx || deadSet.has(i) || joinedDotIdxs.has(i) || approachingDotIdxsRef.current.has(i)) continue;

        const m = tierMonsters[dots[i].monsterIdx];
        if (!m?.aggressive) continue;

        const distM = calcDistM(dots[i], playerPos);
        if (distM > AGGRO_RANGE_M) continue;

        const actualDistM = Math.max(1, Math.round(distM));
        const success = startApproach(m.id, actualDistM);
        if (!success) continue;

        approachingDotIdxsRef.current.add(i);

        const moveSpeed = m.moveSpeed ?? 0.8;
        const approachMs = Math.max(300, Math.round(actualDistM * moveSpeed * 1000));

        setDotApproachDuration(prev => new Map(prev).set(i, approachMs));
        const dotIdx = i;
        setTimeout(() => {
          setDots(prev => {
            const next = [...prev];
            next[dotIdx] = { ...next[dotIdx], x: playerPos.x, y: playerPos.y };
            return next;
          });
        }, 50);
        setTimeout(() => {
          approachingDotIdxsRef.current.delete(dotIdx);
          setDotApproachDuration(prev => { const n = new Map(prev); n.delete(dotIdx); return n; });
        }, approachMs + 200);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combatLog.length, combatLog]);

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
        {/* 배경 그리드 */}
        <div
          style={{
            position: 'absolute', inset: 0,
            backgroundImage:
              'radial-gradient(circle, color-mix(in oklch, var(--text-mute) 6%, transparent) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            opacity: 0.35,
          }}
        />

        {/* 몬스터 점 — 종류별 색상 */}
        {dots.map((dot, i) => {
          const isDead = deadSet.has(i);
          const isCurrentTarget = i === targetIdx && !isDead;
          const isJoined = joinedDotIdxs.has(i) && !isDead;
          const isApproaching = dotApproachDuration.has(i) && !isDead;
          const dotColor = monsterColorMap.get(dot.monsterIdx) ?? '#ef5350';
          const approachMs = dotApproachDuration.get(i);
          const moveTrans = approachMs
            ? `left ${approachMs}ms ease-in-out, top ${approachMs}ms ease-in-out`
            : 'left 1.2s ease-in-out, top 1.2s ease-in-out';

          return (
            <div
              key={`m-${i}`}
              style={{
                position: 'absolute',
                left: `${dot.x}%`,
                top: `${dot.y}%`,
                transform: 'translate(-50%, -50%)',
                transition: isDead ? 'none' : moveTrans,
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
              {/* 닷 */}
              <div
                style={{
                  width: (isCurrentTarget || isJoined) ? 'var(--mm-dot-active)' : 'var(--mm-dot)',
                  height: (isCurrentTarget || isJoined) ? 'var(--mm-dot-active)' : 'var(--mm-dot)',
                  borderRadius: '50%',
                  background: dotColor,
                  opacity: isDead ? 0 : ((isCurrentTarget || isJoined) ? 1 : 0.5),
                  transform: `scale(${isDead ? 0 : 1})`,
                  transition: 'opacity 0.3s ease, transform 0.3s ease',
                  boxShadow: isCurrentTarget
                    ? `0 0 8px ${dotColor}`
                    : isJoined
                      ? `0 0 6px ${dotColor}`
                      : 'none',
                  animation: (isCurrentTarget || isJoined) && isHunting ? 'mmMonsterPulse 1s infinite' : 'none',
                }}
              />
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

        {/* 이동 화살표 + 거리/시간 */}
        {moveInfo && (() => {
          const lineColor = moveInfo.aggressive
            ? (moveInfo.monsterColor ?? '#ef5350')
            : playerDotColor;
          return (
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
              {/* 점선 경로 */}
              <line
                x1={`${moveInfo.from.x}%`}
                y1={`${moveInfo.from.y}%`}
                x2={`${moveInfo.to.x}%`}
                y2={`${moveInfo.to.y}%`}
                stroke={lineColor}
                strokeWidth={moveInfo.aggressive ? 1.5 : 1}
                strokeDasharray={moveInfo.aggressive ? '6 3' : '4 3'}
                opacity="0.6"
              />
              {/* 도착점 화살촉 */}
              <circle
                cx={`${moveInfo.to.x}%`}
                cy={`${moveInfo.to.y}%`}
                r="3"
                fill="none"
                stroke={lineColor}
                strokeWidth="1"
                opacity="0.5"
              />
              {/* 중간 라벨: 거리m · 시간s */}
              <text
                x={`${(moveInfo.from.x + moveInfo.to.x) / 2}%`}
                y={`${(moveInfo.from.y + moveInfo.to.y) / 2 - 2}%`}
                textAnchor="middle"
                fill={lineColor}
                fontSize="9"
                fontFamily="var(--font-mono)"
                fontWeight="700"
                opacity="0.8"
              >
                {moveInfo.aggressive ? '!' : ''}{moveInfo.distM}m · {(moveInfo.timeMs / 1000).toFixed(1)}s
              </text>
            </svg>
          );
        })()}

        {/* 유저 점 */}
        <div
          style={{
            position: 'absolute',
            left: `${playerPos.x}%`,
            top: `${playerPos.y}%`,
            transform: 'translate(-50%, -50%)',
            transition: `left ${moveDurationMs}ms ease, top ${moveDurationMs}ms ease`,
            zIndex: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            pointerEvents: 'none',
          }}
        >
          <div
            className={isPlatinum ? 'mm-platinum-dot' : undefined}
            style={{
              width: isPlatinum ? 'var(--mm-player-lg)' : 'var(--mm-player)',
              height: isPlatinum ? 'var(--mm-player-lg)' : 'var(--mm-player)',
              borderRadius: '50%',
              ...(isPlatinum ? {} : {
                background: playerDotColor,
                boxShadow: `0 0 ${level >= 75 ? 12 : 8}px ${playerDotColor}`,
                animation: isHunting ? 'mmPulse 1.5s infinite' : 'none',
              }),
            }}
          />
        </div>

        {/* 존 라벨 */}
        <span style={{ position: 'absolute', top: 8, left: 12, ...LABEL, fontSize: 'var(--fs-xs)', opacity: 0.5 }}>
          {zone.name}
        </span>

        {/* 몬스터 수 */}
        <span style={{ position: 'absolute', top: 8, right: 12, ...LABEL, fontSize: 'var(--fs-xs)', opacity: 0.5 }}>
          {VISIBLE_MONSTERS}m
        </span>
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
