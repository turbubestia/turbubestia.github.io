// Equipment and display progression for the game domain.
//
// These values are decorative: they must never influence combat outcomes,
// problem generation, or answer validation. The only rule that consumes them is
// reward selection (highest-power item in the unlocked tier per category).

import { REWARD_CADENCE } from './rules';
export type EquipmentCategory = 'hand-weapon' | 'armor' | 'bow';

export const EQUIPMENT_CATEGORIES: readonly EquipmentCategory[] = ['hand-weapon', 'armor', 'bow'];

export interface EquipmentItem {
  id: string;
  category: EquipmentCategory;
  name: string;
  /** Solved-problem count at which this item becomes eligible (tier). */
  tier: number;
  /** Displayed stat value (Atk for weapons/bow, Def for armor). Decorative. */
  power: number;
}

/**
 * Fixed catalog of equipment. Each category has one item per tier (5, 10, 15).
 * Power is the top of the documented display range so that higher tiers are
 * always strictly more powerful, keeping "highest-power" selection deterministic.
 */
export const EQUIPMENT_CATALOG: readonly EquipmentItem[] = [
  { id: 'wooden-sword', category: 'hand-weapon', name: 'Wooden Sword', tier: REWARD_CADENCE, power: 3 },
  { id: 'iron-sword', category: 'hand-weapon', name: 'Iron Sword', tier: REWARD_CADENCE*2, power: 7 },
  { id: 'diamond-sword', category: 'hand-weapon', name: 'Diamond Sword', tier: REWARD_CADENCE*3, power: 12 },
  { id: 'wooden-bow', category: 'bow', name: 'Wooden Bow', tier: REWARD_CADENCE, power: 3 },
  { id: 'crossbow', category: 'bow', name: 'Crossbow', tier: REWARD_CADENCE*2, power: 7 },
  { id: 'enchanted-bow', category: 'bow', name: 'Enchanted Bow', tier: REWARD_CADENCE*3, power: 12 },
  { id: 'leather-armor', category: 'armor', name: 'Leather Armor', tier: REWARD_CADENCE, power: 3 },
  { id: 'chainmail', category: 'armor', name: 'Chainmail', tier: REWARD_CADENCE*2, power: 7 },
  { id: 'diamond-armor', category: 'armor', name: 'Diamond Armor', tier: REWARD_CADENCE*3, power: 12 },
];

/**
 * Select the highest-power item in a category whose tier is at or below the
 * solved-problem count. Returns null when no item in the category is unlocked.
 */
export function selectRewardItem(category: EquipmentCategory, solvedCount: number): EquipmentItem | null {
  let best: EquipmentItem | null = null;
  for (const item of EQUIPMENT_CATALOG) {
    if (item.category !== category || item.tier > solvedCount) {
      continue;
    }
    if (best === null || item.power > best.power) {
      best = item;
    }
  }
  return best;
}

/** One candidate item per equipment category. */
export type RewardOffer = Record<EquipmentCategory, EquipmentItem | null>;

/** Build the reward offer (one candidate per category) for a solved-problem count. */
export function generateRewardOffer(solvedCount: number): RewardOffer {
  return {
    'hand-weapon': selectRewardItem('hand-weapon', solvedCount),
    armor: selectRewardItem('armor', solvedCount),
    bow: selectRewardItem('bow', solvedCount),
  };
}

/** The currently equipped item per category. */
export type EquipmentLoadout = Record<EquipmentCategory, EquipmentItem | null>;

export const EMPTY_LOADOUT: EquipmentLoadout = { 'hand-weapon': null, armor: null, bow: null };

export interface DisplayStats {
  /** Average of the equipped hand-weapon and bow power. */
  damage: number;
  /** Power of the equipped armor. */
  defense: number;
  /** (damage + defense) x math level, where math level is the solved-problem count. */
  level: number;
}

/**
 * Compute decorative display stats from a loadout and math level. These values
 * are presentation only and are never read by combat or progression rules.
 */
export function computeDisplayStats(loadout: EquipmentLoadout, mathLevel: number): DisplayStats {
  const weaponPower = loadout['hand-weapon']?.power ?? 0;
  const bowPower = loadout.bow?.power ?? 0;
  const armorPower = loadout.armor?.power ?? 0;
  const damage = (weaponPower + bowPower) / 2;
  const defense = armorPower;
  const level = (damage + defense) * mathLevel;
  return { damage, defense, level };
}
