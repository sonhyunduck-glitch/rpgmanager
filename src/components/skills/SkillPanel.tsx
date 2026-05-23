/* =========================================================
   SKILL PANEL — 스킬 관리 UI (습득/슬롯 장착)
   - 레벨 도달 시 자동 해금
   - 슬롯(4~8칸)에 장착한 스킬만 전투 중 자동 시전
   ========================================================= */
import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import {
  PLAYER_SKILLS, getAvailableSkills, getSkillSlotCount, MAX_SKILL_SLOTS,
} from '../../data/playerSkillData';
import { magicLevel } from '../../data/statFormulas';
import { PANEL_FULL, LABEL, STAT_VALUE } from '../../styles/shared';
import type { PlayerSkill } from '../../data/playerSkillData';

/* ── 스킬 타입 아이콘/색상 ── */
const TYPE_META: Record<string, { icon: string; color: string; label: string }> = {
  attack: { icon: '🗡️', color: '#ef5350', label: '공격' },
  heal:   { icon: '💚', color: '#66BB6A', label: '힐' },
  buff:   { icon: '🛡️', color: '#42A5F5', label: '버프' },
};

const ATTR_NAMES: Record<number, string> = {
  0: '', 1: '땅', 2: '불', 4: '물', 8: '바람', 16: '빛',
};

