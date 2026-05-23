#!/usr/bin/env node
/* =========================================================
   importShopItems.mjs — L1J etc_items.csv + item_rates.csv + shops.csv
                         → shopItemData.ts 변환

   Usage: node scripts/importShopItems.mjs
   Output: src/data/shopItemData.ts (SHOP_ETC_ITEMS)

   etc_items.csv에서 아이템 정보, item_rates.csv에서 가격,
   shops.csv에서 상점 판매 여부를 교차 확인하여
   구매 가능한 기타 아이템 목록 생성.
   ========================================================= */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const SRC  = path.join(__dirname, '..', 'src', 'data');
const OUT  = path.join(SRC, 'shopItemData.ts');

// ══════════════════════════════════════════════
// 1. CSV 파싱
// ══════════════════════════════════════════════

function parseCSV(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = (vals[i] ?? '').trim());
    return obj;
  });
}

// ══════════════════════════════════════════════
// 2. 데이터 로드
// ══════════════════════════════════════════════

console.log('=== L1J 상점 아이템 임포트 ===\n');

// 2a. etc_items.csv: 아이템 정보
const etcItems = parseCSV(path.join(DATA, 'etc_items.csv'));
console.log(`etc_items.csv: ${etcItems.length}개`);

// Map<itemId(number), { name, itemType, useType }>
const etcMap = new Map();
for (const row of etcItems) {
  const id = parseInt(row.id);
  if (isNaN(id)) continue;
  etcMap.set(id, {
    name: row.name,
    itemType: row.item_type,
    useType: row.use_type,
    stackable: row.stackable === '1',
  });
}

// 2b. item_rates.csv: 가격 정보
const itemRates = parseCSV(path.join(DATA, 'item_rates.csv'));
console.log(`item_rates.csv: ${itemRates.length}개`);

// Map<itemId(number), { sellingPrice, purchasingPrice }>
const priceMap = new Map();
for (const row of itemRates) {
  const id = parseInt(row.item_id);
  if (isNaN(id)) continue;
  priceMap.set(id, {
    sellingPrice: parseInt(row.selling_price) || -1,
    purchasingPrice: parseInt(row.purchasing_price) || -1,
  });
}

// 2c. shops.csv: 상점 판매 확인
const shops = parseCSV(path.join(DATA, 'shops.csv'));
console.log(`shops.csv: ${shops.length}개\n`);

// Set<itemId> — 어떤 NPC든 판매하는 아이템
const shopItemIds = new Set();
for (const row of shops) {
  const id = parseInt(row.item_id);
  if (!isNaN(id) && id >= 40000) {
    shopItemIds.add(id);
  }
}

// ══════════════════════════════════════════════
// 3. 교차 필터링 — 구매 가능 아이템 추출
// ══════════════════════════════════════════════

// item_type → 게임 카테고리 매핑
function mapCategory(itemType) {
  switch (itemType) {
    case 'potion':        return 'potion';
    case 'scroll':        return 'scroll';
    case 'material':      return 'material';
    case 'food':          return 'food';
    case 'spellbook':     return 'spellbook';
    case 'spellscroll':   return 'spellbook';  // 마법 관련 → 마법서로 통합
    case 'spellicon':     return 'spellbook';
    case 'spellwand':     return 'spellbook';
    case 'gem':           return 'gem';
    case 'firecracker':   return 'misc';
    case 'light':         return 'misc';
    case 'unique_scroll': return 'scroll';
    case 'treasure_box':  return 'misc';
    case 'magic_doll':    return 'misc';
    default:              return 'misc';
  }
}

const result = [];
let skippedNoPrice = 0;
let skippedNotInShop = 0;
let skippedNoInfo = 0;

for (const [itemId, info] of etcMap.entries()) {
  // 상점에 있는지 확인
  if (!shopItemIds.has(itemId)) {
    skippedNotInShop++;
    continue;
  }

  // 가격 확인
  // ⚠️ item_rates.csv 컬럼 의미 (NPC 관점):
  //   selling_price  = NPC가 파는 가격 = 플레이어 구매가 (buyPrice)
  //   purchasing_price = NPC가 사는 가격 = 플레이어 판매가 (sellPrice)
  const price = priceMap.get(itemId);
  if (!price || price.sellingPrice <= 0) {
    skippedNoPrice++;
    continue;
  }

  result.push({
    id: `e_${itemId}`,
    gameId: itemId,
    name: info.name,
    buyPrice: price.sellingPrice,            // NPC 판매가 = 플레이어 구매가
    sellPrice: price.purchasingPrice > 0 ? price.purchasingPrice : -1,  // NPC 구매가 = 플레이어 판매가
    category: mapCategory(info.itemType),
    itemType: info.itemType,
    useType: info.useType,
  });
}

// buyPrice 기준 정렬 (카테고리 내)
result.sort((a, b) => {
  if (a.category !== b.category) return a.category.localeCompare(b.category);
  return a.buyPrice - b.buyPrice;
});

console.log(`=== 결과 ===`);
console.log(`총 구매 가능 아이템: ${result.length}개`);
console.log(`상점 미등록 스킵: ${skippedNotInShop}개`);
console.log(`가격 없음 스킵: ${skippedNoPrice}개`);
console.log(`정보 없음 스킵: ${skippedNoInfo}개\n`);

