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

// ── 무기 타입 매핑 ──
// 우리 게임의 3클래스가 사용할 수 있는 타입만
const WEAPON_TYPE_MAP = {
  sword: 'weapon',
  twohandsword: 'weapon',
  dagger: 'weapon',
  spear: 'weapon',
  blunt: 'weapon',
  bow: 'bow',
  staff: 'staff',
};

// ── 방어구 타입 매핑 ──
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
  // pattern_*, guarder, talisman_* → 스킵
};

// ── 기존 한글 이름 → 기존 ID 매핑 (중복 방지) ──
// gameData.ts에 이미 있는 이름들 → CSV에서 스킵
const EXISTING_NAMES = new Set([
  '메일 브레이커', '은검', '은장검', '다마스커스 검', '일본도', '레이피어',
  '싸울아비 장검', '데스나이트의 불검', '고대의 검', '무관의 양손검',
  '드래곤 슬레이어', '고대의 대검',
  '나무 활', '롱 보우', '요정 활', '고대 정령의 활',
  '참나무 지팡이', '미스릴 지팡이', '고대의 지팡이',
  '티셔츠',
  '가죽조끼', '가죽 갑옷', '오크족 고리 갑옷', '징박은 가죽조끼',
  '무명 로브', '고리 갑옷', '징박힌 가죽 갑옷', '벨트달린 가죽조끼',
  '나무 갑옷', '라스타바드 레더 아머', '비늘 갑옷', '오크족 사슬 갑옷',
  '다크 포레스터의 갑옷', '라스타바드 징박힌 레더 아머', '요정족 흉갑',
  '사슬 갑옷', '마법 방어 사슬 갑옷', '뼈갑옷', '푸른 해적 가죽갑옷',
  '요정족 사슬 갑옷', '띠 갑옷', '데몬의 갑옷', '중 비늘 갑옷',
  '청동 판금 갑옷', '요정족 판금 갑옷', '데스나이트의 갑옷',
  '강철 판금 갑옷', '판금 갑옷', '커츠의 갑옷', '환상의 갑옷',
  '마령군왕의 로브', '수정 갑옷', '수룡 비늘 갑옷', '지룡 비늘 갑옷',
  '풍룡 비늘 갑옷', '화룡 비늘 갑옷',
  '가죽모자', '가죽투구', '강철 면갑', '난쟁이족 철 투구', '데몬의 투구',
  '데스나이트의 투구', '마법 방어 투구', '무관의 투구', '바란카의 투구',
  '붉은 기사의 두건', '오크족 투구', '징박은 가죽모자', '커츠의 투구',
  '투구', '푸른 해적 두건', '해골투구',
  '오크족 망토', '난쟁이족 망토', '뱀파이어의 망토', '기름 망토',
  '요정족 망토', '마법 망토', '늑대가죽 망토', '아덴 기사단의 망토',
  '블랙 티거 가죽 망토', '대지의 망토', '물결의 망토', '바람의 망토',
  '열화의 망토', '혼돈의 망토', '보호 망토',
  '거대 여왕 개미의 금빛 날개', '명법군왕의 망토', '발록의 핏빛 망토',
  '장갑', '가죽 장갑', '빙령의 장갑', '암령의 장갑', '염령의 장갑',
  '풍령의 장갑', '파워 글로브', '강철 장갑', '설인 장갑', '푸른 해적 장갑',
  '데몬의 장갑', '데스나이트의 장갑', '커츠의 장갑', '죽음의 비늘',
  '혼돈의 손길', '암살군왕의 장갑',
  '가죽샌달', '징박은 가죽샌달', '짧은 부츠', '부츠', '가죽부츠',
  '라스타바드 부츠', '푸른 해적 부츠', '강철 부츠', '데몬의 부츠',
  '데스나이트의 부츠', '바란카의 부츠', '커츠의 부츠', '마수군왕의 부츠',
  '작은 방패', '가죽방패', '나무방패', '우럭하이 방패', '난쟁이족 둥근 방패',
  '징박은 가죽방패', '큰 방패', '메두사 방패', '강철 방패', '골각방패',
  '에바의 방패',
  '낡은 완력의 목걸이', '낡은 민첩의 목걸이', '낡은 지혜의 목걸이',
  '낡은 체력의 목걸이', '완력의 목걸이', '민첩의 목걸이', '지혜의 목걸이',
  '체력의 목걸이', '오크 투사의 목걸이', '장로의 목걸이', '항마의 목걸이',
  '수호의 목걸이',
  '장로의 반지', '항마의 반지', '수령의 반지', '멸마의 반지', '수호의 반지',
  '낡은 영혼의 벨트', '낡은 신체의 벨트', '영혼의 벨트', '신체의 벨트',
  '용기의 벨트', '빛나는 영혼의 벨트', '빛나는 신체의 벨트',
  '에이션트 자이언트의 반지',
]);

