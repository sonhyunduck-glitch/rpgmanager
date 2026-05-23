#!/usr/bin/env node
/* =========================================================
   importDrops.mjs — L1J drop_items.csv → dropData.ts 변환

   Usage: node scripts/importDrops.mjs
   Output: src/data/dropData.ts (MONSTER_DROPS + ETC_ITEMS)
   ========================================================= */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const OUT  = path.join(__dirname, '..', 'src', 'data', 'dropData.ts');

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
// 2. 소스 데이터 로드
// ══════════════════════════════════════════════

const weapons  = parseCSV(path.join(DATA, 'weapons.csv'));
const armors   = parseCSV(path.join(DATA, 'armors.csv'));
const etcItems = parseCSV(path.join(DATA, 'etc_items.csv'));
const dropRows = parseCSV(path.join(DATA, 'drop_items.csv'));

console.log(`Loaded: ${weapons.length} weapons, ${armors.length} armors, ${etcItems.length} etc_items, ${dropRows.length} drop entries`);

// ══════════════════════════════════════════════
// 3. L1J item_id → name 매핑 (전체)
// ══════════════════════════════════════════════

/** @type {Map<number, {name: string, category: 'weapon'|'armor'|'etc'}>} */
const itemIdToInfo = new Map();

for (const w of weapons) {
  const id = parseInt(w.id);
  if (!isNaN(id)) itemIdToInfo.set(id, { name: w.name, category: 'weapon' });
}
for (const a of armors) {
  const id = parseInt(a.id);
  if (!isNaN(id)) itemIdToInfo.set(id, { name: a.name, category: 'armor' });
}
for (const e of etcItems) {
  const id = parseInt(e.id);
  if (!isNaN(id)) itemIdToInfo.set(id, { name: e.name, category: 'etc', itemType: e.item_type });
}

// ══════════════════════════════════════════════
// 4. Hand-curated name → gameId 매핑
// ══════════════════════════════════════════════

