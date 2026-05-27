/* =========================================================
   DB SYNC — 게임 상태를 Supabase에 주기적 동기화
   localStorage = 빠른 캐시 / Supabase DB = 원본
   ========================================================= */
import { supabase } from './supabase';
import { touchZonePresence, removeZonePresence, getZonePlayerCount, getZonePlayers } from './db';
import type { Equipment } from '../types';

let _userId: string | null = null;
let _syncTimer: ReturnType<typeof setInterval> | null = null;
let _dirty = false;
let _setStore: ((partial: Record<string, unknown>) => void) | null = null;

/** store의 set 함수 등록 (zonePlayerCount 갱신용) */
export function setStoreSetter(fn: (partial: Record<string, unknown>) => void) {
  _setStore = fn;
}

/**
 * 현재 인증된 유저 ID 설정
 * @param skipTimer true면 userId만 설정하고 30초 타이머는 시작하지 않음
 *                  (initFromDB에서 DB 로드 전에 userId만 필요할 때 사용)
 *                  DB 로드 완료 후 skipTimer 없이 다시 호출하면 타이머 시작
 */
export function setSyncUserId(userId: string | null, skipTimer?: boolean) {
  _userId = userId;
  if (userId && !_syncTimer && !skipTimer) {
    // 30초마다 자동 동기화
    _syncTimer = setInterval(() => {
      if (_dirty) {
        flushSync();
      } else {
        // dirty 아니어도 last_active_at만 갱신 (오프라인 보상 오작동 방지)
        heartbeatOnly();
        refreshZonePlayerCount().catch(() => {});
      }
    }, 30_000);
  }
  if (!userId && _syncTimer) {
    clearInterval(_syncTimer);
    _syncTimer = null;
  }
}

/** 변경 플래그 설정 (다음 동기화 시 DB에 저장) */
export function markDirty() {
  _dirty = true;
}

// ── 프로필 저장 ──

export async function syncProfile(state: {
  playerClass: string;
  subclass?: string | null;
  level: number;
  exp: number;
  gold: number;
  title: string;
  currentHp: number;
  maxHp: number;
  statAllocation: { str: number; dex: number; con: number; wis: number; int: number };
  hunt: { zoneId: string | null };
  selectedPotionId: string;
  potionAutoUse: boolean;
  potionAutoThreshold: number;
  potionAutoBuy: boolean;
}) {
  if (!_userId) return;
  await supabase.from('profiles').update({
    player_class: state.playerClass,
    subclass: state.subclass ?? null,
    level: state.level,
    exp: state.exp,
    gold: state.gold,
    title: state.title,
    current_hp: state.currentHp,
    max_hp: state.maxHp,
    stat_str: state.statAllocation.str,
    stat_dex: state.statAllocation.dex,
    stat_con: state.statAllocation.con,
    stat_wis: state.statAllocation.wis,
    stat_int: state.statAllocation.int,
    last_zone_id: state.hunt.zoneId,
    last_active_at: new Date().toISOString(),
    selected_potion: state.selectedPotionId,
    potion_auto_use: state.potionAutoUse,
    potion_auto_threshold: state.potionAutoThreshold,
    potion_auto_buy: state.potionAutoBuy,
  }).eq('id', _userId);
}

// ── 아이템 동기화 ──

interface EquipSlots {
  equippedWeapon: Equipment | null;
  equippedTshirt: Equipment | null;
  equippedArmor: Equipment | null;
  equippedHelmet: Equipment | null;
  equippedCloak: Equipment | null;
  equippedGloves: Equipment | null;
  equippedBoots: Equipment | null;
  equippedShield: Equipment | null;
  equippedNecklace: Equipment | null;
  equippedRing: Equipment | null;
  equippedRing2: Equipment | null;
  equippedBelt: Equipment | null;
  equippedEarring: Equipment | null;
}

const SLOT_KEYS: (keyof EquipSlots)[] = [
  'equippedWeapon', 'equippedTshirt', 'equippedArmor', 'equippedHelmet',
  'equippedCloak', 'equippedGloves', 'equippedBoots', 'equippedShield',
  'equippedNecklace', 'equippedRing', 'equippedRing2', 'equippedBelt',
  'equippedEarring',
];

const SLOT_TO_TYPE: Record<string, string> = {
  equippedWeapon: 'weapon', equippedTshirt: 'tshirt', equippedArmor: 'armor',
  equippedHelmet: 'helmet', equippedCloak: 'cloak', equippedGloves: 'gloves',
  equippedBoots: 'boots', equippedShield: 'shield', equippedNecklace: 'necklace',
  equippedRing: 'ring', equippedRing2: 'ring2', equippedBelt: 'belt',
  equippedEarring: 'earring',
};