// ── 무기 변환 ──
function convertWeapons(rows) {
  const templates = [];
  let skipped = 0;
  let classFiltered = 0;

  for (const row of rows) {
    const csvType = row.type;
    const gameType = WEAPON_TYPE_MAP[csvType];
    if (!gameType) { skipped++; continue; } // 우리 클래스가 못 쓰는 타입

    const useKnight = toInt(row.use_knight);
    const useElf = toInt(row.use_elf);
    const useWizard = toInt(row.use_wizard);

    // 우리 3클래스 중 아무도 못 쓰면 스킵
    if (!useKnight && !useElf && !useWizard) { classFiltered++; continue; }

    const name = row.name;
    if (EXISTING_NAMES.has(name)) continue; // 기존 수작업 템플릿 우선

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

    // 클래스 제한
    let classRestriction;
    if (gameType === 'bow') {
      classRestriction = ['elf'];
    } else if (gameType === 'staff') {
      classRestriction = ['wizard'];
    } else {
      // weapon (sword/dagger/etc) — 기사만 사용 가능
      // 요정/마법사는 활/지팡이 전용이므로 일반 무기 사용 불가
      classRestriction = ['knight'];
    }

    const tpl = {
      id, name, type: gameType,
      baseAtk: dmgSmall, baseAtkLarge: dmgLarge,
      baseDef: 0, safeEnchant: Math.max(0, safeEnchant), maxEnhance, sellPrice,
    };
    if (Object.keys(bonuses).length > 0) tpl.bonuses = bonuses;
    if (effects.length > 0) tpl.bonusEffects = effects;
    if (classRestriction) tpl.classRestriction = classRestriction;
    if (minLevel > 0) tpl.minLevel = minLevel;

    templates.push(tpl);
  }

  console.log(`[Weapons] 변환: ${templates.length}, 타입 스킵: ${skipped}, 클래스 필터: ${classFiltered}, 기존 중복: ${rows.length - templates.length - skipped - classFiltered}`);
  return templates;
}

// ── 방어구 변환 ──
function convertArmors(rows) {
  const templates = [];
  let skipped = 0;
  let classFiltered = 0;

  for (const row of rows) {
    const csvType = row.type;
    const gameType = ARMOR_TYPE_MAP[csvType];
    if (!gameType) { skipped++; continue; }

    const useKnight = toInt(row.use_knight);
    const useElf = toInt(row.use_elf);
    const useWizard = toInt(row.use_wizard);

    if (!useKnight && !useElf && !useWizard) { classFiltered++; continue; }

    const name = row.name;
    if (EXISTING_NAMES.has(name)) continue;

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

    // 클래스 제한 (방어구는 다양한 조합 가능)
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
    // 방패는 기사만
    if (gameType === 'shield') {
      classRestriction = ['knight'];
    }

    const tpl = {
      id, name, type: gameType,
      baseAtk: 0, baseAtkLarge: 0,
      baseDef, safeEnchant: Math.max(0, safeEnchant), maxEnhance, sellPrice,
    };
    if (Object.keys(bonuses).length > 0) tpl.bonuses = bonuses;
    if (effects.length > 0) tpl.bonusEffects = effects;
    if (classRestriction) tpl.classRestriction = classRestriction;
    if (minLevel > 0) tpl.minLevel = minLevel;

    templates.push(tpl);
  }

  console.log(`[Armors] 변환: ${templates.length}, 타입 스킵: ${skipped}, 클래스 필터: ${classFiltered}, 기존 중복: ${rows.length - templates.length - skipped - classFiltered}`);
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
