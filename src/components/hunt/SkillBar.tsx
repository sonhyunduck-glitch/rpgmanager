/* =========================================================
   SKILL BAR — 미니맵 우측 버튼 8슬롯
   1: HP 물약 설정 (모달)
   2: 초록 물약 토글 + 타이머
   3: 용기 물약 토글 + 타이머
   4~8: 빈 슬롯
   ========================================================= */
import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { POTIONS } from '../../data/gameData';
import type { ActiveBuff } from '../../types';

/* ── 색상 ── */
const POTION_COLORS: Record<string, string> = {
  red_potion: '#ef5350',
  crimson_potion: '#ff7043',
  clear_potion: '#42a5f5',
  green_potion: '#66bb6a',
  courage_potion: '#ab47bc',
};

/* ── 타이머 훅: 매초 리렌더 ── */
function useTimer(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
}

/* ── HP 물약 모달 ── */
function HpPotionModal({ onClose }: { onClose: () => void }) {
  const potions = useGameStore((s) => s.potions);
  const selectedPotionId = useGameStore((s) => s.selectedPotionId);
  const potionAutoUse = useGameStore((s) => s.potionAutoUse);
  const potionAutoThreshold = useGameStore((s) => s.potionAutoThreshold);
  const potionAutoBuy = useGameStore((s) => s.potionAutoBuy);
  const setSelectedPotion = useGameStore((s) => s.setSelectedPotion);
  const togglePotionAutoUse = useGameStore((s) => s.togglePotionAutoUse);
  const setPotionAutoThreshold = useGameStore((s) => s.setPotionAutoThreshold);
  const togglePotionAutoBuy = useGameStore((s) => s.togglePotionAutoBuy);

  const HEAL_POTIONS = ['red_potion', 'crimson_potion', 'clear_potion'] as const;
  const THRESHOLDS = [30, 50, 70];

  return (
    <>
      {/* 오버레이 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 999,
        }}
      />
      {/* 모달 */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-soft)',
          borderRadius: 'var(--r-md)',
          padding: 'var(--s-4)',
          zIndex: 1000,
          minWidth: 280,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
      >
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 'var(--s-3)',
        }}>
          <span style={{
            fontSize: 14, fontWeight: 700,
            fontFamily: 'var(--font-display)', color: 'var(--text)',
          }}>
            체력회복제 설정
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-mute)', fontSize: 16,
              cursor: 'pointer', padding: '2px 6px',
            }}
          >
            X
          </button>
        </div>

        {/* 물약 선택 */}
        <div style={{
          display: 'flex', gap: 'var(--s-2)', marginBottom: 'var(--s-3)',
        }}>
          {HEAL_POTIONS.map((id) => {
            const p = POTIONS[id];
            const count = potions[id] ?? 0;
            const color = POTION_COLORS[id];
            const selected = selectedPotionId === id;
            return (
              <button
                key={id}
                onClick={() => setSelectedPotion(id)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: 'var(--r-sm)',
                  border: selected
                    ? `2px solid ${color}`
                    : '1px solid var(--border-soft)',
                  background: selected
                    ? `color-mix(in oklch, ${color} 15%, var(--bg-panel))`
                    : 'var(--bg-panel)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: color,
                  boxShadow: selected ? `0 0 8px ${color}` : 'none',
                }} />
                <span style={{
                  fontSize: 10, fontWeight: 700, color,
                  fontFamily: 'var(--font-mono)',
                }}>
                  {p.name}
                </span>
                <span style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)',
                  color: count > 0 ? 'var(--text-dim)' : 'var(--danger)',
                  fontWeight: 700,
                }}>
                  x{count}
                </span>
                <span style={{
                  fontSize: 8, color: 'var(--text-mute)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  HP {p.healMin}~{p.healMax}
                </span>
              </button>
            );
          })}
        </div>

        {/* 자동사용 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
          marginBottom: 'var(--s-2)',
          padding: '8px 12px',
          background: 'var(--bg-panel)',
          borderRadius: 'var(--r-sm)',
          border: '1px solid var(--border-soft)',
        }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-dim)',
            flex: 1,
          }}>
            자동 사용
          </span>
          <button
            onClick={togglePotionAutoUse}
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--r-xs)',
              border: potionAutoUse
                ? '1px solid var(--success)'
                : '1px solid var(--border-soft)',
              background: potionAutoUse
                ? 'color-mix(in oklch, var(--success) 15%, transparent)'
                : 'var(--bg-sunken)',
              color: potionAutoUse ? 'var(--success)' : 'var(--text-mute)',
              fontSize: 10, fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
            }}
          >
            {potionAutoUse ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* 임계값 */}
        {potionAutoUse && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
            marginBottom: 'var(--s-2)',
            padding: '8px 12px',
            background: 'var(--bg-panel)',
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--border-soft)',
          }}>
            <span style={{
              fontSize: 11, fontWeight: 600, color: 'var(--text-dim)',
              flex: 1,
            }}>
              HP 임계값
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {THRESHOLDS.map((t) => (
                <button
                  key={t}
                  onClick={() => setPotionAutoThreshold(t)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 'var(--r-xs)',
                    border: potionAutoThreshold === t
                      ? '1px solid var(--warning)'
                      : '1px solid var(--border-soft)',
                    background: potionAutoThreshold === t
                      ? 'color-mix(in oklch, var(--warning) 15%, transparent)'
                      : 'var(--bg-sunken)',
                    color: potionAutoThreshold === t ? 'var(--warning)' : 'var(--text-mute)',
                    fontSize: 10, fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                  }}
                >
                  {t}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 자동구매 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
          padding: '8px 12px',
          background: 'var(--bg-panel)',
          borderRadius: 'var(--r-sm)',
          border: '1px solid var(--border-soft)',
        }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-dim)',
            flex: 1,
          }}>
            자동 구매
          </span>
          <button
            onClick={togglePotionAutoBuy}
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--r-xs)',
              border: potionAutoBuy
                ? '1px solid var(--accent)'
                : '1px solid var(--border-soft)',
              background: potionAutoBuy
                ? 'color-mix(in oklch, var(--accent) 15%, transparent)'
                : 'var(--bg-sunken)',
              color: potionAutoBuy ? 'var(--accent)' : 'var(--text-mute)',
              fontSize: 10, fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
            }}
          >
            {potionAutoBuy ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ── 버프 물약 버튼 (토글 + 타이머) ── */
function BuffPotionButton({
  potionId,
  label,
  slotNum,
}: {
  potionId: string;
  label: string;
  slotNum: number;
}) {
  const potions = useGameStore((s) => s.potions);
  const activeBuffs = useGameStore((s) => s.activeBuffs);
  const buffEnabled = useGameStore((s) =>
    potionId === 'green_potion' ? s.greenPotionEnabled : s.couragePotionEnabled,
  );
  const toggleBuff = useGameStore((s) =>
    potionId === 'green_potion' ? s.toggleGreenPotion : s.toggleCouragePotion,
  );

  const count = potions[potionId] ?? 0;
  const color = POTION_COLORS[potionId] ?? 'var(--text-mute)';
  const now = Date.now();
  const buff = activeBuffs.find(
    (b: ActiveBuff) => b.potionId === potionId && b.expiresAt > now,
  );
  const remaining = buff ? Math.max(0, Math.ceil((buff.expiresAt - now) / 1000)) : 0;
  const totalDuration = POTIONS[potionId]?.buffDuration ?? 300;
  const progress = buff ? remaining / totalDuration : 0;

  useTimer(!!buff);

  const isActive = buffEnabled && !!buff;
  const canUse = count > 0 || !!buff;

  return (
    <button
      onClick={() => toggleBuff()}
      style={{
        flex: 1,
        minHeight: 0,
        border: buffEnabled
          ? `1.5px solid ${color}`
          : '1px solid var(--border-soft)',
        borderRadius: 'var(--r-sm)',
        background: isActive
          ? `color-mix(in oklch, ${color} 12%, var(--bg-panel))`
          : buffEnabled
            ? `color-mix(in oklch, ${color} 6%, var(--bg-panel))`
            : 'var(--bg-panel)',
        cursor: canUse || buffEnabled ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
        padding: 0,
        position: 'relative',
        overflow: 'hidden',
        opacity: !buffEnabled && count === 0 && !buff ? 0.35 : 1,
      }}
      title={`${label} — ${buffEnabled ? 'ON' : 'OFF'} (보유: ${count})`}
    >
      {/* 타이머 프로그레스 배경 */}
      {isActive && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: `${progress * 100}%`,
          background: `color-mix(in oklch, ${color} 20%, transparent)`,
          transition: 'height 1s linear',
          borderRadius: 'var(--r-sm)',
        }} />
      )}

      {/* 슬롯 번호 */}
      <span style={{
        position: 'absolute',
        top: 1,
        left: 3,
        fontSize: 7,
        color: 'var(--text-mute)',
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        opacity: 0.5,
      }}>
        {slotNum}
      </span>

      {/* 물약 아이콘 */}
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: color,
        boxShadow: isActive ? `0 0 6px ${color}` : 'none',
        opacity: buffEnabled ? 1 : 0.4,
        zIndex: 1,
        marginBottom: 1,
      }} />

      {/* 남은 시간 or ON/OFF */}
      {isActive ? (
        <span style={{
          fontSize: 8, fontWeight: 800,
          fontFamily: 'var(--font-mono)',
          color,
          zIndex: 1,
          lineHeight: 1,
        }}>
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
        </span>
      ) : (
        <span style={{
          fontSize: 7, fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          color: buffEnabled ? color : 'var(--text-mute)',
          zIndex: 1,
          lineHeight: 1,
        }}>
          {buffEnabled ? 'ON' : 'OFF'}
        </span>
      )}

      {/* 보유 수 오버레이 */}
      <span style={{
        position: 'absolute',
        bottom: 1,
        right: 2,
        fontSize: 7,
        fontWeight: 800,
        fontFamily: 'var(--font-mono)',
        color: count > 0 ? 'var(--text-dim)' : 'var(--danger)',
        zIndex: 1,
      }}>
        {count}
      </span>
    </button>
  );
}

