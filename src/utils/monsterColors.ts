/* =========================================================
   MONSTER COLORS — 몬스터 닷 색상 팔레트

   인덱스 기반 고정 팔레트로 같은 방의 몬스터를
   확실히 구분할 수 있도록 설계.
   hue를 황금각(137.5°) 간격으로 분산 → 인접 인덱스 색 차이 극대화.

   사용처:
     - Minimap.tsx — 몬스터 닷 렌더링
     - ZoneSelectPanel.tsx — 몬스터 목록 범례
   ========================================================= */

const PALETTE_SIZE = 20;

/** 20색 고정 팔레트 (황금각 분산) */
export const MONSTER_PALETTE: string[] = (() => {
  const colors: string[] = [];
  for (let i = 0; i < PALETTE_SIZE; i++) {
    const hue = Math.round((i * 137.5) % 360);
    colors.push(`hsl(${hue}, 75%, 58%)`);
  }
  return colors;
})();

/** 몬스터 인덱스 → 팔레트 색상 (tierMonsters 배열 인덱스 기반) */
export function monsterIndexToColor(idx: number): string {
  return MONSTER_PALETTE[idx % PALETTE_SIZE];
}
