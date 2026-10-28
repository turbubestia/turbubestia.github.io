import type { EquipmentCategory, RewardOffer } from '../game/equipment';
import { EQUIPMENT_CATEGORIES } from '../game/equipment';
import { assetForItem, CATEGORY_LABELS } from './equipmentAssets';

// Modal reward presentation (MRS-13). Dimmed backdrop + centered panel listing
// the available equipment choices; selecting one equips it and closes. Renders
// below app-level overlays (z-30 vs z-40/z-50) per MRS-14.

interface RewardOverlayProps {
  reward: RewardOffer;
  onEquip: (category: EquipmentCategory) => void;
}

export function RewardOverlay({ reward, onEquip }: RewardOverlayProps) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Choose a reward" className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
      <div className="rpg-box flex w-full max-w-md flex-col gap-4 p-6">
        <h2 className="text-center font-pixel text-sm text-rpg-text">Choose a reward</h2>
        <div className="flex flex-col gap-2">
          {EQUIPMENT_CATEGORIES.map((category) => {
            const item = reward[category];
            if (item === null) {
              return null;
            }
            const asset = assetForItem(item);
            return (
              <button
                key={category}
                type="button"
                onClick={() => onEquip(category)}
                className="rpg-slot flex items-center gap-3 px-4 py-2 text-left transition hover:border-rpg-border-light"
              >
                {asset ? <img src={asset} alt={item.name} className="h-12 w-12 object-contain" /> : null}
                <span className="text-lg text-rpg-text">{item.name} ({CATEGORY_LABELS[category]})</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
