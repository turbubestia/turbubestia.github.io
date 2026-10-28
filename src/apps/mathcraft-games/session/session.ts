// Session coordination layer for Mathcraft Games (Stage 4).
//
// This module sits above the math and game domains and owns all cross-domain
// sequencing and lifecycle: setup, active-time tracking, pause/idle behavior,
// deferred boss triggers, the queued boss problems, rewards during encounters,
// and summary assembly.
//
// Boundary rules (see .issues/math-games-stage-4-session-coordination.plan.analysis.md):
// - It drives the math and game domains only through their public APIs
//   (`generateProblem`, `presentProblem`, `GameRules`) and observes their emitted
//   events/state. It never re-implements damage routing, healing, reward selection,
//   answer validation, or problem generation.
// - All time-dependent behavior flows through an injected/controllable time source.
//   The coordinator never reads wall-clock time; tests advance time deterministically.
// - No persistence: setup choices exist only for the current page session.

import type { ArithmeticStepSnapshot, GeneratedProblem, ProblemConfig, RandomSource } from '../math';
import { generateProblem } from '../math';
import type { MathEvent, ProblemLifecycle, ProblemLifecycleState } from '../math/lifecycle';
import { presentProblem } from '../math/lifecycle';
import { GameRules, type BossHeartState, type GameState } from '../game/rules';
import type { BossHeartInit, BossStartMessage, BossEndMessage } from '../game/bossTypes';
import { EQUIPMENT_CATEGORIES, type EquipmentCategory } from '../game/equipment';

export const SESSION_DURATIONS_MINUTES = [2, 5, 10] as const;
export type SessionDurationMinutes = (typeof SESSION_DURATIONS_MINUTES)[number];

const MINUTE_MS = 60_000;
const REWARD_INTERVAL_MS = 30_000;
/** One minute without keyboard input pauses the session ("Still There"). */
const IDLE_LIMIT_MS = MINUTE_MS;
/** A boss becomes due at each five-minute active-time checkpoint. */
const BOSS_CHECKPOINT_MS = 5 * MINUTE_MS;
/** A due boss queues exactly three problems, one per heart. */
const BOSS_QUEUE_SIZE = 3;

function durationToMs(minutes: SessionDurationMinutes): number {
  return minutes * MINUTE_MS;
}

/** The setup choices for a session. Held only for the current page session. */
export interface SessionSetup {
  durationMinutes: SessionDurationMinutes;
  enabledConfigs: readonly ProblemConfig[];
}

/**
 * A controllable, monotonic time source expressed in milliseconds. The
 * coordinator reads `now()` to compute elapsed deltas; it never reads the
 * wall clock itself. Tests (and later the React adapter) advance this source
 * deterministically.
 */
export interface SessionTimeSource {
  now(): number;
}

/** A simple manual time source whose clock only moves when told to. */
export class ManualTimeSource implements SessionTimeSource {
  private currentMs = 0;

  now(): number {
    return this.currentMs;
  }

  advance(ms: number): void {
    if (ms > 0) {
      this.currentMs += ms;
    }
  }

  set(ms: number): void {
    this.currentMs = ms;
  }
}

/**
 * A time source backed by the wall clock. Used by adapters (e.g., the React
 * hook) that drive time from a real interval; tests inject ManualTimeSource
 * instead so the coordinator itself never reads wall-clock time.
 */
export class WallClockTimeSource implements SessionTimeSource {
  now(): number {
    return Date.now();
  }
}

/** The session state machine, modeled as an explicit discriminated union. */
export type SessionState =
  | { kind: 'setup' }
  | { kind: 'active' }
  | { kind: 'manual-paused' }
  | { kind: 'idle-paused'; expired: boolean; resumeTarget: 'active' | 'boss-fight' }
  | { kind: 'boss-fight' }
  | { kind: 'defeat'; returnTo: 'active' | 'boss-fight' }
  | { kind: 'summary' };

/** The outcome of a start attempt. */
export type StartResult =
  | { ok: true }
  | { ok: false; reason: 'no-problems-enabled' | 'already-started' };

/** The submission status surfaced to the caller (mirrors the math lifecycle). */
export type SubmitStatus = 'accepted' | 'wrong' | 'invalid' | 'solved' | 'ignored';

export interface SubmitOutcome {
  status: SubmitStatus;
}

/** The metrics reported when a session ends (MGP4-05). */
export interface SessionSummary {
  questionsAttempted: number;
  questionsCompleted: number;
  stepAttempts: number;
  acceptedSteps: number;
  /** Accepted steps divided by total step attempts; 0 when no steps were attempted. */
  stepAccuracy: number;
  totalDamageDealt: number;
  totalActiveTimeMs: number;
  bossesDefeated: number;
  equipmentEarned: number;
}