// gameData.ts의 HAND_CURATED_TEMPLATES + MATERIALS에서 추출
// Korean name → gameId
const NAME_TO_GAME_ID = new Map([
  // ── 무기 ──
  ['메일 브레이커', 'mail_breaker'],
  ['은검', 'silver_sword'],
  ['은장검', 'silver_long_sword'],
  ['다마스커스 검', 'damascus_sword'],
  ['일본도', 'katana'],
  ['레이피어', 'rapier'],
  ['싸울아비 장검', 'oriharukon_sword'],
  ['데스나이트의 불검', 'dk_flame_sword'],
  ['고대의 검', 'ancient_sword'],
  ['무관의 양손검', 'duke_two_hand'],
  ['드래곤 슬레이어', 'dragon_slayer'],
  ['고대의 대검', 'ancient_great_sword'],
  // 활
  ['나무 활', 'wooden_bow'],
  ['롱 보우', 'long_bow'],
  ['요정 활', 'elven_bow'],
  ['고대 정령의 활', 'ancient_elven_bow'],
  // 지팡이
  ['참나무 지팡이', 'oak_staff'],
  ['미스릴 지팡이', 'mithril_staff'],
  ['고대의 지팡이', 'ancient_staff'],
  // 티셔츠
  ['티셔츠', 'tshirt'],
  // ── 갑옷 ──
  ['가죽조끼', 'leather_vest'],
  ['가죽 갑옷', 'leather_armor'],
  ['오크족 고리 갑옷', 'orc_ring_mail'],
  ['징박은 가죽조끼', 'studded_vest'],
  ['무명 로브', 'nameless_robe'],
  ['고리 갑옷', 'ring_mail'],
  ['징박힌 가죽 갑옷', 'studded_leather_armor'],
  ['벨트달린 가죽조끼', 'belted_vest'],
  ['나무 갑옷', 'wooden_armor'],
  ['라스타바드 레더 아머', 'lastabad_leather'],
  ['비늘 갑옷', 'scale_armor'],
  ['오크족 사슬 갑옷', 'orc_chain_armor'],
  ['다크 포레스터의 갑옷', 'dark_forester_armor'],
  ['라스타바드 징박힌 레더 아머', 'lastabad_studded'],
  ['요정족 흉갑', 'elven_breastplate'],
  ['사슬 갑옷', 'chain_armor'],
  ['마법 방어 사슬 갑옷', 'mr_chain_armor'],
  ['뼈갑옷', 'bone_armor'],
  ['푸른 해적 가죽갑옷', 'blue_pirate_armor'],
  ['요정족 사슬 갑옷', 'elven_chain_armor'],
  ['띠 갑옷', 'band_armor'],
  ['데몬의 갑옷', 'demon_armor'],
  ['중 비늘 갑옷', 'heavy_scale_armor'],
  ['청동 판금 갑옷', 'bronze_plate'],
  ['요정족 판금 갑옷', 'elven_plate'],
  ['데스나이트의 갑옷', 'dk_armor'],
  ['강철 판금 갑옷', 'steel_plate_armor'],
  ['판금 갑옷', 'plate_armor'],
  ['커츠의 갑옷', 'kurtz_armor'],
  ['환상의 갑옷', 'phantom_armor'],
  ['마령군왕의 로브', 'demon_lord_robe'],
  ['수정 갑옷', 'crystal_armor'],
  ['수룡 비늘 갑옷', 'water_dragon_armor'],
  ['지룡 비늘 갑옷', 'earth_dragon_armor'],
  ['풍룡 비늘 갑옷', 'wind_dragon_armor'],
  ['화룡 비늘 갑옷', 'fire_dragon_armor'],
  // ── 투구 ──
  ['가죽모자', 'leather_hat'],
  ['가죽투구', 'leather_helmet'],
  ['강철 면갑', 'steel_helm'],
  ['난쟁이족 철 투구', 'dwarf_iron_helm'],
  ['데몬의 투구', 'demon_helm'],
  ['데스나이트의 투구', 'dk_helmet'],
  ['마법 방어 투구', 'mr_helm'],
  ['무관의 투구', 'mugwan_helm'],
  ['바란카의 투구', 'baranka_helm'],
  ['붉은 기사의 두건', 'red_knight_hood'],
  ['오크족 투구', 'orc_helm'],
  ['징박은 가죽모자', 'studded_leather_hat'],
  ['커츠의 투구', 'kurtz_helmet'],
  ['투구', 'basic_helm'],
  ['푸른 해적 두건', 'blue_pirate_hood'],
  ['해골투구', 'skull_helm'],
  // ── 망토 ──
  ['오크족 망토', 'orc_cloak'],
  ['난쟁이족 망토', 'dwarf_cloak'],
  ['뱀파이어의 망토', 'vampire_cloak'],
  ['기름 망토', 'oil_cloak'],
  ['요정족 망토', 'elven_cloak'],
  ['마법 망토', 'magic_cloak'],
  ['늑대가죽 망토', 'wolf_cloak'],
  ['아덴 기사단의 망토', 'aden_cloak'],
  ['블랙 티거 가죽 망토', 'black_tiger_cloak'],
  ['대지의 망토', 'earth_cloak'],
  ['물결의 망토', 'water_cloak'],
  ['바람의 망토', 'wind_cloak'],
  ['열화의 망토', 'fire_cloak'],
  ['혼돈의 망토', 'chaos_cloak'],
  ['보호 망토', 'protection_cloak'],
  ['거대 여왕 개미의 금빛 날개', 'queen_ant_wing'],
  ['명법군왕의 망토', 'demon_lord_cloak'],
  ['발록의 핏빛 망토', 'balrog_cloak'],
  // ── 장갑 ──
  ['장갑', 'basic_gloves'],
  ['가죽 장갑', 'leather_gloves'],
  ['빙령의 장갑', 'ice_gloves'],
  ['암령의 장갑', 'shadow_gloves'],
  ['염령의 장갑', 'flame_gloves'],
  ['풍령의 장갑', 'wind_gloves'],
  ['파워 글로브', 'power_glove'],
  ['강철 장갑', 'steel_gloves'],
  ['설인 장갑', 'yeti_gloves'],
  ['푸른 해적 장갑', 'pirate_gloves'],
  ['데몬의 장갑', 'demon_gloves'],
  ['데스나이트의 장갑', 'dk_gloves'],
  ['커츠의 장갑', 'kurtz_gloves'],
  ['죽음의 비늘', 'death_scale'],
  ['혼돈의 손길', 'chaos_touch'],
  ['암살군왕의 장갑', 'assassin_gloves'],
  // ── 부츠 ──
  ['가죽샌달', 'leather_sandals'],
  ['징박은 가죽샌달', 'studded_sandals'],
  ['짧은 부츠', 'short_boots'],
  ['부츠', 'boots'],
  ['가죽부츠', 'leather_boots'],
  ['라스타바드 부츠', 'lastabad_boots'],
  ['푸른 해적 부츠', 'pirate_boots'],
  ['강철 부츠', 'steel_boots'],
  ['데몬의 부츠', 'demon_boots'],
  ['데스나이트의 부츠', 'dk_boots'],
  ['바란카의 부츠', 'baranka_boots'],
  ['커츠의 부츠', 'kurtz_boots'],
  ['마수군왕의 부츠', 'beast_lord_boots'],
  // ── 방패 ──
  ['작은 방패', 'small_shield'],
  ['가죽방패', 'leather_shield'],
  ['나무방패', 'wooden_shield'],
  ['우럭하이 방패', 'orc_shield'],
  ['난쟁이족 둥근 방패', 'dwarf_shield'],
  ['징박은 가죽방패', 'studded_shield'],
  ['큰 방패', 'large_shield'],
  ['메두사 방패', 'medusa_shield'],
  ['강철 방패', 'steel_shield'],
  ['골각방패', 'gollack_shield'],
  ['에바의 방패', 'eva_shield'],
  // ── 목걸이 ──
  ['낡은 완력의 목걸이', 'old_str_necklace'],
  ['낡은 민첩의 목걸이', 'old_dex_necklace'],
  ['낡은 지혜의 목걸이', 'old_wis_necklace'],
  ['낡은 체력의 목걸이', 'old_con_necklace'],
  ['완력의 목걸이', 'power_necklace'],
  ['민첩의 목걸이', 'dex_necklace'],
  ['지혜의 목걸이', 'wis_necklace'],
  ['체력의 목걸이', 'health_necklace'],
  ['오크 투사의 목걸이', 'orc_warrior_necklace'],
  ['장로의 목걸이', 'elder_necklace'],
  ['항마의 목걸이', 'antimagic_necklace'],
  ['수호의 목걸이', 'guardian_necklace'],
  // ── 반지 ──
  ['장로의 반지', 'elder_ring'],
  ['항마의 반지', 'antimagic_ring'],
  ['수령의 반지', 'water_ring'],
  ['멸마의 반지', 'banish_ring'],
  ['수호의 반지', 'guardian_ring'],
  // ── 벨트 ──
  ['낡은 영혼의 벨트', 'old_soul_belt'],
  ['낡은 신체의 벨트', 'old_body_belt'],
  ['영혼의 벨트', 'soul_belt'],
  ['신체의 벨트', 'body_belt'],
  ['용기의 벨트', 'courage_belt'],
  ['빛나는 영혼의 벨트', 'shining_soul_belt'],
  ['빛나는 신체의 벨트', 'shining_body_belt'],
  ['에이션트 자이언트의 반지', 'giant_ring_belt'],
  // ── 기존 Materials ──
  ['변신 주문서', 'transform_scroll'],
]);

