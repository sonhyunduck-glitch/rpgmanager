/* ── 거래소 공용 헬퍼 컴포넌트 & 함수 ── */
import type { Equipment } from '../../types';

export function ItemBadge({ item }: { item: Equipment }) {
  const enhColor = item.enhanceLevel > 0
    ? item.enhanceLevel >= 7 ? 'var(--warning)' : 'var(--accent)'
    : 'var(--text-mute)';
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 'var(--r-xs)',
      background: 'var(--bg-panel)', border: '1px solid var(--border-soft)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 7, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
        {item.type.slice(0, 3)}
      </span>
      {item.enhanceLevel > 0 && (
        <span style={{ fontSize: 9, fontWeight: 800, color: enhColor, fontFamily: 'var(--font-mono)' }}>
          +{item.enhanceLevel}
        </span>
      )}
    </div>
  );
}

export function LoadingMsg() {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--s-4)', color: 'var(--text-mute)', fontSize: 10, fontStyle: 'italic' }}>
      Loading...
    </div>
  );
}

export function EmptyMsg({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--s-4)', color: 'var(--text-mute)', fontSize: 10, fontStyle: 'italic' }}>
      {text}
    </div>
  );
}

export function equipTypeLabel(type: string): string {
  const map: Record<string, string> = {
    weapon: '무기', tshirt: '티셔츠', armor: '갑옷', helmet: '투구',
    cloak: '망토', gloves: '장갑', boots: '부츠', shield: '방패',
    necklace: '목걸이', ring: '반지', belt: '벨트',
  };
  return map[type] ?? type;
}

export const TYPE_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'weapon', label: '무기' },
  { key: 'armor', label: '방어구' },
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