export interface SessionOptions {
  /** Injectable time source so tests control active time, idle, and checkpoints. */
  timeSource?: SessionTimeSource;
  /** Injectable random source so problem generation is deterministic in tests. */
  random?: RandomSource;
}

/**
 * The observable session snapshot exposed to adapters (e.g., React via
 * useSyncExternalStore). Holds references to existing state, not deep copies,
 * so construction is cheap. Identity changes exactly when observable state
 * changes; no-op calls leave it stable.
 */
export interface SessionSnapshot {
  state: SessionState;
  gameState: GameState;
  activeProblem: GeneratedProblem | null;
  activeLifecycleState: ProblemLifecycleState | null;
  remainingBossQueue: readonly GeneratedProblem[];
  hasPendingBoss: boolean;
  isStartable: boolean;
  remainingTimeMs: number;
  isExpired: boolean;
  idleOffersEndSession: boolean;
  /**
   * True once the active problem has been solved and the session is waiting
   * for the explicit advance action before presenting the next work.
   */
  awaitingAdvance: boolean;
  /**
   * Set by the presentation layer once it has finished showing the combat
   * outcome for the current problem; gates the "Next" control.
   */
  combatPresentationComplete: boolean;
  summary: SessionSummary;
}

type SessionListener = () => void;

/**
 * A value-level fingerprint of the game domain state. The `GameRules.state`
 * getter builds a fresh object on every access, so snapshot-change detection
 * must compare fields by value rather than by reference.
 */
interface GameFingerprint {
  heroHealth: number;
  heroDefeated: boolean;
  encounterKind: GameState['encounter']['kind'];
  enemyProblemId: string | null;
  enemyHealth: number;
  bossHearts: readonly BossHeartState[] | null;
  activeHeartIndex: number;
  queuedProblems: number;
  solvedCount: number;
  rewardIds: readonly (string | null)[];
  loadoutIds: readonly (string | null)[];
}

/** A value-level fingerprint of the active problem lifecycle state. */
interface LifecycleFingerprint {
  /** The lifecycle object itself: a new problem always means a new lifecycle. */
  lifecycleRef: ProblemLifecycle;
  attempted: boolean;
  snapshot: ArithmeticStepSnapshot;
  eventCount: number;
}

/** The observable values compared to decide whether a snapshot changed. */
interface EmittedValues {
  stateKind: SessionState['kind'];
  game: GameFingerprint;
  lifecycle: LifecycleFingerprint | null;
  bossQueueLength: number;
  hasPendingBoss: boolean;
  isStartable: boolean;
  remainingTimeMs: number;
  isExpired: boolean;
  idleOffersEndSession: boolean;
  awaitingAdvance: boolean;
  combatPresentationComplete: boolean;
  questionsAttempted: number;
  questionsCompleted: number;
  stepAttempts: number;
  acceptedSteps: number;
  totalDamageDealt: number;
  bossesDefeated: number;
  equipmentEarned: number;
}

function sameGame(a: GameFingerprint, b: GameFingerprint): boolean {
  if (
    a.heroHealth !== b.heroHealth ||
    a.heroDefeated !== b.heroDefeated ||
    a.encounterKind !== b.encounterKind ||
    a.enemyProblemId !== b.enemyProblemId ||
    a.enemyHealth !== b.enemyHealth ||
    a.activeHeartIndex !== b.activeHeartIndex ||
    a.queuedProblems !== b.queuedProblems ||
    a.solvedCount !== b.solvedCount
  ) {
    return false;
  }
  if (a.bossHearts === null || b.bossHearts === null) {
    return a.bossHearts === b.bossHearts;
  }
  if (a.bossHearts.length !== b.bossHearts.length) {
    return false;
  }
  for (let i = 0; i < a.bossHearts.length; i += 1) {
    const left = a.bossHearts[i];
    const right = b.bossHearts[i];
    if (left.problemId !== right.problemId || left.health !== right.health || left.maxHealth !== right.maxHealth) {
      return false;
    }
  }
  return sameIds(a.rewardIds, b.rewardIds) && sameIds(a.loadoutIds, b.loadoutIds);
}

