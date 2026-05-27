/* =========================================================
   SKILL BAR — 미니맵 우측 버튼 8슬롯
   1: HP 물약 설정 (모달)
   2: 초록 물약 토글 + 타이머
   3: 용기 물약 토글 + 타이머
   4: 변신주문서 설정 (모달) + 타이머
   5~8: 빈 슬롯
   ========================================================= */
import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { POTIONS, TRANSFORM_SCROLL_DURATION, getBravePotionId } from '../../data/gameData';
import HpPotionModal from './HpPotionModal';
import TransformScrollModal from './TransformScrollModal';
import BuffPotionButton, { useTimer } from './BuffPotionButton';
import type { ActiveBuff } from '../../types';

/* ── 색상 ── */
const POTION_COLORS: Record<string, string> = {
  red_potion: '#ef5350',
  crimson_potion: '#ff7043',
  clear_potion: '#e0e0e0',
};

const TS_COLOR = '#00e5ff';
const TS_EVENT_COLOR = '#F5C518';

/* ── 메인 스킬바 ── */
export default function SkillBar() {
  const [showHpModal, setShowHpModal] = useState(false);
  const [showTsModal, setShowTsModal] = useState(false);
  const potions = useGameStore((s) => s.potions);
  const materials = useGameStore((s) => s.materials);
  const selectedPotionId = useGameStore((s) => s.selectedPotionId);
  const potionAutoUse = useGameStore((s) => s.potionAutoUse);
  const activeBuffs = useGameStore((s) => s.activeBuffs);
  const transformScrollEnabled = useGameStore((s) => s.transformScrollEnabled);
  const transformScrollType = useGameStore((s) => s.transformScrollType);
  const playerClass = useGameStore((s) => s.playerClass);

  // 클래스별 brave 계열 물약 (L1J: 기사=용기, 요정=와퍼, 마법사=지혜)
  const bravePotionId = getBravePotionId(playerClass);
  const bravePotion = POTIONS[bravePotionId];

  const hpPotion = POTIONS[selectedPotionId];
  const hpCount = potions[selectedPotionId] ?? 0;
  const hpColor = POTION_COLORS[selectedPotionId] ?? '#ef5350';

  // 변신주문서 상태
  const now = Date.now();
  const tsBuff = activeBuffs.find(
    (b: ActiveBuff) => b.potionId === 'transform_scroll' && b.expiresAt > now,
  );
  const tsRemaining = tsBuff ? Math.max(0, Math.ceil((tsBuff.expiresAt - now) / 1000)) : 0;
  const tsProgress = tsBuff ? tsRemaining / TRANSFORM_SCROLL_DURATION : 0;
  const tsIsEvent = transformScrollType === 'event';
  const tsColor = tsIsEvent ? TS_EVENT_COLOR : TS_COLOR;
  const tsCount = tsIsEvent
    ? (materials['event_transform_scroll'] ?? 0)
    : (materials['transform_scroll'] ?? 0);
  const tsActive = transformScrollEnabled && !!tsBuff;
  useTimer(!!tsBuff);

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
            fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)',
            fontFamily: 'var(--font-mono)', fontWeight: 700, opacity: 0.5,
          }}>1</span>

          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: hpColor,
            boxShadow: potionAutoUse ? `0 0 6px ${hpColor}` : 'none',
          }} />
          <span style={{
            fontSize: 'var(--fs-2xs)', fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: potionAutoUse ? hpColor : 'var(--text-mute)',
            lineHeight: 1, marginTop: 1,
          }}>
            {potionAutoUse ? 'AUTO' : 'SET'}
          </span>

          {/* 보유 수 */}
          <span style={{
            position: 'absolute', bottom: 1, right: 2,
            fontSize: 'var(--fs-2xs)', fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            color: hpCount > 0 ? 'var(--text-dim)' : 'var(--danger)',
          }}>
            {hpCount}
          </span>
        </button>

        {/* 2번: 초록 물약 토글 */}
        <BuffPotionButton potionId="green_potion" label="초록 물약" slotNum={2} />

        {/* 3번: 클래스별 brave 물약 (L1J: 기사=용기, 요정=와퍼, 마법사=지혜) */}
        <BuffPotionButton potionId={bravePotionId} label={bravePotion.name} slotNum={3} />

        {/* 4번: 변신주문서 설정 (모달) */}
        <button
          onClick={() => setShowTsModal(true)}
          style={{
            flex: 1,
            minHeight: 0,
            border: transformScrollEnabled
              ? `1.5px solid ${tsColor}`
              : '1px solid var(--border-soft)',
            borderRadius: 'var(--r-sm)',
            background: tsActive
              ? `color-mix(in oklch, ${tsColor} 12%, var(--bg-panel))`
              : transformScrollEnabled
                ? `color-mix(in oklch, ${tsColor} 6%, var(--bg-panel))`
                : 'var(--bg-panel)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            padding: 0,
            position: 'relative',
            overflow: 'hidden',
            opacity: !transformScrollEnabled && tsCount === 0 && !tsBuff ? 0.35 : 1,
          }}
          title={`변신주문서 설정 — ${transformScrollEnabled ? 'ON' : 'OFF'} (${tsIsEvent ? '이벤트' : '일반'}: ${tsCount})`}
        >
          {/* 타이머 프로그레스 배경 */}
          {tsActive && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0,
              width: '100%',
              height: `${tsProgress * 100}%`,
              background: `color-mix(in oklch, ${tsColor} 20%, transparent)`,
              transition: 'height 1s linear',
              borderRadius: 'var(--r-sm)',
            }} />
          )}

          {/* 슬롯 번호 */}
          <span style={{
            position: 'absolute', top: 1, left: 3,
            fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)',
            fontFamily: 'var(--font-mono)', fontWeight: 700, opacity: 0.5,
          }}>4</span>

          {/* 주문서 아이콘 — 이벤트 버프 활성 시 별(1.5배+글로우), 그 외 원 */}
          <div style={{
            width: tsActive && tsIsEvent ? 14 : 10,
            height: tsActive && tsIsEvent ? 14 : 10,
            ...(tsActive && tsIsEvent
              ? { clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }
              : { borderRadius: '50%' }),
            background: tsColor,
            boxShadow: tsActive && tsIsEvent
              ? `0 0 8px ${tsColor}, 0 0 16px ${tsColor}60`
              : tsActive ? `0 0 6px ${tsColor}` : 'none',
            opacity: transformScrollEnabled ? 1 : 0.4,
            zIndex: 1, marginBottom: 1,
            transition: 'all 0.3s ease',
          }} />

          {/* 남은 시간 or ON/OFF */}
          {tsActive ? (
            <span style={{
              fontSize: 'var(--fs-2xs)', fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              color: tsColor, zIndex: 1, lineHeight: 1,
            }}>
              {Math.floor(tsRemaining / 60)}:{String(tsRemaining % 60).padStart(2, '0')}
            </span>
          ) : (
            <span style={{
              fontSize: 'var(--fs-2xs)', fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: transformScrollEnabled ? tsColor : 'var(--text-mute)',
              zIndex: 1, lineHeight: 1,
            }}>
              {transformScrollEnabled ? 'ON' : 'SET'}
            </span>
          )}

          {/* 보유 수 */}
          <span style={{
            position: 'absolute', bottom: 1, right: 2,
            fontSize: 'var(--fs-2xs)', fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            color: tsCount > 0 ? 'var(--text-dim)' : 'var(--danger)',
            zIndex: 1,
          }}>
            {tsCount}
          </span>
        </button>

        {/* 5~8: 빈 슬롯 */}
        {[5, 6, 7, 8].map((n) => (
          <button
            key={n}
            style={{
              flex: 1,
              minHeight: 0,
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)',
              background: 'var(--bg-panel)',
              color: 'var(--text-mute)',
              fontSize: 'var(--fs-xs)',
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

      {/* 변신주문서 모달 */}
      {showTsModal && <TransformScrollModal onClose={() => setShowTsModal(false)} />}
    </>
  );
}
