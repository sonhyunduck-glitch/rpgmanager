/* =========================================================
   SUBCLASS SELECT MODAL — 기사 Lv.30 전직 선택
   탱커형(Tank) / 공격형(Attack) 두 갈래
   ========================================================= */
import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { PLAYER_SKILLS } from '../../data/playerSkillData';
import type { KnightSubclass } from '../../types';

interface SubclassOption {
  id: KnightSubclass;
  icon: string;
  nameKo: string;
  description: string;
  color: string;
  borderColor: string;
  skillIds: number[];
}

const OPTIONS: SubclassOption[] = [
  {
    id: 'tank',
    icon: '\u{1F6E1}', // 🛡️
    nameKo: '탱커 기사',
    description: 'AC 방어 특화. 버프 스킬로 극한의 방어력을 달성합니다.',
    color: 'var(--info)',
    borderColor: 'oklch(0.55 0.15 250)',
    skillIds: [88, 90, 91, 92, 93, 94],
  },
  {
    id: 'attack',
    icon: '\u{2694}', // ⚔️
    nameKo: '공격 기사',
    description: 'STR 기반 물리 공격 스킬로 강력한 추가 대미지를 줍니다.',
    color: 'var(--danger)',
    borderColor: 'oklch(0.55 0.20 25)',
    skillIds: [87, 89, 95, 96, 97, 98],
  },
];

export default function SubclassSelectModal() {
  const selectSubclass = useGameStore(s => s.selectSubclass);
  const dismissSubclassChoice = useGameStore(s => s.dismissSubclassChoice);
  const [selected, setSelected] = useState<KnightSubclass | null>(null);
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = () => {
    if (!selected) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    selectSubclass(selected);
  };

  const handleCancel = () => {
    if (confirming) {
      setConfirming(false);
      return;
    }
    dismissSubclassChoice();
  };

  return (
    <>
      {/* 오버레이 */}
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 999,
      }} />

      {/* 모달 */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--s-4)',
        zIndex: 1000,
        width: 'min(440px, 92vw)',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--s-3)' }}>
          <div style={{
            fontSize: 'var(--fs-lg)', fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: 'var(--accent)',
          }}>
            Lv.30 전직
          </div>
          <div style={{
            fontSize: 'var(--fs-xs)', color: 'var(--text-mute)',
            fontFamily: 'var(--font-mono)',
            marginTop: 'var(--s-1)',
          }}>
            기사의 전문 분야를 선택하세요
          </div>
        </div>

        {/* 서브클래스 카드 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
          {OPTIONS.map(opt => {
            const isSelected = selected === opt.id;
            const skills = opt.skillIds
              .map(id => PLAYER_SKILLS.find(s => s.id === id))
              .filter(Boolean);

            return (
              <button
                key={opt.id}
                onClick={() => { setSelected(opt.id); setConfirming(false); }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: isSelected
                    ? 'rgba(255,255,255,0.06)'
                    : 'var(--bg-sunken)',
                  border: `2px solid ${isSelected ? opt.borderColor : 'var(--border-soft)'}`,
                  borderRadius: 'var(--r-md)',
                  padding: 'var(--s-3)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                  boxShadow: isSelected ? `0 0 12px ${opt.borderColor}40` : 'none',
                }}
              >
                {/* 카드 헤더 */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
                  marginBottom: 'var(--s-2)',
                }}>
                  <span style={{ fontSize: 24 }}>{opt.icon}</span>
                  <span style={{
                    fontSize: 'var(--fs-base)', fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: isSelected ? opt.color : 'var(--text)',
                  }}>
                    {opt.nameKo}
                  </span>
                </div>

                {/* 설명 */}
                <div style={{
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-dim)',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 'var(--s-2)',
                  lineHeight: 1.5,
                }}>
                  {opt.description}
                </div>

                {/* 스킬 목록 */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                  {skills.map(s => s && (
                    <div key={s.id} style={{
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-mute)',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}>
                      <span>
                        <span style={{ color: opt.color, fontWeight: 600 }}>
                          {s.skillType === 'buff' ? '▲' : '★'}
                        </span>
                        {' '}{s.name} (Lv.{s.requiredLevel})
                      </span>
                      <span style={{ color: 'var(--text-mute)', opacity: 0.7 }}>
                        {s.skillType === 'buff' && s.buffEffect?.acBonus
                          ? `AC ${s.buffEffect.acBonus}`
                          : s.skillType === 'buff' && s.buffEffect?.atkSpeedMult
                            ? `공속 x${s.buffEffect.atkSpeedMult}`
                            : s.skillType === 'buff' && s.buffEffect?.dmgBonus
                              ? `추타 ${s.buffEffect.dmgBonus > 0 ? '+' : ''}${s.buffEffect.dmgBonus}`
                              : s.skillType === 'attack'
                                ? `${s.damageValue}+${s.damageDiceCount}d${s.damageDice}`
                                : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* 경고 */}
        <div style={{
          fontSize: 'var(--fs-xs)',
          fontFamily: 'var(--font-mono)',
          color: 'var(--warning)',
          textAlign: 'center',
          marginTop: 'var(--s-3)',
          opacity: 0.8,
        }}>
          {confirming
            ? `정말 "${OPTIONS.find(o => o.id === selected)?.nameKo}"(으)로 전직하시겠습니까?`
            : '전직은 변경할 수 없습니다'}
        </div>

        {/* 버튼 */}
        <div style={{
          display: 'flex', gap: 'var(--s-2)',
          marginTop: 'var(--s-2)',
        }}>
          <button
            onClick={handleCancel}
            style={{
              flex: 1,
              padding: 'var(--s-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 600,
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--text-mute)',
              cursor: 'pointer',
            }}
          >
            {confirming ? '취소' : '나중에'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected}
            style={{
              flex: 1,
              padding: 'var(--s-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 700,
              background: selected
                ? (confirming ? 'var(--warning)' : OPTIONS.find(o => o.id === selected)?.borderColor ?? 'var(--accent)')
                : 'var(--bg-sunken)',
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)',
              color: selected ? '#000' : 'var(--text-mute)',
              cursor: selected ? 'pointer' : 'not-allowed',
              opacity: selected ? 1 : 0.5,
            }}
          >
            {confirming ? '확인' : '전직하기'}
          </button>
        </div>
      </div>
    </>
  );
}
