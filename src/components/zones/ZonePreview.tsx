/* =========================================================
   ZONE PREVIEW — 사냥터 미리보기 (드롭 집계 + 몬스터 목록)
   ========================================================= */
import {
  MATERIALS, EQUIPMENT_TEMPLATES,
  type HuntZone,
} from '../../data/gameData';
import { getMonsterDrops } from '../../data/dropData';
import { calcHitRate } from '../../data/statFormulas';
import { LABEL, BTN_PRIMARY, BTN_DISABLED } from '../../styles/shared';

export default function ZonePreview({
  zone, playerHit, playerEvasion, playerLevel, onMove, materials,
}: {
  zone: HuntZone; playerHit: number; playerEvasion: number; playerLevel?: number; onMove: () => void; materials: Record<string, number>;
}) {
  // 훈련소 Lv.12 이후 경험치 제한
  const isTrainingCapped = zone.id === 'map_training' && (playerLevel ?? 0) >= 12;

  // 던전 2층 이상: 이동주문서 필요
  const needsScroll = zone.zoneType === 'dungeon' && zone.floor != null && zone.floor > 1;
  const scrollId = needsScroll ? `scroll_${zone.id}` : '';
  const scrollCount = needsScroll ? (materials[scrollId] ?? 0) : 0;
  const hasScroll = scrollCount > 0;
  const canMove = !needsScroll || hasScroll;

  const regulars = zone.monsters;
  const avgHitRate = regulars.reduce(
    (s, m) => s + calcHitRate(playerHit, m.level + m.ac), 0
  ) / Math.max(1, regulars.length);

  const avgMonsterHitRate = regulars.reduce(
    (s, m) => s + calcHitRate(m.level, playerEvasion), 0
  ) / Math.max(1, regulars.length);

  const avgGoldPerKill = regulars.reduce((s, m) => s + m.goldReward, 0) / Math.max(1, regulars.length);
  const estimatedGPM = Math.round(avgGoldPerKill * 15);

  return (
    <>
      {/* Zone name */}
      <div>
        <div style={{ color: 'var(--info)', fontWeight: 800, fontSize: 'var(--fs-base)' }}>
          {zone.name}
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-mute)', marginTop: 2 }}>
          Lv.{zone.levelRange[0]} ~ Lv.{zone.levelRange[1]}
        </div>
      </div>

      {/* Hit rates */}
      <div style={{
        display: 'flex',
        gap: 'var(--s-2)',
      }}>
        <div style={{
          flex: 1,
          padding: 'var(--s-2)',
          background: 'var(--bg-sunken)',
          borderRadius: 'var(--r-xs)',
          textAlign: 'center',
        }}>
          <div style={{ ...LABEL, fontSize: 'var(--fs-2xs)' }}>명중률</div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-base)',
            fontWeight: 700,
            color: avgHitRate >= 0.7 ? 'var(--success)' : avgHitRate >= 0.4 ? 'var(--warning)' : 'var(--danger)',
          }}>
            {Math.round(avgHitRate * 100)}%
          </div>
        </div>
        <div style={{
          flex: 1,
          padding: 'var(--s-2)',
          background: 'var(--bg-sunken)',
          borderRadius: 'var(--r-xs)',
          textAlign: 'center',
        }}>
          <div style={{ ...LABEL, fontSize: 'var(--fs-2xs)' }}>피격률</div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-base)',
            fontWeight: 700,
            color: avgMonsterHitRate <= 0.3 ? 'var(--success)' : avgMonsterHitRate <= 0.6 ? 'var(--warning)' : 'var(--danger)',
          }}>
            {Math.round(avgMonsterHitRate * 100)}%
          </div>
        </div>
      </div>

      {/* Monster list (scrollable) */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ ...LABEL, marginBottom: 'var(--s-1)' }}>몬스터 ({zone.monsters.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {zone.monsters.map(m => (
            <div key={m.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '2px var(--s-1)',
              background: 'transparent',
              borderRadius: 'var(--r-xs)',
              fontSize: 'var(--fs-xs)',
            }}>
              <span style={{
                color: 'var(--text-dim)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {m.name}
                {m.aggressive && (
                  <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--danger)', marginLeft: 3, fontWeight: 700 }}>
                    선공
                  </span>
                )}
                <span style={{
                  fontSize: 'var(--fs-2xs)',
                  color: m.attackType === 'magic' ? 'var(--info)' : 'var(--text-mute)',
                  marginLeft: 3,
                }}>
                  {m.attackType === 'magic' ? '마법' : '근접'}
                </span>
                <span style={{
                  fontSize: 'var(--fs-2xs)',
                  color: m.size === 'large' ? 'var(--warning)' : 'var(--text-mute)',
                  marginLeft: 2,
                }}>
                  {m.size === 'large' ? '대' : '소'}
                </span>
                <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-mute)', marginLeft: 2 }}>
                  Lv.{m.level}
                </span>
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', color: 'var(--text-mute)', flexShrink: 0 }}>
                {m.expReward}xp
              </span>
            </div>
          ))}
        </div>

        {/* Drops — 존 내 몬스터별 드롭 집계 */}
        {(() => {
          const matDrops = new Map<string, number>();
          const eqDrops = new Map<string, number>();
          for (const m of zone.monsters) {
            for (const [gameId, chance] of getMonsterDrops(m.id)) {
              if (gameId === '__GOLD__') continue; // 아데나는 드롭 프리뷰에서 제외
              if (MATERIALS[gameId]) {
                matDrops.set(gameId, Math.max(matDrops.get(gameId) ?? 0, chance));
              } else if (EQUIPMENT_TEMPLATES[gameId]) {
                eqDrops.set(gameId, Math.max(eqDrops.get(gameId) ?? 0, chance));
              }
            }
          }
          const hasMat = matDrops.size > 0;
          const hasEq = eqDrops.size > 0;
          if (!hasMat && !hasEq) return null;
          return (
            <>
              <div style={{ ...LABEL, marginTop: 'var(--s-2)', marginBottom: 'var(--s-1)' }}>드롭</div>
              {hasMat && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {[...matDrops.entries()].map(([id, rate]) => (
                    <span key={id} style={{
                      fontSize: 'var(--fs-xs)', padding: '1px 5px', borderRadius: 'var(--r-full)',
                      background: 'var(--bg-panel)', color: 'var(--text-dim)',
                      border: '1px solid var(--border-soft)',
                    }}>
                      {MATERIALS[id]?.name ?? id} {rate >= 0.01 ? `${Math.round(rate * 100)}%` : `${(rate * 100).toFixed(1)}%`}
                    </span>
                  ))}
                </div>
              )}
              {hasEq && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                  {[...eqDrops.entries()].map(([id, rate]) => {
                    const tmpl = EQUIPMENT_TEMPLATES[id];
                    if (!tmpl) return null;
                    return (
                      <span key={id} style={{
                        fontSize: 'var(--fs-xs)', padding: '1px 5px', borderRadius: 'var(--r-full)',
                        background: 'color-mix(in oklch, var(--accent) 15%, transparent)',
                        color: 'var(--accent)',
                        border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
                      }}>
                        {tmpl.name} {rate >= 0.01 ? `${(rate * 100).toFixed(0)}%` : `${(rate * 100).toFixed(1)}%`}
                      </span>
                    );
                  })}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Footer stats */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: 'var(--s-1) var(--s-2)',
        background: 'var(--bg-sunken)',
        borderRadius: 'var(--r-xs)',
        fontSize: 'var(--fs-xs)',
      }}>
        <span style={{ color: 'var(--text-mute)' }}>골드/분 ~{estimatedGPM}G</span>
        <span style={{ color: 'var(--text-mute)', fontFamily: 'var(--font-mono)' }}>
          몬스터 {zone.monsters.length}종
        </span>
      </div>

      {/* 훈련소 Lv.12 이후 경험치 제한 안내 */}
      {isTrainingCapped && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--s-2)',
          padding: 'var(--s-2)',
          background: 'color-mix(in oklch, var(--warning) 8%, var(--bg-sunken))',
          border: '1px solid color-mix(in oklch, var(--warning) 30%, var(--border-soft))',
          borderRadius: 'var(--r-xs)',
          fontSize: 'var(--fs-xs)',
          color: 'var(--warning)',
          fontWeight: 700,
        }}>
          ⚠ Lv.12 이상 — 경험치 획득 불가
        </div>
      )}

      {/* Scroll info for dungeon floors */}
      {needsScroll && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--s-2)',
          padding: 'var(--s-2)',
          background: hasScroll
            ? 'color-mix(in oklch, var(--accent) 8%, var(--bg-sunken))'
            : 'color-mix(in oklch, var(--danger) 6%, var(--bg-sunken))',
          border: `1px solid ${hasScroll ? 'color-mix(in oklch, var(--accent) 30%, var(--border-soft))' : 'color-mix(in oklch, var(--danger) 20%, var(--border-soft))'}`,
          borderRadius: 'var(--r-xs)',
          fontSize: 'var(--fs-xs)',
        }}>
          <span style={{ fontSize: 'var(--fs-sm)' }}>📜</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: hasScroll ? 'var(--accent)' : 'var(--danger)',
          }}>
            {scrollCount}장
          </span>
          <span style={{ color: 'var(--text-mute)', fontSize: 'var(--fs-xs)' }}>
            {hasScroll ? '이동주문서 사용' : '이동주문서 필요'}
          </span>
        </div>
      )}

      {/* Move button */}
      <button
        style={canMove ? BTN_PRIMARY : BTN_DISABLED}
        disabled={!canMove}
        onClick={onMove}
      >
        {needsScroll && hasScroll ? '📜 이동 (주문서 1장 소모)' : '이동'}
      </button>
    </>
  );
}