// ══════════════════════════════════════════════
// 5. item_id → gameId 변환
// ══════════════════════════════════════════════

/** 변종 아이템 ID → 기본 ID 변환 */
function toBaseId(itemId) {
  if (itemId >= 200000) return itemId - 200000;
  if (itemId >= 100000) return itemId - 100000;
  return itemId;
}

/** 기본 ID → 카테고리 판별 */
function getCategory(baseId) {
  if (baseId < 20000) return 'weapon';
  if (baseId < 40000) return 'armor';
  return 'etc';
}

// etc_items 중 드롭 테이블에 등장하는 고유 ID 수집
const usedEtcIds = new Set();

/**
 * L1J item_id → 우리 게임의 gameId
 * @returns {string|null} gameId 또는 null (매핑 불가)
 */
function resolveGameId(itemId) {
  const baseId = toBaseId(itemId);
  const category = getCategory(baseId);

  // name 조회
  const info = itemIdToInfo.get(baseId);
  if (!info) return null;

  // 1) Hand-curated name 매칭 (최우선)
  const handCurated = NAME_TO_GAME_ID.get(info.name);
  if (handCurated) return handCurated;

  // 2) CSV 자동 생성 ID
  if (category === 'weapon') return `w_${baseId}`;
  if (category === 'armor')  return `a_${baseId}`;

  // 3) 아데나 (골드) → 특수 처리
  if (baseId === 40308) return '__GOLD__';

  // 4) etc_items → e_{id}
  usedEtcIds.add(baseId);
  return `e_${baseId}`;
}

// ══════════════════════════════════════════════
// 6. drop_items.csv 파싱 → MONSTER_DROPS
// ══════════════════════════════════════════════

/** @type {Map<number, Array<{gameId: string, chance: number, min: number, max: number}>>} */
const monsterDrops = new Map();
let skippedItems = 0;
let goldDrops = 0;

for (const row of dropRows) {
  const npcId  = parseInt(row.npc_id);
  const itemId = parseInt(row.item_id);
  const min    = parseInt(row.min) || 1;
  const max    = parseInt(row.max) || 1;
  const chance = parseInt(row.chance) / 1000000; // L1J 1/1000000 → decimal

  if (isNaN(npcId) || isNaN(itemId)) continue;

  const gameId = resolveGameId(itemId);
  if (!gameId) { skippedItems++; continue; }

  if (!monsterDrops.has(npcId)) monsterDrops.set(npcId, []);
  const list = monsterDrops.get(npcId);

  if (gameId === '__GOLD__') {
    // 아데나는 골드 드롭으로 특수 처리
    list.push({ gameId: '__GOLD__', chance, min, max });
    goldDrops++;
  } else {
    // 같은 gameId가 이미 있으면 확률 합산 (변종 아이템 통합)
    const existing = list.find(d => d.gameId === gameId);
    if (existing) {
      existing.chance = Math.min(1, existing.chance + chance);
      existing.min = Math.min(existing.min, min);
      existing.max = Math.max(existing.max, max);
    } else {
      list.push({ gameId, chance, min, max });
    }
  }
}

