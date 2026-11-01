// Equipment and display progression for the game domain.
//
// These values are decorative: they must never influence combat outcomes,
// problem generation, or answer validation. The only rule that consumes them is
// reward selection within the current tier bucket.

import armorManifest from '../assets/armor-sets/assets.json';
import weaponsManifest from '../assets/weapons/assets.json';
export type EquipmentCategory = 'melee' | 'range' | 'armor';

// This list all the equipment categories that are eligible for display in the reward offer panel.
export const EQUIPMENT_CATEGORIES: readonly EquipmentCategory[] = ['melee', 'range', 'armor'];

// This list only the equipment to display in the invetory panel. Armor is left out because
// is already displayed on the hero and does not need to be shown in the inventory panel.
export const EQUIPMENT_DISPLAY_CATEGORIES: readonly EquipmentCategory[] = ['melee', 'range'];

interface ManifestAssetEntry {
  name: string;
  filename: string;
  type: string;
  tier: number;
  value: number;
}

export interface EquipmentItem {
  id: string;
  category: EquipmentCategory;
  name: string;
  filename: string;
  /** Reward progression tier. */
  tier: number;
  /** Displayed stat value (Atk for weapons/bow, Def for armor). Decorative. */
  power: number;
  /** Internal source tag for compatibility with the legacy display IDs. */
  source?: 'manifest' | 'legacy';
}

function toAssetId(category: EquipmentCategory, name: string): string {
  return `${category}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.replace(/^-|-$/g, '');
}

function normalizeCategory(type: string): EquipmentCategory | null {
  switch (type) {
    case 'melee':
      return 'melee';
    case 'range':
      return 'range';
    case 'armor':
      return 'armor';
    default:
      return null;
  }
}

function fromManifestEntry(entry: ManifestAssetEntry, category: EquipmentCategory): EquipmentItem {
  return {
    id: toAssetId(category, entry.name),
    category,
    name: entry.name,
    filename: entry.filename,
    tier: entry.tier,
    power: entry.value,
    source: 'manifest',
  };
}

const manifestCatalog = [
  ...weaponsManifest.flatMap((entry: ManifestAssetEntry) => {
    const category = normalizeCategory(entry.type);
    if (category === null) {
      return [];
    }
    return [fromManifestEntry(entry, category)];
  }),
  ...armorManifest.flatMap((entry: ManifestAssetEntry) => {
    const category = normalizeCategory(entry.type);
    if (category === null) {
      return [];
    }
    return [fromManifestEntry(entry, category)];
  }),
];

export const EQUIPMENT_CATALOG: readonly EquipmentItem[] = [...manifestCatalog];

/**
 * Select a random item from the highest available tier reached by elapsed time.
 */
export function selectRewardItem(
  category: EquipmentCategory,
  durationMs: number,
  elapsedMs: number,
  randomFn: () => number = Math.random,
): EquipmentItem {
  const categoryItems = EQUIPMENT_CATALOG.filter(
    (item) => item.source !== 'legacy' && item.category === category,
  );
  if (categoryItems.length === 0) {
    throw new Error(`No equipment available for category "${category}".`);
  }

  const tiers = [...new Set(categoryItems.map((item) => item.tier))].sort((a, b) => a - b);
  const maxTier = tiers[tiers.length - 1];
  const minTier = tiers[0];
  if (maxTier === undefined || minTier === undefined) {
    throw new Error(`No equipment tiers available for category "${category}".`);
  }

  const elapsedFraction = Math.min(1, Math.max(0, elapsedMs / durationMs));
  const calculatedTier = Math.min(maxTier, Math.ceil(maxTier * elapsedFraction));
  const tier = [...tiers].reverse().find((availableTier) => availableTier <= calculatedTier) ?? minTier;
  const candidates = categoryItems.filter((item) => item.tier === tier);
  const index = Math.max(0, Math.min(candidates.length - 1, Math.floor(randomFn() * candidates.length)));
  const selected = candidates[index];
  if (selected === undefined) {
    throw new Error(`No equipment available at tier ${tier} for category "${category}".`);
  }
  return selected;
}

/** One candidate item per equipment category. */
export type RewardOffer = Record<EquipmentCategory, EquipmentItem | null>;
export type GeneratedRewardOffer = Record<EquipmentCategory, EquipmentItem>;

/** Build the reward offer (one candidate per category) for elapsed session time. */
export function generateRewardOffer(
  durationMs: number,
  elapsedMs: number,
  randomFn: () => number = Math.random,
): GeneratedRewardOffer {
  return {
    melee: selectRewardItem('melee', durationMs, elapsedMs, randomFn),
    range: selectRewardItem('range', durationMs, elapsedMs, randomFn),
    armor: selectRewardItem('armor', durationMs, elapsedMs, randomFn),
  };
}

/** The currently equipped item per category. */
export type EquipmentLoadout = Record<EquipmentCategory, EquipmentItem | null>;

export const EMPTY_LOADOUT: EquipmentLoadout = { melee: null, range: null, armor: null };

export interface DisplayStats {
  /** Average of the equipped melee and range power. */
  damage: number;
  /** Defense from the equipped armor set. */
  defense: number;
  /** Display level based on (damage + defense) * mathLevel. */
  level: number;
}

/**
 * Compute decorative display stats from a loadout and math level. These values
 * are presentation only and are never read by combat or progression rules.
 */
export function computeDisplayStats(loadout: EquipmentLoadout, mathLevel: number): DisplayStats {
  const weaponPower = loadout.melee?.power ?? 0;
  const rangePower = loadout.range?.power ?? 0;
  const armorPower = loadout.armor?.power ?? 0;
  const damage = (weaponPower + rangePower) / 2;
  const defense = armorPower;
  const level = (damage + defense) * mathLevel;
  return { damage, defense, level };
}
