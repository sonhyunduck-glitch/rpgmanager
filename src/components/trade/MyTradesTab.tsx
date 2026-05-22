/* ── 내거래 탭: 내가 올린 거래 + 상태 ── */
import { useState, useEffect, useCallback } from 'react';
import { useGameStore, equipDisplayName } from '../../store/gameStore';
import { LABEL } from '../../styles/shared';
import type { TradeListing } from '../../types';
import { cancelListing, getMyListings } from '../../lib/trade';
import { timeAgo } from '../../lib/utils';
import { ItemBadge, LoadingMsg, EmptyMsg } from './tradeHelpers';

export default function MyTradesTab() {
  const userId = useGameStore(s => s.authUserId);
  const [listings, setListings] = useState<TradeListing[]>([]);
  const [loading, setLoading] = useState(true);
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
      // 아이템 인벤토리에 복원
      const state = useGameStore.getState();
      if (state.inventory.length < state.inventoryCapacity) {
        useGameStore.setState({
          inventory: [...state.inventory, listing.item_data],
        });
      }
      load();
    } else {
      alert(`취소 실패: ${result.error}`);
    }
    setCancelling(null);
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ ...LABEL, fontSize: 9, marginBottom: 0 }}>내 거래 내역</span>
        <span style={{ flex: 1 }} />
        <button
          onClick={load}
          style={{
            fontSize: 8, fontFamily: 'var(--font-mono)',
            background: 'none', border: 'none', color: 'var(--text-mute)', cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {loading ? (
          <LoadingMsg />
        ) : listings.length === 0 ? (
          <EmptyMsg text="거래 내역이 없습니다." />
        ) : (
          listings.map(listing => (
            <div
              key={listing.id}
              style={{
                padding: '6px 8px',
                background: 'var(--bg-sunken)',
                border: '1px solid var(--border-soft)',
                borderRadius: 'var(--r-sm)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <ItemBadge item={listing.item_data} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--text)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {equipDisplayName(listing.item_data)}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-mute)', display: 'flex', gap: 6 }}>
                  <span>{listing.price.toLocaleString()}G</span>
                  <span style={{ color: 'var(--border-soft)' }}>·</span>
                  <span>{timeAgo(listing.created_at)}</span>
                </div>
              </div>

              {/* 상태 */}
              {listing.status === 'active' ? (
                <button
                  disabled={cancelling === listing.id}
                  onClick={() => handleCancel(listing)}
                  style={{
                    fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                    padding: '3px 8px', borderRadius: 'var(--r-xs)',
                    border: '1px solid var(--danger)',
                    background: 'color-mix(in oklch, var(--danger) 10%, transparent)',
                    color: 'var(--danger)', cursor: 'pointer',
                  }}
                >
                  {cancelling === listing.id ? '...' : '취소'}
                </button>
              ) : (
                <span style={{
                  fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  padding: '2px 6px', borderRadius: 'var(--r-xs)',
                  background: listing.status === 'sold'
                    ? 'color-mix(in oklch, var(--success) 12%, transparent)'
                    : 'color-mix(in oklch, var(--text-mute) 8%, transparent)',
                  color: listing.status === 'sold' ? 'var(--success)' : 'var(--text-mute)',
                  border: listing.status === 'sold'
                    ? '1px solid var(--success)'
                    : '1px solid var(--border-soft)',
                }}>
                  {listing.status === 'sold'
                    ? `판매완료 → ${listing.buyer_name ?? '???'}`
                    : '취소됨'}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
