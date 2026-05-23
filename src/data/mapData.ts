/* =========================================================
   MAP DATA — L1J 월드맵 지역 정의
   map_ids.csv + towns.csv 기반 지리적 구역 분류
   ========================================================= */

// ── 월드 지역 인터페이스 ──

export interface WorldRegion {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  /** 월드맵 내 시각적 위치 (0~100%) */
  position: { x: number; y: number };
  /** 연결된 지역 ID 목록 (이동 경로) */
  connections: string[];
  /** 이 지역에 속한 사냥터 ID — 필드: map_XX, 던전 그룹: dg_XX (층은 자동 매칭) */
  zoneIds: string[];
  /** 진입 최소 레벨 */
  requiredLevel: number;
  /** 지역 테마 색상 */
  color: string;
  /** 지역 아이콘 */
  icon: string;
  /** L1J map_ids의 mapId (대표) */
  mapId?: number;
  /** 수중 지역 여부 */
  underwater?: boolean;
}

// ── 14개 월드 지역 정의 ──
// L1J 3.63c 원본 지리 기반 — 남쪽(말하는 섬)에서 북쪽(페르티아)으로

export const WORLD_REGIONS: WorldRegion[] = [
  // ── 초반 지역 ──
  {
    id: 'talking_island',
    name: '말하는 섬',
    nameEn: 'Talking Island',
    description: '모험의 시작. 초보자를 위한 훈련소가 있다.',
    position: { x: 38, y: 90 },
    connections: ['silver_knight', 'jade_island'],
    zoneIds: ['map_training', 'map_68'],
    requiredLevel: 1,
    color: '#66BB6A',
    icon: '🏝️',
    mapId: 0,
  },
  {
    id: 'silver_knight',
    name: '은기사 마을',
    nameEn: 'Silver Knight Town',
    description: '대륙 관문. 은기사 기사단의 본거지.',
    position: { x: 40, y: 76 },
    connections: ['talking_island', 'gludio', 'dark_forest'],
    zoneIds: ['map_69', 'dg_86'],
    requiredLevel: 2,
    color: '#B0BEC5',
    icon: '🛡️',
    mapId: 69,
  },

  // ── 중반 지역 ──
  {
    id: 'gludio',
    name: '글루디오',
    nameEn: 'Gludio',
    description: '남부 대륙의 중심 도시. 지하 감옥이 유명하다.',
    position: { x: 22, y: 72 },
    connections: ['silver_knight', 'orc_forest', 'desert'],
    zoneIds: ['map_25', 'dg_23'],
    requiredLevel: 2,
    color: '#8D6E63',
    icon: '🏰',
    mapId: 4,
  },
  {
    id: 'orc_forest',
    name: '오크 숲',
    nameEn: 'Orcish Forest',
    description: '오크 부족의 영토. 다양한 야수가 서식한다.',
    position: { x: 15, y: 55 },
    connections: ['gludio', 'dark_forest'],
    zoneIds: ['map_304'],
    requiredLevel: 2,
    color: '#A5D6A7',
    icon: '🌲',
    mapId: 4,
  },
  {
    id: 'dark_forest',
    name: '어둠의 숲',
    nameEn: 'Dark Forest',
    description: '언데드와 다크엘프가 출몰하는 위험 지대.',
    position: { x: 28, y: 60 },
    connections: ['silver_knight', 'orc_forest', 'giran', 'mutant_forest'],
    zoneIds: ['map_85', 'dg_310', 'dg_309'],
    requiredLevel: 6,
    color: '#5C6BC0',
    icon: '🌑',
    mapId: 85,
  },

  // ── 중핵 지역 ──
  {
    id: 'giran',
    name: '기란',
    nameEn: 'Giran',
    description: '아덴 대륙 최대 도시. 수많은 던전이 연결되어 있다.',
    position: { x: 50, y: 38 },
    connections: ['dark_forest', 'dragon_valley', 'heine', 'mutant_forest', 'lastabad'],
    zoneIds: ['dg_0', 'dg_49', 'dg_258', 'dg_400', 'dg_420', 'dg_430', 'dg_78', 'dg_79', 'dg_80'],
    requiredLevel: 12,
    color: '#FFA726',
    icon: '🏛️',
    mapId: 4,
  },
  {
    id: 'dragon_valley',
    name: '용의계곡',
    nameEn: 'Dragon Valley',
    description: '드래곤이 서식하는 위험 지역. 강력한 보상이 기다린다.',
    position: { x: 32, y: 22 },
    connections: ['giran', 'fertia'],
    zoneIds: ['map_4', 'dg_70', 'dg_1002'],
    requiredLevel: 1,
    color: '#EF5350',
    icon: '🐉',
    mapId: 4,
  },
  {
    id: 'heine',
    name: '하이네',
    nameEn: 'Heine',
    description: '동부 해안 도시. 에바 왕국과 해저 세계로의 관문.',
    position: { x: 78, y: 38 },
    connections: ['giran', 'underwater'],
    zoneIds: ['map_440', 'dg_63', 'dg_73', 'dg_550'],
    requiredLevel: 5,
    color: '#29B6F6',
    icon: '⚓',
    mapId: 68,
  },
  {
    id: 'underwater',
    name: '해저',
    nameEn: 'Underwater',
    description: '심해의 수중 세계. 독특한 해저 생물이 서식한다.',
    position: { x: 85, y: 55 },
    connections: ['heine'],
    zoneIds: ['map_253', 'dg_558'],
    requiredLevel: 26,
    color: '#0288D1',
    icon: '🌊',
    underwater: true,
  },

  // ── 중~고레벨 지역 ──
  {
    id: 'desert',
    name: '사막',
    nameEn: 'Desert',
    description: '끝없는 모래밭. 테베 사막의 고대 유적이 잠들어 있다.',
    position: { x: 18, y: 40 },
    connections: ['gludio', 'dark_forest'],
    zoneIds: ['map_480', 'dg_780'],
    requiredLevel: 18,
    color: '#FFB74D',
    icon: '🏜️',
  },
  {
    id: 'mutant_forest',
    name: '변이의 숲',
    nameEn: 'Mutant Forest',
    description: '마법 오염으로 변이된 생물이 가득한 숲.',
    position: { x: 58, y: 55 },
    connections: ['dark_forest', 'giran'],
    zoneIds: ['map_254', 'dg_244', 'dg_666'],
    requiredLevel: 25,
    color: '#AB47BC',
    icon: '☣️',
  },

  // ── 고레벨 지역 ──
  {
    id: 'lastabad',
    name: '라스타바드',
    nameEn: 'Lasatabard',
    description: '악마의 요새. 최강의 마물이 지배하는 금단의 땅.',
    position: { x: 65, y: 68 },
    connections: ['giran'],
    zoneIds: ['dg_532', 'dg_534'],
    requiredLevel: 45,
    color: '#D32F2F',
    icon: '💀',
  },
  {
    id: 'jade_island',
    name: '자드 섬',
    nameEn: 'Jade Island',
    description: '대양 너머의 신비로운 섬. 광범위한 레벨대의 몬스터가 서식.',
    position: { x: 12, y: 88 },
    connections: ['talking_island'],
    zoneIds: ['dg_783'],
    requiredLevel: 6,
    color: '#26A69A',
    icon: '🗿',
  },
  {
    id: 'fertia',
    name: '페르티아',
    nameEn: 'Fertia',
    description: '최고 레벨 지역. 아덴 대륙 최북단의 미지의 땅.',
    position: { x: 45, y: 8 },
    connections: ['dragon_valley'],
    zoneIds: ['dg_1020'],
    requiredLevel: 63,
    color: '#FF7043',
    icon: '⚡',
  },
];

