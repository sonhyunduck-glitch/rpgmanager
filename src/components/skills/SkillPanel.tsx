/* =========================================================
   SKILL PANEL — 스킬 관리 UI (디자인 핸드오프 기반)
   좌측: 카테고리 탭 + 검색 + 스킬 리스트 (테이블)
   우측: 선택 스킬 상세 + 4×4 슬롯 그리드 + MP 게이지
   ========================================================= */
import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import {
  PLAYER_SKILLS, getAvailableSkills, MAX_SKILL_SLOTS,
} from '../../data/playerSkillData';
import { magicLevel } from '../../data/statFormulas';
import type { PlayerSkill } from '../../data/playerSkillData';

/* ══════════════════════════════════════════════
   상수 & 매핑
   ══════════════════════════════════════════════ */

type FilterTab = 'all' | 'attack' | 'heal' | 'buff' | 'passive';

const CATS: { id: FilterTab; nm: string; ic: string }[] = [
  { id: 'all',     nm: '전체',   ic: '▦' },
  { id: 'attack',  nm: '공격',   ic: '⚔' },
  { id: 'heal',    nm: '힐',     ic: '✚' },
  { id: 'buff',    nm: '버프',   ic: '✦' },
  { id: 'passive', nm: '패시브', ic: '◯' },
];

/** 스킬 타입 아이콘 (심플 텍스트) */
const KIND_ICON: Record<string, string> = {
  attack: '⚔', heal: '✚', buff: '✦', passive: '◯',
};

/** 스킬 타입 색상 */
const KIND_COLOR: Record<string, string> = {
  attack: 'var(--danger)', heal: 'var(--success)', buff: 'oklch(0.68 0.20 305)', passive: 'var(--accent)',
};

/** 서클 뱃지 색상 */
const CIRCLE_STYLE: Record<number, { color: string; bg: string }> = {
  0: { color: 'var(--text-mute)', bg: 'var(--bg-sunken)' },
  1: { color: 'oklch(0.78 0.14 195)', bg: 'oklch(0.78 0.14 195 / 0.08)' },
  2: { color: 'var(--success)',       bg: 'color-mix(in oklch, var(--success) 8%, transparent)' },
  3: { color: 'var(--info)',          bg: 'color-mix(in oklch, var(--info) 8%, transparent)' },
  4: { color: 'oklch(0.68 0.20 305)', bg: 'oklch(0.68 0.20 305 / 0.08)' },
  5: { color: 'oklch(0.72 0.18 350)', bg: 'oklch(0.72 0.18 350 / 0.08)' },
  6: { color: 'var(--accent)',        bg: 'color-mix(in oklch, var(--accent) 8%, transparent)' },
  7: { color: 'var(--danger)',        bg: 'color-mix(in oklch, var(--danger) 8%, transparent)' },
  8: { color: 'var(--danger)',        bg: 'color-mix(in oklch, var(--danger) 10%, transparent)' },
  9: { color: 'var(--danger)',        bg: 'color-mix(in oklch, var(--danger) 12%, transparent)' },
  10:{ color: 'var(--danger)',        bg: 'color-mix(in oklch, var(--danger) 14%, transparent)' },
};

/** 속성 라벨/색상 */
const ATTR_LABEL: Record<number, string> = {
  0: '', 1: '땅', 2: '불', 4: '물', 8: '바람', 16: '빛',
};
const ATTR_COLOR: Record<number, string> = {
  1: 'var(--accent)', 2: 'var(--danger)', 4: 'var(--info)',
  8: 'var(--success)', 16: 'oklch(0.68 0.20 305)',
};

/* ══════════════════════════════════════════════
   버프 효과 포맷
   ══════════════════════════════════════════════ */
function formatBuffEffect(skill: PlayerSkill): string {
  if (!skill.buffEffect) return '-';
  const parts: string[] = [];
  if (skill.buffEffect.acBonus) parts.push(`AC ${skill.buffEffect.acBonus}`);
  if (skill.buffEffect.atkSpeedMult) parts.push(`공속 x${skill.buffEffect.atkSpeedMult}`);
  if (skill.buffEffect.hitBonus) parts.push(`명중 +${skill.buffEffect.hitBonus}`);
  if (skill.buffEffect.dmgBonus) parts.push(`추타 +${skill.buffEffect.dmgBonus}`);
  if (skill.buffEffect.fireDmgBonus) parts.push(`화염 +${skill.buffEffect.fireDmgBonus}`);
  return parts.join(', ') || '-';
}

