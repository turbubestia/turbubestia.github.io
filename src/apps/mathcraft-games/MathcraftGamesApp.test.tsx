// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MathcraftGamesApp } from './MathcraftGamesApp';
import type { UseMathcraftSessionResult } from './hooks/useMathcraftSession';
import { ManualTimeSource } from './session/session';

describe('MathcraftGamesApp active experience', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps the keypad and keyboard input available and confirms ending the session', () => {
    render(<MathcraftGamesApp />);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    expect(screen.getByRole('group', { name: 'Answer keypad' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'PAUSE' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'END SESSION' })).not.toBeNull();

    fireEvent.keyDown(window, { key: '4' });
    expect(screen.getByText('4', { selector: '[aria-live="polite"]' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'END SESSION' }));
    expect(screen.getByRole('dialog', { name: 'End this session?' })).not.toBeNull();
    fireEvent.keyDown(window, { key: '8' });
    expect(screen.getByText('4', { selector: '[aria-live="polite"]' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }));
    expect(screen.queryByRole('dialog', { name: 'End this session?' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Answer keypad' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'END SESSION' }));
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRM END SESSION' }));

    expect(screen.getByText('Session complete')).not.toBeNull();
    expect(screen.queryByRole('group', { name: 'Answer keypad' })).toBeNull();
  });

  it('advances the solved problem when Enter is pressed on the physical keyboard', async () => {
    let latestResult: UseMathcraftSessionResult | undefined;
    let firstEnemyId: string | undefined;
    render(<MathcraftGamesApp onResult={(result) => { latestResult = result; }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    act(() => {
      const session = latestResult?.session;
      if (session === undefined) {
        throw new Error('Session did not start');
      }
      const encounter = session.gameState.encounter;
      if (encounter.kind !== 'regular') {
        throw new Error('Expected a regular encounter');
      }
      firstEnemyId = encounter.enemy.problemId;

      for (let step = 0; step < 10; step += 1) {
        const lifecycle = session.activeLifecycleState;
        if (lifecycle?.snapshot.stepIndex === null) {
          return;
        }
        const expected = lifecycle?.snapshot.expected;
        if (expected === null || expected === undefined) {
          throw new Error('Active problem has no expected step');
        }
        session.submitAnswer(expected);
      }
      throw new Error('Problem did not solve within 10 steps');
    });

    await waitFor(() => {
      expect(latestResult?.snapshot.combatPresentationComplete).toBe(true);
      expect(latestResult?.snapshot.awaitingAdvance).toBe(true);
    });
    expect(screen.getByRole('button', { name: 'NEXT' })).not.toBeNull();
    expect(latestResult?.snapshot.gameState.encounter).toMatchObject({
      kind: 'regular',
      enemy: { problemId: firstEnemyId, health: 0 },
    });

    fireEvent.keyDown(window, { key: 'Enter' });

    await waitFor(() => {
      expect(latestResult?.snapshot.awaitingAdvance).toBe(false);
    });
    expect(screen.queryByRole('button', { name: 'NEXT' })).toBeNull();
    const nextEncounter = latestResult?.snapshot.gameState.encounter;
    expect(nextEncounter?.kind).toBe('regular');
    if (nextEncounter?.kind === 'regular') {
      expect(nextEncounter.enemy.problemId).not.toBe(firstEnemyId);
    }
  });

  it('renders the RPG header bar with title, subtitle, and math level readout', () => {
    render(<MathcraftGamesApp />);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    expect(screen.getByText('MATHCRAFT GAMES')).not.toBeNull();
    expect(screen.getByText('Math combats in a blocky world')).not.toBeNull();
    expect(screen.getByText(/LVL \d+/)).not.toBeNull();
  });

  it('shows the reward overlay and blocks entry input while a reward is pending', async () => {
    const timeSource = new ManualTimeSource();
    let latestResult: UseMathcraftSessionResult | undefined;
    render(<MathcraftGamesApp sessionOptions={{ timeSource }} onResult={(result) => { latestResult = result; }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    // Solve the active problem, let the reward interval elapse, then advance so
    // the due reward is presented.
    act(() => {
      const session = latestResult?.session;
      if (session === undefined) {
        throw new Error('Session did not start');
      }
      for (let step = 0; step < 10; step += 1) {
        const lifecycle = session.activeLifecycleState;
        if (lifecycle?.snapshot.stepIndex === null) {
          break;
        }
        const expected = lifecycle?.snapshot.expected;
        if (expected === null || expected === undefined) {
          throw new Error('Active problem has no expected step');
        }
        session.submitAnswer(expected);
      }
      timeSource.advance(30_000);
      session.advance();
    });

    await waitFor(() => {
      expect(latestResult?.snapshot.gameState.pendingReward).not.toBeNull();
    });

    // The reward modal is shown (in place of the old inline panel).
    expect(screen.getByRole('dialog', { name: 'Choose a reward' })).not.toBeNull();

    // Entry input is blocked while the reward overlay is open.
    const digitButton = screen.getByRole('button', { name: '1' });
    expect((digitButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(window, { key: '5' });
    expect(screen.queryByText('5', { selector: '[aria-live="polite"]' })).toBeNull();

    // Selecting a reward equips it and closes the overlay.
    const reward = latestResult?.snapshot.gameState.pendingReward;
    expect(reward).not.toBeNull();
    const category = (['melee', 'range', 'armor'] as const).find((c) => reward?.[c] !== null);
    expect(category).not.toBeNull();
    const chosen = category === undefined ? null : reward?.[category] ?? null;
    expect(chosen).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(chosen!.name) }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Choose a reward' })).toBeNull();
    });
  });
});