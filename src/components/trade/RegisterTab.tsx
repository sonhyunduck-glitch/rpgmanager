/* ── 등록 탭: 인벤토리에서 아이템 선택 → 가격 설정 → 등록 ── */
import { useState, useEffect } from 'react';
import { useGameStore, equipDisplayName } from '../../store/gameStore';
import { LABEL } from '../../styles/shared';
import { createListing, getListedItemUids } from '../../lib/trade';
import { ItemCard, EmptyMsg, equipTypeLabel } from './tradeHelpers';

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

  const priceNum = parseInt(price, 10);
  const validPrice = !isNaN(priceNum) && priceNum >= 1;

  const handleSubmit = async () => {
    if (!userId || !selectedItem || !validPrice) return;

    setSubmitting(true);
    const result = await createListing(userId, playerName, level, selectedItem, priceNum);

    if (result) {
      // 로컬 인벤토리에서 제거
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
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', flexShrink: 0,
      }}>
        <span style={{ ...LABEL, fontSize: 'var(--fs-xs)', marginBottom: 0 }}>
          판매할 아이템
        </span>
        <span style={{ flex: 1 }} />
        <span style={{
          fontSize: 'var(--fs-2xs)', fontFamily: 'var(--font-mono)',
          color: 'var(--text-mute)',
        }}>
          {availableItems.length}개
        </span>
      </div>

      {/* 아이템 리스트 */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {availableItems.length === 0 ? (
          <EmptyMsg text="인벤토리에 판매 가능한 아이템이 없습니다." />
        ) : (
          availableItems.map(item => (
            <ItemCard
              key={item.uid}
              item={item}
              selected={selectedUid === item.uid}
              onClick={() => setSelectedUid(selectedUid === item.uid ? null : item.uid)}
              right={
                <span style={{
                  fontSize: 'var(--fs-2xs)', fontFamily: 'var(--font-mono)',
                  color: 'var(--text-mute)', flexShrink: 0,
                }}>
                  {equipTypeLabel(item.type)}
                </span>
              }
            />
          ))
        )}
      </div>

      {/* ── 등록 패널 (선택 시 표시) ── */}
      {selectedItem && (
        <div style={{
          flexShrink: 0,
          background: 'var(--bg-panel)',
          border: '1.5px solid var(--accent)',
          borderRadius: 'var(--r-md)',
          padding: 'var(--s-3)',
          display: 'flex', flexDirection: 'column', gap: 'var(--s-3)',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
        }}>
          {/* 선택된 아이템 요약 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)',
              flex: 1, minWidth: 0,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {equipDisplayName(selectedItem)}
            </span>
            <span style={{
              fontSize: 'var(--fs-2xs)', fontFamily: 'var(--font-mono)',
              color: 'var(--text-mute)',
            }}>
              상점가 {selectedItem.sellPrice.toLocaleString()}G
            </span>
          </div>

          {/* 가격 입력 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              ...LABEL, fontSize: 'var(--fs-2xs)', marginBottom: 0,
              flexShrink: 0,
            }}>
              판매가
            </span>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center',
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-xs)',
              padding: '0 8px',
              height: 32,
              transition: 'border-color 0.15s',
            }}>
              <input
                type="number"
                min="1"
                value={price}
                onChange={e => setPrice(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="가격 입력"
                style={{
                  flex: 1, minWidth: 0,
                  background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 'var(--fs-sm)', fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: validPrice ? 'var(--accent)' : 'var(--text)',
                }}
              />
              <span style={{
                fontSize: 'var(--fs-sm)', fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent)', flexShrink: 0,
              }}>
                G
              </span>
            </div>
          </div>

          {/* 등록 버튼 */}
          <button
            disabled={submitting || !validPrice}
            onClick={handleSubmit}
            style={{
              height: 36, borderRadius: 'var(--r-sm)',
              border: 'none',
              background: submitting || !validPrice
                ? 'var(--bg-sunken)'
                : 'linear-gradient(135deg, var(--accent), oklch(0.68 0.18 45))',
              color: submitting || !validPrice ? 'var(--text-mute)' : '#fff',
              fontWeight: 700, fontSize: 'var(--fs-sm)',
              fontFamily: 'var(--font-ui)',
              cursor: submitting || !validPrice ? 'not-allowed' : 'pointer',
              opacity: !validPrice ? 0.4 : 1,
              transition: 'all 0.15s',
              letterSpacing: '0.02em',
            }}
          >
            {submitting ? '등록 중...' : '거래소에 등록'}
          </button>
        </div>
      )}
    </div>
  );
}
