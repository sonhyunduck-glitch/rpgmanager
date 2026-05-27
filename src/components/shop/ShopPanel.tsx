/* =========================================================
   SHOP PANEL — 상점 (디자인 핸드오프 리디자인)
   물약 · 재료 · 주문서 · 무기 · 방어구 · 악세사리 · 판매
   7탭 통합, 인라인 스타일 + CSS 변수
   ========================================================= */
import { useState, useMemo } from 'react';
import { useGameStore, equipDisplayName } from '../../store/gameStore';
import {
  POTIONS, POTION_ORDER, MATERIALS,
  TRANSFORM_SCROLL_PRICE, EQUIPMENT_TEMPLATES,
} from '../../data/gameData';
import { SHOP_ETC_ITEMS } from '../../data/shopItemData';
import { canClassEquip } from '../../data/classData';
import { useMobile } from '../../lib/useMobile';
import type { ShopTab, EquipmentTemplate, PlayerClass, Equipment } from '../../types';

/* ═══════════════════════════════════════════
   상수 & 데이터
   ═══════════════════════════════════════════ */

type FullTab = ShopTab | 'sell';

const CATS: { id: ShopTab; nm: string; ic: string }[] = [
  { id: 'potion',    nm: '물약',     ic: '⏣' },
  { id: 'material',  nm: '재료',     ic: '◆' },
  { id: 'scroll',    nm: '주문서',   ic: '✎' },
  { id: 'weapon',    nm: '무기',     ic: '⚔' },
  { id: 'armor',     nm: '방어구',   ic: '◈' },
  { id: 'accessory', nm: '악세사리', ic: '◯' },
];

/* ── 물약 색상 ── */
const POTION_CLR: Record<string, string> = {
  red_potion: '#ef5350', crimson_potion: '#ff7043', clear_potion: '#e0e0e0',
  blue_potion: '#42a5f5', green_potion: '#66bb6a', courage_potion: '#ab47bc',
  elven_wafer: '#81c784', wisdom_potion: '#7986cb',
};

/* ── 주문서 ── */
const SCROLL_ITEMS: { id: string; price: number }[] = [
  { id: 'transform_scroll', price: TRANSFORM_SCROLL_PRICE },
  { id: 'event_transform_scroll', price: 500 },
  { id: 'weapon_scroll', price: 75000 },
  { id: 'blessed_weapon_scroll', price: 150000 },
  { id: 'cursed_weapon_scroll', price: 15000 },
  { id: 'armor_scroll', price: 31000 },
  { id: 'blessed_armor_scroll', price: 62000 },
  { id: 'cursed_armor_scroll', price: 6200 },
];

const SCROLL_CLR: Record<string, string> = {
  transform_scroll: '#00e5ff', event_transform_scroll: '#F5C518',
  weapon_scroll: '#9e9e9e', blessed_weapon_scroll: '#F5C518',
  cursed_weapon_scroll: 'var(--danger)',
  armor_scroll: '#9e9e9e', blessed_armor_scroll: '#F5C518',
  cursed_armor_scroll: 'var(--danger)',
};

const SCROLL_GLOW: Record<string, string | undefined> = {
  transform_scroll: '0 0 6px rgba(0,229,255,0.5),0 0 14px rgba(0,229,255,0.25)',
  event_transform_scroll: '0 0 6px rgba(245,197,24,0.6),0 0 14px rgba(245,197,24,0.3)',
  blessed_weapon_scroll: '0 0 6px rgba(245,197,24,0.6),0 0 14px rgba(245,197,24,0.3)',
  blessed_armor_scroll: '0 0 6px rgba(245,197,24,0.6),0 0 14px rgba(245,197,24,0.3)',
};

const SCROLL_GROUPS = [
  { label: '변신', ids: ['transform_scroll', 'event_transform_scroll'] },
  { label: '무기 주문서', ids: ['weapon_scroll', 'blessed_weapon_scroll', 'cursed_weapon_scroll'] },
  { label: '방어구 주문서', ids: ['armor_scroll', 'blessed_armor_scroll', 'cursed_armor_scroll'] },
];

/* ── 재료 색상 ── */
const MAT_CLR: Record<string, string> = {
  e_40319: '#42a5f5', e_40318: '#ab47bc', e_40744: '#9e9e9e',
};

