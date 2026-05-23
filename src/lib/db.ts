/* =========================================================
   DB — Supabase 데이터 읽기/쓰기 래퍼
   게임 상태를 DB에서 로드하고 DB에 저장
   ========================================================= */
import { supabase } from './supabase';
import type { Equipment } from '../types';

// ── 타입 ──

export interface DBProfile {
  id: string;
  name: string;
  level: number;
  exp: number;
  gold: number;
  title: string;
  current_hp: number;
  max_hp: number;
  stat_str: number;
  stat_dex: number;
  stat_con: number;
  stat_wis: number;
  last_zone_id: string | null;
  last_active_at: string;
  created_at: string;
  guild_id: string | null;
  selected_potion: string;
  potion_auto_use: boolean;
  potion_auto_threshold: number;
  potion_auto_buy: boolean;
}

export interface DBItem {
  uid: string;
  user_id: string;
  template_id: string;
  name: string;
  type: string;
  base_atk: number;
  base_atk_large: number;
  base_def: number;
  enhance_level: number;
  max_enhance: number;
  bonuses: Record<string, unknown>;
  bonus_effects: string[];
  sell_price: number;
  equipped: boolean;
  equipped_slot: string | null;
}

// ── 프로필 ──

export async function loadProfile(userId: string): Promise<DBProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as DBProfile;
}

export async function saveProfile(userId: string, updates: Partial<DBProfile>) {
  await supabase
    .from('profiles')
    .update({ ...updates, last_active_at: new Date().toISOString() })
    .eq('id', userId);
}

// ── 아이템 ──

export async function loadItems(userId: string): Promise<DBItem[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', userId);

  if (error || !data) return [];
  return data as DBItem[];
}

/** DB 아이템 → 클라이언트 Equipment 변환 */
export function dbItemToEquipment(item: DBItem): Equipment {
  return {
    uid: item.uid,
    templateId: item.template_id,
    name: item.name,
    type: item.type as Equipment['type'],
    baseAtk: item.base_atk,
    baseAtkLarge: item.base_atk_large,
    baseDef: item.base_def,
    enhanceLevel: item.enhance_level,
    maxEnhance: item.max_enhance,
    bonuses: (item.bonuses ?? {}) as Equipment['bonuses'],
    bonusEffects: (item.bonus_effects ?? []) as string[],
    sellPrice: item.sell_price,
  };
}

/** 클라이언트 Equipment → DB 아이템 변환 */
export function equipmentToDBItem(
  eq: Equipment,
  userId: string,
  equipped: boolean,
  equippedSlot: string | null,
): DBItem {
  return {
    uid: eq.uid,
    user_id: userId,
    template_id: eq.templateId,
    name: eq.name,
    type: eq.type,
    base_atk: eq.baseAtk,
    base_atk_large: eq.baseAtkLarge,
    base_def: eq.baseDef,
    enhance_level: eq.enhanceLevel,
    max_enhance: eq.maxEnhance,
    bonuses: eq.bonuses as Record<string, unknown>,
    bonus_effects: eq.bonusEffects,
    sell_price: eq.sellPrice,
    equipped,
    equipped_slot: equippedSlot,
  };
}

/** 아이템 1개 삽입 또는 갱신 */
export async function upsertItem(item: DBItem) {
  await supabase
    .from('items')
    .upsert(item, { onConflict: 'uid' });
}

/** 아이템 삭제 (강화 파괴, 판매 등) */
export async function deleteItem(uid: string) {
  await supabase
    .from('items')
    .delete()
    .eq('uid', uid);
}

// ── 재료 ──

export async function loadMaterials(userId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('materials')
    .select('material_id, quantity')
    .eq('user_id', userId);

  if (error || !data) return {};
  const result: Record<string, number> = {};
  for (const row of data) {
    result[row.material_id] = row.quantity;
  }
  return result;
}

export async function saveMaterial(userId: string, materialId: string, quantity: number) {
  await supabase
    .from('materials')
    .upsert(
      { user_id: userId, material_id: materialId, quantity },
      { onConflict: 'user_id,material_id' },
    );
}

