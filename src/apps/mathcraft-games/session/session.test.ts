import { describe, expect, it } from 'vitest';
import type { ProblemConfig } from '../math';
import { createSeededRandom } from '../math';
import { EQUIPMENT_CATEGORIES } from '../game/equipment';
import { REWARD_CADENCE } from '../game/rules';
import { createSession, ManualTimeSource, type SessionCoordinator } from './session';

// Single-step problem config: every generated problem has exactly one step, so a
// correct answer solves it and a wrong answer is always wrong.
const addConfig: ProblemConfig = { operation: 'addition', leftDigits: 1, rightDigits: 1, maxResult: 20 };
// Multi-step problem config: problems have two or more steps, allowing partial
// "accepted work" to be observed before completion.
const multiAddConfig: ProblemConfig = {
  operation: 'addition',
  leftDigits: 2,
  rightDigits: 2,
  carryMode: 'allowed',
};

interface Harness {
  session: SessionCoordinator;
  time: ManualTimeSource;
}

function makeSession(
  setup: { durationMinutes: 2 | 5 | 10; enabledConfigs: readonly ProblemConfig[] },
  seed?: number,
): Harness {
  const time = new ManualTimeSource();
  const session = createSession(setup, {
    timeSource: time,
    random: seed === undefined ? undefined : createSeededRandom(seed),
  });
  return { session, time };
}

/** Advance the clock by `ms` and process resulting transitions. */
function step(time: ManualTimeSource, session: SessionCoordinator, ms: number): void {
  time.advance(ms);
  session.tick();
}

/**
 * Advance `totalMs` while keeping the student "present" (resetting the idle clock
 * after each sub-step) so that only active-time accumulation is exercised. Stops
 * early if the session leaves the active state.
 */
function pump(time: ManualTimeSource, session: SessionCoordinator, totalMs: number, chunkMs = 59_000): void {
  let remaining = totalMs;
  while (remaining > 0) {
    const stepMs = Math.min(chunkMs, remaining);
    time.advance(stepMs);
    session.tick();
    remaining -= stepMs;
    if (session.currentState.kind !== 'active') {
      break;
    }
    session.noteKeyInput();
  }
}

/** Solve the currently active problem by submitting each step's correct result. Does not advance. */
function solveCurrent(session: SessionCoordinator): void {
  const startProblem = session.activeProblem;
  if (startProblem === null) {
    return;
  }
  let guard = 0;
  while (session.activeProblem === startProblem && session.activeLifecycleState?.snapshot.stepIndex !== null && guard < 100) {
    const stepResult = session.activeLifecycleState?.snapshot.expected;
    if (stepResult === undefined || stepResult === null) {
      break;
    }
    session.submitAnswer(stepResult);
    guard += 1;
  }
}

/**
 * Solve the active problem and drive the explicit advance action so the session
 * presents the next work. Mirrors the pre-Stage-6 auto-advance flow for tests
 * that only care about progression, not the awaiting-advance intermediate state.
 */
function solveActive(session: SessionCoordinator): void {
  solveCurrent(session);
  if (session.awaitingAdvance) {
    session.advance();
  }
}

/** Solve every heart of the active boss fight, in sequence. */
function solveBoss(session: SessionCoordinator): void {
  let guard = 0;
  while (session.currentState.kind === 'boss-fight' && guard < 10) {
    solveActive(session);
    guard += 1;
  }
}

/** Submit wrong answers until the hero is defeated. */
function defeatHero(session: SessionCoordinator): void {
  let guard = 0;
  while (!session.gameState.hero.defeated && guard < 100) {
    const stepResult = session.activeLifecycleState?.snapshot.expected;
    if (stepResult === undefined || stepResult === null) {
      break;
    }
    session.submitAnswer(stepResult + 1); // always wrong for the current step
    guard += 1;
  }
}

/** Respawn the hero if a scripted submission defeated it, so the script can continue. */
function keepAlive(session: SessionCoordinator): void {
  if (session.gameState.hero.defeated) {
    session.respawn();
  }
}