type FilterTab = 'all' | 'attack' | 'heal' | 'buff';

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
  const [selectedSkill, setSelectedSkill] = useState<PlayerSkill | null>(null);
  const [dragSkillId, setDragSkillId] = useState<number | null>(null);

  const maxSlots = getSkillSlotCount(level);
  const nextSlotLevel = level < 20 ? 20 : level < 30 ? 30 : level < 40 ? 40 : level < 50 ? 50 : null;
  const mlvl = magicLevel(level, playerClass);
  const maxMp = getMaxMp();

  // 해금된 스킬
  const unlockedSkills = getAvailableSkills(playerClass, level);
  // 아직 잠긴 스킬 (다음에 해금될 후보)
  const lockedSkills = PLAYER_SKILLS.filter(s => {
    if (!s.classes.includes(playerClass)) return false;
    return !unlockedSkills.find(u => u.id === s.id);
  }).sort((a, b) => a.skillCircle - b.skillCircle || a.requiredLevel - b.requiredLevel);

  // 필터링
  const filteredUnlocked = filterTab === 'all'
    ? unlockedSkills
    : unlockedSkills.filter(s => s.skillType === filterTab);

  // 슬롯 배열 (패딩)
  const slots: number[] = [];
  for (let i = 0; i < MAX_SKILL_SLOTS; i++) {
    slots.push(equippedSkills[i] ?? 0);
  }

  const isEquipped = (skillId: number) => equippedSkills.includes(skillId);

  // 빈 슬롯 찾기
  const findEmptySlot = (): number => {
    for (let i = 0; i < maxSlots; i++) {
      if (!slots[i]) return i;
    }
    return -1;
  };

  const handleEquip = (skill: PlayerSkill) => {
    if (isEquipped(skill.id)) {
      // 이미 장착 → 해제
      const idx = slots.indexOf(skill.id);
      if (idx !== -1) unequipSkill(idx);
    } else {
      const emptySlot = findEmptySlot();
      if (emptySlot !== -1) equipSkill(skill.id, emptySlot);
    }
  };

  const handleSlotClick = (slotIdx: number) => {
    if (slotIdx >= maxSlots) return;
    if (slots[slotIdx]) {
      unequipSkill(slotIdx);
    }
  };

  const handleDragStart = (skillId: number) => {
    setDragSkillId(skillId);
  };

  const handleSlotDrop = (slotIdx: number) => {
    if (slotIdx >= maxSlots || !dragSkillId) return;
    equipSkill(dragSkillId, slotIdx);
    setDragSkillId(null);
  };

  return (
    <div style={{
      display: 'flex', gap: 'var(--s-3)', height: '100%', overflow: 'hidden',
    }}>
      {/* ── 좌측: 스킬 목록 ── */}
      <div style={{ ...PANEL_FULL, flex: 2, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 'var(--s-2)', flexShrink: 0,
        }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--fs-md)' }}>
            스킬 목록
            <span style={{ ...LABEL, marginLeft: 8, color: 'var(--text-dim)' }}>
              {unlockedSkills.length}개 해금 · 마법 서클 {mlvl}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
            {maxMp > 0 && (
              <span style={{
                fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-mono)',
                fontWeight: 700, color: '#6BA3FF',
              }}>
                MP {hunt.currentMp}/{maxMp}
              </span>
            )}
          </div>
        </div>

        {/* 필터 탭 */}
        <div style={{ display: 'flex', gap: 'var(--s-1)', marginBottom: 'var(--s-2)', flexShrink: 0 }}>
          {(['all', 'attack', 'heal', 'buff'] as FilterTab[]).map(tab => {
            const labels: Record<FilterTab, string> = { all: '전체', attack: '공격', heal: '힐', buff: '버프' };
            const isActive = filterTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                style={{
                  padding: '4px 12px',
                  border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                  borderRadius: 'var(--r-sm)',
                  background: isActive ? 'var(--bg-elevated)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-dim)',
                  fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* 스킬 리스트 */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {/* 해금된 스킬 */}
          {filteredUnlocked.map(skill => {
            const meta = TYPE_META[skill.skillType];
            const equipped = isEquipped(skill.id);
            return (
              <div
                key={skill.id}
                draggable
                onDragStart={() => handleDragStart(skill.id)}
                onClick={() => setSelectedSkill(skill)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
                  padding: '6px 8px', marginBottom: 2,
                  borderRadius: 'var(--r-sm)',
                  background: selectedSkill?.id === skill.id
                    ? 'color-mix(in oklch, var(--accent) 15%, transparent)'
                    : equipped ? 'color-mix(in oklch, var(--info) 8%, transparent)' : 'transparent',
                  border: equipped ? '1px solid color-mix(in oklch, var(--info) 30%, transparent)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                {/* 타입 아이콘 */}
                <span style={{ fontSize: 'var(--fs-sm)', flexShrink: 0 }}>{meta.icon}</span>

                {/* 서클 뱃지 */}
                {skill.skillCircle > 0 && (
                  <span style={{
                    fontSize: '9px', fontWeight: 800, fontFamily: 'var(--font-mono)',
                    color: 'var(--text-mute)', background: 'var(--bg-sunken)',
                    padding: '1px 4px', borderRadius: 3, flexShrink: 0,
                  }}>
                    C{skill.skillCircle}
                  </span>
                )}
                {skill.skillCircle === 0 && (
                  <span style={{
                    fontSize: '9px', fontWeight: 800, fontFamily: 'var(--font-mono)',
                    color: meta.color, background: 'var(--bg-sunken)',
                    padding: '1px 4px', borderRadius: 3, flexShrink: 0,
                  }}>
                    EX
                  </span>
                )}

                {/* 이름 */}
                <span style={{
                  flex: 1, minWidth: 0,
                  fontSize: 'var(--fs-sm)', fontWeight: 600,
                  color: equipped ? 'var(--info)' : 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {skill.name}
                </span>

                {/* 속성 */}
                {skill.attr > 0 && (
                  <span style={{
                    fontSize: '9px', color: 'var(--text-mute)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {ATTR_NAMES[skill.attr]}
                  </span>
                )}

                {/* MP */}
                <span style={{
                  fontSize: 'var(--fs-2xs)', fontWeight: 700,
                  fontFamily: 'var(--font-mono)', color: '#6BA3FF',
                  flexShrink: 0,
                }}>
                  {skill.consumeMp}
                </span>

                {/* 장착 버튼 */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleEquip(skill); }}
                  style={{
                    width: 22, height: 22,
                    borderRadius: 'var(--r-sm)',
                    border: equipped ? '1px solid var(--info)' : '1px solid var(--border-soft)',
                    background: equipped ? 'color-mix(in oklch, var(--info) 20%, transparent)' : 'transparent',
                    color: equipped ? 'var(--info)' : 'var(--text-mute)',
                    fontSize: '10px', fontWeight: 800,
                    cursor: 'pointer', transition: 'all 0.12s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 0, flexShrink: 0,
                  }}
                  title={equipped ? '슬롯에서 해제' : '슬롯에 장착'}
                >
                  {equipped ? '✓' : '+'}
                </button>
              </div>
            );
          })}

          {/* 잠긴 스킬 (미리보기) */}
          {filterTab === 'all' && lockedSkills.length > 0 && (
            <>
              <div style={{
                ...LABEL, fontSize: 'var(--fs-xs)', marginTop: 'var(--s-3)',
                marginBottom: 'var(--s-1)', color: 'var(--text-mute)',
              }}>
                미해금 ({lockedSkills.length})
              </div>
              {lockedSkills.slice(0, 10).map(skill => {
                const meta = TYPE_META[skill.skillType];
                const needCircle = skill.skillCircle > 0 && skill.skillCircle > mlvl;
                return (
                  <div
                    key={skill.id}
                    onClick={() => setSelectedSkill(skill)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
                      padding: '5px 8px', marginBottom: 2,
                      borderRadius: 'var(--r-sm)',
                      background: selectedSkill?.id === skill.id
                        ? 'color-mix(in oklch, var(--text-mute) 10%, transparent)' : 'transparent',
                      border: '1px solid transparent',
                      cursor: 'pointer', opacity: 0.45,
                    }}
                  >
                    <span style={{ fontSize: 'var(--fs-sm)' }}>{meta.icon}</span>
                    <span style={{ fontSize: '9px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)' }}>
                      {skill.skillCircle > 0 ? `C${skill.skillCircle}` : 'EX'}
                    </span>
                    <span style={{
                      flex: 1, minWidth: 0, fontSize: 'var(--fs-sm)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: 'var(--text-mute)',
                    }}>
                      {skill.name}
                    </span>
                    <span style={{
                      fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--warning)',
                    }}>
                      {needCircle ? `서클 ${skill.skillCircle} 필요` : `Lv.${skill.requiredLevel}`}
                    </span>
                  </div>
                );
              })}
              {lockedSkills.length > 10 && (
                <div style={{
                  fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)',
                  textAlign: 'center', padding: 'var(--s-2)',
                }}>
                  +{lockedSkills.length - 10}개 더...
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 우측: 스킬 상세 + 슬롯 ── */}
      <div style={{
        ...PANEL_FULL, width: 280, flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: 'var(--s-3)',
      }}>
        {/* 스킬 상세 */}
        {selectedSkill ? (
          <SkillDetail skill={selectedSkill} mlvl={mlvl} level={level} />
        ) : (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-mute)', fontSize: 'var(--fs-sm)',
          }}>
            스킬을 선택하세요
          </div>
        )}

        {/* 슬롯 영역 */}
        <div style={{ flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 'var(--s-2)',
          }}>
            <span style={{ ...LABEL, fontSize: 'var(--fs-xs)' }}>
              스킬 슬롯 ({maxSlots}/{MAX_SKILL_SLOTS})
            </span>
            <button
              onClick={autoEquipSkills}
              style={{
                padding: '3px 10px',
                border: '1px solid var(--border-soft)',
                borderRadius: 'var(--r-sm)',
                background: 'transparent',
                color: 'var(--accent)',
                fontSize: 'var(--fs-2xs)', fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
              title="추천 스킬을 자동으로 슬롯에 배치"
            >
              자동 배치
            </button>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 4,
          }}>
            {slots.map((skillId, idx) => {
              const locked = idx >= maxSlots;
              const skill = skillId ? PLAYER_SKILLS.find(s => s.id === skillId) : null;
              const meta = skill ? TYPE_META[skill.skillType] : null;
              return (
                <div
                  key={idx}
                  onClick={() => !locked && handleSlotClick(idx)}
                  onDragOver={(e) => { if (!locked) e.preventDefault(); }}
                  onDrop={() => handleSlotDrop(idx)}
                  style={{
                    aspectRatio: '1',
                    border: locked
                      ? '1px dashed var(--border-soft)'
                      : skill
                        ? `1px solid ${meta?.color ?? 'var(--border-soft)'}`
                        : '1px solid var(--border-soft)',
                    borderRadius: 'var(--r-sm)',
                    background: locked
                      ? 'var(--bg-sunken)'
                      : skill
                        ? `color-mix(in oklch, ${meta?.color ?? 'var(--info)'} 12%, var(--bg-panel))`
                        : 'var(--bg-panel)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    cursor: locked ? 'not-allowed' : 'pointer',
                    opacity: locked ? 0.3 : 1,
                    transition: 'all 0.12s ease',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  title={locked
                    ? `Lv.${[20, 30, 40, 50][idx - 4] ?? '?'}에 해금`
                    : skill ? `${skill.name} (클릭하여 해제)` : '빈 슬롯 (드래그하여 장착)'}
                >
                  {/* 슬롯 번호 */}
                  <span style={{
                    position: 'absolute', top: 1, left: 3,
                    fontSize: '8px', fontWeight: 700, fontFamily: 'var(--font-mono)',
                    color: 'var(--text-mute)', opacity: 0.5,
                  }}>
                    {idx + 1}
                  </span>

                  {locked ? (
                    <span style={{ fontSize: '10px', color: 'var(--text-mute)' }}>🔒</span>
                  ) : skill ? (
                    <>
                      <span style={{ fontSize: '14px' }}>{meta?.icon}</span>
                      <span style={{
                        fontSize: '8px', fontWeight: 700,
                        color: meta?.color ?? 'var(--text)',
                        maxWidth: '100%', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        padding: '0 2px', textAlign: 'center',
                      }}>
                        {skill.name.length > 4 ? skill.name.slice(0, 4) + '..' : skill.name}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: '10px', color: 'var(--text-mute)', opacity: 0.4 }}>+</span>
                  )}
                </div>
              );
            })}
          </div>

          {nextSlotLevel && (
            <div style={{
              fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)',
              textAlign: 'center', marginTop: 'var(--s-1)',
            }}>
              Lv.{nextSlotLevel}에 슬롯 +1 해금
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 스킬 상세 카드 ── */
function SkillDetail({ skill, mlvl, level }: { skill: PlayerSkill; mlvl: number; level: number }) {
  const meta = TYPE_META[skill.skillType];
  const isUnlocked = (() => {
    if (skill.requiredLevel > level) return false;
    if (skill.skillCircle > 0 && skill.skillCircle > mlvl) return false;
    return true;
  })();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--s-2)',
    }}>
      {/* 이름 + 타입 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
        <span style={{ fontSize: 'var(--fs-lg)' }}>{meta.icon}</span>
        <div>
          <div style={{
            fontWeight: 700, fontSize: 'var(--fs-md)',
            color: isUnlocked ? 'var(--text)' : 'var(--text-mute)',
          }}>
            {skill.name}
          </div>
          <div style={{
            fontSize: 'var(--fs-2xs)', color: meta.color, fontWeight: 600,
          }}>
            {meta.label}
            {skill.skillCircle > 0 && ` · 서클 ${skill.skillCircle}`}
            {skill.skillCircle === 0 && ' · 클래스 전용'}
            {skill.attr > 0 && ` · ${ATTR_NAMES[skill.attr]}속성`}
          </div>
        </div>
      </div>

      {/* 설명 */}
      <div style={{
        fontSize: 'var(--fs-sm)', color: 'var(--text-dim)',
        lineHeight: 1.5, padding: 'var(--s-1) 0',
      }}>
        {skill.description}
      </div>

      {/* 스탯 그리드 */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 'var(--s-1)',
        background: 'var(--bg-sunken)',
        borderRadius: 'var(--r-sm)',
        padding: 'var(--s-2)',
      }}>
        <DetailStat label="MP 소모" value={skill.consumeMp} color="#6BA3FF" />
        <DetailStat label="쿨타운" value={skill.reuseDelayTicks > 0 ? `${skill.reuseDelayTicks}턴` : '-'} color="var(--text-dim)" />
        {skill.skillType === 'attack' && (
          <>
            <DetailStat label="고정 대미지" value={skill.damageValue || '-'} color="var(--danger)" />
            <DetailStat label="주사위" value={skill.damageDiceCount > 0 ? `${skill.damageDiceCount}d${skill.damageDice}` : '동적'} color="var(--warning)" />
          </>
        )}
        {skill.skillType === 'heal' && (
          <>
            <DetailStat label="기본 회복" value={skill.damageValue || '-'} color="var(--success)" />
            <DetailStat label="주사위" value={skill.damageDiceCount > 0 ? `${skill.damageDiceCount}d${skill.damageDice}` : '동적'} color="var(--success)" />
          </>
        )}
        {skill.skillType === 'buff' && skill.buffDuration > 0 && (
          <>
            <DetailStat label="지속시간" value={`${Math.floor(skill.buffDuration / 60)}분`} color="var(--info)" />
            <DetailStat label="효과" value={formatBuffEffect(skill)} color="var(--info)" />
          </>
        )}
      </div>

      {/* 해금 조건 */}
      {!isUnlocked && (
        <div style={{
          background: 'color-mix(in oklch, var(--warning) 10%, transparent)',
          border: '1px solid color-mix(in oklch, var(--warning) 30%, transparent)',
          borderRadius: 'var(--r-sm)',
          padding: 'var(--s-2)',
          fontSize: 'var(--fs-2xs)', color: 'var(--warning)',
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

function DetailStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ ...LABEL, fontSize: 'var(--fs-2xs)' }}>{label}</span>
      <span style={{ ...STAT_VALUE, fontSize: 'var(--fs-sm)', color }}>{value}</span>
    </div>
  );
}

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
