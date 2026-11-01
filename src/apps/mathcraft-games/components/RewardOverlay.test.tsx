// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { EquipmentCategory, RewardOffer } from '../game/equipment';
import { RewardOverlay } from './RewardOverlay';

function makeReward(): RewardOffer {
  return {
    melee: { id: 'melee-sword', category: 'melee', name: 'Iron Sword', filename: 'sword.png', tier: 1, power: 2 },
    range: { id: 'range-bow', category: 'range', name: 'Oak Bow', filename: 'bow.png', tier: 1, power: 2 },
    armor: { id: 'armor-mail', category: 'armor', name: 'Iron Mail', filename: 'mail.png', tier: 1, power: 2 },
  };
}

describe('RewardOverlay (MRS-13)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders all three reward categories in the dialog', () => {
    render(<RewardOverlay reward={makeReward()} onEquip={() => undefined} onSkip={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'Choose a reward' })).not.toBeNull();
    expect(screen.getByText(/Iron Sword.*Weapon/)).not.toBeNull();
    expect(screen.getByText(/Oak Bow.*Range/)).not.toBeNull();
    expect(screen.getByText(/Iron Mail.*Armor/)).not.toBeNull();
  });

  it('invokes onEquip with the chosen category when a choice is selected', () => {
    const onEquip = vi.fn();
    render(<RewardOverlay reward={makeReward()} onEquip={onEquip} onSkip={() => undefined} />);

    fireEvent.click(screen.getByRole('button', { name: /Iron Sword/ }));
    expect(onEquip).toHaveBeenCalledWith('melee' satisfies EquipmentCategory);

    fireEvent.click(screen.getByRole('button', { name: /Oak Bow/ }));
    expect(onEquip).toHaveBeenCalledWith('range' satisfies EquipmentCategory);

    fireEvent.click(screen.getByRole('button', { name: /Iron Mail/ }));
    expect(onEquip).toHaveBeenCalledWith('armor' satisfies EquipmentCategory);
  });

  it('invokes onSkip when the accessible Skip reward control is activated', () => {
    const onSkip = vi.fn();
    render(<RewardOverlay reward={makeReward()} onEquip={() => undefined} onSkip={onSkip} />);

    fireEvent.click(screen.getByRole('button', { name: 'Skip reward' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('focuses the dialog container when it opens', () => {
    render(<RewardOverlay reward={makeReward()} onEquip={() => undefined} onSkip={() => undefined} />);

    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Choose a reward' }));
  });

  it('contains forward and reverse Tab navigation within the dialog', () => {
    render(<RewardOverlay reward={makeReward()} onEquip={() => undefined} onSkip={() => undefined} />);
    const dialog = screen.getByRole('dialog', { name: 'Choose a reward' });
    const firstReward = screen.getByRole('button', { name: /Iron Sword/ });
    const skip = screen.getByRole('button', { name: 'Skip reward' });

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(skip);

    fireEvent.keyDown(firstReward, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(skip);

    fireEvent.keyDown(skip, { key: 'Tab' });
    expect(document.activeElement).toBe(firstReward);
  });

  it('restores focus to the previously focused element when the dialog unmounts', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const { unmount } = render(<RewardOverlay reward={makeReward()} onEquip={() => undefined} onSkip={() => undefined} />);

    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
