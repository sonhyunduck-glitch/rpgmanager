/* =========================================================
   SKILL BAR — 미니맵 우측 버튼 8슬롯
   1: HP 물약 설정 (모달)
   2: 초록 물약 토글 + 타이머
   3: 용기 물약 토글 + 타이머
   4~8: 빈 슬롯
   ========================================================= */
import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { POTIONS } from '../../data/gameData';
import HpPotionModal from './HpPotionModal';
import BuffPotionButton from './BuffPotionButton';

/* ── 색상 ── */
const POTION_COLORS: Record<string, string> = {
  red_potion: '#ef5350',
  crimson_potion: '#ff7043',
  clear_potion: '#42a5f5',
};

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
