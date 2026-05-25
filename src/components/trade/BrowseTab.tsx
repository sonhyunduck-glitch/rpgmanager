/* ── 구매 탭: 활성 거래 목록 ── */
import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { TradeListing } from '../../types';
import { getActiveListings, buyListing } from '../../lib/trade';
import { timeAgo } from '../../lib/utils';
import { ItemCard, LoadingMsg, EmptyMsg, TYPE_FILTERS } from './tradeHelpers';

export default function BrowseTab() {
  const userId = useGameStore(s => s.authUserId);
  const gold = useGameStore(s => s.gold);
  const inventory = useGameStore(s => s.inventory);
  const inventoryCapacity = useGameStore(s => s.inventoryCapacity);

  const [listings, setListings] = useState<TradeListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [buying, setBuying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const filter = typeFilter === 'all' ? undefined : { itemType: typeFilter };
    const data = await getActiveListings(filter);
    setListings(data);
    setLoading(false);
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  const handleBuy = async (listing: TradeListing) => {
    if (!userId) return;
    if (gold < listing.price) return;
    if (inventory.length >= inventoryCapacity) return;

    setBuying(listing.id);
    const result = await buyListing(listing.id, userId);

    if (result.success) {
      const state = useGameStore.getState();
      useGameStore.setState({
        gold: state.gold - listing.price,
        inventory: [...state.inventory, listing.item_data],
      });
      setListings(prev => prev.filter(l => l.id !== listing.id));
    } else {
      alert(result.error === 'insufficient_gold' ? '골드가 부족합니다.'
        : result.error === 'not_found' ? '이미 판매된 거래입니다.'
        : result.error === 'own_listing' ? '본인의 거래는 구매할 수 없습니다.'
        : `거래 실패: ${result.error}`);
      load();
    }
    setBuying(null);
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
      {/* 타입 필터 */}
      <div style={{
        display: 'flex', gap: 3, flexWrap: 'wrap', flexShrink: 0,
        alignItems: 'center',
      }}>
        {TYPE_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(f.key)}
            style={{
              fontSize: 'var(--fs-2xs)', fontFamily: 'var(--font-mono)', fontWeight: 600,
              padding: '2px 7px', borderRadius: 'var(--r-full)',
              border: typeFilter === f.key ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
              background: typeFilter === f.key ? 'color-mix(in oklch, var(--accent) 12%, transparent)' : 'transparent',
              color: typeFilter === f.key ? 'var(--accent)' : 'var(--text-mute)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={load}
          style={{
            fontSize: 'var(--fs-2xs)', fontFamily: 'var(--font-mono)',
            background: 'none', border: 'none', color: 'var(--text-mute)',
            cursor: 'pointer', marginLeft: 'auto', padding: '2px 4px',
          }}
        >
          ↻
        </button>
      </div>

      {/* 목록 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {loading ? (
          <LoadingMsg />
        ) : listings.length === 0 ? (
          <EmptyMsg text="등록된 거래가 없습니다." />
        ) : (
          listings.map(listing => {
            const isMine = listing.seller_id === userId;
            const canBuy = !isMine && gold >= listing.price && inventory.length < inventoryCapacity;
            const isBuying = buying === listing.id;

            return (
              <ItemCard
                key={listing.id}
                item={listing.item_data}
                highlight={isMine ? 'info' : 'none'}
                right={
                  <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'flex-end', gap: 4, flexShrink: 0,
                  }}>
                    {/* 가격 */}
                    <span style={{
                      fontSize: 'var(--fs-sm)', fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--accent)',
                    }}>
                      {listing.price.toLocaleString()}G
                    </span>
                    {/* 판매자 + 시간 */}
                    <span style={{
                      fontSize: 9, fontFamily: 'var(--font-mono)',
                      color: 'var(--text-mute)',
                      whiteSpace: 'nowrap',
                    }}>
                      Lv.{listing.seller_level} {listing.seller_name} · {timeAgo(listing.created_at)}
                    </span>
                    {/* 구매/내거래 버튼 */}
                    {isMine ? (
                      <span style={{
                        fontSize: 'var(--fs-2xs)', fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--info)',
                        padding: '1px 6px',
                        background: 'color-mix(in oklch, var(--info) 8%, transparent)',
                        borderRadius: 'var(--r-full)',
                      }}>
                        내 거래
                      </span>
                    ) : (
                      <button
                        disabled={!canBuy || isBuying}
                        onClick={(e) => { e.stopPropagation(); handleBuy(listing); }}
                        style={{
                          fontSize: 'var(--fs-2xs)', fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          padding: '3px 12px', borderRadius: 'var(--r-xs)',
                          border: 'none',
                          background: canBuy
                            ? 'linear-gradient(135deg, var(--success), oklch(0.66 0.16 135))'
                            : 'var(--bg-sunken)',
                          color: canBuy ? '#fff' : 'var(--text-mute)',
                          cursor: canBuy ? 'pointer' : 'not-allowed',
                          opacity: canBuy ? 1 : 0.4,
                          transition: 'all 0.15s',
                        }}
                      >
                        {isBuying ? '...' : '구매'}
                      </button>
                    )}
                  </div>
                }
              />
            );
          })
        )}
      </div>
    </div>
  );
}
