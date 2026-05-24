/* =========================================================
   SHOP ITEM DATA — L1J etc_items.csv + item_rates.csv 기반 자동 생성
   생성일: 2026-05-23
   소스: data/etc_items.csv (2403개) + data/item_rates.csv (3528개)
   총 구매 가능 아이템: 960개
   ⚠️ 이 파일은 scripts/importShopItems.mjs로 자동 생성됩니다.
   ========================================================= */

// ── 상점 기타 아이템 카테고리 ──
export type ShopItemCategory = 'material' | 'food' | 'gem';

export const SHOP_CATEGORY_NAMES: Record<ShopItemCategory, string> = {
  material: '재료',
  food: '음식',
  gem: '보석',
};

// ── 상점 기타 아이템 인터페이스 ──
export interface ShopEtcItem {
  id: string;               // e_40010 형식
  name: string;             // 한글 이름
  buyPrice: number;         // NPC 구매가
  sellPrice: number;        // NPC 판매가 (-1 = 판매 불가)
  category: ShopItemCategory;
}

// ── 전체 구매 가능 아이템 목록 ──
export const SHOP_ETC_ITEMS: ShopEtcItem[] = [
  { id: 'e_40056', name: '고기', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_41285', name: '환상의 괴물눈 스테이크', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_41286', name: '환상의 곰고기 구이', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_41287', name: '환상의 씨호떡', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_41288', name: '환상의 개미다리 치즈구이', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_41289', name: '환상의 과일 샐러드', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_41290', name: '환상의 과일 탕수육', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_41291', name: '환상의 멧돼지 꼬치 구이', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_41292', name: '환상의 버섯 스프', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_49057', name: '환상의 캐비어 카나페', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_49058', name: '환상의 악어 스테이크', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_49059', name: '환상의 터틀드래곤 과자', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_49060', name: '환상의 키위 패롯 구이', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_49061', name: '환상의 스콜피온 구이', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_49062', name: '환상의 일렉카둠 스튜', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_49063', name: '환상의 거미다리 꼬치 구이', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_49064', name: '환상의 크랩살 스프', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_49252', name: '환상의 크러스트 시안의 하사 미소', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_49253', name: '환상의 그리폰 구이', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_49254', name: '환상의 코카 트리스 스테이크', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_49255', name: '환상의 터틀 드래곤 구이', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_49256', name: '환상의 레서 드래곤의 닭 날개', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_49257', name: '환상의 드레이크 구이', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_49258', name: '환상의 심해어 스튜', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_49259', name: '환상의 바실리스크 알 스프', buyPrice: 1, sellPrice: -1, category: 'food' },
  { id: 'e_40059', name: '달걀', buyPrice: 4, sellPrice: 2, category: 'food' },
  { id: 'e_40060', name: '당근', buyPrice: 6, sellPrice: 3, category: 'food' },
  { id: 'e_40061', name: '레몬', buyPrice: 6, sellPrice: 3, category: 'food' },
  { id: 'e_40062', name: '바나나', buyPrice: 6, sellPrice: 3, category: 'food' },
  { id: 'e_40064', name: '사과', buyPrice: 6, sellPrice: 3, category: 'food' },
  { id: 'e_40069', name: '오렌지', buyPrice: 6, sellPrice: 3, category: 'food' },
  { id: 'e_41266', name: '토마토', buyPrice: 9, sellPrice: 4, category: 'food' },
  { id: 'e_40072', name: '팬케익', buyPrice: 20, sellPrice: 10, category: 'food' },
  { id: 'e_41264', name: '밀가루', buyPrice: 24, sellPrice: 12, category: 'food' },
  { id: 'e_50572', name: '타이거의 먹이', buyPrice: 50, sellPrice: 25, category: 'food' },
  { id: 'e_50573', name: '진돗개의 먹이', buyPrice: 50, sellPrice: 25, category: 'food' },
  { id: 'e_40057', name: '괴물 눈 고기', buyPrice: 200, sellPrice: 100, category: 'food' },
  { id: 'e_50574', name: '특별한 타이거의 먹이', buyPrice: 100000, sellPrice: 50000, category: 'food' },
  { id: 'e_50575', name: '특별한 진돗개의 먹이', buyPrice: 100000, sellPrice: 50000, category: 'food' },
  { id: 'e_40319', name: '정령옥', buyPrice: 300, sellPrice: 150, category: 'material' },
  { id: 'e_40318', name: '마력의 돌', buyPrice: 400, sellPrice: 200, category: 'material' },
];

// ── 카테고리별 필터 ──
export function getShopItemsByCategory(category: ShopItemCategory): ShopEtcItem[] {
  return SHOP_ETC_ITEMS.filter(item => item.category === category);
}

// ── 카테고리별 아이템 수 ──
export const SHOP_CATEGORY_COUNTS: Record<ShopItemCategory, number> = {
  material: 2,
  food: 39,
  gem: 0,
};
