// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MathcraftGamesApp } from './MathcraftGamesApp';
import type { UseMathcraftSessionResult } from './hooks/useMathcraftSession';

describe('MathcraftGamesApp active experience', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps the keypad and keyboard input available and confirms ending the session', () => {
    render(<MathcraftGamesApp />);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    expect(screen.getByRole('group', { name: 'Answer keypad' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Pause' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'End Session' })).not.toBeNull();

    fireEvent.keyDown(window, { key: '4' });
    expect(screen.getByText('4', { selector: '[aria-live="polite"]' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'End Session' }));
    expect(screen.getByRole('dialog', { name: 'End this session?' })).not.toBeNull();
    fireEvent.keyDown(window, { key: '8' });
    expect(screen.getByText('4', { selector: '[aria-live="polite"]' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'End this session?' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Answer keypad' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'End Session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm end session' }));

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
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeNull();
    expect(latestResult?.snapshot.gameState.encounter).toMatchObject({
      kind: 'regular',
      enemy: { problemId: firstEnemyId, health: 0 },
    });

    fireEvent.keyDown(window, { key: 'Enter' });

    await waitFor(() => {
      expect(latestResult?.snapshot.awaitingAdvance).toBe(false);
    });
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    const nextEncounter = latestResult?.snapshot.gameState.encounter;
    expect(nextEncounter?.kind).toBe('regular');
    if (nextEncounter?.kind === 'regular') {
      expect(nextEncounter.enemy.problemId).not.toBe(firstEnemyId);
    }
  });
});