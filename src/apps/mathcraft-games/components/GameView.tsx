
// Import Assets
import bossManifest from '../assets/boss/assets.json';
import mobManifest from '../assets/mobs/assets.json';

// Game Logic
import type { EquipmentCategory, EquipmentItem } from '../game/equipment';
import { EQUIPMENT_CATEGORIES, EQUIPMENT_DISPLAY_CATEGORIES, computeDisplayStats } from '../game/equipment';
import type { GameState } from '../game/rules';

// Game Components
import { HealthHearts } from './HealthHearts';
import { PlaceholderArt } from './PlaceholderArt';


interface GameViewProps {
  gameState: GameState;
  onEquip: (category: EquipmentCategory) => void;
}

const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  'melee': 'Weapon',
  'bow': 'Range',
  'armor': 'Armor',
};

const ASSET_FOLDERS: Record<EquipmentCategory, 'weapons' | 'armor-sets'> = {
  'melee': 'weapons',
  'bow': 'weapons',
  'armor': 'armor-sets',
};

function assetUrl(folder: 'weapons' | 'armor-sets' | 'mobs' | 'boss', filename: string): string {
  return new URL(`../assets/${folder}/${filename}`, import.meta.url).href;
}

function assetForItem(item: EquipmentItem | null): string | null {
  if (item === null) {
    return null;
  }
  const folder = ASSET_FOLDERS[item.category];
  return assetUrl(folder, item.filename);
}

function heroAssetUrl(equippedArmor: EquipmentItem | null): string {
  if (equippedArmor) {
    return assetUrl('armor-sets', equippedArmor.filename);
  }
  return assetUrl('armor-sets', '289px-Steve_in_leather_armor.png');
}

function regularEnemyAssetUrl(encounter: Extract<GameState['encounter'], { kind: 'regular' }>): string {
  const index = Math.min(
    (mobManifest as Array<{ filename: string }>).length - 1,
    Math.max(0, Math.ceil(encounter.enemy.maxHealth / 2) - 1),
  );
  return assetUrl('mobs', (mobManifest as Array<{ filename: string }>)[index].filename);
}

function bossAssetUrl(encounter: Extract<GameState['encounter'], { kind: 'boss' }>): string {
  const index = Math.min(
    (bossManifest as Array<{ filename: string }>).length - 1,
    Math.max(0, encounter.activeHeartIndex),
  );
  return assetUrl('boss', (bossManifest as Array<{ filename: string }>)[index].filename);
}

export function GameView({ gameState, onEquip }: GameViewProps) {
  const { hero, encounter, solvedCount, pendingReward, loadout } = gameState;
  const stats = computeDisplayStats(loadout, solvedCount);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {EQUIPMENT_DISPLAY_CATEGORIES.map((category) => {
          const item = loadout[category];
          const imgSrc = assetForItem(item);
          return (
            <div key={category} className="flex min-h-20 w-28 flex-col items-center gap-1 rounded-lg border border-panel-border bg-panel p-2 text-center text-xs">
              <span className="text-neutral-400">{CATEGORY_LABELS[category]}</span>
              {imgSrc ? (
                <img src={imgSrc} alt={item?.name ?? CATEGORY_LABELS[category]} className="h-12 w-12 object-contain" />
              ) : (
                <span className="text-neutral-200">—</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
        <div className="flex flex-col items-end gap-2 text-right text-sm">
          <Stat label="Attack" value={stats.damage} />
          <Stat label="Defence" value={stats.defense} />
          <Stat label="Level" value={stats.level} />
          <span className="text-xs text-neutral-500">Solved: {solvedCount}</span>
        </div>
        <div className="flex min-w-0 justify-center gap-3">
          <HeroPanel hero={hero} equippedArmor={loadout.armor} />
          <EncounterPanel encounter={encounter} />
        </div>
      </div>

      {pendingReward !== null && (
        <div role="group" aria-label="Choose a reward" className="flex flex-col gap-2 rounded-lg border border-panel-border bg-panel p-3">
          <h3 className="text-sm font-semibold text-neutral-200">Choose a reward</h3>
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT_CATEGORIES.map((category) => {
              const item = pendingReward[category];
              if (item === null) {
                return null;
              }
              const asset = assetForItem(item);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => onEquip(category)}
                  className="flex items-center gap-2 rounded-lg border border-panel-border bg-bg px-3 py-1.5 text-sm hover:bg-bg/70"
                >
                  {asset ? <img src={asset} alt={item.name} className="h-12 w-12 object-contain" /> : null}
                  <span>{item.name} ({CATEGORY_LABELS[category]})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex flex-col leading-tight text-neutral-400">
      {label}
      <span className="font-mono text-xl text-neutral-200">{value}</span>
    </span>
  );
}

function HeroPanel({ hero, equippedArmor }: { hero: GameState['hero']; equippedArmor: EquipmentItem | null }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <HealthHearts current={hero.health} max={hero.maxHealth} label="Hero health" />
      <PlaceholderArt name="Hero" src={heroAssetUrl(equippedArmor)} alt="Hero" />
    </div>
  );
}

function EncounterPanel({ encounter }: { encounter: GameState['encounter'] }) {
  if (encounter.kind === 'none') {
    return null;
  }

  if (encounter.kind === 'regular') {
    return (
      <div className="flex flex-col items-center gap-2">
        <HealthHearts current={encounter.enemy.health} max={encounter.enemy.maxHealth} label="Enemy health" />
        <PlaceholderArt name="Enemy" src={regularEnemyAssetUrl(encounter)} alt="Enemy" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-col items-center gap-1">
        <HealthHearts
          current={encounter.hearts[encounter.activeHeartIndex]?.health ?? 0}
          max={encounter.hearts[encounter.activeHeartIndex]?.maxHealth ?? 1}
          label="Boss heart"
        />
        <span className="text-xs text-neutral-400">
          Heart {encounter.activeHeartIndex + 1} of {encounter.hearts.length} · {encounter.queuedProblems} queued
        </span>
      </div>
      <PlaceholderArt name="Boss" src={bossAssetUrl(encounter)} alt="Boss" />
    </div>
  );
}
