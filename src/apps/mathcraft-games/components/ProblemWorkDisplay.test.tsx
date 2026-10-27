// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { GeneratedProblem, ProblemConfig } from '../math';
import { createSeededRandom, generateProblem } from '../math';
import { presentProblem, type ProblemLifecycleState } from '../math/lifecycle';
import { ProblemWorkDisplay } from './ProblemWorkDisplay';

const singleAdd: ProblemConfig = { operation: 'addition', leftDigits: 1, rightDigits: 1, maxResult: 20 };
const multiAdd: ProblemConfig = { operation: 'addition', leftDigits: 2, rightDigits: 2, carryMode: 'allowed' };
const multiSub: ProblemConfig = { operation: 'subtraction', leftDigits: 2, rightDigits: 2, borrowMode: 'allowed' };

/** Generate a deterministic problem for the config and seed. */
function generate(config: ProblemConfig, seed: number): GeneratedProblem {
  const result = generateProblem(config, { random: createSeededRandom(seed) });
  if (!result.ok) {
    throw new Error(`generation failed for seed ${seed}`);
  }
  return result.problem;
}

/** Present a problem and drive it to a lifecycle state. */
function drive(config: ProblemConfig, seed: number, submitCount = 0): ProblemLifecycleState {
  const lifecycle = presentProblem(generate(config, seed));
  for (let i = 0; i < submitCount; i += 1) {
    const expected = lifecycle.state.snapshot.expected;
    if (expected === null) {
      break;
    }
    lifecycle.submitAnswer(expected);
  }
  return lifecycle.state;
}

/** Find a seed whose generated problem has at least `minSteps` steps. */
function findSeed(config: ProblemConfig, minSteps: number): number {
  for (let seed = 1; seed < 500; seed += 1) {
    if (generate(config, seed).snapshots.length - 1 >= minSteps) {
      return seed;
    }
  }
  throw new Error('no seed found with enough steps');
}

/**
 * Find a seed where submitting the first step's correct result leaves exactly one
 * accepted step and an unsolved problem (a true intermediate state).
 */
function findPartialSeed(config: ProblemConfig): number {
  for (let seed = 1; seed < 500; seed += 1) {
    const lifecycle = presentProblem(generate(config, seed));
    const expected = lifecycle.state.snapshot.expected;
    if (expected === null) {
      continue;
    }
    lifecycle.submitAnswer(expected);
    if (lifecycle.state.snapshot.stepIndex === 1) {
      return seed;
    }
  }
  throw new Error('no seed found with a partial intermediate state');
}

