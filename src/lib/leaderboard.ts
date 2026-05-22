/* =========================================================
   LEADERBOARD — Supabase 프로필 기반 레벨 랭킹
   ========================================================= */
import { supabase } from './supabase';

export interface LeaderboardEntry {
  id: string;
  name: string;
  level: number;
  title: string;
  guild_name: string | null;
  last_active_at: string;
}

/** 레벨 상위 N명 조회 */
export async function getTopPlayers(limit = 20): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, level, title, guild_id, last_active_at')
    .order('level', { ascending: false })
    .order('exp', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  // guild_id → guild_name 매핑
  const guildIds = [...new Set(data.filter(d => d.guild_id).map(d => d.guild_id))];
  let guildMap: Record<string, string> = {};

  if (guildIds.length > 0) {
    const { data: guilds } = await supabase
      .from('guilds')
      .select('id, name')
      .in('id', guildIds);

    if (guilds) {
      for (const g of guilds) {
        guildMap[g.id] = g.name;
      }
    }
  }

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    level: row.level,
    title: row.title,
    guild_name: row.guild_id ? (guildMap[row.guild_id] ?? null) : null,
    last_active_at: row.last_active_at,
  }));
}