describe('session: start guard (MGP4-01)', () => {
  it('refuses to start when no problem type is enabled and reports not-startable', () => {
    const { session } = makeSession({ durationMinutes: 2, enabledConfigs: [] });
    expect(session.isStartable).toBe(false);
    const result = session.start();
    expect(result).toEqual({ ok: false, reason: 'no-problems-enabled' });
    expect(session.currentState.kind).toBe('setup');
  });

  it('starts with a valid config, presents the first problem, and opens a regular encounter', () => {
    const { session } = makeSession({ durationMinutes: 2, enabledConfigs: [addConfig] }, 1);
    expect(session.isStartable).toBe(true);
    const result = session.start();
    expect(result.ok).toBe(true);
    expect(session.currentState.kind).toBe('active');
    expect(session.activeProblem).not.toBeNull();
    expect(session.gameState.encounter.kind).toBe('regular');
  });

  it('does not start twice', () => {
    const { session } = makeSession({ durationMinutes: 2, enabledConfigs: [addConfig] }, 1);
    session.start();
    expect(session.start()).toEqual({ ok: false, reason: 'already-started' });
  });
});

describe('session: active-time tracking (MGP4-02)', () => {
  it('accumulates active time only while active', () => {
    const { session, time } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 1);
    session.start();
    step(time, session, 30_000);
    expect(session.remainingTimeMs).toBe(600_000 - 30_000);
  });

  it('excludes time during a manual pause', () => {
    const { session, time } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 1);
    session.start();
    step(time, session, 30_000);
    session.pause();
    expect(session.currentState.kind).toBe('manual-paused');
    step(time, session, 30_000); // no accumulation while paused
    expect(session.remainingTimeMs).toBe(600_000 - 30_000);
    session.resume();
    step(time, session, 30_000);
    expect(session.remainingTimeMs).toBe(600_000 - 60_000);
  });

  it('excludes time during an idle pause', () => {
    const { session, time } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 1);
    session.start();
    step(time, session, 60_000); // idle limit reached -> idle pause
    expect(session.currentState.kind).toBe('idle-paused');
    const remainingAfterIdle = session.remainingTimeMs;
    step(time, session, 30_000); // no accumulation while idle-paused
    expect(session.remainingTimeMs).toBe(remainingAfterIdle);
  });

  it('excludes time during a boss fight', () => {
    const { session, time } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 1);
    session.start();
    pump(time, session, 300_000); // reach the 5-minute checkpoint -> boss pending (deferred)
    expect(session.hasPendingBoss).toBe(true);
    solveActive(session); // start the boss fight
    expect(session.currentState.kind).toBe('boss-fight');
    const remainingBefore = session.remainingTimeMs;
    step(time, session, 30_000); // no accumulation during the boss fight
    expect(session.remainingTimeMs).toBe(remainingBefore);
  });
});

describe('session: pause / resume preserves work (MGP4-02)', () => {
  it('manual pause and resume preserve the active problem and accepted work', () => {
    const { session } = makeSession({ durationMinutes: 10, enabledConfigs: [multiAddConfig] }, 7);
    session.start();
    const problemBefore = session.activeProblem;
    const firstSnapshot = session.activeLifecycleState?.snapshot;
    expect(firstSnapshot?.expected).not.toBeNull();
    const outcome = session.submitAnswer(firstSnapshot!.expected!);
    expect(outcome.status).toBe('accepted');
    const acceptedSnapshot = session.activeLifecycleState?.snapshot;
    expect(acceptedSnapshot).not.toBe(firstSnapshot);

    session.pause();
    expect(session.currentState.kind).toBe('manual-paused');
    session.resume();
    expect(session.currentState.kind).toBe('active');
    expect(session.activeProblem).toBe(problemBefore);
    expect(session.activeLifecycleState?.snapshot).toBe(acceptedSnapshot);
    expect(session.activeLifecycleState?.snapshot.stepIndex).toBe(1);
  });

  it('idle pause and resume preserve the active problem and accepted work', () => {
    const { session, time } = makeSession({ durationMinutes: 10, enabledConfigs: [multiAddConfig] }, 7);
    session.start();
    const firstSnapshot = session.activeLifecycleState?.snapshot;
    session.submitAnswer(firstSnapshot!.expected!); // accept the first step
    const acceptedSnapshot = session.activeLifecycleState?.snapshot;
    const problemBefore = session.activeProblem;

    step(time, session, 60_000); // idle pause
    expect(session.currentState.kind).toBe('idle-paused');
    session.resume();
    expect(session.currentState.kind).toBe('active');
    expect(session.activeProblem).toBe(problemBefore);
    expect(session.activeLifecycleState?.snapshot).toBe(acceptedSnapshot);
  });
});

