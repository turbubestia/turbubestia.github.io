// Multiplication engine: unified for 1–4 digit operands.
// Uses the spec's digit-by-digit model:
//   Phase A: for each right digit (LSB first), multiply left operand digit-by-digit
//            with carries → one `multiplication` step per (left digit × right digit).
//   Phase B: only when right operand has ≥ 2 digits, add partial products column-wise
//            → `addition` steps (full-result contract).
// carryMode applies to Phase A steps only; Phase B carries are always allowed.

import type { GeneratedProblem, GenerationOptions, GenerationResult, MultiplicationConfig } from './common';
import { digitRange, isValidDigitCount, normalizeCarryMode, pairIsDuplicate, randomIntInclusive } from './common';
import type { ArithmeticCalculation } from './snapshots';
import { buildArithmeticSnapshots } from './snapshots';

export function buildMultiplicationSteps(leftValue: number, rightValue: number): ArithmeticCalculation[] {
  const leftDigits = Array.from(String(leftValue), Number).reverse(); // LSB first
  const rightDigits = Array.from(String(rightValue), Number).reverse(); // LSB first

  const steps: ArithmeticCalculation[] = [];
  let stepIndex = 0;

  // Phase A: for each right digit (LSB first), multiply left operand digit-by-digit.
  const rawPartialProducts: number[] = [];

  for (let r = 0; r < rightDigits.length; r++) {
    const rightDigit = rightDigits[r];
    let carry = 0;
    let partialProduct = 0;

    for (let l = 0; l < leftDigits.length; l++) {
      const leftDigit = leftDigits[l];
      const result = leftDigit * rightDigit + carry;
      const carryOut = Math.floor(result / 10);
      steps.push({ operation: 'multiplication', left: leftDigit, right: rightDigit, incomingCarry: carry, result, carryOut, borrowOut: false });
      stepIndex++;
      partialProduct += (result % 10) * 10 ** l;
      carry = carryOut;
    }

    // Final carry from the most-significant left digit is part of the partial
    // product (not a separate student step).
    if (carry > 0) {
      partialProduct += carry * 10 ** leftDigits.length;
    }

    rawPartialProducts.push(partialProduct);
  }

  // Phase B: add partial products column-wise (only when right operand has ≥ 2 digits).
  // The shifted values (each raw PP × 10^r) align the partial products by place
  // value so the column sums are correct.
  if (rightDigits.length >= 2) {
    const shiftedPartialProducts = rawPartialProducts.map((pp, r) => pp * 10 ** r);
    const maxCols = Math.max(...shiftedPartialProducts.map((pp) => String(pp).length));
    let carry = 0;

    for (let col = 0; col < maxCols; col++) {
      // Sum all partial product digits at this column.
      let columnSum = carry;
      const digitParts: string[] = [];
      for (const pp of shiftedPartialProducts) {
        const ppDigits = Array.from(String(pp), Number).reverse(); // LSB first
        const d = ppDigits[col] ?? 0;
        columnSum += d;
        digitParts.push(String(d));
      }

      const carryOut = Math.floor(columnSum / 10);
      // left = sum of PP digits at this column, right = 0 (multi-operand addition).
      const ppDigitSum = columnSum - carry;
      steps.push({ operation: 'addition', left: ppDigitSum, right: 0, incomingCarry: carry, result: columnSum, carryOut, borrowOut: false });
      stepIndex++;
      carry = carryOut;
    }
  }

  return steps;
}

function buildMultiplicationProblem(config: MultiplicationConfig, left: number, right: number): GeneratedProblem {
  const result = left * right;
  const minFactor = config.minFactor;
  const maxFactor = config.maxFactor;
  if (minFactor !== undefined && (left < minFactor || right < minFactor)) {
    throw new Error('Multiplication operands below the configured minimum factor.');
  }
  if (maxFactor !== undefined && (left > maxFactor || right > maxFactor)) {
    throw new Error('Multiplication operands above the configured maximum factor.');
  }

  const steps = buildMultiplicationSteps(left, right);
  const carryMode = normalizeCarryMode(config);
  // carryMode applies to Phase A (multiplication) steps only.
  const phaseASteps = steps.filter((s) => s.operation === 'multiplication');
  const hasPhaseACarry = phaseASteps.some((s) => s.carryOut > 0);
  if (carryMode === 'required' && !hasPhaseACarry) {
    throw new Error('Required carry mode but no Phase A multiplication step carries.');
  }
  if (carryMode === 'forbidden' && hasPhaseACarry) {
    throw new Error('Carry forbidden but a Phase A multiplication step requires a carry.');
  }

  const problem: GeneratedProblem = {
    operation: 'multiplication',
    left,
    right,
    result,
    snapshots: buildArithmeticSnapshots({ operation: 'multiplication', left, right, result }, steps),
  };
  return problem;
}

export function validateMultiplicationConfig(config: MultiplicationConfig): string | null {
  if (!isValidDigitCount(config.leftDigits)) {
    return 'Left operand digit count must be between 1 and 4.';
  }
  if (!isValidDigitCount(config.rightDigits)) {
    return 'Right operand digit count must be between 1 and 4.';
  }
  if (config.minFactor !== undefined && (!Number.isInteger(config.minFactor) || config.minFactor < 1)) {
    return 'Multiplication minFactor must be a positive integer.';
  }
  if (config.maxFactor !== undefined && (!Number.isInteger(config.maxFactor) || config.maxFactor > 9999)) {
    return 'Multiplication maxFactor must be an integer <= 9999.';
  }
  if (config.minFactor !== undefined && config.maxFactor !== undefined && config.minFactor > config.maxFactor) {
    return 'Multiplication minFactor cannot exceed maxFactor.';
  }
  return null;
}

export function generateMultiplication(config: MultiplicationConfig, options: GenerationOptions = {}): GenerationResult {
  const validation = validateMultiplicationConfig(config);
  if (validation !== null) {
    return { ok: false, reason: validation };
  }
  const random = options.random ?? Math.random;
  const previousPair = options.previousPair;
  const maxAttempts = Math.max(options.maxAttempts ?? 200, 1);
  const leftRange = digitRange(config.leftDigits);
  const rightRange = digitRange(config.rightDigits);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let left = randomIntInclusive(leftRange.min, leftRange.max, random);
    let right = randomIntInclusive(rightRange.min, rightRange.max, random);

    // Apply factor range constraints (for single-digit-style configs).
    if (config.minFactor !== undefined) {
      left = Math.max(left, config.minFactor);
      right = Math.max(right, config.minFactor);
    }
    if (config.maxFactor !== undefined) {
      left = Math.min(left, config.maxFactor);
      right = Math.min(right, config.maxFactor);
    }

    if (pairIsDuplicate(previousPair, left, right)) {
      continue;
    }
    try {
      return { ok: true, problem: buildMultiplicationProblem(config, left, right) };
    } catch {
      continue;
    }
  }

  return { ok: false, reason: 'No eligible multiplication problem could be generated.' };
}
