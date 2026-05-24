/* =========================================================
   PROFILE SERVICE — 다른 유저 프로필 + 장비 조회
   ========================================================= */
import { supabase } from './supabase';
import type { Equipment, EquipBonuses } from '../types';

export interface PlayerProfile {
  id: string;
  name: string;
  level: number;
  title: string;
  gold: number;
  stat_str: number;
  stat_dex: number;
  stat_con: number;
  stat_wis: number;
  stat_int: number;
  max_hp: number;
  current_hp: number;
  player_class: string | null;
  guild_id: string | null;
  guild_name: string | null;
  last_active_at: string;
  created_at: string;
}

export interface PlayerEquipment {
  equipped: Equipment[];     // 장착 중인 장비 (equipped = true)
  inventoryCount: number;    // 인벤토리 아이템 수
}

/** 유저 프로필 조회 */
export async function getPlayerProfile(userId: string): Promise<PlayerProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, level, title, gold, stat_str, stat_dex, stat_con, stat_wis, stat_int, max_hp, current_hp, player_class, guild_id, last_active_at, created_at')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  // guild_name 조회
  let guild_name: string | null = null;
  if (data.guild_id) {
    const { data: guild } = await supabase
      .from('guilds')
      .select('name')
      .eq('id', data.guild_id)
      .single();
    guild_name = guild?.name ?? null;
  }

  return { ...data, guild_name } as PlayerProfile;
}

/** 유저 장착 장비 조회 */
export async function getPlayerEquipment(userId: string): Promise<PlayerEquipment> {
  // 장착 장비
  const { data: eqData } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', userId)
    .eq('equipped', true);

  // 인벤토리 수
  const { count } = await supabase
    .from('items')
    .select('uid', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('equipped', false);

  const equipped: Equipment[] = (eqData ?? []).map(row => ({
    uid: row.uid,
    templateId: row.template_id,
    name: row.name,
    type: row.type,
    baseAtk: row.base_atk,
    baseAtkLarge: row.base_atk_large,
    baseDef: row.base_def,
    enhanceLevel: row.enhance_level,
    safeEnchant: row.safe_enchant ?? ((['weapon','bow','staff'].includes(row.type)) ? 6 : 4),
    maxEnhance: row.max_enhance,
    bonuses: (row.bonuses ?? {}) as EquipBonuses,
    bonusEffects: (row.bonus_effects ?? []) as string[],
    sellPrice: row.sell_price,
  }));

  return { equipped, inventoryCount: count ?? 0 };
}
