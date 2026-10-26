import { describe, expect, it } from 'vitest';
import {
  createSeededRandom,
  digitRange,
  isValidDigitCount,
  normalizeBorrowMode,
  normalizeCarryMode,
  pairIsDuplicate,
  randomIntInclusive,
} from './common';

describe('math common helpers', () => {
  it('produces deterministic sequences from a seeded random source', () => {
    const a = createSeededRandom(101);
    const b = createSeededRandom(101);
    for (let i = 0; i < 20; i += 1) {
      expect(a()).toBe(b());
    }
  });

  it('keeps randomIntInclusive within the inclusive bounds', () => {
    const random = createSeededRandom(7);
    for (let i = 0; i < 200; i += 1) {
      const value = randomIntInclusive(3, 9, random);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(9);
    }
  });

  it('computes digit ranges without leading zeros', () => {
    expect(digitRange(1)).toEqual({ min: 1, max: 9 });
    expect(digitRange(2)).toEqual({ min: 10, max: 99 });
    expect(digitRange(3)).toEqual({ min: 100, max: 999 });
    expect(digitRange(4)).toEqual({ min: 1000, max: 9999 });
  });

  it('accepts digit counts 1–4 and rejects anything else', () => {
    for (const n of [1, 2, 3, 4]) {
      expect(isValidDigitCount(n)).toBe(true);
    }
    expect(isValidDigitCount(0)).toBe(false);
    expect(isValidDigitCount(5)).toBe(false);
    expect(isValidDigitCount(2.5)).toBe(false);
  });

  it('normalizes carry and borrow modes, defaulting to allowed', () => {
    expect(normalizeCarryMode({ carryMode: 'required' })).toBe('required');
    expect(normalizeCarryMode({})).toBe('allowed');
    expect(normalizeBorrowMode({ borrowMode: 'forbidden' })).toBe('forbidden');
    expect(normalizeBorrowMode({})).toBe('allowed');
  });

  it('detects exact ordered-pair duplicates only', () => {
    expect(pairIsDuplicate([2, 4], 2, 4)).toBe(true);
    // Reversed pair is not a duplicate.
    expect(pairIsDuplicate([2, 4], 4, 2)).toBe(false);
    expect(pairIsDuplicate(undefined, 2, 4)).toBe(false);
  });
});
