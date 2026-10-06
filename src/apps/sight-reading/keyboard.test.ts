import { describe, it, expect } from 'vitest';
import { StaffNote } from './note';
import {
  buildKeyboard,
  KEY_PALETTE,
  WHITE_KEY_COUNT,
  WHITE_KEY_WIDTH,
  WHITE_KEY_HEIGHT,
  BLACK_KEY_WIDTH,
  BLACK_KEY_HEIGHT,
  C4_INDEX,
  type KeyState,
  type KeyStates,
} from './keyboard';

function allDefault(): KeyStates {
  return new Array<KeyState>(WHITE_KEY_COUNT).fill('default');
}

/** The white-key index `i` that a black key centered at `center` straddles (between i and i+1). */
function boundaryIndex(center: number): number {
  return Math.round(center / WHITE_KEY_WIDTH) - 1;
}

describe('buildKeyboard — white keys', () => {
  it('produces exactly 52 white keys ordered A0 (leftmost) to C8 (rightmost)', () => {
    const { whiteKeys } = buildKeyboard(allDefault());
    expect(whiteKeys).toHaveLength(52);
    for (let i = 0; i < whiteKeys.length; i++) {
      expect(whiteKeys[i].index).toBe(i);
    }
    // leftmost is A0, rightmost is C8
    expect(new StaffNote(whiteKeys[0].index).toString()).toBe('A/0');
    expect(new StaffNote(whiteKeys[whiteKeys.length - 1].index).toString()).toBe('C/8');
  });

  it('tiles contiguously: each width is 1/52 and the total span is exactly 1.0', () => {
    const { whiteKeys } = buildKeyboard(allDefault());
    for (const key of whiteKeys) {
      expect(key.width).toBeCloseTo(WHITE_KEY_WIDTH, 12);
      expect(key.height).toBeCloseTo(WHITE_KEY_HEIGHT, 12);
    }
    expect(whiteKeys[0].x).toBeCloseTo(0, 12);
    for (let i = 1; i < whiteKeys.length; i++) {
      // contiguous: next key starts exactly where the previous one ends
      expect(whiteKeys[i].x).toBeCloseTo(whiteKeys[i - 1].x + WHITE_KEY_WIDTH, 12);
    }
    const last = whiteKeys[whiteKeys.length - 1];
    expect(last.x + last.width).toBeCloseTo(1.0, 12);
  });
});

describe('buildKeyboard — black keys', () => {
  it('produces exactly 36 black keys', () => {
    const { blackKeys } = buildKeyboard(allDefault());
    expect(blackKeys).toHaveLength(36);
  });

  it('places each black key only between C–D, F–G, or G–A white-key pairs', () => {
    const { blackKeys } = buildKeyboard(allDefault());
    // A black key sits between exactly these adjacent white-key pairs:
    // C# (C–D), D# (D–E), F# (F–G), G# (G–A), A# (A–B).
    const allowed: [string, string][] = [
      ['C', 'D'],
      ['D', 'E'],
      ['F', 'G'],
      ['G', 'A'],
      ['A', 'B'],
    ];
    for (const key of blackKeys) {
      const center = key.x + key.width / 2;
      const i = boundaryIndex(center);
      const leftName = new StaffNote(i).name;
      const rightName = new StaffNote(i + 1).name;
      expect(allowed.some(([a, b]) => a === leftName && b === rightName)).toBe(true);
    }
  });

  it('has no black key at the A0 left edge or the C8 right edge', () => {
    const { blackKeys } = buildKeyboard(allDefault());
    for (const key of blackKeys) {
      const center = key.x + key.width / 2;
      // not centered on the far-left boundary (x=0) nor the far-right boundary (x=1)
      expect(center).toBeGreaterThan(WHITE_KEY_WIDTH / 2);
      expect(center).toBeLessThan(1.0 - WHITE_KEY_WIDTH / 2);
    }
  });

  it('has width 0.6× the white-key width and a height shorter than the white keys', () => {
    const { blackKeys } = buildKeyboard(allDefault());
    for (const key of blackKeys) {
      expect(key.width).toBeCloseTo(BLACK_KEY_WIDTH, 12);
      expect(key.width).toBeCloseTo(0.6 * WHITE_KEY_WIDTH, 12);
      expect(key.height).toBeCloseTo(BLACK_KEY_HEIGHT, 12);
      // black keys do not extend below the white-key baseline
      expect(key.height).toBeLessThan(WHITE_KEY_HEIGHT);
    }
  });
});

describe('buildKeyboard — color-state mapping', () => {
  it('resolves each state to its palette color and every key to exactly one of the four colors', () => {
    const states = allDefault();
    states[3] = 'left';
    states[10] = 'right';
    states[20] = 'overlap';
    const { whiteKeys } = buildKeyboard(states);

    expect(whiteKeys[3].fill).toBe(KEY_PALETTE.left);
    expect(whiteKeys[10].fill).toBe(KEY_PALETTE.right);
    expect(whiteKeys[20].fill).toBe(KEY_PALETTE.overlap);
    expect(whiteKeys[0].fill).toBe(KEY_PALETTE.default);

    const palette = new Set<string>(Object.values(KEY_PALETTE));
    for (const key of whiteKeys) {
      expect(palette.has(key.fill)).toBe(true);
    }
  });

  it('resolves an absent/undefined entry to default white rather than throwing', () => {
    const states = allDefault();
    delete states[7]; // simulate a missing entry
    const { whiteKeys } = buildKeyboard(states);
    expect(whiteKeys[7].fill).toBe(KEY_PALETTE.default);
  });

  it('keeps the four palette colors mutually distinguishable', () => {
    const values = Object.values(KEY_PALETTE);
    expect(new Set(values).size).toBe(4);
  });
});

describe('buildKeyboard — C4 label position', () => {
  it('exposes the C4 white-key index matching the StaffNote constructor', () => {
    expect(C4_INDEX).toBe(new StaffNote('C', '', 4).index);
    expect(C4_INDEX).toBeGreaterThanOrEqual(0);
    expect(C4_INDEX).toBeLessThan(WHITE_KEY_COUNT);
    // sanity: that index really is C4
    expect(new StaffNote(C4_INDEX).toString()).toBe('C/4');
  });
});