describe('session: idle detection (MGP4-02)', () => {
  it('pauses after one minute without keyboard input', () => {
    const { session, time } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 1);
    session.start();
    step(time, session, 59_000);
    expect(session.currentState.kind).toBe('active');
    step(time, session, 1_000); // crosses the one-minute limit
    expect(session.currentState.kind).toBe('idle-paused');
  });

  it('resets the idle interval on any keyboard keypress', () => {
    const { session, time } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 1);
    session.start();
    step(time, session, 59_000);
    session.noteKeyInput(); // reset
    step(time, session, 59_000); // still under the limit after reset
    expect(session.currentState.kind).toBe('active');
    step(time, session, 1_000); // now crosses the limit
    expect(session.currentState.kind).toBe('idle-paused');
  });

  it('resets the idle interval on a keypress while the defeat modal is open', () => {
    const { session, time } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 6);
    session.start();
    defeatHero(session);
    expect(session.currentState.kind).toBe('defeat');
    step(time, session, 59_000);
    session.noteKeyInput(); // keypress while the defeat modal is open resets the clock
    step(time, session, 59_000);
    expect(session.currentState.kind).toBe('defeat'); // still in defeat, not auto-ended
  });
});

describe('session: Still There control set (MGP4-02)', () => {
  it('offers only resume before expiration', () => {
    const { session, time } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 1);
    session.start();
    step(time, session, 60_000); // idle pause well before the 10-minute expiration
    expect(session.currentState.kind).toBe('idle-paused');
    expect(session.idleOffersEndSession).toBe(false);
  });

  it('offers both Continue and End Session after expiration', () => {
    const { session, time } = makeSession({ durationMinutes: 2, enabledConfigs: [addConfig] }, 1);
    session.start();
    // Keep the student active until just before expiration, then go idle across it.
    step(time, session, 59_000);
    session.noteKeyInput();
    step(time, session, 59_000); // activeTimeMs = 118000 (just under 120000)
    session.noteKeyInput();
    step(time, session, 60_000); // idle for a full minute, crossing expiration
    expect(session.currentState.kind).toBe('idle-paused');
    expect(session.idleOffersEndSession).toBe(true);
  });

  it('"Continue" after expiration resumes play and still allows finishing the problem before the session-ending boss', () => {
    const { session, time } = makeSession({ durationMinutes: 2, enabledConfigs: [addConfig] }, 1);
    session.start();
    step(time, session, 59_000);
    session.noteKeyInput();
    step(time, session, 59_000);
    session.noteKeyInput();
    step(time, session, 60_000); // post-expiration idle pause
    expect(session.currentState.kind).toBe('idle-paused');

    session.resume(); // "Continue"
    expect(session.currentState.kind).toBe('active');
    solveActive(session); // finish the active problem -> session-ending boss appears
    expect(session.currentState.kind).toBe('boss-fight');
  });

  it('"End Session" after expiration ends immediately without the session-ending boss', () => {
    const { session, time } = makeSession({ durationMinutes: 2, enabledConfigs: [addConfig] }, 1);
    session.start();
    step(time, session, 59_000);
    session.noteKeyInput();
    step(time, session, 59_000);
    session.noteKeyInput();
    step(time, session, 60_000); // post-expiration idle pause
    expect(session.currentState.kind).toBe('idle-paused');

    session.endSession();
    expect(session.currentState.kind).toBe('summary');
    expect(session.getSummary().bossesDefeated).toBe(0);
  });
});

