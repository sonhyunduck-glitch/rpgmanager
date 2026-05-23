#!/usr/bin/env node
/* =========================================================
   importArmorSets.mjs — L1J armor_sets.csv → setData.ts 변환

   Usage: node scripts/importArmorSets.mjs
   Output: src/data/setData.ts (EQUIPMENT_SETS)

   78 세트 중 실전 34 세트 임포트 (코스메틱 세트 제외)
   ========================================================= */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const SRC  = path.join(__dirname, '..', 'src', 'data');
const OUT  = path.join(SRC, 'setData.ts');

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
// 2. armors.csv → item_id → name 매핑
// ══════════════════════════════════════════════

const armors = parseCSV(path.join(DATA, 'armors.csv'));
const armorNameById = new Map();
for (const a of armors) {
  armorNameById.set(parseInt(a.id), a.name);
}

// ══════════════════════════════════════════════
// 3. 기존 장비 ID 매핑 (hand-curated + CSV)
// ══════════════════════════════════════════════

// Hand-curated templates: L1J item_id → 우리 게임 template_id
// armors.csv name 기반 수동 매칭
const HAND_CURATED_MAP = {
  // ── 데몬 세트 ──
  20009: 'demon_helm',
  20099: 'demon_armor',
  20165: 'demon_gloves',
  20197: 'demon_boots',
  // ── 데스나이트 세트 ──
  20010: 'dk_helmet',
  20100: 'dk_armor',
  20166: 'dk_gloves',
  20198: 'dk_boots',
  // ── 커츠 세트 ──
  20041: 'kurtz_helmet',
  20150: 'kurtz_armor',
  20184: 'kurtz_gloves',
  20214: 'kurtz_boots',
  // ── 오크 세트 ──
  20034: 'orc_helm',
  20072: 'orc_cloak',
  20135: 'orc_ring_mail',
  20237: 'orc_shield',
  // ── 난쟁이족 세트 ──
  20007: 'dwarf_iron_helm',
  20052: 'dwarf_cloak',
  20223: 'dwarf_shield',
  // ── 징박은 가죽 세트 ──
  20038: 'studded_leather_hat',
  20148: 'studded_vest',
  20241: 'studded_shield',
  20212: 'studded_sandals',
  // ── 뼈 세트 ──
  20045: 'skull_helm',
  20124: 'bone_armor',
  // ── 강철 세트 ──
  20003: 'steel_helm',
  20091: 'steel_plate_armor',
  20163: 'steel_gloves',
  20194: 'steel_boots',
  20220: 'steel_shield',
  // ── 파란해적 세트 ──
  20044: 'blue_pirate_hood',
  20155: 'blue_pirate_armor',
  20188: 'pirate_gloves',
  20217: 'pirate_boots',
  // ── 명법군왕 세트 ──
  20057: 'demon_lord_cloak',
  20109: 'demon_lord_robe',
  20178: 'assassin_gloves',
  20200: 'beast_lord_boots',
  // ── 골각 방패 (뼈 세트 피스) ──
  20221: 'gollack_shield',
};

// CSV equipment에 있는 a_XXXXX 형식 템플릿 확인
const csvEquipText = fs.readFileSync(path.join(SRC, 'csvEquipData.ts'), 'utf8');
const csvIds = new Set();
for (const m of csvEquipText.matchAll(/'(a_\d+)'/g)) {
  csvIds.add(m[1]);
}
console.log(`CSV equipment: ${csvIds.size} armor templates loaded`);

/**
 * L1J item_id → 우리 게임 template_id 결정
 * 1순위: hand-curated 매핑
 * 2순위: CSV a_{item_id} 존재 확인
 * 3순위: a_{item_id} (존재하지 않아도 향후 추가 대비)
 */
function resolveTemplateId(itemId) {
  if (HAND_CURATED_MAP[itemId]) return HAND_CURATED_MAP[itemId];
  const csvKey = `a_${itemId}`;
  return csvKey; // CSV에 있든 없든 a_XXXXX 형식 사용
}

// ══════════════════════════════════════════════
// 4. armor_sets.csv 파싱 + 분류
// ══════════════════════════════════════════════

