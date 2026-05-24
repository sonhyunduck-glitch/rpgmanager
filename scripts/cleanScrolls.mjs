import fs from 'fs';

// 유지할 주문서 ID (7개)
const keepIds = new Set([
  'e_40074',  // 갑옷 마법 주문서 (일반)
  'e_240074', // 갑옷 마법 주문서 (축복)
  'e_140074', // 갑옷 마법 주문서 (저주)
  'e_40087',  // 무기 마법 주문서 (일반)
  'e_240087', // 무기 마법 주문서 (축복)
  'e_140087', // 무기 마법 주문서 (저주)
  'e_40088',  // 변신 주문서
]);

// ── 1. shopItemData.ts에서 삭제할 ID 수집 ──
let shop = fs.readFileSync('src/data/shopItemData.ts', 'utf8');
const scrollRe = /\{ id: '(e_\d+)',.*?category: 'scroll' \}/g;
const delIds = [];
let m;
while ((m = scrollRe.exec(shop)) !== null) {
  if (!keepIds.has(m[1])) delIds.push(m[1]);
}
console.log(`삭제 대상 scroll ID: ${delIds.length}개`);
console.log(`유지 scroll ID: ${keepIds.size}개`);

// ── 2. shopItemData.ts에서 삭제 ──
let shopRemoved = 0;
for (const id of delIds) {
  const re = new RegExp(`^\\s+\\{ id: '${id}',.*\\n`, 'm');
  if (shop.match(re)) { shopRemoved++; shop = shop.replace(re, ''); }
}
fs.writeFileSync('src/data/shopItemData.ts', shop, 'utf8');
console.log(`shopItemData.ts: ${shopRemoved}개 항목 삭제`);

// ── 3. dropData.ts에서 ETC_ITEMS + MONSTER_DROPS 삭제 ──
let drop = fs.readFileSync('src/data/dropData.ts', 'utf8');
let etcRemoved = 0, dropRemoved = 0;

for (const id of delIds) {
  // ETC_ITEMS에서 삭제
  const re1 = new RegExp(`^\\s+'${id}':.+\\n`, 'm');
  if (drop.match(re1)) { etcRemoved++; drop = drop.replace(re1, ''); }

  // MONSTER_DROPS에서 삭제
  const re2 = new RegExp(`\\['${id}',[\\d.e+-]+,\\d+,\\d+\\],?`, 'g');
  const m2 = drop.match(re2);
  if (m2) { dropRemoved += m2.length; drop = drop.replace(re2, ''); }
}

// 후행 콤마 정리
drop = drop.replace(/,\s*\]/g, ']');

fs.writeFileSync('src/data/dropData.ts', drop, 'utf8');
console.log(`dropData.ts: ETC_ITEMS ${etcRemoved}개, MONSTER_DROPS ${dropRemoved}개 삭제`);

console.log('\n완료!');
