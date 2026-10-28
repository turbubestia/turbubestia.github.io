import bossManifest from '../assets/boss/assets.json';
import mobManifest from '../assets/mobs/assets.json';

import type { EquipmentCategory, EquipmentItem } from '../game/equipment';
import type { GameState } from '../game/rules';

// Shared asset resolution for the Mathcraft presentation layer. Kept separate
// from components so files can stay component-only (fast refresh).

const ASSET_FOLDERS: Record<EquipmentCategory, 'weapons' | 'armor-sets'> = {
  'melee': 'weapons',
  'range': 'weapons',
  'armor': 'armor-sets',
};

export const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  'melee': 'Weapon',
  'range': 'Range',
  'armor': 'Armor',
};

function assetUrl(folder: 'weapons' | 'armor-sets' | 'mobs' | 'boss', filename: string): string {
  return new URL(`../assets/${folder}/${filename}`, import.meta.url).href;
}

export function assetForItem(item: EquipmentItem | null): string | null {
  if (item === null) {
    return null;
  }
  const folder = ASSET_FOLDERS[item.category];
  return assetUrl(folder, item.filename);
}

export function heroAssetUrl(equippedArmor: EquipmentItem | null): string {
  if (equippedArmor) {
    return assetUrl('armor-sets', equippedArmor.filename);
  }
  return assetUrl('armor-sets', '289px-Steve_in_leather_armor.png');
}

export function regularEnemyAssetUrl(encounter: Extract<GameState['encounter'], { kind: 'regular' }>): string {
  const index = Math.min(
    (mobManifest as Array<{ filename: string }>).length - 1,
    Math.max(0, Math.ceil(encounter.enemy.maxHealth / 2) - 1),
  );
  return assetUrl('mobs', (mobManifest as Array<{ filename: string }>)[index].filename);
}

export function bossAssetUrl(encounter: Extract<GameState['encounter'], { kind: 'boss' }>): string {
  const index = Math.min(
    (bossManifest as Array<{ filename: string }>).length - 1,
    Math.max(0, encounter.activeHeartIndex),
  );
  return assetUrl('boss', (bossManifest as Array<{ filename: string }>)[index].filename);
}