// armor_sets.csv는 sets 컬럼에 \, 를 구분자로 사용
// 일반 CSV 파서로는 처리 불가 → 직접 파싱
function parseArmorSetsCSV(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',');

  return lines.slice(1).map(line => {
    // sets 컬럼(index 2)에 \, 가 있으므로 특수 처리
    // 형식: id,note,sets_with_backslash_commas,poly_id,rest...
    // 먼저 \, 를 임시 치환
    const safe = line.replace(/\\,/g, '|PIPE|');
    const vals = safe.split(',');

    const obj = {};
    headers.forEach((h, i) => {
      let val = (vals[i] ?? '').trim();
      if (h.trim() === 'sets') val = val.replace(/\|PIPE\|/g, ',');
      obj[h.trim()] = val;
    });
    return obj;
  });
}

const armorSets = parseArmorSetsCSV(path.join(DATA, 'armor_sets.csv'));
console.log(`armor_sets.csv: ${armorSets.length} sets loaded`);

// 실전 세트 vs 코스메틱 세트 분류
// 기준: 세트 피스 2개 이상 AND 스탯 보너스 1개 이상 비제로
const STAT_KEYS = [
  'ac','hp','mp','hpr','mpr','str','dex','con','wis','cha','int','sp','mr',
  'damage_reduction','weight_reduction','hit_modifier','dmg_modifier',
  'bow_hit_modifier','bow_dmg_modifier',
  'defense_water','defense_wind','defense_fire','defense_earth',
  'resist_stun','resist_stone','resist_sleep','resist_freeze','resist_hold','resist_blind',
  'is_haste','exp_bonus','potion_recovery_rate'
];

const combatSets = [];
const cosmeticSets = [];

for (const row of armorSets) {
  const piecesRaw = row.sets ?? '';
  const pieceIds = piecesRaw.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));

  const hasStats = STAT_KEYS.some(k => {
    const v = parseFloat(row[k] ?? '0');
    return v !== 0 && k !== 'ac'; // ac=-1은 poly_id용 마커
  });

  // ac만 있고 다른 스탯 없으면 코스메틱일 수 있음
  // 실전 기준: 피스 2개 이상 OR (ac 보너스가 -2 이하로 의미있는 값)
  const acVal = parseInt(row.ac ?? '0');
  const isRealAc = acVal !== 0 && acVal !== -1;
  const isCombat = pieceIds.length >= 2 && (hasStats || isRealAc);

  if (isCombat) {
    combatSets.push({ ...row, pieceIds });
  } else {
    cosmeticSets.push({ ...row, pieceIds });
  }
}

console.log(`실전 세트: ${combatSets.length}개, 코스메틱: ${cosmeticSets.length}개`);

// ══════════════════════════════════════════════
// 5. 세트 데이터 생성
// ══════════════════════════════════════════════

let existCount = 0;
let missingCount = 0;
const missingItems = [];

const setEntries = [];

