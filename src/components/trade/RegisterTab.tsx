/* ── 판매 등록 탭 (L1J 모바일 거래소 디자인) ── */
import { useState, useEffect } from 'react';
import { useGameStore, equipDisplayName } from '../../store/gameStore';
import { LABEL } from '../../styles/shared';
import { createListing, getListedItemUids } from '../../lib/trade';
import { ItemRow, ItemThumb, ItemStatLine, EmptyMsg, equipTypeLabel, itemNameColor } from './tradeHelpers';

export default function RegisterTab() {
  const userId = useGameStore(s => s.authUserId);
  const playerName = useGameStore(s => s.playerName);
  const level = useGameStore(s => s.level);
  const inventory = useGameStore(s => s.inventory);

  const [listedUids, setListedUids] = useState<Set<string>>(new Set());
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [priceStr, setPriceStr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!userId) return;
    getListedItemUids(userId).then(uids => setListedUids(new Set(uids)));
  }, [userId]);

  const availableItems = inventory.filter(item => !listedUids.has(item.uid));
  const selectedItem = availableItems.find(i => i.uid === selectedUid) ?? null;

  const priceNum = parseInt(priceStr, 10);
  const validPrice = !isNaN(priceNum) && priceNum >= 1;

  /* ── 숫자 키패드 핸들러 ── */
  const handleNumpad = (key: string) => {
    if (key === 'back') {
      setPriceStr(prev => prev.slice(0, -1));
    } else if (key === 'clear') {
      setPriceStr('');
    } else {
      setPriceStr(prev => {
        const next = prev + key;
        if (next.length > 10) return prev;
        return next;
      });
    }
  };

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
      setPriceStr('');
    }
    setSubmitting(false);
  };

  /* ── 키패드 버튼 공통 스타일 ── */
  const padBtn = (label: string, key: string, span?: number): React.ReactNode => (
    <button
      key={key}
      onClick={() => handleNumpad(key)}
      style={{
        gridColumn: span ? `span ${span}` : undefined,
        height: 36,
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-sm)',
        background: 'var(--bg-sunken)',
        color: 'var(--text)',
        fontSize: 'var(--fs-base)', fontWeight: 700,
        fontFamily: 'var(--font-display)',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
    >
      {label}
    </button>
  );

  /* ═══════════════════════════════════════════ */
  /* 아이템 미선택 → 목록                       */
  /* ═══════════════════════════════════════════ */
  if (!selectedItem) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
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
            fontSize: 'var(--fs-2xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-faint)',
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
      </div>
    );
  }

  /* ═══════════════════════════════════════════ */
  /* 아이템 선택됨 → 금액 입력 (L1J 모바일 스타일) */
  /* ═══════════════════════════════════════════ */
  return (
    <div style={{
      flex: 1, minHeight: 0,
      display: 'flex', flexDirection: 'column',
      gap: 'var(--s-2)',
    }}>
      {/* 상단: 판매 수량 / 금액 입력 타이틀 */}
      <div style={{
        textAlign: 'center', flexShrink: 0,
        padding: 'var(--s-1) 0',
        borderBottom: '1px solid var(--border-soft)',
      }}>
        <span style={{
          fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)',
          fontFamily: 'var(--font-ui)',
        }}>
          판매 수량 / 금액 입력
        </span>
      </div>

      {/* ── 좌우 2컬럼: 아이템 정보 | 숫자 키패드 ── */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', gap: 'var(--s-3)',
      }}>
        {/* 좌측: 아이템 정보 + 가격 필드 */}
        <div style={{
          flex: 1, minWidth: 0,
          display: 'flex', flexDirection: 'column', gap: 'var(--s-3)',
        }}>
          {/* 아이템 카드 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: 'var(--s-2)',
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--r-sm)',
          }}>
            <ItemThumb item={selectedItem} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 'var(--fs-sm)', fontWeight: 700,
                color: itemNameColor(selectedItem.enhanceLevel),
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {equipDisplayName(selectedItem)}
              </div>
              <ItemStatLine item={selectedItem} showType />
            </div>
          </div>

          {/* 판매 수량 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
            padding: '0 var(--s-1)',
          }}>
            <span style={{
              fontSize: 'var(--fs-xs)', color: 'var(--text-mute)',
              fontFamily: 'var(--font-mono)', minWidth: 60,
            }}>
              판매 수량
            </span>
            <span style={{
              flex: 1, textAlign: 'right',
              fontSize: 'var(--fs-sm)', fontWeight: 700,
              fontFamily: 'var(--font-display)', color: 'var(--text)',
            }}>
              1
            </span>
          </div>

          {/* 상점 판매가 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
            padding: '0 var(--s-1)',
          }}>
            <span style={{
              fontSize: 'var(--fs-xs)', color: 'var(--text-mute)',
              fontFamily: 'var(--font-mono)', minWidth: 60,
            }}>
              상점가
            </span>
            <span style={{
              flex: 1, textAlign: 'right',
              fontSize: 'var(--fs-sm)', fontWeight: 700,
              fontFamily: 'var(--font-display)', color: 'var(--text-dim)',
            }}>
              {selectedItem.sellPrice.toLocaleString()}
            </span>
          </div>

          {/* 총 판매 금액 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
            padding: 'var(--s-2) var(--s-1)',
            borderTop: '1px solid var(--border-soft)',
          }}>
            <span style={{
              fontSize: 'var(--fs-xs)', color: 'var(--accent)',
              fontFamily: 'var(--font-mono)', fontWeight: 700, minWidth: 60,
            }}>
              판매 금액
            </span>
            <span style={{
              flex: 1, textAlign: 'right',
              fontSize: 'var(--fs-md)', fontWeight: 800,
              fontFamily: 'var(--font-display)',
              color: validPrice ? 'var(--accent)' : 'var(--text-faint)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {priceStr ? parseInt(priceStr, 10).toLocaleString() : '0'}
            </span>
          </div>
        </div>

        {/* 우측: 숫자 키패드 (L1J 모바일 스타일) */}
        <div style={{
          width: 140, flexShrink: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 4,
          alignContent: 'start',
        }}>
          {padBtn('1', '1')}
          {padBtn('2', '2')}
          {padBtn('3', '3')}
          {padBtn('4', '4')}
          {padBtn('5', '5')}
          {padBtn('6', '6')}
          {padBtn('7', '7')}
          {padBtn('8', '8')}
          {padBtn('9', '9')}
          {/* Max = 상점가 x10 */}
          <button
            onClick={() => setPriceStr(String(selectedItem.sellPrice * 10))}
            style={{
              height: 36,
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)',
              background: 'var(--bg-sunken)',
              color: 'var(--info)', fontSize: 'var(--fs-xs)', fontWeight: 700,
              fontFamily: 'var(--font-mono)', cursor: 'pointer',
            }}
          >
            Max
          </button>
          {padBtn('0', '0')}
          <button
            onClick={() => handleNumpad('back')}
            style={{
              height: 36,
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)',
              background: 'var(--bg-sunken)',
              color: 'var(--text-mute)', fontSize: 'var(--fs-sm)', fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ←
          </button>
          {/* 하단 ─ / 금액 표시 / + */}
          <button
            onClick={() => {
              const v = Math.max(0, (parseInt(priceStr, 10) || 0) - selectedItem.sellPrice);
              setPriceStr(String(v));
            }}
            style={{
              height: 36,
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)',
              background: 'var(--bg-sunken)',
              color: 'var(--danger)', fontSize: 'var(--fs-base)', fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            −
          </button>
          <div style={{
            height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--r-sm)',
            background: 'color-mix(in oklch, var(--accent) 8%, var(--bg-canvas))',
            color: 'var(--accent)', fontSize: 'var(--fs-xs)', fontWeight: 800,
            fontFamily: 'var(--font-display)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {priceStr ? parseInt(priceStr, 10).toLocaleString() : '0'}
          </div>
          <button
            onClick={() => {
              const v = (parseInt(priceStr, 10) || 0) + selectedItem.sellPrice;
              setPriceStr(String(v));
            }}
            style={{
              height: 36,
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)',
              background: 'var(--bg-sunken)',
              color: 'var(--success)', fontSize: 'var(--fs-base)', fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* ── 하단: 취소 / 확인 버튼 ── */}
      <div style={{
        display: 'flex', gap: 'var(--s-2)', flexShrink: 0,
        borderTop: '1px solid var(--border-soft)',
        paddingTop: 'var(--s-2)',
      }}>
        <button
          onClick={() => { setSelectedUid(null); setPriceStr(''); }}
          style={{
            flex: 1, height: 36, borderRadius: 'var(--r-sm)',
            border: '1px solid var(--border)',
            background: 'var(--bg-sunken)',
            color: 'var(--text-mute)',
            fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          취소
        </button>
        <button
          disabled={submitting || !validPrice}
          onClick={handleSubmit}
          style={{
            flex: 1, height: 36, borderRadius: 'var(--r-sm)',
            border: 'none',
            background: submitting || !validPrice
              ? 'var(--bg-sunken)'
              : 'var(--info)',
            color: submitting || !validPrice ? 'var(--text-faint)' : '#fff',
            fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', fontWeight: 700,
            cursor: submitting || !validPrice ? 'not-allowed' : 'pointer',
            opacity: !validPrice ? 0.4 : 1,
          }}
        >
          {submitting ? '등록 중...' : '확인'}
        </button>
      </div>
    </div>
  );
}
