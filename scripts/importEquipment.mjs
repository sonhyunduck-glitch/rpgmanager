/* =========================================================
   CSV→TypeScript 장비 변환 스크립트
   weapons.csv + armors.csv → csvEquipData.ts

   실행: node scripts/importEquipment.mjs
   ========================================================= */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const OUT_FILE = join(__dirname, '..', 'src', 'data', 'csvEquipData.ts');

/** 보너스 효과 텍스트 포맷 (음수 값 처리: +- → -) */
function fmtBonus(label, val) {
  return val < 0 ? `${label}${val}` : `${label}+${val}`;
}

// ── CSV 파서 (간단한 comma-split, 따옴표 미사용) ──
function parseCsv(filepath) {
  const text = readFileSync(filepath, 'utf-8');
  const lines = text.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const val = (cols[j] ?? '').trim();
      obj[headers[j].trim()] = val;
    }
    rows.push(obj);
  }
  return rows;
}

function toInt(val) {
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

// ── 무기 타입 매핑 (L1J 전체) ──
const WEAPON_TYPE_MAP = {
  sword: 'weapon',
  twohandsword: 'weapon',
  dagger: 'weapon',
  spear: 'weapon',
  blunt: 'weapon',
  bow: 'bow',
  staff: 'staff',
  claw: 'weapon',        // 격투 무기 (다크엘프)
  dualsword: 'weapon',   // 이도류 (다크엘프)
  chainsword: 'weapon',  // 체인소드 (다크엘프)
  kiringku: 'weapon',    // 기린쿠 (특수)
  gauntlet: 'weapon',    // 건틀릿
};

// ── 방어구 타입 매핑 (L1J 전체) ──
const ARMOR_TYPE_MAP = {
  armor: 'armor',
  helm: 'helmet',
  cloak: 'cloak',
  glove: 'gloves',
  boots: 'boots',
  shield: 'shield',
  belt: 'belt',
  ring: 'ring',
  amulet: 'necklace',
  t_shirt: 'tshirt',
  earring: 'earring',
  guarder: 'gloves',          // 가더 → 장갑 슬롯
  pattern_left: 'ring',       // 문양(좌) → 반지 슬롯
  pattern_right: 'ring',      // 문양(우) → 반지 슬롯
  pattern_back: 'cloak',      // 문양(등) → 망토 슬롯
  talisman_left: 'necklace',  // 부적(좌) → 목걸이 슬롯
  talisman_right: 'necklace', // 부적(우) → 목걸이 슬롯
};

// ── 기존 EXISTING_NAMES 삭제 — 모든 L1J 아이템 로드 ──
// gameData.ts 수작업 템플릿은 고유 ID를 사용하므로 CSV와 충돌 없음

// ── 무기 변환 ──
function convertWeapons(rows) {
  const templates = [];
  let skipped = 0;

  for (const row of rows) {
    const csvType = row.type;
    const gameType = WEAPON_TYPE_MAP[csvType];
    if (!gameType) { skipped++; continue; } // 우리 클래스가 못 쓰는 타입

    const useKnight = toInt(row.use_knight);
    const useElf = toInt(row.use_elf);
    const useWizard = toInt(row.use_wizard);

    const name = row.name;
    const csvId = toInt(row.id);
    const id = `w_${csvId}`;
    const dmgSmall = toInt(row.dmg_small);
    const dmgLarge = toInt(row.dmg_large);
    const safeEnchant = toInt(row.safe_enchant);
    const maxEnhance = safeEnchant === -1 ? 0 : 10;
    const weight = toInt(row.weight);
    const sellPrice = Math.max(10, Math.floor(weight / 10));

    // 보너스
    const bonuses = {};
    const effects = [];

    const hitMod = toInt(row.hit_modifier);
    const dmgMod = toInt(row.dmg_modifier);
    const str = toInt(row.str);
    const con = toInt(row.con);
    const dex = toInt(row.dex);
    const int = toInt(row.int);
    const wis = toInt(row.wis);
    const hp = toInt(row.hp);
    const mp = toInt(row.mp);
    const sp = toInt(row.sp);
    const mr = toInt(row.mr);
    const canBeDmg = toInt(row.can_be_dmg);
    const isHaste = toInt(row.is_haste);
    const magicDmgMod = toInt(row.magic_dmg_modifier);
    const doubleDmg = toInt(row.double_dmg_chance);
    const minLevel = toInt(row.min_level);

    if (gameType === 'bow') {
      if (hitMod) { bonuses.bowHit = hitMod; effects.push(fmtBonus('활 명중', hitMod)); }
      if (dmgMod) { bonuses.bowDmg = dmgMod; effects.push(fmtBonus('활 추타', dmgMod)); }
    } else if (gameType === 'staff') {
      if (hitMod) { bonuses.hit = hitMod; effects.push(fmtBonus('명중', hitMod)); }
      if (dmgMod) { bonuses.extraDmg = dmgMod; effects.push(fmtBonus('추타', dmgMod)); }
      if (magicDmgMod) { bonuses.magicDmg = magicDmgMod; effects.push(fmtBonus('마법 추가대미지', magicDmgMod)); }
    } else {
      if (hitMod) { bonuses.hit = hitMod; effects.push(fmtBonus('명중', hitMod)); }
      if (dmgMod) { bonuses.extraDmg = dmgMod; effects.push(fmtBonus('추타', dmgMod)); }
    }

    if (str) { bonuses.str = str; effects.push(fmtBonus('STR', str)); }
    if (con) { bonuses.con = con; effects.push(fmtBonus('CON', con)); }
    if (dex) { bonuses.dex = dex; effects.push(fmtBonus('DEX', dex)); }
    if (int) { bonuses.int = int; effects.push(fmtBonus('INT', int)); }
    if (wis) { bonuses.wis = wis; effects.push(fmtBonus('WIS', wis)); }
    if (hp) { bonuses.hp = hp; effects.push(fmtBonus('HP', hp)); }
    if (mp) { bonuses.mp = mp; effects.push(fmtBonus('MP', mp)); }
    if (sp) { bonuses.sp = sp; effects.push(fmtBonus('SP', sp)); }
    if (mr) { bonuses.mr = mr; effects.push(fmtBonus('MR', mr)); }
    const hpr = toInt(row.hpr);
    const mpr = toInt(row.mpr);
    if (hpr) { bonuses.hpr = hpr; effects.push(fmtBonus('HPR', hpr)); }
    if (mpr) { bonuses.mpr = mpr; effects.push(fmtBonus('MPR', mpr)); }
    if (!canBeDmg) { bonuses.unbreakable = true; effects.push('손상되지 않음'); }
    if (isHaste) { bonuses.haste = true; effects.push('헤이스트'); }
    if (doubleDmg) { bonuses.doubleDmgChance = doubleDmg; effects.push(`이중 타격 ${doubleDmg}%`); }

    // 은제 무기 → 언데드 추타
    const material = row.material;
    if (material === 'silver') {
      bonuses.undeadSlayer = true;
      effects.push('언데드 추타');
    }

    // 클래스 제한 (L1J CSV use_knight/use_elf/use_wizard 기반)
    const allCanUse = useKnight && useElf && useWizard;
    let classRestriction;
    if (!allCanUse) {
      const classes = [];
      if (useKnight) classes.push('knight');
      if (useElf) classes.push('elf');
      if (useWizard) classes.push('wizard');
      if (classes.length > 0 && classes.length < 3) {
        classRestriction = classes;
      }
    }

    // 양손 무기 (L1J is_twohanded)
    const isTwoHanded = toInt(row.is_twohanded) === 1;

    const tpl = {
      id, name, type: gameType,
      baseAtk: dmgSmall, baseAtkLarge: dmgLarge,
      baseDef: 0, safeEnchant: Math.max(0, safeEnchant), maxEnhance, sellPrice,
      weight,
    };
    if (isTwoHanded) tpl.isTwoHanded = true;
    if (Object.keys(bonuses).length > 0) tpl.bonuses = bonuses;
    if (effects.length > 0) tpl.bonusEffects = effects;
    if (classRestriction) tpl.classRestriction = classRestriction;
    if (minLevel > 0) tpl.minLevel = minLevel;

    templates.push(tpl);
  }

  console.log(`[Weapons] 변환: ${templates.length}, 타입 스킵: ${skipped}`);
  return templates;
}

// ── 방어구 변환 ──
function convertArmors(rows) {
  const templates = [];
  let skipped = 0;

  for (const row of rows) {
    const csvType = row.type;
    const gameType = ARMOR_TYPE_MAP[csvType];
    if (!gameType) { skipped++; continue; }

    const useKnight = toInt(row.use_knight);
    const useElf = toInt(row.use_elf);
    const useWizard = toInt(row.use_wizard);

    const name = row.name;
    const csvId = toInt(row.id);
    const id = `a_${csvId}`;
    const ac = toInt(row.ac);
    const baseDef = Math.max(0, -ac); // L1J 음수 AC → 양수 baseDef
    const safeEnchant = toInt(row.safe_enchant);
    const maxEnhance = safeEnchant === -1 ? 0 : 10;
    const weight = toInt(row.weight);
    const sellPrice = Math.max(10, Math.floor(weight / 10));

    // 보너스
    const bonuses = {};
    const effects = [];

    const hitMod = toInt(row.hit_modifier);
    const dmgMod = toInt(row.dmg_modifier);
    const bowHitMod = toInt(row.bow_hit_modifier);
    const bowDmgMod = toInt(row.bow_dmg_modifier);
    const str = toInt(row.str);
    const con = toInt(row.con);
    const dex = toInt(row.dex);
    const int = toInt(row.int);
    const wis = toInt(row.wis);
    const hp = toInt(row.hp);
    const mp = toInt(row.mp);
    const sp = toInt(row.sp);
    const mr = toInt(row.mr);
    const dmgReduction = toInt(row.damage_reduction);
    const isHaste = toInt(row.is_haste);
    const minLevel = toInt(row.min_level);

    if (hitMod) { bonuses.hit = hitMod; effects.push(fmtBonus('명중', hitMod)); }
    if (dmgMod) { bonuses.extraDmg = dmgMod; effects.push(fmtBonus('추타', dmgMod)); }
    if (bowHitMod) { bonuses.bowHit = bowHitMod; effects.push(fmtBonus('활 명중', bowHitMod)); }
    if (bowDmgMod) { bonuses.bowDmg = bowDmgMod; effects.push(fmtBonus('활 추타', bowDmgMod)); }
    if (str) { bonuses.str = str; effects.push(fmtBonus('STR', str)); }
    if (con) { bonuses.con = con; effects.push(fmtBonus('CON', con)); }
    if (dex) { bonuses.dex = dex; effects.push(fmtBonus('DEX', dex)); }
    if (int) { bonuses.int = int; effects.push(fmtBonus('INT', int)); }
    if (wis) { bonuses.wis = wis; effects.push(fmtBonus('WIS', wis)); }
    if (hp) { bonuses.hp = hp; effects.push(fmtBonus('HP', hp)); }
    if (mp) { bonuses.mp = mp; effects.push(fmtBonus('MP', mp)); }
    if (sp) { bonuses.sp = sp; effects.push(fmtBonus('SP', sp)); }
    if (mr) { bonuses.mr = mr; effects.push(fmtBonus('MR', mr)); }
    const hpr = toInt(row.hpr);
    const mpr = toInt(row.mpr);
    if (hpr) { bonuses.hpr = hpr; effects.push(fmtBonus('HPR', hpr)); }
    if (mpr) { bonuses.mpr = mpr; effects.push(fmtBonus('MPR', mpr)); }
    if (isHaste) { bonuses.haste = true; effects.push('헤이스트'); }

    // 클래스 제한 (L1J CSV use_knight/use_elf/use_wizard 기반)
    // ⚠️ 방패 포함 — L1J 원본에서 방패도 클래스별 사용 가능 여부가 다름
    const allCanUse = useKnight && useElf && useWizard;
    let classRestriction;
    if (!allCanUse) {
      const classes = [];
      if (useKnight) classes.push('knight');
      if (useElf) classes.push('elf');
      if (useWizard) classes.push('wizard');
      if (classes.length > 0 && classes.length < 3) {
        classRestriction = classes;
      }
    }

    const tpl = {
      id, name, type: gameType,
      baseAtk: 0, baseAtkLarge: 0,
      baseDef, safeEnchant: Math.max(0, safeEnchant), maxEnhance, sellPrice,
      weight,
    };
    if (Object.keys(bonuses).length > 0) tpl.bonuses = bonuses;
    if (effects.length > 0) tpl.bonusEffects = effects;
    if (classRestriction) tpl.classRestriction = classRestriction;
    if (minLevel > 0) tpl.minLevel = minLevel;
    // 방어구에는 isTwoHanded 없음

    templates.push(tpl);
  }

  console.log(`[Armors] 변환: ${templates.length}, 타입 스킵: ${skipped}`);
  return templates;
}

// ── TypeScript 생성 ──
function generateTs(weapons, armors) {
  const lines = [];
  lines.push(`/* =========================================================`);
  lines.push(`   CSV EQUIPMENT DATA — L1J 3.63c weapons.csv + armors.csv`);
  lines.push(`   자동 생성 파일 — 수동 수정 금지`);
  lines.push(`   생성: node scripts/importEquipment.mjs`);
  lines.push(`   무기 ${weapons.length}종 + 방어구 ${armors.length}종 = ${weapons.length + armors.length}종`);
  lines.push(`   ========================================================= */`);
  lines.push(`import type { EquipmentTemplate } from '../types';`);
  lines.push(``);
  lines.push(`export const CSV_EQUIPMENT: Record<string, EquipmentTemplate> = {`);

  const allTemplates = [...weapons, ...armors];
  for (const tpl of allTemplates) {
    const parts = [];
    parts.push(`id:'${tpl.id}'`);
    parts.push(`name:'${tpl.name.replace(/'/g, "\\'")}'`);
    parts.push(`type:'${tpl.type}'`);
    parts.push(`baseAtk:${tpl.baseAtk}`);
    parts.push(`baseAtkLarge:${tpl.baseAtkLarge}`);
    parts.push(`baseDef:${tpl.baseDef}`);
    parts.push(`safeEnchant:${tpl.safeEnchant}`);
    parts.push(`maxEnhance:${tpl.maxEnhance}`);
    parts.push(`sellPrice:${tpl.sellPrice}`);
    parts.push(`weight:${tpl.weight}`);
    if (tpl.isTwoHanded) parts.push(`isTwoHanded:true`);
    if (tpl.bonuses) parts.push(`bonuses:${JSON.stringify(tpl.bonuses)}`);
    if (tpl.bonusEffects) parts.push(`bonusEffects:${JSON.stringify(tpl.bonusEffects)}`);
    if (tpl.classRestriction) parts.push(`classRestriction:${JSON.stringify(tpl.classRestriction)}`);
    if (tpl.minLevel) parts.push(`minLevel:${tpl.minLevel}`);

    lines.push(`  '${tpl.id}':{${parts.join(',')}},`);
  }

  lines.push(`};`);
  lines.push(``);
  lines.push(`/** CSV 장비 수 */`);
  lines.push(`export const CSV_WEAPON_COUNT = ${weapons.length};`);
  lines.push(`export const CSV_ARMOR_COUNT = ${armors.length};`);
  lines.push(``);

  return lines.join('\n');
}

// ── 메인 ──
const weaponRows = parseCsv(join(DATA_DIR, 'weapons.csv'));
const armorRows = parseCsv(join(DATA_DIR, 'armors.csv'));

console.log(`weapons.csv: ${weaponRows.length} rows`);
console.log(`armors.csv: ${armorRows.length} rows`);

const weapons = convertWeapons(weaponRows);
const armors = convertArmors(armorRows);

const ts = generateTs(weapons, armors);
writeFileSync(OUT_FILE, ts, 'utf-8');
console.log(`\n✅ Generated: ${OUT_FILE}`);
console.log(`   Total: ${weapons.length + armors.length} templates`);