/* ══════════════════════════════════════════════
   메인 컴포넌트
   ══════════════════════════════════════════════ */
export default function SkillPanel() {
  const playerClass = useGameStore(s => s.playerClass);
  const level = useGameStore(s => s.level);
  const equippedSkills = useGameStore(s => s.equippedSkills);
  const equipSkill = useGameStore(s => s.equipSkill);
  const unequipSkill = useGameStore(s => s.unequipSkill);
  const autoEquipSkills = useGameStore(s => s.autoEquipSkills);
  const hunt = useGameStore(s => s.hunt);
  const getMaxMp = useGameStore(s => s.getMaxMp);

  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dragSkillId, setDragSkillId] = useState<number | null>(null);

  const maxSlots = MAX_SKILL_SLOTS;
  const mlvl = magicLevel(level, playerClass);
  const maxMp = getMaxMp();
  const currentMp = hunt.currentMp;
  const mpPct = maxMp > 0 ? Math.min(100, (currentMp / maxMp) * 100) : 0;

  // 해금/잠긴 스킬
  const unlockedSkills = getAvailableSkills(playerClass, level);
  const lockedSkills = PLAYER_SKILLS.filter(s => {
    if (!s.classes.includes(playerClass)) return false;
    return !unlockedSkills.find(u => u.id === s.id);
  }).sort((a, b) => a.skillCircle - b.skillCircle || a.requiredLevel - b.requiredLevel);

  // 필터
  const filteredUnlocked = useMemo(() => {
    let r = filterTab === 'all'
      ? unlockedSkills
      : filterTab === 'passive'
        ? unlockedSkills.filter(s => s.passive)
        : unlockedSkills.filter(s => s.skillType === filterTab && !s.passive);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(s =>
        s.name.toLowerCase().includes(q) ||
        ATTR_LABEL[s.attr]?.includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    }
    return r.sort((a, b) => a.skillCircle - b.skillCircle || a.id - b.id);
  }, [unlockedSkills, filterTab, search]);

  // 카테고리 카운트
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: unlockedSkills.length };
    for (const s of unlockedSkills) {
      if (s.passive) { c.passive = (c.passive || 0) + 1; }
      else { c[s.skillType] = (c[s.skillType] || 0) + 1; }
    }
    return c;
  }, [unlockedSkills]);

  // 슬롯 배열
  const slots: number[] = [];
  for (let i = 0; i < maxSlots; i++) slots.push(equippedSkills[i] ?? 0);
  const isEquipped = (skillId: number) => equippedSkills.includes(skillId);
  const filledSlots = slots.filter(x => x > 0).length;

  const selectedSkill = selectedId
    ? (PLAYER_SKILLS.find(s => s.id === selectedId) ?? null)
    : null;

  // 핸들러
  const handleToggleSlot = (skill: PlayerSkill) => {
    if (isEquipped(skill.id)) {
      const idx = slots.indexOf(skill.id);
      if (idx !== -1) unequipSkill(idx);
    } else {
      const emptySlot = slots.indexOf(0);
      if (emptySlot !== -1) equipSkill(skill.id, emptySlot);
    }
  };

  const handleSlotClick = (slotIdx: number) => {
    if (slots[slotIdx]) {
      setSelectedId(slots[slotIdx]);
    }
  };

  const handleSlotRemove = (slotIdx: number) => {
    if (slots[slotIdx]) unequipSkill(slotIdx);
  };

  const clearSlots = () => {
    for (let i = 0; i < maxSlots; i++) {
      if (slots[i]) unequipSkill(i);
    }
  };

  const handleDragStart = (skillId: number) => setDragSkillId(skillId);
  const handleSlotDrop = (slotIdx: number) => {
    if (slotIdx >= maxSlots || !dragSkillId) return;
    equipSkill(dragSkillId, slotIdx);
    setDragSkillId(null);
  };

  return (
    <div style={{
      height: '100%', overflow: 'hidden',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) 320px',
      gridTemplateRows: 'auto 1fr',
      gap: '14px 18px',
      padding: '18px 22px 24px',
    }}>
      {/* ━━━ BREADCRUMB ━━━ */}
      <div style={{
        gridColumn: '1 / -1',
        display: 'flex', alignItems: 'center', gap: 14,
        paddingBottom: 12,
        borderBottom: '1px solid var(--border-soft)',
      }}>
        <span style={{
          fontSize: 17, fontWeight: 600, color: 'var(--text)',
          display: 'inline-flex', alignItems: 'baseline', gap: 10,
        }}>
          스킬 목록
          <span style={{
            display: 'inline-flex', gap: 14,
            fontFamily: 'var(--font-mono)', fontSize: 11.5,
            color: 'var(--text-mute)',
          }}>
            <span><b style={{ color: 'var(--text)' }}>{unlockedSkills.length}개</b> 해금</span>
            <span style={{ color: 'oklch(0.68 0.20 305)' }}>
              마법 서클 <b style={{ color: 'oklch(0.68 0.20 305)' }}>{mlvl}</b>
            </span>
          </span>
        </span>
        {maxMp > 0 && (
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-mono)', fontSize: 12,
            color: 'var(--info)',
          }}>
            MP <span style={{ fontWeight: 600 }}>{currentMp}</span>
            <span style={{ color: 'var(--text-mute)' }}>/{maxMp}</span>
          </span>
        )}
      </div>

      {/* ━━━ LEFT: SKILL LIST ━━━ */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden' }}>
        {/* Category tabs */}
        <div style={{
          display: 'flex', gap: 4,
          marginBottom: 14,
          borderBottom: '1px solid var(--border-soft)',
        }}>
          {CATS.map(c => {
            const active = filterTab === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setFilterTab(c.id)}
                style={{
                  padding: '9px 18px',
                  color: active ? 'var(--accent)' : 'var(--text-mute)',
                  fontSize: 12.5, fontWeight: 500,
                  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: -1,
                  background: 'none', border: 'none',
                  borderBottomStyle: 'solid',
                  cursor: 'pointer',
                  transition: 'color 0.12s, border-color 0.12s',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}
              >
                <span style={{ fontSize: 14, opacity: 0.7 }}>{c.ic}</span>
                {c.nm}
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  padding: '0 5px',
                  background: active
                    ? 'color-mix(in oklch, var(--accent) 12%, transparent)'
                    : 'var(--bg-elevated)',
                  color: active ? 'var(--accent)' : 'var(--text-mute)',
                  borderRadius: 100,
                }}>
                  {counts[c.id] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 12,
        }}>
          {/* Search */}
          <div style={{
            flex: 1, maxWidth: 320,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 12px',
            background: 'var(--bg-panel)', border: '1px solid var(--border-soft)', borderRadius: 6,
          }}>
            <span style={{ color: 'var(--text-faint)', fontSize: 13, lineHeight: 1 }}>🔍</span>
            <input
              placeholder="스킬 검색 (이름/속성)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, fontSize: 12.5,
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text)', fontFamily: 'var(--font-ui)',
              }}
            />
          </div>
          <button
            onClick={clearSlots}
            style={{
              padding: '7px 11px',
              background: 'var(--bg-panel)', border: '1px solid var(--border-soft)', borderRadius: 6,
              fontSize: 11.5, color: 'var(--text-mute)', cursor: 'pointer',
            }}
          >
            슬롯 초기화
          </button>
          <button
            onClick={autoEquipSkills}
            style={{
              padding: '7px 11px',
              background: 'color-mix(in oklch, var(--accent) 5%, transparent)',
              border: '1px solid color-mix(in oklch, var(--accent) 40%, transparent)',
              borderRadius: 6,
              fontSize: 11.5, color: 'var(--accent)', cursor: 'pointer',
            }}
          >
            자동 배치
          </button>
        </div>

        {/* Skill list */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          border: '1px solid var(--border-soft)', borderRadius: 8,
          background: 'var(--bg-panel)', overflow: 'hidden auto',
        }}>
          {/* 해금된 스킬 */}
          {filteredUnlocked.map(skill => {
            const isPassive = !!skill.passive;
            const equipped = isEquipped(skill.id);
            const isSelected = selectedId === skill.id;
            const slotIdx = slots.indexOf(skill.id);
            const kindColor = KIND_COLOR[isPassive ? 'passive' : skill.skillType];
            const cs = CIRCLE_STYLE[skill.skillCircle] ?? CIRCLE_STYLE[0];

            return (
              <div
                key={skill.id}
                draggable={!isPassive}
                onDragStart={() => !isPassive && handleDragStart(skill.id)}
                onClick={() => setSelectedId(skill.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 38px 1fr 60px 60px 80px 24px',
                  alignItems: 'center',
                  columnGap: 12,
                  padding: isSelected ? '9px 12px 9px 12px' : '9px 14px',
                  borderBottom: '1px solid color-mix(in oklch, var(--border-soft) 50%, transparent)',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                  background: isSelected
                    ? 'color-mix(in oklch, var(--accent) 5%, transparent)'
                    : 'transparent',
                  borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 26, height: 26, borderRadius: 5,
                  display: 'grid', placeItems: 'center',
                  background: 'var(--bg-sunken)',
                  border: `1px solid color-mix(in oklch, ${kindColor} 30%, transparent)`,
                  fontFamily: 'var(--font-mono)', fontSize: 13,
                  color: kindColor,
                }}>
                  {KIND_ICON[isPassive ? 'passive' : skill.skillType]}
                </div>

                {/* Circle badge */}
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  padding: '2px 8px', borderRadius: 4, textAlign: 'center',
                  fontWeight: 600,
                  color: cs.color, background: cs.bg,
                }}>
                  {skill.skillCircle > 0 ? `C${skill.skillCircle}` : 'EX'}
                </span>

                {/* Name + element tag */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  minWidth: 0,
                }}>
                  <span style={{
                    fontSize: 13, fontWeight: 500, color: 'var(--text)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {skill.name}
                  </span>
                  {isPassive ? (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9.5,
                      padding: '1px 6px', borderRadius: 3,
                      color: 'var(--accent)',
                      background: 'color-mix(in oklch, var(--accent) 6%, transparent)',
                    }}>
                      상시
                    </span>
                  ) : skill.attr > 0 && ATTR_LABEL[skill.attr] ? (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9.5,
                      padding: '1px 6px', borderRadius: 3,
                      color: ATTR_COLOR[skill.attr] ?? 'var(--text-mute)',
                      background: `color-mix(in oklch, ${ATTR_COLOR[skill.attr] ?? 'var(--text-mute)'} 8%, transparent)`,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: ATTR_COLOR[skill.attr],
                        display: 'inline-block',
                      }} />
                      {ATTR_LABEL[skill.attr]}
                    </span>
                  ) : null}
                </div>

                {/* MP */}
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11.5,
                  color: 'var(--info)', textAlign: 'right',
                }}>
                  {isPassive ? '—' : `${skill.consumeMp} MP`}
                </span>

                {/* Cooldown */}
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11.5,
                  color: 'var(--text-mute)', textAlign: 'right',
                }}>
                  {isPassive ? '상시' : skill.reuseDelayTicks > 0 ? `${skill.reuseDelayTicks * 3}s` : '3s'}
                </span>

                {/* Damage/Heal */}
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  textAlign: 'right',
                }}>
                  {skill.skillType === 'attack' && skill.damageValue > 0 ? (
                    <span style={{ color: 'var(--danger)' }}>DMG {skill.damageValue}{skill.damageDiceCount > 0 ? `+${skill.damageDiceCount}d${skill.damageDice}` : ''}</span>
                  ) : skill.skillType === 'heal' && skill.damageValue > 0 ? (
                    <span style={{ color: 'var(--success)' }}>HEAL {skill.damageValue}+</span>
                  ) : skill.skillType === 'buff' ? (
                    <span style={{ color: 'oklch(0.68 0.20 305)' }}>{formatBuffEffect(skill).slice(0, 12)}</span>
                  ) : (
                    <span style={{ color: 'var(--text-faint)' }}>—</span>
                  )}
                </span>

                {/* Slot toggle */}
                {!isPassive ? (
                  <button
                    onClick={e => { e.stopPropagation(); handleToggleSlot(skill); }}
                    style={{
                      width: 22, height: 22, borderRadius: 5,
                      border: equipped
                        ? '1px solid var(--success)'
                        : '1px solid var(--border-strong)',
                      background: equipped
                        ? 'color-mix(in oklch, var(--success) 25%, transparent)'
                        : 'transparent',
                      color: equipped ? '#ddffe7' : 'var(--text-mute)',
                      display: 'grid', placeItems: 'center',
                      fontSize: 13, cursor: 'pointer',
                      transition: 'all 0.1s',
                    }}
                    title={equipped ? `슬롯 #${slotIdx + 1}` : '슬롯에 추가'}
                  >
                    {equipped ? '✓' : '+'}
                  </button>
                ) : (
                  <span style={{
                    color: 'var(--accent)', fontFamily: 'var(--font-mono)',
                    fontSize: 10, textAlign: 'center',
                  }}>★</span>
                )}
              </div>
            );
          })}

          {/* 잠긴 스킬 */}
          {filterTab === 'all' && lockedSkills.length > 0 && (
            <>
              <div style={{
                padding: '12px 14px 6px',
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--text-mute)', textTransform: 'uppercase' as const,
                letterSpacing: '0.12em',
                borderTop: '1px solid var(--border-soft)',
              }}>
                미해금 ({lockedSkills.length})
              </div>
              {lockedSkills.slice(0, 8).map(skill => {
                const cs = CIRCLE_STYLE[skill.skillCircle] ?? CIRCLE_STYLE[0];
                const kindColor = KIND_COLOR[skill.skillType];
                const needCircle = skill.skillCircle > 0 && skill.skillCircle > mlvl;
                return (
                  <div
                    key={skill.id}
                    onClick={() => setSelectedId(skill.id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '28px 38px 1fr auto',
                      alignItems: 'center', columnGap: 12,
                      padding: '7px 14px',
                      borderBottom: '1px solid color-mix(in oklch, var(--border-soft) 30%, transparent)',
                      cursor: 'pointer', opacity: 0.4,
                    }}
                  >
                    <div style={{
                      width: 26, height: 26, borderRadius: 5,
                      display: 'grid', placeItems: 'center',
                      background: 'var(--bg-sunken)',
                      border: `1px solid color-mix(in oklch, ${kindColor} 20%, transparent)`,
                      fontFamily: 'var(--font-mono)', fontSize: 13,
                      color: kindColor,
                    }}>
                      {KIND_ICON[skill.skillType]}
                    </div>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 11,
                      padding: '2px 8px', borderRadius: 4, textAlign: 'center',
                      fontWeight: 600, color: cs.color, background: cs.bg,
                    }}>
                      {skill.skillCircle > 0 ? `C${skill.skillCircle}` : 'EX'}
                    </span>
                    <span style={{
                      fontSize: 13, color: 'var(--text-mute)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {skill.name}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10,
                      color: 'var(--warning)',
                    }}>
                      {needCircle ? `서클 ${skill.skillCircle}` : `Lv.${skill.requiredLevel}`}
                    </span>
                  </div>
                );
              })}
              {lockedSkills.length > 8 && (
                <div style={{
                  padding: 12, textAlign: 'center',
                  fontSize: 11, color: 'var(--text-mute)',
                }}>
                  +{lockedSkills.length - 8}개 더...
                </div>
              )}
            </>
          )}

          {filteredUnlocked.length === 0 && filterTab !== 'all' && (
            <div style={{
              padding: 40, textAlign: 'center',
              color: 'var(--text-faint)',
            }}>
              {search ? '검색 결과가 없습니다.' : '해당 카테고리의 스킬이 없습니다.'}
            </div>
          )}
        </div>
      </div>

      {/* ━━━ RIGHT SIDEBAR ━━━ */}
      <div style={{
        alignSelf: 'start',
        position: 'sticky', top: 14,
        display: 'flex', flexDirection: 'column', gap: 12,
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
      }}>
        {/* Skill detail */}
        {selectedSkill ? (
          <SkillDetail skill={selectedSkill} mlvl={mlvl} level={level} />
        ) : (
          <div style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-soft)',
            borderRadius: 8,
            padding: 40,
            textAlign: 'center',
            color: 'var(--text-mute)', fontSize: 12,
          }}>
            스킬을 선택하세요
          </div>
        )}

        {/* Slot grid */}
        <div style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-soft)',
          borderRadius: 8, overflow: 'hidden',
        }}>
          <div style={{
            margin: 0, padding: '11px 14px',
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-mute)',
            letterSpacing: '0.12em', textTransform: 'uppercase' as const, fontWeight: 600,
            borderBottom: '1px solid var(--border-soft)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            스킬 슬롯
            <span style={{
              color: 'var(--text-mute)', textTransform: 'none' as const,
              letterSpacing: 0, fontWeight: 400, fontSize: 10,
            }}>
              ({filledSlots}/{maxSlots})
            </span>
            <button
              onClick={autoEquipSkills}
              style={{
                marginLeft: 'auto',
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--accent)',
                padding: '2px 8px',
                border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
                borderRadius: 4, background: 'none',
                textTransform: 'none' as const, letterSpacing: 0,
                fontWeight: 500, cursor: 'pointer',
              }}
            >
              자동 배치
            </button>
          </div>

          <div style={{
            padding: 12,
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
          }}>
            {slots.map((skillId, idx) => {
              const skill = skillId ? PLAYER_SKILLS.find(s => s.id === skillId) : null;
              const kindColor = skill ? KIND_COLOR[skill.skillType] : undefined;

              return (
                <div
                  key={idx}
                  onClick={() => skill ? handleSlotClick(idx) : undefined}
                  onContextMenu={e => { e.preventDefault(); handleSlotRemove(idx); }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleSlotDrop(idx)}
                  style={{
                    aspectRatio: '1',
                    background: 'var(--bg-elevated)',
                    border: skill
                      ? `1px solid color-mix(in oklch, ${kindColor} 40%, transparent)`
                      : '1px solid var(--border-soft)',
                    borderRadius: 6,
                    display: 'grid', placeItems: 'center',
                    position: 'relative',
                    cursor: skill ? 'pointer' : 'default',
                    transition: 'all 0.12s',
                  }}
                  title={skill ? `${skill.name} (우클릭 해제)` : '빈 슬롯'}
                >
                  {/* Slot number */}
                  <span style={{
                    position: 'absolute', top: 3, left: 5,
                    fontFamily: 'var(--font-mono)', fontSize: 9,
                    color: 'var(--text-faint)',
                  }}>
                    {idx + 1}
                  </span>

                  {skill ? (
                    <>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 18,
                        color: kindColor,
                      }}>
                        {KIND_ICON[skill.skillType]}
                      </span>
                      <span style={{
                        position: 'absolute', bottom: 2, left: 0, right: 0,
                        textAlign: 'center', fontSize: 9,
                        color: 'var(--text)',
                        padding: '0 2px',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {skill.name.length > 5 ? skill.name.slice(0, 5) + '..' : skill.name}
                      </span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 18 }}>+</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* MP gauge */}
        {maxMp > 0 && (
          <div style={{
            padding: '10px 14px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-soft)',
            borderRadius: 8,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--text-mute)',
            }}>
              <span>MP</span>
              <span>
                <b style={{ color: 'var(--text)' }}>{currentMp}</b> / {maxMp}
              </span>
            </div>
            <div style={{
              marginTop: 6, height: 4,
              background: 'var(--bg-sunken)',
              borderRadius: 2, overflow: 'hidden',
              position: 'relative',
            }}>
              <div style={{
                height: '100%', borderRadius: 2,
                width: `${mpPct}%`,
                background: 'linear-gradient(90deg, var(--info), oklch(0.78 0.14 195))',
                boxShadow: mpPct > 0 ? '0 0 6px color-mix(in oklch, var(--info) 30%, transparent)' : 'none',
                transition: 'width 0.3s',
              }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   스킬 상세 카드
   ══════════════════════════════════════════════ */
function SkillDetail({ skill, mlvl, level }: { skill: PlayerSkill; mlvl: number; level: number }) {
  const isPassive = !!skill.passive;
  const kindColor = KIND_COLOR[isPassive ? 'passive' : skill.skillType];
  const isUnlocked = (() => {
    if (skill.requiredLevel > level) return false;
    if (skill.skillCircle > 0 && skill.skillCircle > mlvl) return false;
    return true;
  })();

  const kindLabel = skill.skillType === 'attack' ? '공격'
    : skill.skillType === 'heal' ? '힐' : '버프';

  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-soft)',
      borderRadius: 8, overflow: 'hidden',
    }}>
      {/* Head */}
      <div style={{
        padding: 14,
        borderBottom: '1px solid var(--border-soft)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: 5,
          display: 'grid', placeItems: 'center',
          background: 'var(--bg-sunken)',
          border: `1px solid color-mix(in oklch, ${kindColor} 30%, transparent)`,
          fontFamily: 'var(--font-mono)', fontSize: 18,
          color: kindColor,
        }}>
          {KIND_ICON[isPassive ? 'passive' : skill.skillType]}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
            {skill.name}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10.5,
            color: 'var(--text-mute)', marginTop: 2,
          }}>
            <span style={{ color: kindColor }}>{isPassive ? '패시브' : kindLabel}</span>
            <span style={{ color: 'var(--text-faint)', margin: '0 4px' }}>·</span>
            <span>서클 {skill.skillCircle || 'EX'}</span>
            {skill.attr > 0 && ATTR_LABEL[skill.attr] && (
              <>
                <span style={{ color: 'var(--text-faint)', margin: '0 4px' }}>·</span>
                <span style={{ color: ATTR_COLOR[skill.attr] }}>{ATTR_LABEL[skill.attr]} 속성</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        {/* Description */}
        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
          {skill.description}
        </div>

        {/* Stats */}
        <div style={{
          marginTop: 12, paddingTop: 12,
          borderTop: '1px dashed var(--border-soft)',
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          columnGap: 16, rowGap: 5,
        }}>
          <StatRow label="MP 소모" value={isPassive ? '상시' : String(skill.consumeMp)} color="var(--info)" />
          <StatRow
            label="쿨타임"
            value={isPassive ? '—' : skill.reuseDelayTicks > 0 ? `${skill.reuseDelayTicks * 3}s` : '3s'}
            color="var(--accent)"
          />
          {skill.skillType === 'attack' && skill.damageValue > 0 && (
            <StatRow
              label="데미지"
              value={`${skill.damageValue}${skill.damageDiceCount > 0 ? `+${skill.damageDiceCount}d${skill.damageDice}` : ''}`}
              color="var(--danger)"
            />
          )}
          {skill.skillType === 'heal' && skill.damageValue > 0 && (
            <StatRow
              label="회복량"
              value={`${skill.damageValue}${skill.damageDiceCount > 0 ? `+${skill.damageDiceCount}d${skill.damageDice}` : ''}`}
              color="var(--success)"
            />
          )}
          {skill.skillType === 'buff' && (
            <StatRow label="효과" value={formatBuffEffect(skill)} color="oklch(0.68 0.20 305)" />
          )}
          {skill.skillType === 'buff' && skill.buffDuration > 0 && (
            <StatRow label="지속" value={`${Math.floor(skill.buffDuration / 60)}분`} color="var(--info)" />
          )}
          {isPassive && (
            <>
              <StatRow label="효과" value={formatBuffEffect(skill)} color="var(--accent)" />
              <StatRow label="조건" value={`Lv.${skill.requiredLevel}+`} color="var(--text-dim)" />
            </>
          )}
        </div>
      </div>

      {/* Unlock requirement */}
      {!isUnlocked && (
        <div style={{
          margin: '0 14px 12px',
          background: 'color-mix(in oklch, var(--warning) 10%, transparent)',
          border: '1px solid color-mix(in oklch, var(--warning) 30%, transparent)',
          borderRadius: 4,
          padding: '8px 12px',
          fontSize: 11, color: 'var(--warning)',
          textAlign: 'center',
        }}>
          {skill.requiredLevel > level
            ? `Lv.${skill.requiredLevel} 필요 (현재 Lv.${level})`
            : `마법 서클 ${skill.skillCircle} 필요 (현재 서클 ${mlvl})`}
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      fontFamily: 'var(--font-mono)', fontSize: 11,
    }}>
      <span style={{ color: 'var(--text-mute)' }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
