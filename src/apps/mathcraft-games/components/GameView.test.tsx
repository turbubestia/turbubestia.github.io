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
    render(<GameView gameState={makeGameState()} onEquip={() => undefined} />);
    expect(screen.getByRole('img', { name: 'Hero health: 12 of 12' })).not.toBeNull();
    expect(screen.getByRole('img', { name: 'Enemy health: 3 of 3' })).not.toBeNull();
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
    expect(screen.getByRole('img', { name: 'Boss heart: 2 of 2' })).not.toBeNull();
    expect(screen.getByText('Heart 2 of 3 · 2 queued')).not.toBeNull();
  });

  it('renders the three equipment slots with a dash when empty', () => {
    render(<GameView gameState={makeGameState()} onEquip={() => undefined} />);
    expect(screen.getByText('Weapon')).not.toBeNull();
    expect(screen.getByText('Armor')).not.toBeNull();
    expect(screen.getByText('Bow')).not.toBeNull();
    // All three slots show the empty placeholder.
    const dashes = screen.getAllByText('—');
    expect(dashes).toHaveLength(3);
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

  it('offers one selectable reward per category and calls onEquip with that category', () => {
    const onEquip = vi.fn();
    const state = makeGameState({ solvedCount: 5, pendingReward: generateRewardOffer(5) });
    render(<GameView gameState={state} onEquip={onEquip} />);
    expect(screen.getByRole('group', { name: 'Choose a reward' })).not.toBeNull();

    const weapon = state.pendingReward?.['hand-weapon'];
    const armor = state.pendingReward?.armor;
    const bow = state.pendingReward?.bow;
    expect(weapon).not.toBeNull();
    expect(armor).not.toBeNull();
    expect(bow).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: `${weapon?.name} (Weapon)` }));
    expect(onEquip).toHaveBeenCalledWith('hand-weapon' satisfies EquipmentCategory);
    fireEvent.click(screen.getByRole('button', { name: `${armor?.name} (Armor)` }));
    expect(onEquip).toHaveBeenCalledWith('armor');
    fireEvent.click(screen.getByRole('button', { name: `${bow?.name} (Bow)` }));
    expect(onEquip).toHaveBeenCalledWith('bow');
  });

  it('does not render a separate Next control', () => {
    render(<GameView gameState={makeGameState()} onEquip={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });
});