/* ── 장비 그룹 ── */
const WPN_GROUPS  = [{ type: 'weapon', label: '검/창/둔기' }, { type: 'bow', label: '활' }, { type: 'staff', label: '지팡이' }];
const ARM_GROUPS  = [
  { type: 'tshirt', label: '티셔츠' }, { type: 'helmet', label: '투구' },
  { type: 'armor',  label: '갑옷' },   { type: 'cloak',  label: '망토' },
  { type: 'gloves', label: '장갑' },   { type: 'boots',  label: '부츠' },
  { type: 'shield', label: '방패' },
];
const ACC_GROUPS  = [{ type: 'necklace', label: '목걸이' }, { type: 'ring', label: '반지' }, { type: 'belt', label: '벨트' }];

/* ── 클래스 ── */
const CLS_IC: Record<PlayerClass, string> = { knight: '⚔️', elf: '🏹', wizard: '🔮' };
const CLS_NM: Record<PlayerClass, string> = { knight: '기사', elf: '요정', wizard: '마법사' };

/* ── 헬퍼 ── */
function fmt(n: number): string { return n.toLocaleString(); }
function isAtk(t: string): boolean { return t === 'weapon' || t === 'bow' || t === 'staff'; }

/* ═══════════════════════════════════════════
   공용 미니 컴포넌트
   ═══════════════════════════════════════════ */

/* 아이콘 닷 (원형, 색상) */
function Dot({ color }: { color: string }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
      background: color, border: '1px solid var(--border-soft)',
    }} />
  );
}

/* 보유 수량 */
function Owned({ n }: { n: number }) {
  return (
    <div style={{ textAlign: 'right', minWidth: 50, flexShrink: 0 }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9.5,
        color: 'var(--text-faint)', textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>보유</div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600,
        color: n > 0 ? 'var(--text)' : 'var(--text-faint)',
      }}>{fmt(n)}</div>
    </div>
  );
}

/* 단가 */
function Price({ v }: { v: number }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
      color: 'var(--accent)', textAlign: 'right', minWidth: 55, flexShrink: 0,
    }}>
      {fmt(v)}<span style={{ color: 'var(--text-mute)', fontSize: 11, marginLeft: 2, fontWeight: 400 }}>G</span>
    </div>
  );
}

/* 구매 팩 버튼 */
function PackBtn({ qty, cost, ok, onClick }: {
  qty: number; cost: number; ok: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={() => ok && onClick()}
      disabled={!ok}
      style={{
        minWidth: 58, padding: '5px 8px',
        background: ok ? 'var(--bg-elevated)' : 'var(--bg-sunken)',
        border: '1px solid var(--border-soft)',
        borderRadius: 5,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
        cursor: ok ? 'pointer' : 'not-allowed',
        opacity: ok ? 1 : 0.4,
        transition: 'all 0.1s',
      }}
    >
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
        color: ok ? 'var(--success)' : 'var(--text-mute)', lineHeight: 1.1,
      }}>+{qty}</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 9.5,
        color: 'var(--text-mute)', marginTop: 1,
      }}>{fmt(cost)}G</span>
    </button>
  );
}

/* 아이템 행 공통 wrapper */
const ROW: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14,
  padding: '12px 16px',
  borderBottom: '1px solid var(--border-soft)',
  transition: 'background 0.1s',
};

/* 아이템 목록 패널 wrapper */
const ITEMS_PANEL: React.CSSProperties = {
  border: '1px solid var(--border-soft)', borderRadius: 8,
  background: 'var(--bg-panel)', overflow: 'hidden',
};

/* ═══════════════════════════════════════════
   섹션별 콘텐츠
   ═══════════════════════════════════════════ */