/* ── 메인 스킬바 ── */
export default function SkillBar() {
  const [showHpModal, setShowHpModal] = useState(false);
  const potions = useGameStore((s) => s.potions);
  const selectedPotionId = useGameStore((s) => s.selectedPotionId);
  const potionAutoUse = useGameStore((s) => s.potionAutoUse);

  const hpPotion = POTIONS[selectedPotionId];
  const hpCount = potions[selectedPotionId] ?? 0;
  const hpColor = POTION_COLORS[selectedPotionId] ?? '#ef5350';

  return (
    <>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        height: '100%',
      }}>
        {/* 1번: HP 물약 설정 */}
        <button
          onClick={() => setShowHpModal(true)}
          style={{
            flex: 1,
            minHeight: 0,
            border: potionAutoUse
              ? `1.5px solid ${hpColor}`
              : '1px solid var(--border-soft)',
            borderRadius: 'var(--r-sm)',
            background: potionAutoUse
              ? `color-mix(in oklch, ${hpColor} 10%, var(--bg-panel))`
              : 'var(--bg-panel)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            padding: 0,
            position: 'relative',
          }}
          title={`${hpPotion?.name ?? 'HP 물약'} 설정 (보유: ${hpCount})`}
        >
          {/* 슬롯 번호 */}
          <span style={{
            position: 'absolute', top: 1, left: 3,
            fontSize: 7, color: 'var(--text-mute)',
            fontFamily: 'var(--font-mono)', fontWeight: 700, opacity: 0.5,
          }}>1</span>

          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: hpColor,
            boxShadow: potionAutoUse ? `0 0 6px ${hpColor}` : 'none',
          }} />
          <span style={{
            fontSize: 7, fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: potionAutoUse ? hpColor : 'var(--text-mute)',
            lineHeight: 1, marginTop: 1,
          }}>
            {potionAutoUse ? 'AUTO' : 'SET'}
          </span>

          {/* 보유 수 */}
          <span style={{
            position: 'absolute', bottom: 1, right: 2,
            fontSize: 7, fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            color: hpCount > 0 ? 'var(--text-dim)' : 'var(--danger)',
          }}>
            {hpCount}
          </span>
        </button>

        {/* 2번: 초록 물약 토글 */}
        <BuffPotionButton potionId="green_potion" label="초록 물약" slotNum={2} />

        {/* 3번: 용기 물약 토글 */}
        <BuffPotionButton potionId="courage_potion" label="용기의 물약" slotNum={3} />

        {/* 4~8: 빈 슬롯 */}
        {[4, 5, 6, 7, 8].map((n) => (
          <button
            key={n}
            style={{
              flex: 1,
              minHeight: 0,
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)',
              background: 'var(--bg-panel)',
              color: 'var(--text-mute)',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              padding: 0,
              opacity: 0.3,
            }}
          >
            {n}
          </button>
        ))}
      </div>

      {/* HP 물약 모달 */}
      {showHpModal && <HpPotionModal onClose={() => setShowHpModal(false)} />}
    </>
  );
}
