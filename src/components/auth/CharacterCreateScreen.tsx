/* =========================================================
   CHARACTER CREATE SCREEN — 캐릭터 생성 (클래스 선택 + 닉네임)
   로그인 후 profiles.player_class가 NULL이면 표시
   ========================================================= */
import { useState } from 'react';
import { CLASS_CONFIGS } from '../../data/classData';
import { supabase } from '../../lib/supabase';
import type { PlayerClass } from '../../types';

const CLASSES: PlayerClass[] = ['knight', 'elf', 'wizard'];
const CLASS_ICONS: Record<PlayerClass, string> = {
  knight: '⚔️',
  elf: '🏹',
  wizard: '🔮',
};
const STAT_LABELS: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', wis: 'WIS', int: 'INT',
};

interface Props {
  userId: string;
  onComplete: () => void;
}

export default function CharacterCreateScreen({ userId, onComplete }: Props) {
  const [selectedClass, setSelectedClass] = useState<PlayerClass | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const config = selectedClass ? CLASS_CONFIGS[selectedClass] : null;

  const canSubmit = selectedClass && playerName.trim().length >= 2 && playerName.trim().length <= 12 && !loading;

  const handleSubmit = async () => {
    if (!selectedClass || !canSubmit) return;
    setError('');
    setLoading(true);

    const name = playerName.trim();

    try {
      // 닉네임 중복 체크
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('name', name)
        .maybeSingle();

      if (existing && existing.id !== userId) {
        setError('이미 사용 중인 닉네임입니다.');
        setLoading(false);
        return;
      }

      // 프로필 upsert (캐릭터 생성)
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          name,
          player_class: selectedClass,
          level: 1,
          exp: 0,
          gold: 0,
          stat_str: 0,
          stat_dex: 0,
          stat_con: 0,
          stat_wis: 0,
          stat_int: 0,
        }, { onConflict: 'id' });

      if (upsertError) {
        setError(upsertError.message);
        setLoading(false);
        return;
      }

      onComplete();
    } catch {
      setError('오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={panelStyle}>
        {/* 제목 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            fontFamily: "'Space Grotesk', var(--font-display)",
            fontSize: 24,
            fontWeight: 800,
            color: 'var(--accent)',
            letterSpacing: '-0.02em',
          }}>
            캐릭터 생성
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-mute)', marginTop: 4 }}>
            클래스를 선택하고 닉네임을 입력하세요
          </div>
        </div>

        {/* 클래스 카드 3개 */}
        <div style={{
          display: 'flex', gap: 12,
          justifyContent: 'center', flexWrap: 'wrap',
          marginBottom: 20,
        }}>
          {CLASSES.map((cls) => {
            const cfg = CLASS_CONFIGS[cls];
            const isSelected = selectedClass === cls;
            return (
              <button
                key={cls}
                onClick={() => setSelectedClass(cls)}
                style={{
                  width: 180,
                  padding: '16px 14px',
                  background: isSelected ? 'color-mix(in oklch, var(--accent) 12%, var(--bg-panel))' : 'var(--bg-panel)',
                  border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border-soft)',
                  borderRadius: 'var(--r-md)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s',
                  boxShadow: isSelected ? '0 0 12px color-mix(in oklch, var(--accent) 25%, transparent)' : 'none',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {/* 아이콘 */}
                <div style={{ fontSize: 32, marginBottom: 6 }}>
                  {CLASS_ICONS[cls]}
                </div>
                {/* 이름 */}
                <div style={{
                  fontSize: 'var(--fs-base)',
                  fontWeight: 800,
                  color: isSelected ? 'var(--accent)' : 'var(--text)',
                }}>
                  {cfg.nameKo}
                </div>
                <div style={{
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-mute)',
                  marginBottom: 8,
                }}>
                  {cfg.nameEn}
                </div>
                {/* 기본 스탯 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '2px 8px',
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-dim)',
                  marginBottom: 8,
                }}>
                  {(['str', 'dex', 'con', 'wis', 'int'] as const).map((stat) => (
                    <div key={stat} style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontWeight: stat === cfg.primaryStat ? 700 : 400,
                      color: stat === cfg.primaryStat ? 'var(--accent)' : 'var(--text-dim)',
                    }}>
                      <span>{STAT_LABELS[stat]}</span>
                      <span>{cfg.baseStats[stat]}</span>
                    </div>
                  ))}
                </div>
                {/* 전투 방식 */}
                <div style={{
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-mute)',
                  borderTop: '1px solid var(--border-soft)',
                  paddingTop: 6,
                  marginTop: 4,
                }}>
                  {cfg.combatStyle === 'melee' && '근접 공격'}
                  {cfg.combatStyle === 'ranged_bow' && '원거리 (활)'}
                  {cfg.combatStyle === 'ranged_magic' && '원거리 (마법)'}
                  {' | AC방어 /'}
                  {cfg.acDefenseDivisor}
                </div>
                {/* 설명 */}
                <div style={{
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-mute)',
                  marginTop: 6,
                  lineHeight: 1.4,
                }}>
                  {cfg.description}
                </div>
              </button>
            );
          })}
        </div>

        {/* 선택된 클래스 상세 */}
        {config && (
          <div style={{
            background: 'var(--bg-sunken)',
            borderRadius: 'var(--r-sm)',
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 'var(--fs-sm)',
            color: 'var(--text-dim)',
            textAlign: 'center',
          }}>
            추천 스탯 배분: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{config.recommendedStats}</span>
          </div>
        )}

        {/* 닉네임 입력 */}
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="닉네임 (2~12자)"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={12}
            style={inputStyle}
            autoComplete="off"
          />
        </div>

        {/* 에러 */}
        {error && (
          <div style={{
            fontSize: 'var(--fs-sm)',
            color: 'var(--danger)',
            textAlign: 'center',
            padding: '6px 8px',
            background: 'color-mix(in oklch, var(--danger) 8%, transparent)',
            borderRadius: 'var(--r-xs)',
            marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        {/* 시작 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            ...btnStyle,
            opacity: canSubmit ? 1 : 0.4,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? '생성 중...' : '모험 시작'}
        </button>
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

const panelStyle: React.CSSProperties = {
  maxWidth: 640,
  width: '100%',
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
  fontSize: 'var(--fs-base)',
  fontFamily: 'var(--font-ui)',
  outline: 'none',
  boxSizing: 'border-box',
  textAlign: 'center',
};

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 'var(--r-sm)',
  color: 'var(--bg-canvas)',
  fontSize: 'var(--fs-base)',
  fontWeight: 700,
  fontFamily: 'var(--font-ui)',
  cursor: 'pointer',
};
