/* =========================================================
   UPDATE MODAL — 강제 업데이트 + 서버 점검 모달
   Supabase Realtime으로 버전/점검 상태 감지
   ========================================================= */
import { useEffect, useState } from 'react';
import { APP_VERSION } from '../../lib/version';
import { supabase } from '../../lib/supabase';

interface MetaState {
  latestVersion: string | null;
  maintenance: boolean;
  maintenanceMsg: string;
}

export default function UpdateModal() {
  const [meta, setMeta] = useState<MetaState>({
    latestVersion: null,
    maintenance: false,
    maintenanceMsg: '',
  });
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    // 1) 초기 로드
    fetchMeta();

    // 2) Supabase Realtime 구독 (app_meta 테이블 변경 감지)
    const channel = supabase
      .channel('app_meta_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_meta' },
        () => { fetchMeta(); },
      )
      .subscribe();

    // 3) 폴백: 5분마다 폴링 (Realtime 연결 끊김 대비)
    const poll = setInterval(fetchMeta, 5 * 60 * 1000);

    return () => {
      channel.unsubscribe();
      clearInterval(poll);
    };
  }, []);

  async function fetchMeta() {
    try {
      const { data } = await supabase
        .from('app_meta')
        .select('key, value')
        .in('key', ['latestVersion', 'maintenance', 'maintenanceMsg']);

      if (!data) return;
      const map: Record<string, string> = {};
      data.forEach(row => { map[row.key] = row.value; });

      setMeta({
        latestVersion: map['latestVersion'] ?? null,
        maintenance: map['maintenance'] === 'true',
        maintenanceMsg: map['maintenanceMsg'] ?? '서버 점검 중입니다.',
      });
    } catch (e) {
      console.warn('[UpdateModal] meta fetch 실패:', e);
    }
  }

  // 강제 업데이트
  async function forceUpdate() {
    setUpdating(true);
    try {
      // 캐시 정리
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    } catch (e) {
      console.warn('[Update] 캐시 정리 실패:', e);
    }
    // cache-bust 쿼리로 강제 새 fetch
    const url = new URL(location.href);
    url.searchParams.set('_v', String(Date.now()));
    location.replace(url.toString());
  }

  // 버전 불일치 체크
  const needsUpdate = meta.latestVersion
    && meta.latestVersion !== APP_VERSION;

  // 아무것도 표시할 필요 없으면 null
  if (!needsUpdate && !meta.maintenance) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
    }}>
      <div style={{
        width: 340,
        maxWidth: '90vw',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-md)',
        padding: '32px 28px',
        textAlign: 'center',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* 점검 모달 (우선) */}
        {meta.maintenance ? (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🛠</div>
            <div style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: 12,
              fontFamily: 'var(--font-ui)',
            }}>
              서버 점검 중
            </div>
            <div style={{
              fontSize: 12,
              color: 'var(--text-dim)',
              lineHeight: 1.6,
              marginBottom: 20,
            }}>
              {meta.maintenanceMsg}
            </div>
            <div style={{
              fontSize: 11,
              color: 'var(--text-mute)',
              marginBottom: 16,
            }}>
              점검이 끝나면 자동으로 게임이 재개됩니다.
            </div>
            <button
              onClick={() => location.reload()}
              style={btnStyle}
            >
              새로고침
            </button>
          </>
        ) : (
          /* 업데이트 모달 */
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔄</div>
            <div style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: 12,
              fontFamily: 'var(--font-ui)',
            }}>
              새 버전이 출시되었습니다
            </div>
            <div style={{
              fontSize: 13,
              color: 'var(--text-dim)',
              marginBottom: 8,
              lineHeight: 1.6,
            }}>
              현재: <b>v{APP_VERSION}</b>
              <br />
              최신: <b style={{ color: 'var(--accent)' }}>v{meta.latestVersion}</b>
            </div>
            <div style={{
              fontSize: 11,
              color: 'var(--text-mute)',
              marginBottom: 20,
            }}>
              기존 버전은 더 이상 사용할 수 없습니다.
            </div>
            <button
              onClick={forceUpdate}
              disabled={updating}
              style={{
                ...btnStyle,
                opacity: updating ? 0.6 : 1,
                cursor: updating ? 'wait' : 'pointer',
              }}
            >
              {updating ? '업데이트 중…' : '지금 업데이트'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 'var(--r-sm)',
  color: 'var(--bg-canvas)',
  fontSize: 14,
  fontWeight: 700,
  fontFamily: 'var(--font-ui)',
  cursor: 'pointer',
};