describe('ProblemWorkDisplay (MGP6-02)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the operation label and step progress for an unsolved single-digit problem', () => {
    render(<ProblemWorkDisplay lifecycle={drive(singleAdd, 1)} />);
    expect(screen.getByText('Addition')).not.toBeNull();
    expect(screen.getByText('Step 1 of 1')).not.toBeNull();
  });

  it('shows the operands and a placeholder answer slot while unsolved', () => {
    const state = drive(singleAdd, 1);
    expect(state.snapshot.stepIndex).not.toBeNull();
    const { container } = render(<ProblemWorkDisplay lifecycle={state} />);
    expect(container.textContent).toContain(String(state.problem.left));
    expect(container.textContent).toContain(String(state.problem.right));
    // The answer slot shows the placeholder dot until a correct final step.
    expect(container.textContent).toContain('·');
  });

  it('shows accepted work and highlights the completed answer green once solved', () => {
    const state = drive(singleAdd, 1, 1); // single-step: one correct submission solves it
    expect(state.snapshot.stepIndex).toBeNull();
    const { container } = render(<ProblemWorkDisplay lifecycle={state} />);
    expect(container.textContent).toContain(String(state.problem.result));
    // The completed answer carries the green highlight class.
    const green = Array.from(container.querySelectorAll('.text-green-300'));
    expect(green.some((el) => el.textContent === String(state.problem.result))).toBe(true);
  });

  it('identifies the active step while a multi-step problem is partially accepted', () => {
    const seed = findPartialSeed(multiAdd);
    const state = drive(multiAdd, seed, 1); // accept one step, leave the rest unsolved
    expect(state.snapshot.stepIndex).not.toBeNull();
    expect(state.snapshot.stepIndex).toBe(1);
    const { container } = render(<ProblemWorkDisplay lifecycle={state} />);
    // The active step and expected value come from the domain snapshot.
    expect(state.snapshot.stepIndex).toBe(1);
    expect(state.snapshot.expected).not.toBeNull();
    expect(state.snapshot.problemMatrix.flat().some((cell) => cell.kind === 'empty' && cell.active)).toBe(true);
    // The step-progress line is supplied by lifecycle metadata.
    expect(screen.getByText(/Step \d+ of \d+/)).not.toBeNull();
    const rows = Array.from(container.querySelector('.font-mono')?.children ?? []);
    const answerRowIndex = state.snapshot.rowTypes.findIndex(
      (rowType, rowIndex) => rowIndex >= state.snapshot.operandCount && rowType === 'number',
    );
    expect(rows[answerRowIndex].querySelector('.text-green-300')).not.toBeNull();
  });

  it('highlights accepted subtraction work green while the problem is still active', () => {
    const seed = findPartialSeed(multiSub);
    const state = drive(multiSub, seed, 1);
    const { container } = render(<ProblemWorkDisplay lifecycle={state} />);
    const rows = Array.from(container.querySelector('.font-mono')?.children ?? []);
    const answerRowIndex = state.snapshot.rowTypes.findIndex(
      (rowType, rowIndex) => rowIndex >= state.snapshot.operandCount && rowType === 'number',
    );

    expect(state.snapshot.stepIndex).toBe(1);
    expect(rows[answerRowIndex].querySelector('.text-green-300')).not.toBeNull();
  });

  it('does not show a carry marker before the producing step is answered', () => {
    // Find a seed whose first step has an active destination in a carry row.
    let seed = 1;
    for (; seed < 500; seed += 1) {
      const initialSnapshot = generate(multiAdd, seed).snapshots?.[0];
      const activeCarry = initialSnapshot?.rowTypes.some((rowType, rowIndex) =>
        rowType === 'carry' && initialSnapshot.problemMatrix[rowIndex].some((cell) => cell.kind === 'empty' && cell.active),
      );
      if (activeCarry) {
        break;
      }
    }
    const before = drive(multiAdd, seed); // nothing accepted
    const { container: beforeContainer, unmount } = render(<ProblemWorkDisplay lifecycle={before} />);
    // No orange carry box is rendered while no step is accepted.
    expect(beforeContainer.querySelector('.text-amber-400')).toBeNull();
    unmount();

    const after = drive(multiAdd, seed, 1); // accept the LSB step
    const { container: afterContainer } = render(<ProblemWorkDisplay lifecycle={after} />);
    // The carry box now appears above the next column.
    expect(afterContainer.querySelector('.text-amber-400')).not.toBeNull();
  });

  it('renders a columnar layout with the operand digits for an unsolved multi-digit problem', () => {
    const seed = findSeed(multiAdd, 2);
    const state = drive(multiAdd, seed);
    expect(state.snapshot.stepIndex).not.toBeNull();
    const { container } = render(<ProblemWorkDisplay lifecycle={state} />);
    // The columnar layout renders each operand digit in its own block.
    for (const digit of String(state.problem.left)) {
      expect(container.textContent).toContain(digit);
    }
    for (const digit of String(state.problem.right)) {
      expect(container.textContent).toContain(digit);
    }
  });

  it('keeps the full work visible once a multi-digit problem is solved', () => {
    const seed = findSeed(multiAdd, 2);
    const state = drive(multiAdd, seed, 99); // drive to solved
    expect(state.snapshot.stepIndex).toBeNull();
    const { container } = render(<ProblemWorkDisplay lifecycle={state} />);
    // Operands and result digits all remain visible (no collapse to one line).
    for (const digit of String(state.problem.left)) {
      expect(container.textContent).toContain(digit);
    }
    for (const digit of String(state.problem.result)) {
      expect(container.textContent).toContain(digit);
    }
    // The step-progress line is hidden once solved.
    expect(screen.queryByText(/Step \d+ of \d+/)).toBeNull();
  });

  it('shows operands and partial products for an unsolved multi-digit multiplication', () => {
    const mult: ProblemConfig = { operation: 'multiplication', leftDigits: 2, rightDigits: 2 };
    const state = drive(mult, 1);
    expect(state.snapshot.stepIndex).not.toBeNull();
    const { container } = render(<ProblemWorkDisplay lifecycle={state} />);
    // Both operands are visible (as digit blocks), and the × symbol is shown.
    for (const digit of String(state.problem.left)) {
      expect(container.textContent).toContain(digit);
    }
    for (const digit of String(state.problem.right)) {
      expect(container.textContent).toContain(digit);
    }
    expect(container.textContent).toContain('×');
  });

  it('highlights resolved multiplication work green while keeping operands and carries distinct', () => {
    const mult: ProblemConfig = { operation: 'multiplication', leftDigits: 2, rightDigits: 2 };
    let seed = 1;
    for (; seed < 500; seed += 1) {
      const initialSnapshot = generate(mult, seed).snapshots[0];
      if (initialSnapshot.stepOperation === 'multiplication' && (initialSnapshot.expected ?? 0) >= 10) {
        break;
      }
    }
    const state = drive(mult, seed, 1);
    const { container } = render(<ProblemWorkDisplay lifecycle={state} />);
    const matrixRows = Array.from(container.querySelector('.font-mono')?.children ?? []);
    const firstWorkRowIndex = state.snapshot.rowTypes.findIndex(
      (rowType, rowIndex) => rowIndex >= state.snapshot.operandCount && rowType === 'number',
    );

    expect(state.snapshot.stepIndex).toBe(1);
    expect(matrixRows[firstWorkRowIndex].querySelector('.text-green-300')).not.toBeNull();
    expect(matrixRows.slice(0, state.snapshot.operandCount).some((row) => row.querySelector('.text-green-300'))).toBe(false);

    const carryRowIndex = state.snapshot.rowTypes.findIndex((rowType) => rowType === 'carry');
    expect(carryRowIndex).toBeGreaterThanOrEqual(0);
    expect(matrixRows[carryRowIndex].querySelector('.text-amber-400')).not.toBeNull();
  });

  it('keeps the full multiplication work visible once solved (no collapse to a single line)', () => {
    const mult: ProblemConfig = { operation: 'multiplication', leftDigits: 2, rightDigits: 2 };
    const state = drive(mult, 1, 99); // drive to solved
    expect(state.snapshot.stepIndex).toBeNull();
    const { container } = render(<ProblemWorkDisplay lifecycle={state} />);
    // Operands and result all remain visible after solving.
    for (const digit of String(state.problem.left)) {
      expect(container.textContent).toContain(digit);
    }
    for (const digit of String(state.problem.result)) {
      expect(container.textContent).toContain(digit);
    }
  });
});
