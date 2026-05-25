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

/**
 * 가로 모드 감지 — screen 기준 (가상 키보드에 불변)
 * window.innerHeight는 키보드 열림/닫힘에 따라 변동하므로
 * screen의 짧은 변(물리적 크기)으로 판별.
 */
function useIsLandscape() {
  const [v] = useState(() => {
    if (typeof window === 'undefined') return false;
    const shortSide = Math.min(window.screen.width, window.screen.height);
    return shortSide <= 500;
  });
  return v;
}

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
  const isLandscape = useIsLandscape();
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

  // ── 공통 서브 컴포넌트 ──

  const titleBlock = (
    <div style={{ textAlign: 'center', marginBottom: isLandscape ? 6 : 16 }}>
      <div style={{
        fontFamily: "'Space Grotesk', var(--font-display)",
        fontSize: isLandscape ? 14 : 20, fontWeight: 800,
        color: 'var(--accent)', letterSpacing: '-0.02em',
      }}>
        캐릭터 생성
      </div>
      {!isLandscape && (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-mute)', marginTop: 4 }}>
          클래스를 선택하고 스탯을 배분하세요
        </div>
      )}
    </div>
  );

  const classCards = (
    <div style={{
      display: 'flex', gap: isLandscape ? 4 : 8,
      justifyContent: 'center',
      flexDirection: isLandscape ? 'column' as const : 'row' as const,
      flexWrap: isLandscape ? 'nowrap' as const : 'wrap' as const,
      marginBottom: isLandscape ? 0 : 14,
    }}>
      {CLASSES.map((cls) => {
        const cfg = CLASS_CONFIGS[cls];
        const isSelected = selectedClass === cls;
        return (
          <button
            key={cls}
            onClick={() => handleSelectClass(cls)}
            style={{
              ...(!isLandscape ? { flex: '1 1 0', minWidth: 130, maxWidth: 200 } : {}),
              padding: isLandscape ? '4px 8px' : '12px 10px',
              background: isSelected ? 'color-mix(in oklch, var(--accent) 12%, var(--bg-panel))' : 'var(--bg-panel)',
              border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border-soft)',
              borderRadius: 'var(--r-md)',
              cursor: 'pointer',
              textAlign: isLandscape ? 'left' as const : 'center' as const,
              transition: 'all 0.15s',
              boxShadow: isSelected ? '0 0 12px color-mix(in oklch, var(--accent) 25%, transparent)' : 'none',
              fontFamily: 'var(--font-ui)',
              ...(isLandscape ? { display: 'flex', alignItems: 'center', gap: 6 } : {}),
            }}
          >
            {isLandscape ? (
              /* ── 가로 모드: 한 줄 컴팩트 ── */
              <>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{CLASS_ICONS[cls]}</span>
                <span style={{
                  fontSize: 'var(--fs-sm)', fontWeight: 800,
                  color: isSelected ? 'var(--accent)' : 'var(--text)',
                  whiteSpace: 'nowrap',
                }}>
                  {cfg.nameKo}
                </span>
                <span style={{
                  fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)',
                  marginLeft: 'auto', whiteSpace: 'nowrap',
                }}>
                  {cfg.combatStyle === 'melee' ? '근접' : cfg.combatStyle === 'ranged_bow' ? '활' : '마법'}
                  {' · '}
                  {STAT_KEYS.map(s => `${STAT_META[s].label}${cfg.baseStats[s]}`).join(' ')}
                </span>
              </>
            ) : (
              /* ── 세로/데스크톱 모드: 기존 카드 ── */
              <>
                <div style={{ fontSize: 26, marginBottom: 4 }}>
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
              </>
            )}
          </button>
        );
      })}
    </div>
  );

  const statBlock = config ? (
    <div style={{
      background: 'var(--bg-sunken)',
      borderRadius: 'var(--r-sm)',
      padding: isLandscape ? '6px 8px' : '10px 10px',
      marginBottom: isLandscape ? 6 : 12,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: isLandscape ? 4 : 10,
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
          남은: {remaining}
        </span>
      </div>

      {!isLandscape && (
        <div style={{
          fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)',
          marginBottom: 8, textAlign: 'center',
        }}>
          추천: <span style={{ color: 'var(--accent)' }}>{config.recommendedStats}</span>
          {' · '}최대 {selectedClass === 'knight' ? 'STR 20 / 나머지 18' : '18'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: isLandscape ? 2 : 4 }}>
        {STAT_KEYS.map((stat) => {
          const base = config.baseStats[stat];
          const a = alloc[stat];
          const total = base + a;
          const cap = getStatCap(selectedClass!, stat);
          const atCap = total >= cap;
          const { label, color } = STAT_META[stat];

          return (
            <div key={stat} style={{
              display: 'flex', alignItems: 'center', gap: isLandscape ? 4 : 6,
              padding: isLandscape ? '2px 6px' : '5px 8px',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)',
            }}>
              <span style={{
                fontSize: 'var(--fs-xs)', fontWeight: 700,
                color, minWidth: 26,
              }}>
                {label}
              </span>
              <span style={{
                fontSize: 'var(--fs-base)', fontWeight: 700,
                color, minWidth: 20, textAlign: 'center',
              }}>
                {total}
              </span>
              <span style={{
                fontSize: '10px', color: 'var(--text-faint)',
                minWidth: 36,
              }}>
                ({base}{a > 0 ? `+${a}` : ''})
              </span>
              <span style={{
                fontSize: '9px', color: 'var(--text-faint)',
                minWidth: 22, textAlign: 'right',
              }}>
                /{cap}
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: isLandscape ? 2 : 4 }}>
                <button
                  onClick={() => handleMinus(stat)}
                  disabled={a <= 0}
                  style={{
                    ...statBtnStyle,
                    ...(isLandscape ? { width: 20, height: 20 } : {}),
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
                    ...(isLandscape ? { width: 20, height: 20 } : {}),
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
  ) : null;

  const nicknameBlock = (
    <div style={{ marginBottom: isLandscape ? 6 : 16 }}>
      <input
        type="text"
        placeholder="닉네임 (2~12자)"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        maxLength={12}
        style={{ ...inputStyle, padding: isLandscape ? '6px 10px' : '10px 12px' }}
        autoComplete="off"
      />
    </div>
  );

  const errorBlock = error ? (
    <div style={{
      fontSize: 'var(--fs-sm)', color: 'var(--danger)',
      textAlign: 'center', padding: '4px 8px',
      background: 'color-mix(in oklch, var(--danger) 8%, transparent)',
      borderRadius: 'var(--r-xs)', marginBottom: isLandscape ? 4 : 12,
    }}>
      {error}
    </div>
  ) : null;

  const submitBlock = (
    <button
      onClick={handleSubmit}
      disabled={!canSubmit}
      style={{
        ...btnStyle,
        padding: isLandscape ? '8px' : '12px',
        opacity: canSubmit ? 1 : 0.4,
        cursor: canSubmit ? 'pointer' : 'not-allowed',
      }}
    >
      {loading ? '생성 중...' : remaining > 0 ? `스탯 ${remaining}포인트 배분 필요` : '모험 시작'}
    </button>
  );

  // ── 렌더 ──
  if (isLandscape) {
    /* 가로 모드: 좌(클래스 카드) | 우(스탯+닉네임+버튼) 2컬럼 */
    return (
      <div style={containerStyle}>
        <div style={{
          ...panelStyle,
          maxWidth: 720,
          padding: '8px 10px',
        }}>
          {titleBlock}
          <div style={{ display: 'flex', gap: 8 }}>
            {/* 좌측: 클래스 선택 */}
            <div style={{ flex: '0 0 auto', minWidth: 160, maxWidth: 220 }}>
              {classCards}
            </div>
            {/* 우측: 스탯 + 닉네임 + 버튼 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {statBlock}
              {nicknameBlock}
              {errorBlock}
              {submitBlock}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* 세로/데스크톱 모드: 기존 세로 레이아웃 */
  return (
    <div style={containerStyle}>
      <div style={panelStyle}>
        {titleBlock}
        {classCards}
        {statBlock}
        {nicknameBlock}
        {errorBlock}
        {submitBlock}
      </div>
    </div>
  );
}

// ── Styles ──

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
  background: 'var(--bg-canvas)',
  padding: '8px 0',
  boxSizing: 'border-box',
};

const panelStyle: React.CSSProperties = {
  maxWidth: 640,
  width: 'calc(100% - 24px)',
  background: 'var(--bg-panel)',
  border: '1px solid var(--border-soft)',
  borderRadius: 'var(--r-md)',
  padding: '20px 14px',
  boxShadow: 'var(--shadow-lg)',
  margin: '0 auto',
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