for (const s of combatSets) {
  const csvId = parseInt(s.id);
  const name = s.note;
  const pieces = s.pieceIds.map(id => {
    const tmplId = resolveTemplateId(id);
    const inHandCurated = !!HAND_CURATED_MAP[id];
    const inCsv = csvIds.has(`a_${id}`);
    if (inHandCurated || inCsv) {
      existCount++;
    } else {
      missingCount++;
      const armorName = armorNameById.get(id) ?? '?';
      missingItems.push(`  ${id} (${armorName}) → ${tmplId}`);
    }
    return tmplId;
  });

  // 보너스 수집 (0이 아닌 값만)
  const bonuses = {};
  const n = (key) => {
    const v = parseFloat(s[key] ?? '0');
    return isNaN(v) ? 0 : v;
  };

  if (n('ac') !== 0 && n('ac') !== -1) bonuses.ac = -n('ac'); // L1J: 음수=좋음, 우리: 양수=좋음 (baseDef)
  if (n('hp') !== 0) bonuses.hp = n('hp');
  if (n('mp') !== 0) bonuses.mp = n('mp');
  if (n('hpr') !== 0) bonuses.hpr = n('hpr');
  if (n('mpr') !== 0) bonuses.mpr = n('mpr');
  if (n('str') !== 0) bonuses.str = n('str');
  if (n('dex') !== 0) bonuses.dex = n('dex');
  if (n('con') !== 0) bonuses.con = n('con');
  if (n('wis') !== 0) bonuses.wis = n('wis');
  if (n('int') !== 0) bonuses.int = n('int');
  if (n('sp') !== 0) bonuses.sp = n('sp');
  if (n('mr') !== 0) bonuses.mr = n('mr');
  if (n('damage_reduction') !== 0) bonuses.damageReduction = n('damage_reduction');
  if (n('weight_reduction') !== 0) bonuses.weightReduction = n('weight_reduction');
  if (n('hit_modifier') !== 0) bonuses.hit = n('hit_modifier');
  if (n('dmg_modifier') !== 0) bonuses.dmg = n('dmg_modifier');
  if (n('bow_hit_modifier') !== 0) bonuses.bowHit = n('bow_hit_modifier');
  if (n('bow_dmg_modifier') !== 0) bonuses.bowDmg = n('bow_dmg_modifier');
  if (n('defense_water') !== 0) bonuses.defWater = n('defense_water');
  if (n('defense_wind') !== 0) bonuses.defWind = n('defense_wind');
  if (n('defense_fire') !== 0) bonuses.defFire = n('defense_fire');
  if (n('defense_earth') !== 0) bonuses.defEarth = n('defense_earth');
  if (n('resist_stun') !== 0) bonuses.resistStun = n('resist_stun');
  if (n('resist_stone') !== 0) bonuses.resistStone = n('resist_stone');
  if (n('resist_sleep') !== 0) bonuses.resistSleep = n('resist_sleep');
  if (n('resist_freeze') !== 0) bonuses.resistFreeze = n('resist_freeze');
  if (n('resist_hold') !== 0) bonuses.resistHold = n('resist_hold');
  if (n('resist_blind') !== 0) bonuses.resistBlind = n('resist_blind');
  if (n('is_haste') !== 0) bonuses.haste = true;
  if (n('exp_bonus') !== 0) bonuses.expBonus = n('exp_bonus');
  if (n('potion_recovery_rate') !== 0) bonuses.potionRecovery = n('potion_recovery_rate');

  // description 생성
  const descParts = [];
  if (bonuses.ac) descParts.push(`AC ${bonuses.ac > 0 ? '-' : '+'}${Math.abs(bonuses.ac)}`);
  if (bonuses.hp) descParts.push(`HP +${bonuses.hp}`);
  if (bonuses.mp) descParts.push(`MP +${bonuses.mp}`);
  if (bonuses.hpr) descParts.push(`HP회복 +${bonuses.hpr}`);
  if (bonuses.mpr) descParts.push(`MP회복 +${bonuses.mpr}`);
  if (bonuses.str) descParts.push(`STR ${bonuses.str > 0 ? '+' : ''}${bonuses.str}`);
  if (bonuses.dex) descParts.push(`DEX ${bonuses.dex > 0 ? '+' : ''}${bonuses.dex}`);
  if (bonuses.con) descParts.push(`CON ${bonuses.con > 0 ? '+' : ''}${bonuses.con}`);
  if (bonuses.wis) descParts.push(`WIS ${bonuses.wis > 0 ? '+' : ''}${bonuses.wis}`);
  if (bonuses.int) descParts.push(`INT ${bonuses.int > 0 ? '+' : ''}${bonuses.int}`);
  if (bonuses.sp) descParts.push(`SP +${bonuses.sp}`);
  if (bonuses.mr) descParts.push(`MR +${bonuses.mr}`);
  if (bonuses.damageReduction) descParts.push(`데미지 경감 +${bonuses.damageReduction}`);
  if (bonuses.hit) descParts.push(`명중 +${bonuses.hit}`);
  if (bonuses.dmg) descParts.push(`추타 +${bonuses.dmg}`);
  if (bonuses.bowHit) descParts.push(`활 명중 +${bonuses.bowHit}`);
  if (bonuses.bowDmg) descParts.push(`활 추타 +${bonuses.bowDmg}`);
  if (bonuses.defWater) descParts.push(`물 저항 +${bonuses.defWater}`);
  if (bonuses.defWind) descParts.push(`바람 저항 +${bonuses.defWind}`);
  if (bonuses.defFire) descParts.push(`불 저항 +${bonuses.defFire}`);
  if (bonuses.defEarth) descParts.push(`땅 저항 +${bonuses.defEarth}`);
  if (bonuses.resistStun) descParts.push(`스턴 내성 +${bonuses.resistStun}`);
  if (bonuses.haste) descParts.push('헤이스트');
  if (bonuses.expBonus) descParts.push(`경험치 +${bonuses.expBonus}%`);
  if (bonuses.potionRecovery) descParts.push(`물약 회복 +${bonuses.potionRecovery}`);

  // set ID 생성 (snake_case)
  const setId = `set_${csvId}`;

  // 피스 이름 조회 (로그용)
  const pieceNames = s.pieceIds.map(id => armorNameById.get(id) ?? `?${id}`);

  setEntries.push({
    setId,
    name,
    pieces,
    pieceNames,
    bonuses,
    description: descParts.join(', '),
    csvId,
  });
}

