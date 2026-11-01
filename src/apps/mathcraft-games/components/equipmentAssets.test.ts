import { describe, expect, it } from 'vitest';
import { EQUIPMENT_CATALOG } from '../game/equipment';
import { assetForItem, heroAssetUrl } from './equipmentAssets';

describe('equipment asset URLs', () => {
  it('resolves the Mace reward image from the weapons catalog', () => {
    const mace = EQUIPMENT_CATALOG.find((item) => item.name === 'Mace') ?? null;

    expect(assetForItem(mace)).toContain('Mace_JE1_BE1');
  });

  it('resolves an armor-typed item whose file is in the weapons folder', () => {
    const helmet = EQUIPMENT_CATALOG.find((item) => item.name === 'Netherite Helmet') ?? null;

    expect(assetForItem(helmet)).toContain('Netherite_Helmet_JE2_BE1');
  });

  it('resolves the default hero armor image', () => {
    expect(heroAssetUrl(null)).toContain('289px-Steve_in_leather_armor');
  });
});