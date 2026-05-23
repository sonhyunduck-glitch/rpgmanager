/* =========================================================
   RANDOM — 암호학적 보안 난수 생성기 (CSPRNG)

   게임 내 모든 확률 판정(전투, 강화, 드롭 등)에 사용.
   Math.random() 대비: 예측 불가능, 분포 균일, 조작 방지.

   버퍼 방식으로 성능 최적화:
   1,024개 난수를 한번에 생성 → 소진 시 리필.
   전투 틱당 ~25회 기준 약 40틱(20초)마다 리필 1회.
   ========================================================= */

const BUFFER_SIZE = 1024;
const _buf = new Uint32Array(BUFFER_SIZE);
let _idx = BUFFER_SIZE; // 첫 호출 시 즉시 리필

/** 내부: 버퍼 리필 */
function _refill(): void {
  crypto.getRandomValues(_buf);
  _idx = 0;
}

/** 내부: Uint32 값 하나 꺼내기 */
function _nextU32(): number {
  if (_idx >= BUFFER_SIZE) _refill();
  return _buf[_idx++];
}

/**
 * Math.random() 대체 — [0, 1) 범위 부동소수점
 *
 * 사용 예: secureRandom() < 0.33  (33% 확률 판정)
 */
export function secureRandom(): number {
  return _nextU32() / 0x100000000; // 2^32
}

/**
 * 정수 범위 [min, max] (양 끝 포함)
 *
 * 사용 예: secureRandomInt(1, 20)  → D20 주사위
 *          secureRandomInt(1, 6)   → D6 주사위
 *          secureRandomInt(0, 100) → 백분율 판정
 */
export function secureRandomInt(min: number, max: number): number {
  const range = max - min + 1;
  return min + (_nextU32() % range);
}

/**
 * 백분율 확률 판정
 *
 * 사용 예: secureChance(33)  → 33% 확률로 true
 *          secureChance(100) → 항상 true
 *          secureChance(0)   → 항상 false
 */
export function secureChance(percent: number): boolean {
  if (percent >= 100) return true;
  if (percent <= 0) return false;
  return secureRandomInt(1, 100) <= percent;
}
