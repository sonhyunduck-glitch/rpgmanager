/* =========================================================
   OFFLINE REWARD MODAL — 오프라인 사냥 보상 팝업
   로그인 시 10분 이상 부재 → 보상 표시
   ========================================================= */
import { useGameStore } from '../../store/gameStore';
import { MATERIALS } from '../../data/gameData';
import { LABEL, STAT_VALUE } from '../../styles/shared';

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

export default function OfflineRewardModal() {
  const reward = useGameStore(s => s.offlineReward);
  const claim = useGameStore(s => s.claimOfflineReward);
  const dismiss = useGameStore(s => s.dismissOfflineReward);

  if (!reward) return null;

  const matEntries = Object.entries(reward.materials);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--bg-panel)',
          border: '1.5px solid var(--accent)',
          borderRadius: 'var(--r-md)',
          padding: 'var(--s-5)',
          width: 340,
          display: 'flex', flexDirection: 'column',
          gap: 'var(--s-3)',
          boxShadow: '0 0 40px color-mix(in oklch, var(--accent) 20%, transparent)',
        }}
      >
        {/* 헤더 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 'var(--fs-md)', fontWeight: 700,
            color: 'var(--accent)',
            fontFamily: 'var(--font-display)',
          }}>
            오프라인 사냥 보상
          </div>
          <div style={{
            fontSize: 'var(--fs-xs)', color: 'var(--text-mute)',
            fontFamily: 'var(--font-mono)', marginTop: 4,
          }}>
            {reward.zoneName}에서 {formatDuration(reward.minutes)} 동안 사냥했습니다
          </div>
        </div>

        {/* 보상 그리드 */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 'var(--s-2)',
        }}>
          <RewardBox label="KILLS" value={reward.kills.toLocaleString()} color="var(--text)" />
          <RewardBox label="GOLD" value={reward.gold.toLocaleString()} color="var(--accent)" />
          <RewardBox label="EXP" value={reward.exp.toLocaleString()} color="var(--info)" />
        </div>

        {/* 재료 목록 */}
        {matEntries.length > 0 && (
          <div style={{
            background: 'var(--bg-sunken)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--r-sm)',
            padding: 'var(--s-2)',
          }}>
            <div style={{ ...LABEL, fontSize: 'var(--fs-2xs)', marginBottom: 4 }}>Materials</div>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 4,
            }}>
              {matEntries.map(([matId, qty]) => {
                const mat = MATERIALS[matId];
                return (
                  <span key={matId} style={{
                    fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-mono)',
                    color: 'var(--text-dim)',
                    padding: '1px 5px',
                    background: 'color-mix(in oklch, var(--info) 8%, transparent)',
                    borderRadius: 'var(--r-xs)',
                    border: '1px solid var(--border-soft)',
                  }}>
                    {mat?.name ?? matId} x{qty}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* 효율 안내 */}
        <div style={{
          fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)',
          fontFamily: 'var(--font-mono)', textAlign: 'center',
          fontStyle: 'italic',
        }}>
          오프라인 효율: 30% | 최대 8시간
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
          <button
            onClick={dismiss}
            style={{
              flex: 1, padding: '8px 0',
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)',
              background: 'var(--bg-sunken)',
              color: 'var(--text-mute)',
              fontSize: 'var(--fs-sm)', fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
            }}
          >
            포기
          </button>
          <button
            onClick={claim}
            style={{
              flex: 2, padding: '8px 0',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              background: 'linear-gradient(135deg, var(--accent), oklch(0.68 0.18 45))',
              color: '#fff',
              fontSize: 'var(--fs-sm)', fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
            }}
          >
            보상 수령
          </button>
        </div>
      </div>
    </div>
  );
}

function RewardBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'var(--bg-sunken)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-sm)',
      padding: 'var(--s-2)',
      textAlign: 'center',
    }}>
      <div style={{ ...LABEL, fontSize: 'var(--fs-2xs)', marginBottom: 2 }}>{label}</div>
      <div style={{ ...STAT_VALUE, fontSize: 'var(--fs-md)', color }}>{value}</div>
    </div>
  );
}
