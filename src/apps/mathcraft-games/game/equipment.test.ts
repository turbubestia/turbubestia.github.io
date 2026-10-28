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
  it('includes hand-weapon, bow, and armor', () => {
    expect(EQUIPMENT_CATEGORIES).toEqual(['hand-weapon', 'bow', 'armor']);
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
  it('uses the first item tier for early timed rewards', () => {
    expect(selectRewardItem('melee', 2)?.tier).toBe(1);
    expect(selectRewardItem('bow', 0)?.tier).toBe(1);
    expect(selectRewardItem('armor', 0)?.tier).toBe(1);
  });

  it('selects a random item from the matching tier bucket', () => {
    const tierOneWeapon = selectRewardItem('melee', 3, () => 0);
    expect(tierOneWeapon?.tier).toBe(1);
    expect(tierOneWeapon?.category).toBe('melee');

    const tierTwoBow = selectRewardItem('bow', 6, () => 0.99);
    expect(tierTwoBow?.tier).toBe(2);
    expect(tierTwoBow?.category).toBe('bow');

    const tierOneArmor = selectRewardItem('armor', 3, () => 0);
    expect(tierOneArmor?.tier).toBe(1);
    expect(tierOneArmor?.category).toBe('armor');
  });

  it('offers one candidate per category from the current tier bucket', () => {
    const offer = generateRewardOffer(3, () => 0);
    expect(offer['melee']?.tier).toBe(1);
    expect(offer['bow']?.tier).toBe(1);
    expect(offer['armor']?.tier).toBe(1);
  });
});

describe('equipment: display stats', () => {
  it('computes zero stats for an empty loadout', () => {
    expect(computeDisplayStats(EMPTY_LOADOUT, 10)).toEqual({ damage: 0, defense: 0, level: 0 });
  });

  it('averages hand-weapon and bow power for damage and includes armor defense', () => {
    const loadout = {
      'melee': EQUIPMENT_CATALOG.find((item) => item.id === 'iron-sword')!,
      'bow': EQUIPMENT_CATALOG.find((item) => item.id === 'crossbow')!,
      'armor': null,
    };
    expect(computeDisplayStats(loadout, 10)).toEqual({ damage: 7, defense: 0, level: 70 });
  });

  it('includes armor defense in the level calculation', () => {
    const loadout = {
      'melee': EQUIPMENT_CATALOG.find((item) => item.id === 'wooden-sword')!,
      'bow': null,
      armor: EQUIPMENT_CATALOG.find((item) => item.name.includes('Leather'))!,
    };
    // damage = 1.5 (weapon only), defense = 7 (leather)
    // level = (1.5 + 7) * 4 = 34
    expect(computeDisplayStats(loadout, 4)).toEqual({ damage: 1.5, defense: 7, level: 34 });
  });

  it('computes level from (damage + defense) * mathLevel', () => {
    const loadout = {
      'melee': EQUIPMENT_CATALOG.find((item) => item.id === 'iron-sword')!,
      'bow': EQUIPMENT_CATALOG.find((item) => item.id === 'crossbow')!,
      'armor': EQUIPMENT_CATALOG.find((item) => item.category === 'armor' && item.name.includes('Iron Armor'))!,
    };
    // damage = (7 + 7) / 2 = 7, defense = 15 (iron armor)
    // level = (7 + 15) * 10 = 220
    expect(computeDisplayStats(loadout, 10)).toEqual({ damage: 7, defense: 15, level: 220 });
  });
});
