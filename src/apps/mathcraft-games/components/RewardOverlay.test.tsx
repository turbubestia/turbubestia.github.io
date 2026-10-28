// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { EquipmentCategory, RewardOffer } from '../game/equipment';
import { RewardOverlay } from './RewardOverlay';

function makeReward(): RewardOffer {
  return {
    melee: { id: 'melee-sword', category: 'melee', name: 'Iron Sword', filename: 'sword.png', tier: 1, power: 2 },
    range: { id: 'range-bow', category: 'range', name: 'Oak Bow', filename: 'bow.png', tier: 1, power: 2 },
    armor: null,
  };
}

describe('RewardOverlay (MRS-13)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a dialog titled "Choose a reward" listing each non-null choice', () => {
    render(<RewardOverlay reward={makeReward()} onEquip={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'Choose a reward' })).not.toBeNull();
    expect(screen.getByText(/Iron Sword.*Weapon/)).not.toBeNull();
    expect(screen.getByText(/Oak Bow.*Range/)).not.toBeNull();
    // Null categories are not listed.
    expect(screen.queryByText(/Armor/)).toBeNull();
  });

  it('invokes onEquip with the chosen category when a choice is selected', () => {
    const onEquip = vi.fn();
    render(<RewardOverlay reward={makeReward()} onEquip={onEquip} />);

    fireEvent.click(screen.getByRole('button', { name: /Iron Sword/ }));
    expect(onEquip).toHaveBeenCalledWith('melee' satisfies EquipmentCategory);

    fireEvent.click(screen.getByRole('button', { name: /Oak Bow/ }));
    expect(onEquip).toHaveBeenCalledWith('range' satisfies EquipmentCategory);
  });
});
