import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { EquipmentCategory } from '../game/equipment';
import {
  createSession,
  WallClockTimeSource,
  type SessionCoordinator,
  type SessionOptions,
  type SessionSetup,
  type SessionSnapshot,
  type SessionTimeSource,
  type StartResult,
  type SubmitOutcome,
} from '../session/session';

/** The cadence at which the adapter advances the coordinator's time source. */
const TICK_INTERVAL_MS = 250;

export interface UseMathcraftSessionResult {
  /** The live coordinator instance (stable for the mounted component). */
  session: SessionCoordinator;
  /** The current observable snapshot; identity changes exactly when state changes. */
  snapshot: SessionSnapshot;
  start: () => StartResult;
  submitAnswer: (answer: number | string) => SubmitOutcome;
  /** Advance the session after the active problem has been solved. */
  advance: () => void;
  pause: () => void;
  resume: () => void;
  respawn: () => void;
  equip: (category: EquipmentCategory) => boolean;
  endSession: () => void;
  noteKeyInput: () => void;
  /**
   * Signal that the presentation layer has finished showing the combat outcome
   * for the current problem, enabling the "Next" control. The flag itself is
   * read from `snapshot.combatPresentationComplete`.
   */
  markCombatPresentationComplete: () => void;
}

/**
 * Bridges the framework-free {@link SessionCoordinator} to React. The
 * coordinator is created once per component mount and observed with
 * useSyncExternalStore, so the consumer re-renders exactly when observable
 * session state changes. A repeating interval advances the coordinator's time
 * source to the wall clock and calls `tick()`; both the interval and the
 * subscription are cleared on unmount.
 *
 * Actions are forwarded verbatim to the coordinator with their outcomes
 * unchanged; this hook re-derives no math, damage, or session rules.
 */
export function useMathcraftSession(setup: SessionSetup, options: SessionOptions = {}): UseMathcraftSessionResult {
  // Lazy init keeps the coordinator stable across renders without constructing
  // a throwaway instance each render. When no time source is injected, the
  // adapter owns a wall-clock source it advances from its interval; tests
  // inject a manual source instead and drive time deterministically.
  const [session] = useState(() => {
    const timeSource: SessionTimeSource = options.timeSource ?? new WallClockTimeSource();
    return createSession(setup, { ...options, timeSource });
  });

  const snapshot = useSyncExternalStore(
    (onChange) => session.subscribe(onChange),
    () => session.getSnapshot(),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      session.tick();
    }, TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [session]);

  const start = useCallback(() => session.start(), [session]);
  const submitAnswer = useCallback((answer: number | string) => session.submitAnswer(answer), [session]);
  const advance = useCallback(() => session.advance(), [session]);
  const pause = useCallback(() => session.pause(), [session]);
  const resume = useCallback(() => session.resume(), [session]);
  const respawn = useCallback(() => session.respawn(), [session]);
  const equip = useCallback((category: EquipmentCategory) => session.equip(category), [session]);
  const endSession = useCallback(() => session.endSession(), [session]);
  const noteKeyInput = useCallback(() => session.noteKeyInput(), [session]);
  const markCombatPresentationComplete = useCallback(() => session.markCombatPresentationComplete(), [session]);

  return {
    session,
    snapshot,
    start,
    submitAnswer,
    advance,
    pause,
    resume,
    respawn,
    equip,
    endSession,
    noteKeyInput,
    markCombatPresentationComplete,
  };
}