function sameIds(a: readonly (string | null)[], b: readonly (string | null)[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function sameLifecycle(a: LifecycleFingerprint | null, b: LifecycleFingerprint | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return (
    a.lifecycleRef === b.lifecycleRef &&
    a.attempted === b.attempted &&
    a.snapshot === b.snapshot &&
    a.eventCount === b.eventCount
  );
}

function sameValues(a: EmittedValues, b: EmittedValues): boolean {
  return (
    a.stateKind === b.stateKind &&
    sameGame(a.game, b.game) &&
    sameLifecycle(a.lifecycle, b.lifecycle) &&
    a.bossQueueLength === b.bossQueueLength &&
    a.hasPendingBoss === b.hasPendingBoss &&
    a.isStartable === b.isStartable &&
    a.remainingTimeMs === b.remainingTimeMs &&
    a.isExpired === b.isExpired &&
    a.idleOffersEndSession === b.idleOffersEndSession &&
    a.awaitingAdvance === b.awaitingAdvance &&
    a.combatPresentationComplete === b.combatPresentationComplete &&
    a.questionsAttempted === b.questionsAttempted &&
    a.questionsCompleted === b.questionsCompleted &&
    a.stepAttempts === b.stepAttempts &&
    a.acceptedSteps === b.acceptedSteps &&
    a.totalDamageDealt === b.totalDamageDealt &&
    a.bossesDefeated === b.bossesDefeated &&
    a.equipmentEarned === b.equipmentEarned
  );
}

/**
 * The session coordinator. Owns the session state machine and drives the math
 * and game domains through their public APIs. Construct one per page session.
 */
export class SessionCoordinator {
  private readonly setup: SessionSetup;
  private readonly durationMs: number;
  private readonly random: RandomSource;
  private readonly timeSource: SessionTimeSource;
  private readonly game = new GameRules();

  private state: SessionState = { kind: 'setup' };
  private lastSyncMs = 0;

  // Time clocks owned by the coordinator.
  private activeTimeMs = 0;
  private rewardElapsedMs = 0;
  private rewardPending = false;
  private idleMs = 0;
  private nextCheckpointMs = BOSS_CHECKPOINT_MS;

  // Problem / encounter bookkeeping.
  private activeLifecycle: ProblemLifecycle | null = null;
  /** The lifecycle whose event stream has been observed, and how far into it. */
  private observedLifecycle: ProblemLifecycle | null = null;
  private observedEventCount = 0;
  private bossQueue: ProblemLifecycle[] = [];
  private bossPending = false;
  private bossIsSessionEnding = false;
  private encounterSeq = 0;

  // Presentation-advancement bookkeeping (Stage 6).
  /** True once the active problem is solved and the session awaits the explicit advance action. */
  private isAwaitingAdvance = false;
  /** Set by the presentation layer when it has finished showing the combat outcome. */
  private isCombatPresentationComplete = false;

  // Summary accumulators (derived from observed events and tracked counters).
  private questionsAttempted = 0;
  private questionsCompleted = 0;
  private stepAttempts = 0;
  private acceptedSteps = 0;
  private totalDamageDealt = 0;
  private bossesDefeated = 0;
  private equipmentEarned = 0;

  /** The last generated problem's operand pair, used for duplicate rejection. */
  private previousPair: readonly [number, number] | null = null;

  // Observation state (framework-independent; consumed by adapters).
  private readonly listeners = new Set<SessionListener>();
  /**
   * The cached snapshot, initialized in the constructor to the initial-state
   * snapshot so the field is never null. Replaced on the first real read or
   * mutation.
   */
  private cachedSnapshot: SessionSnapshot;
  /** The observable values baked into {@link cachedSnapshot}; null when none. */
  private lastEmitted: EmittedValues | null = null;

  constructor(setup: SessionSetup, options: SessionOptions = {}) {
    this.setup = setup;
    this.durationMs = durationToMs(setup.durationMinutes);
    this.random = options.random ?? Math.random;
    this.timeSource = options.timeSource ?? new ManualTimeSource();
    this.cachedSnapshot = this.buildSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Read-only accessors for adapters and tests.
  // ---------------------------------------------------------------------------

  get currentState(): SessionState {
    return this.state;
  }

  /** A snapshot of the game domain state (hero, encounter, rewards, loadout). */
  get gameState() {
    return this.game.state;
  }

  /** The problem currently being worked, if any. */
  get activeProblem(): GeneratedProblem | null {
    return this.activeLifecycle?.state.problem ?? null;
  }

  /** The full math lifecycle state for the active problem, if any. */
  get activeLifecycleState() {
    return this.activeLifecycle?.state ?? null;
  }

  /** The problems still queued behind the active boss heart (read-only). */
  get remainingBossQueue(): readonly GeneratedProblem[] {
    return this.bossQueue.map((lifecycle) => lifecycle.state.problem);
  }

  /** Whether a boss is pending (due but not yet started because a problem is active). */
  get hasPendingBoss(): boolean {
    return this.bossPending;
  }

  /** Whether a session can be started from setup (at least one problem enabled). */
  get isStartable(): boolean {
    return this.state.kind === 'setup' && this.setup.enabledConfigs.length > 0;
  }

  /** Remaining session time in milliseconds (clamped at zero). */
  get remainingTimeMs(): number {
    return Math.max(0, this.durationMs - this.activeTimeMs);
  }

  /** Whether the session timer has expired. */
  get isExpired(): boolean {
    return this.activeTimeMs >= this.durationMs;
  }

  /** True once the active problem is solved and the session awaits the advance action. */
  get awaitingAdvance(): boolean {
    return this.isAwaitingAdvance;
  }

  /** Whether the presentation layer has finished showing the current combat outcome. */
  get combatPresentationComplete(): boolean {
    return this.isCombatPresentationComplete;
  }

  // ---------------------------------------------------------------------------
  // Observation (framework-independent; consumed by adapters via
  // useSyncExternalStore).
  // ---------------------------------------------------------------------------

  /** Subscribe to observable state changes; returns an unsubscribe function. */
  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * The current observable snapshot. Identity is stable across no-op calls and
   * changes exactly when observable state changes; listeners are notified on
   * each change.
   */
  getSnapshot(): SessionSnapshot {
    // Pure read: returns the stable cached object. If a mutation ran before
    // any read, checkAndNotify already built the cache and recorded the
    // baseline; otherwise this first read establishes it. Later reads return
    // the same object until a mutation replaces it, so identity is stable
    // across no-op calls.
    if (this.lastEmitted === null) {
      this.cachedSnapshot = this.buildSnapshot();
      this.lastEmitted = this.currentValues();
    }
    return this.cachedSnapshot;
  }

  /**
   * Called at the end of every public mutation path. When any observable value
   * differs from the last-emitted record, rebuilds the cached snapshot (new
   * identity) and notifies listeners. No-op calls leave identity stable and
   * notify nobody, so they cannot cause re-render storms. Before a baseline
   * exists (no snapshot read yet), it refreshes the cache silently so a
   * mutation before the first read is not lost.
   */
  private checkAndNotify(): void {
    const values = this.currentValues();
    if (this.lastEmitted !== null && sameValues(this.lastEmitted, values)) {
      return;
    }
    this.cachedSnapshot = this.buildSnapshot();
    this.lastEmitted = values;
    if (this.listeners.size === 0) {
      return;
    }
    for (const listener of this.listeners) {
      listener();
    }
  }

  /** The observable values that determine snapshot identity. */
  private currentValues(): EmittedValues {
    const game = this.game.state;
    const encounter = game.encounter;
    const gameFingerprint: GameFingerprint = {
      heroHealth: game.hero.health,
      heroDefeated: game.hero.defeated,
      encounterKind: encounter.kind,
      enemyProblemId: encounter.kind === 'regular' ? encounter.enemy.problemId : null,
      enemyHealth: encounter.kind === 'regular' ? encounter.enemy.health : 0,
      bossHearts: encounter.kind === 'boss' ? encounter.hearts : null,
      activeHeartIndex: encounter.kind === 'boss' ? encounter.activeHeartIndex : 0,
      queuedProblems: encounter.kind === 'boss' ? encounter.queuedProblems : 0,
      solvedCount: game.solvedCount,
      rewardIds: EQUIPMENT_CATEGORIES.map((category) => game.pendingReward?.[category]?.id ?? null),
      loadoutIds: EQUIPMENT_CATEGORIES.map((category) => game.loadout[category]?.id ?? null),
    };

    const lifecycle = this.activeLifecycle;
    const lifecycleFingerprint: LifecycleFingerprint | null =
      lifecycle === null
        ? null
        : {
            lifecycleRef: lifecycle,
            attempted: lifecycle.state.attempted,
            snapshot: lifecycle.state.snapshot,
            eventCount: lifecycle.state.events.length,
          };

    return {
      stateKind: this.state.kind,
      game: gameFingerprint,
      lifecycle: lifecycleFingerprint,
      bossQueueLength: this.bossQueue.length,
      hasPendingBoss: this.bossPending,
      isStartable: this.isStartable,
      remainingTimeMs: this.remainingTimeMs,
      isExpired: this.isExpired,
      idleOffersEndSession: this.idleOffersEndSession,
      awaitingAdvance: this.isAwaitingAdvance,
      combatPresentationComplete: this.isCombatPresentationComplete,
      questionsAttempted: this.questionsAttempted,
      questionsCompleted: this.questionsCompleted,
      stepAttempts: this.stepAttempts,
      acceptedSteps: this.acceptedSteps,
      totalDamageDealt: this.totalDamageDealt,
      bossesDefeated: this.bossesDefeated,
      equipmentEarned: this.equipmentEarned,
    };
  }

  private buildSnapshot(): SessionSnapshot {
    return {
      state: this.state,
      gameState: this.gameState,
      activeProblem: this.activeProblem,
      activeLifecycleState: this.activeLifecycleState,
      remainingBossQueue: this.remainingBossQueue,
      hasPendingBoss: this.hasPendingBoss,
      isStartable: this.isStartable,
      remainingTimeMs: this.remainingTimeMs,
      isExpired: this.isExpired,
      idleOffersEndSession: this.idleOffersEndSession,
      awaitingAdvance: this.isAwaitingAdvance,
      combatPresentationComplete: this.isCombatPresentationComplete,
      summary: this.getSummary(),
    };
  }

  // ---------------------------------------------------------------------------
  // Time control.
  // ---------------------------------------------------------------------------

  /**
   * Process any elapsed time since the last sync, driving the time-dependent
   * transitions (active-time accumulation, checkpoints/expiration, idle pause).
   * The caller advances the injected time source first; this is the single
   * deterministic time-control entry point for tests and adapters.
   */
  tick(): void {
    this.syncClocks();
    this.checkAndNotify();
  }

  private syncClocks(): void {
    const now = this.timeSource.now();
    const delta = now - this.lastSyncMs;
    this.lastSyncMs = now;
    if (delta > 0) {
      this.advanceClocks(delta);
    }
  }

  /** Advance internal clocks by `ms`, respecting which states accumulate time. */
  private advanceClocks(ms: number): void {
    if (this.state.kind === 'setup' || this.state.kind === 'summary') {
      return;
    }

    if (this.state.kind !== 'manual-paused' && this.state.kind !== 'idle-paused') {
      this.rewardElapsedMs += ms;
      while (this.rewardElapsedMs >= REWARD_INTERVAL_MS) {
        this.rewardElapsedMs -= REWARD_INTERVAL_MS;
        this.rewardPending = true;
      }
      if (this.isAwaitingAdvance) {
        this.presentDueReward();
      }
    }

    // Active time accumulates while active and during the (decorative) defeat
    // decision; it is excluded during manual pause, idle pause, and boss fights.
    if (this.state.kind === 'active' || this.state.kind === 'defeat') {
      this.activeTimeMs += ms;
      this.evaluateTriggers();
    }

    // The one-minute keyboard-idle interval runs while the student is expected to
    // be engaged: active play, a boss fight, and the (decorative) defeat decision.
    // Any keyboard keypress resets it in all of these states (Q6). It never runs
    // while a pause modal (manual/idle) is already showing.
    if (this.state.kind === 'active' || this.state.kind === 'boss-fight' || this.state.kind === 'defeat') {
      this.idleMs += ms;
      if (this.idleMs >= IDLE_LIMIT_MS) {
        if (this.state.kind === 'defeat') {
          // The defeat decision must be resolved first; cap the clock and stay in
          // defeat rather than entering an undefined idle-paused-from-defeat state.
          this.idleMs = 0;
        } else {
          this.enterIdlePaused();
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Setup / start.
  // ---------------------------------------------------------------------------

  /** Attempt to start the session. Refuses when no problem type is enabled. */
  start(): StartResult {
    this.syncClocks();
    if (this.state.kind !== 'setup') {
      return { ok: false, reason: 'already-started' };
    }
    if (this.setup.enabledConfigs.length === 0) {
      return { ok: false, reason: 'no-problems-enabled' };
    }

    const problem = this.generateProblemFromConfigs();
    if (problem === null) {
      return { ok: false, reason: 'no-problems-enabled' };
    }

    this.presentRegular(problem);
    this.idleMs = 0;
    this.state = { kind: 'active' };
    this.checkAndNotify();
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Student input.
  // ---------------------------------------------------------------------------

  /**
   * Report any keyboard keypress. Resets the one-minute idle interval, including
   * while a modal is open. Mouse input never calls this.
   */
  noteKeyInput(): void {
    this.syncClocks();
    this.idleMs = 0;
    this.checkAndNotify();
  }

  /** Submit an answer for the active problem. Solving stops at awaiting-advance. */
  submitAnswer(answer: number | string): SubmitOutcome {
    const outcome = this.submitAnswerInternal(answer);
    this.checkAndNotify();
    return outcome;
  }

  private submitAnswerInternal(answer: number | string): SubmitOutcome {
    this.syncClocks();
    if (this.state.kind !== 'active' && this.state.kind !== 'boss-fight') {
      return { status: 'ignored' };
    }
    const lifecycle = this.activeLifecycle;
    if (lifecycle === null) {
      return { status: 'ignored' };
    }

    // Entering an answer is keyboard input; reset the idle interval.
    this.idleMs = 0;

    const result = lifecycle.submitAnswer(answer);
    this.observeNewEvents(lifecycle);

    // Defeat is decorative: it changes no problem/boss state, only the decision.
    if (this.game.state.hero.defeated && (this.state.kind === 'active' || this.state.kind === 'boss-fight')) {
      this.enterDefeat();
      return { status: result.status };
    }

    // Solving does not advance the session; it waits for the explicit advance
    // action so the presentation layer can show the combat outcome first.
    if (result.status === 'solved') {
      this.isAwaitingAdvance = true;
    }

    return { status: result.status };
  }

  /**
   * Advance the session after the active problem has been solved. No-op unless
   * the session is awaiting advancement, so it cannot skip or double-advance.
   */
  advance(): void {
    this.advanceInternal();
    this.checkAndNotify();
  }

  private advanceInternal(): void {
    this.syncClocks();
    if (!this.isAwaitingAdvance) {
      return;
    }
    this.isAwaitingAdvance = false;
    this.game.advanceEncounter();
    this.onProblemSolved();
  }

  /**
   * Mark the combat presentation for the current problem as complete, enabling
   * the "Next" control. No-op when there is no active problem to present.
   */
  markCombatPresentationComplete(): void {
    if (this.activeLifecycle === null) {
      return;
    }
    this.isCombatPresentationComplete = true;
    this.checkAndNotify();
  }

  // ---------------------------------------------------------------------------
  // Pause / resume / idle.
  // ---------------------------------------------------------------------------

  /** Manually pause an active session, preserving the active problem and work. */
  pause(): void {
    this.pauseInternal();
    this.checkAndNotify();
  }

  private pauseInternal(): void {
    this.syncClocks();
    if (this.state.kind !== 'active') {
      return;
    }
    this.state = { kind: 'manual-paused' };
  }

  /**
   * Resume play from a manual pause or the "Still There" idle pause. This is the
   * "Continue"/resume control. It preserves the active problem, accepted work, and
   * any pending boss trigger.
   */
  resume(): void {
    this.resumeInternal();
    this.checkAndNotify();
  }

  private resumeInternal(): void {
    this.syncClocks();
    if (this.state.kind === 'manual-paused') {
      this.state = { kind: 'active' };
      this.idleMs = 0;
    } else if (this.state.kind === 'idle-paused') {
      const target = this.state.resumeTarget;
      this.state = target === 'boss-fight' ? { kind: 'boss-fight' } : { kind: 'active' };
      this.idleMs = 0;
    }
  }

  /**
   * Whether the current "Still There" (idle-paused) state should offer an
   * "End Session" control in addition to resume. True only after expiration.
   */
  get idleOffersEndSession(): boolean {
    return this.state.kind === 'idle-paused' && this.state.expired;
  }

  private enterIdlePaused(): void {
    const resumeTarget = this.state.kind === 'boss-fight' ? 'boss-fight' : 'active';
    const expired = this.activeTimeMs >= this.durationMs;
    this.idleMs = 0;
    this.state = { kind: 'idle-paused', expired, resumeTarget };
  }

  // ---------------------------------------------------------------------------
  // Defeat / respawn.
  // ---------------------------------------------------------------------------

  private enterDefeat(): void {
    const returnTo = this.state.kind === 'boss-fight' ? 'boss-fight' : 'active';
    this.state = { kind: 'defeat', returnTo };
  }

  /** Respawn the hero, delegating to the game domain. Preserves all session state. */
  respawn(): void {
    this.respawnInternal();
    this.checkAndNotify();
  }

  private respawnInternal(): void {
    this.syncClocks();
    if (this.state.kind !== 'defeat') {
      return;
    }
    const returnTo = this.state.returnTo;
    this.game.respawn();
    this.state = returnTo === 'boss-fight' ? { kind: 'boss-fight' } : { kind: 'active' };
    this.isCombatPresentationComplete = false;
    this.idleMs = 0;
  }

  // ---------------------------------------------------------------------------
  // Rewards / equipment.
  // ---------------------------------------------------------------------------

  /**
   * Equip the offered item for a category, delegating to the game domain. The
  * timed reward cadence is owned by this coordinator and continues during boss
  * fights. Returns true when an item was equipped.
   */
  equip(category: EquipmentCategory): boolean {
    const equipped = this.equipInternal(category);
    this.checkAndNotify();
    return equipped;
  }

  private equipInternal(category: EquipmentCategory): boolean {
    this.syncClocks();
    const item = this.game.equipItem(category);
    if (item !== null) {
      this.equipmentEarned += 1;
      return true;
    }
    return false;
  }

  private presentDueReward(): void {
    if (!this.rewardPending) {
      return;
    }
    this.game.offerReward();
    this.rewardPending = false;
  }

  // ---------------------------------------------------------------------------
  // Ending the session.
  // ---------------------------------------------------------------------------

  /**
   * End the session early (or via the post-expiration "End Session" choice).
   * Stops play and produces the summary, skipping any pending/session-ending boss.
   */
  endSession(): void {
    this.endSessionPublic();
    this.checkAndNotify();
  }

  private endSessionPublic(): void {
    this.syncClocks();
    if (this.state.kind === 'summary' || this.state.kind === 'setup') {
      return;
    }
    this.endSessionInternal();
  }

  private endSessionInternal(): void {
    this.activeLifecycle = null;
    this.bossQueue = [];
    this.bossPending = false;
    this.bossIsSessionEnding = false;
    this.state = { kind: 'summary' };
  }

  /** Assemble the summary from tracked counters and read-only domain state. */
  getSummary(): SessionSummary {
    const stepAccuracy = this.stepAttempts > 0 ? this.acceptedSteps / this.stepAttempts : 0;
    return {
      questionsAttempted: this.questionsAttempted,
      questionsCompleted: this.questionsCompleted,
      stepAttempts: this.stepAttempts,
      acceptedSteps: this.acceptedSteps,
      stepAccuracy,
      totalDamageDealt: this.totalDamageDealt,
      totalActiveTimeMs: this.activeTimeMs,
      bossesDefeated: this.bossesDefeated,
      equipmentEarned: this.equipmentEarned,
    };
  }

  // ---------------------------------------------------------------------------
  // Problem generation and presentation (delegates to the math domain).
  // ---------------------------------------------------------------------------

  private nextEncounterId(prefix: string): string {
    this.encounterSeq += 1;
    return `${prefix}-${this.encounterSeq}`;
  }

  /** Generate a problem from the enabled configs, trying a random starting config. */
  private generateProblemFromConfigs(): GeneratedProblem | null {
    const configs = this.setup.enabledConfigs;
    if (configs.length === 0) {
      return null;
    }
    const start = Math.floor(this.random() * configs.length) % configs.length;
    for (let i = 0; i < configs.length; i += 1) {
      const config = configs[(start + i) % configs.length];
      const result = generateProblem(config, { previousPair: this.previousPair ?? undefined, random: this.random });
      if (result.ok) {
        this.previousPair = [result.problem.left, result.problem.right];
        return result.problem;
      }
    }
    return null;
  }

  /** Present a regular problem and start its enemy encounter in the game domain. */
  private presentRegular(problem: GeneratedProblem): void {
    const lifecycle = presentProblem(problem);
    this.activeLifecycle = lifecycle;
    this.questionsAttempted += 1;
    this.isCombatPresentationComplete = false;
    const id = this.nextEncounterId('reg');
    this.game.startEncounter(id, lifecycle.state.correctHitBudget);
  }

  // ---------------------------------------------------------------------------
  // Boss scheduling, queue, and progression.
  // ---------------------------------------------------------------------------

  /** Mark checkpoints/expiration that have become due as boss triggers. */
  private evaluateTriggers(): void {
    while (this.activeTimeMs >= this.nextCheckpointMs && this.nextCheckpointMs < this.durationMs) {
      this.markBossDue(false);
      this.nextCheckpointMs += BOSS_CHECKPOINT_MS;
    }
    if (this.activeTimeMs >= this.durationMs) {
      this.markBossDue(true);
    }
  }

  /**
   * Record that a boss is due. Coincident or overlapping triggers coalesce into a
   * single pending boss so encounters never overlap.
   */
  private markBossDue(isSessionEnding: boolean): void {
    if (this.bossPending || this.state.kind === 'boss-fight') {
      if (isSessionEnding) {
        this.bossIsSessionEnding = true;
      }
      return;
    }
    this.bossPending = true;
    this.bossIsSessionEnding = isSessionEnding;
  }

  /** Begin a boss fight: queue three problems and emit `boss_start`. */
  private startBoss(): void {
    const lifecycles = this.generateBossProblems().map((problem) => presentProblem(problem));
    const hearts: BossHeartInit[] = lifecycles.map((lifecycle) => ({
      problemId: this.nextEncounterId('boss-heart'),
      health: lifecycle.state.correctHitBudget,
    }));

    const bossStart: BossStartMessage = { type: 'boss_start', queuedProblems: lifecycles.length, hearts };
    this.game.applyEvent(bossStart);

    this.activeLifecycle = lifecycles[0] ?? null;
    if (this.activeLifecycle !== null) {
      this.questionsAttempted += 1;
    }
    this.bossQueue = lifecycles.slice(1);
    this.bossPending = false;
    this.isCombatPresentationComplete = false;
    this.idleMs = 0;
    this.state = { kind: 'boss-fight' };
  }

  /** Generate exactly three boss problems (one per heart) from the enabled configs. */
  private generateBossProblems(): GeneratedProblem[] {
    const problems: GeneratedProblem[] = [];
    for (let i = 0; i < BOSS_QUEUE_SIZE; i += 1) {
      let problem: GeneratedProblem | null = null;
      for (let attempt = 0; attempt < 10 && problem === null; attempt += 1) {
        problem = this.generateProblemFromConfigs();
      }
      if (problem !== null) {
        problems.push(problem);
      }
    }
    return problems;
  }

  /** Advance the boss fight after the active boss problem is solved. */
  private advanceBoss(): void {
    const encounter = this.game.state.encounter;
    if (encounter.kind === 'boss') {
      const next = this.bossQueue.shift() ?? null;
      if (next !== null) {
        this.activeLifecycle = next;
        this.questionsAttempted += 1;
        this.isCombatPresentationComplete = false;
      } else {
        this.finishBoss();
      }
    } else {
      this.finishBoss();
    }
  }

  /** Conclude a boss fight: emit `boss_end`, count the defeat, and continue. */
  private finishBoss(): void {
    const bossEnd: BossEndMessage = { type: 'boss_end' };
    this.game.applyEvent(bossEnd);
    this.bossesDefeated += 1;
    const wasSessionEnding = this.bossIsSessionEnding;
    this.bossIsSessionEnding = false;
    this.bossQueue = [];
    this.activeLifecycle = null;

    if (wasSessionEnding) {
      this.endSessionInternal();
      return;
    }

    const problem = this.generateProblemFromConfigs();
    if (problem !== null) {
      this.presentRegular(problem);
      this.state = { kind: 'active' };
    } else {
      this.endSessionInternal();
    }
  }

  // ---------------------------------------------------------------------------
  // Event observation and problem progression.
  // ---------------------------------------------------------------------------

  /**
   * Observe every event newly appended to the active lifecycle's event stream.
   * The lifecycle returns only the last event per submission, but its state
   * carries the full stream (e.g., a final correct hit followed by `solved`),
   * so metrics are derived from the stream rather than the single returned
   * event. Each new event is applied to the game domain and observed here.
   */
  private observeNewEvents(lifecycle: ProblemLifecycle): void {
    if (this.observedLifecycle !== lifecycle) {
      this.observedLifecycle = lifecycle;
      this.observedEventCount = 0;
    }
    const events = lifecycle.state.events;
    for (let i = this.observedEventCount; i < events.length; i += 1) {
      const event = events[i];
      if (event === undefined) {
        break;
      }
      this.game.applyEvent(event);
      this.observeEvent(event);
    }
    this.observedEventCount = events.length;
  }

  /** Derive summary metrics from an observed math event (no rule re-implementation). */
  private observeEvent(event: MathEvent): void {
    switch (event.type) {
      case 'hit':
        this.stepAttempts += 1;
        if (event.outcome === 'correct') {
          this.acceptedSteps += 1;
          this.totalDamageDealt += event.value;
        }
        break;
      case 'solved':
        this.questionsCompleted += 1;
        this.presentDueReward();
        break;
    }
  }

  /** Advance the session after the active problem is solved correctly. */
  private onProblemSolved(): void {
    if (this.state.kind === 'boss-fight') {
      this.advanceBoss();
      return;
    }

    // Regular problem solved: start a pending boss, or present the next problem.
    if (this.bossPending) {
      this.startBoss();
      return;
    }

    const problem = this.generateProblemFromConfigs();
    if (problem !== null) {
      this.presentRegular(problem);
    } else {
      this.endSessionInternal();
    }
  }
}

/** Create a session coordinator for the given setup. */
export function createSession(setup: SessionSetup, options: SessionOptions = {}): SessionCoordinator {
  return new SessionCoordinator(setup, options);
}
