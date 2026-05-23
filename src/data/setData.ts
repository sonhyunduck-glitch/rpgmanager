/* =========================================================
   SET DATA — L1J 3.63c armor_sets.csv 기반 세트 효과
   자동 생성 파일 — 수동 수정 금지
   생성: node scripts/importArmorSets.mjs
   실전 세트 34종 (코스메틱 44종 제외)
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

// ── 세트 정의 (34종) ──

export const EQUIPMENT_SETS: SetEffect[] = [
  // 데몬 세트 (데몬의 투구 + 데몬의 갑옷 + 데몬의 장갑 + 데몬의 부츠)
  {id:'set_1',name:'데몬 세트',pieces:['demon_helm','demon_armor','demon_gloves','demon_boots'],bonuses:{ac:2,hpr:5},description:'AC -2, HP회복 +5'},
  // 데스나이트 세트 (데스나이트의 투구 + 데스나이트의 갑옷 + 데스나이트의 장갑 + 데스나이트의 부츠)
  {id:'set_2',name:'데스나이트 세트',pieces:['dk_helmet','dk_armor','dk_gloves','dk_boots'],bonuses:{ac:4},description:'AC -4'},
  // 반왕 세트 (반왕의 투구 + 반왕의 갑옷 + 반왕의 건틀릿 + 반왕의 부츠)
  {id:'set_3',name:'반왕 세트',pieces:['a_20024','a_20118','a_20170','a_20203'],bonuses:{ac:3,hpr:12},description:'AC -3, HP회복 +12'},
  // 커츠 세트 (커츠의 투구 + 커츠의 갑옷 + 커츠의 장갑 + 커츠의 부츠)
  {id:'set_4',name:'커츠 세트',pieces:['kurtz_helmet','kurtz_armor','kurtz_gloves','kurtz_boots'],bonuses:{ac:8,hp:100},description:'AC -8, HP +100'},
  // 케레니스 세트 (케레니스의 서클릿 + 케레니스의 로브 + 케레니스의 장갑 + 케레니스의 부츠)
  {id:'set_5',name:'케레니스 세트',pieces:['a_20042','a_20151','a_20185','a_20215'],bonuses:{ac:2,mp:100,mpr:12},description:'AC -2, MP +100, MP회복 +12'},
  // 가죽 세트 (가죽 모자 + 가죽 조끼 + 가죽 샌달 + 가죽 방패)
  {id:'set_33',name:'가죽 세트',pieces:['a_20001','a_20090','a_20193','a_20219'],bonuses:{ac:3},description:'AC -3'},
  // 오크 세트 (오크족 투구 + 오크족 망토 + 오크족 고리 갑옷 + 우럭하이 방패)
  {id:'set_34',name:'오크 세트',pieces:['orc_helm','orc_cloak','orc_ring_mail','orc_shield'],bonuses:{ac:3},description:'AC -3'},
  // 난쟁이족 세트 (난쟁이족 철 투구 + 난쟁이족 망토 + 난쟁이족 둥근 방패)
  {id:'set_35',name:'난쟁이족 세트',pieces:['dwarf_iron_helm','dwarf_cloak','dwarf_shield'],bonuses:{hp:5},description:'HP +5'},
  // 징박은 가죽 세트 (징박은 가죽모자 + 징박은 가죽조끼 + 징박은 가죽방패 + 징박은 가죽샌달)
  {id:'set_36',name:'징박은 가죽 세트',pieces:['studded_leather_hat','studded_vest','studded_shield','studded_sandals'],bonuses:{ac:3},description:'AC -3'},
  // 뼈 세트 (해골투구 + 뼈갑옷 + 골각 방패)
  {id:'set_37',name:'뼈 세트',pieces:['skull_helm','bone_armor','gollack_shield'],bonuses:{ac:2,hp:10},description:'AC -2, HP +10'},
  // 원정 대원의 유품 세트 (%i의 요정 투구 + %i의 요정 갑옷 + %i의 요정 망토 + %i의 요정 장갑 + %i의 요정 부츠)
  {id:'set_38',name:'원정 대원의 유품 세트',pieces:['a_20389','a_20393','a_20401','a_20409','a_20406'],bonuses:{ac:2,hp:15,mp:10,mr:10},description:'AC -2, HP +15, MP +10, MR +10'},
  // 마법사 세트 (마법사의 모자 + 마법사의 옷)
  {id:'set_39',name:'마법사 세트',pieces:['a_20012','a_20111'],bonuses:{mp:50},description:'MP +50'},
  // 강철 세트 (강철 면갑 + 강철 판금 갑옷 + 강철 장갑 + 강철 부츠 + 강철 방패)
  {id:'set_40',name:'강철 세트',pieces:['steel_helm','steel_plate_armor','steel_gloves','steel_boots','steel_shield'],bonuses:{ac:3},description:'AC -3'},
  // 파란해적 세트 (푸른 해적 두건 + 푸른 해적 가죽갑옷 + 푸른 해적 장갑 + 푸른 해적 부츠)
  {id:'set_41',name:'파란해적 세트',pieces:['blue_pirate_hood','blue_pirate_armor','pirate_gloves','pirate_boots'],bonuses:{hp:10,int:1},description:'HP +10, INT +1'},
  // 야히셋트 (야히의 투구 + 야히의 망토 + 야히의 셔츠 + 야히의 갑옷 + 야히의 장갑 + 야히의 부츠 + 야히의 반지 + 야히의 목걸이)
  {id:'set_42',name:'야히셋트',pieces:['a_20031','a_20069','a_20083','a_20131','a_20179','a_20209','a_20290','a_20261'],bonuses:{ac:88,hp:100,mp:100,hpr:15,mpr:15,str:1,dex:1,con:1,wis:1,int:1},description:'AC -88, HP +100, MP +100, HP회복 +15, MP회복 +15, STR +1, DEX +1, CON +1, WIS +1, INT +1'},
  // 명법군왕 세트 (명법군왕의 망토 + 마령군왕의 로브 + 암살군왕의 장갑 + 마수군왕의 부츠)
  {id:'set_43',name:'명법군왕 세트',pieces:['demon_lord_cloak','demon_lord_robe','assassin_gloves','beast_lord_boots'],bonuses:{hp:30,mp:30,hpr:10,mpr:10},description:'HP +30, MP +30, HP회복 +10, MP회복 +10'},
  // 진명왕 세트 (진명황의 투구 + 진명황의 갑옷 + 진명황의 망토 + 진명황의 장갑 + 진명황의 부츠)
  {id:'set_44',name:'진명왕 세트',pieces:['a_20390','a_20395','a_20402','a_20410','a_20408'],bonuses:{ac:20,hp:100,mp:20,hpr:10},description:'AC -20, HP +100, MP +20, HP회복 +10'},
  // 젖은 장비 세트 (물에 젖은 투구 + 물에 젖은 망토 + 물에 젖은 갑옷 + 물에 젖은 장갑 + 물에 젖은 부츠)
  {id:'set_45',name:'젖은 장비 세트',pieces:['a_21051','a_21052','a_21053','a_21054','a_21055'],bonuses:{ac:10,hp:100,defFire:10},description:'AC -10, HP +100, 불 저항 +10'},
  // 희망 세트 (희망의 목걸이 + 희망의 반지)
  {id:'set_46',name:'희망 세트',pieces:['a_20413','a_20428'],bonuses:{mp:5},description:'MP +5'},
  // 행운 세트 (행운의 목걸이 + 행운의 반지)
  {id:'set_47',name:'행운 세트',pieces:['a_20414','a_20430'],bonuses:{mp:10},description:'MP +10'},
  // 정열 세트 (정열의 목걸이 + 정열의 반지)
  {id:'set_48',name:'정열 세트',pieces:['a_20415','a_20429'],bonuses:{hp:10},description:'HP +10'},
  // 진실 세트 (진실의 목걸이 + 진실의 반지)
  {id:'set_49',name:'진실 세트',pieces:['a_20416','a_20431'],bonuses:{hp:15},description:'HP +15'},
  // 기적 세트 (기적의 목걸이 + 기적의 반지)
  {id:'set_50',name:'기적 세트',pieces:['a_20417','a_20432'],bonuses:{hp:15,mp:10},description:'HP +15, MP +10'},
  // 자애·용기 세트 (자애의 목걸이 + 용기의 반지)
  {id:'set_51',name:'자애·용기 세트',pieces:['a_20418','a_20433'],bonuses:{hpr:2,mpr:2},description:'HP회복 +2, MP회복 +2'},
  // 적주의 아뮤렛트·정화의 귀 링 (붉은 저주의 목걸이 + 정화의 귀걸이)
  {id:'set_52',name:'적주의 아뮤렛트·정화의 귀 링',pieces:['a_20423','a_21019'],bonuses:{str:2,con:-2},description:'STR +2, CON -2'},
  // 청주의 아뮤렛트·정화의 귀 링 (푸른 저주의 목걸이 + 정화의 귀걸이)
  {id:'set_53',name:'청주의 아뮤렛트·정화의 귀 링',pieces:['a_20424','a_21019'],bonuses:{wis:-2,int:2},description:'WIS -2, INT +2'},
  // 록주의 아뮤렛트·정화의 귀 링 (녹색 저주의 목걸이 + 정화의 귀걸이)
  {id:'set_54',name:'록주의 아뮤렛트·정화의 귀 링',pieces:['a_20425','a_21019'],bonuses:{dex:2},description:'DEX +2'},
  // 젖은 세트 B (젖은 모자 + 물에 젖은 망토 + 물에 젖은 갑옷 + 물에 젖은 장갑 + 물에 젖은 부츠)
  {id:'set_61',name:'젖은 세트 B',pieces:['a_21170','a_21052','a_21053','a_21054','a_21055'],bonuses:{dex:1,bowHit:2,bowDmg:1},description:'DEX +1, 활 명중 +2, 활 추타 +1'},
  // 젖은 세트 C (젖은 후드 + 물에 젖은 망토 + 물에 젖은 갑옷 + 물에 젖은 장갑 + 물에 젖은 부츠)
  {id:'set_62',name:'젖은 세트 C',pieces:['a_21171','a_21052','a_21053','a_21054','a_21055'],bonuses:{mp:50,sp:1,mr:5},description:'MP +50, SP +1, MR +5'},
  // 왕가의 강인 세트 (왕가의 귀걸이 + 왕가의 강한 목걸이)
  {id:'set_69',name:'왕가의 강인 세트',pieces:['a_21249','a_21246'],bonuses:{hp:55,hpr:5,mr:4},description:'HP +55, HP회복 +5, MR +4'},
  // 왕가의 현명 세트 (왕가의 귀걸이 + 왕가의 현명 목걸이)
  {id:'set_70',name:'왕가의 현명 세트',pieces:['a_21249','a_21247'],bonuses:{mp:33,mpr:2,sp:1},description:'MP +33, MP회복 +2, SP +1'},
  // 왕가의 용맹 세트 (왕가의 귀걸이 + 왕가의 용맹 목걸이)
  {id:'set_71',name:'왕가의 용맹 세트',pieces:['a_21249','a_21248'],bonuses:{hit:2,dmg:2,bowHit:2,bowDmg:2},description:'명중 +2, 추타 +2, 활 명중 +2, 활 추타 +2'},
  // 얼음 여왕의 매력적인 세트 (얼음 여왕의 매력적인 드레스 + 얼음 여왕의 매력적인 샌달 + 얼음 여왕의 매력적인 티아라)
  {id:'set_77',name:'얼음 여왕의 매력적인 세트',pieces:['a_20134','a_20211','a_21291'],bonuses:{ac:5,hp:100,mpr:4,str:2,defWater:20},description:'AC -5, HP +100, MP회복 +4, STR +2, 물 저항 +20'},
  // 극한 세트 (극한의 투구 + 극한의 갑옷 + 극한의 부츠)
  {id:'set_78',name:'극한 세트',pieces:['a_21292','a_21293','a_21294'],bonuses:{ac:5,hp:100,mpr:8,con:2,mr:15,defWater:20},description:'AC -5, HP +100, MP회복 +8, CON +2, MR +15, 물 저항 +20'},
];

/** 착용 중인 장비 templateId 배열로 활성 세트 목록 반환 */
export function getActiveSets(equippedTemplateIds: string[]): SetEffect[] {
  return EQUIPMENT_SETS.filter(set =>
    set.pieces.every(piece => equippedTemplateIds.includes(piece))
  );
}