// ══════════════════════════════════════════════
// 6. TypeScript 파일 생성
// ══════════════════════════════════════════════

function jsonBonuses(b) {
  const parts = [];
  for (const [k, v] of Object.entries(b)) {
    if (v === true) {
      parts.push(`${k}:true`);
    } else {
      parts.push(`${k}:${v}`);
    }
  }
  return `{${parts.join(',')}}`;
}

let ts = `/* =========================================================
   SET DATA — L1J 3.63c armor_sets.csv 기반 세트 효과
   자동 생성 파일 — 수동 수정 금지
   생성: node scripts/importArmorSets.mjs
   실전 세트 ${combatSets.length}종 (코스메틱 ${cosmeticSets.length}종 제외)
   ========================================================= */

// ── 세트 보너스 인터페이스 (L1J 전체 효과 타입) ──

export interface SetBonuses {
  // 기본
  ac?: number;        // AC 보너스 (양수 = 방어↑, L1J 원본은 음수 → 변환됨)
  hp?: number;        // HP 보너스
  mp?: number;        // MP 보너스

  // 회복
  hpr?: number;       // HP 회복량
  mpr?: number;       // MP 회복량

  // 스탯
  str?: number;
  dex?: number;
  con?: number;
  wis?: number;
  int?: number;

  // 전투
  sp?: number;        // SP (마법 강화)
  mr?: number;        // MR (마법 저항)
  damageReduction?: number;  // 데미지 경감
  weightReduction?: number;  // 중량 감소
  hit?: number;       // 명중 보너스
  dmg?: number;       // 추가 대미지
  bowHit?: number;    // 활 명중 보너스
  bowDmg?: number;    // 활 추가 대미지

  // 속성 방어
  defWater?: number;
  defWind?: number;
  defFire?: number;
  defEarth?: number;

  // 상태이상 내성
  resistStun?: number;
  resistStone?: number;
  resistSleep?: number;
  resistFreeze?: number;
  resistHold?: number;
  resistBlind?: number;

  // 특수
  haste?: boolean;       // 헤이스트
  expBonus?: number;     // 경험치 보너스 (%)
  potionRecovery?: number; // 물약 회복량 보너스
}

export interface SetEffect {
  id: string;
  name: string;
  pieces: string[];       // 필요 templateId 목록
  bonuses: SetBonuses;
  description: string;
}

// ── 세트 정의 (${combatSets.length}종) ──

export const EQUIPMENT_SETS: SetEffect[] = [\n`;

for (const entry of setEntries) {
  const piecesStr = entry.pieces.map(p => `'${p}'`).join(',');
  ts += `  // ${entry.name} (${entry.pieceNames.join(' + ')})\n`;
  ts += `  {id:'${entry.setId}',name:'${entry.name}',pieces:[${piecesStr}],bonuses:${jsonBonuses(entry.bonuses)},description:'${entry.description}'},\n`;
}

ts += `];

/** 착용 중인 장비 templateId 배열로 활성 세트 목록 반환 */
export function getActiveSets(equippedTemplateIds: string[]): SetEffect[] {
  return EQUIPMENT_SETS.filter(set =>
    set.pieces.every(piece => equippedTemplateIds.includes(piece))
  );
}
`;

fs.writeFileSync(OUT, ts, 'utf8');

// ══════════════════════════════════════════════
// 7. 결과 보고
// ══════════════════════════════════════════════

console.log('\n═══ 결과 ═══');
console.log(`실전 세트: ${combatSets.length}종`);
console.log(`총 피스: ${existCount + missingCount}개`);
console.log(`  기존 템플릿 매칭: ${existCount}개`);
console.log(`  미등록 (향후 추가): ${missingCount}개`);
if (missingItems.length > 0) {
  console.log('\n미등록 아이템:');
  missingItems.forEach(m => console.log(m));
}
console.log(`\n출력: ${OUT}`);
console.log('완료!');
