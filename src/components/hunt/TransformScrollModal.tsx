/* =========================================================
   변신주문서 설정 모달 — 일반 / 이벤트 선택 + 자동사용 토글
   ========================================================= */
import { useGameStore } from '../../store/gameStore';
import { getTransformScrollSpeed } from '../../data/gameData';
import { useTimer } from './BuffPotionButton';
import type { ActiveBuff } from '../../types';

const COLOR_NORMAL = '#00e5ff';
const COLOR_EVENT  = '#F5C518';

export default function TransformScrollModal({ onClose }: { onClose: () => void }) {
  const materials = useGameStore(s => s.materials);
  const level = useGameStore(s => s.level);
  const activeBuffs = useGameStore(s => s.activeBuffs);
  const transformScrollEnabled = useGameStore(s => s.transformScrollEnabled);
  const transformScrollType = useGameStore(s => s.transformScrollType);
  const toggleTransformScroll = useGameStore(s => s.toggleTransformScroll);
  const setTransformScrollType = useGameStore(s => s.setTransformScrollType);

  const normalCount = materials['transform_scroll'] ?? 0;
  const eventCount  = materials['event_transform_scroll'] ?? 0;

  const normalSpeed = getTransformScrollSpeed(level);
  const eventSpeed  = getTransformScrollSpeed(80);

  const now = Date.now();
  const buff = activeBuffs.find(
    (b: ActiveBuff) => b.potionId === 'transform_scroll' && b.expiresAt > now,
  );
  const remaining = buff ? Math.max(0, Math.ceil((buff.expiresAt - now) / 1000)) : 0;
  useTimer(!!buff);

  const scrollOptions: {
    type: 'normal' | 'event';
    label: string;
    desc: string;
    count: number;
    color: string;
    atkMult: number;
    moveMult: number;
  }[] = [
    {
      type: 'normal', label: '변신주문서', desc: `Lv.${level} 기준`,
      count: normalCount, color: COLOR_NORMAL,
      atkMult: normalSpeed.atk, moveMult: normalSpeed.move,
    },
    {
      type: 'event', label: '이벤트 변신주문서', desc: 'Lv.80 고정',
      count: eventCount, color: COLOR_EVENT,
      atkMult: eventSpeed.atk, moveMult: eventSpeed.move,
    },
  ];

  return (
    <>
      {/* 오버레이 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 999,
        }}
      />
      {/* 모달 */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--s-4)',
        zIndex: 1000, minWidth: 280,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 'var(--s-3)',
        }}>
          <span style={{
            fontSize: 'var(--fs-base)', fontWeight: 700,
            fontFamily: 'var(--font-display)', color: 'var(--text)',
          }}>
            변신주문서 설정
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-mute)', fontSize: 'var(--fs-md)',
              cursor: 'pointer', padding: '2px 6px',
            }}
          >
            X
          </button>
        </div>

        {/* 주문서 선택 */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 'var(--s-2)',
          marginBottom: 'var(--s-3)',
        }}>
          {scrollOptions.map(opt => {
            const selected = transformScrollType === opt.type;
            return (
              <button
                key={opt.type}
                onClick={() => setTransformScrollType(opt.type)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--s-3)',
                  padding: '10px 12px',
                  borderRadius: 'var(--r-sm)',
                  border: selected
                    ? `2px solid ${opt.color}`
                    : '1px solid var(--border-soft)',
                  background: selected
                    ? `color-mix(in oklch, ${opt.color} 12%, var(--bg-panel))`
                    : 'var(--bg-panel)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textAlign: 'left',
                }}
              >
                {/* 라디오 닷 */}
                <div style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: selected ? `3px solid ${opt.color}` : '2px solid var(--text-mute)',
                  background: selected ? opt.color : 'transparent',
                  boxShadow: selected ? `0 0 8px ${opt.color}` : 'none',
                  flexShrink: 0,
                }} />

                {/* 정보 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700, fontSize: 'var(--fs-sm)',
                    color: selected ? opt.color : 'var(--text)',
                    textShadow: selected ? `0 0 6px ${opt.color}40` : 'none',
                  }}>
                    {opt.label}
                  </div>
                  <div style={{
                    fontSize: 'var(--fs-xs)', color: 'var(--text-mute)',
                    fontFamily: 'var(--font-mono)', marginTop: 2,
                  }}>
                    공속 x{opt.atkMult.toFixed(2)} / 이속 x{opt.moveMult.toFixed(2)}
                    <span style={{ marginLeft: 6, opacity: 0.7 }}>({opt.desc})</span>
                  </div>
                </div>

                {/* 보유 수 */}
                <div style={{
                  fontFamily: 'var(--font-mono)', fontWeight: 800,
                  fontSize: 'var(--fs-base)',
                  color: opt.count > 0 ? opt.color : 'var(--danger)',
                  flexShrink: 0,
                }}>
                  {opt.count}
                </div>
              </button>
            );
          })}
        </div>

        {/* 자동 사용 토글 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
          padding: '8px 12px',
          background: 'var(--bg-panel)',
          borderRadius: 'var(--r-sm)',
          border: '1px solid var(--border-soft)',
          marginBottom: buff ? 'var(--s-2)' : 0,
        }}>
          <span style={{
            fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-dim)',
            flex: 1,
          }}>
            자동 사용
          </span>
          <button
            onClick={toggleTransformScroll}
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--r-xs)',
              border: transformScrollEnabled
                ? '1px solid var(--success)'
                : '1px solid var(--border-soft)',
              background: transformScrollEnabled
                ? 'color-mix(in oklch, var(--success) 15%, transparent)'
                : 'var(--bg-sunken)',
              color: transformScrollEnabled ? 'var(--success)' : 'var(--text-mute)',
              fontSize: 'var(--fs-xs)', fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
            }}
          >
            {transformScrollEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* 활성 버프 타이머 */}
        {buff && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
            padding: '8px 12px',
            background: 'var(--bg-panel)',
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--border-soft)',
          }}>
            <span style={{
              fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-dim)',
              flex: 1,
            }}>
              {buff.name}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 800,
              fontSize: 'var(--fs-sm)',
              color: COLOR_NORMAL,
            }}>
              {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
