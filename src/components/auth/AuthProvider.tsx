/* =========================================================
   AUTH PROVIDER — 인증 상태 관리 + 로딩 화면
   로그인 전: LoginScreen 표시
   로그인 후: children (App) 렌더링
   ========================================================= */
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, onAuthStateChange } from '../../lib/auth';
import LoginScreen from './LoginScreen';

interface Props {
  children: (user: User) => React.ReactNode;
}

export default function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 초기 세션 확인
    getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
    });

    // 세션 변경 구독
    const { data: { subscription } } = onAuthStateChange((u) => {
      setUser(u);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
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

  return <>{children(user)}</>;
}
