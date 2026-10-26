import { describe, expect, it } from 'vitest';
import { buildMultiplicationSteps, generateMultiplication, validateMultiplicationConfig } from './multiplication';
import { createSeededRandom } from './common';

describe('multiplication engine', () => {
  it('uses the digit-by-digit model for 23 × 34 (4 mult steps + 3 add steps)', () => {
    // Spec example:
    //   Phase A: 3×4=12, 2×4+1=9, 3×3=9, 2×3=6
    //   Phase B: 2+0=2, 9+9=18, 6+1=7  → result 782
    const steps = buildMultiplicationSteps(23, 34);

    expect(steps).toHaveLength(7);

    // Phase A (multiplication steps), least-significant right digit first.
    expect(steps[0]).toMatchObject({ operation: 'multiplication', left: 3, right: 4, incomingCarry: 0, result: 12, carryOut: 1 });
    expect(steps[1]).toMatchObject({ operation: 'multiplication', left: 2, right: 4, incomingCarry: 1, result: 9, carryOut: 0 });
    expect(steps[2]).toMatchObject({ operation: 'multiplication', left: 3, right: 3, incomingCarry: 0, result: 9, carryOut: 0 });
    expect(steps[3]).toMatchObject({ operation: 'multiplication', left: 2, right: 3, incomingCarry: 0, result: 6, carryOut: 0 });

    // Phase B (partial-product addition), column-wise.
    expect(steps[4]).toMatchObject({ operation: 'addition', result: 2, carryOut: 0 });
    expect(steps[5]).toMatchObject({ operation: 'addition', result: 18, carryOut: 1 });
    expect(steps[6]).toMatchObject({ operation: 'addition', incomingCarry: 1, result: 7, carryOut: 0 });
  });

  it('produces a single step for a 1×1 multiplication (4 × 6 = 24)', () => {
    const steps = buildMultiplicationSteps(4, 6);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ operation: 'multiplication', left: 4, right: 6, result: 24, carryOut: 2 });
  });

  it('omits partial-product addition snapshots for a 2×1 multiplication (23 × 4 = 92)', () => {
    const randomValues = [0.15, 0.34];
    const generated = generateMultiplication(
      { operation: 'multiplication', leftDigits: 2, rightDigits: 1 },
      { random: () => randomValues.shift() ?? 0 },
    );
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    expect(generated.problem.snapshots.map((snapshot) => snapshot.stepOperation)).toEqual(['multiplication', 'multiplication', null]);
    expect(generated.problem.snapshots.map((snapshot) => snapshot.expected)).toEqual([12, 9, null]);
  });

  it('rejects digit counts outside 1–4', () => {
    expect(validateMultiplicationConfig({ operation: 'multiplication', leftDigits: 0, rightDigits: 2 })).toBe('Left operand digit count must be between 1 and 4.');
    expect(validateMultiplicationConfig({ operation: 'multiplication', leftDigits: 5, rightDigits: 2 })).toBe('Left operand digit count must be between 1 and 4.');
    expect(validateMultiplicationConfig({ operation: 'multiplication', leftDigits: 2, rightDigits: 2 })).toBeNull();
  });

  it('generates problems whose result equals the product', () => {
    const random = createSeededRandom(23);
    for (let i = 0; i < 40; i += 1) {
      const result = generateMultiplication({ operation: 'multiplication', leftDigits: 2, rightDigits: 1 }, { random });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.problem.result).toBe(result.problem.left * result.problem.right);
      }
    }
  });

  it('exposes shifted partial products and the final answer in the snapshots', () => {
    const random = createSeededRandom(41);
    for (let i = 0; i < 40; i += 1) {
      const result = generateMultiplication({ operation: 'multiplication', leftDigits: 2, rightDigits: 2 }, { random });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const { problem } = result;
      const complete = problem.snapshots.at(-1);
      expect(complete?.stepIndex).toBeNull();
      expect(complete?.problemMatrix.at(-1)?.map((cell) => cell.kind === 'value' ? String(cell.value) : '').join('')).toBe(String(problem.result));
    }
  });

  it('applies factor range constraints for single-digit-style configs', () => {
    const random = createSeededRandom(29);
    for (let i = 0; i < 40; i += 1) {
      const result = generateMultiplication({ operation: 'multiplication', leftDigits: 1, rightDigits: 1, minFactor: 2, maxFactor: 5 }, { random });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.problem.left).toBeGreaterThanOrEqual(2);
        expect(result.problem.left).toBeLessThanOrEqual(5);
        expect(result.problem.right).toBeGreaterThanOrEqual(2);
        expect(result.problem.right).toBeLessThanOrEqual(5);
      }
    }
  });

  it('enforces forbidden carry mode on Phase A steps only', () => {
    const random = createSeededRandom(31);
    for (let i = 0; i < 40; i += 1) {
      const result = generateMultiplication({ operation: 'multiplication', leftDigits: 1, rightDigits: 1, carryMode: 'forbidden' }, { random });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const phaseA = result.problem.snapshots.filter((snapshot) => snapshot.stepOperation === 'multiplication');
        expect(phaseA.every((snapshot) => snapshot.expected !== null && snapshot.expected < 10)).toBe(true);
      }
    }
  });

  it('is deterministic for identical seeded inputs', () => {
    const config: import('./common').MultiplicationConfig = { operation: 'multiplication', leftDigits: 2, rightDigits: 1 };
    const a = generateMultiplication(config, { random: createSeededRandom(42) });
    const b = generateMultiplication(config, { random: createSeededRandom(42) });
    expect(a).toEqual(b);
  });
});
