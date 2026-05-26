/* =========================================================
   GUILD SERVICE — Supabase 기반 길드 CRUD
   ========================================================= */
import { supabase } from './supabase';

export interface GuildRow {
  id: string;
  name: string;
  leader_id: string;
  level: number;
  exp: number;
  max_members: number;
  notice: string;
  created_at: string;
}

export interface GuildMemberRow {
  guild_id: string;
  user_id: string;
  role: 'leader' | 'officer' | 'member';
  joined_at: string;
  // join from profiles
  name?: string;
  level?: number;
  player_class?: string | null;
  last_active_at?: string;
}

/** 길드 생성 */
export async function createGuild(
  name: string,
  leaderId: string,
): Promise<{ guild: GuildRow | null; error: string | null }> {
  // 이름 중복 체크
  const { data: existing } = await supabase
    .from('guilds')
    .select('id')
    .eq('name', name)
    .maybeSingle();

  if (existing) return { guild: null, error: '이미 존재하는 길드 이름입니다.' };

  const guildId = `guild_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const { error: insertErr } = await supabase.from('guilds').insert({
    id: guildId,
    name,
    leader_id: leaderId,
  });

  if (insertErr) return { guild: null, error: insertErr.message };

  // 리더를 멤버로 추가
  await supabase.from('guild_members').insert({
    guild_id: guildId,
    user_id: leaderId,
    role: 'leader',
  });

  // 프로필에 길드 ID 연결
  await supabase.from('profiles').update({ guild_id: guildId }).eq('id', leaderId);

  const { data: guild } = await supabase
    .from('guilds')
    .select('*')
    .eq('id', guildId)
    .single();

  return { guild: guild as GuildRow, error: null };
}

/** 길드 목록 조회 */
export async function listGuilds(): Promise<GuildRow[]> {
  const { data } = await supabase
    .from('guilds')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  return (data ?? []) as GuildRow[];
}

/** 길드 상세 + 멤버 수 */
export async function getGuild(guildId: string): Promise<GuildRow | null> {
  const { data } = await supabase
    .from('guilds')
    .select('*')
    .eq('id', guildId)
    .single();

  return data as GuildRow | null;
}

/** 길드 멤버 목록 (프로필 join) */
export async function getGuildMembers(guildId: string): Promise<GuildMemberRow[]> {
  const { data } = await supabase
    .from('guild_members')
    .select('guild_id, user_id, role, joined_at, profiles(name, level, player_class, last_active_at)')
    .eq('guild_id', guildId)
    .order('role', { ascending: true });

  if (!data) return [];

  return data.map((row: Record<string, unknown>) => {
    const profile = row.profiles as Record<string, unknown> | null;
    return {
      guild_id: row.guild_id as string,
      user_id: row.user_id as string,
      role: row.role as 'leader' | 'officer' | 'member',
      joined_at: row.joined_at as string,
      name: (profile?.name as string) ?? '???',
      level: (profile?.level as number) ?? 1,
      player_class: (profile?.player_class as string | null) ?? null,
      last_active_at: profile?.last_active_at as string | undefined,
    };
  });
}

/** 길드 가입 */
export async function joinGuild(
  guildId: string,
  userId: string,
): Promise<{ error: string | null }> {
  // 이미 가입 체크
  const { data: existing } = await supabase
    .from('guild_members')
    .select('user_id')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) return { error: '이미 가입된 길드입니다.' };

  // 멤버 수 체크
  const { count } = await supabase
    .from('guild_members')
    .select('*', { count: 'exact', head: true })
    .eq('guild_id', guildId);

  const guild = await getGuild(guildId);
  if (!guild) return { error: '길드를 찾을 수 없습니다.' };
  if ((count ?? 0) >= guild.max_members) return { error: '길드 정원이 가득 찼습니다.' };

  const { error } = await supabase.from('guild_members').insert({
    guild_id: guildId,
    user_id: userId,
    role: 'member',
  });

  if (error) return { error: error.message };

  // 프로필에 길드 ID 연결
  await supabase.from('profiles').update({ guild_id: guildId }).eq('id', userId);

  return { error: null };
}

/** 길드 탈퇴 */
export async function leaveGuild(
  guildId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('guild_members')
    .delete()
    .eq('guild_id', guildId)
    .eq('user_id', userId);

  if (error) return { error: error.message };

  // 프로필에서 길드 ID 제거
  await supabase.from('profiles').update({ guild_id: null }).eq('id', userId);

  return { error: null };
}

/** 공지사항 수정 (리더 전용) */
export async function updateGuildNotice(
  guildId: string,
  notice: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('guilds')
    .update({ notice })
    .eq('id', guildId);

  return { error: error?.message ?? null };
}

/** 길드 멤버 수 조회 */
export async function getGuildMemberCount(guildId: string): Promise<number> {
  const { count } = await supabase
    .from('guild_members')
    .select('*', { count: 'exact', head: true })
    .eq('guild_id', guildId);

  return count ?? 0;
}

/** 길드 해산 (멤버 1명=리더만 남았을 때만 가능) */
export async function dissolveGuild(
  guildId: string,
  leaderId: string,
): Promise<{ error: string | null }> {
  // 1) 멤버 수 확인 — 1명(리더만)이어야 해체 가능
  const { count } = await supabase
    .from('guild_members')
    .select('*', { count: 'exact', head: true })
    .eq('guild_id', guildId);
  if ((count ?? 0) !== 1) return { error: '멤버가 모두 탈퇴한 후 해산할 수 있습니다.' };

  // 2) 리더 프로필 guild_id 초기화
  await supabase.from('profiles').update({ guild_id: null }).eq('id', leaderId);

  // 3) 길드 삭제 (CASCADE로 guild_members도 삭제)
  const { error } = await supabase
    .from('guilds')
    .delete()
    .eq('id', guildId)
    .eq('leader_id', leaderId);
  if (error) return { error: error.message };

  return { error: null };
}
