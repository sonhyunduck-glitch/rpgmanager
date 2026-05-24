/* =========================================================
   CHARACTER CREATE SCREEN — 캐릭터 생성
   클래스 선택 + 스탯 배분 + 닉네임 입력
   로그인 후 profiles.player_class가 NULL이면 표시

   스탯 캡: base + 투자 ≤ 18 (기사 STR만 20)
   레벨업 보너스 스탯은 캡 없이 추가 가능
   ========================================================= */
import { useState, useCallback } from 'react';
import { CLASS_CONFIGS, getStatCap } from '../../data/classData';
import { supabase } from '../../lib/supabase';
import type { PlayerClass, StatKey } from '../../types';

const CLASSES: PlayerClass[] = ['knight', 'elf', 'wizard'];
const CLASS_ICONS: Record<PlayerClass, string> = {
  knight: '⚔️',
  elf: '🏹',
  wizard: '🔮',
};

const STAT_KEYS: StatKey[] = ['str', 'dex', 'con', 'wis', 'int'];
const STAT_META: Record<StatKey, { label: string; color: string }> = {
  str: { label: 'STR', color: 'var(--danger)' },
  dex: { label: 'DEX', color: 'var(--success)' },
  con: { label: 'CON', color: 'var(--info)' },
  wis: { label: 'WIS', color: 'var(--warning)' },
  int: { label: 'INT', color: 'var(--accent)' },
};

type StatAlloc = Record<StatKey, number>;
const ZERO_ALLOC: StatAlloc = { str: 0, dex: 0, con: 0, wis: 0, int: 0 };

interface Props {
  userId: string;
  onComplete: () => void;
}

