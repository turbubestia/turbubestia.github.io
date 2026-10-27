import { describe, expect, it } from 'vitest';
import {
  computeDisplayStats,
  EMPTY_LOADOUT,
  EQUIPMENT_CATALOG,
  generateRewardOffer,
  selectRewardItem,
} from './equipment';

describe('equipment: reward selection', () => {
  it('uses the first item tier for early timed rewards', () => {
    expect(selectRewardItem('hand-weapon', 2)?.tier).toBe(1);
    expect(selectRewardItem('bow', 0)?.tier).toBe(1);
  });

  it('selects a random item from the matching tier bucket', () => {
    const tierOneWeapon = selectRewardItem('hand-weapon', 3, () => 0);
    expect(tierOneWeapon?.tier).toBe(1);
    expect(tierOneWeapon?.category).toBe('hand-weapon');

    const tierTwoBow = selectRewardItem('bow', 6, () => 0.99);
    expect(tierTwoBow?.tier).toBe(2);
    expect(tierTwoBow?.category).toBe('bow');
  });

  it('offers one candidate per category from the current tier bucket', () => {
    const offer = generateRewardOffer(3, () => 0);
    expect(offer['hand-weapon']?.tier).toBe(1);
    expect(offer.bow?.tier).toBe(1);
  });
});

describe('equipment: display stats', () => {
  it('computes zero stats for an empty loadout', () => {
    expect(computeDisplayStats(EMPTY_LOADOUT, 10)).toEqual({ damage: 0, defense: 0, level: 0 });
  });

  it('averages hand-weapon and bow power for damage and sets defense to zero', () => {
    const loadout = {
      'hand-weapon': EQUIPMENT_CATALOG.find((item) => item.id === 'iron-sword')!,
      bow: EQUIPMENT_CATALOG.find((item) => item.id === 'crossbow')!,
    };
    expect(computeDisplayStats(loadout, 10)).toEqual({ damage: 7, defense: 0, level: 70 });
  });

  it('computes level from weapon and bow damage only', () => {
    const loadout = {
      'hand-weapon': EQUIPMENT_CATALOG.find((item) => item.id === 'wooden-sword')!,
      bow: null,
    };
    expect(computeDisplayStats(loadout, 4)).toEqual({ damage: 1.5, defense: 0, level: 6 });
  });
});
