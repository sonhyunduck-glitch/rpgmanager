/* ── 판매 등록 탭 (L1J 거래소 스타일) ── */
import { useState, useEffect } from 'react';
import { useGameStore, equipDisplayName } from '../../store/gameStore';
import { LABEL } from '../../styles/shared';
import { createListing, getListedItemUids } from '../../lib/trade';
import { ItemRow, ItemThumb, ItemStatLine, EmptyMsg, equipTypeLabel, itemNameColor, formatGold } from './tradeHelpers';

export default function RegisterTab() {
  const userId = useGameStore(s => s.authUserId);
  const playerName = useGameStore(s => s.playerName);
  const level = useGameStore(s => s.level);
  const inventory = useGameStore(s => s.inventory);

  const [listedUids, setListedUids] = useState<Set<string>>(new Set());
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!userId) return;
    getListedItemUids(userId).then(uids => setListedUids(new Set(uids)));
  }, [userId]);

  const availableItems = inventory.filter(item => !listedUids.has(item.uid));
  const selectedItem = availableItems.find(i => i.uid === selectedUid) ?? null;

  const priceNum = parseInt(price, 10);
  const validPrice = !isNaN(priceNum) && priceNum >= 1;

  const handleSubmit = async () => {
    if (!userId || !selectedItem || !validPrice) return;
    setSubmitting(true);
    const result = await createListing(userId, playerName, level, selectedItem, priceNum);
    if (result) {
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

  // 빠른 가격 프리셋
  const quickPrices = selectedItem ? [
    selectedItem.sellPrice,
    selectedItem.sellPrice * 2,
    selectedItem.sellPrice * 5,
    selectedItem.sellPrice * 10,
  ] : [];

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>

      {/* ── 아이템이 선택되지 않았을 때: 아이템 목록 ── */}
      {!selectedItem ? (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', flexShrink: 0,
            paddingBottom: 'var(--s-1)',
            borderBottom: '1px solid color-mix(in oklch, var(--border-soft) 50%, transparent)',
          }}>
            <span style={{ ...LABEL, fontSize: 'var(--fs-xs)', marginBottom: 0 }}>
              판매할 아이템 선택
            </span>
            <span style={{ flex: 1 }} />
            <span style={{
              fontSize: 'var(--fs-2xs)', fontFamily: 'var(--font-mono)',
              color: 'var(--text-faint)',
            }}>
              {availableItems.length}개
            </span>
          </div>

          <div style={{
            flex: 1, minHeight: 0, overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 3,
          }}>
            {availableItems.length === 0 ? (
              <EmptyMsg text="인벤토리에 판매 가능한 아이템이 없습니다." />
            ) : (
              availableItems.map(item => (
                <ItemRow
                  key={item.uid}
                  item={item}
                  onClick={() => setSelectedUid(item.uid)}
                  right={
                    <span style={{
                      fontSize: 'var(--fs-2xs)', fontFamily: 'var(--font-mono)',
                      color: 'var(--text-faint)', flexShrink: 0,
                    }}>
                      {equipTypeLabel(item.type)}
                    </span>
                  }
                />
              ))
            )}
          </div>
        </>
      ) : (
        /* ── 아이템 선택됨: 금액 입력 화면 (L1J 판매 등록 스타일) ── */
        <>
          {/* 뒤로 가기 */}
          <button
            onClick={() => { setSelectedUid(null); setPrice(''); }}
            style={{
              alignSelf: 'flex-start', flexShrink: 0,
              fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-mono)',
              color: 'var(--text-mute)', background: 'none',
              border: 'none', cursor: 'pointer', padding: '2px 0',
            }}
          >
            ← 아이템 선택
          </button>

          {/* 선택된 아이템 카드 */}
          <div style={{
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--r-md)',
            padding: 'var(--s-3)',
            display: 'flex', alignItems: 'center', gap: 12,
            flexShrink: 0,
          }}>
            <ItemThumb item={selectedItem} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 'var(--fs-base)', fontWeight: 700,
                color: itemNameColor(selectedItem.enhanceLevel),
                textShadow: selectedItem.enhanceLevel >= 7
                  ? `0 0 6px ${itemNameColor(selectedItem.enhanceLevel)}`
                  : 'none',
              }}>
                {equipDisplayName(selectedItem)}
              </div>
              <ItemStatLine item={selectedItem} showType />
            </div>
          </div>

          {/* 가격 입력 영역 */}
          <div style={{
            flex: 1,
            display: 'flex', flexDirection: 'column',
            justifyContent: 'center', gap: 'var(--s-3)',
          }}>
            {/* 판매가 라벨 + 입력 */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                ...LABEL, fontSize: 'var(--fs-2xs)', marginBottom: 'var(--s-1)',
              }}>
                판매 금액
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                background: 'var(--bg-canvas)',
                border: validPrice ? '1.5px solid var(--accent)' : '1.5px solid var(--border-soft)',
                borderRadius: 'var(--r-md)',
                padding: '0 16px',
                height: 44,
                transition: 'border-color 0.15s',
                boxShadow: validPrice ? '0 0 12px -4px var(--accent-soft)' : 'none',
                maxWidth: 220, width: '100%',
              }}>
                <input
                  type="number"
                  min="1"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="0"
                  autoFocus
                  style={{
                    flex: 1, minWidth: 0,
                    background: 'transparent', border: 'none', outline: 'none',
                    fontSize: 'var(--fs-md)', fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    color: validPrice ? 'var(--accent)' : 'var(--text-dim)',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
                <span style={{
                  fontSize: 'var(--fs-base)', fontWeight: 800,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--accent)', marginLeft: 6,
                }}>
                  G
                </span>
              </div>
            </div>

            {/* 빠른 가격 버튼 */}
            <div style={{
              display: 'flex', gap: 'var(--s-1)', justifyContent: 'center',
              flexWrap: 'wrap',
            }}>
              {quickPrices.map(qp => (
                <button
                  key={qp}
                  onClick={() => setPrice(String(qp))}
                  style={{
                    fontSize: 'var(--fs-2xs)', fontFamily: 'var(--font-mono)', fontWeight: 600,
                    padding: '4px 10px', borderRadius: 'var(--r-xs)',
                    border: '1px solid var(--border-soft)',
                    background: price === String(qp)
                      ? 'color-mix(in oklch, var(--accent) 10%, transparent)'
                      : 'var(--bg-sunken)',
                    color: price === String(qp) ? 'var(--accent)' : 'var(--text-mute)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {formatGold(qp)}
                </button>
              ))}
            </div>

            {/* 상점가 참고 */}
            <div style={{
              textAlign: 'center',
              fontSize: 'var(--fs-2xs)', fontFamily: 'var(--font-mono)',
              color: 'var(--text-faint)',
            }}>
              상점 판매가 {selectedItem.sellPrice.toLocaleString()}G
            </div>
          </div>

          {/* 하단 버튼 */}
          <div style={{
            display: 'flex', gap: 'var(--s-2)', flexShrink: 0,
          }}>
            <button
              onClick={() => { setSelectedUid(null); setPrice(''); }}
              style={{
                flex: 1, height: 38, borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-mute)',
                fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              취소
            </button>
            <button
              disabled={submitting || !validPrice}
              onClick={handleSubmit}
              style={{
                flex: 2, height: 38, borderRadius: 'var(--r-sm)',
                border: 'none',
                background: submitting || !validPrice
                  ? 'var(--bg-sunken)'
                  : 'var(--info)',
                color: submitting || !validPrice ? 'var(--text-faint)' : '#fff',
                fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', fontWeight: 700,
                cursor: submitting || !validPrice ? 'not-allowed' : 'pointer',
                opacity: !validPrice ? 0.4 : 1,
                transition: 'all 0.15s',
              }}
            >
              {submitting ? '등록 중...' : '확인'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
