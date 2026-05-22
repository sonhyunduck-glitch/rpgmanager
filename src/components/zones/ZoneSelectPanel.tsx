/* =========================================================
   ZONE SELECT PANEL — 사냥터 선택 (20 스테이지)
   ========================================================= */
import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { HUNT_ZONES } from '../../data/gameData';
import { meleeHit, finalAC, acToEvasion } from '../../data/statFormulas';
import { PANEL_FULL } from '../../styles/shared';
import ZonePreview from './ZonePreview';
import ZoneList from './ZoneList';

export default function ZoneSelectPanel() {
  const level = useGameStore(s => s.level);
  const weapon = useGameStore(s => s.equippedWeapon);
  const getTotalDefense = useGameStore(s => s.getTotalDefense);
  const startHunt = useGameStore(s => s.startHunt);
  const setViewMode = useGameStore(s => s.setViewMode);
  const huntZoneId = useGameStore(s => s.hunt.zoneId);
  const materials = useGameStore(s => s.materials);
  const getStr = useGameStore(s => s.getStr);
  const getDex = useGameStore(s => s.getDex);

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(huntZoneId);
  const selectedZone = HUNT_ZONES.find(z => z.id === selectedZoneId) ?? null;

  const str = getStr();
  const dex = getDex();
  const weaponEnchant = weapon?.enhanceLevel ?? 0;
  const playerHit = meleeHit(level, weaponEnchant, str);
  const totalDefense = getTotalDefense();
  const playerAC = finalAC(totalDefense, level, dex);
  const playerEvasion = acToEvasion(playerAC);

  const setMaterials = useGameStore(s => s.setMaterials);

  const handleMove = () => {
    if (!selectedZone) return;

    // 던전 2층 이상: 주문서 1장 소모
    if (selectedZone.zoneType === 'dungeon' && selectedZone.floor && selectedZone.floor > 1) {
      const scrollId = `scroll_${selectedZone.id}`;
      const scrollCount = materials[scrollId] ?? 0;
      if (scrollCount < 1) return;
      setMaterials({ ...materials, [scrollId]: scrollCount - 1 });
    }

    startHunt(selectedZone.id);
    setViewMode('main');
  };

  return (
    <div style={{
      display: 'flex',
      gap: 'var(--s-3)',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Left: Zone list */}
      <div style={{
        ...PANEL_FULL,
        flex: 1,
        minWidth: 0,
      }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--fs-md)', marginBottom: 'var(--s-2)' }}>
          사냥터 선택
        </div>
        <ZoneList
          zones={HUNT_ZONES}
          level={level}
          playerHit={playerHit}
          selectedZoneId={selectedZoneId}
          huntZoneId={huntZoneId}
          onSelect={setSelectedZoneId}
          materials={materials}
        />
      </div>

      {/* Right: Zone preview */}
      <div style={{
        ...PANEL_FULL,
        width: 240,
        flexShrink: 0,
      }}>
        {selectedZone ? (
          <ZonePreview zone={selectedZone} level={level} playerHit={playerHit} playerEvasion={playerEvasion} onMove={handleMove} materials={materials} />
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-mute)',
            fontSize: 'var(--fs-sm)',
          }}>
            사냥터를 선택하세요
          </div>
        )}
      </div>
    </div>
  );
}
