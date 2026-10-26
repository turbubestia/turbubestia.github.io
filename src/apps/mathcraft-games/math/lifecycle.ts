import type { ArithmeticStepSnapshot, GeneratedProblem, OperationType } from './common';

export type HitOutcome = 'correct' | 'wrong';
export type SubmissionStatus = 'accepted' | 'wrong' | 'invalid' | 'solved' | 'ignored';

export interface MathHitEvent {
  type: 'hit';
  outcome: HitOutcome;
  value: number;
  stepIndex: number;
  problemId: string;
}

export interface MathSolvedEvent {
  type: 'solved';
  problemId: string;
  totalSteps: number;
}

export interface BossHeartInit {
  problemId: string;
  health: number;
}

export interface MathBossStartEvent {
  type: 'boss_start';
  queuedProblems: number;
  hearts: readonly BossHeartInit[];
}

export interface MathBossEndEvent {
  type: 'boss_end';
}

export type MathEvent = MathHitEvent | MathSolvedEvent | MathBossStartEvent | MathBossEndEvent;

export interface LifecycleSubmitResult {
  status: SubmissionStatus;
  event: MathEvent | null;
  stepIndex: number;
  totalSteps: number;
}

export interface ProblemLifecycleState {
  problem: GeneratedProblem;
  attempted: boolean;
  snapshot: ArithmeticStepSnapshot;
  totalSteps: number;
  events: MathEvent[];
  correctHitBudget: number;
}

export interface ProblemLifecycle {
  readonly state: ProblemLifecycleState;
  submitAnswer: (answer: number | string) => LifecycleSubmitResult;
}

const problemId = () => `problem-${Math.random().toString(36).slice(2, 10)}`;

function getHitValue(stepOperation: OperationType, outcome: HitOutcome): number {
  if (outcome === 'correct') {
    // Operation-based damage per spec: multiplication steps deal 2, all others deal 1.
    return stepOperation === 'multiplication' ? 2 : 1;
  }
  return 1;
}

function getCorrectHitBudget(snapshots: readonly ArithmeticStepSnapshot[]): number {
  // Sum: 2 per multiplication step + 1 per addition/subtraction step.
  return snapshots.reduce((total, snapshot) => {
    if (snapshot.stepOperation === null) return total;
    return total + (snapshot.stepOperation === 'multiplication' ? 2 : 1);
  }, 0);
}

function isValidIntegerSubmission(value: number | string): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isNumericString(value: string): boolean {
  return value.trim() !== '' && /^-?\d+$/.test(value.trim());
}

export function presentProblem(problem: GeneratedProblem): ProblemLifecycle {
  return createProblemLifecycle(problem);
}

export function createProblemLifecycle(problem: GeneratedProblem): ProblemLifecycle {
  const snapshots = problem.snapshots;
  const eventList: MathEvent[] = [];
  let activeStepIndex = 0;
  const problemKey = problemId();
  const currentSnapshot = (): ArithmeticStepSnapshot => snapshots[activeStepIndex];

  const state: ProblemLifecycleState = {
    problem,
    attempted: true,
    snapshot: snapshots[0],
    totalSteps: snapshots.length - 1,
    events: eventList,
    correctHitBudget: getCorrectHitBudget(snapshots),
  };

  const emitHit = (outcome: HitOutcome, snapshot: ArithmeticStepSnapshot): MathHitEvent => {
    const hit: MathHitEvent = {
      type: 'hit',
      outcome,
      value: getHitValue(snapshot.stepOperation ?? 'addition', outcome),
      stepIndex: snapshot.stepIndex ?? activeStepIndex,
      problemId: problemKey,
    };
    eventList.push(hit);
    state.events = eventList;
    return hit;
  };

  const emitSolved = (): MathSolvedEvent => {
    const solvedEvent: MathSolvedEvent = {
      type: 'solved',
      problemId: problemKey,
      totalSteps: snapshots.length - 1,
    };
    eventList.push(solvedEvent);
    state.events = eventList;
    return solvedEvent;
  };

  const updateState = () => {
    state.snapshot = currentSnapshot();
    state.events = [...eventList];
  };

  const lifecycle: ProblemLifecycle = {
    get state() {
      return {
        ...state,
        events: [...state.events],
      };
    },
    submitAnswer(answer: number | string): LifecycleSubmitResult {
      const snapshot = currentSnapshot();
      if (snapshot.expected === null || snapshot.stepIndex === null || snapshot.stepOperation === null) {
        return { status: 'ignored', event: null, stepIndex: activeStepIndex, totalSteps: snapshots.length - 1 };
      }
      const submittedStepIndex = snapshot.stepIndex;

      const normalized: number | null = typeof answer === 'string'
        ? (isNumericString(answer) ? Number(answer) : null)
        : typeof answer === 'number'
          ? answer
          : null;
      if (normalized === null || !isValidIntegerSubmission(normalized)) {
        return { status: 'invalid', event: null, stepIndex: activeStepIndex, totalSteps: snapshots.length - 1 };
      }

      if (normalized !== snapshot.expected) {
        emitHit('wrong', snapshot);
        updateState();
        return {
          status: 'wrong',
          event: eventList[eventList.length - 1] ?? null,
          stepIndex: submittedStepIndex,
          totalSteps: snapshots.length - 1,
        };
      }

      const hitEvent = emitHit('correct', snapshot);
      if (activeStepIndex < snapshots.length - 2) {
        activeStepIndex += 1;
        updateState();
        return {
          status: 'accepted',
          event: hitEvent,
          stepIndex: activeStepIndex,
          totalSteps: snapshots.length - 1,
        };
      }

      activeStepIndex += 1;
      const solvedEvent = emitSolved();
      updateState();
      return {
        status: 'solved',
        event: solvedEvent,
        stepIndex: submittedStepIndex,
        totalSteps: snapshots.length - 1,
      };
    },
  };

  updateState();
  return lifecycle;
}
