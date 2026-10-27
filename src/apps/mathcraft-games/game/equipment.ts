// Equipment and display progression for the game domain.
//
// These values are decorative: they must never influence combat outcomes,
// problem generation, or answer validation. The only rule that consumes them is
// reward selection within the current tier bucket.

import weaponsManifest from '../assets/weapons/assets.json';
import { REWARD_CADENCE } from './rules';
export type EquipmentCategory = 'hand-weapon' | 'bow';

export const EQUIPMENT_CATEGORIES: readonly EquipmentCategory[] = ['hand-weapon', 'bow'];

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
  /** Solved-problem count at which this item becomes eligible (tier). */
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
    case 'mele':
      return 'hand-weapon';
    case 'range':
      return 'bow';
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
];

const legacyCompatibilityCatalog: readonly EquipmentItem[] = [
  { id: 'wooden-sword', category: 'hand-weapon', name: 'Wooden Sword', filename: 'Wooden_Axe_JE2_BE2.png', tier: 1, power: 3, source: 'legacy' },
  { id: 'iron-sword', category: 'hand-weapon', name: 'Iron Sword', filename: 'Iron_Sword_JE2_BE2.png', tier: 2, power: 7, source: 'legacy' },
  { id: 'diamond-sword', category: 'hand-weapon', name: 'Diamond Sword', filename: 'Diamond_Sword_JE3_BE3.png', tier: 3, power: 12, source: 'legacy' },
  { id: 'wooden-bow', category: 'bow', name: 'Wooden Bow', filename: 'Bow_JE2_BE1.png', tier: 1, power: 3, source: 'legacy' },
  { id: 'crossbow', category: 'bow', name: 'Crossbow', filename: 'Crossbow.png', tier: 2, power: 7, source: 'legacy' },
  { id: 'enchanted-bow', category: 'bow', name: 'Enchanted Bow', filename: 'Trident_(item)_JE2_BE1.png', tier: 3, power: 12, source: 'legacy' },
];

export const EQUIPMENT_CATALOG: readonly EquipmentItem[] = [...manifestCatalog, ...legacyCompatibilityCatalog];

function rewardTierFromSolvedCount(solvedCount: number): number {
  return Math.floor(solvedCount / REWARD_CADENCE);
}

/**
 * Select a random item from the category's current tier bucket.
 * A reward is available only once the tier counter has advanced beyond 0.
 */
export function selectRewardItem(
  category: EquipmentCategory,
  solvedCount: number,
  randomFn: () => number = Math.random,
): EquipmentItem | null {
  const tier = rewardTierFromSolvedCount(solvedCount);
  if (tier <= 0) {
    return null;
  }

  const candidates = EQUIPMENT_CATALOG.filter(
    (item) => item.source !== 'legacy' && item.category === category && item.tier === tier,
  );
  if (candidates.length === 0) {
    return null;
  }

  const index = Math.floor(randomFn() * candidates.length);
  return candidates[index] ?? null;
}

/** One candidate item per equipment category. */
export type RewardOffer = Record<EquipmentCategory, EquipmentItem | null>;

/** Build the reward offer (one candidate per category) for a solved-problem count. */
export function generateRewardOffer(solvedCount: number, randomFn: () => number = Math.random): RewardOffer {
  return {
    'hand-weapon': selectRewardItem('hand-weapon', solvedCount, randomFn),
    bow: selectRewardItem('bow', solvedCount, randomFn),
  };
}

/** The currently equipped item per category. */
export type EquipmentLoadout = Record<EquipmentCategory, EquipmentItem | null>;

export const EMPTY_LOADOUT: EquipmentLoadout = { 'hand-weapon': null, bow: null };

export interface DisplayStats {
  /** Average of the equipped hand-weapon and bow power. */
  damage: number;
  /** Armor is no longer used in the active equipment system. */
  defense: number;
  /** Display level based on the equipped weapon/bow power. */
  level: number;
}

/**
 * Compute decorative display stats from a loadout and math level. These values
 * are presentation only and are never read by combat or progression rules.
 */
export function computeDisplayStats(loadout: EquipmentLoadout, mathLevel: number): DisplayStats {
  const weaponPower = loadout['hand-weapon']?.power ?? 0;
  const bowPower = loadout.bow?.power ?? 0;
  const damage = (weaponPower + bowPower) / 2;
  const defense = 0;
  const level = damage * mathLevel;
  return { damage, defense, level };
}
