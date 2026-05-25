/* ── 내거래 탭: 내가 올린 거래 + 상태 ── */
import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { LABEL } from '../../styles/shared';
import type { TradeListing } from '../../types';
import { cancelListing, getMyListings } from '../../lib/trade';
import { timeAgo } from '../../lib/utils';
import { ItemCard, LoadingMsg, EmptyMsg } from './tradeHelpers';

/* ── 상태 뱃지 ── */
function StatusBadge({ listing, cancelling, onCancel }: {
  listing: TradeListing;
  cancelling: boolean;
  onCancel: () => void;
}) {
  if (listing.status === 'active') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'flex-end', gap: 4, flexShrink: 0,
      }}>
        <span style={{
          fontSize: 'var(--fs-sm)', fontWeight: 800,
          fontFamily: 'var(--font-mono)', color: 'var(--accent)',
        }}>
          {listing.price.toLocaleString()}G
        </span>
        <span style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)',
        }}>
          {timeAgo(listing.created_at)}
        </span>
        <button
          disabled={cancelling}
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          style={{
            fontSize: 'var(--fs-2xs)', fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            padding: '3px 10px', borderRadius: 'var(--r-xs)',
            border: '1px solid var(--danger)',
            background: 'color-mix(in oklch, var(--danger) 8%, transparent)',
            color: 'var(--danger)',
            cursor: cancelling ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {cancelling ? '...' : '취소'}
        </button>
      </div>
    );
  }

  // sold / cancelled
  const isSold = listing.status === 'sold';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'flex-end', gap: 4, flexShrink: 0,
    }}>
      <span style={{
        fontSize: 'var(--fs-sm)', fontWeight: 800,
        fontFamily: 'var(--font-mono)',
        color: isSold ? 'var(--success)' : 'var(--text-mute)',
      }}>
        {listing.price.toLocaleString()}G
      </span>
      <span style={{
        fontSize: 'var(--fs-2xs)', fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        padding: '2px 8px', borderRadius: 'var(--r-full)',
        background: isSold
          ? 'color-mix(in oklch, var(--success) 10%, transparent)'
          : 'color-mix(in oklch, var(--text-mute) 6%, transparent)',
        color: isSold ? 'var(--success)' : 'var(--text-mute)',
        border: `1px solid ${isSold ? 'var(--success)' : 'var(--border-soft)'}`,
      }}>
        {isSold ? '판매완료' : '취소됨'}
      </span>
      {isSold && listing.buyer_name && (
        <span style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)',
        }}>
          → {listing.buyer_name}
        </span>
      )}
    </div>
  );
}

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
        <span style={{ ...LABEL, fontSize: 'var(--fs-xs)', marginBottom: 0 }}>내 거래 내역</span>
        <span style={{ flex: 1 }} />
        <button
          onClick={load}
          style={{
            fontSize: 'var(--fs-2xs)', fontFamily: 'var(--font-mono)',
            background: 'none', border: 'none', color: 'var(--text-mute)',
            cursor: 'pointer', padding: '2px 4px',
          }}
        >
          ↻
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {loading ? (
          <LoadingMsg />
        ) : listings.length === 0 ? (
          <EmptyMsg text="거래 내역이 없습니다." />
        ) : (
          listings.map(listing => (
            <ItemCard
              key={listing.id}
              item={listing.item_data}
              highlight={listing.status === 'sold' ? 'success' : 'none'}
              right={
                <StatusBadge
                  listing={listing}
                  cancelling={cancelling === listing.id}
                  onCancel={() => handleCancel(listing)}
                />
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
