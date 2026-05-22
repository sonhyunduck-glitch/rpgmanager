/* =========================================================
   LOGIN SCREEN — 로그인 / 회원가입 화면
   ========================================================= */
import { useState } from 'react';
import { signIn, signUp } from '../../lib/auth';

type Mode = 'login' | 'signup';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const result = await signIn(email, password);
        if (result.error) setError(result.error.message);
      } else {
        if (!playerName.trim()) {
          setError('닉네임을 입력하세요.');
          setLoading(false);
          return;
        }
        if (playerName.trim().length < 2 || playerName.trim().length > 12) {
          setError('닉네임은 2~12자입니다.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('비밀번호는 6자 이상이어야 합니다.');
          setLoading(false);
          return;
        }
        const result = await signUp(email, password, playerName.trim());
        if (result.error) {
          setError(result.error.message);
        } else {
          setSignupDone(true);
        }
      }
    } catch (err) {
      setError('오류가 발생했습니다.');
    }

    setLoading(false);
  };

  if (signupDone) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)', textAlign: 'center' }}>
            가입 완료!
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', marginTop: 8 }}>
            이메일 인증 후 로그인해주세요.
          </div>
          <button
            onClick={() => { setSignupDone(false); setMode('login'); }}
            style={btnStyle}
          >
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            fontFamily: "'Space Grotesk', var(--font-display)",
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--accent)',
            letterSpacing: '-0.02em',
          }}>
            RPG MANAGER
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4 }}>
            {mode === 'login' ? '로그인' : '회원가입'}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="닉네임 (2~12자)"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={12}
              style={inputStyle}
              autoComplete="off"
            />
          )}

          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            autoComplete="email"
          />

          <input
            type="password"
            placeholder="비밀번호 (6자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          {error && (
            <div style={{
              fontSize: 11,
              color: 'var(--danger)',
              textAlign: 'center',
              padding: '6px 8px',
              background: 'color-mix(in oklch, var(--danger) 8%, transparent)',
              borderRadius: 'var(--r-xs)',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...btnStyle,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
          </button>
        </form>

        {/* Toggle mode */}
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--info)',
              fontSize: 11,
              cursor: 'pointer',
              textDecoration: 'underline',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ──

const containerStyle: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg-canvas)',
};

const cardStyle: React.CSSProperties = {
  width: 320,
  background: 'var(--bg-panel)',
  border: '1px solid var(--border-soft)',
  borderRadius: 'var(--r-md)',
  padding: '28px 24px',
  boxShadow: 'var(--shadow-lg)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--bg-sunken)',
  border: '1px solid var(--border-soft)',
  borderRadius: 'var(--r-sm)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font-ui)',
  outline: 'none',
  boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 'var(--r-sm)',
  color: 'var(--bg-canvas)',
  fontSize: 13,
  fontWeight: 700,
  fontFamily: 'var(--font-ui)',
  cursor: 'pointer',
  marginTop: 4,
};
