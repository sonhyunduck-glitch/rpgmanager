/* ── 거래소 공용 헬퍼 컴포넌트 & 함수 ── */
import { equipDisplayName } from '../../store/gameStore';
import type { Equipment } from '../../types';

/* ── 장비 타입 아이콘 ── */
const TYPE_ICON: Record<string, string> = {
  weapon: '🗡️', bow: '🏹', staff: '🔮',
  armor: '🛡️', helmet: '⛑️', shield: '🛡️',
  cloak: '🧣', gloves: '🧤', boots: '👢',
  tshirt: '👕', necklace: '📿', ring: '💍',
  belt: '🎗️', earring: '✨',
};

/* ── 강화 등급 색상 (기존 rarity 토큰 활용) ── */
function enhColor(level: number): string {
  if (level >= 9) return 'var(--rare-mythic)';
  if (level >= 7) return 'var(--rare-legendary)';
  if (level >= 4) return 'var(--rare-rare)';
  if (level > 0) return 'var(--rare-uncommon)';
  return 'var(--text-mute)';
}

/* ── 아이템 이름 색상 (강화에 따른) ── */
export function itemNameColor(enh: number): string {
  if (enh >= 9) return 'var(--rare-mythic)';
  if (enh >= 7) return 'var(--rare-legendary)';
  if (enh >= 4) return 'var(--rare-rare)';
  return 'var(--text)';
}

/* ── 아이템 썸네일 (L1J 스타일 어두운 사각형) ── */
export function ItemThumb({ item }: { item: Equipment }) {
  const enh = item.enhanceLevel;
  const glowBorder = enh >= 7
    ? `1px solid ${enhColor(enh)}`
    : '1px solid var(--border-soft)';

  return (
    <div style={{
      width: 44, height: 44, borderRadius: 'var(--r-sm)',
      background: 'var(--bg-canvas)',
      border: glowBorder,
      boxShadow: enh >= 7
        ? `0 0 8px -2px ${enhColor(enh)}`
        : 'none',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, position: 'relative',
      overflow: 'hidden',
    }}>
      <span style={{ fontSize: 18, lineHeight: 1, filter: enh >= 7 ? 'brightness(1.2)' : 'none' }}>
        {TYPE_ICON[item.type] ?? '📦'}
      </span>
      {enh > 0 && (
        <span style={{
          position: 'absolute', bottom: 1, right: 2,
          fontSize: 9, fontWeight: 800, fontFamily: 'var(--font-mono)',
          color: enhColor(enh),
          textShadow: '0 0 4px currentColor',
        }}>
          +{enh}
        </span>
      )}
    </div>
  );
}

/* ── 아이템 스탯 라인 ── */
export function ItemStatLine({ item, showType }: { item: Equipment; showType?: boolean }) {
  const isWpn = item.type === 'weapon' || item.type === 'bow' || item.type === 'staff';

  return (
    <div style={{
      display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
      fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)',
    }}>
      {showType && (
        <span style={{ color: 'var(--text-faint)' }}>{equipTypeLabel(item.type)}</span>
      )}
      {isWpn ? (
        <span>대미지 {item.baseAtk}/{item.baseAtkLarge}</span>
      ) : (
        <span>AC {item.baseDef}+{item.enhanceLevel}</span>
      )}
      {item.bonusEffects?.length > 0 && (
        <span style={{ color: 'var(--info)' }}>
          {item.bonusEffects.map(e => e.replace(' (미구현)', '')).join(', ')}
        </span>
      )}
      {item.isTwoHanded && <span style={{ color: 'var(--accent)' }}>양손</span>}
    </div>
  );
}

/* ── 아이템 행 (L1J 거래소 스타일 — 가로 한 줄) ── */
export function ItemRow({
  item, selected, onClick, right, glow,
}: {
  item: Equipment;
  selected?: boolean;
  onClick?: () => void;
  right?: React.ReactNode;
  glow?: boolean;
}) {
  const enh = item.enhanceLevel;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px',
        background: selected
          ? 'color-mix(in oklch, var(--info) 8%, var(--bg-canvas))'
          : 'var(--bg-canvas)',
        border: selected
          ? '1px solid var(--info)'
          : glow
            ? '1px solid color-mix(in oklch, var(--info) 40%, transparent)'
            : '1px solid color-mix(in oklch, var(--border-soft) 50%, transparent)',
        borderRadius: 'var(--r-sm)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <ItemThumb item={item} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 아이템 이름 (L1J: 강화 높으면 색상 변화) */}
        <div style={{
          fontSize: 'var(--fs-sm)', fontWeight: 700,
          color: itemNameColor(enh),
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          lineHeight: 1.4,
          textShadow: enh >= 7 ? `0 0 6px ${enhColor(enh)}` : 'none',
        }}>
          {equipDisplayName(item)}
        </div>
        <ItemStatLine item={item} />
      </div>

      {right}
    </div>
  );
}

/* ── 로딩/빈 상태 ── */
export function LoadingMsg() {
  return (
    <div style={{
      textAlign: 'center', padding: 'var(--s-6)',
      color: 'var(--text-faint)', fontSize: 'var(--fs-xs)',
      fontFamily: 'var(--font-mono)',
    }}>
      Loading...
    </div>
  );
}

export function EmptyMsg({ text }: { text: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: 'var(--s-6)',
      color: 'var(--text-faint)', fontSize: 'var(--fs-xs)',
      fontFamily: 'var(--font-mono)',
    }}>
      {text}
    </div>
  );
}

/* ── 장비 타입 라벨 ── */
export function equipTypeLabel(type: string): string {
  const map: Record<string, string> = {
    weapon: '무기', bow: '활', staff: '지팡이',
    tshirt: '티셔츠', armor: '갑옷', helmet: '투구',
    cloak: '망토', gloves: '장갑', boots: '부츠', shield: '방패',
    necklace: '목걸이', ring: '반지', belt: '벨트', earring: '귀걸이',
  };
  return map[type] ?? type;
}

/* ── 타입 필터 목록 ── */
export const TYPE_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'weapon', label: '무기' },
  { key: 'bow', label: '활' },
  { key: 'staff', label: '지팡이' },
  { key: 'armor', label: '갑옷' },
  { key: 'helmet', label: '투구' },
  { key: 'cloak', label: '망토' },
  { key: 'gloves', label: '장갑' },
  { key: 'boots', label: '부츠' },
  { key: 'shield', label: '방패' },
  { key: 'tshirt', label: '티셔츠' },
  { key: 'necklace', label: '목걸이' },
  { key: 'ring', label: '반지' },
  { key: 'belt', label: '벨트' },
];

/* ── 가격 포맷 ── */
export function formatGold(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(n >= 100_000 ? 0 : 1)}만`;
  return n.toLocaleString();
}
