import { describe, expect, it } from 'vitest';
import {
  computeDisplayStats,
  EMPTY_LOADOUT,
  EQUIPMENT_CATALOG,
  generateRewardOffer,
  selectRewardItem,
} from './equipment';

describe('equipment: reward selection', () => {
  it('returns null when no item in the category is unlocked', () => {
    expect(selectRewardItem('hand-weapon', 4)).toBeNull();
    expect(selectRewardItem('armor', 0)).toBeNull();
  });

  it('selects the highest-power item whose tier is at or below the solved count', () => {
    expect(selectRewardItem('hand-weapon', 5)?.name).toBe('Wooden Sword');
    expect(selectRewardItem('hand-weapon', 9)?.name).toBe('Wooden Sword');
    expect(selectRewardItem('hand-weapon', 10)?.name).toBe('Iron Sword');
    expect(selectRewardItem('hand-weapon', 14)?.name).toBe('Iron Sword');
    expect(selectRewardItem('hand-weapon', 15)?.name).toBe('Diamond Sword');
    expect(selectRewardItem('hand-weapon', 20)?.name).toBe('Diamond Sword');
  });

  it('selects the highest-power item for each category at the tier boundaries', () => {
    const atFive = generateRewardOffer(5);
    expect(atFive['hand-weapon']?.name).toBe('Wooden Sword');
    expect(atFive.armor?.name).toBe('Leather Armor');
    expect(atFive.bow?.name).toBe('Wooden Bow');

    const atTen = generateRewardOffer(10);
    expect(atTen['hand-weapon']?.name).toBe('Iron Sword');
    expect(atTen.armor?.name).toBe('Chainmail');
    expect(atTen.bow?.name).toBe('Crossbow');

    const atFifteen = generateRewardOffer(15);
    expect(atFifteen['hand-weapon']?.name).toBe('Diamond Sword');
    expect(atFifteen.armor?.name).toBe('Diamond Armor');
    expect(atFifteen.bow?.name).toBe('Enchanted Bow');
  });

  it('offers one candidate per category', () => {
    const offer = generateRewardOffer(15);
    expect(offer['hand-weapon']).not.toBeNull();
    expect(offer.armor).not.toBeNull();
    expect(offer.bow).not.toBeNull();
  });
});

describe('equipment: display stats', () => {
  it('computes zero stats for an empty loadout', () => {
    expect(computeDisplayStats(EMPTY_LOADOUT, 10)).toEqual({ damage: 0, defense: 0, level: 0 });
  });

  it('averages hand-weapon and bow power for damage and uses armor for defense', () => {
    const loadout = {
      'hand-weapon': EQUIPMENT_CATALOG.find((item) => item.id === 'iron-sword')!,
      armor: EQUIPMENT_CATALOG.find((item) => item.id === 'chainmail')!,
      bow: EQUIPMENT_CATALOG.find((item) => item.id === 'crossbow')!,
    };
    // Iron Sword (7) + Crossbow (7) averaged = 7 damage; Chainmail (7) defense.
    expect(computeDisplayStats(loadout, 10)).toEqual({ damage: 7, defense: 7, level: 140 });
  });

  it('computes level as (damage + defense) x math level', () => {
    const loadout = {
      'hand-weapon': EQUIPMENT_CATALOG.find((item) => item.id === 'wooden-sword')!,
      armor: null,
      bow: null,
    };
    // Wooden Sword (3) + no bow (0) averaged = 1.5 damage; no armor = 0 defense.
    expect(computeDisplayStats(loadout, 4)).toEqual({ damage: 1.5, defense: 0, level: 6 });
  });
});
