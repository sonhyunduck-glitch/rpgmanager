/* =========================================================
   INVENTORY PANEL — 가방 페이지 (디자인 핸드오프 기반)
   좌측: 카테고리 칩 + 검색/정렬 툴바 + 아이템 그리드
   우측: 착용장비 페이퍼돌 + 장비합계 / 강화 탭
   ========================================================= */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { EQUIPMENT_TEMPLATES } from '../../data/gameData';
import type { Equipment, PlayerClass } from '../../types';
import { useCompact } from '../../lib/useCompact';
import EnhanceSidebar from './EnhanceSidebar';

/* ══════════════════════════════════════════════
   상수 & 타입
   ══════════════════════════════════════════════ */

/** 카테고리 정의 */
const CATS = [
  { id: 'all',    nm: '전체',    ic: '▦' },
  { id: 'weapon', nm: '무기',    ic: '⚔' },
  { id: 'armor',  nm: '방어구',  ic: '◈' },
  { id: 'access', nm: '악세사리', ic: '◯' },
] as const;
type CatId = typeof CATS[number]['id'];

/** 장비 타입 → 카테고리 매핑 */
const CAT_OF: Record<string, CatId> = {
  weapon: 'weapon', bow: 'weapon', staff: 'weapon',
  helmet: 'armor', armor: 'armor', cloak: 'armor', gloves: 'armor',
  boots: 'armor', shield: 'armor', tshirt: 'armor',
  ring: 'access', necklace: 'access', belt: 'access', earring: 'access',
};

/** 정렬 키 */
type SortKey = 'enhDesc' | 'enhAsc' | 'name' | 'typeGroup';

/** 장비 타입 아이콘 */
const TYPE_ICON: Record<string, string> = {
  weapon: '⚔', bow: '⌒', staff: '✦',
  helmet: '⌂', armor: '◈', cloak: '∿', gloves: '✋', boots: '◢',
  shield: '◐', tshirt: '◫',
  ring: '◯', necklace: '◉', belt: '═', earring: '✧',
};

/** 장비 타입 → 아이콘 색상 */
const TYPE_COLOR: Record<string, string> = {
  weapon: 'var(--danger)', bow: 'var(--success)', staff: 'oklch(0.68 0.20 305)',
  helmet: 'var(--info)', armor: 'var(--info)', cloak: 'oklch(0.68 0.20 305)',
  gloves: 'oklch(0.72 0.18 350)', boots: 'var(--accent)',
  shield: 'var(--info)', tshirt: 'var(--text-mute)',
  ring: 'var(--warning)', necklace: 'var(--warning)', belt: 'var(--text-dim)', earring: 'var(--accent)',
};

/** 장비 타입 한글 이름 */
const TYPE_NAME: Record<string, string> = {
  weapon: '검', bow: '활', staff: '지팡이',
  helmet: '투구', armor: '갑옷', cloak: '망토',
  gloves: '장갑', boots: '장화', shield: '방패', tshirt: '티셔츠',
  ring: '반지', necklace: '목걸이', belt: '벨트', earring: '귀걸이',
};

/** 강화 등급 한글 이름 */
function rarityLabel(enh: number): string {
  if (enh >= 9) return '신화';
  if (enh >= 7) return '전설';
  if (enh >= 4) return '희귀';
  if (enh > 0) return '고급';
  return '일반';
}

/** 강화 레벨 기반 "등급" 색상 */
function enhRarityColor(enh: number): string {
  if (enh >= 9) return 'var(--rare-mythic)';
  if (enh >= 7) return 'var(--rare-legendary)';
  if (enh >= 4) return 'var(--rare-rare)';
  if (enh > 0)  return 'var(--rare-uncommon)';
  return 'var(--rare-common)';
}

/** 강화 레벨 기반 이름 색상 */
function nameColor(enh: number): string {
  if (enh >= 9) return 'var(--rare-mythic)';
  if (enh >= 7) return 'var(--rare-legendary)';
  if (enh >= 4) return 'var(--rare-rare)';
  if (enh > 0) return 'var(--rare-uncommon)';
  return 'var(--text)';
}

/** 클래스 뱃지 */
const CLASS_BADGE: Record<PlayerClass, { icon: string; label: string }> = {
  knight: { icon: '⚔️', label: '기사' },
  elf:    { icon: '🏹', label: '요정' },
  wizard: { icon: '🔮', label: '마법사' },
};

/** 착용 슬롯 정의 */
const EQUIP_SLOTS: { key: string; label: string }[] = [
  { key: 'weapon',   label: '무기'   },
  { key: 'helmet',   label: '투구'   },
  { key: 'armor',    label: '갑옷'   },
  { key: 'shield',   label: '방패'   },
  { key: 'cloak',    label: '망토'   },
  { key: 'gloves',   label: '장갑'   },
  { key: 'boots',    label: '장화'   },
  { key: 'tshirt',   label: '티셔츠' },
  { key: 'necklace', label: '목걸이' },
  { key: 'ring',     label: '반지'   },
  { key: 'ring2',    label: '반지2'  },
  { key: 'belt',     label: '벨트'   },
  { key: 'earring',  label: '귀걸이' },
];

/** 뷰 모드 */
type ViewMode = 'grid' | 'list';

/* ══════════════════════════════════════════════
   아이템 카드 (그리드 뷰)
   ══════════════════════════════════════════════ */
