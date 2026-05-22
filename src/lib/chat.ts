/* =========================================================
   CHAT SERVICE — Supabase Realtime 기반 채팅
   - 전역 채팅 (global)
   - 최근 50건 로드 + 실시간 수신
   ========================================================= */
import { supabase } from './supabase';
import type { ChatMessage } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

/** DB row → ChatMessage 변환 */
function rowToMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: row.id as number,
    channel: row.channel as string,
    userId: row.user_id as string,
    userName: row.user_name as string,
    userLevel: row.user_level as number,
    guildName: (row.guild_name as string) ?? null,
    text: row.text as string,
    createdAt: row.created_at as string,
  };
}

/** 최근 N건 로드 */
export async function loadRecentMessages(
  channel: string,
  limit = 50,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_logs')
    .select('*')
    .eq('channel', channel)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[chat] load error:', error);
    return [];
  }

  return (data ?? []).map(rowToMessage).reverse();
}

/** 메시지 전송 — 성공 시 삽입된 메시지 반환 */
export async function sendMessage(
  channel: string,
  userId: string,
  userName: string,
  userLevel: number,
  guildName: string | null,
  text: string,
): Promise<ChatMessage | null> {
  const { data, error } = await supabase.from('chat_logs').insert({
    channel,
    user_id: userId,
    user_name: userName,
    user_level: userLevel,
    guild_name: guildName,
    text: text.trim(),
  }).select().single();

  if (error || !data) {
    console.error('[chat] send error:', error);
    return null;
  }
  return rowToMessage(data);
}

/** Realtime 구독 — INSERT 이벤트만 수신 */
export function subscribeToChannel(
  channel: string,
  onMessage: (msg: ChatMessage) => void,
): RealtimeChannel {
  const realtimeChannel = supabase
    .channel(`chat:${channel}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_logs',
        filter: `channel=eq.${channel}`,
      },
      (payload) => {
        onMessage(rowToMessage(payload.new));
      },
    )
    .subscribe();

  return realtimeChannel;
}

/** 구독 해제 */
export function unsubscribeChannel(channel: ReturnType<typeof subscribeToChannel>) {
  supabase.removeChannel(channel);
}