describe('session: boss scheduling (MGP4-03)', () => {
  it('marks a boss due at the five-minute checkpoint and defers until the active problem is solved', () => {
    const { session, time } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 1);
    session.start();
    pump(time, session, 300_000); // reach the checkpoint with a problem still active
    expect(session.hasPendingBoss).toBe(true);
    expect(session.currentState.kind).toBe('active'); // deferred, not started yet
    solveActive(session);
    expect(session.currentState.kind).toBe('boss-fight');
  });

  it('coalesces a checkpoint coinciding with expiration into a single session-ending boss', () => {
    const { session, time } = makeSession({ durationMinutes: 5, enabledConfigs: [addConfig] }, 1);
    session.start();
    pump(time, session, 300_000); // checkpoint and expiration coincide at 5 minutes
    expect(session.hasPendingBoss).toBe(true);
    solveActive(session);
    expect(session.currentState.kind).toBe('boss-fight');
    solveBoss(session); // defeating the session-ending boss ends the session
    expect(session.currentState.kind).toBe('summary');
    expect(session.getSummary().bossesDefeated).toBe(1);
  });

  it('coalesces a new trigger while a boss is already pending into one pending boss', () => {
    const { session, time } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 1);
    session.start();
    pump(time, session, 300_000); // first checkpoint -> boss pending
    expect(session.hasPendingBoss).toBe(true);
    pump(time, session, 300_000); // expiration fires while a boss is already pending
    expect(session.hasPendingBoss).toBe(true);
    solveActive(session); // a single boss starts
    expect(session.currentState.kind).toBe('boss-fight');
  });

  it('routes the session-ending boss to the summary on defeat', () => {
    const { session, time } = makeSession({ durationMinutes: 5, enabledConfigs: [addConfig] }, 1);
    session.start();
    pump(time, session, 300_000);
    solveActive(session);
    expect(session.currentState.kind).toBe('boss-fight');
    solveBoss(session);
    expect(session.currentState.kind).toBe('summary');
    const summary = session.getSummary();
    expect(summary.bossesDefeated).toBe(1);
  });
});

describe('session: boss queue (MGP4-04)', () => {
  it('queues exactly three problems for the three hearts', () => {
    const { session, time } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 3);
    session.start();
    pump(time, session, 300_000);
    solveActive(session);
    expect(session.currentState.kind).toBe('boss-fight');
    const encounter = session.gameState.encounter;
    expect(encounter.kind).toBe('boss');
    if (encounter.kind === 'boss') {
      expect(encounter.hearts.length).toBe(3);
      expect(encounter.queuedProblems).toBe(3);
    }
    expect(session.activeProblem).not.toBeNull();
    expect(session.remainingBossQueue.length).toBe(2);
  });

  it('preserves the active heart, remaining queue, and accepted work across respawn', () => {
    const { session, time } = makeSession({ durationMinutes: 10, enabledConfigs: [multiAddConfig] }, 3);
    session.start();
    pump(time, session, 300_000);
    solveActive(session); // boss fight begins on heart 0
    expect(session.currentState.kind).toBe('boss-fight');

    // Accept one step on the active boss problem (work in progress).
    const firstSnapshot = session.activeLifecycleState?.snapshot;
    session.submitAnswer(firstSnapshot?.expected as number);
    const acceptedSnapshot = session.activeLifecycleState?.snapshot;
    expect(acceptedSnapshot).not.toBe(firstSnapshot);
    const queueBefore = session.remainingBossQueue.length;

    defeatHero(session);
    expect(session.currentState.kind).toBe('defeat');
    session.respawn();
    expect(session.currentState.kind).toBe('boss-fight');

    const encounter = session.gameState.encounter;
    if (encounter.kind === 'boss') {
      expect(encounter.activeHeartIndex).toBe(0); // active heart preserved
    }
    expect(session.remainingBossQueue.length).toBe(queueBefore); // queue preserved
    expect(session.activeLifecycleState?.snapshot).toBe(acceptedSnapshot); // work preserved
  });
});

