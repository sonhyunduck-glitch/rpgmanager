import { useGameStore, equipStat, equipDisplayName, type QueueItem } from '../../store/gameStore';
import { LABEL, STAT_VALUE, BTN_SM } from '../../styles/shared';

function QueueItemCard({ item }: { item: QueueItem }) {
  const processQueueItem = useGameStore((s) => s.processQueueItem);
  const color = 'var(--text)';
  const stat = equipStat(item.item);
  const displayName = equipDisplayName(item.item);
  const statLabel = item.item.type === 'weapon' ? 'ATK' : 'DEF';

  const diffValue = item.statDiff;
  const diffColor = diffValue > 0 ? 'var(--success)' : diffValue < 0 ? 'var(--danger)' : 'var(--text-mute)';
  const diffText = diffValue > 0 ? `+${diffValue}` : diffValue.toString();

  return (
    <div
      style={{
        '--rar': color,
        background: 'var(--bg-panel)',
        border: `1px solid ${color}`,
        borderRadius: 'var(--r-md)',
        padding: 'var(--s-3)',
        boxShadow: `0 0 6px color-mix(in oklch, ${color} 20%, transparent)`,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-2)',
      } as React.CSSProperties}
    >
      {/* Item header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: 'var(--fs-base)',
            fontWeight: 600,
            color: color,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {displayName}
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
        <div>
          <span style={{ ...LABEL, fontSize: 'var(--fs-xs)' }}>{statLabel} </span>
          <span style={{ ...STAT_VALUE, fontSize: 'var(--fs-base)', color: 'var(--text)' }}>
            {stat}
          </span>
        </div>
        <div
          style={{
            ...STAT_VALUE,
            fontSize: 'var(--fs-base)',
            color: diffColor,
          }}
        >
          {diffText}
        </div>
        {item.priceIfSold > 0 && (
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ ...LABEL, fontSize: 'var(--fs-xs)' }}>Sell </span>
            <span style={{ ...STAT_VALUE, fontSize: 'var(--fs-sm)', color: 'var(--accent)' }}>
              {item.priceIfSold}G
            </span>
          </div>
        )}
      </div>

      {/* Recommendation */}
      {item.recommendation && (
        <div
          style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--text-mute)',
            fontStyle: 'italic',
          }}
        >
          {item.recommendation}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 'var(--s-2)', marginTop: 'var(--s-1)' }}>
        <button
          onClick={() => processQueueItem(item.id, 'equip')}
          style={{
            ...BTN_SM,
            flex: 1,
            background: 'linear-gradient(135deg, var(--success), color-mix(in oklch, var(--success) 80%, black))',
            color: 'white',
          }}
        >
          Equip
        </button>
        <button
          onClick={() => processQueueItem(item.id, 'sell')}
          style={{
            ...BTN_SM,
            flex: 1,
            background: 'linear-gradient(135deg, var(--danger), color-mix(in oklch, var(--danger) 80%, black))',
            color: 'white',
          }}
        >
          Sell
        </button>
        <button
          onClick={() => processQueueItem(item.id, 'keep')}
          style={{
            ...BTN_SM,
            background: 'transparent',
            border: '1px solid var(--border-soft)',
            color: 'var(--text-mute)',
          }}
        >
          Keep
        </button>
      </div>
    </div>
  );
}

export default function QueuePanel() {
  const queue = useGameStore((s) => s.queue);
  const queueCapacity = useGameStore((s) => s.queueCapacity);
  const bulkSellLow = useGameStore((s) => s.bulkSellLow);

  const isFull = queue.length >= queueCapacity;

  return (
    <div
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--s-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-3)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
          <span style={LABEL}>Decision Queue</span>
          <span
            style={{
              background: isFull
                ? 'var(--danger)'
                : 'color-mix(in oklch, var(--accent) 20%, transparent)',
              color: isFull ? 'white' : 'var(--accent)',
              fontSize: 'var(--fs-xs)',
              fontWeight: 700,
              padding: '1px 7px',
              borderRadius: 999,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {queue.length}/{queueCapacity}
          </span>
        </div>
        {queue.length > 1 && (
          <button
            onClick={bulkSellLow}
            style={{
              ...BTN_SM,
              height: 26,
              fontSize: 'var(--fs-xs)',
              background: 'transparent',
              border: '1px solid var(--border-soft)',
              color: 'var(--text-mute)',
            }}
          >
            일괄 처리
          </button>
        )}
      </div>

      {/* Queue full warning */}
      {isFull && (
        <div
          style={{
            background: 'color-mix(in oklch, var(--danger) 12%, transparent)',
            border: '1px solid color-mix(in oklch, var(--danger) 40%, transparent)',
            borderRadius: 'var(--r-sm)',
            padding: 'var(--s-2) var(--s-3)',
            fontSize: 'var(--fs-sm)',
            color: 'var(--danger)',
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          Queue full! Process items to continue hunting.
        </div>
      )}

      {/* Queue items */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--s-3)',
          overflowY: 'auto',
          flex: 1,
        }}
      >
        {queue.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-mute)',
              fontSize: 'var(--fs-sm)',
              fontStyle: 'italic',
              padding: 'var(--s-6)',
            }}
          >
            No items awaiting decision.
          </div>
        ) : (
          queue.map((queueItem) => (
            <QueueItemCard key={queueItem.id} item={queueItem} />
          ))
        )}
      </div>
    </div>
  );
}
