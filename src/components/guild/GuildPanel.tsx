/* =========================================================
   GUILD PANEL — 우측 패널: 길드 정보 + 멤버 + 관리
   미가입 → 길드 목록/생성
   가입중 → 길드 정보 + 멤버 리스트
   ========================================================= */
import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { NoGuildView } from './NoGuildView';
import { MyGuildView } from './MyGuildView';

/* ── 메인 길드 패널 ── */
export default function GuildPanel() {
  const userId = useGameStore((s) => s.authUserId);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  // 현재 유저의 길드 확인 + gameStore 동기화
  const checkGuild = useCallback(async () => {
    if (!userId) return;
    const { supabase } = await import('../../lib/supabase');
    const { data } = await supabase
      .from('guild_members')
      .select('guild_id')
      .eq('user_id', userId)
      .maybeSingle();

    const newGuildId = data?.guild_id ?? null;
    setGuildId(newGuildId);
    setChecked(true);

    // gameStore에 guildId/guildName 동기화
    if (newGuildId) {
      const { getGuild } = await import('../../lib/guild');
      const guild = await getGuild(newGuildId);
      useGameStore.setState({ guildId: newGuildId, guildName: guild?.name ?? null });
    } else {
      useGameStore.setState({ guildId: null, guildName: null });
    }
  }, [userId]);

  useEffect(() => { checkGuild(); }, [checkGuild]);

  if (!userId || !checked) {
    return (
      <div style={{
        height: '100%',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--s-2) var(--s-3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-mute)',
        fontSize: 'var(--fs-xs)',
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      height: '100%',
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-md)',
      padding: 'var(--s-2) var(--s-3)',
      overflow: 'hidden',
    }}>
      {guildId ? (
        <MyGuildView
          userId={userId}
          guildId={guildId}
          onLeft={() => {
            setGuildId(null);
            useGameStore.setState({ guildId: null, guildName: null });
          }}
        />
      ) : (
        <NoGuildView
          userId={userId}
          onJoined={() => checkGuild()}
        />
      )}
    </div>
  );
}