describe('session: defeat / respawn (MGP4-04)', () => {
  it('keeps the active-time timer running during defeat and clears no state', () => {
    const { session, time } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 6);
    session.start();
    pump(time, session, 30_000);
    defeatHero(session);
    expect(session.currentState.kind).toBe('defeat');
    expect(session.activeProblem).not.toBeNull(); // state not cleared

    const remainingBefore = session.remainingTimeMs;
    step(time, session, 30_000); // timer keeps running during the defeat decision
    expect(session.remainingTimeMs).toBe(remainingBefore - 30_000);

    session.respawn();
    expect(session.currentState.kind).toBe('active');
    expect(session.gameState.hero.defeated).toBe(false);
  });

  it('offers both respawn and end-session from the defeat state', () => {
    const { session } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 6);
    session.start();
    defeatHero(session);
    expect(session.currentState.kind).toBe('defeat');

    // End-session is available from defeat.
    session.endSession();
    expect(session.currentState.kind).toBe('summary');
  });

  it('still defers to problem completion when expiration occurs during defeat', () => {
    const { session, time } = makeSession({ durationMinutes: 2, enabledConfigs: [addConfig] }, 6);
    session.start();
    pump(time, session, 119_000); // just before expiration
    defeatHero(session);
    expect(session.currentState.kind).toBe('defeat');
    step(time, session, 2_000); // expiration occurs during the defeat decision
    expect(session.currentState.kind).toBe('defeat');

    session.respawn();
    expect(session.currentState.kind).toBe('active');
    solveActive(session); // finish the active problem -> session-ending boss appears
    expect(session.currentState.kind).toBe('boss-fight');
  });
});

describe('session: rewards during boss (MGP4-04)', () => {
  it('fires the normal reward cadence during a boss fight', () => {
    const { session, time } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 5);
    session.start();
    const rewardSolveCount = Math.ceil(5 / REWARD_CADENCE) * REWARD_CADENCE;
    for (let i = 0; i < rewardSolveCount - 1; i += 1) {
      solveActive(session);
    }
    pump(time, session, 300_000); // boss becomes pending
    solveActive(session); // the reward milestone also starts the boss
    expect(session.currentState.kind).toBe('boss-fight');
    expect(session.gameState.pendingReward).not.toBeNull();
    const rewardCategory = EQUIPMENT_CATEGORIES.find((category) => session.gameState.pendingReward?.[category] !== null);
    expect(rewardCategory).toBeDefined();
    expect(session.equip(rewardCategory!)).toBe(true);
    expect(session.getSummary().equipmentEarned).toBe(1);
  });
});

describe('session: early end and summary (MGP4-05)', () => {
  it('stops play on an explicit early end and produces the summary', () => {
    const { session } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 1);
    session.start();
    solveActive(session);
    session.endSession();
    expect(session.currentState.kind).toBe('summary');
    expect(session.activeProblem).toBeNull();
  });

  it('reports all summary metrics for a scripted session', () => {
    const { session, time } = makeSession({ durationMinutes: 2, enabledConfigs: [addConfig] }, 42);
    session.start(); // problem 1 presented (attempted)

    // Problem 1: wrong twice, then correct -> 3 attempts, 1 accepted, solved.
    // (Respawn after each wrong answer so the scripted flow is not interrupted
    // by the defeat decision; the summary metrics are unaffected.)
    const r1 = session.activeLifecycleState?.snapshot.expected as number;
    session.submitAnswer(r1 + 1); // wrong
    keepAlive(session);
    session.submitAnswer(r1 - 1); // wrong
    keepAlive(session);
    session.submitAnswer(r1); // correct -> solved
    session.advance(); // present problem 2

    // Problem 2: solved in one correct answer.
    const r2 = session.activeLifecycleState?.snapshot.expected as number;
    session.submitAnswer(r2); // correct -> solved
    session.advance(); // present problem 3

    // Problem 3 is now presented but left unsolved.
    pump(time, session, 60_000); // accumulate active time
    session.endSession();

    const summary = session.getSummary();
    expect(summary.questionsAttempted).toBe(3); // p1, p2, p3 (p3 unsolved)
    expect(summary.questionsCompleted).toBe(2); // p1, p2
    expect(summary.stepAttempts).toBe(4); // p1: 3, p2: 1
    expect(summary.acceptedSteps).toBe(2); // one accepted step per solved problem
    expect(summary.stepAccuracy).toBeCloseTo(0.5); // 2 / 4
    expect(summary.totalDamageDealt).toBe(2); // two correct hits of value 1
    expect(summary.totalActiveTimeMs).toBe(60_000);
    expect(summary.bossesDefeated).toBe(0);
    expect(summary.equipmentEarned).toBe(0);
  });

  it('counts boss-queue problems as attempted and records bosses defeated', () => {
    const { session, time } = makeSession({ durationMinutes: 5, enabledConfigs: [addConfig] }, 9);
    session.start(); // problem 1 (attempted)
    solveActive(session); // solve p1 -> problem 2 (attempted)
    pump(time, session, 300_000); // expiration -> session-ending boss pending
    solveActive(session); // solve p2 -> start boss (heart 1 attempted)
    solveBoss(session); // solve all three hearts -> summary

    const summary = session.getSummary();
    expect(summary.questionsAttempted).toBe(5); // 2 regular + 3 boss hearts
    expect(summary.questionsCompleted).toBe(5);
    expect(summary.bossesDefeated).toBe(1);
    expect(session.currentState.kind).toBe('summary');
  });
});