function equipToRow(eq: Equipment, equipped: boolean, slot: string | null) {
  return {
    uid: eq.uid,
    user_id: _userId!,
    template_id: eq.templateId,
    name: eq.name,
    type: eq.type,
    base_atk: eq.baseAtk,
    base_atk_large: eq.baseAtkLarge,
    base_def: eq.baseDef,
    enhance_level: eq.enhanceLevel,
    safe_enchant: eq.safeEnchant,          // ← 추가: 안전 강화 수치
    max_enhance: eq.maxEnhance,
    is_two_handed: eq.isTwoHanded ?? false, // ← 추가: 양손 무기 여부
    bonuses: eq.bonuses as Record<string, unknown>,
    bonus_effects: eq.bonusEffects,
    sell_price: eq.sellPrice,
    weight: eq.weight,
    equipped,
    equipped_slot: slot,
  };
}

export async function syncAllItems(
  inventory: Equipment[],
  slots: EquipSlots,
) {
  if (!_userId) return;

  const rows: ReturnType<typeof equipToRow>[] = [];

  // 인벤토리
  for (const eq of inventory) {
    rows.push(equipToRow(eq, false, null));
  }

  // 장착 슬롯
  for (const key of SLOT_KEYS) {
    const eq = slots[key];
    if (eq) rows.push(equipToRow(eq, true, SLOT_TO_TYPE[key]));
  }

  // upsert로 아이템 동기화 (원자적: 삭제 후 삽입 대신 단일 upsert)
  // 1) 현재 소유 uid 목록
  const currentUids = new Set(rows.map(r => r.uid));

  // 2) DB에 있지만 더 이상 소유하지 않는 아이템 삭제
  const { data: dbItems } = await supabase
    .from('items')
    .select('uid')
    .eq('user_id', _userId);
  const staleUids = (dbItems ?? [])
    .map((r: { uid: string }) => r.uid)
    .filter((uid: string) => !currentUids.has(uid));
  if (staleUids.length > 0) {
    await supabase.from('items').delete().in('uid', staleUids);
  }

  // 3) 현재 아이템 upsert (신규 + 갱신)
  if (rows.length > 0) {
    await supabase.from('items').upsert(rows, { onConflict: 'uid' });
  }
}

/** 아이템 1개 추가 (드롭 획득) */
export async function syncAddItem(eq: Equipment) {
  if (!_userId) return;
  await supabase.from('items').upsert(equipToRow(eq, false, null), { onConflict: 'uid' });
}

/** 아이템 1개 삭제 (판매, 파괴) */
export async function syncDeleteItem(uid: string) {
  if (!_userId) return;
  await supabase.from('items').delete().eq('uid', uid);
}

/** 아이템 1개 업데이트 (강화, 장착/해제) */
export async function syncUpdateItem(eq: Equipment, equipped: boolean, slot: string | null) {
  if (!_userId) return;
  await supabase.from('items').upsert(equipToRow(eq, equipped, slot), { onConflict: 'uid' });
}

// ── 재료 동기화 ──

export async function syncMaterials(materials: Record<string, number>) {
  if (!_userId) return;
  const rows = Object.entries(materials)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ user_id: _userId!, material_id: id, quantity: qty }));

  // 수량 0인 재료 삭제 + 나머지 upsert (비원자적 전체삭제→삽입 방지)
  const zeroIds = Object.entries(materials)
    .filter(([, qty]) => qty <= 0)
    .map(([id]) => id);
  if (zeroIds.length > 0) {
    await supabase.from('materials').delete()
      .eq('user_id', _userId).in('material_id', zeroIds);
  }
  if (rows.length > 0) {
    await supabase.from('materials').upsert(rows, { onConflict: 'user_id,material_id' });
  }
}

// ── 포션 동기화 ──

export async function syncPotions(potions: Record<string, number>) {
  if (!_userId) return;
  const rows = Object.entries(potions)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ user_id: _userId!, potion_id: id, quantity: qty }));

  // 수량 0인 포션 삭제 + 나머지 upsert (비원자적 전체삭제→삽입 방지)
  const zeroIds = Object.entries(potions)
    .filter(([, qty]) => qty <= 0)
    .map(([id]) => id);
  if (zeroIds.length > 0) {
    await supabase.from('potions').delete()
      .eq('user_id', _userId).in('potion_id', zeroIds);
  }
  if (rows.length > 0) {
    await supabase.from('potions').upsert(rows, { onConflict: 'user_id,potion_id' });
  }
}

// ── DB에서 로드 ──

