import { describe, expect, it } from 'vitest';
import {
  computeDisplayStats,
  EMPTY_LOADOUT,
  EQUIPMENT_CATALOG,
  EQUIPMENT_CATEGORIES,
  generateRewardOffer,
  selectRewardItem,
} from './equipment';

describe('equipment: categories', () => {
  it('includes melee, range, and armor', () => {
    expect(EQUIPMENT_CATEGORIES).toEqual(['melee', 'range', 'armor']);
  });

  it('loads armor entries from the manifest with correct type and value mapping', () => {
    const armorItems = EQUIPMENT_CATALOG.filter((item) => item.category === 'armor');
    expect(armorItems.length).toBeGreaterThan(0);
    // All armor items should have source: 'manifest'
    expect(armorItems.every((item) => item.source === 'manifest')).toBe(true);
    // Armor power (defense) should match the manifest value field
    const leatherArmor = armorItems.find((item) => item.name.includes('Leather'));
    expect(leatherArmor?.power).toBe(7);
    const diamondArmor = armorItems.find((item) => item.name.includes('Diamond'));
    expect(diamondArmor?.power).toBe(20);
  });
});

describe('equipment: reward selection', () => {
  it('uses the lowest available item tier before the first tier boundary', () => {
    const durationMs = 5 * 60_000;
    expect(selectRewardItem('melee', durationMs, 0).tier).toBe(1);
    expect(selectRewardItem('range', durationMs, 0).tier).toBe(1);
    expect(selectRewardItem('armor', durationMs, 0).tier).toBe(1);
  });

  it('selects a random item from the reached tier bucket', () => {
    const durationMs = 5 * 60_000;
    const firstTierTwoWeapon = selectRewardItem('melee', durationMs, 90_000, () => 0);
    const lastTierTwoWeapon = selectRewardItem('melee', durationMs, 90_000, () => 0.99);
    expect(firstTierTwoWeapon.tier).toBe(2);
    expect(firstTierTwoWeapon.category).toBe('melee');
    expect(lastTierTwoWeapon.tier).toBe(2);
    expect(lastTierTwoWeapon.id).not.toBe(firstTierTwoWeapon.id);

    const tierTwoRange = selectRewardItem('range', 120_000, 60_000, () => 0.99);
    expect(tierTwoRange.tier).toBe(2);
    expect(tierTwoRange.category).toBe('range');

    const tierOneArmor = selectRewardItem('armor', durationMs, 0, () => 0);
    expect(tierOneArmor.tier).toBe(1);
    expect(tierOneArmor.category).toBe('armor');
  });

  it('offers a valid item per category using each category maximum tier', () => {
    const offer = generateRewardOffer(120_000, 60_000, () => 0);
    expect(offer.melee).toMatchObject({ category: 'melee', tier: 3 });
    expect(offer.range).toMatchObject({ category: 'range', tier: 2 });
    expect(offer.armor).toMatchObject({ category: 'armor', tier: 4 });
  });
});

describe('equipment: display stats', () => {
  it('computes zero stats for an empty loadout', () => {
    expect(computeDisplayStats(EMPTY_LOADOUT, 10)).toEqual({ damage: 0, defense: 0, level: 0 });
  });

  it('averages melee and range power for damage and includes armor defense', () => {
    const loadout = {
      'melee': EQUIPMENT_CATALOG.find((item) => item.id === 'iron-sword')!,
      'range': EQUIPMENT_CATALOG.find((item) => item.id === 'crossbow')!,
      'armor': null,
    };
    expect(computeDisplayStats(loadout, 10)).toEqual({ damage: 7, defense: 0, level: 70 });
  });

  it('includes armor defense in the level calculation', () => {
    const loadout = {
      'melee': EQUIPMENT_CATALOG.find((item) => item.id === 'wooden-sword')!,
      'range': null,
      armor: EQUIPMENT_CATALOG.find((item) => item.name.includes('Leather'))!,
    };
    // damage = 1.5 (weapon only), defense = 7 (leather)
    // level = (1.5 + 7) * 4 = 34
    expect(computeDisplayStats(loadout, 4)).toEqual({ damage: 1.5, defense: 7, level: 34 });
  });

  it('computes level from (damage + defense) * mathLevel', () => {
    const loadout = {
      'melee': EQUIPMENT_CATALOG.find((item) => item.id === 'iron-sword')!,
      'range': EQUIPMENT_CATALOG.find((item) => item.id === 'crossbow')!,
      'armor': EQUIPMENT_CATALOG.find((item) => item.category === 'armor' && item.name.includes('Iron Armor'))!,
    };
    // damage = (7 + 7) / 2 = 7, defense = 15 (iron armor)
    // level = (7 + 15) * 10 = 220
    expect(computeDisplayStats(loadout, 10)).toEqual({ damage: 7, defense: 15, level: 220 });
  });
});