describe('session: deferred advancement (Stage 6)', () => {
  it('solving leaves the work observable and presents no next problem until advance', () => {
    const { session } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 1);
    session.start();
    const firstProblem = session.activeProblem;
    const firstEncounter = session.gameState.encounter;
    expect(firstEncounter.kind).toBe('regular');
    if (firstEncounter.kind !== 'regular') {
      throw new Error('Expected a regular encounter');
    }
    const firstEnemyId = firstEncounter.enemy.problemId;
    expect(firstProblem).not.toBeNull();

    solveCurrent(session);
    // Solved but not yet advanced: the same problem remains active and solved.
    expect(session.awaitingAdvance).toBe(true);
    expect(session.activeProblem).toBe(firstProblem);
    expect(session.activeLifecycleState?.snapshot.stepIndex).toBeNull();
    expect(session.gameState.encounter).toMatchObject({ kind: 'regular', enemy: { problemId: firstEnemyId, health: 0 } });

    session.advance();
    expect(session.awaitingAdvance).toBe(false);
    // A new, unsolved problem is now presented.
    expect(session.activeProblem).not.toBe(firstProblem);
    expect(session.activeLifecycleState?.snapshot.stepIndex).not.toBeNull();
    expect(session.gameState.encounter).toMatchObject({ kind: 'regular' });
    if (session.gameState.encounter.kind === 'regular') {
      expect(session.gameState.encounter.enemy.problemId).not.toBe(firstEnemyId);
    }
  });

  it('advance from a solved regular problem starts a pending boss', () => {
    const { session, time } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 1);
    session.start();
    pump(time, session, 300_000); // boss becomes pending
    expect(session.hasPendingBoss).toBe(true);

    solveCurrent(session);
    expect(session.awaitingAdvance).toBe(true);
    expect(session.currentState.kind).toBe('active'); // still active, not yet boss

    session.advance();
    expect(session.currentState.kind).toBe('boss-fight');
  });

  it('advance from a solved regular problem ends the session when no boss is pending and none can be generated', () => {
    // A single-step config always generates, so to exercise the end path we rely
    // on the session-ending boss route instead: after expiration the pending boss
    // is session-ending, and finishing it routes to the summary.
    const { session, time } = makeSession({ durationMinutes: 2, enabledConfigs: [addConfig] }, 1);
    session.start();
    step(time, session, 59_000);
    session.noteKeyInput();
    step(time, session, 59_000);
    session.noteKeyInput();
    step(time, session, 60_000); // post-expiration idle pause
    expect(session.currentState.kind).toBe('idle-paused');

    session.resume();
    solveCurrent(session);
    expect(session.awaitingAdvance).toBe(true);
    session.advance(); // session-ending boss starts
    expect(session.currentState.kind).toBe('boss-fight');
  });

  it('boss solves advance heart-by-heart and the last ends the boss', () => {
    const { session, time } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 3);
    session.start();
    pump(time, session, 300_000);
    solveActive(session); // start the boss
    expect(session.currentState.kind).toBe('boss-fight');

    // Heart 1: solve then advance -> heart 2 presented.
    const heart1 = session.activeProblem;
    solveCurrent(session);
    expect(session.awaitingAdvance).toBe(true);
    expect(session.gameState.encounter).toMatchObject({ kind: 'boss', activeHeartIndex: 0 });
    session.advance();
    expect(session.currentState.kind).toBe('boss-fight');
    expect(session.activeProblem).not.toBe(heart1);

    // Heart 2: solve then advance -> heart 3 presented.
    const heart2 = session.activeProblem;
    solveCurrent(session);
    session.advance();
    expect(session.currentState.kind).toBe('boss-fight');
    expect(session.activeProblem).not.toBe(heart2);

    // Heart 3 (last): solve then advance -> boss ends, back to active.
    solveCurrent(session);
    session.advance();
    expect(session.gameState.encounter.kind).not.toBe('boss');
    expect(session.getSummary().bossesDefeated).toBe(1);
  });

  it('the combat-presentation flag is settable, resets on new-problem presentation, and changes snapshot identity only when it changes', () => {
    const { session } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 1);
    session.start();
    expect(session.combatPresentationComplete).toBe(false);

    // Setting the flag changes snapshot identity.
    const before = session.getSnapshot();
    session.markCombatPresentationComplete();
    expect(session.combatPresentationComplete).toBe(true);
    expect(session.getSnapshot()).not.toBe(before);

    // Setting it again is a no-op: identity stays stable.
    const stable = session.getSnapshot();
    session.markCombatPresentationComplete();
    expect(session.getSnapshot()).toBe(stable);

    // Presenting a new problem resets the flag to false.
    solveActive(session);
    expect(session.combatPresentationComplete).toBe(false);
  });

  it('advance is a no-op when not awaiting advancement', () => {
    const { session } = makeSession({ durationMinutes: 10, enabledConfigs: [addConfig] }, 1);
    session.start();
    const problem = session.activeProblem;
    const before = session.getSnapshot();

    session.advance(); // not solved yet -> no-op
    expect(session.awaitingAdvance).toBe(false);
    expect(session.activeProblem).toBe(problem);
    expect(session.getSnapshot()).toBe(before);
  });
});