// ── 유틸 함수 ──

/** 지역 ID → 지역 객체 조회 */
export function getRegion(regionId: string): WorldRegion | undefined {
  return WORLD_REGIONS.find(r => r.id === regionId);
}

/**
 * 사냥터 zoneId로 소속 지역 찾기
 * 던전 층(dg_86_1f) → 던전 그룹(dg_86) → 지역 매칭
 */
export function getRegionByZoneId(zoneId: string): WorldRegion | undefined {
  // 직접 매칭 (필드 or 던전 그룹 ID)
  const direct = WORLD_REGIONS.find(r => r.zoneIds.includes(zoneId));
  if (direct) return direct;

  // 던전 층 ID → 그룹 ID (dg_86_3f → dg_86)
  const match = zoneId.match(/^(dg_\d+)_\d+f$/);
  if (match) {
    return WORLD_REGIONS.find(r => r.zoneIds.includes(match[1]));
  }

  return undefined;
}

/** 특정 지역에 속한 사냥터 ID 목록 (던전 층 포함) */
export function getZoneIdsForRegion(regionId: string, allZoneIds: string[]): string[] {
  const region = getRegion(regionId);
  if (!region) return [];

  return allZoneIds.filter(zid => {
    // 직접 매칭
    if (region.zoneIds.includes(zid)) return true;
    // 던전 층 → 그룹 매칭
    const match = zid.match(/^(dg_\d+)_\d+f$/);
    return match ? region.zoneIds.includes(match[1]) : false;
  });
}
