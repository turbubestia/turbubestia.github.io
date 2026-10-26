// Addition engine: unified for 1–4 digit operands.
// Steps are ordered least-significant-first (right-to-left).
// Each step's `result` is the full column sum (may be ≥ 10).
// A carry-only leading digit is auto-placed, not a student step.

import type { AdditionConfig, GeneratedProblem, GenerationOptions, GenerationResult } from './common';
import { digitRange, isValidDigitCount, normalizeCarryMode, pairIsDuplicate, randomIntInclusive } from './common';
import type { ArithmeticCalculation } from './snapshots';
import { buildArithmeticSnapshots } from './snapshots';

export function buildAdditionSteps(leftValue: number, rightValue: number): ArithmeticCalculation[] {
  const leftDigits = Array.from(String(leftValue), Number);
  const rightDigits = Array.from(String(rightValue), Number);
  const maxDigits = Math.max(leftDigits.length, rightDigits.length);
  const steps: ArithmeticCalculation[] = [];
  let carry = 0;

  for (let col = 0; col < maxDigits; col += 1) {
    const leftDigit = leftDigits[leftDigits.length - 1 - col] ?? 0;
    const rightDigit = rightDigits[rightDigits.length - 1 - col] ?? 0;
    const result = leftDigit + rightDigit + carry;
    const carryOut = Math.floor(result / 10);
    steps.push({ operation: 'addition', left: leftDigit, right: rightDigit, incomingCarry: carry, result, carryOut, borrowOut: false });
    carry = carryOut;
  }

  // A final carry (if any) is auto-placed as the leading result digit, not a step.
  return steps;
}

function buildAdditionProblem(config: AdditionConfig, left: number, right: number): GeneratedProblem {
  const result = left + right;
  const maxResult = config.maxResult;
  if (maxResult !== undefined && result > maxResult) {
    throw new Error('Addition result exceeds the configured maximum.');
  }
  const steps = buildAdditionSteps(left, right);
  const carryMode = normalizeCarryMode(config);
  const hasCarry = steps.some((s) => s.carryOut > 0);
  if (carryMode === 'required' && !hasCarry) {
    throw new Error('Required carry mode but no carry step.');
  }
  if (carryMode === 'forbidden' && hasCarry) {
    throw new Error('Carry forbidden but a carry was required.');
  }
  return {
    operation: 'addition',
    left,
    right,
    result,
    snapshots: buildArithmeticSnapshots({ operation: 'addition', left, right, result }, steps),
  };
}

export function validateAdditionConfig(config: AdditionConfig): string | null {
  if (!isValidDigitCount(config.leftDigits)) {
    return 'Left operand digit count must be between 1 and 4.';
  }
  if (!isValidDigitCount(config.rightDigits)) {
    return 'Right operand digit count must be between 1 and 4.';
  }
  if (config.maxResult !== undefined && (!Number.isInteger(config.maxResult) || config.maxResult < 2)) {
    return 'Addition maxResult must be an integer >= 2.';
  }
  return null;
}

export function generateAddition(config: AdditionConfig, options: GenerationOptions = {}): GenerationResult {
  const validation = validateAdditionConfig(config);
  if (validation !== null) {
    return { ok: false, reason: validation };
  }
  const random = options.random ?? Math.random;
  const previousPair = options.previousPair;
  const maxAttempts = Math.max(options.maxAttempts ?? 150, 1);
  const leftRange = digitRange(config.leftDigits);
  const rightRange = digitRange(config.rightDigits);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const left = randomIntInclusive(leftRange.min, leftRange.max, random);
    const right = randomIntInclusive(rightRange.min, rightRange.max, random);
    if (pairIsDuplicate(previousPair, left, right)) {
      continue;
    }
    try {
      return { ok: true, problem: buildAdditionProblem(config, left, right) };
    } catch {
      continue;
    }
  }

  return { ok: false, reason: 'No eligible addition problem could be generated.' };
}