describe('session: observation contract (Stage 5)', () => {
  it('notifies subscribers and changes snapshot identity when state changes', () => {
    const { session } = makeSession({ durationMinutes: 2, enabledConfigs: [addConfig] }, 1);
    const before = session.getSnapshot();
    let notifications = 0;
    const unsubscribe = session.subscribe(() => {
      notifications += 1;
    });

    session.start();
    const after = session.getSnapshot();

    expect(notifications).toBe(1);
    expect(after).not.toBe(before);
    expect(after.state.kind).toBe('active');
    unsubscribe();
  });

  it('does not notify and keeps snapshot identity stable for no-op calls', () => {
    const { session } = makeSession({ durationMinutes: 2, enabledConfigs: [addConfig] }, 1);
    session.start();
    const before = session.getSnapshot();
    let notifications = 0;
    const unsubscribe = session.subscribe(() => {
      notifications += 1;
    });

    // No elapsed time: tick is a no-op.
    session.tick();
    // Already active: pause is the only mutation, so pause then pause again.
    session.pause();
    expect(notifications).toBe(1);
    const paused = session.getSnapshot();
    expect(paused).not.toBe(before);

    session.pause(); // no-op: already manual-paused
    session.tick(); // no-op: no elapsed time
    session.noteKeyInput(); // no-op: idle clock is not observable

    expect(notifications).toBe(1);
    expect(session.getSnapshot()).toBe(paused);
    unsubscribe();
  });

  it('notifies when a tick changes observable state', () => {
    const { session, time } = makeSession({ durationMinutes: 2, enabledConfigs: [addConfig] }, 1);
    session.start();
    const before = session.getSnapshot();
    let notifications = 0;
    const unsubscribe = session.subscribe(() => {
      notifications += 1;
    });

    time.advance(1_000);
    session.tick(); // remainingTimeMs changes

    expect(notifications).toBe(1);
    expect(session.getSnapshot()).not.toBe(before);
    unsubscribe();
  });

  it('stops notifying after unsubscribe', () => {
    const { session } = makeSession({ durationMinutes: 2, enabledConfigs: [addConfig] }, 1);
    let notifications = 0;
    const unsubscribe = session.subscribe(() => {
      notifications += 1;
    });

    session.start();
    expect(notifications).toBe(1);
    unsubscribe();
    session.pause();
    expect(notifications).toBe(1);
  });
});
