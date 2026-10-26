import { describe, expect, it } from 'vitest';
import { buildSubtractionSteps, generateSubtraction, validateSubtractionConfig } from './subtraction';
import { createSeededRandom } from './common';

describe('subtraction engine', () => {
  it('orders steps least-significant-first and resolves borrowing in-column (100 - 1)', () => {
    // 100 - 1 = 99.
    // Ones: 0 - 1 needs borrow → 9 (borrowOut). Tens: 0 - 0 with borrowIn → 9 (borrowOut).
    // Hundreds: 1 - 0 with borrowIn → 0.
    const steps = buildSubtractionSteps(100, 1);

    expect(steps).toHaveLength(3);
    expect(steps[0]).toMatchObject({ left: 0, right: 1, result: 9, borrowOut: true });
    expect(steps[1]).toMatchObject({ left: 0, right: 0, result: 9, borrowOut: true });
    expect(steps[2]).toMatchObject({ left: 1, right: 0, result: 0, borrowOut: false });
  });

  it('handles a no-borrow subtraction (54 - 23)', () => {
    const steps = buildSubtractionSteps(54, 23);
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ left: 4, right: 3, result: 1, borrowOut: false });
    expect(steps[1]).toMatchObject({ left: 5, right: 2, result: 3, borrowOut: false });
  });

  it('rejects digit counts outside 1–4', () => {
    expect(validateSubtractionConfig({ operation: 'subtraction', leftDigits: 0, rightDigits: 2 })).toBe('Left operand digit count must be between 1 and 4.');
    expect(validateSubtractionConfig({ operation: 'subtraction', leftDigits: 5, rightDigits: 2 })).toBe('Left operand digit count must be between 1 and 4.');
    expect(validateSubtractionConfig({ operation: 'subtraction', leftDigits: 2, rightDigits: 2 })).toBeNull();
  });

  it('generates non-negative problems that respect maxDifference', () => {
    const random = createSeededRandom(13);
    for (let i = 0; i < 50; i += 1) {
      const result = generateSubtraction({ operation: 'subtraction', leftDigits: 2, rightDigits: 2, maxDifference: 40 }, { random });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.problem.result).toBeGreaterThanOrEqual(0);
        expect(result.problem.result).toBeLessThanOrEqual(40);
        expect(result.problem.result).toBe(result.problem.left - result.problem.right);
      }
    }
  });

  it('enforces required borrow mode', () => {
    const random = createSeededRandom(17);
    for (let i = 0; i < 30; i += 1) {
      const result = generateSubtraction({ operation: 'subtraction', leftDigits: 2, rightDigits: 2, borrowMode: 'required' }, { random });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(buildSubtractionSteps(result.problem.left, result.problem.right).some((s) => s.borrowOut)).toBe(true);
      }
    }
  });

  it('enforces forbidden borrow mode', () => {
    const random = createSeededRandom(19);
    for (let i = 0; i < 30; i += 1) {
      const result = generateSubtraction({ operation: 'subtraction', leftDigits: 2, rightDigits: 2, borrowMode: 'forbidden' }, { random });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(buildSubtractionSteps(result.problem.left, result.problem.right).every((s) => !s.borrowOut)).toBe(true);
      }
    }
  });

  it('is deterministic for identical seeded inputs', () => {
    const config: import('./common').SubtractionConfig = { operation: 'subtraction', leftDigits: 2, rightDigits: 2 };
    const a = generateSubtraction(config, { random: createSeededRandom(42) });
    const b = generateSubtraction(config, { random: createSeededRandom(42) });
    expect(a).toEqual(b);
  });
});
