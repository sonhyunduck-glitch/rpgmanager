/* =========================================================
   TRADE PANEL — 장비 거래소 (구매 | 등록 | 내거래)
   ========================================================= */
import { useState, useEffect, useCallback } from 'react';
import { useGameStore, equipDisplayName } from '../../store/gameStore';
import { PANEL_FULL, LABEL, TAB_CONTAINER, tabStyle, STAT_VALUE } from '../../styles/shared';
import type { TradeListing, Equipment } from '../../types';
import {
  getActiveListings,
  createListing,
  buyListing,
  cancelListing,
  getMyListings,
  getListedItemUids,
} from '../../lib/trade';
import { timeAgo } from '../../lib/utils';

type TradeTab = 'browse' | 'register' | 'my';

const TABS: { key: TradeTab; label: string }[] = [
  { key: 'browse', label: '거래소' },
  { key: 'register', label: '등록' },
  { key: 'my', label: '내거래' },
];

const TYPE_FILTERS: { key: string; label: string }[] = [
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

export default function TradePanel() {
  const [tab, setTab] = useState<TradeTab>('browse');

  return (
    <div style={PANEL_FULL}>
      {/* 탭 */}
      <div style={TAB_CONTAINER}>
        {TABS.map(t => (
          <button key={t.key} style={tabStyle(tab === t.key)} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'browse' && <BrowseTab />}
      {tab === 'register' && <RegisterTab />}
      {tab === 'my' && <MyTradesTab />}
    </div>
  );
}

/* ── 구매 탭: 활성 거래 목록 ── */
function BrowseTab() {
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

/* ── 등록 탭: 인벤토리에서 아이템 선택 → 가격 설정 ── */
function RegisterTab() {
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
      <div style={{ ...LABEL, fontSize: 9 }}>판매할 아이템 선택</div>

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
                  fontSize: 11, fontWeight: 600, color: 'var(--text)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {equipDisplayName(item)}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-mute)' }}>
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
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>
              {equipDisplayName(selectedItem)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...LABEL, fontSize: 8, marginBottom: 0 }}>판매가</span>
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
                fontSize: 12, fontFamily: 'var(--font-mono)',
                color: 'var(--text)', outline: 'none',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>G</span>
          </div>

          <button
            disabled={submitting || !price || parseInt(price, 10) < 1}
            onClick={handleSubmit}
            style={{
              height: 30, borderRadius: 'var(--r-sm)',
              border: 'none',
              background: submitting ? 'var(--bg-sunken)'
                : 'linear-gradient(135deg, var(--accent), oklch(0.68 0.18 45))',
              color: '#fff', fontWeight: 700, fontSize: 11,
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

/* ── 내거래 탭: 내가 올린 거래 + 상태 ── */
function MyTradesTab() {
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

/* ── 헬퍼 컴포넌트들 ── */

function ItemBadge({ item }: { item: Equipment }) {
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

function LoadingMsg() {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--s-4)', color: 'var(--text-mute)', fontSize: 10, fontStyle: 'italic' }}>
      Loading...
    </div>
  );
}

function EmptyMsg({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--s-4)', color: 'var(--text-mute)', fontSize: 10, fontStyle: 'italic' }}>
      {text}
    </div>
  );
}

function equipTypeLabel(type: string): string {
  const map: Record<string, string> = {
    weapon: '무기', tshirt: '티셔츠', armor: '갑옷', helmet: '투구',
    cloak: '망토', gloves: '장갑', boots: '부츠', shield: '방패',
    necklace: '목걸이', ring: '반지', belt: '벨트',
  };
  return map[type] ?? type;
}

