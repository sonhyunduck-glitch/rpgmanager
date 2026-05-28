/* =========================================================
   OFFLINE REWARD MODAL — 오프라인 사냥 보상 팝업
   로그인 시 5분+ 부재 → 보상 표시
   온라인 효율 100% + 소모품 역산 차감
   ========================================================= */
import { useGameStore } from '../../store/gameStore';
import { MATERIALS, POTIONS } from '../../data/gameData';
import { LABEL, STAT_VALUE } from '../../styles/shared';

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

/** 소모품 이름 조회 (물약 → POTIONS, 주문서 → MATERIALS) */
function getConsumableName(id: string): string {
  if (POTIONS[id]) return POTIONS[id].name;
  if (MATERIALS[id]) return MATERIALS[id].name;
  return id;
}

export default function OfflineRewardModal() {
  const reward = useGameStore(s => s.offlineReward);
  const claim = useGameStore(s => s.claimOfflineReward);

  if (!reward) return null;

  const matEntries = Object.entries(reward.materials).filter(([, q]) => q > 0);
  const potionEntries = Object.entries(reward.potionsUsed).filter(([, q]) => q > 0);
  const scrollEntries = Object.entries(reward.scrollsUsed).filter(([, q]) => q > 0);
  const hasConsumables = potionEntries.length > 0 || scrollEntries.length > 0;
  // 동일 이름 장비 그룹핑 (name → count)
  const itemCounts: { name: string; count: number }[] = [];
  for (const item of (reward.items ?? [])) {
    const existing = itemCounts.find(e => e.name === item.name);
    if (existing) existing.count++;
    else itemCounts.push({ name: item.name, count: 1 });
  }

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
          maxHeight: '85vh',
          overflowY: 'auto',
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

        {/* 획득 재료 */}
        {matEntries.length > 0 && (
          <div style={{
            background: 'var(--bg-sunken)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--r-sm)',
            padding: 'var(--s-2)',
          }}>
            <div style={{ ...LABEL, fontSize: 'var(--fs-2xs)', marginBottom: 4 }}>획득 재료</div>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 4,
            }}>
              {matEntries.map(([matId, qty]) => (
                <span key={matId} style={{
                  fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-mono)',
                  color: 'var(--text-dim)',
                  padding: '1px 5px',
                  background: 'color-mix(in oklch, var(--info) 8%, transparent)',
                  borderRadius: 'var(--r-xs)',
                  border: '1px solid var(--border-soft)',
                }}>
                  {MATERIALS[matId]?.name ?? matId} x{qty}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 획득 장비 */}
        {itemCounts.length > 0 && (
          <div style={{
            background: 'var(--bg-sunken)',
            border: '1px solid color-mix(in oklch, var(--accent) 25%, var(--border-soft))',
            borderRadius: 'var(--r-sm)',
            padding: 'var(--s-2)',
          }}>
            <div style={{ ...LABEL, fontSize: 'var(--fs-2xs)', marginBottom: 4, color: 'var(--accent)' }}>
              획득 장비
            </div>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 4,
            }}>
              {itemCounts.map((item, i) => (
                <span key={i} style={{
                  fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-mono)',
                  color: 'var(--text-dim)',
                  padding: '1px 5px',
                  background: 'color-mix(in oklch, var(--accent) 8%, transparent)',
                  borderRadius: 'var(--r-xs)',
                  border: '1px solid color-mix(in oklch, var(--accent) 15%, var(--border-soft))',
                }}>
                  {item.name}{item.count > 1 ? ` x${item.count}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 소모품 사용 내역 */}
        {hasConsumables && (
          <div style={{
            background: 'color-mix(in oklch, var(--danger) 5%, var(--bg-sunken))',
            border: '1px solid color-mix(in oklch, var(--danger) 20%, var(--border-soft))',
            borderRadius: 'var(--r-sm)',
            padding: 'var(--s-2)',
          }}>
            <div style={{ ...LABEL, fontSize: 'var(--fs-2xs)', marginBottom: 4, color: 'var(--danger)' }}>
              소모품 사용
            </div>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 4,
            }}>
              {[...potionEntries, ...scrollEntries].map(([id, qty]) => (
                <span key={id} style={{
                  fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-mono)',
                  color: 'color-mix(in oklch, var(--danger) 80%, var(--text-dim))',
                  padding: '1px 5px',
                  background: 'color-mix(in oklch, var(--danger) 8%, transparent)',
                  borderRadius: 'var(--r-xs)',
                  border: '1px solid color-mix(in oklch, var(--danger) 15%, var(--border-soft))',
                }}>
                  {getConsumableName(id)} -{qty}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 효율 안내 */}
        <div style={{
          fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)',
          fontFamily: 'var(--font-mono)', textAlign: 'center',
          fontStyle: 'italic',
        }}>
          온라인 효율 100% | 최대 24시간
        </div>

        {/* 보상 수령 버튼 */}
        <button
          onClick={claim}
          style={{
            width: '100%', padding: '10px 0',
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
