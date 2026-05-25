/* ── 내거래 탭 (L1J 거래소 스타일) ── */
import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { LABEL } from '../../styles/shared';
import type { TradeListing } from '../../types';
import { cancelListing, getMyListings } from '../../lib/trade';
import { timeAgo } from '../../lib/utils';
import { ItemRow, LoadingMsg, EmptyMsg, formatGold } from './tradeHelpers';

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

  // 활성/완료 분리
  const activeListings = listings.filter(l => l.status === 'active');
  const completedListings = listings.filter(l => l.status !== 'active');

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', flexShrink: 0,
        paddingBottom: 'var(--s-1)',
        borderBottom: '1px solid color-mix(in oklch, var(--border-soft) 50%, transparent)',
      }}>
        <span style={{ ...LABEL, fontSize: 'var(--fs-xs)', marginBottom: 0 }}>내 거래 내역</span>
        <span style={{ flex: 1 }} />
        <button
          onClick={load}
          style={{
            fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-mono)',
            background: 'none', border: 'none',
            color: 'var(--text-faint)', cursor: 'pointer', padding: '2px 6px',
          }}
        >
          새로 고침
        </button>
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 3,
      }}>
        {loading ? (
          <LoadingMsg />
        ) : listings.length === 0 ? (
          <EmptyMsg text="거래 내역이 없습니다." />
        ) : (
          <>
            {/* 활성 거래 */}
            {activeListings.map(listing => (
              <ItemRow
                key={listing.id}
                item={listing.item_data}
                glow
                right={
                  <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'flex-end', gap: 3, flexShrink: 0,
                    minWidth: 70,
                  }}>
                    <span style={{
                      fontSize: 'var(--fs-sm)', fontWeight: 800,
                      fontFamily: 'var(--font-display)', color: 'var(--accent)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {formatGold(listing.price)}G
                    </span>
                    <span style={{
                      fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-faint)',
                    }}>
                      {timeAgo(listing.created_at)}
                    </span>
                    <button
                      disabled={cancelling === listing.id}
                      onClick={(e) => { e.stopPropagation(); handleCancel(listing); }}
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
                }
              />
            ))}

            {/* 구분선 */}
            {activeListings.length > 0 && completedListings.length > 0 && (
              <div style={{
                borderTop: '1px solid color-mix(in oklch, var(--border-soft) 50%, transparent)',
                margin: 'var(--s-1) 0',
              }} />
            )}

            {/* 완료/취소 거래 */}
            {completedListings.map(listing => {
              const isSold = listing.status === 'sold';
              return (
                <ItemRow
                  key={listing.id}
                  item={listing.item_data}
                  right={
                    <div style={{
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'flex-end', gap: 3, flexShrink: 0,
                      minWidth: 70,
                    }}>
                      <span style={{
                        fontSize: 'var(--fs-sm)', fontWeight: 800,
                        fontFamily: 'var(--font-display)',
                        color: isSold ? 'var(--success)' : 'var(--text-faint)',
                        fontVariantNumeric: 'tabular-nums',
                        textDecoration: isSold ? 'none' : 'line-through',
                      }}>
                        {formatGold(listing.price)}G
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
                          fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-faint)',
                        }}>
                          → {listing.buyer_name}
                        </span>
                      )}
                    </div>
                  }
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
