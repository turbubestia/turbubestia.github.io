// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, render } from '@testing-library/react';
import type { ProblemConfig, RandomSource } from '../math';
import { createSeededRandom } from '../math';
import { ManualTimeSource, type SessionSetup, type SessionTimeSource } from '../session/session';
import { useMathcraftSession, type UseMathcraftSessionResult } from './useMathcraftSession';

// Single-step problem config: every generated problem has exactly one step, so a
// correct answer solves it and a wrong answer is always wrong.
const addConfig: ProblemConfig = { operation: 'addition', leftDigits: 1, rightDigits: 1, maxResult: 20 };

const setup: SessionSetup = { durationMinutes: 5, enabledConfigs: [addConfig] };

/** A probe component that reports the hook result to the test on every render. */
function Probe({
  onResult,
  timeSource,
  random,
}: {
  onResult: (result: UseMathcraftSessionResult) => void;
  timeSource: SessionTimeSource;
  random: RandomSource;
}) {
  const result = useMathcraftSession(setup, { timeSource, random });
  React.useEffect(() => {
    onResult(result);
  });
  return null;
}

/** Render a probe with fresh injected sources; returns the render utils. */
function renderProbe(onResult: (result: UseMathcraftSessionResult) => void = () => undefined) {
  return render(
    <Probe onResult={onResult} timeSource={new ManualTimeSource()} random={createSeededRandom(7)} />,
  );
}

/** A local mutable holder so tests read the latest hook result after re-renders. */
function makeHolder() {
  return { current: null as UseMathcraftSessionResult | null };
}

describe('useMathcraftSession', () => {
  it('exposes the initial setup state on mount', () => {
    vi.useFakeTimers();
    try {
      const holder = makeHolder();
      renderProbe((result) => {
        holder.current = result;
      });
      expect(holder.current?.snapshot.state.kind).toBe('setup');
      expect(holder.current?.snapshot.isStartable).toBe(true);
      expect(holder.current?.snapshot.remainingTimeMs).toBe(5 * 60_000);
      expect(holder.current?.snapshot.isExpired).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('propagates state changes from forwarded actions to the consumer', () => {
    vi.useFakeTimers();
    try {
      const holder = makeHolder();
      const onResult = (result: UseMathcraftSessionResult) => {
        holder.current = result;
      };
      const { rerender } = renderProbe(onResult);

      act(() => {
        holder.current?.start();
      });
      expect(holder.current?.snapshot.state.kind).toBe('active');
      expect(holder.current?.snapshot.activeProblem).not.toBeNull();

      // Re-rendering the consumer observes the updated snapshot.
      rerender(<Probe onResult={onResult} timeSource={new ManualTimeSource()} random={createSeededRandom(7)} />);

      // A correct single-step answer solves the problem; the coordinator stops
      // at awaiting-advance (no auto-advance), so the same problem stays active.
      const solvedProblem = holder.current?.snapshot.activeProblem;
      const answer = solvedProblem?.result ?? 0;
      let outcome: { status: string } | undefined;
      act(() => {
        outcome = holder.current?.submitAnswer(answer);
      });
      expect(outcome).toEqual({ status: 'solved' });
      expect(holder.current?.snapshot.gameState.solvedCount).toBe(1);
      expect(holder.current?.snapshot.awaitingAdvance).toBe(true);
      expect(holder.current?.snapshot.activeProblem).toBe(solvedProblem);

      // The explicit advance action presents the next problem.
      act(() => {
        holder.current?.advance();
      });
      expect(holder.current?.snapshot.awaitingAdvance).toBe(false);
      expect(holder.current?.snapshot.activeProblem).not.toBe(solvedProblem);
    } finally {
      vi.useRealTimers();
    }
  });

  it('surfaces action outcomes unchanged', () => {
    vi.useFakeTimers();
    try {
      const holder = makeHolder();
      renderProbe((result) => {
        holder.current = result;
      });

      // submitAnswer outside an active problem is ignored.
      expect(holder.current?.submitAnswer(1)).toEqual({ status: 'ignored' });

      expect(holder.current?.start()).toEqual({ ok: true });
      // A second start attempt is refused with the coordinator's reason.
      expect(holder.current?.start()).toEqual({ ok: false, reason: 'already-started' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears its tick interval on unmount', () => {
    vi.useFakeTimers();
    try {
      const { unmount } = renderProbe();
      expect(vi.getTimerCount()).toBe(1);

      unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves exactly one live interval after a StrictMode double mount', () => {
    vi.useFakeTimers();
    try {
      const { unmount } = render(
        <React.StrictMode>
          <Probe onResult={() => undefined} timeSource={new ManualTimeSource()} random={createSeededRandom(7)} />
        </React.StrictMode>,
      );
      expect(vi.getTimerCount()).toBe(1);

      // The single remaining interval is cleared on unmount.
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
