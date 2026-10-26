// Public facade for the Mathcraft math domain.
// Re-exports all types/helpers from common, dispatches generation/validation
// to the per-operation engines, and provides grade presets + verification.

import type {
  GeneratedProblem,
  GenerationOptions,
  GenerationResult,
  GradeLevel,
  GradePreset,
  ProblemConfig,
} from './common';
import { generateAddition, validateAdditionConfig } from './addition';
import { generateSubtraction, validateSubtractionConfig } from './subtraction';
import { generateMultiplication, validateMultiplicationConfig } from './multiplication';

// Re-export all public types and helpers.
export type {
  AdditionConfig,
  ArithmeticStepSnapshot,
  CarryMode,
  GeneratedProblem,
  GenerationOptions,
  GenerationResult,
  GradeLevel,
  GradePreset,
  MatrixCell,
  MultiplicationConfig,
  OperatorLine,
  OperationType,
  ProblemConfig,
  RandomSource,
  RowType,
  SubtractionConfig,
} from './common';
export {
  SUPPORTED_OPERATIONS,
  createSeededRandom,
  digitRange,
  isValidDigitCount,
  normalizeBorrowMode,
  normalizeCarryMode,
  pairIsDuplicate,
  randomIntInclusive,
} from './common';

// ─── Dispatch: validation ─────────────────────────────────────────────────────

export function validateProblemConfig(config: ProblemConfig): { ok: true } | { ok: false; reason: string } {
  let reason: string | null;
  switch (config.operation) {
    case 'addition':
      reason = validateAdditionConfig(config);
      break;
    case 'subtraction':
      reason = validateSubtractionConfig(config);
      break;
    case 'multiplication':
      reason = validateMultiplicationConfig(config);
      break;
    default:
      reason = 'Unsupported operation.';
  }
  return reason === null ? { ok: true } : { ok: false, reason };
}

export function assertValidProblemConfig(config: ProblemConfig): void {
  const result = validateProblemConfig(config);
  if (!result.ok) {
    throw new Error(result.reason);
  }
}

// ─── Dispatch: generation ─────────────────────────────────────────────────────

export function generateProblem(config: ProblemConfig, options: GenerationOptions = {}): GenerationResult {
  const validation = validateProblemConfig(config);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason };
  }
  switch (config.operation) {
    case 'addition':
      return generateAddition(config, options);
    case 'subtraction':
      return generateSubtraction(config, options);
    case 'multiplication':
      return generateMultiplication(config, options);
  }
}

// ─── Grade presets ────────────────────────────────────────────────────────────

export function getGradePreset(level: GradeLevel): GradePreset {
  if (level === 2) {
    return {
      name: 'Grade 2',
      enabled: [
        { operation: 'addition', leftDigits: 1, rightDigits: 1, maxResult: 20 },
        { operation: 'subtraction', leftDigits: 1, rightDigits: 1, maxDifference: 20 },
      ],
    };
  }

  if (level === 3) {
    return {
      name: 'Grade 3',
      enabled: [
        { operation: 'multiplication', leftDigits: 1, rightDigits: 1, minFactor: 1, maxFactor: 5 },
        { operation: 'addition', leftDigits: 3, rightDigits: 3, carryMode: 'allowed' },
        { operation: 'subtraction', leftDigits: 3, rightDigits: 3, borrowMode: 'allowed' },
      ],
    };
  }

  return {
    name: 'Grade 4',
    enabled: [
      { operation: 'multiplication', leftDigits: 1, rightDigits: 1, minFactor: 1, maxFactor: 12 },
      { operation: 'addition', leftDigits: 4, rightDigits: 4, carryMode: 'allowed' },
      { operation: 'subtraction', leftDigits: 4, rightDigits: 4, borrowMode: 'allowed' },
      { operation: 'multiplication', leftDigits: 2, rightDigits: 1, carryMode: 'allowed' },
    ],
  };
}

export const GRADE_PRESETS: Record<GradeLevel, GradePreset> = {
  2: getGradePreset(2),
  3: getGradePreset(3),
  4: getGradePreset(4),
};

export const getGradeDefaults = getGradePreset;

// ─── Verification ─────────────────────────────────────────────────────────────

/**
 * Verifies the problem arithmetic and the shape/progression of its work snapshots.
 */
export function verifyProblem(problem: GeneratedProblem): boolean {
  const snapshots = problem.snapshots;
  if (snapshots.length === 0) return false;

  // Check final result.
  if (problem.operation === 'addition' && problem.result !== problem.left + problem.right) {
    return false;
  }
  if (problem.operation === 'subtraction' && problem.result !== problem.left - problem.right) {
    return false;
  }
  if (problem.operation === 'multiplication' && problem.result !== problem.left * problem.right) {
    return false;
  }

  const finalSnapshot = snapshots.at(-1);
  if (finalSnapshot === undefined) return false;
  const answerRowIndex = finalSnapshot.rowTypes.lastIndexOf('number');
  const answerRow = finalSnapshot.problemMatrix[answerRowIndex];
  if (answerRow === undefined || answerRow.some((cell) => cell.kind === 'empty')) return false;
  const answerText = answerRow.map((cell) => cell.kind === 'value' ? String(cell.value) : '').join('');
  if (Number(answerText) !== problem.result) return false;

  return snapshots.every((snapshot, index) => {
    const isComplete = index === snapshots.length - 1;
    const hasRectangularMatrix = snapshot.problemMatrix.length > 0 &&
      snapshot.rowTypes.length === snapshot.problemMatrix.length &&
      snapshot.problemMatrix.every((row) => row.length === snapshot.problemMatrix[0].length);
    const hasValidOperatorLines = snapshot.operatorLines.every((line) =>
      line.afterRow >= 0 && line.afterRow < snapshot.problemMatrix.length - 1,
    );
    if (
      snapshot.problemOperation !== problem.operation ||
      snapshot.operandCount !== 2 ||
      !hasRectangularMatrix ||
      !hasValidOperatorLines
    ) {
      return false;
    }

    if (isComplete) {
      return snapshot.stepIndex === null && snapshot.stepOperation === null && snapshot.expected === null;
    }

    return snapshot.stepIndex === index &&
      snapshot.stepOperation !== null &&
      snapshot.expected !== null &&
      snapshot.problemMatrix.flat().some((cell) => cell.kind === 'empty' && cell.active);
  });
}

export const evaluateProblem = verifyProblem;
