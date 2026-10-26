// Subtraction engine: unified for 1–4 digit operands.
// Steps are ordered least-significant-first (right-to-left).
// Each step's `result` is the single resolved digit (0–9); borrowing is
// resolved within the column and surfaced via borrowIn/borrowOut.

import type { GeneratedProblem, GenerationOptions, GenerationResult, SubtractionConfig } from './common';
import { digitRange, isValidDigitCount, normalizeBorrowMode, pairIsDuplicate, randomIntInclusive } from './common';
import type { ArithmeticCalculation } from './snapshots';
import { buildArithmeticSnapshots } from './snapshots';

export function buildSubtractionSteps(leftValue: number, rightValue: number): ArithmeticCalculation[] {
  const leftDigits = Array.from(String(leftValue), Number);
  const rightDigits = Array.from(String(rightValue), Number);
  const maxDigits = Math.max(leftDigits.length, rightDigits.length);
  const steps: ArithmeticCalculation[] = [];
  let borrow = 0;

  for (let col = 0; col < maxDigits; col += 1) {
    const leftDigit = leftDigits[leftDigits.length - 1 - col] ?? 0;
    const rightDigit = rightDigits[rightDigits.length - 1 - col] ?? 0;
    const adjustedLeft = leftDigit - borrow;
    const needsBorrow = adjustedLeft < rightDigit;
    const result = needsBorrow ? adjustedLeft + 10 - rightDigit : adjustedLeft - rightDigit;
    steps.push({ operation: 'subtraction', left: leftDigit, right: rightDigit, incomingCarry: 0, result, carryOut: 0, borrowOut: needsBorrow });
    borrow = needsBorrow ? 1 : 0;
  }

  return steps;
}

function buildSubtractionProblem(config: SubtractionConfig, left: number, right: number): GeneratedProblem {
  if (left < right) {
    throw new Error('Subtraction must remain non-negative.');
  }
  const result = left - right;
  const maxDifference = config.maxDifference;
  if (maxDifference !== undefined && result > maxDifference) {
    throw new Error('Subtraction result exceeds the configured maximum difference.');
  }
  const steps = buildSubtractionSteps(left, right);
  const borrowMode = normalizeBorrowMode(config);
  const hasBorrow = steps.some((s) => s.borrowOut);
  if (borrowMode === 'required' && !hasBorrow) {
    throw new Error('Required borrow mode but no borrow step.');
  }
  if (borrowMode === 'forbidden' && hasBorrow) {
    throw new Error('Borrow forbidden but a borrow was required.');
  }
  return {
    operation: 'subtraction',
    left,
    right,
    result,
    snapshots: buildArithmeticSnapshots({ operation: 'subtraction', left, right, result }, steps),
  };
}

export function validateSubtractionConfig(config: SubtractionConfig): string | null {
  if (!isValidDigitCount(config.leftDigits)) {
    return 'Left operand digit count must be between 1 and 4.';
  }
  if (!isValidDigitCount(config.rightDigits)) {
    return 'Right operand digit count must be between 1 and 4.';
  }
  if (config.maxDifference !== undefined && (!Number.isInteger(config.maxDifference) || config.maxDifference < 0)) {
    return 'Subtraction maxDifference must be a non-negative integer.';
  }
  return null;
}

export function generateSubtraction(config: SubtractionConfig, options: GenerationOptions = {}): GenerationResult {
  const validation = validateSubtractionConfig(config);
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
    const rightUpperBound = Math.min(left, rightRange.max);
    const right = randomIntInclusive(rightRange.min, Math.max(rightRange.min, rightUpperBound), random);
    if (pairIsDuplicate(previousPair, left, right)) {
      continue;
    }
    try {
      return { ok: true, problem: buildSubtractionProblem(config, left, right) };
    } catch {
      continue;
    }
  }

  return { ok: false, reason: 'No eligible subtraction problem could be generated.' };
}
