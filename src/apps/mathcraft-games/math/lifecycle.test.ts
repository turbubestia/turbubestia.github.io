import { describe, expect, it } from 'vitest';
import type { GeneratedProblem } from './common';
import { createProblemLifecycle, presentProblem } from './lifecycle';
import { buildMultiplicationSteps } from './multiplication';
import { buildArithmeticSnapshots } from './snapshots';

// 23 × 34: digit-by-digit model (4 mult steps + 3 add steps = 7 total).
const makeMultiplicationProblem = (): GeneratedProblem => ({
  operation: 'multiplication',
  left: 23,
  right: 34,
  result: 782,
  snapshots: buildArithmeticSnapshots(
    { operation: 'multiplication', left: 23, right: 34, result: 782 },
    buildMultiplicationSteps(23, 34),
  ),
});

// 4 × 6: single-step multiplication.
const makeSingleDigitMultiplicationProblem = (): GeneratedProblem => ({
  operation: 'multiplication',
  left: 4,
  right: 6,
  result: 24,
  snapshots: buildArithmeticSnapshots(
    { operation: 'multiplication', left: 4, right: 6, result: 24 },
    buildMultiplicationSteps(4, 6),
  ),
});

describe('math problem lifecycle', () => {
  it('marks a problem attempted on presentation and advances correctly through valid submissions', () => {
    const lifecycle = createProblemLifecycle(makeMultiplicationProblem());

    expect(lifecycle.state.attempted).toBe(true);
    expect(lifecycle.state.snapshot.stepIndex).toBe(0);
    const initialSnapshot = lifecycle.state.snapshot;
    // 4 multiplication steps × 2 + 3 addition steps × 1 = 11.
    expect(lifecycle.state.correctHitBudget).toBe(11);

    // Step 0: 3×4=12 (multiplication, value 2)
    const first = lifecycle.submitAnswer(12);
    expect(first.status).toBe('accepted');
    expect(first.event).toMatchObject({ type: 'hit', outcome: 'correct', value: 2 });
    expect(lifecycle.state.snapshot.stepIndex).toBe(1);
    expect(lifecycle.state.snapshot).not.toBe(initialSnapshot);
    expect(lifecycle.state.snapshot.problemMatrix.flat().some((cell) => cell.kind === 'value' && cell.value === 2)).toBe(true);

    // Step 1: 2×4+1=9 (multiplication, value 2)
    const second = lifecycle.submitAnswer(9);
    expect(second.status).toBe('accepted');
    expect(second.event).toMatchObject({ type: 'hit', outcome: 'correct', value: 2 });
    expect(lifecycle.state.snapshot.stepIndex).toBe(2);

    // Step 6 (final): 6+1=7 (addition, value 1) → solved
    lifecycle.submitAnswer(9); // step 2
    lifecycle.submitAnswer(6); // step 3
    lifecycle.submitAnswer(2); // step 4
    lifecycle.submitAnswer(18); // step 5
    const final = lifecycle.submitAnswer(7); // step 6
    expect(final.status).toBe('solved');
    expect(final.event).toMatchObject({ type: 'solved', totalSteps: 7 });
    expect(lifecycle.state.snapshot.stepIndex).toBeNull();
  });

  it('preserves the current step and accepted work after a wrong answer', () => {
    const lifecycle = presentProblem(makeMultiplicationProblem());

    const originalSnapshot = lifecycle.state.snapshot;
    const wrong = lifecycle.submitAnswer('91');
    expect(wrong.status).toBe('wrong');
    expect(wrong.event).toMatchObject({ type: 'hit', outcome: 'wrong', value: 1 });
    expect(lifecycle.state.snapshot).toBe(originalSnapshot);

    const correct = lifecycle.submitAnswer(12);
    expect(correct.status).toBe('accepted');
    expect(correct.event).toMatchObject({ type: 'hit', outcome: 'correct', value: 2 });
    expect(lifecycle.state.snapshot.stepIndex).toBe(1);
  });

  it('drops invalid submissions without marking them as wrong attempts', () => {
    const lifecycle = createProblemLifecycle(makeSingleDigitMultiplicationProblem());

    const invalid = lifecycle.submitAnswer('abc');
    expect(invalid.status).toBe('invalid');
    expect(invalid.event).toBeNull();
    expect(lifecycle.state.snapshot.stepIndex).toBe(0);
    expect(lifecycle.state.events).toEqual([]);

    const correct = lifecycle.submitAnswer(24);
    expect(correct.status).toBe('solved');
    expect(correct.event).toMatchObject({ type: 'solved', totalSteps: 1 });
    expect(lifecycle.state.events).toEqual([
      expect.objectContaining({ type: 'hit', outcome: 'correct', value: 2 }),
      expect.objectContaining({ type: 'solved', totalSteps: 1 }),
    ]);
  });

  it('emits a single solved event and rejects duplicate submissions after completion', () => {
    const lifecycle = createProblemLifecycle(makeMultiplicationProblem());

    // Solve all 7 steps.
    const results = [12, 9, 9, 6, 2, 18, 7];
    for (const r of results) {
      lifecycle.submitAnswer(r);
    }
    expect(lifecycle.state.snapshot.stepIndex).toBeNull();
    expect(lifecycle.state.events.filter((event) => event.type === 'solved')).toHaveLength(1);

    const repeated = lifecycle.submitAnswer(7);
    expect(repeated.status).toBe('ignored');
    expect(repeated.event).toBeNull();
    expect(lifecycle.state.events.filter((event) => event.type === 'solved')).toHaveLength(1);
  });

  it('uses the ready-made value matrix for correct and wrong hit events', () => {
    const problem = makeSingleDigitMultiplicationProblem();
    const lifecycle = createProblemLifecycle(problem);

    const correct = lifecycle.submitAnswer(24);
    expect(correct.event).toMatchObject({ type: 'solved', totalSteps: 1 });
    expect(lifecycle.state.events).toEqual([
      expect.objectContaining({ type: 'hit', outcome: 'correct', value: 2 }),
      expect.objectContaining({ type: 'solved', totalSteps: 1 }),
    ]);

    const second = createProblemLifecycle(problem);
    const wrong = second.submitAnswer(23);
    expect(wrong.event).toMatchObject({ type: 'hit', outcome: 'wrong', value: 1 });
  });
});
