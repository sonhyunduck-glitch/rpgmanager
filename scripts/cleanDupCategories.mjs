import fs from 'fs';

// ── shopItemData.ts에서 potion/scroll 카테고리 전체 삭제 ──
let shop = fs.readFileSync('src/data/shopItemData.ts', 'utf8');

// potion 카테고리 ID 수집
const potionRe = /\{ id: '(e_\d+)',.*?category: 'potion' \}/g;
const scrollRe2 = /\{ id: '(e_\d+)',.*?category: 'scroll' \}/g;
const delIds = [];
let m;
while ((m = potionRe.exec(shop)) !== null) delIds.push(m[1]);
while ((m = scrollRe2.exec(shop)) !== null) delIds.push(m[1]);

console.log(`삭제 대상: potion+scroll ${delIds.length}개`);

// shopItemData.ts에서 삭제
let shopRemoved = 0;
for (const id of delIds) {
  const re = new RegExp(`^\\s+\\{ id: '${id}',.*\\n`, 'm');
  if (shop.match(re)) { shopRemoved++; shop = shop.replace(re, ''); }
}
fs.writeFileSync('src/data/shopItemData.ts', shop, 'utf8');
console.log(`shopItemData.ts: ${shopRemoved}개 항목 삭제`);

// ── dropData.ts에서 해당 ID들의 ETC_ITEMS + MONSTER_DROPS 삭제 ──
let drop = fs.readFileSync('src/data/dropData.ts', 'utf8');
let etcRemoved = 0, dropRemoved = 0;

for (const id of delIds) {
  const re1 = new RegExp(`^\\s+'${id}':.+\\n`, 'm');
  if (drop.match(re1)) { etcRemoved++; drop = drop.replace(re1, ''); }

  const re2 = new RegExp(`\\['${id}',[\\d.e+-]+,\\d+,\\d+\\],?`, 'g');
  const m2 = drop.match(re2);
  if (m2) { dropRemoved += m2.length; drop = drop.replace(re2, ''); }
}

drop = drop.replace(/,\s*\]/g, ']');
fs.writeFileSync('src/data/dropData.ts', drop, 'utf8');
console.log(`dropData.ts: ETC_ITEMS ${etcRemoved}개, MONSTER_DROPS ${dropRemoved}개 삭제`);

console.log('\n완료!');
