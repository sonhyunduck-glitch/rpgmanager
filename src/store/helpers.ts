/* =========================================================
   STORE HELPERS — UID 생성, 장비 유틸, localStorage 영속화
   gameStore.ts 에서 분리된 순수 함수 & 상수
   ========================================================= */
import type { Equipment, HuntSession, QueueItem, StatAllocation, ActiveBuff, PlayerClass, KnightSubclass } from '../types';
import { EQUIPMENT_TEMPLATES } from '../data/gameData';
import { APP_EPOCH } from '../lib/version';

// ── UID Generators ──

let uidCounter = Date.now();

/** Generates a unique ID for equipment items. */
export function genUid(): string {
  return `eq_${uidCounter++}`;
}

/** Generates a unique ID for combat-log entries. */
export function genLogId(): string {
  return `log_${uidCounter++}`;
}

// ── Equipment Helpers ──

/** Create a new Equipment instance from a template ID. */
export function createEquipment(templateId: string): Equipment {
  const t = EQUIPMENT_TEMPLATES[templateId];
  const eq: Equipment = {
    uid: genUid(),
    templateId: t.id,
    name: t.name,
    type: t.type,
    baseAtk: t.baseAtk,
    baseAtkLarge: t.baseAtkLarge,
    baseDef: t.baseDef,
    enhanceLevel: 0,
    safeEnchant: t.safeEnchant,
    maxEnhance: t.maxEnhance,
    bonuses: t.bonuses ? { ...t.bonuses } : {},
    bonusEffects: t.bonusEffects ? [...t.bonusEffects] : [],
    sellPrice: t.sellPrice,
    weight: t.weight,
  };
  if (t.isTwoHanded) eq.isTwoHanded = true;
  return eq;
}

/**
 * 장비의 전투용 총합 스탯.
 * 무기: baseAtk (기본 타격치는 강화로 변하지 않음, 전투 공식이 enchantLevel 별도 적용)
 * 방어구: baseDef + enhanceLevel (AC 감소 = 기본 + 강화)
 */
export function equipStat(eq: Equipment): number {
  if (eq.type === 'weapon' || eq.type === 'bow' || eq.type === 'staff') return eq.baseAtk;
  return eq.baseDef + eq.enhanceLevel;
}

/** Return the display name with enhance level prefix (e.g. "+3 철 검"). */
export function equipDisplayName(eq: Equipment): string {
  return eq.enhanceLevel > 0 ? `+${eq.enhanceLevel} ${eq.name}` : eq.name;
}

// ── Persistence (localStorage) ──

export const STORAGE_KEY = 'rpg-manager-save';

/**
 * Epoch Gate — 로컬 데이터의 epoch ≠ APP_EPOCH 이면 전체 삭제.
 * 데이터 초기화가 필요한 대규모 업데이트 시 APP_EPOCH를 올리면
 * 모든 유저의 로컬 캐시가 자동 폐기됨.
 */
export function enforceEpochGate(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    const localEpoch = saved?.epoch ?? 0;
    if (localEpoch !== APP_EPOCH) {
      console.warn(`[EpochGate] 로컬 epoch(${localEpoch}) ≠ APP_EPOCH(${APP_EPOCH}) → localStorage 삭제`);
      localStorage.removeItem(STORAGE_KEY);
      return true; // wiped
    }
    return false;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  }
}

/**
 * Load saved state from localStorage.
 * Returns `null` when no save exists or on parse failure.
 * Epoch gate가 먼저 실행되어야 함.
 */
export function loadState(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Persist a subset of game state to localStorage.
 *
 * Accepts a plain object (or full store snapshot) and cherry-picks only
 * the fields that should survive across sessions.  Hunting status is
 * normalised to "paused" so the player never resumes mid-fight on reload.
 */
export function saveState(state: {
  playerClass: PlayerClass;
  subclass?: KnightSubclass | null;
  playerName: string;
  level: number;
  exp: number;
  gold: number;
  title: string;
  currentHp: number;
  maxMp: number;
  currentMp: number;
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
  inventory: Equipment[];
  inventoryCapacity: number;
  materials: Record<string, number>;
  hunt: HuntSession;
  queue: QueueItem[];
  queueCapacity: number;
  statAllocation: StatAllocation;
  maxHp: number;
  potions: Record<string, number>;
  selectedPotionId: string;
  potionAutoUse: boolean;
  potionAutoThreshold: number;
  potionAutoBuy: boolean;
  activeBuffs: ActiveBuff[];
  bluePotionEnabled?: boolean;
  greenPotionEnabled?: boolean;
  couragePotionEnabled?: boolean;
  transformScrollEnabled?: boolean;
  transformScrollType?: 'normal' | 'event';
  equippedSkills: number[];
  disabledSkills?: number[];
}): void {
  try {
    const {
      playerClass, subclass, playerName, level, exp, gold, title, currentHp, maxMp, currentMp,
      equippedWeapon, equippedTshirt, equippedArmor, equippedHelmet, equippedCloak,
      equippedGloves, equippedBoots, equippedShield,
      equippedNecklace, equippedRing, equippedRing2, equippedBelt, equippedEarring,
      inventory, inventoryCapacity, materials,
      hunt, queue, queueCapacity,
      statAllocation, maxHp,
      potions, selectedPotionId, potionAutoUse, potionAutoThreshold, potionAutoBuy,
      activeBuffs,
      bluePotionEnabled, greenPotionEnabled, couragePotionEnabled, transformScrollEnabled, transformScrollType,
      equippedSkills, disabledSkills,
    } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      epoch: APP_EPOCH,
      playerClass, subclass, playerName, level, exp, gold, title, currentHp, maxMp, currentMp,
      equippedWeapon, equippedTshirt, equippedArmor, equippedHelmet, equippedCloak,
      equippedGloves, equippedBoots, equippedShield,
      equippedNecklace, equippedRing, equippedRing2, equippedBelt, equippedEarring,
      inventory, inventoryCapacity, materials,
      hunt: { ...hunt, status: hunt.status === 'hunting' ? 'paused' : hunt.status },
      queue, queueCapacity,
      statAllocation, maxHp,
      potions, selectedPotionId, potionAutoUse, potionAutoThreshold, potionAutoBuy,
      activeBuffs,
      bluePotionEnabled, greenPotionEnabled, couragePotionEnabled, transformScrollEnabled, transformScrollType,
      equippedSkills, disabledSkills,
    }));
  } catch {
    /* localStorage may be full or unavailable — silently ignore */
  }
}
