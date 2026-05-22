/* ── 등록 탭: 인벤토리에서 아이템 선택 → 가격 설정 ── */
import { useState, useEffect } from 'react';
import { useGameStore, equipDisplayName } from '../../store/gameStore';
import { LABEL } from '../../styles/shared';
import { createListing, getListedItemUids } from '../../lib/trade';
import { ItemBadge, EmptyMsg, equipTypeLabel } from './tradeHelpers';

export default function RegisterTab() {
  const userId = useGameStore(s => s.authUserId);
  const playerName = useGameStore(s => s.playerName);
  const level = useGameStore(s => s.level);
  const inventory = useGameStore(s => s.inventory);

  const [listedUids, setListedUids] = useState<Set<string>>(new Set());
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 이미 등록된 아이템 UID 로드
  useEffect(() => {
    if (!userId) return;
    getListedItemUids(userId).then(uids => setListedUids(new Set(uids)));
  }, [userId]);

  const availableItems = inventory.filter(item => !listedUids.has(item.uid));
  const selectedItem = availableItems.find(i => i.uid === selectedUid) ?? null;

  const handleSubmit = async () => {
    if (!userId || !selectedItem || !price) return;
    const priceNum = parseInt(price, 10);
    if (isNaN(priceNum) || priceNum < 1) return;

    setSubmitting(true);
    const result = await createListing(userId, playerName, level, selectedItem, priceNum);

    if (result) {
      // 로컬 인벤토리에서 제거 (거래소에 올렸으니)
      const state = useGameStore.getState();
      useGameStore.setState({
        inventory: state.inventory.filter(e => e.uid !== selectedItem.uid),
      });
      setListedUids(prev => new Set([...prev, selectedItem.uid]));
      setSelectedUid(null);
      setPrice('');
    }
    setSubmitting(false);
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
      <div style={{ ...LABEL, fontSize: 'var(--fs-xs)' }}>판매할 아이템 선택</div>

      {/* 인벤토리 아이템 그리드 */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 3,
      }}>
        {availableItems.length === 0 ? (
          <EmptyMsg text="판매 가능한 아이템이 없습니다." />
        ) : (
          availableItems.map(item => (
            <div
              key={item.uid}
              onClick={() => setSelectedUid(item.uid)}
              style={{
                padding: '6px 8px',
                background: selectedUid === item.uid
                  ? 'color-mix(in oklch, var(--accent) 12%, transparent)'
                  : 'var(--bg-sunken)',
                border: selectedUid === item.uid
                  ? '1px solid var(--accent)'
                  : '1px solid var(--border-soft)',
                borderRadius: 'var(--r-sm)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <ItemBadge item={item} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {equipDisplayName(item)}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-mute)' }}>
                  {equipTypeLabel(item.type)} · 상점가 {item.sellPrice.toLocaleString()}G
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 가격 설정 + 등록 버튼 */}
      {selectedItem && (
        <div style={{
          flexShrink: 0, padding: 'var(--s-2)',
          background: 'var(--bg-sunken)', borderRadius: 'var(--r-sm)',
          border: '1px solid var(--border-soft)',
          display: 'flex', flexDirection: 'column', gap: 'var(--s-2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)' }}>
              {equipDisplayName(selectedItem)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...LABEL, fontSize: 'var(--fs-2xs)', marginBottom: 0 }}>판매가</span>
            <input
              type="number"
              min="1"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="골드"
              style={{
                flex: 1, height: 28,
                background: 'var(--bg-panel)', border: '1px solid var(--border-soft)',
                borderRadius: 'var(--r-xs)', padding: '0 8px',
                fontSize: 'var(--fs-sm)', fontFamily: 'var(--font-mono)',
                color: 'var(--text)', outline: 'none',
              }}
            />
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent)', fontWeight: 700 }}>G</span>
          </div>

          <button
            disabled={submitting || !price || parseInt(price, 10) < 1}
            onClick={handleSubmit}
            style={{
              height: 30, borderRadius: 'var(--r-sm)',
              border: 'none',
              background: submitting ? 'var(--bg-sunken)'
                : 'linear-gradient(135deg, var(--accent), oklch(0.68 0.18 45))',
              color: '#fff', fontWeight: 700, fontSize: 'var(--fs-sm)',
              fontFamily: 'var(--font-mono)',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: (!price || parseInt(price, 10) < 1) ? 0.4 : 1,
            }}
          >
            {submitting ? '등록 중...' : '거래소에 등록'}
          </button>
        </div>
      )}
    </div>
  );
}
