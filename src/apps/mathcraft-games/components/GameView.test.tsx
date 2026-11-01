// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
    const { container } = render(<GameView gameState={makeGameState()} />);
    // Hero and enemy each render a single-heart row with an A/B counter.
    const counters = Array.from(container.querySelectorAll('[class*="min-w-17"]'));
    expect(counters.map((c) => c.textContent)).toEqual(['12/12', '3/3']);
    expect(screen.getByRole('img', { name: 'Hero' }).getAttribute('src')).toContain('289px-Steve_in_leather_armor.png');
  });

  it('keeps boss artwork fixed while the active heart label and health progress', () => {
    const hearts = [
      { problemId: 'h1', health: 2, maxHealth: 2 },
      { problemId: 'h2', health: 1, maxHealth: 3 },
      { problemId: 'h3', health: 3, maxHealth: 4 },
    ];
    const gameStateAtHeart = (activeHeartIndex: number) => makeGameState({
      encounter: { kind: 'boss', hearts, activeHeartIndex, queuedProblems: 3 - activeHeartIndex },
    });
    const { container, rerender } = render(<GameView gameState={gameStateAtHeart(0)} />);
    const bossImage = screen.getByRole('img', { name: 'Boss' });
    const firstHeartAsset = bossImage.getAttribute('src');

    expect(firstHeartAsset).toContain('Elder_Guardian_JE2_BE2.png');

    hearts.forEach((heart, activeHeartIndex) => {
      rerender(<GameView gameState={gameStateAtHeart(activeHeartIndex)} />);
      expect(screen.getByRole('img', { name: 'Boss' }).getAttribute('src')).toBe(firstHeartAsset);
      expect(screen.getByText(`HEART ${activeHeartIndex + 1}`)).not.toBeNull();
      const counters = Array.from(container.querySelectorAll('[class*="min-w-17"]'));
      expect(counters[1].textContent).toContain(`${heart.health}/${heart.maxHealth}`);
    });

    expect(screen.getByText('1 queued')).not.toBeNull();
    const counters = Array.from(container.querySelectorAll('[class*="min-w-17"]'));
    expect(counters.map((counter) => counter.textContent)).toEqual(['12/12', '3/4HEART 3']);
  });

  it('renders the melee and range inventory slots with a dash when empty', () => {
    render(<GameView gameState={makeGameState()} />);
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
      <GameView gameState={makeGameState({ solvedCount: 4 })} />,
    );
    expect(container.textContent).toContain('Solved:');
    expect(container.textContent).toContain('Attack');
    expect(container.textContent).toContain('Defence');
    expect(container.textContent).toContain('Hero Level');
  });

  it('does not render a reward group when no reward is pending', () => {
    render(<GameView gameState={makeGameState({ pendingReward: null })} />);
    expect(screen.queryByRole('group', { name: 'Choose a reward' })).toBeNull();
  });

  it('does not render an inline reward panel when a reward is pending (reward is the modal overlay)', () => {
    const state = makeGameState({ solvedCount: 5, pendingReward: generateRewardOffer(300_000, 150_000) });
    render(<GameView gameState={state} />);
    expect(screen.queryByRole('group', { name: 'Choose a reward' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Choose a reward' })).toBeNull();
  });

  it('does not render a separate Next control', () => {
    render(<GameView gameState={makeGameState()} />);
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });
});