/* ── 물약 ── */
function PotionSection({ gold, potions, buy, cls, mobile }: {
  gold: number; potions: Record<string, number>;
  buy: (id: string, q: number) => void; cls: PlayerClass;
  mobile?: boolean;
}) {
  return (
    <div style={ITEMS_PANEL}>
      {POTION_ORDER.map((id, i) => {
        const p = POTIONS[id];
        const owned = potions[id] ?? 0;
        const clr = POTION_CLR[id] ?? 'var(--text-mute)';
        const ok = !p.classRestriction || p.classRestriction.includes(cls);
        const last = i === POTION_ORDER.length - 1;

        /* ── 이름 라인 (공용) ── */
        const nameLine = (
          <div style={{
            fontSize: mobile ? 13 : 13.5, fontWeight: 600, color: clr,
            display: 'flex', alignItems: 'center', gap: mobile ? 4 : 6,
          }}>
            {p.name}
            {p.classRestriction && (
              <span style={{ fontSize: 10, opacity: 0.8 }}>
                {p.classRestriction.map(c => CLS_IC[c]).join('')}
              </span>
            )}
            {!ok && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9,
                padding: '1px 5px', borderRadius: 3,
                color: 'var(--danger)',
                background: 'color-mix(in oklch, var(--danger) 8%, transparent)',
                border: '1px solid color-mix(in oklch, var(--danger) 20%, transparent)',
              }}>사용 불가</span>
            )}
          </div>
        );

        /* ── 설명 라인 (공용) ── */
        const descLine = (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: mobile ? 10 : 10.5,
            color: 'var(--text-mute)', marginTop: mobile ? 1 : 2,
            overflow: mobile ? 'hidden' : undefined,
            textOverflow: mobile ? 'ellipsis' : undefined,
            whiteSpace: mobile ? 'nowrap' : undefined,
          }}>
            {p.buffDuration ? (
              <>
                {p.id === 'blue_potion' && 'MP 리젠 증가'}
                {p.atkSpeedMult && p.atkSpeedMult > 1 ? `공속 ×${p.atkSpeedMult}` : ''}
                {p.moveSpeedMult && p.moveSpeedMult > 1 ? ` 이속 ×${p.moveSpeedMult}` : ''}
                {p.spBonus ? `SP +${p.spBonus}` : ''}
                {` (${p.buffDuration >= 60 ? `${Math.floor(p.buffDuration / 60)}분` : `${p.buffDuration}초`})`}
              </>
            ) : (
              <>HP {p.healMin}~{p.healMax} 회복</>
            )}
          </div>
        );

        /* ── 구매 버튼 (공용) ── */
        const buyBtns = [1, 10, 50].map(q => (
          <PackBtn key={q} qty={q} cost={p.buyPrice * q}
            ok={gold >= p.buyPrice * q && ok}
            onClick={() => buy(id, q)} />
        ));

        /* ── 모바일: 2행 그리드 ── */
        if (mobile) {
          return (
            <div key={id} style={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr auto',
              gap: '4px 8px',
              padding: '10px 12px',
              borderBottom: last ? 'none' : '1px solid var(--border-soft)',
              alignItems: 'center',
              opacity: ok ? 1 : 0.45,
            }}>
              <div style={{ gridRow: '1 / 3', alignSelf: 'center' }}>
                <Dot color={clr} />
              </div>
              <div style={{ minWidth: 0 }}>{nameLine}{descLine}</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11.5,
                  fontWeight: 700, color: 'var(--accent)',
                }}>
                  {fmt(p.buyPrice)}<span style={{ color: 'var(--text-mute)', fontSize: 10, fontWeight: 400, marginLeft: 2 }}>G</span>
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9.5,
                  color: 'var(--text-mute)',
                }}>보유 {fmt(owned)}</div>
              </div>
              <div style={{
                gridColumn: '2 / 4',
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4,
              }}>{buyBtns}</div>
            </div>
          );
        }

        /* ── 데스크톱: 1행 플렉스 (기존) ── */
        return (
          <div key={id} style={{
            ...ROW, opacity: ok ? 1 : 0.45,
            borderBottom: last ? 'none' : ROW.borderBottom,
          }}>
            <Dot color={clr} />
            <div style={{ flex: 1, minWidth: 0 }}>{nameLine}{descLine}</div>
            <Owned n={owned} />
            <Price v={p.buyPrice} />
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>{buyBtns}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── 재료 ── */
function MaterialSection({ gold, mats, buy, mobile }: {
  gold: number; mats: Record<string, number>;
  buy: (id: string, qty: number, cost: number) => void;
  mobile?: boolean;
}) {
  const items = useMemo(() => SHOP_ETC_ITEMS.filter(i => i.category === 'material'), []);

  return (
    <div style={ITEMS_PANEL}>
      {items.map((it, i) => {
        const owned = mats[it.id] ?? 0;
        const pack = it.packSize ?? 1;
        const clr = MAT_CLR[it.id] ?? 'var(--text-mute)';
        const last = i === items.length - 1;

        const nameLine = (
          <div style={{ fontSize: mobile ? 13 : 13.5, fontWeight: 600, color: 'var(--text)' }}>
            {it.name}
          </div>
        );
        const descLine = (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: mobile ? 10 : 10.5,
            color: 'var(--text-mute)', marginTop: mobile ? 1 : 2,
          }}>
            {pack > 1 ? `${pack}개 ${fmt(it.buyPrice)}G` : `구매 ${fmt(it.buyPrice)}G`}
            {it.sellPrice > 0 && ` · 판매 ${fmt(it.sellPrice)}G`}
          </div>
        );
        const buyBtns = [1, 10, 50].map(m => {
          const q = pack * m;
          const c = it.buyPrice * m;
          return (
            <PackBtn key={m} qty={q} cost={c}
              ok={gold >= c}
              onClick={() => buy(it.id, q, c)} />
          );
        });

        if (mobile) {
          return (
            <div key={it.id} style={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr auto',
              gap: '4px 8px',
              padding: '10px 12px',
              borderBottom: last ? 'none' : '1px solid var(--border-soft)',
              alignItems: 'center',
            }}>
              <div style={{ gridRow: '1 / 3', alignSelf: 'center' }}>
                <Dot color={clr} />
              </div>
              <div style={{ minWidth: 0 }}>{nameLine}{descLine}</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11.5,
                  fontWeight: 700, color: 'var(--accent)',
                }}>
                  {fmt(it.buyPrice)}<span style={{ color: 'var(--text-mute)', fontSize: 10, fontWeight: 400, marginLeft: 2 }}>G</span>
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9.5,
                  color: 'var(--text-mute)',
                }}>보유 {fmt(owned)}</div>
              </div>
              <div style={{
                gridColumn: '2 / 4',
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4,
              }}>{buyBtns}</div>
            </div>
          );
        }

        return (
          <div key={it.id} style={{
            ...ROW, borderBottom: last ? 'none' : ROW.borderBottom,
          }}>
            <Dot color={clr} />
            <div style={{ flex: 1, minWidth: 0 }}>{nameLine}{descLine}</div>
            <Owned n={owned} />
            <Price v={it.buyPrice} />
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>{buyBtns}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── 주문서 ── */
function ScrollSection({ gold, mats, buy, mobile }: {
  gold: number; mats: Record<string, number>;
  buy: (id: string, qty: number, cost: number) => void;
  mobile?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: mobile ? 10 : 14 }}>
      {SCROLL_GROUPS.map(g => (
        <div key={g.label}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-mute)', textTransform: 'uppercase',
            letterSpacing: '0.08em', fontWeight: 600,
            marginBottom: mobile ? 6 : 8,
          }}>{g.label}</div>

          <div style={ITEMS_PANEL}>
            {g.ids.map((id, i) => {
              const si = SCROLL_ITEMS.find(s => s.id === id);
              if (!si) return null;
              const mat = MATERIALS[id];
              if (!mat) return null;
              const owned = mats[id] ?? 0;
              const clr = SCROLL_CLR[id] ?? '#9e9e9e';
              const glow = SCROLL_GLOW[id];
              const last = i === g.ids.length - 1;
              const nameClr = clr === '#9e9e9e' ? 'var(--text)' : clr;

              const buyBtns = [1, 10, 50].map(q => (
                <PackBtn key={q} qty={q} cost={si.price * q}
                  ok={gold >= si.price * q}
                  onClick={() => buy(id, q, si.price * q)} />
              ));

              if (mobile) {
                return (
                  <div key={id} style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 1fr auto',
                    gap: '4px 8px',
                    padding: '10px 12px',
                    borderBottom: last ? 'none' : '1px solid var(--border-soft)',
                    alignItems: 'center',
                  }}>
                    <div style={{ gridRow: '1 / 3', alignSelf: 'center' }}>
                      <Dot color={clr} />
                    </div>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: nameClr, textShadow: glow,
                      minWidth: 0, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{mat.name}</div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: 11.5,
                        fontWeight: 700, color: 'var(--accent)',
                      }}>
                        {fmt(si.price)}<span style={{ color: 'var(--text-mute)', fontSize: 10, fontWeight: 400, marginLeft: 2 }}>G</span>
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9.5,
                        color: 'var(--text-mute)',
                      }}>보유 {fmt(owned)}</div>
                    </div>
                    <div style={{
                      gridColumn: '2 / 4',
                      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4,
                    }}>{buyBtns}</div>
                  </div>
                );
              }

              return (
                <div key={id} style={{
                  ...ROW, borderBottom: last ? 'none' : ROW.borderBottom,
                }}>
                  <Dot color={clr} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13.5, fontWeight: 600,
                      color: nameClr, textShadow: glow,
                    }}>{mat.name}</div>
                  </div>
                  <Owned n={owned} />
                  <Price v={si.price} />
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>{buyBtns}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── 장비 ── */
function EquipSection({ tab, gold, inv, cap, cls, onConfirm }: {
  tab: ShopTab; gold: number;
  inv: { uid: string }[]; cap: number;
  cls: PlayerClass;
  onConfirm: (t: EquipmentTemplate) => void;
}) {
  const all = useMemo(() => Object.values(EQUIPMENT_TEMPLATES), []);
  const full = inv.length >= cap;
  const groups = tab === 'weapon' ? WPN_GROUPS : tab === 'armor' ? ARM_GROUPS : ACC_GROUPS;
  const [sub, setSub] = useState(groups[0].type);
  const active = groups.find(g => g.type === sub) ?? groups[0];

  const items = useMemo(
    () => all
      .filter(t => t.type === active.type)
      .sort((a, b) => {
        const ae = canClassEquip(cls, a.type, a.classRestriction) ? 0 : 1;
        const be = canClassEquip(cls, b.type, b.classRestriction) ? 0 : 1;
        if (ae !== be) return ae - be;
        return a.sellPrice - b.sellPrice;
      }),
    [all, active.type, cls],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 부위 서브탭 */}
      {groups.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {groups.map(g => {
            const on = active.type === g.type;
            const cnt = all.filter(t => t.type === g.type).length;
            return (
              <button key={g.type} onClick={() => setSub(g.type)} style={{
                padding: '5px 10px', borderRadius: 5,
                border: on ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                background: on ? 'color-mix(in oklch, var(--accent) 12%, transparent)' : 'transparent',
                color: on ? 'var(--accent)' : 'var(--text-mute)',
                fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-ui)',
                cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap',
              }}>
                {g.label}
                <span style={{ marginLeft: 3, fontSize: 10, opacity: 0.7 }}>{cnt}</span>
              </button>
            );
          })}
        </div>
      )}

      {full && (
        <div style={{
          padding: '10px 14px',
          background: 'color-mix(in oklch, var(--danger) 6%, transparent)',
          border: '1px solid color-mix(in oklch, var(--danger) 25%, transparent)',
          borderRadius: 8, fontSize: 12, fontWeight: 600,
          color: 'var(--danger)', textAlign: 'center',
        }}>인벤토리가 가득 찼습니다</div>
      )}

      {/* 아이템 목록 */}
      <div style={ITEMS_PANEL}>
        {items.length === 0 ? (
          <div style={{
            padding: 'var(--s-4)', textAlign: 'center',
            fontSize: 13, color: 'var(--text-mute)',
          }}>판매 중인 장비가 없습니다</div>
        ) : items.map((tmpl, i) => {
          const price = tmpl.sellPrice * 2;
          const canGold = gold >= price && !full;
          const eqOk = canClassEquip(cls, tmpl.type, tmpl.classRestriction);
          const buyable = canGold && eqOk;
          const last = i === items.length - 1;

          return (
            <div key={tmpl.id} style={{
              ...ROW, opacity: eqOk ? 1 : 0.5,
              borderBottom: last ? 'none' : ROW.borderBottom,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* 이름 + 태그 */}
                <div style={{
                  fontSize: 13.5, fontWeight: 600,
                  color: eqOk ? 'var(--text)' : 'var(--text-mute)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {tmpl.name}
                  {tmpl.isTwoHanded && (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9,
                      padding: '1px 5px', borderRadius: 3,
                      color: 'var(--accent)',
                      background: 'color-mix(in oklch, var(--accent) 8%, transparent)',
                    }}>양손</span>
                  )}
                </div>

                {/* 스탯 */}
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10.5,
                  color: 'var(--text-mute)', marginTop: 2,
                }}>
                  {isAtk(tmpl.type)
                    ? `타격 ${tmpl.baseAtk}/${tmpl.baseAtkLarge}`
                    : `AC ${tmpl.baseDef}`}
                </div>

                {/* 클래스 제한 */}
                {tmpl.classRestriction && (
                  <div style={{ display: 'flex', gap: 3, marginTop: 3, fontSize: 10 }}>
                    {tmpl.classRestriction.map(c => {
                      const me = c === cls;
                      return (
                        <span key={c} style={{
                          padding: '0 4px', borderRadius: 3, lineHeight: '16px',
                          background: me
                            ? 'color-mix(in oklch, var(--accent) 15%, transparent)'
                            : 'color-mix(in oklch, var(--text-mute) 8%, transparent)',
                          color: me ? 'var(--accent)' : 'var(--text-mute)',
                          fontWeight: me ? 700 : 400,
                        }}>{CLS_IC[c]}{CLS_NM[c]}</span>
                      );
                    })}
                    {!tmpl.classRestriction.includes(cls) && (
                      <span style={{ color: 'var(--danger)', fontWeight: 600, lineHeight: '16px' }}>
                        착용불가
                      </span>
                    )}
                  </div>
                )}

                {/* 보너스 */}
                {tmpl.bonusEffects && tmpl.bonusEffects.length > 0 && (
                  <div style={{
                    display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap',
                    fontSize: 11, color: 'var(--info)', fontFamily: 'var(--font-mono)',
                  }}>
                    {tmpl.bonusEffects.map((e, j) => (
                      <span key={j}>{e.replace(' (미구현)', '')}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* 구매 버튼 */}
              <button
                onClick={() => buyable && onConfirm(tmpl)}
                disabled={!buyable}
                style={{
                  padding: '7px 14px', borderRadius: 5,
                  border: buyable ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                  background: buyable
                    ? 'color-mix(in oklch, var(--accent) 10%, transparent)'
                    : 'var(--bg-sunken)',
                  color: buyable ? 'var(--accent)' : 'var(--text-mute)',
                  fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  cursor: buyable ? 'pointer' : 'not-allowed',
                  opacity: buyable ? 1 : 0.5,
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >{fmt(price)}G</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 판매 ── */
function SellSection({ inv, sell }: {
  inv: Equipment[]; sell: (uid: string) => void;
}) {
  const totalValue = useMemo(
    () => inv.reduce((s, e) => s + e.sellPrice, 0), [inv],
  );

  if (inv.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: 'var(--s-6)',
        color: 'var(--text-mute)', fontSize: 13,
      }}>판매할 장비가 없습니다</div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 요약 배너 */}
      <div style={{
        padding: '14px 16px',
        background: 'color-mix(in oklch, var(--success) 4%, transparent)',
        border: '1px solid color-mix(in oklch, var(--success) 20%, transparent)',
        borderRadius: 8,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>
            인벤토리 현황
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--text-mute)', marginTop: 2,
          }}>장비 {inv.length}개 · 개별 판매</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-mute)',
          }}>총 가치</div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 18,
            fontWeight: 700, color: 'var(--success)',
          }}>{fmt(totalValue)} G</div>
        </div>
      </div>

      {/* 개별 판매 목록 */}
      <div style={ITEMS_PANEL}>
        {inv.map((eq, i) => {
          const last = i === inv.length - 1;
          return (
            <div key={eq.uid} style={{
              ...ROW, borderBottom: last ? 'none' : ROW.borderBottom,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13.5, fontWeight: 600, color: 'var(--text)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{equipDisplayName(eq)}</div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10.5,
                  color: 'var(--text-mute)', marginTop: 2,
                }}>
                  {isAtk(eq.type)
                    ? `타격 ${eq.baseAtk}/${eq.baseAtkLarge}${eq.enhanceLevel > 0 ? ` (+${eq.enhanceLevel})` : ''}`
                    : `AC ${eq.baseDef}+${eq.enhanceLevel}`}
                </div>
                {eq.bonusEffects.length > 0 && (
                  <div style={{
                    display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap',
                    fontSize: 11, color: 'var(--info)', fontFamily: 'var(--font-mono)',
                  }}>
                    {eq.bonusEffects.map((e, j) => (
                      <span key={j}>{e.replace(' (미구현)', '')}</span>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => sell(eq.uid)} style={{
                padding: '6px 12px', borderRadius: 5,
                border: '1px solid color-mix(in oklch, var(--success) 40%, transparent)',
                background: 'color-mix(in oklch, var(--success) 8%, transparent)',
                color: 'var(--success)', fontSize: 12, fontWeight: 700,
                fontFamily: 'var(--font-mono)', cursor: 'pointer',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>{fmt(eq.sellPrice)}G 판매</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 구매 확인 다이얼로그 ── */
function ConfirmDlg({ tmpl, cls, onOk, onNo }: {
  tmpl: EquipmentTemplate; cls: PlayerClass;
  onOk: () => void; onNo: () => void;
}) {
  return (
    <div onClick={onNo} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-panel)', border: '1px solid var(--border-soft)',
        borderRadius: 8, padding: 'var(--s-5)',
        minWidth: 260, maxWidth: 340,
        display: 'flex', flexDirection: 'column', gap: 'var(--s-3)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>
          구매 확인
        </div>

        <div style={{
          background: 'var(--bg-sunken)', border: '1px solid var(--border-soft)',
          borderRadius: 6, padding: 'var(--s-3)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{tmpl.name}</div>
          <div style={{
            fontSize: 12, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)',
          }}>
            {isAtk(tmpl.type)
              ? `타격 ${tmpl.baseAtk}/${tmpl.baseAtkLarge}`
              : `AC ${tmpl.baseDef}`}
            {tmpl.isTwoHanded && ' (양손)'}
          </div>
          {tmpl.classRestriction && (
            <div style={{ display: 'flex', gap: 3, fontSize: 10, marginTop: 2 }}>
              {tmpl.classRestriction.map(c => {
                const me = c === cls;
                return (
                  <span key={c} style={{
                    padding: '0 4px', borderRadius: 3, lineHeight: '16px',
                    background: me
                      ? 'color-mix(in oklch, var(--accent) 15%, transparent)'
                      : 'color-mix(in oklch, var(--text-mute) 8%, transparent)',
                    color: me ? 'var(--accent)' : 'var(--text-mute)',
                    fontWeight: me ? 700 : 400,
                  }}>{CLS_IC[c]}{CLS_NM[c]}</span>
                );
              })}
            </div>
          )}
        </div>

        <div style={{
          textAlign: 'center', fontSize: 16, fontWeight: 700,
          color: 'var(--accent)', fontFamily: 'var(--font-mono)',
        }}>{fmt(tmpl.sellPrice * 2)} Gold</div>

        <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
          <button onClick={onNo} style={{
            flex: 1, padding: '8px 0', border: '1px solid var(--border-soft)',
            borderRadius: 5, background: 'transparent',
            color: 'var(--text-mute)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>취소</button>
          <button onClick={onOk} style={{
            flex: 1, padding: '8px 0', border: 'none', borderRadius: 5,
            background: 'linear-gradient(135deg, var(--accent), oklch(0.65 0.2 260))',
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>구매</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   메인 컴포넌트
   ═══════════════════════════════════════════ */
export default function ShopPanel() {
  const [tab, setTab] = useState<FullTab>('potion');
  const [confirm, setConfirm] = useState<EquipmentTemplate | null>(null);
  const mobile = useMobile();

  /* store */
  const gold             = useGameStore(s => s.gold);
  const potions          = useGameStore(s => s.potions);
  const buyPotion        = useGameStore(s => s.buyPotion);
  const playerClass      = useGameStore(s => s.playerClass);
  const inventory        = useGameStore(s => s.inventory);
  const inventoryCapacity = useGameStore(s => s.inventoryCapacity);
  const materials        = useGameStore(s => s.materials);
  const sellFromInventory = useGameStore(s => s.sellFromInventory);
  const buyMaterial      = useGameStore(s => s.buyMaterial);
  const buyEquip         = useGameStore(s => s.buyEquipFromShop);

  const doConfirmBuy = () => {
    if (confirm) { buyEquip(confirm.id); setConfirm(null); }
  };

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      padding: mobile ? '0 0 12px' : '18px 22px 32px',
      overflow: 'hidden',
    }}>
      {/* ── 잔액 (모바일: 카드형 / 데스크톱: 브레드크럼 내) ── */}
      {mobile ? (
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          padding: '10px 12px',
          marginBottom: 10,
          background: 'color-mix(in oklch, var(--accent) 5%, transparent)',
          border: '1px solid color-mix(in oklch, var(--accent) 15%, transparent)',
          borderRadius: 8, flexShrink: 0,
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-mute)', textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>잔액</span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 700,
            color: 'var(--accent)',
          }}>
            {fmt(gold)}<span style={{ color: 'var(--text-mute)', fontSize: 12, fontWeight: 400, marginLeft: 3 }}>G</span>
          </span>
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          paddingBottom: 12, marginBottom: 14,
          borderBottom: '1px solid var(--border-soft)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>상점</span>
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--accent)',
            display: 'inline-flex', alignItems: 'baseline', gap: 6,
          }}>
            <span style={{
              fontSize: 10, color: 'var(--text-mute)',
              textTransform: 'uppercase', letterSpacing: '0.12em', marginRight: 4,
            }}>잔액</span>
            <span style={{ fontWeight: 700 }}>{fmt(gold)}</span>
            <span style={{ color: 'var(--text-mute)', fontSize: 12 }}>G</span>
          </span>
        </div>
      )}

      {/* ── 카테고리 탭 ── */}
      <div style={{
        display: 'flex',
        gap: mobile ? 6 : 0,
        marginBottom: mobile ? 10 : 18,
        flexShrink: 0,
        borderBottom: mobile ? 'none' : '1px solid var(--border-soft)',
        overflowX: mobile ? 'auto' : undefined,
        paddingBottom: mobile ? 6 : 0,
        scrollbarWidth: 'none',
      }}>
        {CATS.map(c => {
          const on = tab === c.id;
          return mobile ? (
            <button key={c.id} onClick={() => setTab(c.id)} style={{
              padding: '6px 12px', flexShrink: 0,
              borderRadius: 16, whiteSpace: 'nowrap',
              border: on ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
              background: on ? 'color-mix(in oklch, var(--accent) 12%, transparent)' : 'transparent',
              color: on ? 'var(--accent)' : 'var(--text-mute)',
              fontSize: 12, fontWeight: on ? 600 : 500,
              cursor: 'pointer', transition: 'all 0.12s',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ fontSize: 12, opacity: 0.7 }}>{c.ic}</span>
              {c.nm}
            </button>
          ) : (
            <button key={c.id} onClick={() => setTab(c.id)} style={{
              flex: 1, padding: '12px 6px', textAlign: 'center',
              color: on ? 'var(--accent)' : 'var(--text-mute)',
              fontSize: 13, fontWeight: on ? 600 : 500,
              background: 'none', border: 'none',
              borderBottom: `2px solid ${on ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'color 0.12s, border-color 0.12s', whiteSpace: 'nowrap',
            }}>
              <span style={{ fontSize: 14, opacity: 0.7 }}>{c.ic}</span>
              {c.nm}
            </button>
          );
        })}

        {/* 판매 (녹색) */}
        {mobile ? (
          <button onClick={() => setTab('sell')} style={{
            padding: '6px 12px', flexShrink: 0,
            borderRadius: 16, whiteSpace: 'nowrap',
            border: tab === 'sell' ? '1px solid var(--success)' : '1px solid var(--border-soft)',
            background: tab === 'sell' ? 'color-mix(in oklch, var(--success) 12%, transparent)' : 'transparent',
            color: 'var(--success)',
            opacity: tab === 'sell' ? 1 : 0.6,
            fontSize: 12, fontWeight: tab === 'sell' ? 600 : 500,
            cursor: 'pointer', transition: 'all 0.12s',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>$</span>
            판매
          </button>
        ) : (
          <button onClick={() => setTab('sell')} style={{
            flex: 1, padding: '12px 6px', textAlign: 'center',
            color: 'var(--success)',
            opacity: tab === 'sell' ? 1 : 0.6,
            fontSize: 13, fontWeight: tab === 'sell' ? 600 : 500,
            background: 'none', border: 'none',
            borderBottom: `2px solid ${tab === 'sell' ? 'var(--success)' : 'transparent'}`,
            marginBottom: -1, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'color 0.12s, border-color 0.12s, opacity 0.12s', whiteSpace: 'nowrap',
          }}>
            <span style={{ fontSize: 14, opacity: 0.7 }}>$</span>
            판매
          </button>
        )}
      </div>

      {/* ── 콘텐츠 ── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {tab === 'potion' && (
          <PotionSection gold={gold} potions={potions} buy={buyPotion} cls={playerClass} mobile={mobile} />
        )}
        {tab === 'material' && (
          <MaterialSection gold={gold} mats={materials} buy={buyMaterial} mobile={mobile} />
        )}
        {tab === 'scroll' && (
          <ScrollSection gold={gold} mats={materials} buy={buyMaterial} mobile={mobile} />
        )}
        {(tab === 'weapon' || tab === 'armor' || tab === 'accessory') && (
          <EquipSection key={tab} tab={tab} gold={gold}
            inv={inventory} cap={inventoryCapacity}
            cls={playerClass} onConfirm={setConfirm} />
        )}
        {tab === 'sell' && (
          <SellSection inv={inventory} sell={sellFromInventory} />
        )}
      </div>

      {/* ── 장비 구매 확인 ── */}
      {confirm && (
        <ConfirmDlg tmpl={confirm} cls={playerClass}
          onOk={doConfirmBuy} onNo={() => setConfirm(null)} />
      )}
    </div>
  );
}