function ItemCard({
  eq, isEquipped, isSelected, isChecked,
  onSelect, onCheck, onAction, actionLabel,
}: {
  eq: Equipment;
  isEquipped: boolean;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onCheck: () => void;
  onAction: () => void;
  actionLabel: string;
}) {
  const isWpn = eq.type === 'weapon' || eq.type === 'bow' || eq.type === 'staff';
  const enh = eq.enhanceLevel;
  const rarColor = enhRarityColor(enh);
  const template = EQUIPMENT_TEMPLATES[eq.templateId];
  const classRes = template?.classRestriction;

  return (
    <div
      onClick={onSelect}
      style={{
        background: isSelected
          ? 'color-mix(in oklch, var(--accent) 6%, var(--bg-panel))'
          : 'var(--bg-panel)',
        border: isSelected
          ? '1px solid color-mix(in oklch, var(--accent) 50%, transparent)'
          : '1px solid var(--border-soft)',
        borderLeft: enh > 0 ? `2px solid ${rarColor}` : undefined,
        borderRadius: 7,
        padding: '10px 11px 11px',
        cursor: 'pointer',
        transition: 'border-color 0.12s, background 0.1s',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        overflow: 'hidden',
        boxShadow: enh >= 9
          ? `inset 1px 0 0 ${rarColor}, 0 0 12px color-mix(in oklch, ${rarColor} 10%, transparent)`
          : undefined,
      }}
    >
      {/* Checkbox */}
      <span
        onClick={e => { e.stopPropagation(); onCheck(); }}
        style={{
          position: 'absolute', top: 6, left: 6,
          width: 16, height: 16, borderRadius: 3,
          border: isChecked ? '1px solid var(--accent)' : '1px solid var(--border-strong)',
          background: isChecked ? 'var(--accent)' : 'var(--bg-sunken)',
          opacity: isChecked ? 1 : 0,
          transition: 'opacity 0.12s',
          display: 'grid', placeItems: 'center',
          fontSize: 10, fontWeight: 700,
          color: isChecked ? '#1a1100' : 'transparent',
          cursor: 'pointer',
          zIndex: 2,
        }}
        onMouseEnter={e => { if (!isChecked) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        onMouseLeave={e => { if (!isChecked) (e.currentTarget as HTMLElement).style.opacity = '0'; }}
      >
        {isChecked ? '✓' : ''}
      </span>

      {/* Equipped badge */}
      {isEquipped && (
        <span style={{
          position: 'absolute', top: 6, right: 8,
          width: 16, height: 16,
          fontFamily: 'var(--font-mono)', fontSize: 9,
          background: 'var(--accent)', color: '#1a1100',
          borderRadius: 3, fontWeight: 700,
          display: 'grid', placeItems: 'center',
        }}>
          E
        </span>
      )}

      {/* Head: icon + name */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 5,
          background: 'var(--bg-sunken)', border: '1px solid var(--border-soft)',
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 14,
          color: TYPE_COLOR[eq.type] ?? 'var(--text-mute)',
          flexShrink: 0,
        }}>
          {TYPE_ICON[eq.type] ?? '·'}
        </div>
        <span style={{
          fontSize: 12.5, fontWeight: 500,
          lineHeight: 1.3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          flex: 1, minWidth: 0,
          color: nameColor(enh),
          textShadow: enh >= 9 ? `0 0 6px color-mix(in oklch, ${rarColor} 30%, transparent)` : undefined,
        }}>
          {eq.name}
          {enh > 0 && (
            <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 11, marginLeft: 3 }}>
              +{enh}
            </span>
          )}
        </span>
      </div>

      {/* Options / bonuses */}
      {eq.bonusEffects.length > 0 && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--text-mute)',
          display: 'flex', flexDirection: 'column', gap: 0,
          lineHeight: 1.4,
        }}>
          {eq.bonusEffects.slice(0, 3).map((eff, i) => (
            <span key={i} style={{ color: 'var(--success)' }}>+ {eff}</span>
          ))}
        </div>
      )}

      {/* Stat line */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'var(--text-dim)',
      }}>
        {isWpn
          ? <>타격 {eq.baseAtk}/{eq.baseAtkLarge}{enh > 0 && <span style={{ color: 'var(--success)' }}> (+{enh})</span>}</>
          : <>AC {eq.baseDef}<span style={{ color: enh > 0 ? 'var(--success)' : 'var(--text-mute)' }}>+{enh}</span></>
        }
      </div>

      {/* Class restriction tags */}
      {classRes && classRes.length > 0 && (
        <div style={{ display: 'flex', gap: 3, fontSize: 10 }}>
          {classRes.map(cls => {
            const b = CLASS_BADGE[cls];
            return (
              <span key={cls} style={{
                padding: '0 4px',
                borderRadius: 3,
                background: 'color-mix(in oklch, var(--text-mute) 8%, transparent)',
                color: 'var(--text-mute)', lineHeight: '16px',
              }}>
                {b.icon}{b.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Footer: level */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginTop: 'auto', paddingTop: 6,
      }}>
        {(template?.minLevel ?? 0) > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>
            Lv.{template!.minLevel}
          </span>
        )}
        {eq.isTwoHanded && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)' }}>양손</span>
        )}
      </div>

      {/* Equip / action button */}
      <button
        onClick={e => { e.stopPropagation(); onAction(); }}
        style={{
          marginTop: 4,
          padding: '5px 0',
          background: isEquipped
            ? 'color-mix(in oklch, var(--accent) 8%, transparent)'
            : 'color-mix(in oklch, var(--success) 8%, transparent)',
          border: isEquipped
            ? '1px solid color-mix(in oklch, var(--accent) 35%, transparent)'
            : '1px solid color-mix(in oklch, var(--success) 30%, transparent)',
          color: isEquipped ? 'var(--accent)' : 'var(--success)',
          fontSize: 11, fontWeight: 600, borderRadius: 4,
          cursor: 'pointer', transition: 'all 0.1s',
        }}
      >
        {actionLabel}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════
   아이템 행 (리스트 뷰)
   ══════════════════════════════════════════════ */
function ItemRow({
  eq, isEquipped, isSelected, isChecked,
  onSelect, onCheck, onAction, actionLabel,
}: {
  eq: Equipment;
  isEquipped: boolean;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onCheck: () => void;
  onAction: () => void;
  actionLabel: string;
}) {
  const isWpn = eq.type === 'weapon' || eq.type === 'bow' || eq.type === 'staff';
  const enh = eq.enhanceLevel;
  const rarColor = enhRarityColor(enh);

  return (
    <div
      onClick={onSelect}
      style={{
        background: isSelected
          ? 'color-mix(in oklch, var(--accent) 6%, var(--bg-panel))'
          : 'var(--bg-panel)',
        border: isSelected
          ? '1px solid color-mix(in oklch, var(--accent) 50%, transparent)'
          : '1px solid var(--border-soft)',
        borderLeft: enh > 0 ? `2px solid ${rarColor}` : undefined,
        borderRadius: 7,
        padding: '8px 12px',
        cursor: 'pointer',
        transition: 'border-color 0.12s, background 0.1s',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        position: 'relative',
      }}
    >
      {/* Checkbox */}
      <span
        onClick={e => { e.stopPropagation(); onCheck(); }}
        style={{
          width: 16, height: 16, borderRadius: 3,
          border: isChecked ? '1px solid var(--accent)' : '1px solid var(--border-strong)',
          background: isChecked ? 'var(--accent)' : 'var(--bg-sunken)',
          display: 'grid', placeItems: 'center',
          fontSize: 10, fontWeight: 700,
          color: isChecked ? '#1a1100' : 'transparent',
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        {isChecked ? '✓' : ''}
      </span>

      {/* Icon */}
      <div style={{
        width: 24, height: 24, borderRadius: 4,
        background: 'var(--bg-sunken)', border: '1px solid var(--border-soft)',
        display: 'grid', placeItems: 'center',
        fontFamily: 'var(--font-mono)', fontSize: 12,
        color: TYPE_COLOR[eq.type] ?? 'var(--text-mute)',
        flexShrink: 0,
      }}>
        {TYPE_ICON[eq.type] ?? '·'}
      </div>

      {/* Name */}
      <div style={{ flex: '0 0 180px', minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 500,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          color: nameColor(enh),
        }}>
          {eq.name}
          {enh > 0 && <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 10, marginLeft: 3 }}>+{enh}</span>}
        </div>
      </div>

      {/* Stat */}
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'var(--text-dim)', flex: 1,
      }}>
        {isWpn
          ? `타격 ${eq.baseAtk}/${eq.baseAtkLarge}${enh > 0 ? ` (+${enh})` : ''}`
          : `AC ${eq.baseDef}+${enh}`
        }
      </span>

      {/* Bonuses */}
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'var(--success)', flex: 1,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {eq.bonusEffects.slice(0, 2).join(', ')}
      </span>

      {/* Equipped badge */}
      {isEquipped && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          background: 'var(--accent)', color: '#1a1100',
          borderRadius: 3, fontWeight: 700,
          padding: '1px 5px',
        }}>
          E
        </span>
      )}

      {/* Action */}
      <button
        onClick={e => { e.stopPropagation(); onAction(); }}
        style={{
          padding: '6px 14px', borderRadius: 4,
          background: isEquipped
            ? 'color-mix(in oklch, var(--accent) 8%, transparent)'
            : 'color-mix(in oklch, var(--success) 8%, transparent)',
          border: isEquipped
            ? '1px solid color-mix(in oklch, var(--accent) 35%, transparent)'
            : '1px solid color-mix(in oklch, var(--success) 30%, transparent)',
          color: isEquipped ? 'var(--accent)' : 'var(--success)',
          fontSize: 11, fontWeight: 600, cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {actionLabel}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════
   모바일 아이템 카드 (디자인 핸드오프 기반)
   3-col 그리드용 컴팩트 카드
   ══════════════════════════════════════════════ */
function MobileItemCard({
  eq, isEquipped, onTap,
}: {
  eq: Equipment;
  isEquipped: boolean;
  onTap: () => void;
}) {
  const enh = eq.enhanceLevel;
  const rarColor = enhRarityColor(enh);
  const template = EQUIPMENT_TEMPLATES[eq.templateId];
  const isWpn = eq.type === 'weapon' || eq.type === 'bow' || eq.type === 'staff';

  return (
    <button
      onClick={onTap}
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-soft)',
        borderLeft: enh > 0 ? `2px solid ${rarColor}` : undefined,
        borderRadius: 8,
        padding: 8,
        position: 'relative',
        aspectRatio: '0.92',
        display: 'flex', flexDirection: 'column',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
        color: 'var(--text)',
        boxShadow: enh >= 9
          ? `0 0 12px color-mix(in oklch, ${rarColor} 20%, transparent)`
          : undefined,
      }}
    >
      {/* Equipped badge */}
      {isEquipped && (
        <span style={{
          position: 'absolute', top: 4, right: 6,
          width: 14, height: 14,
          background: 'var(--accent)', color: '#000',
          borderRadius: 3,
          fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 700,
          display: 'grid', placeItems: 'center',
        }}>E</span>
      )}

      {/* Icon block: icon + enhance */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{
          width: 24, height: 24,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-soft)',
          borderRadius: 4,
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 12,
          color: TYPE_COLOR[eq.type] ?? 'var(--text-mute)',
          flexShrink: 0,
        }}>
          {TYPE_ICON[eq.type] ?? '·'}
        </span>
        {enh > 0 && (
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            color: 'var(--accent)',
          }}>+{enh}</span>
        )}
      </div>

      {/* Name (2-line clamp) */}
      <div style={{
        fontSize: 11, fontWeight: 600,
        lineHeight: 1.25,
        overflow: 'hidden', textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical' as never,
        marginBottom: 3,
        color: nameColor(enh),
      }}>
        {eq.name}
      </div>

      {/* Meta footer */}
      <div style={{
        marginTop: 'auto',
        fontFamily: 'var(--font-mono)', fontSize: 9,
        color: 'var(--text-faint)',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{(template?.minLevel ?? 0) > 0 ? `Lv.${template!.minLevel}` : ''}</span>
        <span>
          {isWpn
            ? `${eq.baseAtk}/${eq.baseAtkLarge}`
            : eq.baseDef > 0 ? `AC ${eq.baseDef}` : '~'
          }
        </span>
      </div>
    </button>
  );
}

