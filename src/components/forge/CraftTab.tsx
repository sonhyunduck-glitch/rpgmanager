import { useGameStore } from '../../store/gameStore';
import {
  MATERIALS, EQUIPMENT_TEMPLATES, RECIPES,
} from '../../data/gameData';
import { BTN_SUCCESS, BTN_DISABLED, SCROLL_AREA } from '../../styles/shared';

export default function CraftTab() {
  const gold = useGameStore(s => s.gold);
  const level = useGameStore(s => s.level);
  const materials = useGameStore(s => s.materials);
  const inventory = useGameStore(s => s.inventory);
  const inventoryCapacity = useGameStore(s => s.inventoryCapacity);
  const tryCraft = useGameStore(s => s.tryCraft);

  return (
    <div style={SCROLL_AREA}>
      {RECIPES.map(recipe => {
        const template = EQUIPMENT_TEMPLATES[recipe.resultTemplateId];
        if (!template) return null;

        const hasLevel = level >= recipe.requiredLevel;
        const hasGold = gold >= recipe.goldCost;
        const hasSpace = inventory.length < inventoryCapacity;

        const matChecks = recipe.materials.map(req => {
          const owned = materials[req.materialId] ?? 0;
          const mat = MATERIALS[req.materialId];
          return {
            name: mat?.name ?? req.materialId,
            owned,
            needed: req.quantity,
            enough: owned >= req.quantity,
          };
        });

        const allMats = matChecks.every(m => m.enough);
        const canCraft = hasLevel && hasGold && allMats && hasSpace;

        return (
          <div
            key={recipe.id}
            style={{
              background: 'var(--bg-sunken)',
              border: canCraft
                ? `1px solid var(--success)`
                : '1px solid var(--border-soft)',
              borderRadius: 'var(--r-sm)',
              padding: 'var(--s-3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--s-2)',
              opacity: canCraft ? 1 : 0.7,
              transition: 'border-color var(--dur)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 'var(--fs-base)' }}>
                {template.name}
              </span>
            </div>

            {/* Stats */}
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {template.type === 'weapon' ? `타격 ${template.baseAtk}/${template.baseAtkLarge}` : `AC ${template.baseDef}`}
              {template.bonusEffects && template.bonusEffects.length > 0 && (
                <span style={{ color: 'var(--info)', marginLeft: 'var(--s-2)' }}>
                  {template.bonusEffects.join(', ')}
                </span>
              )}
            </div>

            {/* Materials */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {matChecks.map(m => (
                <div key={m.name} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                }}>
                  <span style={{ color: 'var(--text-dim)' }}>{m.name}</span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    color: m.enough ? 'var(--text)' : 'var(--danger)',
                  }}>
                    {m.owned}/{m.needed}
                  </span>
                </div>
              ))}
            </div>

            {/* Gold + level req */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: hasGold ? 'var(--accent)' : 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
                {recipe.goldCost.toLocaleString()} G
              </span>
              <span style={{ color: hasLevel ? 'var(--text-mute)' : 'var(--danger)' }}>
                Lv.{recipe.requiredLevel} 이상
              </span>
            </div>

            {/* Craft button */}
            <button
              style={canCraft ? BTN_SUCCESS : { ...BTN_SUCCESS, opacity: 0.4, cursor: 'not-allowed' }}
              disabled={!canCraft}
              onClick={() => tryCraft(recipe.id)}
            >
              제작
            </button>
          </div>
        );
      })}
    </div>
  );
}
