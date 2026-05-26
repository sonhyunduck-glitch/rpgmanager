/* =========================================================
   TRADE PANEL — 장비 거래소 (코드닷 디자인 시스템)
   검색 / 판매 등록 / 내거래  — 단일 파일
   ========================================================= */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGameStore, equipDisplayName } from '../../store/gameStore';
import type { TradeListing, Equipment } from '../../types';
import {
  getActiveListings, buyListing,
  createListing, getListedItemUids,
  cancelListing, getMyListings,
} from '../../lib/trade';
import { timeAgo } from '../../lib/utils';
import { useCompact } from '../../lib/useCompact';
// shared styles not needed — all inline

/* ─── 타입 ─── */
type TradeTab = 'browse' | 'register' | 'my';
type SortKey = 'price' | 'name' | 'enh' | 'level';
type SortDir = 'asc' | 'desc';

/* ─── 장비 타입 아이콘 + 색상 ─── */
const TYPE_ICON: Record<string, string> = {
  weapon: '🗡️', bow: '🏹', staff: '🔮',
  armor: '🛡️', helmet: '⛑️', shield: '🛡️',
  cloak: '🧣', gloves: '🧤', boots: '👢',
  tshirt: '👕', necklace: '📿', ring: '💍',
  belt: '🎗️', earring: '✨',
};

const TYPE_COLOR: Record<string, string> = {
  weapon: 'var(--danger)', bow: 'var(--success)', staff: 'oklch(0.68 0.20 305)',
  armor: 'var(--info)', helmet: 'oklch(0.72 0.14 200)', shield: 'var(--info)',
  cloak: 'oklch(0.68 0.20 305)', gloves: 'oklch(0.70 0.15 340)',
  boots: 'var(--accent)', ring: 'oklch(0.80 0.15 90)',
  belt: 'var(--success)', tshirt: 'var(--text-mute)',
  necklace: 'var(--accent)', earring: 'var(--accent)',
};

/* ─── 장비 타입 라벨 ─── */
function eqTypeLabel(t: string): string {
  const m: Record<string, string> = {
    weapon: '무기', bow: '활', staff: '지팡이',
    tshirt: '티셔츠', armor: '갑옷', helmet: '투구',
    cloak: '망토', gloves: '장갑', boots: '부츠', shield: '방패',
    necklace: '목걸이', ring: '반지', belt: '벨트', earring: '귀걸이',
  };
  return m[t] ?? t;
}

/* ─── 강화 등급 → 색상 ─── */
function enhColor(lv: number): string {
  if (lv >= 9) return 'var(--rare-mythic)';
  if (lv >= 7) return 'var(--rare-legendary)';
  if (lv >= 4) return 'var(--rare-rare)';
  if (lv > 0)  return 'var(--rare-uncommon)';
  return 'var(--text-mute)';
}
function nameColor(lv: number): string {
  if (lv >= 9) return 'var(--rare-mythic)';
  if (lv >= 7) return 'var(--rare-legendary)';
  if (lv >= 4) return 'var(--rare-rare)';
  return 'var(--text)';
}

