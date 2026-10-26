// Shared types and pure helpers for the Mathcraft math domain.
// No imports from operation-specific modules (addition, subtraction, multiplication)
// to keep a clean dependency DAG: common ← operations ← index (barrel).

export const SUPPORTED_OPERATIONS = ['addition', 'subtraction', 'multiplication'] as const;
export type OperationType = (typeof SUPPORTED_OPERATIONS)[number];
export type CarryMode = 'allowed' | 'required' | 'forbidden';
export type GradeLevel = 2 | 3 | 4;
export type RandomSource = () => number;

export type RowType = 'number' | 'carry';

export type MatrixCell =
  | { kind: 'skip' }
  | { kind: 'empty'; active: boolean }
  | { kind: 'value'; value: number };

export interface OperatorLine {
  afterRow: number;
  operation: OperationType;
}
export interface ArithmeticStepSnapshot {
  stepIndex: number | null;
  problemOperation: OperationType;
  stepOperation: OperationType | null;
  operandCount: number;
  expected: number | null;
  rowTypes: readonly RowType[];
  problemMatrix: readonly (readonly MatrixCell[])[];
  operatorLines: readonly OperatorLine[];
}

// ─── Unified problem configuration ────────────────────────────────────────────
// Each operation has ONE config shape. Single-digit is the 1×1 case.
// Digit counts are 1–4 (validated at generation time).

export interface AdditionConfig {
  operation: 'addition';
  leftDigits: number;
  rightDigits: number;
  carryMode?: CarryMode;
  maxResult?: number;
}

export interface SubtractionConfig {
  operation: 'subtraction';
  leftDigits: number;
  rightDigits: number;
  borrowMode?: CarryMode;
  maxDifference?: number;
}

export interface MultiplicationConfig {
  operation: 'multiplication';
  leftDigits: number;
  rightDigits: number;
  carryMode?: CarryMode;
  minFactor?: number;
  maxFactor?: number;
}

export type ProblemConfig = AdditionConfig | SubtractionConfig | MultiplicationConfig;

// ─── Generated problem ────────────────────────────────────────────────────────

export interface GeneratedProblem {
  operation: OperationType;
  left: number;
  right: number;
  result: number;
  snapshots: readonly ArithmeticStepSnapshot[];
}

// ─── Generation options and result ────────────────────────────────────────────

export interface GenerationOptions {
  previousPair?: readonly [number, number];
  random?: RandomSource;
  maxAttempts?: number;
}

export type GenerationResult =
  | { ok: true; problem: GeneratedProblem }
  | { ok: false; reason: string };

// ─── Grade preset ─────────────────────────────────────────────────────────────

export interface GradePreset {
  name: string;
  enabled: ProblemConfig[];
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const MIN_DIGITS = 1;
const MAX_DIGITS = 4;

export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function randomIntInclusive(min: number, max: number, random: RandomSource): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

/** Returns the [min, max] range for a given digit count (no leading zeros). */
export function digitRange(digitCount: number): { min: number; max: number } {
  const min = 10 ** (digitCount - 1);
  const max = 10 ** digitCount - 1;
  return { min, max };
}

/** Validates that a digit count is within the supported 1–4 range. */
export function isValidDigitCount(digitCount: number): boolean {
  return Number.isInteger(digitCount) && digitCount >= MIN_DIGITS && digitCount <= MAX_DIGITS;
}

export function normalizeCarryMode(config: {
  carryMode?: CarryMode;
}): CarryMode {
  const explicit = config.carryMode;
  if (explicit === 'allowed' || explicit === 'required' || explicit === 'forbidden') {
    return explicit;
  }
  return 'allowed';
}

export function normalizeBorrowMode(config: {
  borrowMode?: CarryMode;
}): CarryMode {
  const explicit = config.borrowMode;
  if (explicit === 'allowed' || explicit === 'required' || explicit === 'forbidden') {
    return explicit;
  }
  return 'allowed';
}

/** Checks whether a candidate pair duplicates the immediately previous pair. */
export function pairIsDuplicate(
  previousPair: readonly [number, number] | undefined,
  left: number,
  right: number,
): boolean {
  return previousPair !== undefined && previousPair[0] === left && previousPair[1] === right;
}
