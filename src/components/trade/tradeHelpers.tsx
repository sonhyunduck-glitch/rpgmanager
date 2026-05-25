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

/* ── 강화 등급 색상 ── */
function enhColor(level: number): string {
  if (level >= 9) return 'var(--warning)';
  if (level >= 7) return '#ff9800';
  if (level >= 4) return 'var(--accent)';
  if (level > 0) return 'var(--success)';
  return 'var(--text-mute)';
}

/* ── 아이템 뱃지 (리디자인) ── */
export function ItemBadge({ item }: { item: Equipment }) {
  const enh = item.enhanceLevel;
  return (
    <div style={{
      width: 38, height: 38, borderRadius: 'var(--r-sm)',
      background: enh >= 7
        ? 'linear-gradient(135deg, rgba(255,152,0,0.15), rgba(255,193,7,0.08))'
        : 'var(--bg-panel)',
      border: enh >= 7
        ? '1.5px solid rgba(255,152,0,0.4)'
        : '1px solid var(--border-soft)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, position: 'relative',
    }}>
      <span style={{ fontSize: 14, lineHeight: 1 }}>
        {TYPE_ICON[item.type] ?? '📦'}
      </span>
      {enh > 0 && (
        <span style={{
          position: 'absolute', bottom: -2, right: -2,
          fontSize: 9, fontWeight: 800, fontFamily: 'var(--font-mono)',
          color: '#fff',
          background: enhColor(enh),
          borderRadius: 'var(--r-full)',
          padding: '0 3px', lineHeight: '14px',
          minWidth: 14, textAlign: 'center',
        }}>
          +{enh}
        </span>
      )}
    </div>
  );
}

/* ── 아이템 스탯 라인 ── */
export function ItemStatLine({ item }: { item: Equipment }) {
  const isWpn = item.type === 'weapon' || item.type === 'bow' || item.type === 'staff';
  const enh = item.enhanceLevel;

  return (
    <div style={{
      display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
      fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)',
    }}>
      {isWpn ? (
        <>
          <span>타격 {item.baseAtk}/{item.baseAtkLarge}</span>
          {enh > 0 && <span style={{ color: enhColor(enh), fontWeight: 700 }}>+{enh}</span>}
          {item.isTwoHanded && <span style={{ color: 'var(--accent)' }}>양손</span>}
        </>
      ) : (
        <>
          <span>AC {item.baseDef}</span>
          {enh > 0 && <span style={{ color: enhColor(enh), fontWeight: 700 }}>+{enh}</span>}
        </>
      )}
      {item.bonusEffects?.length > 0 && (
        <span style={{ color: 'var(--info)' }}>
          {item.bonusEffects[0].replace(' (미구현)', '')}
          {item.bonusEffects.length > 1 && ` +${item.bonusEffects.length - 1}`}
        </span>
      )}
    </div>
  );
}

/* ── 아이템 카드 (거래소 공통) ── */
export function ItemCard({
  item, selected, onClick, right, highlight,
}: {
  item: Equipment;
  selected?: boolean;
  onClick?: () => void;
  right?: React.ReactNode;
  highlight?: 'accent' | 'info' | 'success' | 'none';
}) {
  const hl = highlight ?? 'none';
  const borderColor = selected ? 'var(--accent)'
    : hl === 'info' ? 'var(--info)'
    : hl === 'success' ? 'var(--success)'
    : 'var(--border-soft)';

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px',
        background: selected
          ? 'radial-gradient(ellipse at 30% 50%, color-mix(in oklch, var(--accent) 8%, var(--bg-panel)), var(--bg-panel))'
          : hl === 'info'
            ? 'color-mix(in oklch, var(--info) 4%, var(--bg-sunken))'
            : 'var(--bg-sunken)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--r-sm)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <ItemBadge item={item} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          lineHeight: 1.3,
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
      color: 'var(--text-mute)', fontSize: 'var(--fs-xs)',
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
      color: 'var(--text-mute)', fontSize: 'var(--fs-xs)',
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
