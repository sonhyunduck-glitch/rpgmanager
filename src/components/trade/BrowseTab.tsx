/* ── 구매 탭: 활성 거래 목록 ── */
import { useState, useEffect, useCallback } from 'react';
import { useGameStore, equipDisplayName } from '../../store/gameStore';
import { STAT_VALUE } from '../../styles/shared';
import type { TradeListing } from '../../types';
import { getActiveListings, buyListing } from '../../lib/trade';
import { timeAgo } from '../../lib/utils';
import { ItemBadge, LoadingMsg, EmptyMsg, equipTypeLabel, TYPE_FILTERS } from './tradeHelpers';

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
      // 로컬 상태 업데이트: 골드 차감 + 아이템 추가
      const state = useGameStore.getState();
      useGameStore.setState({
        gold: state.gold - listing.price,
        inventory: [...state.inventory, listing.item_data],
      });
      // 목록에서 제거
      setListings(prev => prev.filter(l => l.id !== listing.id));
    } else {
      alert(result.error === 'insufficient_gold' ? '골드가 부족합니다.'
        : result.error === 'not_found' ? '이미 판매된 거래입니다.'
        : result.error === 'own_listing' ? '본인의 거래는 구매할 수 없습니다.'
        : `거래 실패: ${result.error}`);
      load(); // 새로고침
    }
    setBuying(null);
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
      {/* 타입 필터 */}
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', flexShrink: 0 }}>
        {TYPE_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(f.key)}
            style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
              padding: '2px 6px', borderRadius: 'var(--r-xs)',
              border: typeFilter === f.key ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
              background: typeFilter === f.key ? 'color-mix(in oklch, var(--accent) 15%, transparent)' : 'transparent',
              color: typeFilter === f.key ? 'var(--accent)' : 'var(--text-mute)',
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={load}
          style={{
            fontSize: 8, fontFamily: 'var(--font-mono)',
            background: 'none', border: 'none', color: 'var(--text-mute)',
            cursor: 'pointer', marginLeft: 'auto',
          }}
        >
          Refresh
        </button>
      </div>

      {/* 목록 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {loading ? (
          <LoadingMsg />
        ) : listings.length === 0 ? (
          <EmptyMsg text="등록된 거래가 없습니다." />
        ) : (
          listings.map(listing => (
            <ListingCard
              key={listing.id}
              listing={listing}
              isMine={listing.seller_id === userId}
              canBuy={
                listing.seller_id !== userId
                && gold >= listing.price
                && inventory.length < inventoryCapacity
              }
              buying={buying === listing.id}
              onBuy={() => handleBuy(listing)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ── 거래 목록 카드 ── */
function ListingCard({
  listing, isMine, canBuy, buying, onBuy,
}: {
  listing: TradeListing;
  isMine: boolean;
  canBuy: boolean;
  buying: boolean;
  onBuy: () => void;
}) {
  const item = listing.item_data;
  return (
    <div style={{
      padding: '6px 8px',
      background: isMine
        ? 'color-mix(in oklch, var(--info) 5%, var(--bg-sunken))'
        : 'var(--bg-sunken)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-sm)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <ItemBadge item={item} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'var(--text)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {equipDisplayName(item)}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-mute)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span>{equipTypeLabel(item.type)}</span>
          <span style={{ color: 'var(--border-soft)' }}>·</span>
          <span>Lv.{listing.seller_level} {listing.seller_name}</span>
          <span style={{ color: 'var(--border-soft)' }}>·</span>
          <span>{timeAgo(listing.created_at)}</span>
        </div>
        {/* 아이템 스탯 */}
        <div style={{ fontSize: 8, color: 'var(--text-mute)', marginTop: 2, display: 'flex', gap: 4 }}>
          {item.baseAtk > 0 && <span>ATK {item.baseAtk}</span>}
          {item.baseDef > 0 && <span>DEF {item.baseDef}</span>}
          {item.enhanceLevel > 0 && <span style={{ color: 'var(--accent)' }}>+{item.enhanceLevel}</span>}
          {item.bonusEffects?.length > 0 && (
            <span style={{ color: 'var(--info)' }}>{item.bonusEffects[0]}</span>
          )}
        </div>
      </div>

      {/* 가격 + 구매 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        <span style={{
          ...STAT_VALUE, fontSize: 12, color: 'var(--accent)',
        }}>
          {listing.price.toLocaleString()}G
        </span>
        {!isMine && (
          <button
            disabled={!canBuy || buying}
            onClick={onBuy}
            style={{
              fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
              padding: '3px 10px', borderRadius: 'var(--r-xs)',
              border: canBuy ? '1px solid var(--success)' : '1px solid var(--border-soft)',
              background: canBuy
                ? 'color-mix(in oklch, var(--success) 12%, transparent)'
                : 'transparent',
              color: canBuy ? 'var(--success)' : 'var(--text-mute)',
              cursor: canBuy ? 'pointer' : 'not-allowed',
              opacity: canBuy ? 1 : 0.4,
            }}
          >
            {buying ? '...' : '구매'}
          </button>
        )}
        {isMine && (
          <span style={{ fontSize: 8, color: 'var(--info)', fontFamily: 'var(--font-mono)' }}>
            내 거래
          </span>
        )}
      </div>
    </div>
  );
}
