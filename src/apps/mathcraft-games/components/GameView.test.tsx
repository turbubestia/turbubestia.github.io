// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { EquipmentCategory } from '../game/equipment';
import { EMPTY_LOADOUT, generateRewardOffer } from '../game/equipment';
import type { GameState } from '../game/rules';
import { GameView } from './GameView';

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    hero: { health: 12, maxHealth: 12, defeated: false },
    encounter: { kind: 'regular', enemy: { problemId: 'reg-1', health: 3, maxHealth: 3 } },
    solvedCount: 0,
    pendingReward: null,
    loadout: { ...EMPTY_LOADOUT },
    ...overrides,
  };
}

describe('GameView (MGP6-03)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the hero and a regular enemy with their health', () => {
    const { container } = render(<GameView gameState={makeGameState()} onEquip={() => undefined} />);
    // Hero and enemy each render a single-heart row with an A/B counter.
    const counters = Array.from(container.querySelectorAll('[class*="min-w-[70px]"]'));
    expect(counters.map((c) => c.textContent)).toEqual(['12/12', '3/3']);
    expect(screen.getByRole('img', { name: 'Hero' }).getAttribute('src')).toContain('289px-Steve_in_leather_armor.png');
  });

  it('renders boss state with the active heart and queued problem count', () => {
    const state = makeGameState({
      encounter: {
        kind: 'boss',
        hearts: [
          { problemId: 'h1', health: 2, maxHealth: 2 },
          { problemId: 'h2', health: 2, maxHealth: 2 },
          { problemId: 'h3', health: 2, maxHealth: 2 },
        ],
        activeHeartIndex: 1,
        queuedProblems: 2,
      },
    });
    render(<GameView gameState={state} onEquip={() => undefined} />);
    // The active heart (index 1) drives the A/B counter and the HEART N sublabel.
    expect(screen.getByText('HEART 2')).not.toBeNull();
    expect(screen.getByText('2 queued')).not.toBeNull();
  });

  it('renders the melee and range inventory slots with a dash when empty', () => {
    render(<GameView gameState={makeGameState()} onEquip={() => undefined} />);
    // Armor is displayed on the hero, not as an inventory slot.
    expect(screen.getByText('Weapon')).not.toBeNull();
    expect(screen.getByText('Range')).not.toBeNull();
    expect(screen.queryByText('Armor')).toBeNull();
    // Both inventory slots show the empty placeholder.
    const dashes = screen.getAllByText('—');
    expect(dashes).toHaveLength(2);
  });

  it('renders decorative stats derived from the loadout and solved count', () => {
    const { container } = render(
      <GameView gameState={makeGameState({ solvedCount: 4 })} onEquip={() => undefined} />,
    );
    expect(container.textContent).toContain('Solved:');
    expect(container.textContent).toContain('Attack');
    expect(container.textContent).toContain('Defence');
    expect(container.textContent).toContain('Level');
  });

  it('does not render a reward group when no reward is pending', () => {
    render(<GameView gameState={makeGameState({ pendingReward: null })} onEquip={() => undefined} />);
    expect(screen.queryByRole('group', { name: 'Choose a reward' })).toBeNull();
  });

  it('offers one selectable reward per active category and calls onEquip with that category', () => {
    const onEquip = vi.fn();
    const state = makeGameState({ solvedCount: 5, pendingReward: generateRewardOffer(5) });
    render(<GameView gameState={state} onEquip={onEquip} />);
    expect(screen.getByRole('group', { name: 'Choose a reward' })).not.toBeNull();

    const weapon = state.pendingReward?.melee;
    const range = state.pendingReward?.range;
    expect(weapon).not.toBeNull();
    expect(range).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${weapon?.name}.*Weapon`) }));
    expect(onEquip).toHaveBeenCalledWith('melee' satisfies EquipmentCategory);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${range?.name}.*Range`) }));
    expect(onEquip).toHaveBeenCalledWith('range');
  });

  it('does not render a separate Next control', () => {
    render(<GameView gameState={makeGameState()} onEquip={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });
});
