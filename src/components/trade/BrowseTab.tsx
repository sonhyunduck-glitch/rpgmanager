/* ── 검색 탭: 활성 거래 목록 (L1J 거래소 스타일) ── */
import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { TradeListing } from '../../types';
import { getActiveListings, buyListing } from '../../lib/trade';
import { timeAgo } from '../../lib/utils';
import { ItemRow, LoadingMsg, EmptyMsg, TYPE_FILTERS, formatGold } from './tradeHelpers';

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
    if (!userId || gold < listing.price || inventory.length >= inventoryCapacity) return;

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
      {/* ── 카테고리 필터 (L1J 좌측 탭 느낌 → 가로 칩) ── */}
      <div style={{
        display: 'flex', gap: 3, flexWrap: 'wrap', flexShrink: 0,
        alignItems: 'center',
        paddingBottom: 'var(--s-1)',
        borderBottom: '1px solid color-mix(in oklch, var(--border-soft) 50%, transparent)',
      }}>
        {TYPE_FILTERS.map(f => {
          const active = typeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              style={{
                fontSize: 'var(--fs-2xs)', fontFamily: 'var(--font-mono)', fontWeight: 600,
                padding: '3px 8px', borderRadius: 'var(--r-xs)',
                border: active ? '1px solid var(--info)' : '1px solid transparent',
                background: active ? 'color-mix(in oklch, var(--info) 10%, transparent)' : 'transparent',
                color: active ? 'var(--info)' : 'var(--text-faint)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          );
        })}
        <button
          onClick={load}
          style={{
            fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-mono)',
            background: 'none', border: 'none',
            color: 'var(--text-faint)', cursor: 'pointer',
            marginLeft: 'auto', padding: '2px 6px',
          }}
        >
          새로 고침
        </button>
      </div>

      {/* ── 거래 목록 ── */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 3,
      }}>
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
              <ItemRow
                key={listing.id}
                item={listing.item_data}
                glow={isMine}
                right={
                  <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'flex-end', gap: 3, flexShrink: 0,
                    minWidth: 70,
                  }}>
                    {/* 가격 */}
                    <span style={{
                      fontSize: 'var(--fs-sm)', fontWeight: 800,
                      fontFamily: 'var(--font-display)',
                      color: 'var(--accent)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {formatGold(listing.price)}G
                    </span>
                    {/* 판매자 · 시간 */}
                    <span style={{
                      fontSize: 8, fontFamily: 'var(--font-mono)',
                      color: 'var(--text-faint)', whiteSpace: 'nowrap',
                    }}>
                      {listing.seller_name} · {timeAgo(listing.created_at)}
                    </span>
                    {/* 버튼 */}
                    {isMine ? (
                      <span style={{
                        fontSize: 'var(--fs-2xs)', fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--info)', opacity: 0.7,
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
                          padding: '3px 14px', borderRadius: 'var(--r-xs)',
                          border: 'none',
                          background: canBuy
                            ? 'var(--info)'
                            : 'var(--bg-sunken)',
                          color: canBuy ? '#fff' : 'var(--text-faint)',
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
