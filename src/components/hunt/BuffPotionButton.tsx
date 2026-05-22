/* =========================================================
   버프 물약 버튼 (토글 + 타이머)
   ========================================================= */
import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { POTIONS } from '../../data/gameData';
import type { ActiveBuff } from '../../types';

/* ── 색상 ── */
const POTION_COLORS: Record<string, string> = {
  green_potion: '#66bb6a',
  courage_potion: '#ab47bc',
};

/* ── 타이머 훅: 매초 리렌더 ── */
export function useTimer(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
}

/* ── 버프 물약 버튼 ── */
export default function BuffPotionButton({
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
        fontSize: 'var(--fs-2xs)',
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
          fontSize: 'var(--fs-2xs)', fontWeight: 800,
          fontFamily: 'var(--font-mono)',
          color,
          zIndex: 1,
          lineHeight: 1,
        }}>
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
        </span>
      ) : (
        <span style={{
          fontSize: 'var(--fs-2xs)', fontWeight: 700,
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
        fontSize: 'var(--fs-2xs)',
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
