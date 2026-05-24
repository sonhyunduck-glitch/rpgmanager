import fs from 'fs';

// 유지할 재료 ID
const keepMaterialIds = new Set([
  'e_40319',  // 정령옥
  'e_40318',  // 마력의 돌
]);

// ── 1. shopItemData.ts에서 삭제할 ID 수집 ──
let shop = fs.readFileSync('src/data/shopItemData.ts', 'utf8');

const delIds = [];

// material 카테고리에서 유지 대상 제외하고 삭제
const matRe = /\{ id: '(e_\d+)',.*?category: 'material' \}/g;
let m;
while ((m = matRe.exec(shop)) !== null) {
  if (!keepMaterialIds.has(m[1])) delIds.push(m[1]);
}

// misc 카테고리 전체 삭제
const miscRe = /\{ id: '(e_\d+)',.*?category: 'misc' \}/g;
while ((m = miscRe.exec(shop)) !== null) {
  delIds.push(m[1]);
}

console.log(`삭제 대상 ID: ${delIds.length}개 (material ${delIds.filter(id => !delIds.includes(id)).length}, misc 포함)`);

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
  const re1 = new RegExp(`^\\s+'${id}':.+\\n`, 'm');
  if (drop.match(re1)) { etcRemoved++; drop = drop.replace(re1, ''); }

  const re2 = new RegExp(`\\['${id}',[\\d.e+-]+,\\d+,\\d+\\],?`, 'g');
  const m2 = drop.match(re2);
  if (m2) { dropRemoved += m2.length; drop = drop.replace(re2, ''); }
}

drop = drop.replace(/,\s*\]/g, ']');
fs.writeFileSync('src/data/dropData.ts', drop, 'utf8');
console.log(`dropData.ts: ETC_ITEMS ${etcRemoved}개, MONSTER_DROPS ${dropRemoved}개 삭제`);

console.log(`\n유지: 정령옥(e_40319), 마력의돌(e_40318)`);
console.log('완료!');
