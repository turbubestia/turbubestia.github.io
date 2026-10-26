import { describe, expect, it } from 'vitest';
import { buildAdditionSteps, generateAddition, validateAdditionConfig } from './addition';
import { createSeededRandom } from './common';

describe('addition engine', () => {
  it('orders steps least-significant-first and stores the full column total (36 + 97)', () => {
    // The user's reported case: 36 + 97 = 133.
    // Ones column: 6 + 7 = 13 (write 3, carry 1). Tens column: 3 + 9 + 1 = 13 (write 3, carry 1).
    // The leading carry (1) is auto-placed, not a student step.
    const steps = buildAdditionSteps(36, 97);

    expect(steps).toHaveLength(2);

    // Step 0 is the ones column (rightmost), entered first.
    expect(steps[0]).toMatchObject({
      operation: 'addition',
      left: 6,
      right: 7,
      incomingCarry: 0,
      result: 13, // the FULL value the student enters — not just the written digit
      carryOut: 1,
    });

    // Step 1 is the tens column, entered second.
    expect(steps[1]).toMatchObject({
      operation: 'addition',
      left: 3,
      right: 9,
      incomingCarry: 1,
      result: 13,
      carryOut: 1,
    });
  });

  it('handles a no-carry addition (24 + 35)', () => {
    const steps = buildAdditionSteps(24, 35);
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ left: 4, right: 5, result: 9, carryOut: 0 });
    expect(steps[1]).toMatchObject({ left: 2, right: 3, result: 5, carryOut: 0 });
  });

  it('supports unequal operand lengths (5 + 97)', () => {
    const steps = buildAdditionSteps(5, 97);
    expect(steps).toHaveLength(2);
    // Ones: 5 + 7 = 12. Tens: 0 + 9 + 1 = 10 (write 0, carry 1 → leading digit 1).
    expect(steps[0]).toMatchObject({ left: 5, right: 7, result: 12, carryOut: 1 });
    expect(steps[1]).toMatchObject({ left: 0, right: 9, incomingCarry: 1, result: 10, carryOut: 1 });
  });

  it('rejects digit counts outside 1–4', () => {
    expect(validateAdditionConfig({ operation: 'addition', leftDigits: 0, rightDigits: 2 })).toBe('Left operand digit count must be between 1 and 4.');
    expect(validateAdditionConfig({ operation: 'addition', leftDigits: 5, rightDigits: 2 })).toBe('Left operand digit count must be between 1 and 4.');
    expect(validateAdditionConfig({ operation: 'addition', leftDigits: 2, rightDigits: 0 })).toBe('Right operand digit count must be between 1 and 4.');
    expect(validateAdditionConfig({ operation: 'addition', leftDigits: 2, rightDigits: 2 })).toBeNull();
  });

  it('generates valid problems that respect maxResult and carryMode', () => {
    const random = createSeededRandom(11);
    for (let i = 0; i < 50; i += 1) {
      const result = generateAddition({ operation: 'addition', leftDigits: 2, rightDigits: 2, maxResult: 150 }, { random });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.problem.result).toBeLessThanOrEqual(150);
        expect(result.problem.result).toBe(result.problem.left + result.problem.right);
      }
    }
  });

  it('enforces required carry mode', () => {
    const random = createSeededRandom(3);
    for (let i = 0; i < 30; i += 1) {
      const result = generateAddition({ operation: 'addition', leftDigits: 2, rightDigits: 2, carryMode: 'required' }, { random });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(buildAdditionSteps(result.problem.left, result.problem.right).some((s) => s.carryOut > 0)).toBe(true);
      }
    }
  });

  it('enforces forbidden carry mode', () => {
    const random = createSeededRandom(5);
    for (let i = 0; i < 30; i += 1) {
      const result = generateAddition({ operation: 'addition', leftDigits: 2, rightDigits: 2, carryMode: 'forbidden' }, { random });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(buildAdditionSteps(result.problem.left, result.problem.right).every((s) => s.carryOut === 0)).toBe(true);
      }
    }
  });

  it('is deterministic for identical seeded inputs', () => {
    const config: import('./common').AdditionConfig = { operation: 'addition', leftDigits: 2, rightDigits: 2 };
    const a = generateAddition(config, { random: createSeededRandom(42) });
    const b = generateAddition(config, { random: createSeededRandom(42) });
    expect(a).toEqual(b);
  });

  it('prevents an exact repeated ordered pair', () => {
    // Force the generator to keep producing [9, 9] until it exhausts attempts.
    const result = generateAddition(
      { operation: 'addition', leftDigits: 1, rightDigits: 1 },
      { previousPair: [9, 9], random: () => 0.99, maxAttempts: 4 },
    );
    expect(result.ok).toBe(false);
  });
});
