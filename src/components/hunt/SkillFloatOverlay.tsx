/* =========================================================
   스킬 발동 플로팅 텍스트 오버레이
   — 스킬 시전 시 화면 중앙에 스킬 이름을 띄움
   — 1.2초간 표시 후 위로 올라가며 사라짐
   ========================================================= */
import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';

interface SkillFloat {
  id: string;
  name: string;
  createdAt: number;
}

export default function SkillFloatOverlay() {
  const combatLog = useGameStore(s => s.combatLog);
  const [floats, setFloats] = useState<SkillFloat[]>([]);
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (combatLog.length === 0) return;
    const latest = combatLog[combatLog.length - 1];
    if (latest.id === lastIdRef.current) return;
    lastIdRef.current = latest.id;

    const newSkills = combatLog.slice(-5).filter(
      e => e.type === 'skill' && !floats.some(f => f.id === e.id),
    );
    if (newSkills.length === 0) return;

    const now = Date.now();
    const newFloats = newSkills.map(e => {
      const match = e.text.match(/^(.+?)!/);
      return { id: e.id, name: match ? match[1] : e.text.split(' ')[0], createdAt: now };
    });
    setFloats(prev => [...prev, ...newFloats].slice(-5));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combatLog.length]);

  // 1.2초 후 자동 제거
  useEffect(() => {
    if (floats.length === 0) return;
    const timer = setInterval(() => {
      const cutoff = Date.now() - 1200;
      setFloats(prev => prev.filter(f => f.createdAt > cutoff));
    }, 200);
    return () => clearInterval(timer);
  }, [floats.length]);

  if (floats.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '30%', left: '50%', transform: 'translateX(-50%)',
      zIndex: 20, pointerEvents: 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    }}>
      {floats.map((f) => {
        const age = Date.now() - f.createdAt;
        const opacity = Math.max(0, 1 - age / 1200);
        const translateY = -(age / 1200) * 40;
        return (
          <div key={f.id} style={{
            fontSize: 18, fontWeight: 900,
            fontFamily: 'var(--font-display)',
            color: '#FFD54F',
            textShadow: '0 0 8px rgba(255,213,79,0.6), 0 0 4px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8)',
            opacity,
            transform: `translateY(${translateY}px)`,
            whiteSpace: 'nowrap',
            letterSpacing: '1px',
          }}>
            ✦ {f.name}
          </div>
        );
      })}
    </div>
  );
}