console.log(`Processed: ${monsterDrops.size} monsters, ${skippedItems} items skipped, ${goldDrops} gold drops`);
console.log(`Unique etc items used: ${usedEtcIds.size}`);

// ══════════════════════════════════════════════
// 7. ETC_ITEMS 딕셔너리 생성
// ══════════════════════════════════════════════

// etc_items.csv에서 드롭에 사용된 아이템만 추출
const etcEntries = [];
for (const id of [...usedEtcIds].sort((a, b) => a - b)) {
  const info = itemIdToInfo.get(id);
  if (!info) continue;
  const etcRow = etcItems.find(e => parseInt(e.id) === id);
  // sellPrice 추정: weight 기반 간단 산출 (L1J에는 sellPrice 없음)
  const weight = etcRow ? parseInt(etcRow.weight) || 0 : 0;
  const sellPrice = Math.max(1, Math.floor(weight / 1000));
  etcEntries.push({
    id: `e_${id}`,
    name: info.name,
    sellPrice,
    l1jId: id,
  });
}

// ══════════════════════════════════════════════
// 8. TypeScript 코드 생성
// ══════════════════════════════════════════════

const lines = [];
lines.push(`/* =========================================================`);
lines.push(`   DROP DATA — L1J drop_items.csv 기반 자동 생성`);
lines.push(`   생성일: ${new Date().toISOString().slice(0, 10)}`);
lines.push(`   소스: data/drop_items.csv (${dropRows.length} entries)`);
lines.push(`   ⚠️ 이 파일은 scripts/importDrops.mjs로 자동 생성됩니다.`);
lines.push(`   ========================================================= */`);
lines.push(``);
lines.push(`import type { Material } from '../types';`);
lines.push(``);

// ── ETC_ITEMS ──
lines.push(`// ══════════════════════════════════════════════`);
lines.push(`// ETC_ITEMS — L1J etc_items.csv 기반 (드롭 아이템만)`);
lines.push(`// ══════════════════════════════════════════════`);
lines.push(``);
lines.push(`export const ETC_ITEMS: Record<string, Material> = {`);
for (const e of etcEntries) {
  const escaped = e.name.replace(/'/g, "\\'");
  lines.push(`  '${e.id}': { id: '${e.id}', name: '${escaped}', sellPrice: ${e.sellPrice} },`);
}
lines.push(`};`);
lines.push(``);

// ── MONSTER_DROPS ──
lines.push(`// ══════════════════════════════════════════════`);
lines.push(`// MONSTER_DROPS — L1J drop_items.csv 원본`);
lines.push(`// ══════════════════════════════════════════════`);
lines.push(``);
lines.push(`// [gameId, chance(0~1), minQty, maxQty]`);
lines.push(`// '__GOLD__' = 아데나 (골드 직접 추가)`);
lines.push(`type DropEntry = [string, number, number, number];`);
lines.push(``);
lines.push(`export const MONSTER_DROPS: Record<number, DropEntry[]> = {`);

const sortedNpcs = [...monsterDrops.keys()].sort((a, b) => a - b);
for (const npcId of sortedNpcs) {
  const drops = monsterDrops.get(npcId);
  const parts = drops.map(d => {
    // chance를 짧은 형식으로 포맷
    let ch;
    if (d.chance >= 1) ch = '1';
    else if (d.chance >= 0.01) ch = d.chance.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    else ch = d.chance.toExponential().replace(/e-0?/, 'e-');
    return `['${d.gameId}',${ch},${d.min},${d.max}]`;
  });
  lines.push(`  ${npcId}: [${parts.join(',')}],`);
}

lines.push(`};`);
lines.push(``);

// ── getMonsterDrops ──
lines.push(`/** 몬스터 ID(npc_XXXXX) → 드롭 목록 조회 */`);
lines.push(`export function getMonsterDrops(monsterId: string): DropEntry[] {`);
lines.push(`  const npcId = parseInt(monsterId.replace('npc_', ''), 10);`);
lines.push(`  return MONSTER_DROPS[npcId] ?? [];`);
lines.push(`}`);
lines.push(``);

fs.writeFileSync(OUT, lines.join('\n'), 'utf8');

// ── 통계 ──
console.log(`\n✅ Generated: ${OUT}`);
console.log(`   ${etcEntries.length} etc items`);
console.log(`   ${sortedNpcs.length} monsters with drops`);
console.log(`   ${dropRows.length - skippedItems} total drop entries processed`);
console.log(`   ${skippedItems} items skipped (unmapped)`);