/* ══════════════════════════════════════════════
   모바일 상세 시트 (바텀 드로어)
   아이템 탭 → 카드 탭 시 상세 + 액션 표시
   ══════════════════════════════════════════════ */
function DetailSheet({
  item, isEquipped, isOpen,
  onClose, onEquip, onUnequip, onEnhance, onSell,
}: {
  item: Equipment;
  isEquipped: boolean;
  isOpen: boolean;
  onClose: () => void;
  onEquip: () => void;
  onUnequip: () => void;
  onEnhance: () => void;
  onSell: () => void;
}) {
  const enh = item.enhanceLevel;
  const isWpn = item.type === 'weapon' || item.type === 'bow' || item.type === 'staff';
  const template = EQUIPMENT_TEMPLATES[item.templateId];
  const classRes = template?.classRestriction;

  const statRowStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between',
    padding: '4px 0',
    fontFamily: 'var(--font-mono)', fontSize: 12,
  };

  const metaParts: string[] = [rarityLabel(enh)];
  if (template?.minLevel) metaParts.push(`Lv.${template.minLevel}`);
  metaParts.push(TYPE_NAME[item.type] ?? item.type);
  if (classRes?.length) metaParts.push(classRes.map(c => CLASS_BADGE[c].label).join('/'));

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 79,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.2s',
        }}
      />
      {/* Sheet */}
      <div style={{
        position: 'fixed',
        left: 0, right: 0, bottom: 0,
        background: 'var(--bg-panel)',
        borderTop: '1px solid var(--border)',
        borderRadius: '14px 14px 0 0',
        zIndex: 80,
        maxWidth: 420, margin: '0 auto',
        boxShadow: '0 -8px 24px rgba(0,0,0,0.5)',
        maxHeight: '75%',
        overflowY: 'auto',
        transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Grip handle */}
        <div style={{
          width: 40, height: 4,
          background: 'var(--border)',
          borderRadius: 100,
          margin: '8px auto 12px',
        }} />

        {/* Head: icon + name + meta */}
        <div style={{
          padding: '0 16px 12px',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 48, height: 48,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-soft)',
            borderRadius: 8,
            display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 22,
            color: TYPE_COLOR[item.type] ?? 'var(--text-mute)',
            flexShrink: 0,
          }}>
            {TYPE_ICON[item.type] ?? '·'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 16, fontWeight: 700,
              color: nameColor(enh),
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {item.name}
              {enh > 0 && (
                <span style={{
                  color: 'var(--accent)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13, fontWeight: 700, marginLeft: 4,
                }}>+{enh}</span>
              )}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--text-mute)', marginTop: 2,
            }}>
              {metaParts.join(' · ')}
            </div>
          </div>
        </div>

        {/* Stat rows */}
        <div style={{
          padding: '12px 16px',
          borderBottom: item.bonusEffects.length > 0 ? '1px solid var(--border-soft)' : 'none',
        }}>
          {isWpn ? (
            <div style={statRowStyle}>
              <span style={{ color: 'var(--text-mute)' }}>타격</span>
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                {item.baseAtk}/{item.baseAtkLarge}{enh > 0 && ` (+${enh})`}
              </span>
            </div>
          ) : item.baseDef > 0 ? (
            <div style={statRowStyle}>
              <span style={{ color: 'var(--text-mute)' }}>AC</span>
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                {item.baseDef}+{enh}
              </span>
            </div>
          ) : null}

          {item.bonusEffects.map((eff, i) => (
            <div key={i} style={statRowStyle}>
              <span style={{ color: 'var(--text-mute)' }}>{eff.replace(/[+\-\d]/g, '').trim()}</span>
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>{eff}</span>
            </div>
          ))}

          {item.isTwoHanded && (
            <div style={statRowStyle}>
              <span style={{ color: 'var(--text-mute)' }}>무기 형태</span>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>양손</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
          padding: '12px 16px',
        }}>
          <button
            onClick={onEnhance}
            style={{
              padding: 12, borderRadius: 8,
              fontWeight: 700, fontSize: 13,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            강화
          </button>
          <button
            onClick={isEquipped ? onUnequip : onEquip}
            style={{
              padding: 12, borderRadius: 8,
              fontWeight: 700, fontSize: 13,
              background: isEquipped
                ? 'var(--bg-elevated)'
                : 'linear-gradient(135deg, var(--success), oklch(0.66 0.16 135))',
              border: isEquipped ? '1px solid var(--border)' : 'none',
              color: isEquipped ? 'var(--accent)' : '#fff',
              cursor: 'pointer',
            }}
          >
            {isEquipped ? '해제' : '착용하기'}
          </button>
        </div>

        {/* Sell button (only for non-equipped items) */}
        {!isEquipped && (
          <div style={{ padding: '0 16px 16px' }}>
            <button
              onClick={onSell}
              style={{
                width: '100%', padding: 10, borderRadius: 8,
                background: 'transparent',
                border: '1px solid color-mix(in oklch, var(--danger) 30%, transparent)',
                color: 'var(--danger)',
                fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              판매
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════
   메인 컴포넌트
   ══════════════════════════════════════════════ */
export default function InventoryPanel() {
  const inventory = useGameStore(s => s.inventory);
  const inventoryCapacity = useGameStore(s => s.inventoryCapacity);
  const materials = useGameStore(s => s.materials);
  const gold = useGameStore(s => s.gold);
  const equipFromInventory = useGameStore(s => s.equipFromInventory);
  const unequipToInventory = useGameStore(s => s.unequipToInventory);
  const sellFromInventory = useGameStore(s => s.sellFromInventory);

  const enhanceTargetUid = useGameStore(s => s.enhanceTargetUid);
  const setEnhanceTarget = useGameStore(s => s.setEnhanceTarget);
  const tryEnhance = useGameStore(s => s.tryEnhance);

  const equippedMap: Record<string, Equipment | null> = {
    weapon:   useGameStore(s => s.equippedWeapon),
    tshirt:   useGameStore(s => s.equippedTshirt),
    helmet:   useGameStore(s => s.equippedHelmet),
    armor:    useGameStore(s => s.equippedArmor),
    cloak:    useGameStore(s => s.equippedCloak),
    gloves:   useGameStore(s => s.equippedGloves),
    boots:    useGameStore(s => s.equippedBoots),
    shield:   useGameStore(s => s.equippedShield),
    necklace: useGameStore(s => s.equippedNecklace),
    ring:     useGameStore(s => s.equippedRing),
    ring2:    useGameStore(s => s.equippedRing2),
    belt:     useGameStore(s => s.equippedBelt),
    earring:  useGameStore(s => s.equippedEarring),
  };

  const equippedItems = Object.values(equippedMap).filter((e): e is Equipment => e !== null);
  const equippedUids = new Set(equippedItems.map(e => e.uid));

  const compact = useCompact();

  // ── State ──
  const [cat, setCat] = useState<CatId>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('enhDesc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [rightTab, setRightTab] = useState<'equip' | 'enhance'>('equip');
  const [mobileView, setMobileView] = useState<'items' | 'sidebar'>('items');
  const [detailItem, setDetailItem] = useState<Equipment | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // 모바일 상세 시트 열기/닫기
  useEffect(() => {
    if (detailItem) {
      requestAnimationFrame(() => setSheetOpen(true));
    }
  }, [detailItem]);

  const closeDetail = useCallback(() => {
    setSheetOpen(false);
    setTimeout(() => setDetailItem(null), 260);
  }, []);

  // 상세 시트에서 판매/착용/해제 후 시트 자동 닫기
  const handleSheetEquip = useCallback(() => {
    if (detailItem) { equipFromInventory(detailItem.uid); closeDetail(); }
  }, [detailItem, equipFromInventory, closeDetail]);

  const handleSheetUnequip = useCallback(() => {
    if (detailItem) { unequipToInventory(detailItem.uid); closeDetail(); }
  }, [detailItem, unequipToInventory, closeDetail]);

  const handleSheetSell = useCallback(() => {
    if (detailItem) { sellFromInventory(detailItem.uid); closeDetail(); }
  }, [detailItem, sellFromInventory, closeDetail]);

  const handleSheetEnhance = useCallback(() => {
    if (detailItem) {
      setEnhanceTarget(detailItem.uid);
      setRightTab('enhance');
      setMobileView('sidebar');
      closeDetail();
    }
  }, [detailItem, setEnhanceTarget, closeDetail]);

  const selectedUid = enhanceTargetUid;
  const selectedItem = selectedUid
    ? (equippedItems.find(e => e.uid === selectedUid) ?? inventory.find(e => e.uid === selectedUid) ?? null)
    : null;

  // ── Category counts ──
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: inventory.length };
    for (const item of inventory) {
      const k = CAT_OF[item.type] ?? 'all';
      c[k] = (c[k] || 0) + 1;
    }
    return c;
  }, [inventory]);

  // ── Filtered + sorted ──
  const rows = useMemo(() => {
    let r = inventory.slice();
    if (cat !== 'all') r = r.filter(i => CAT_OF[i.type] === cat);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(i => i.name.toLowerCase().includes(q) || i.bonusEffects.join(' ').toLowerCase().includes(q));
    }
    const typeOrder: Record<string, number> = {
      weapon: 0, bow: 1, staff: 2,
      helmet: 3, armor: 4, shield: 5, cloak: 6, gloves: 7, boots: 8, tshirt: 9,
      necklace: 10, ring: 11, belt: 12, earring: 13,
    };
    r.sort((a, b) => {
      if (sortKey === 'enhDesc') return (b.enhanceLevel - a.enhanceLevel) || a.name.localeCompare(b.name);
      if (sortKey === 'enhAsc')  return (a.enhanceLevel - b.enhanceLevel) || a.name.localeCompare(b.name);
      if (sortKey === 'name')    return a.name.localeCompare(b.name);
      if (sortKey === 'typeGroup') return ((typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99)) || (b.enhanceLevel - a.enhanceLevel);
      return 0;
    });
    return r;
  }, [inventory, cat, search, sortKey]);

  // ── Handlers ──
  const onCheck = useCallback((uid: string) => {
    setChecked(s => {
      const n = new Set(s);
      if (n.has(uid)) n.delete(uid); else n.add(uid);
      return n;
    });
  }, []);

  const clearChecked = useCallback(() => setChecked(new Set()), []);

  const handleBatchSell = useCallback(() => {
    const uids = [...checked];
    for (const uid of uids) {
      sellFromInventory(uid);
    }
    clearChecked();
  }, [checked, sellFromInventory, clearChecked]);

  // ── Equipment totals (for sidebar) ──
  const totals = useMemo(() => {
    const t = { ac: 0, hit: 0, extraDmg: 0, str: 0, dex: 0, con: 0, wis: 0,
                mr: 0, hp: 0, sp: 0 };
    for (const eq of equippedItems) {
      const isWpn = eq.type === 'weapon' || eq.type === 'bow' || eq.type === 'staff';
      if (!isWpn) {
        t.ac += eq.baseDef + eq.enhanceLevel;
      }
      const b = eq.bonuses;
      if (b) {
        if (b.hit) t.hit += b.hit;
        if (b.extraDmg) t.extraDmg += b.extraDmg;
        if (b.str) t.str += b.str;
        if (b.dex) t.dex += b.dex;
        if (b.con) t.con += b.con;
        if (b.wis) t.wis += b.wis;
        if (b.mr) t.mr += b.mr;
        if (b.hp) t.hp += b.hp;
        if (b.sp) t.sp += b.sp;
      }
    }
    return t;
  }, [equippedItems]);

  const capacityPct = inventoryCapacity > 0 ? Math.min(100, (inventory.length / inventoryCapacity) * 100) : 0;

  return (
    <div style={{
      height: '100%',
      overflow: 'hidden',
      ...(compact ? {
        display: 'flex',
        flexDirection: 'column' as const,
      } : {
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        gridTemplateRows: 'auto 1fr',
        gap: '14px 18px',
        padding: '18px 22px 24px',
      }),
    }}>
      {/* ━━━ BREADCRUMB ━━━ */}
      <div style={{
        gridColumn: '1 / -1',
        display: 'flex', alignItems: 'center', gap: compact ? 8 : 14,
        padding: compact ? '8px 10px' : undefined,
        paddingBottom: compact ? 8 : 12,
        borderBottom: compact ? 'none' : '1px solid var(--border-soft)',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: compact ? 15 : 17, fontWeight: 700, color: 'var(--text)',
          display: 'inline-flex', alignItems: 'baseline', gap: compact ? 6 : 10,
        }}>
          가방
          {/* Desktop: inline capacity */}
          {!compact && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontFamily: 'var(--font-mono)', fontSize: 11.5,
            }}>
              <span style={{ fontWeight: 600 }}>
                {inventory.length}<span style={{ color: 'var(--text-mute)' }}>/{inventoryCapacity}</span>
              </span>
              <span style={{
                width: 100, height: 4,
                background: 'var(--bg-elevated)', borderRadius: 2,
                overflow: 'hidden', display: 'inline-block',
              }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${capacityPct}%`,
                  background: capacityPct > 90
                    ? 'var(--danger)'
                    : 'linear-gradient(90deg, var(--success), var(--accent))',
                  transition: 'width 0.2s',
                }} />
              </span>
            </span>
          )}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontFamily: 'var(--font-mono)', fontSize: compact ? 11 : 12,
          color: 'var(--accent)',
        }}>
          $ {gold.toLocaleString()}
        </span>
      </div>

      {/* ━━━ MOBILE: CAPACITY ROW ━━━ */}
      {compact && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 10px 8px',
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)' }}>
            용량
          </span>
          <span style={{
            flex: 1, height: 4,
            background: 'var(--bg-panel)', borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${capacityPct}%`,
              background: capacityPct > 90
                ? 'var(--danger)'
                : 'linear-gradient(90deg, var(--success), var(--accent))',
              transition: 'width 0.2s',
            }} />
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>
            {inventory.length}/{inventoryCapacity}
          </span>
        </div>
      )}

      {/* ━━━ MOBILE VIEW TABS ━━━ */}
      {compact && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          background: 'var(--bg-elevated)',
          borderRadius: 8,
          padding: 3,
          margin: '0 10px 8px',
          flexShrink: 0,
        }}>
          <button onClick={() => setMobileView('items')} style={{
            padding: 8, borderRadius: 6,
            border: 'none', cursor: 'pointer',
            color: mobileView === 'items' ? 'var(--accent)' : 'var(--text-mute)',
            background: mobileView === 'items' ? 'var(--bg-panel)' : 'transparent',
            fontSize: 12, fontWeight: 600,
            transition: 'all 0.12s',
          }}>
            아이템
          </button>
          <button onClick={() => setMobileView('sidebar')} style={{
            padding: 8, borderRadius: 6,
            border: 'none', cursor: 'pointer',
            color: mobileView === 'sidebar' ? 'var(--accent)' : 'var(--text-mute)',
            background: mobileView === 'sidebar' ? 'var(--bg-panel)' : 'transparent',
            fontSize: 12, fontWeight: 600,
            transition: 'all 0.12s',
          }}>
            장착중 ({equippedItems.length})
          </button>
        </div>
      )}

      {/* ━━━ LEFT: ITEMS ━━━ */}
      {(!compact || mobileView === 'items') && (compact ? (
        /* ═══════ MOBILE ITEMS VIEW ═══════ */
        <div style={{
          flex: 1, minHeight: 0,
          overflowY: 'auto', overflowX: 'hidden',
          padding: '0 10px 16px',
        }}>
          {/* Horizontal scrolling chip row */}
          <div
            className="hide-scrollbar"
            style={{
              display: 'flex', gap: 6,
              overflowX: 'auto',
              margin: '0 -10px 10px',
              padding: '0 10px 4px',
            }}
          >
            {CATS.map(c => {
              const active = cat === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  style={{
                    flexShrink: 0,
                    padding: '6px 12px',
                    background: active ? 'oklch(0.74 0.17 55 / 0.1)' : 'var(--bg-panel)',
                    border: active
                      ? '1px solid oklch(0.74 0.17 55 / 0.5)'
                      : '1px solid var(--border-soft)',
                    borderRadius: 100,
                    fontSize: 11.5,
                    color: active ? 'var(--accent)' : 'var(--text-mute)',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                >
                  {c.nm}
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9.5,
                    color: active ? 'var(--accent)' : 'var(--text-faint)',
                  }}>
                    {counts[c.id] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Multi-select action bar (mobile) */}
          {checked.size > 0 && (
            <div style={{
              position: 'sticky', top: 0, zIndex: 5,
              background: 'var(--bg-panel)',
              border: '1px solid var(--accent)',
              borderRadius: 6,
              padding: '6px 10px',
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
              <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                <span style={{ fontWeight: 700 }}>{checked.size}</span>개
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button onClick={handleBatchSell} style={{
                  padding: '5px 10px', background: 'var(--bg-elevated)',
                  border: '1px solid color-mix(in oklch, var(--success) 30%, transparent)',
                  color: 'var(--success)', fontSize: 11, borderRadius: 4, cursor: 'pointer',
                }}>판매</button>
                <button onClick={clearChecked} style={{
                  padding: '5px 10px', background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-soft)',
                  color: 'var(--text-mute)', fontSize: 11, borderRadius: 4, cursor: 'pointer',
                }}>해제</button>
              </span>
            </div>
          )}

          {/* 3-column grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 6,
            alignContent: 'start',
          }}>
            {rows.map(eq => (
              <MobileItemCard
                key={eq.uid}
                eq={eq}
                isEquipped={equippedUids.has(eq.uid)}
                onTap={() => setDetailItem(eq)}
              />
            ))}
            {rows.length === 0 && (
              <div style={{
                padding: 30, textAlign: 'center',
                color: 'var(--text-faint)', gridColumn: '1 / -1',
                fontFamily: 'var(--font-ui)',
              }}>
                {search ? '검색 결과가 없습니다.' : '아이템이 없습니다.'}
              </div>
            )}
          </div>
        </div>
      ) : !compact ? (
        /* ═══════ DESKTOP ITEMS VIEW ═══════ */
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden' }}>
          {/* Filter tabs */}
          <div style={{
            display: 'flex', gap: 6, alignItems: 'center',
            flexWrap: 'wrap', marginBottom: 14,
          }}>
            {CATS.map(c => {
              const active = cat === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  style={{
                    padding: '7px 14px',
                    background: active ? 'color-mix(in oklch, var(--accent) 6%, transparent)' : 'var(--bg-elevated)',
                    border: active
                      ? '1px solid color-mix(in oklch, var(--accent) 40%, transparent)'
                      : '1px solid var(--border-soft)',
                    borderRadius: 6,
                    fontSize: 12,
                    color: active ? 'var(--accent)' : 'var(--text-mute)',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    cursor: 'pointer',
                    transition: 'color 0.12s, border-color 0.12s, background 0.12s',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1 }}>{c.ic}</span>
                  {c.nm}
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: active ? 'var(--accent)' : 'var(--text-faint)',
                    padding: '0 5px',
                    background: active
                      ? 'color-mix(in oklch, var(--accent) 10%, transparent)'
                      : 'var(--bg-sunken)',
                    borderRadius: 100,
                    marginLeft: 2,
                  }}>
                    {counts[c.id] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Toolbar: search + sort + view toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 14,
            flexWrap: 'wrap',
          }}>
            {/* Search */}
            <div style={{
              flex: 1, maxWidth: 280,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 12px',
              background: 'var(--bg-panel)', border: '1px solid var(--border-soft)', borderRadius: 6,
            }}>
              <span style={{ color: 'var(--text-faint)', fontSize: 13, lineHeight: 1 }}>🔍</span>
              <input
                placeholder="아이템 검색"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  flex: 1, fontSize: 12.5,
                  background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text)', fontFamily: 'var(--font-ui)',
                }}
              />
            </div>

            {/* Sort */}
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              style={{
                padding: '7px 28px 7px 11px',
                background: 'var(--bg-panel)', border: '1px solid var(--border-soft)', borderRadius: 6,
                fontSize: 11.5, color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                appearance: 'none' as const,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%237c8696' d='M1.5 3.5L5 7l3.5-3.5z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
              }}
            >
              <option value="enhDesc">강화 높은순</option>
              <option value="enhAsc">강화 낮은순</option>
              <option value="typeGroup">종류별</option>
              <option value="name">이름</option>
            </select>

            {/* View toggle */}
            <div style={{
              display: 'inline-flex', padding: 2,
              background: 'var(--bg-elevated)', borderRadius: 5,
            }}>
              {([
                { mode: 'grid' as ViewMode, label: '그리드', svg: <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/><rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/></svg> },
                { mode: 'list' as ViewMode, label: '리스트', svg: <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="3" width="12" height="2"/><rect x="2" y="7" width="12" height="2"/><rect x="2" y="11" width="12" height="2"/></svg> },
              ]).map(v => (
                <button
                  key={v.mode}
                  onClick={() => setViewMode(v.mode)}
                  style={{
                    padding: '5px 10px', borderRadius: 3,
                    color: viewMode === v.mode ? 'var(--accent)' : 'var(--text-mute)',
                    background: viewMode === v.mode ? 'var(--bg-panel)' : 'transparent',
                    border: 'none', fontSize: 11, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}
                >
                  {v.svg}
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Multi-select action bar */}
          {checked.size > 0 && (
            <div style={{
              position: 'sticky', top: 0, zIndex: 5,
              background: 'var(--bg-panel)',
              border: '1px solid var(--accent)',
              borderRadius: 6,
              padding: '8px 12px',
              display: 'flex', alignItems: 'center', gap: 12,
              marginBottom: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
              <span style={{
                color: 'var(--accent)',
                fontFamily: 'var(--font-mono)', fontSize: 12,
              }}>
                <span style={{ fontWeight: 700 }}>{checked.size}</span>개 선택됨
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button
                  onClick={handleBatchSell}
                  style={{
                    padding: '6px 12px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid color-mix(in oklch, var(--success) 30%, transparent)',
                    color: 'var(--success)',
                    fontSize: 11.5, borderRadius: 5, cursor: 'pointer',
                  }}
                >
                  선택 판매 ($)
                </button>
                <button
                  onClick={clearChecked}
                  style={{
                    padding: '6px 12px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-soft)',
                    color: 'var(--text-mute)',
                    fontSize: 11.5, borderRadius: 5, cursor: 'pointer',
                  }}
                >
                  해제
                </button>
              </span>
            </div>
          )}

          {/* Items grid / list */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {viewMode === 'grid' ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 8,
                alignContent: 'start',
              }}>
                {rows.map(eq => (
                  <ItemCard
                    key={eq.uid}
                    eq={eq}
                    isEquipped={equippedUids.has(eq.uid)}
                    isSelected={eq.uid === selectedUid}
                    isChecked={checked.has(eq.uid)}
                    onSelect={() => { setEnhanceTarget(eq.uid); setRightTab('enhance'); }}
                    onCheck={() => onCheck(eq.uid)}
                    onAction={() => equippedUids.has(eq.uid) ? unequipToInventory(eq.uid) : equipFromInventory(eq.uid)}
                    actionLabel={equippedUids.has(eq.uid) ? '착용중' : '착용'}
                  />
                ))}
                {rows.length === 0 && (
                  <div style={{
                    padding: 60, textAlign: 'center',
                    color: 'var(--text-faint)', gridColumn: '1 / -1',
                    fontFamily: 'var(--font-ui)',
                  }}>
                    {search ? '검색 결과가 없습니다.' : '조건에 맞는 아이템이 없습니다.'}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {rows.map(eq => (
                  <ItemRow
                    key={eq.uid}
                    eq={eq}
                    isEquipped={equippedUids.has(eq.uid)}
                    isSelected={eq.uid === selectedUid}
                    isChecked={checked.has(eq.uid)}
                    onSelect={() => { setEnhanceTarget(eq.uid); setRightTab('enhance'); }}
                    onCheck={() => onCheck(eq.uid)}
                    onAction={() => equippedUids.has(eq.uid) ? unequipToInventory(eq.uid) : equipFromInventory(eq.uid)}
                    actionLabel={equippedUids.has(eq.uid) ? '착용중' : '착용'}
                  />
                ))}
                {rows.length === 0 && (
                  <div style={{
                    padding: 60, textAlign: 'center',
                    color: 'var(--text-faint)',
                    fontFamily: 'var(--font-ui)',
                  }}>
                    {search ? '검색 결과가 없습니다.' : '조건에 맞는 아이템이 없습니다.'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null)}

      {/* ━━━ RIGHT SIDEBAR ━━━ */}
      {(!compact || mobileView === 'sidebar') && <div style={{
        flex: compact ? 1 : undefined,
        minHeight: compact ? 0 : undefined,
        alignSelf: compact ? undefined : 'start',
        position: compact ? undefined : 'sticky',
        top: compact ? undefined : 14,
        display: 'flex', flexDirection: 'column', gap: 12,
        padding: compact ? '0 10px' : undefined,
        maxHeight: compact ? undefined : 'calc(100vh - 120px)',
        overflow: compact ? 'auto' : 'hidden',
      }}>
        {/* Side tabs */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 4, padding: 4,
          background: 'var(--bg-elevated)', borderRadius: 6,
        }}>
          <button
            onClick={() => setRightTab('equip')}
            style={{
              padding: '7px 0', textAlign: 'center', borderRadius: 4,
              border: 'none', cursor: 'pointer',
              color: rightTab === 'equip' ? 'var(--accent)' : 'var(--text-mute)',
              background: rightTab === 'equip' ? 'var(--bg-panel)' : 'transparent',
              fontSize: 12, fontWeight: rightTab === 'equip' ? 600 : 400,
              transition: 'all 0.12s',
            }}
          >
            착용 장비
          </button>
          <button
            onClick={() => setRightTab('enhance')}
            style={{
              padding: '7px 0', textAlign: 'center', borderRadius: 4,
              border: 'none', cursor: 'pointer',
              color: rightTab === 'enhance' ? 'var(--accent)' : 'var(--text-mute)',
              background: rightTab === 'enhance' ? 'var(--bg-panel)' : 'transparent',
              fontSize: 12, fontWeight: rightTab === 'enhance' ? 600 : 400,
              transition: 'all 0.12s',
            }}
          >
            강화
          </button>
        </div>

        {rightTab === 'equip' ? (
          <>
            {/* Paperdoll */}
            <div style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-soft)',
              borderRadius: 8, overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                margin: 0, padding: '11px 14px',
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--text-mute)',
                textTransform: 'uppercase' as const, letterSpacing: '0.12em', fontWeight: 600,
                borderBottom: '1px solid var(--border-soft)',
                display: 'flex', alignItems: 'center',
              }}>
                장착 슬롯
                <span style={{ marginLeft: 'auto', color: 'var(--success)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                  {equippedItems.length} / {EQUIP_SLOTS.length}
                </span>
              </div>

              {/* Slots grid (2-col) */}
              <div style={{
                padding: '12px 14px',
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                columnGap: 10, rowGap: 4,
              }}>
                {EQUIP_SLOTS.map(slot => {
                  const eq = equippedMap[slot.key];
                  const enh = eq?.enhanceLevel ?? 0;

                  return (
                    <div
                      key={slot.key}
                      onClick={() => {
                        if (eq) { setEnhanceTarget(eq.uid); setRightTab('enhance'); }
                      }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '22px 1fr',
                        alignItems: 'center', gap: 8,
                        padding: '5px 0',
                        borderBottom: '1px dashed color-mix(in oklch, var(--border-soft) 60%, transparent)',
                        cursor: eq ? 'pointer' : 'default',
                      }}
                    >
                      {/* Slot icon */}
                      <div style={{
                        width: 22, height: 22, borderRadius: 4,
                        background: eq ? 'var(--bg-elevated)' : 'transparent',
                        border: eq ? '1px solid var(--border-soft)' : '1px dashed var(--text-faint)',
                        display: 'grid', placeItems: 'center',
                        fontFamily: 'var(--font-mono)', fontSize: 11,
                        color: eq ? (TYPE_COLOR[eq.type] ?? 'var(--text-mute)') : 'var(--text-faint)',
                      }}>
                        {eq ? (TYPE_ICON[eq.type] ?? '·') : '+'}
                      </div>

                      {/* Slot name block */}
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 9,
                          color: 'var(--text-faint)',
                          textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                        }}>
                          {slot.label}
                        </span>
                        {eq ? (
                          <span style={{
                            fontSize: 11.5,
                            color: nameColor(enh),
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {eq.name}
                            {enh > 0 && (
                              <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginLeft: 4, fontSize: 10.5 }}>
                                +{enh}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Equipment totals */}
            <div style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-soft)',
              borderRadius: 8, overflow: 'hidden',
            }}>
              <div style={{
                margin: 0, padding: '11px 14px',
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--text-mute)',
                textTransform: 'uppercase' as const, letterSpacing: '0.12em', fontWeight: 600,
                borderBottom: '1px solid var(--border-soft)',
              }}>
                장비 합계
              </div>
              <div style={{
                padding: '10px 14px',
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                columnGap: 10,
              }}>
                {[
                  { k: 'AC',  v: totals.ac > 0 ? `−${totals.ac}` : '0', c: totals.ac > 0 ? 'var(--danger)' : 'var(--text-mute)' },
                  { k: 'HIT', v: totals.hit > 0 ? `+${totals.hit}` : '0', c: totals.hit > 0 ? 'var(--text)' : 'var(--text-mute)' },
                  { k: 'STR', v: totals.str > 0 ? `+${totals.str}` : '0', c: totals.str > 0 ? 'var(--danger)' : 'var(--text-mute)' },
                  { k: 'DEX', v: totals.dex > 0 ? `+${totals.dex}` : '0', c: totals.dex > 0 ? 'var(--info)' : 'var(--text-mute)' },
                  { k: 'CON', v: totals.con > 0 ? `+${totals.con}` : '0', c: totals.con > 0 ? 'var(--success)' : 'var(--text-mute)' },
                  { k: 'WIS', v: totals.wis > 0 ? `+${totals.wis}` : '0', c: totals.wis > 0 ? 'var(--info)' : 'var(--text-mute)' },
                  { k: 'MR',  v: totals.mr > 0 ? `+${totals.mr}` : '0', c: totals.mr > 0 ? 'var(--info)' : 'var(--text-mute)' },
                  { k: 'SP',  v: totals.sp > 0 ? `+${totals.sp}` : '0', c: totals.sp > 0 ? 'var(--accent)' : 'var(--text-mute)' },
                  { k: 'HP+', v: totals.hp > 0 ? `+${totals.hp}` : '0', c: totals.hp > 0 ? 'var(--success)' : 'var(--text-mute)' },
                  { k: 'DMG', v: totals.extraDmg > 0 ? `+${totals.extraDmg}` : '0', c: totals.extraDmg > 0 ? 'var(--danger)' : 'var(--text-mute)' },
                ].map(row => (
                  <div key={row.k} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '4px 0',
                    borderBottom: '1px dashed color-mix(in oklch, var(--border-soft) 40%, transparent)',
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                  }}>
                    <span style={{ color: 'var(--text-mute)' }}>{row.k}</span>
                    <span style={{ color: row.c, fontWeight: 600 }}>{row.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* ── 강화 패널 ── */
          <div style={{ flex: 1, overflow: 'auto' }}>
            <EnhanceSidebar
              selectedItem={selectedItem}
              equippedUids={equippedUids}
              materials={materials}
              tryEnhance={tryEnhance}
            />
          </div>
        )}
      </div>}

      {/* ━━━ MOBILE DETAIL SHEET ━━━ */}
      {compact && detailItem && (
        <DetailSheet
          item={detailItem}
          isEquipped={equippedUids.has(detailItem.uid)}
          isOpen={sheetOpen}
          onClose={closeDetail}
          onEquip={handleSheetEquip}
          onUnequip={handleSheetUnequip}
          onEnhance={handleSheetEnhance}
          onSell={handleSheetSell}
        />
      )}
    </div>
  );
}
