/* =========================================================
   SHOP ITEM DATA — L1J etc_items.csv + item_rates.csv 기반 자동 생성
   생성일: 2026-05-23
   소스: data/etc_items.csv (2403개) + data/item_rates.csv (3528개)
   총 구매 가능 아이템: 960개
   ⚠️ 이 파일은 scripts/importShopItems.mjs로 자동 생성됩니다.
   ========================================================= */

// ── 상점 기타 아이템 카테고리 ──
export type ShopItemCategory = 'material';

export const SHOP_CATEGORY_NAMES: Record<ShopItemCategory, string> = {
  material: '재료',
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
  { id: 'e_40319', name: '정령옥', buyPrice: 300, sellPrice: 150, category: 'material' },
  { id: 'e_40318', name: '마력의 돌', buyPrice: 400, sellPrice: 200, category: 'material' },
  { id: 'e_40744', name: '은 화살', buyPrice: 30, sellPrice: 1, category: 'material' },
];

// ── 카테고리별 필터 ──
export function getShopItemsByCategory(category: ShopItemCategory): ShopEtcItem[] {
  return SHOP_ETC_ITEMS.filter(item => item.category === category);
}

// ── 카테고리별 아이템 수 ──
export const SHOP_CATEGORY_COUNTS: Record<ShopItemCategory, number> = {
  material: 3,
};
