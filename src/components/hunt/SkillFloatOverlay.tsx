/* =========================================================
   스킬 발동 플로팅 텍스트 오버레이
   — 스킬 시전 시 화면 중앙에 스킬 이름을 띄움
   — CSS animation으로 GPU 가속 60fps 부드러운 상승+페이드
   ========================================================= */
import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';

/* ── CSS keyframes (한 번만 주입) ── */
const STYLE_ID = '__skill-float-css';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
@keyframes skillFloatUp {
  0%   { opacity: 1; transform: translateY(0); }
  70%  { opacity: 0.9; }
  100% { opacity: 0; transform: translateY(-50px); }
}`;
  document.head.appendChild(style);
}

const DURATION_MS = 1200;

interface SkillFloat {
  id: string;
  name: string;
}

export default function SkillFloatOverlay() {
  const combatLog = useGameStore(s => s.combatLog);
  const [floats, setFloats] = useState<SkillFloat[]>([]);
  const lastIdRef = useRef<string | null>(null);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (combatLog.length === 0) return;
    const latest = combatLog[combatLog.length - 1];
    if (latest.id === lastIdRef.current) return;
    lastIdRef.current = latest.id;

    const newSkills = combatLog.slice(-5).filter(
      e => e.type === 'skill',
    );
    if (newSkills.length === 0) return;

    // 이미 표시 중인 id 제외
    const fresh = newSkills.filter(e => !timersRef.current.has(e.id));
    if (fresh.length === 0) return;

    const newFloats = fresh.map(e => {
      const match = e.text.match(/^(.+?)!/);
      return { id: e.id, name: match ? match[1] : e.text.split(' ')[0] };
    });

    setFloats(prev => [...prev, ...newFloats].slice(-5));

    // animation 종료 후 자동 제거
    for (const f of newFloats) {
      const timer = setTimeout(() => {
        setFloats(prev => prev.filter(x => x.id !== f.id));
        timersRef.current.delete(f.id);
      }, DURATION_MS);
      timersRef.current.set(f.id, timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combatLog.length]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  if (floats.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '30%', left: '50%', transform: 'translateX(-50%)',
      zIndex: 20, pointerEvents: 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    }}>
      {floats.map((f) => (
        <div key={f.id} style={{
          fontSize: 18, fontWeight: 900,
          fontFamily: 'var(--font-display)',
          color: '#FFD54F',
          textShadow: '0 0 8px rgba(255,213,79,0.6), 0 0 4px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8)',
          whiteSpace: 'nowrap',
          letterSpacing: '1px',
          animation: `skillFloatUp ${DURATION_MS}ms ease-out forwards`,
          willChange: 'transform, opacity',
        }}>
          ✦ {f.name}
        </div>
      ))}
    </div>
  );
}
