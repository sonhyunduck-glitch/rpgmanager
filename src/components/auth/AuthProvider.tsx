/* =========================================================
   AUTH PROVIDER — 인증 상태 관리 + 캐릭터 생성 게이트
   로그인 전: LoginScreen 표시
   로그인 후 + 캐릭터 미생성: CharacterCreateScreen 표시
   로그인 후 + 캐릭터 존재: children (App) 렌더링
   ========================================================= */
import { useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, onAuthStateChange } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import LoginScreen from './LoginScreen';
import CharacterCreateScreen from './CharacterCreateScreen';

interface Props {
  children: (user: User) => React.ReactNode;
}

type CharacterState = 'loading' | 'no_character' | 'ready';

export default function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [charState, setCharState] = useState<CharacterState>('loading');

  // 캐릭터 존재 여부 확인
  const checkCharacter = useCallback(async (u: User) => {
    setCharState('loading');
    try {
      const { data } = await supabase
        .from('profiles')
        .select('player_class')
        .eq('id', u.id)
        .maybeSingle();

      if (data?.player_class) {
        setCharState('ready');
      } else {
        setCharState('no_character');
      }
    } catch {
      // DB 접근 실패 시 캐릭터 생성으로 유도
      setCharState('no_character');
    }
  }, []);

  useEffect(() => {
    // 초기 세션 확인
    getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
      if (u) checkCharacter(u);
    });

    // 세션 변경 구독
    const { data: { subscription } } = onAuthStateChange((u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        checkCharacter(u);
      } else {
        setCharState('loading');
      }
    });

    return () => subscription.unsubscribe();
  }, [checkCharacter]);

  if (loading || (user && charState === 'loading')) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-canvas)',
      }}>
        <div style={{
          fontFamily: "'Space Grotesk', var(--font-display)",
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--accent)',
          animation: 'pulse 1.5s infinite',
        }}>
          Loading...
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (charState === 'no_character') {
    return (
      <CharacterCreateScreen
        userId={user.id}
        onComplete={() => setCharState('ready')}
      />
    );
  }

  return <>{children(user)}</>;
}