/** 여러 재료 일괄 저장 */
export async function saveMaterials(userId: string, materials: Record<string, number>) {
  const rows = Object.entries(materials).map(([materialId, quantity]) => ({
    user_id: userId,
    material_id: materialId,
    quantity,
  }));
  if (rows.length === 0) return;
  await supabase
    .from('materials')
    .upsert(rows, { onConflict: 'user_id,material_id' });
}

// ── 포션 ──

export async function loadPotions(userId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('potions')
    .select('potion_id, quantity')
    .eq('user_id', userId);

  if (error || !data) return {};
  const result: Record<string, number> = {};
  for (const row of data) {
    result[row.potion_id] = row.quantity;
  }
  return result;
}

export async function savePotions(userId: string, potions: Record<string, number>) {
  const rows = Object.entries(potions).map(([potionId, quantity]) => ({
    user_id: userId,
    potion_id: potionId,
    quantity,
  }));
  if (rows.length === 0) return;
  await supabase
    .from('potions')
    .upsert(rows, { onConflict: 'user_id,potion_id' });
}


// ── 존 접속자 (zone_presence) ──

/** 존 입장/이동 — user_id PK이므로 UPSERT 하나로 이전 존에서 자동 이탈 */
export async function upsertZonePresence(userId: string, zoneId: string) {
  await supabase
    .from('zone_presence')
    .upsert(
      { user_id: userId, zone_id: zoneId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
}

/** heartbeat — updated_at만 갱신 (30초마다 호출) */
export async function touchZonePresence(userId: string) {
  await supabase
    .from('zone_presence')
    .update({ updated_at: new Date().toISOString() })
    .eq('user_id', userId);
}

/** 존 퇴장 (일시정지, 로그아웃 시) */
export async function removeZonePresence(userId: string) {
  await supabase
    .from('zone_presence')
    .delete()
    .eq('user_id', userId);
}

/** 특정 존의 활성 접속자 수 (5분 이내 갱신된 유저만) */
export async function getZonePlayerCount(zoneId: string): Promise<number> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('zone_presence')
    .select('*', { count: 'exact', head: true })
    .eq('zone_id', zoneId)
    .gte('updated_at', fiveMinAgo);
  if (error) return 1; // 에러 시 본인만 있다고 간주
  return count ?? 1;
}

// ── 오프라인 보상 계산 ──

import {
  RATE_GOLD, RATE_EXP, RATE_DROP,
} from '../store/storeTypes';

export interface OfflineReward {
  minutes: number;        // 오프라인 시간(분)
  kills: number;
  gold: number;
  exp: number;
  materials: Record<string, number>;
  zoneName: string;
  potionsUsed: Record<string, number>;   // 소모된 물약
  scrollsUsed: Record<string, number>;   // 소모된 주문서
}

/** 오프라인 보상에 필요한 유저 소모품 상태 */
export interface OfflinePlayerState {
  potions: Record<string, number>;
  selectedPotionId: string;
  potionAutoUse: boolean;
  greenPotionEnabled: boolean;
  couragePotionEnabled: boolean;
  transformScrollEnabled: boolean;
  transformScrollType: 'normal' | 'event';
  materials: Record<string, number>;
  level: number;
}

/**
 * 존 데이터 기반 오프라인 보상 계산
 * - 로그아웃 5분 후부터 계산 시작
 * - 온라인 효율 100% (RATE_GOLD, RATE_EXP, RATE_DROP 동일 적용)
 * - 최대 1440분 (24시간) 캡
 * - 소모품 보유량 역산: 체력물약/버프물약/변신주문서 차감
 */
export function calcOfflineReward(
  lastActiveAt: string,
  lastZoneId: string | null,
  zoneData: {
    name: string;
    monsters: { expReward: number; goldReward: number }[];
    dropMaterials: { materialId: string; rate: number; minQty: number; maxQty: number }[];
  } | null,
  playerState: OfflinePlayerState,
): OfflineReward | null {
  if (!lastZoneId || !zoneData || zoneData.monsters.length === 0) return null;

  const offlineMs = Date.now() - new Date(lastActiveAt).getTime();
  const GRACE_MIN = 5;
  const offlineMin = Math.floor(offlineMs / 60000) - GRACE_MIN;
  let effectiveMin = Math.min(offlineMin, 1440); // 최대 24시간

  if (effectiveMin < 1) return null;

  // ── 소모품 역산 ──
  const potionsUsed: Record<string, number> = {};
  const scrollsUsed: Record<string, number> = {};

  // 킬 속도: 분당 10킬 (온라인 동일 — 틱당 1킬, 2틱 평균)
  const KILLS_PER_MIN = 10;
  // 체력물약: 분당 3개 소모 (틱 쿨타임 감안)
  const HEAL_POTIONS_PER_MIN = 3;

  // 1) 체력물약 — 부족 시 사냥 시간 단축
  if (playerState.potionAutoUse) {
    const needed = Math.ceil(effectiveMin * HEAL_POTIONS_PER_MIN);
    const available = playerState.potions[playerState.selectedPotionId] ?? 0;
    if (available <= 0) return null; // 물약 없으면 사냥 불가
    if (available < needed) {
      effectiveMin = Math.floor(available / HEAL_POTIONS_PER_MIN);
      potionsUsed[playerState.selectedPotionId] = available;
    } else {
      potionsUsed[playerState.selectedPotionId] = needed;
    }
    if (effectiveMin < 1) return null;
  }

  // 2) 초록 물약 (300초 = 5분당 1개)
  if (playerState.greenPotionEnabled) {
    const needed = Math.ceil(effectiveMin / 5);
    const available = playerState.potions['green_potion'] ?? 0;
    const used = Math.min(needed, available);
    if (used > 0) potionsUsed['green_potion'] = used;
  }

  // 3) 용기의 물약 (300초 = 5분당 1개)
  if (playerState.couragePotionEnabled) {
    const needed = Math.ceil(effectiveMin / 5);
    const available = playerState.potions['courage_potion'] ?? 0;
    const used = Math.min(needed, available);
    if (used > 0) potionsUsed['courage_potion'] = used;
  }

  // 4) 변신주문서 (1800초 = 30분당 1개, Lv.12+)
  if (playerState.transformScrollEnabled && playerState.level >= 12) {
    const scrollId = playerState.transformScrollType === 'event'
      ? 'event_transform_scroll'
      : 'transform_scroll';
    const needed = Math.ceil(effectiveMin / 30);
    const available = playerState.materials[scrollId] ?? 0;
    const used = Math.min(needed, available);
    if (used > 0) scrollsUsed[scrollId] = used;
  }

  // ── 보상 계산 (온라인 동일 효율) ──
  const totalKills = Math.floor(KILLS_PER_MIN * effectiveMin);

  const avgExp = zoneData.monsters.reduce((s, m) => s + m.expReward, 0) / zoneData.monsters.length;
  const avgGold = zoneData.monsters.reduce((s, m) => s + m.goldReward, 0) / zoneData.monsters.length;

  // 온라인과 동일 배율 적용
  const gold = Math.floor((avgGold + 2) * RATE_GOLD * totalKills);
  const exp = Math.floor(avgExp * RATE_EXP * totalKills);

  // 재료 드롭 (RATE_DROP 적용)
  const materials: Record<string, number> = {};
  for (const drop of zoneData.dropMaterials) {
    const expected = totalKills * Math.min(1, drop.rate * RATE_DROP);
    const avgQty = (drop.minQty + drop.maxQty) / 2;
    const qty = Math.floor(expected * avgQty);
    if (qty > 0) materials[drop.materialId] = qty;
  }

  return {
    minutes: effectiveMin,
    kills: totalKills,
    gold,
    exp,
    materials,
    zoneName: zoneData.name,
    potionsUsed,
    scrollsUsed,
  };
}