export default function CharacterCreateScreen({ userId, onComplete }: Props) {
  const [selectedClass, setSelectedClass] = useState<PlayerClass | null>(null);
  const [alloc, setAlloc] = useState<StatAlloc>({ ...ZERO_ALLOC });
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const config = selectedClass ? CLASS_CONFIGS[selectedClass] : null;
  const initialPoints = config?.initialPoints ?? 0;
  const usedPoints = STAT_KEYS.reduce((s, k) => s + alloc[k], 0);
  const remaining = initialPoints - usedPoints;

  // 클래스 변경 시 스탯 초기화
  const handleSelectClass = useCallback((cls: PlayerClass) => {
    setSelectedClass(cls);
    setAlloc({ ...ZERO_ALLOC });
  }, []);

  const handlePlus = useCallback((stat: StatKey) => {
    if (!selectedClass || remaining <= 0) return;
    const base = CLASS_CONFIGS[selectedClass].baseStats;
    const cap = getStatCap(selectedClass, stat);
    const total = base[stat] + alloc[stat];
    if (total >= cap) return; // 캡 도달
    setAlloc(prev => ({ ...prev, [stat]: prev[stat] + 1 }));
  }, [selectedClass, alloc, remaining]);

  const handleMinus = useCallback((stat: StatKey) => {
    if (alloc[stat] <= 0) return;
    setAlloc(prev => ({ ...prev, [stat]: prev[stat] - 1 }));
  }, [alloc]);

  const canSubmit = selectedClass
    && playerName.trim().length >= 2
    && playerName.trim().length <= 12
    && remaining === 0
    && !loading;

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
          stat_str: alloc.str,
          stat_dex: alloc.dex,
          stat_con: alloc.con,
          stat_wis: alloc.wis,
          stat_int: alloc.int,
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
            fontSize: 24, fontWeight: 800,
            color: 'var(--accent)', letterSpacing: '-0.02em',
          }}>
            캐릭터 생성
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-mute)', marginTop: 4 }}>
            클래스를 선택하고 스탯을 배분하세요
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
                onClick={() => handleSelectClass(cls)}
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
                <div style={{ fontSize: 32, marginBottom: 6 }}>
                  {CLASS_ICONS[cls]}
                </div>
                <div style={{
                  fontSize: 'var(--fs-base)', fontWeight: 800,
                  color: isSelected ? 'var(--accent)' : 'var(--text)',
                }}>
                  {cfg.nameKo}
                </div>
                <div style={{
                  fontSize: 'var(--fs-xs)', color: 'var(--text-mute)', marginBottom: 8,
                }}>
                  {cfg.nameEn}
                </div>
                {/* 기본 스탯 */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: '2px 8px', fontSize: 'var(--fs-xs)',
                  color: 'var(--text-dim)', marginBottom: 8,
                }}>
                  {STAT_KEYS.map((stat) => (
                    <div key={stat} style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontWeight: stat === cfg.primaryStat ? 700 : 400,
                      color: stat === cfg.primaryStat ? 'var(--accent)' : 'var(--text-dim)',
                    }}>
                      <span>{STAT_META[stat].label}</span>
                      <span>{cfg.baseStats[stat]}</span>
                    </div>
                  ))}
                </div>
                {/* 전투 방식 */}
                <div style={{
                  fontSize: 'var(--fs-xs)', color: 'var(--text-mute)',
                  borderTop: '1px solid var(--border-soft)',
                  paddingTop: 6, marginTop: 4,
                }}>
                  {cfg.combatStyle === 'melee' && '근접 공격'}
                  {cfg.combatStyle === 'ranged_bow' && '원거리 (활)'}
                  {cfg.combatStyle === 'ranged_magic' && '원거리 (마법)'}
                  {' | AC방어 /'}
                  {cfg.acDefenseDivisor}
                </div>
                <div style={{
                  fontSize: 'var(--fs-xs)', color: 'var(--text-mute)',
                  marginTop: 6, lineHeight: 1.4,
                }}>
                  {cfg.description}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── 스탯 배분 (클래스 선택 후) ── */}
        {config && (
          <div style={{
            background: 'var(--bg-sunken)',
            borderRadius: 'var(--r-sm)',
            padding: '12px 14px',
            marginBottom: 16,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 10,
            }}>
              <span style={{
                fontSize: 'var(--fs-sm)', fontWeight: 700,
                color: 'var(--text-dim)',
              }}>
                스탯 배분
              </span>
              <span style={{
                fontSize: 'var(--fs-sm)', fontWeight: 700,
                color: remaining > 0 ? 'var(--accent)' : 'var(--success)',
              }}>
                남은 포인트: {remaining}
              </span>
            </div>

            <div style={{
              fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)',
              marginBottom: 8, textAlign: 'center',
            }}>
              추천: <span style={{ color: 'var(--accent)' }}>{config.recommendedStats}</span>
              {' · '}최대 {selectedClass === 'knight' ? 'STR 20 / 나머지 18' : '18'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {STAT_KEYS.map((stat) => {
                const base = config.baseStats[stat];
                const a = alloc[stat];
                const total = base + a;
                const cap = getStatCap(selectedClass!, stat);
                const atCap = total >= cap;
                const { label, color } = STAT_META[stat];

                return (
                  <div key={stat} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 8px',
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 'var(--r-sm)',
                  }}>
                    {/* 라벨 */}
                    <span style={{
                      fontSize: 'var(--fs-xs)', fontWeight: 700,
                      color, minWidth: 30,
                    }}>
                      {label}
                    </span>

                    {/* 총합 */}
                    <span style={{
                      fontSize: 'var(--fs-base)', fontWeight: 700,
                      color, minWidth: 24, textAlign: 'center',
                    }}>
                      {total}
                    </span>

                    {/* 분해 표기 */}
                    <span style={{
                      fontSize: '10px', color: 'var(--text-faint)',
                      minWidth: 40,
                    }}>
                      ({base}{a > 0 ? `+${a}` : ''})
                    </span>

                    {/* 캡 표시 */}
                    <span style={{
                      fontSize: '9px', color: 'var(--text-faint)',
                      minWidth: 28, textAlign: 'right',
                    }}>
                      /{cap}
                    </span>

                    {/* 버튼 */}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => handleMinus(stat)}
                        disabled={a <= 0}
                        style={{
                          ...statBtnStyle,
                          borderColor: a > 0 ? color : 'var(--border-soft)',
                          color: a > 0 ? color : 'var(--border-soft)',
                          cursor: a > 0 ? 'pointer' : 'not-allowed',
                          opacity: a > 0 ? 1 : 0.3,
                        }}
                      >
                        −
                      </button>
                      <button
                        onClick={() => handlePlus(stat)}
                        disabled={remaining <= 0 || atCap}
                        style={{
                          ...statBtnStyle,
                          borderColor: (remaining > 0 && !atCap) ? color : 'var(--border-soft)',
                          color: (remaining > 0 && !atCap) ? color : 'var(--border-soft)',
                          cursor: (remaining > 0 && !atCap) ? 'pointer' : 'not-allowed',
                          opacity: (remaining > 0 && !atCap) ? 1 : 0.3,
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
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
            fontSize: 'var(--fs-sm)', color: 'var(--danger)',
            textAlign: 'center', padding: '6px 8px',
            background: 'color-mix(in oklch, var(--danger) 8%, transparent)',
            borderRadius: 'var(--r-xs)', marginBottom: 12,
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
          {loading ? '생성 중...' : remaining > 0 ? `스탯 ${remaining}포인트 배분 필요` : '모험 시작'}
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
  maxHeight: '95vh',
  overflowY: 'auto',
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

const statBtnStyle: React.CSSProperties = {
  width: 24, height: 24,
  borderRadius: '50%',
  border: '1px solid',
  background: 'transparent',
  fontSize: 'var(--fs-sm)',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  lineHeight: 1,
};
