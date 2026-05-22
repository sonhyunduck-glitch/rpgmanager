/* =========================================================
   CLICKABLE NAME — 클릭 시 프로필 모달을 여는 이름 컴포넌트
   ========================================================= */
import type React from 'react';
import { useGameStore } from '../../store/gameStore';

interface Props {
  userId: string;
  name: string;
  isMe?: boolean;
  style?: React.CSSProperties;
}

export function ClickableName({ userId, name, isMe, style }: Props) {
  const openProfile = useGameStore(s => s.openProfile);

  return (
    <span
      onClick={(e) => { e.stopPropagation(); openProfile(userId); }}
      style={{
        ...style,
        color: isMe ? 'var(--accent)' : (style?.color ?? 'var(--text-dim)'),
        cursor: 'pointer',
        transition: 'opacity 0.1s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
      title={`${name} 프로필 보기`}
    >
      {name}
    </span>
  );
}
