/* =========================================================
   DB — Supabase 데이터 읽기/쓰기 래퍼
   게임 상태를 DB에서 로드하고 DB에 저장
   ========================================================= */
import { supabase } from './supabase';
import type { Equipment, StatAllocation } from '../types';

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


// ── 오프라인 보상 계산 ──

export interface OfflineReward {
  minutes: number;        // 오프라인 시간(분)
  kills: number;
  gold: number;
  exp: number;
  materials: Record<string, number>;
  zoneName: string;
}

/**
 * 존 데이터 기반 오프라인 보상 계산
 * - 효율 30% (온라인 대비)
 * - 최대 480분 (8시간) 캡
 * - 10분 미만 무시
 */
export function calcOfflineReward(
  lastActiveAt: string,
  lastZoneId: string | null,
  zoneData: {
    name: string;
    monsters: { expReward: number; goldReward: number }[];
    dropMaterials: { materialId: string; rate: number; minQty: number; maxQty: number }[];
  } | null,
): OfflineReward | null {
  if (!lastZoneId || !zoneData || zoneData.monsters.length === 0) return null;

  const offlineMs = Date.now() - new Date(lastActiveAt).getTime();
  const offlineMin = Math.floor(offlineMs / 60000);
  const cappedMin = Math.min(offlineMin, 480); // 최대 8시간

  if (cappedMin < 10) return null; // 10분 미만 무시

  // 평균 몬스터 보상
  const avgExp = zoneData.monsters.reduce((s, m) => s + m.expReward, 0) / zoneData.monsters.length;
  const avgGold = zoneData.monsters.reduce((s, m) => s + m.goldReward, 0) / zoneData.monsters.length;

  // 분당 약 2킬 × 30% 효율 = 분당 0.6킬
  const killsPerMin = 0.6;
  const totalKills = Math.floor(killsPerMin * cappedMin);

  // 재료 드롭 시뮬레이션
  const materials: Record<string, number> = {};
  for (const drop of zoneData.dropMaterials) {
    const expected = totalKills * drop.rate;
    const qty = Math.floor(expected * ((drop.minQty + drop.maxQty) / 2));
    if (qty > 0) materials[drop.materialId] = qty;
  }

  return {
    minutes: cappedMin,
    kills: totalKills,
    gold: Math.floor(avgGold * totalKills),
    exp: Math.floor(avgExp * totalKills),
    materials,
    zoneName: zoneData.name,
  };
}