// 카테고리별 통계
const catStats = {};
for (const item of result) {
  catStats[item.category] = (catStats[item.category] || 0) + 1;
}
console.log('카테고리별:');
for (const [cat, cnt] of Object.entries(catStats).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat}: ${cnt}개`);
}

// ══════════════════════════════════════════════
// 4. shopItemData.ts 생성
// ══════════════════════════════════════════════

const categories = ['potion', 'scroll', 'material', 'food', 'spellbook', 'gem', 'misc'];
const categoryNameKo = {
  potion: '물약',
  scroll: '주문서',
  material: '재료',
  food: '음식',
  spellbook: '마법서',
  gem: '보석',
  misc: '기타',
};

let ts = `/* =========================================================
   SHOP ITEM DATA — L1J etc_items.csv + item_rates.csv 기반 자동 생성
   생성일: ${new Date().toISOString().split('T')[0]}
   소스: data/etc_items.csv (${etcItems.length}개) + data/item_rates.csv (${itemRates.length}개)
   총 구매 가능 아이템: ${result.length}개
   ⚠️ 이 파일은 scripts/importShopItems.mjs로 자동 생성됩니다.
   ========================================================= */

// ── 상점 기타 아이템 카테고리 ──
export type ShopItemCategory = ${categories.map(c => `'${c}'`).join(' | ')};

export const SHOP_CATEGORY_NAMES: Record<ShopItemCategory, string> = {
${categories.map(c => `  ${c}: '${categoryNameKo[c]}',`).join('\n')}
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
export const SHOP_ETC_ITEMS: ShopEtcItem[] = [\n`;

for (const item of result) {
  const sellStr = item.sellPrice === -1 ? '-1' : item.sellPrice.toString();
  ts += `  { id: '${item.id}', name: '${item.name.replace(/'/g, "\\'")}', buyPrice: ${item.buyPrice}, sellPrice: ${sellStr}, category: '${item.category}' },\n`;
}

ts += `];\n\n`;

// 카테고리별 필터 헬퍼
ts += `// ── 카테고리별 필터 ──
export function getShopItemsByCategory(category: ShopItemCategory): ShopEtcItem[] {
  return SHOP_ETC_ITEMS.filter(item => item.category === category);
}

// ── 카테고리별 아이템 수 ──
export const SHOP_CATEGORY_COUNTS: Record<ShopItemCategory, number> = {
${categories.map(c => `  ${c}: ${catStats[c] || 0},`).join('\n')}
};
`;

fs.writeFileSync(OUT, ts, 'utf8');
console.log(`\n✅ ${OUT} 생성 완료 (${result.length}개 아이템)`);

// ══════════════════════════════════════════════
// 5. dropData.ts sellPrice L1J 원본으로 업데이트
// ══════════════════════════════════════════════
// ⚠️ sellPrice = purchasing_price (NPC가 플레이어에게서 사는 가격)

const dropDataPath = path.join(SRC, 'dropData.ts');
let dropDataText = fs.readFileSync(dropDataPath, 'utf8');

let mismatchCount = 0;
let fixedCount = 0;
const mismatches = [];

// ETC_ITEMS에서 id와 sellPrice 추출하여 L1J purchasing_price와 비교
const etcItemRegex = /'e_(\d+)':\s*\{[^}]*sellPrice:\s*(\d+)/g;
let match;
while ((match = etcItemRegex.exec(dropDataText)) !== null) {
  const itemId = parseInt(match[1]);
  const currentSellPrice = parseInt(match[2]);
  const ratePrice = priceMap.get(itemId);
  // purchasing_price = NPC 구매가 = 플레이어 판매가 (sellPrice)
  if (ratePrice && ratePrice.purchasingPrice > 0 && ratePrice.purchasingPrice !== currentSellPrice) {
    mismatchCount++;
    if (mismatches.length < 10) {
      mismatches.push({
        id: itemId,
        current: currentSellPrice,
        l1j: ratePrice.purchasingPrice,
      });
    }
  }
}

if (mismatchCount > 0) {
  console.log(`\n⚠️ dropData.ts sellPrice 불일치: ${mismatchCount}건 → 자동 수정 중...`);
  console.log('  샘플 (처음 10건):');
  for (const m of mismatches) {
    console.log(`    e_${m.id}: 현재 ${m.current} → L1J ${m.l1j}`);
  }

  // 자동 수정: sellPrice를 L1J purchasing_price로 교체
  dropDataText = dropDataText.replace(
    /'e_(\d+)':\s*\{\s*id:\s*'e_\d+',\s*name:\s*'[^']*',\s*sellPrice:\s*(\d+)\s*\}/g,
    (fullMatch, idStr, priceStr) => {
      const itemId = parseInt(idStr);
      const ratePrice = priceMap.get(itemId);
      if (ratePrice && ratePrice.purchasingPrice > 0) {
        const newPrice = ratePrice.purchasingPrice;
        if (parseInt(priceStr) !== newPrice) {
          fixedCount++;
          return fullMatch.replace(`sellPrice: ${priceStr}`, `sellPrice: ${newPrice}`);
        }
      }
      return fullMatch;
    }
  );

  fs.writeFileSync(dropDataPath, dropDataText, 'utf8');
  console.log(`  ✅ ${fixedCount}건 수정 완료`);
} else {
  console.log('\n✅ dropData.ts sellPrice 전체 일치');
}