/* ─── 가격 포맷 ─── */
function fmtG(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(n >= 100_000 ? 0 : 1)}만`;
  return n.toLocaleString();
}

/* ─── 장비 보너스 → 옵션 라인 ─── */
interface OptLine { label: string; value: string; positive: boolean }
function getOptLines(eq: Equipment): OptLine[] {
  const lines: OptLine[] = [];
  const b = eq.bonuses;
  if (!b) return lines;
  if (b.hit)      lines.push({ label: '명중', value: `+${b.hit}`, positive: true });
  if (b.extraDmg) lines.push({ label: '추가 대미지', value: `+${b.extraDmg}`, positive: true });
  if (b.hp)       lines.push({ label: 'HP', value: `+${b.hp}`, positive: true });
  if (b.mr)       lines.push({ label: 'MR', value: `+${b.mr}`, positive: true });
  if (b.str)      lines.push({ label: 'STR', value: `+${b.str}`, positive: true });
  if (b.dex)      lines.push({ label: 'DEX', value: `+${b.dex}`, positive: true });
  if (b.con)      lines.push({ label: 'CON', value: `+${b.con}`, positive: true });
  if (b.wis)      lines.push({ label: 'WIS', value: `+${b.wis}`, positive: true });
  if (b.sp)       lines.push({ label: 'SP', value: `+${b.sp}`, positive: true });
  if (b.bowHit)   lines.push({ label: '활 명중', value: `+${b.bowHit}`, positive: true });
  if (b.bowDmg)   lines.push({ label: '활 대미지', value: `+${b.bowDmg}`, positive: true });
  if (b.magicDmg) lines.push({ label: '마법 대미지', value: `+${b.magicDmg}`, positive: true });
  if (b.unbreakable)  lines.push({ label: '파괴 불가', value: '', positive: true });
  if (b.undeadSlayer) lines.push({ label: '언데드 슬레이어', value: '', positive: true });
  return lines;
}

/* ─── 카테고리 목록 ─── */
const CATEGORIES: { id: string; icon: string; name: string }[] = [
  { id: 'all',      icon: '📦', name: '전체' },
  { id: 'weapon',   icon: '🗡️', name: '무기' },
  { id: 'bow',      icon: '🏹', name: '활' },
  { id: 'staff',    icon: '🔮', name: '지팡이' },
  { id: 'helmet',   icon: '⛑️', name: '투구' },
  { id: 'armor',    icon: '🛡️', name: '갑옷' },
  { id: 'cloak',    icon: '🧣', name: '망토' },
  { id: 'gloves',   icon: '🧤', name: '장갑' },
  { id: 'boots',    icon: '👢', name: '부츠' },
  { id: 'shield',   icon: '🛡️', name: '방패' },
  { id: 'tshirt',   icon: '👕', name: '셔츠' },
  { id: 'necklace', icon: '📿', name: '목걸이' },
  { id: 'ring',     icon: '💍', name: '반지' },
  { id: 'belt',     icon: '🎗️', name: '벨트' },
];

/* ─── 탭 목록 ─── */
const TABS: { key: TradeTab; label: string }[] = [
  { key: 'browse',   label: '검색' },
  { key: 'register', label: '판매 등록' },
  { key: 'my',       label: '내거래' },
];

/* ─── 정렬 옵션 ─── */
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'price:desc', label: '가격 ↓' },
  { value: 'price:asc',  label: '가격 ↑' },
  { value: 'enh:desc',   label: '강화 ↓' },
  { value: 'enh:asc',    label: '강화 ↑' },
  { value: 'name:asc',   label: '이름' },
];

/* ═══════════════════════════════════════════════════════════
   아이템 아이콘 (28×28 — 타입별 색상 + 강화 글로우)
   ═══════════════════════════════════════════════════════════ */
function ItemIcon({ item, size = 28 }: { item: Equipment; size?: number }) {
  const enh = item.enhanceLevel;
  const c = TYPE_COLOR[item.type] ?? 'var(--text-mute)';
  return (
    <div style={{
      width: size, height: size, borderRadius: 5,
      display: 'grid', placeItems: 'center',
      fontFamily: 'var(--font-mono)', fontSize: size * 0.46,
      background: 'var(--bg-sunken)',
      border: enh >= 7
        ? `1px solid ${enhColor(enh)}`
        : '1px solid var(--border-soft)',
      color: c,
      boxShadow: enh >= 7 ? `0 0 6px -1px ${enhColor(enh)}` : 'none',
      flexShrink: 0,
    }}>
      {TYPE_ICON[item.type] ?? '📦'}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   카테고리 레일 (세로 56px 사이드바)
   ═══════════════════════════════════════════════════════════ */
function CategoryRail({
  active, onPick, counts,
}: {
  active: string;
  onPick: (id: string) => void;
  counts: Record<string, number>;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      paddingTop: 4,
    }}>
      {CATEGORIES.map(c => {
        const on = active === c.id;
        const cnt = counts[c.id] ?? 0;
        return (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            title={`${c.name} (${cnt})`}
            style={{
              aspectRatio: '1', display: 'grid', placeItems: 'center',
              border: on
                ? '1px solid color-mix(in oklch, var(--accent) 45%, transparent)'
                : '1px solid color-mix(in oklch, var(--border-soft) 60%, transparent)',
              borderRadius: 7,
              background: on
                ? 'color-mix(in oklch, var(--accent) 6%, transparent)'
                : 'transparent',
              color: on ? 'var(--accent)' : 'var(--text-mute)',
              cursor: 'pointer',
              transition: 'all 0.12s',
              position: 'relative',
              padding: 0,
              gap: 2,
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{c.icon}</span>
            <span style={{
              fontSize: 9, letterSpacing: '-0.02em',
              fontFamily: 'var(--font-mono)', fontWeight: on ? 700 : 500,
            }}>
              {c.name}
            </span>
            {/* 배지 (건수 > 0 && 카테고리 개별) */}
            {c.id !== 'all' && cnt > 0 && (
              <span style={{
                position: 'absolute', top: -3, right: -3,
                minWidth: 14, height: 14, padding: '0 3px',
                background: 'var(--danger)', color: '#fff', borderRadius: 100,
                fontFamily: 'var(--font-mono)', fontSize: 9,
                display: 'grid', placeItems: 'center', fontWeight: 600,
              }}>
                {cnt}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   검색 툴바 (검색 + 필터칩 + 정렬)
   ═══════════════════════════════════════════════════════════ */
function SearchToolbar({
  query, onQuery,
  enhOnly, onEnhOnly,
  sortVal, onSort,
  compact,
}: {
  query: string; onQuery: (v: string) => void;
  enhOnly: boolean; onEnhOnly: () => void;
  sortVal: string; onSort: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: compact ? 6 : 10,
      marginBottom: compact ? 6 : 12, flexWrap: 'wrap',
    }}>
      {/* 검색 박스 */}
      <div style={{
        flex: 1, minWidth: 160,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: compact ? '6px 10px' : '8px 12px',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-soft)',
        borderRadius: 6,
        transition: 'border-color 0.12s',
      }}>
        <span style={{ color: 'var(--text-faint)', fontSize: 13, flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
            stroke="currentColor" strokeWidth="1.6">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
        </span>
        <input
          placeholder="아이템 이름 검색"
          value={query}
          onChange={e => onQuery(e.target.value)}
          style={{
            flex: 1, fontSize: compact ? 11 : 12.5, fontFamily: 'var(--font-ui)',
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text)',
          }}
        />
      </div>

      {/* 강화템만 필터 */}
      <button
        onClick={onEnhOnly}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: compact ? '5px 8px' : '7px 11px',
          background: enhOnly
            ? 'color-mix(in oklch, var(--accent) 5%, transparent)'
            : 'var(--bg-panel)',
          border: enhOnly
            ? '1px solid color-mix(in oklch, var(--accent) 40%, transparent)'
            : '1px solid var(--border-soft)',
          borderRadius: 6,
          fontSize: compact ? 10 : 11.5, fontFamily: 'var(--font-ui)',
          color: enhOnly ? 'var(--accent)' : 'var(--text-mute)',
          cursor: 'pointer',
          transition: 'all 0.12s',
        }}
      >
        강화템만
      </button>

      {/* 정렬 */}
      <select
        value={sortVal}
        onChange={e => onSort(e.target.value)}
        style={{
          padding: compact ? '5px 20px 5px 8px' : '7px 28px 7px 11px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-soft)',
          borderRadius: 6,
          fontSize: compact ? 10 : 11.5, fontFamily: 'var(--font-mono)',
          color: 'var(--text)',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%237c8696' d='M1.5 3.5L5 7l3.5-3.5z'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
          cursor: 'pointer',
        }}
      >
        {SORT_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   거래 목록 행 (리스트 뷰)
   ═══════════════════════════════════════════════════════════ */
function ListRow({
  listing, selected, isMine, canBuy, buying,
  onSelect, onBuy, compact,
}: {
  listing: TradeListing;
  selected: boolean;
  isMine: boolean;
  canBuy: boolean;
  buying: boolean;
  onSelect: () => void;
  onBuy: () => void;
  compact?: boolean;
}) {
  const eq = listing.item_data;
  const enh = eq.enhanceLevel;
  const opts = getOptLines(eq);

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'grid',
        gridTemplateColumns: compact ? '24px 1fr 60px' : '36px 2.2fr 1.3fr 60px 1fr 110px 80px',
        alignItems: 'center',
        columnGap: compact ? 6 : 12, padding: compact ? '5px 8px' : '9px 14px',
        borderBottom: '1px solid color-mix(in oklch, var(--border-soft) 50%, transparent)',
        cursor: 'pointer',
        transition: 'background 0.1s',
        background: selected
          ? 'color-mix(in oklch, var(--accent) 6%, transparent)'
          : 'transparent',
      }}
    >
      {/* 아이콘 */}
      <ItemIcon item={eq} size={compact ? 20 : 28} />

      {/* 이름 + 메타 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{
          fontSize: compact ? 11 : 12.5, fontWeight: 500,
          color: nameColor(enh),
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textShadow: enh >= 9 ? `0 0 8px color-mix(in oklch, ${enhColor(enh)} 40%, transparent)` : 'none',
        }}>
          {equipDisplayName(eq)}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--text-mute)',
          display: 'flex', gap: 8,
        }}>
          <span>{eqTypeLabel(eq.type)}</span>
          {eq.isTwoHanded && <span style={{ color: 'var(--accent)' }}>양손</span>}
          {(eq.bonusEffects?.length ?? 0) > 0 && (
            <span style={{ color: 'var(--text-faint)' }}>
              옵션 {eq.bonusEffects.length}
            </span>
          )}
        </span>
      </div>

      {/* 옵션 */}
      {!compact && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10.5,
          color: 'var(--text-mute)',
          display: 'flex', flexDirection: 'column', gap: 1,
        }}>
          {opts.slice(0, 3).map((o, i) => (
            <span key={i} style={{
              color: o.positive ? 'var(--success)' : 'var(--danger)',
            }}>
              {o.label} {o.value}
            </span>
          ))}
          {opts.length === 0 && <span style={{ color: 'var(--text-faint)' }}>-</span>}
        </div>
      )}

      {/* 강화 */}
      {!compact && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11.5,
          color: enh > 0 ? 'var(--accent)' : 'var(--text-faint)',
          fontWeight: enh > 0 ? 600 : 400,
        }}>
          +{enh}
          <span style={{ color: 'var(--text-faint)' }}>/{eq.maxEnhance}</span>
        </span>
      )}

      {/* 판매자 */}
      {!compact && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 1,
          fontFamily: 'var(--font-mono)', fontSize: 10.5, minWidth: 0,
        }}>
          <span style={{
            color: isMine ? 'var(--info)' : 'var(--text)',
            fontSize: 11,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {listing.seller_name}
          </span>
          <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>
            {timeAgo(listing.created_at)}
          </span>
        </div>
      )}

      {/* 가격 */}
      <span style={{
        textAlign: 'right', fontFamily: 'var(--font-mono)',
        fontSize: compact ? 11 : 12.5, color: 'var(--accent)', fontWeight: 600,
      }}>
        {fmtG(listing.price)}
        <span style={{
          color: 'var(--text-mute)', marginLeft: 2, fontSize: 10,
        }}>G</span>
      </span>

      {/* 구매 버튼 */}
      {!compact && (isMine ? (
        <span style={{
          textAlign: 'center',
          fontSize: 10, fontFamily: 'var(--font-mono)',
          color: 'var(--info)', fontWeight: 600, opacity: 0.7,
        }}>
          내 거래
        </span>
      ) : (
        <button
          disabled={!canBuy || buying}
          onClick={e => { e.stopPropagation(); onBuy(); }}
          style={{
            padding: '6px 0', width: '100%',
            background: canBuy
              ? 'color-mix(in oklch, var(--success) 8%, transparent)'
              : 'transparent',
            border: canBuy
              ? '1px solid color-mix(in oklch, var(--success) 35%, transparent)'
              : '1px solid var(--border-soft)',
            color: canBuy ? 'var(--success)' : 'var(--text-faint)',
            fontSize: 11, fontWeight: 600, borderRadius: 4,
            fontFamily: 'var(--font-ui)',
            cursor: canBuy ? 'pointer' : 'not-allowed',
            transition: 'all 0.1s',
          }}
        >
          {buying ? '...' : '구매'}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   상세 패널 (우측 사이드바, 320px)
   ═══════════════════════════════════════════════════════════ */
function DetailPane({
  listing, canBuy, onBuy,
}: {
  listing: TradeListing | null;
  canBuy: boolean;
  onBuy: (l: TradeListing) => void;
}) {
  if (!listing) {
    return (
      <div style={{
        background: 'var(--bg-panel)',
        border: '1px dashed var(--border-soft)',
        borderRadius: 8, padding: '32px 18px',
        textAlign: 'center', color: 'var(--text-faint)',
        fontFamily: 'var(--font-mono)', fontSize: 11,
        height: 'fit-content', position: 'sticky', top: 14,
      }}>
        <div style={{ fontSize: 24, opacity: 0.4, marginBottom: 8 }}>&#x25C7;</div>
        <div>아이템을 선택하면<br />상세 정보가 표시됩니다</div>
      </div>
    );
  }

  const eq = listing.item_data;
  const enh = eq.enhanceLevel;
  const opts = getOptLines(eq);
  const isWpn = eq.type === 'weapon' || eq.type === 'bow' || eq.type === 'staff';
  const isMine = listing.seller_id === useGameStore.getState().authUserId;

  return (
    <div style={{
      position: 'sticky', top: 14,
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-soft)',
      borderRadius: 8, overflow: 'hidden',
      height: 'fit-content', alignSelf: 'start',
    }}>
      {/* 헤더 */}
      <div style={{
        padding: 14, borderBottom: '1px solid color-mix(in oklch, var(--border-soft) 60%, transparent)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <ItemIcon item={eq} size={44} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 14, fontWeight: 600,
            color: nameColor(enh),
            textShadow: enh >= 9 ? `0 0 8px color-mix(in oklch, ${enhColor(enh)} 40%, transparent)` : 'none',
          }}>
            {equipDisplayName(eq)}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10.5,
            color: 'var(--text-mute)', marginTop: 2,
          }}>
            {eqTypeLabel(eq.type)}
            {eq.isTwoHanded && ' · 양손'}
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* 옵션 */}
        {opts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9.5,
              color: 'var(--text-mute)', textTransform: 'uppercase',
              letterSpacing: '0.12em', marginBottom: 2,
            }}>
              옵션
            </div>
            {opts.map((o, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'baseline',
                fontFamily: 'var(--font-mono)', fontSize: 11.5,
              }}>
                <span style={{ color: 'var(--text-mute)' }}>{o.label}</span>
                <span style={{ color: o.positive ? 'var(--success)' : 'var(--danger)' }}>
                  {o.value || '✓'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 정보 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9.5,
            color: 'var(--text-mute)', textTransform: 'uppercase',
            letterSpacing: '0.12em',
            borderTop: '1px dashed color-mix(in oklch, var(--border-soft) 60%, transparent)',
            paddingTop: 10,
          }}>
            정보
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)', fontSize: 11.5,
          }}>
            <span style={{ color: 'var(--text-mute)' }}>강화</span>
            <span style={{ color: 'var(--accent)' }}>+{enh} / +{eq.maxEnhance}</span>
          </div>
          {isWpn && (
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)', fontSize: 11.5,
            }}>
              <span style={{ color: 'var(--text-mute)' }}>대미지</span>
              <span style={{ color: 'var(--text)' }}>{eq.baseAtk}/{eq.baseAtkLarge}</span>
            </div>
          )}
          {!isWpn && (
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)', fontSize: 11.5,
            }}>
              <span style={{ color: 'var(--text-mute)' }}>AC</span>
              <span style={{ color: 'var(--text)' }}>{eq.baseDef}+{enh}</span>
            </div>
          )}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)', fontSize: 11.5,
          }}>
            <span style={{ color: 'var(--text-mute)' }}>판매자</span>
            <span style={{ color: 'var(--text)' }}>{listing.seller_name}</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)', fontSize: 11.5,
          }}>
            <span style={{ color: 'var(--text-mute)' }}>등록</span>
            <span style={{ color: 'var(--text-mute)' }}>{timeAgo(listing.created_at)}</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)', fontSize: 11.5,
          }}>
            <span style={{ color: 'var(--text-mute)' }}>상점 판매가</span>
            <span style={{ color: 'var(--text-faint)' }}>{eq.sellPrice.toLocaleString()} G</span>
          </div>
        </div>
      </div>

      {/* 풋터 — 가격 + 구매 버튼 */}
      <div style={{
        padding: '12px 14px',
        borderTop: '1px solid color-mix(in oklch, var(--border-soft) 60%, transparent)',
        display: 'flex', flexDirection: 'column', gap: 6,
        background: 'color-mix(in oklch, var(--accent) 3%, transparent)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'baseline', fontFamily: 'var(--font-mono)',
        }}>
          <span style={{ color: 'var(--text-mute)', fontSize: 11 }}>즉시 구매가</span>
          <span style={{ color: 'var(--accent)', fontSize: 22, fontWeight: 700 }}>
            {fmtG(listing.price)}
            <span style={{ fontSize: 13, color: 'var(--text-mute)', fontWeight: 400, marginLeft: 2 }}>G</span>
          </span>
        </div>

        {!isMine && (
          <button
            onClick={() => onBuy(listing)}
            disabled={!canBuy}
            style={{
              padding: 11,
              background: canBuy
                ? 'color-mix(in oklch, var(--success) 15%, transparent)'
                : 'var(--bg-sunken)',
              border: canBuy
                ? '1px solid var(--success)'
                : '1px solid var(--border-soft)',
              color: canBuy ? 'var(--success)' : 'var(--text-faint)',
              fontWeight: 700, fontSize: 13, borderRadius: 5,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: canBuy ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-ui)',
              transition: 'all 0.12s',
            }}
          >
            구매하기
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   구매 확인 모달 (5% 수수료)
   ═══════════════════════════════════════════════════════════ */
function BuyModal({
  listing, gold,
  onClose, onConfirm, confirming,
}: {
  listing: TradeListing;
  gold: number;
  onClose: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const eq = listing.item_data;
  const enh = eq.enhanceLevel;
  const fee = Math.round(listing.price * 0.05);
  const total = listing.price + fee;
  const remaining = gold - total;
  const canAfford = remaining >= 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'grid', placeItems: 'center',
        zIndex: 100, backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 420, maxWidth: '95vw',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-strong)',
          borderRadius: 10, overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid color-mix(in oklch, var(--border-soft) 60%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: 14, fontWeight: 600,
            fontFamily: 'var(--font-ui)', color: 'var(--text)',
          }}>
            구매 확인
          </span>
          <button
            onClick={onClose}
            style={{
              color: 'var(--text-mute)', fontSize: 16,
              padding: '2px 8px', background: 'none', border: 'none',
              cursor: 'pointer',
            }}
          >
            &times;
          </button>
        </div>

        {/* 본문 */}
        <div style={{ padding: 16 }}>
          {/* 아이템 요약 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: 12, background: 'var(--bg-sunken)', borderRadius: 6,
            marginBottom: 14,
          }}>
            <ItemIcon item={eq} size={40} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: nameColor(enh),
              }}>
                {equipDisplayName(eq)}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10.5,
                color: 'var(--text-mute)', marginTop: 2,
              }}>
                {eqTypeLabel(eq.type)} · {listing.seller_name}
              </div>
            </div>
          </div>

          {/* 가격 내역 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)', fontSize: 12,
            }}>
              <span style={{ color: 'var(--text-mute)' }}>아이템 가격</span>
              <span style={{ color: 'var(--text)' }}>{fmtG(listing.price)} G</span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)', fontSize: 12,
            }}>
              <span style={{ color: 'var(--text-mute)' }}>거래소 수수료 (5%)</span>
              <span style={{ color: 'var(--danger)' }}>+{fmtG(fee)} G</span>
            </div>

            {/* 합계 */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)', fontSize: 12,
              paddingTop: 8, marginTop: 4,
              borderTop: '1px dashed color-mix(in oklch, var(--border-soft) 60%, transparent)',
            }}>
              <span style={{ color: 'var(--text-mute)' }}>합계</span>
              <span style={{
                color: 'var(--accent)', fontSize: 16, fontWeight: 700,
              }}>
                {fmtG(total)} G
              </span>
            </div>

            {/* 잔액 */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 4,
            }}>
              <span style={{ color: 'var(--text-mute)' }}>결제 후 잔액</span>
              <span style={{
                color: canAfford ? 'var(--text)' : 'var(--danger)',
              }}>
                {fmtG(Math.max(0, remaining))} G
              </span>
            </div>
          </div>
        </div>

        {/* 풋터 */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid color-mix(in oklch, var(--border-soft) 60%, transparent)',
          display: 'flex', gap: 8, justifyContent: 'flex-end',
          background: 'var(--bg-sunken)',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px', borderRadius: 5,
              fontSize: 12.5, fontWeight: 600,
              background: 'none', border: 'none',
              color: 'var(--text-mute)', cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            취소
          </button>
          <button
            disabled={!canAfford || confirming}
            onClick={onConfirm}
            style={{
              padding: '9px 18px', borderRadius: 5,
              fontSize: 12.5, fontWeight: 600,
              background: canAfford && !confirming
                ? 'color-mix(in oklch, var(--success) 15%, transparent)'
                : 'var(--bg-sunken)',
              border: canAfford && !confirming
                ? '1px solid var(--success)'
                : '1px solid var(--border-soft)',
              color: canAfford && !confirming ? 'var(--success)' : 'var(--text-faint)',
              cursor: canAfford && !confirming ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {confirming ? '처리 중...' : '구매 확정'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   검색 탭 (Browse)
   ═══════════════════════════════════════════════════════════ */
function BrowseSection() {
  const compact   = useCompact();
  const userId    = useGameStore(s => s.authUserId);
  const gold      = useGameStore(s => s.gold);
  const inventory = useGameStore(s => s.inventory);
  const invCap    = useGameStore(s => s.inventoryCapacity);

  const [allListings, setAllListings] = useState<TradeListing[]>([]);
  const [loading, setLoading]   = useState(true);
  const [cat, setCat]           = useState('all');
  const [query, setQuery]       = useState('');
  const [enhOnly, setEnhOnly]   = useState(false);
  const [sortVal, setSortVal]   = useState('price:desc');
  const [selected, setSelected] = useState<string | null>(null);
  const [buyTarget, setBuyTarget]   = useState<TradeListing | null>(null);
  const [buying]                = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getActiveListings(undefined, 100);
    setAllListings(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // 카테고리 건수
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: allListings.length };
    for (const l of allListings) {
      const t = l.item_data.type;
      c[t] = (c[t] ?? 0) + 1;
    }
    return c;
  }, [allListings]);

  // 필터 + 정렬
  const rows = useMemo(() => {
    let r = allListings.slice();
    if (cat !== 'all') r = r.filter(l => l.item_data.type === cat);
    if (query) {
      const q = query.toLowerCase();
      r = r.filter(l =>
        l.item_name.toLowerCase().includes(q) ||
        l.seller_name.toLowerCase().includes(q),
      );
    }
    if (enhOnly) r = r.filter(l => l.item_data.enhanceLevel > 0);

    const [key, dir] = sortVal.split(':') as [SortKey, SortDir];
    r.sort((a, b) => {
      let A: number | string, B: number | string;
      switch (key) {
        case 'price': A = a.price; B = b.price; break;
        case 'enh':   A = a.item_data.enhanceLevel; B = b.item_data.enhanceLevel; break;
        case 'name':  A = a.item_name.toLowerCase(); B = b.item_name.toLowerCase(); break;
        default:      A = a.price; B = b.price;
      }
      if (A < B) return dir === 'asc' ? -1 : 1;
      if (A > B) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return r;
  }, [allListings, cat, query, enhOnly, sortVal]);

  const selectedListing = useMemo(
    () => allListings.find(l => l.id === selected) ?? null,
    [allListings, selected],
  );

  /* ── 구매 확정 ── */
  const handleConfirmBuy = async () => {
    if (!buyTarget || !userId) return;
    setConfirming(true);
    const result = await buyListing(buyTarget.id, userId);
    if (result.success) {
      const st = useGameStore.getState();
      useGameStore.setState({
        gold: st.gold - buyTarget.price,
        inventory: [...st.inventory, buyTarget.item_data],
      });
      setAllListings(prev => prev.filter(l => l.id !== buyTarget.id));
      setSelected(null);
    } else {
      alert(
        result.error === 'insufficient_gold' ? '골드가 부족합니다.'
        : result.error === 'not_found' ? '이미 판매된 거래입니다.'
        : result.error === 'own_listing' ? '본인의 거래는 구매할 수 없습니다.'
        : `거래 실패: ${result.error}`,
      );
      load();
    }
    setBuyTarget(null);
    setConfirming(false);
  };

  const catLabel = CATEGORIES.find(c => c.id === cat)?.name ?? '전체';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: compact ? '1fr' : '56px 1fr',
      gap: '0 14px',
      flex: 1, minHeight: 0,
    }}>
      {/* 카테고리 레일 */}
      {!compact && (
        <div style={{ overflowY: 'auto', overflowX: 'hidden' }}>
          <CategoryRail active={cat} onPick={setCat} counts={counts} />
        </div>
      )}

      {/* 메인 영역 */}
      <div style={{
        display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0,
      }}>
        {/* 모바일 카테고리 스크롤 스트립 */}
        {compact && (
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 6, flexShrink: 0 }}>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)}
                style={{
                  padding: '3px 8px', borderRadius: 100, whiteSpace: 'nowrap',
                  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: cat === c.id ? 700 : 500,
                  background: cat === c.id ? 'color-mix(in oklch, var(--accent) 10%, transparent)' : 'transparent',
                  border: cat === c.id ? '1px solid color-mix(in oklch, var(--accent) 40%, transparent)' : '1px solid var(--border-soft)',
                  color: cat === c.id ? 'var(--accent)' : 'var(--text-mute)',
                  cursor: 'pointer',
                }}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        )}

        {/* 브레드크럼 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 10, paddingBottom: 10,
          borderBottom: '1px solid color-mix(in oklch, var(--border-soft) 50%, transparent)',
        }}>
          <span style={{
            fontSize: compact ? 13 : 17, fontWeight: 600, color: 'var(--text)',
            display: 'inline-flex', alignItems: 'baseline', gap: 8,
            fontFamily: 'var(--font-ui)',
          }}>
            {catLabel}
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--text-mute)',
              padding: '2px 8px', borderRadius: 100,
              background: 'var(--bg-elevated)',
            }}>
              {loading ? '…' : rows.length}건
            </span>
          </span>
          <span style={{ flex: 1 }} />
          <button
            onClick={load}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              color: 'var(--text-mute)', fontSize: 11,
              fontFamily: 'var(--font-mono)',
              background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--success)',
              boxShadow: '0 0 6px var(--success)',
            }} />
            새로 고침
          </button>
        </div>

        {/* 검색 툴바 */}
        <SearchToolbar
          query={query} onQuery={setQuery}
          enhOnly={enhOnly} onEnhOnly={() => setEnhOnly(v => !v)}
          sortVal={sortVal} onSort={setSortVal}
          compact={compact}
        />

        {/* 리스트 + 디테일 패널 (2컬럼) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : (selected ? 'minmax(0,1fr) 320px' : '1fr'),
          gap: 12,
          flex: 1, minHeight: 0, overflow: 'hidden',
        }}>
          {/* 리스트 */}
          <div style={{
            border: '1px solid color-mix(in oklch, var(--border-soft) 60%, transparent)',
            borderRadius: 8, overflow: 'hidden',
            background: 'var(--bg-panel)',
            display: 'flex', flexDirection: 'column',
            minHeight: 0,
          }}>
            {/* 헤더 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: compact ? '24px 1fr 60px' : '36px 2.2fr 1.3fr 60px 1fr 110px 80px',
              alignItems: 'center', columnGap: compact ? 6 : 12, padding: compact ? '5px 8px' : '9px 14px',
              background: 'var(--bg-sunken)',
              borderBottom: '1px solid var(--border-soft)',
              fontFamily: 'var(--font-mono)', fontSize: 10,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: 'var(--text-mute)', fontWeight: 600,
              flexShrink: 0,
            }}>
              <span />
              <span>아이템</span>
              {!compact && <span>옵션</span>}
              {!compact && <span>강화</span>}
              {!compact && <span>판매자</span>}
              <span style={{ textAlign: 'right' }}>가격</span>
              {!compact && <span style={{ textAlign: 'center' }}>액션</span>}
            </div>

            {/* 행들 */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {loading ? (
                <div style={{
                  textAlign: 'center', padding: 'var(--s-6)',
                  color: 'var(--text-faint)', fontSize: 'var(--fs-xs)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  Loading...
                </div>
              ) : rows.length === 0 ? (
                <div style={{
                  padding: 60, textAlign: 'center',
                  color: 'var(--text-faint)', fontSize: 13,
                  fontFamily: 'var(--font-mono)',
                }}>
                  검색 결과가 없습니다.
                </div>
              ) : (
                rows.map(l => {
                  const isMine = l.seller_id === userId;
                  const canBuy = !isMine && gold >= l.price && inventory.length < invCap;
                  return (
                    <ListRow
                      key={l.id}
                      listing={l}
                      selected={selected === l.id}
                      isMine={isMine}
                      canBuy={canBuy}
                      buying={buying === l.id}
                      onSelect={() => setSelected(selected === l.id ? null : l.id)}
                      onBuy={() => setBuyTarget(l)}
                      compact={compact}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* 디테일 패널 */}
          {selected && !compact && (
            <DetailPane
              listing={selectedListing}
              canBuy={
                !!selectedListing
                && selectedListing.seller_id !== userId
                && gold >= selectedListing.price
                && inventory.length < invCap
              }
              onBuy={setBuyTarget}
            />
          )}
        </div>
      </div>

      {/* 구매 모달 */}
      {buyTarget && (
        <BuyModal
          listing={buyTarget}
          gold={gold}
          onClose={() => setBuyTarget(null)}
          onConfirm={handleConfirmBuy}
          confirming={confirming}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   판매 등록 탭 (Register)
   ═══════════════════════════════════════════════════════════ */
function RegisterSection() {
  const compact    = useCompact();
  const userId     = useGameStore(s => s.authUserId);
  const playerName = useGameStore(s => s.playerName);
  const level      = useGameStore(s => s.level);
  const inventory  = useGameStore(s => s.inventory);

  const [listedUids, setListedUids] = useState<Set<string>>(new Set());
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [priceStr, setPriceStr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!userId) return;
    getListedItemUids(userId).then(uids => setListedUids(new Set(uids)));
  }, [userId]);

  const available = inventory.filter(item => !listedUids.has(item.uid));
  const selItem = available.find(i => i.uid === selectedUid) ?? null;
  const priceNum = parseInt(priceStr, 10);
  const validPrice = !isNaN(priceNum) && priceNum >= 1;

  const handleNumpad = (key: string) => {
    if (key === 'back') setPriceStr(p => p.slice(0, -1));
    else if (key === 'clear') setPriceStr('');
    else setPriceStr(p => (p + key).length > 10 ? p : p + key);
  };

  const handleSubmit = async () => {
    if (!userId || !selItem || !validPrice) return;
    setSubmitting(true);
    const result = await createListing(userId, playerName, level, selItem, priceNum);
    if (result) {
      const st = useGameStore.getState();
      useGameStore.setState({
        inventory: st.inventory.filter(e => e.uid !== selItem.uid),
      });
      setListedUids(prev => new Set([...prev, selItem.uid]));
      setSelectedUid(null);
      setPriceStr('');
    }
    setSubmitting(false);
  };

  const numBtnStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    height: 36,
    border: '1px solid var(--border-soft)',
    borderRadius: 'var(--r-sm)',
    background: 'var(--bg-sunken)',
    color: 'var(--text)',
    fontSize: 'var(--fs-base)', fontWeight: 700,
    fontFamily: 'var(--font-display)',
    cursor: 'pointer',
    transition: 'background 0.1s',
    ...extra,
  });

  /* ── 아이템 미선택 → 목록 ── */
  if (!selItem) {
    return (
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column', gap: 'var(--s-2)',
      }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          paddingBottom: 10,
          borderBottom: '1px solid color-mix(in oklch, var(--border-soft) 50%, transparent)',
        }}>
          <span style={{
            fontSize: compact ? 13 : 17, fontWeight: 600, color: 'var(--text)',
            fontFamily: 'var(--font-ui)',
            display: 'inline-flex', alignItems: 'baseline', gap: 8,
          }}>
            판매 등록
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--text-mute)',
              padding: '2px 8px', borderRadius: 100,
              background: 'var(--bg-elevated)',
            }}>
              {available.length}개
            </span>
          </span>
        </div>

        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {available.length === 0 ? (
            <div style={{
              padding: 60, textAlign: 'center',
              color: 'var(--text-faint)', fontSize: 13,
              fontFamily: 'var(--font-mono)',
            }}>
              인벤토리에 판매 가능한 아이템이 없습니다.
            </div>
          ) : (
            available.map(item => {
              const enh = item.enhanceLevel;
              return (
                <div
                  key={item.uid}
                  onClick={() => setSelectedUid(item.uid)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px',
                    background: 'var(--bg-canvas)',
                    border: '1px solid color-mix(in oklch, var(--border-soft) 50%, transparent)',
                    borderRadius: 'var(--r-sm)',
                    cursor: 'pointer',
                    transition: 'border-color 0.12s',
                  }}
                >
                  <ItemIcon item={item} size={compact ? 28 : 36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: compact ? 11 : 12.5, fontWeight: 600,
                      color: nameColor(enh),
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {equipDisplayName(item)}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10,
                      color: 'var(--text-mute)',
                    }}>
                      {eqTypeLabel(item.type)}
                      {item.isTwoHanded && ' · 양손'}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 'var(--fs-2xs)', fontFamily: 'var(--font-mono)',
                    color: 'var(--text-faint)',
                  }}>
                    {fmtG(item.sellPrice)} G
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  /* ── 아이템 선택됨 → 금액 입력 ── */
  const enh = selItem.enhanceLevel;
  return (
    <div style={{
      flex: 1, minHeight: 0,
      display: 'flex', flexDirection: 'column', gap: 'var(--s-2)',
    }}>
      {/* 타이틀 */}
      <div style={{
        textAlign: 'center', flexShrink: 0,
        padding: 'var(--s-1) 0',
        borderBottom: '1px solid var(--border-soft)',
      }}>
        <span style={{
          fontSize: 'var(--fs-sm)', fontWeight: 700,
          color: 'var(--text)', fontFamily: 'var(--font-ui)',
        }}>
          판매 수량 / 금액 입력
        </span>
      </div>

      {/* 2컬럼 */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: compact ? 'column' : 'row', gap: 'var(--s-3)',
      }}>
        {/* 좌: 아이템 정보 + 가격 */}
        <div style={{
          flex: 1, minWidth: 0,
          display: 'flex', flexDirection: 'column', gap: 'var(--s-3)',
        }}>
          {/* 카드 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: 'var(--s-2)',
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--r-sm)',
          }}>
            <ItemIcon item={selItem} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 'var(--fs-sm)', fontWeight: 700,
                color: nameColor(enh),
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {equipDisplayName(selItem)}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)',
                color: 'var(--text-mute)',
                display: 'flex', gap: 6,
              }}>
                {eqTypeLabel(selItem.type)}
                {selItem.isTwoHanded && <span style={{ color: 'var(--accent)' }}>양손</span>}
              </div>
            </div>
          </div>

          {/* 수량 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
            padding: '0 var(--s-1)',
          }}>
            <span style={{
              fontSize: 'var(--fs-xs)', color: 'var(--text-mute)',
              fontFamily: 'var(--font-mono)', minWidth: 60,
            }}>
              판매 수량
            </span>
            <span style={{
              flex: 1, textAlign: 'right',
              fontSize: 'var(--fs-sm)', fontWeight: 700,
              fontFamily: 'var(--font-display)', color: 'var(--text)',
            }}>
              1
            </span>
          </div>

          {/* 상점가 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
            padding: '0 var(--s-1)',
          }}>
            <span style={{
              fontSize: 'var(--fs-xs)', color: 'var(--text-mute)',
              fontFamily: 'var(--font-mono)', minWidth: 60,
            }}>
              상점가
            </span>
            <span style={{
              flex: 1, textAlign: 'right',
              fontSize: 'var(--fs-sm)', fontWeight: 700,
              fontFamily: 'var(--font-display)', color: 'var(--text-faint)',
            }}>
              {selItem.sellPrice.toLocaleString()}
            </span>
          </div>

          {/* 판매 금액 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
            padding: 'var(--s-2) var(--s-1)',
            borderTop: '1px solid var(--border-soft)',
          }}>
            <span style={{
              fontSize: 'var(--fs-xs)', color: 'var(--accent)',
              fontFamily: 'var(--font-mono)', fontWeight: 700, minWidth: 60,
            }}>
              판매 금액
            </span>
            <span style={{
              flex: 1, textAlign: 'right',
              fontSize: 'var(--fs-md)', fontWeight: 800,
              fontFamily: 'var(--font-display)',
              color: validPrice ? 'var(--accent)' : 'var(--text-faint)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {priceStr ? parseInt(priceStr, 10).toLocaleString() : '0'}
            </span>
          </div>
        </div>

        {/* 우: 키패드 */}
        <div style={{
          ...(compact ? {} : { width: 140 }), flexShrink: 0,
          display: 'grid', gridTemplateColumns: compact ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
          gap: 4, alignContent: 'start',
        }}>
          {['1','2','3','4','5','6','7','8','9'].map(k => (
            <button key={k} onClick={() => handleNumpad(k)} style={numBtnStyle()}>
              {k}
            </button>
          ))}
          <button
            onClick={() => setPriceStr(String(selItem.sellPrice * 10))}
            style={numBtnStyle({ color: 'var(--info)', fontSize: 'var(--fs-xs)' })}
          >
            Max
          </button>
          <button onClick={() => handleNumpad('0')} style={numBtnStyle()}>0</button>
          <button
            onClick={() => handleNumpad('back')}
            style={numBtnStyle({ color: 'var(--text-mute)', fontSize: 'var(--fs-sm)' })}
          >
            &#x2190;
          </button>
          {/* -, 금액, + */}
          <button
            onClick={() => {
              const v = Math.max(0, (parseInt(priceStr, 10) || 0) - selItem.sellPrice);
              setPriceStr(String(v));
            }}
            style={numBtnStyle({ color: 'var(--danger)', fontSize: 'var(--fs-base)' })}
          >
            &#x2212;
          </button>
          <div style={{
            height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--r-sm)',
            background: 'color-mix(in oklch, var(--accent) 8%, var(--bg-canvas))',
            color: 'var(--accent)', fontSize: 'var(--fs-xs)', fontWeight: 800,
            fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums',
          }}>
            {priceStr ? parseInt(priceStr, 10).toLocaleString() : '0'}
          </div>
          <button
            onClick={() => {
              const v = (parseInt(priceStr, 10) || 0) + selItem.sellPrice;
              setPriceStr(String(v));
            }}
            style={numBtnStyle({ color: 'var(--success)', fontSize: 'var(--fs-base)' })}
          >
            +
          </button>
        </div>
      </div>

      {/* 하단 버튼 */}
      <div style={{
        display: 'flex', gap: 'var(--s-2)', flexShrink: 0,
        borderTop: '1px solid var(--border-soft)',
        paddingTop: 'var(--s-2)',
      }}>
        <button
          onClick={() => { setSelectedUid(null); setPriceStr(''); }}
          style={{
            flex: 1, height: 36, borderRadius: 'var(--r-sm)',
            border: '1px solid var(--border-soft)',
            background: 'var(--bg-sunken)',
            color: 'var(--text-mute)',
            fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          취소
        </button>
        <button
          disabled={submitting || !validPrice}
          onClick={handleSubmit}
          style={{
            flex: 1, height: 36, borderRadius: 'var(--r-sm)',
            border: 'none',
            background: submitting || !validPrice
              ? 'var(--bg-sunken)'
              : 'var(--info)',
            color: submitting || !validPrice ? 'var(--text-faint)' : '#fff',
            fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', fontWeight: 700,
            cursor: submitting || !validPrice ? 'not-allowed' : 'pointer',
            opacity: !validPrice ? 0.4 : 1,
          }}
        >
          {submitting ? '등록 중...' : '확인'}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   내거래 탭 (MyTrades)
   ═══════════════════════════════════════════════════════════ */
function MyTradesSection() {
  const compact = useCompact();
  const userId = useGameStore(s => s.authUserId);
  const [listings, setListings] = useState<TradeListing[]>([]);
  const [loading, setLoading]   = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const data = await getMyListings(userId);
    setListings(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (listing: TradeListing) => {
    if (!userId) return;
    setCancelling(listing.id);
    const result = await cancelListing(listing.id, userId);
    if (result.success) {
      const st = useGameStore.getState();
      if (st.inventory.length < st.inventoryCapacity) {
        useGameStore.setState({
          inventory: [...st.inventory, listing.item_data],
        });
      }
      load();
    } else {
      alert(`취소 실패: ${result.error}`);
    }
    setCancelling(null);
  };

  const active    = listings.filter(l => l.status === 'active');
  const completed = listings.filter(l => l.status !== 'active');
  const sold      = completed.filter(l => l.status === 'sold');
  const totalSold = sold.reduce((s, l) => s + l.price, 0);
  // 구매 내역은 별도 API 필요 — 현재 미지원

  return (
    <div style={{
      flex: 1, minHeight: 0,
      display: 'flex', flexDirection: 'column', gap: 'var(--s-2)',
    }}>
      {/* 브레드크럼 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        paddingBottom: 10,
        borderBottom: '1px solid color-mix(in oklch, var(--border-soft) 50%, transparent)',
      }}>
        <span style={{
          fontSize: compact ? 13 : 17, fontWeight: 600, color: 'var(--text)',
          fontFamily: 'var(--font-ui)',
          display: 'inline-flex', alignItems: 'baseline', gap: 8,
        }}>
          내거래 내역
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--text-mute)',
            padding: '2px 8px', borderRadius: 100,
            background: 'var(--bg-elevated)',
          }}>
            최근 30일
          </span>
        </span>
        <span style={{ flex: 1 }} />
        <button
          onClick={load}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            color: 'var(--text-mute)', fontSize: 11,
            fontFamily: 'var(--font-mono)',
            background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--success)',
            boxShadow: '0 0 6px var(--success)',
          }} />
          새로 고침
        </button>
      </div>

      {/* 통계 카드 (3열) */}
      {!loading && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
          gap: 10, flexShrink: 0,
        }}>
          <div style={{
            padding: compact ? 8 : 14, background: 'var(--bg-panel)',
            border: '1px solid color-mix(in oklch, var(--border-soft) 60%, transparent)',
            borderRadius: 8,
          }}>
            <div style={{
              fontSize: compact ? 9 : 10.5, color: 'var(--text-mute)',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              판매중
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: compact ? 14 : 20,
              fontWeight: 700, color: 'var(--info)', marginTop: 4,
            }}>
              {active.length}
            </div>
          </div>
          <div style={{
            padding: compact ? 8 : 14, background: 'var(--bg-panel)',
            border: '1px solid color-mix(in oklch, var(--border-soft) 60%, transparent)',
            borderRadius: 8,
          }}>
            <div style={{
              fontSize: compact ? 9 : 10.5, color: 'var(--text-mute)',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              총 판매
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: compact ? 14 : 20,
              fontWeight: 700, color: 'var(--accent)', marginTop: 4,
            }}>
              {sold.length}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10.5,
              color: 'var(--text-mute)', marginTop: 2,
            }}>
              {fmtG(totalSold)} G
            </div>
          </div>
          <div style={{
            padding: compact ? 8 : 14, background: 'var(--bg-panel)',
            border: '1px solid color-mix(in oklch, var(--border-soft) 60%, transparent)',
            borderRadius: 8,
          }}>
            <div style={{
              fontSize: compact ? 9 : 10.5, color: 'var(--text-mute)',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              수수료
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: compact ? 14 : 20,
              fontWeight: 700, color: 'var(--danger)', marginTop: 4,
            }}>
              -{fmtG(Math.round(totalSold * 0.05))}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10.5,
              color: 'var(--text-mute)', marginTop: 2,
            }}>
              5% 기준
            </div>
          </div>
        </div>
      )}

      {/* 거래 목록 */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 3,
      }}>
        {loading ? (
          <div style={{
            textAlign: 'center', padding: 'var(--s-6)',
            color: 'var(--text-faint)', fontSize: 'var(--fs-xs)',
            fontFamily: 'var(--font-mono)',
          }}>
            Loading...
          </div>
        ) : listings.length === 0 ? (
          <div style={{
            padding: 60, textAlign: 'center',
            color: 'var(--text-faint)', fontSize: 13,
            fontFamily: 'var(--font-mono)',
          }}>
            거래 내역이 없습니다.
          </div>
        ) : (
          <>
            {/* 활성 거래 */}
            {active.map(listing => {
              const eq = listing.item_data;
              const enh = eq.enhanceLevel;
              return (
                <div key={listing.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px',
                  background: 'var(--bg-canvas)',
                  border: '1px solid color-mix(in oklch, var(--info) 30%, transparent)',
                  borderRadius: 'var(--r-sm)',
                }}>
                  <ItemIcon item={eq} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12.5, fontWeight: 600,
                      color: nameColor(enh),
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {equipDisplayName(eq)}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10,
                      color: 'var(--text-mute)',
                    }}>
                      등록가 {fmtG(listing.price)} G · {timeAgo(listing.created_at)}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'flex-end', gap: 3,
                  }}>
                    <span style={{
                      fontSize: 'var(--fs-sm)', fontWeight: 800,
                      fontFamily: 'var(--font-display)',
                      color: 'var(--accent)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {fmtG(listing.price)}G
                    </span>
                    <button
                      disabled={cancelling === listing.id}
                      onClick={() => handleCancel(listing)}
                      style={{
                        fontSize: 'var(--fs-2xs)', fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        padding: '3px 10px', borderRadius: 'var(--r-xs)',
                        border: '1px solid var(--danger)',
                        background: 'var(--danger-soft)',
                        color: 'var(--danger)',
                        cursor: cancelling === listing.id ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {cancelling === listing.id ? '...' : '취소'}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* 구분선 */}
            {active.length > 0 && completed.length > 0 && (
              <div style={{
                borderTop: '1px solid color-mix(in oklch, var(--border-soft) 50%, transparent)',
                margin: 'var(--s-1) 0',
              }} />
            )}

            {/* 완료/취소 */}
            {completed.map(listing => {
              const eq = listing.item_data;
              const enh = eq.enhanceLevel;
              const isSold = listing.status === 'sold';
              return (
                <div key={listing.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px',
                  background: 'var(--bg-canvas)',
                  border: '1px solid color-mix(in oklch, var(--border-soft) 40%, transparent)',
                  borderRadius: 'var(--r-sm)',
                  opacity: 0.8,
                }}>
                  <ItemIcon item={eq} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12.5, fontWeight: 500,
                      color: nameColor(enh),
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {equipDisplayName(eq)}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10,
                      color: 'var(--text-mute)',
                    }}>
                      {eqTypeLabel(eq.type)} · {timeAgo(listing.created_at)}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'flex-end', gap: 3,
                  }}>
                    <span style={{
                      fontSize: 'var(--fs-sm)', fontWeight: 800,
                      fontFamily: 'var(--font-display)',
                      color: isSold ? 'var(--success)' : 'var(--text-faint)',
                      fontVariantNumeric: 'tabular-nums',
                      textDecoration: isSold ? 'none' : 'line-through',
                    }}>
                      {fmtG(listing.price)}G
                    </span>
                    <span style={{
                      fontSize: 'var(--fs-2xs)', fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      color: isSold ? 'var(--success)' : 'var(--text-faint)',
                    }}>
                      {isSold ? '판매완료' : '취소됨'}
                    </span>
                    {isSold && listing.buyer_name && (
                      <span style={{
                        fontSize: 8, fontFamily: 'var(--font-mono)',
                        color: 'var(--text-faint)',
                      }}>
                        &#x2192; {listing.buyer_name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   메인 거래소 패널
   ═══════════════════════════════════════════════════════════ */
export default function TradePanel() {
  const [tab, setTab] = useState<TradeTab>('browse');
  const compact = useCompact();
  return (
    <div style={{
      height: '100%',
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-md)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
      padding: compact ? '6px 8px 10px' : '18px 22px 32px',
    }}>
      {/* ── 탭 바 (3탭, 밑줄 활성) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        borderBottom: '1px solid var(--border-soft)',
        marginBottom: compact ? 6 : 14,
        flexShrink: 0,
      }}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: compact ? '6px 4px' : '12px 8px', textAlign: 'center',
                color: active ? 'var(--accent)' : 'var(--text-mute)',
                fontSize: compact ? 10 : 13, fontWeight: active ? 700 : 500,
                fontFamily: 'var(--font-ui)',
                borderBottom: active
                  ? '2px solid var(--accent)'
                  : '2px solid transparent',
                background: 'none', border: 'none',
                borderBottomStyle: 'solid',
                borderBottomWidth: 2,
                borderBottomColor: active ? 'var(--accent)' : 'transparent',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
                display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', gap: 8,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── 콘텐츠 ── */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {tab === 'browse'   && <BrowseSection />}
        {tab === 'register' && <RegisterSection />}
        {tab === 'my'       && <MyTradesSection />}
      </div>
    </div>
  );
}