export async function loadFromDB(): Promise<{
  profile: Record<string, unknown>;
  items: Record<string, unknown>[];
  materials: Record<string, number>;
  potions: Record<string, number>;
} | null> {
  if (!_userId) return null;

  const [profileRes, itemsRes, matsRes, potRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', _userId).maybeSingle(),
    supabase.from('items').select('*').eq('user_id', _userId),
    supabase.from('materials').select('material_id, quantity').eq('user_id', _userId),
    supabase.from('potions').select('potion_id, quantity').eq('user_id', _userId),
  ]);

  if (!profileRes.data) return null;

  // ⚠️ items 쿼리 에러 시 빈 배열 대신 null 반환 → hasDBItems 오판 방지
  // 네트워크 오류로 data=null이 되면, initFromDB에서 "DB에 아이템 없음"으로 오판하여
  // 기본 초기 장비가 DB를 덮어쓰는 치명적 버그 발생.
  if (itemsRes.error) {
    console.error('[dbSync] items 쿼리 실패 — DB 장비 보존을 위해 null 반환:', itemsRes.error);
    return null;
  }

  const materials: Record<string, number> = {};
  for (const row of matsRes.data ?? []) {
    materials[row.material_id] = row.quantity;
  }

  const potions: Record<string, number> = {};
  for (const row of potRes.data ?? []) {
    potions[row.potion_id] = row.quantity;
  }

  return {
    profile: profileRes.data,
    items: itemsRes.data ?? [],
    materials,
    potions,
  };
}

// ── 전체 동기화 (30초 주기) ──

let _getState: (() => Record<string, unknown>) | null = null;

export function setStateGetter(fn: () => Record<string, unknown>) {
  _getState = fn;
}

async function flushSync() {
  if (!_userId || !_getState) return;
  _dirty = false;

  const state = _getState() as any;
  try {
    // zone_presence heartbeat + 접속자 수 갱신 (사냥 중일 때만)
    if (_userId && state.hunt?.status === 'hunting' && state.hunt?.zoneId) {
      touchZonePresence(_userId).catch(() => {});
      refreshZonePlayerCount().catch(() => {});
    }

    await Promise.all([
      syncProfile(state),
      syncAllItems(state.inventory, {
        equippedWeapon: state.equippedWeapon,
        equippedTshirt: state.equippedTshirt,
        equippedArmor: state.equippedArmor,
        equippedHelmet: state.equippedHelmet,
        equippedCloak: state.equippedCloak,
        equippedGloves: state.equippedGloves,
        equippedBoots: state.equippedBoots,
        equippedShield: state.equippedShield,
        equippedNecklace: state.equippedNecklace,
        equippedRing: state.equippedRing,
        equippedRing2: state.equippedRing2,
        equippedBelt: state.equippedBelt,
        equippedEarring: state.equippedEarring,
      }),
      syncMaterials(state.materials),
      syncPotions(state.potions),
    ]);
  } catch (e) {
    console.error('[dbSync] flush error:', e);
    _dirty = true; // 다음에 재시도
  }
}

/** last_active_at만 갱신 (dirty 아닐 때 heartbeat) */
async function heartbeatOnly() {
  if (!_userId) return;
  try {
    await supabase.from('profiles').update({
      last_active_at: new Date().toISOString(),
    }).eq('id', _userId);
  } catch { /* ignore */ }
}

/** 존 접속자 수 + 목록 갱신 (30초마다 호출) */
async function refreshZonePlayerCount() {
  if (!_userId || !_getState || !_setStore) return;
  const state = _getState() as any;
  const zoneId = state.hunt?.zoneId;
  if (!zoneId || state.hunt?.status !== 'hunting' || zoneId === 'map_training') return;
  try {
    const [count, players] = await Promise.all([
      getZonePlayerCount(zoneId),
      getZonePlayers(zoneId),
    ]);
    _setStore({
      zonePlayerCount: Math.max(1, count),
      zonePlayers: players,
    });
  } catch { /* ignore */ }
}

/** 즉시 동기화 (로그아웃, 탭 닫기 전) */
export async function flushNow() {
  // 존 접속 정보 삭제
  if (_userId) removeZonePresence(_userId).catch(() => {});

  _dirty = true;
  await flushSync();
  // 아이템도 동기화
  if (_getState) {
    const state = _getState() as any;
    await syncAllItems(state.inventory, {
      equippedWeapon: state.equippedWeapon,
      equippedTshirt: state.equippedTshirt,
      equippedArmor: state.equippedArmor,
      equippedHelmet: state.equippedHelmet,
      equippedCloak: state.equippedCloak,
      equippedGloves: state.equippedGloves,
      equippedBoots: state.equippedBoots,
      equippedShield: state.equippedShield,
      equippedNecklace: state.equippedNecklace,
      equippedRing: state.equippedRing,
      equippedRing2: state.equippedRing2,
      equippedBelt: state.equippedBelt,
      equippedEarring: state.equippedEarring,
    });
  }
}
