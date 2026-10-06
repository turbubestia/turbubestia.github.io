// Pure, framework-free keyboard model for the sight-reading piano.
//
// The keyboard spans the flat natural-note index space used by StaffNote:
// index 0 = A0 (leftmost white key) … index 51 = C8 (rightmost white key).
// There are exactly 52 natural notes in that span, so the 52 white keys map
// 1:1 onto indices 0..51. All geometry is expressed in normalized units where
// the full keyboard width is 1.0 and each white key has width 1/52; because the
// white keys are square, the drawing height also equals 1/52.
//
// This module has no React/DOM/PianoRange/event dependencies so it can be
// unit-tested directly in Node.

import { StaffNote } from './note';

/** Color state of a single white key. */
export type KeyState = 'default' | 'left' | 'right' | 'overlap';

/** Input shape: exactly 52 white-key states, indexed by white-key position. */
export type KeyStates = KeyState[];

/** Fixed palette: four mutually distinguishable fill colors. */
export const KEY_PALETTE = {
  default: '#ffffff', // white
  left: '#93c5fd', // light blue
  right: '#86efac', // light green
  overlap: '#c4b5fd', // light purple
} as const;

/** Fixed fill for every black key. */
export const BLACK_KEY_FILL = '#1f2937';

// --- Geometry (normalized units) -------------------------------------------

/** Number of white keys (A0..C8 inclusive). */
export const WHITE_KEY_COUNT = 52;

/** Width of a single white key. */
export const WHITE_KEY_WIDTH = 1 / WHITE_KEY_COUNT;

/** White keys are square: height equals width. */
export const WHITE_KEY_HEIGHT = 3 * WHITE_KEY_WIDTH;

/** Black keys are 0.6× the white-key width. */
export const BLACK_KEY_WIDTH = 0.6 * WHITE_KEY_WIDTH;

/** Black keys are shorter than white keys (fixed fraction of white-key height). */
export const BLACK_KEY_HEIGHT = 0.62 * WHITE_KEY_HEIGHT;

/** Normalized full-width extent for the SVG viewBox. */
export const KEYBOARD_WIDTH = 1.0;

/** Normalized full-height extent for the SVG viewBox. */
export const KEYBOARD_HEIGHT = WHITE_KEY_HEIGHT;

/**
 * The white-key index of C4 in the flat index space, used to place the single
 * reference label. Derived via the StaffNote name/octave constructor rather
 * than by hand-mapping note names.
 */
export const C4_INDEX = new StaffNote('C', '', 4).index;

/** A single white key with resolved geometry and fill. */
export interface WhiteKey {
  /** Flat natural-note index (0..51). */
  index: number;
  /** Left edge in normalized units. */
  x: number;
  width: number;
  height: number;
  /** Resolved fill color from the palette. */
  fill: string;
}

/** A single black key with resolved geometry. */
export interface BlackKey {
  /** Left edge in normalized units. */
  x: number;
  width: number;
  height: number;
}

/** Immutable keyboard description produced by {@link buildKeyboard}. */
export interface KeyboardModel {
  whiteKeys: readonly WhiteKey[];
  blackKeys: readonly BlackKey[];
}

/**
 * A black key sits between white key `i` and `i + 1` when the note at index `i`
 * is not E or B. In the flat index space, position within the C-major week is
 * `(i + 5) % 7` (0 = C … 6 = B); E is 2 and B is 6. This is pure index math —
 * no note-name or octave mapping is performed.
 */
function hasBlackKeyAfter(index: number): boolean {
  const pos = (index + 5) % 7;
  return pos !== 2 && pos !== 6;
}

/** Resolve a state value to its palette color; absent/unknown → default white. */
function resolveFill(state: KeyState | undefined): string {
  switch (state) {
    case 'left':
      return KEY_PALETTE.left;
    case 'right':
      return KEY_PALETTE.right;
    case 'overlap':
      return KEY_PALETTE.overlap;
    case 'default':
    default:
      return KEY_PALETTE.default;
  }
}

/**
 * Build the immutable keyboard model from a 52-state input array.
 *
 * Returns the ordered list of 52 white keys (A0 leftmost → C8 rightmost), each
 * with normalized geometry and a fill resolved from its state, plus the full
 * set of 36 black keys positioned at the white-key boundaries they straddle.
 * Any absent/undefined state entry resolves to default white rather than
 * throwing.
 */
export function buildKeyboard(states: KeyStates): KeyboardModel {
  const whiteKeys: WhiteKey[] = [];
  for (let i = 0; i < WHITE_KEY_COUNT; i++) {
    whiteKeys.push({
      index: i,
      x: i * WHITE_KEY_WIDTH,
      width: WHITE_KEY_WIDTH,
      height: WHITE_KEY_HEIGHT,
      fill: resolveFill(states[i]),
    });
  }

  const blackKeys: BlackKey[] = [];
  for (let i = 0; i < WHITE_KEY_COUNT - 1; i++) {
    if (!hasBlackKeyAfter(i)) continue;
    // Center the black key on the boundary between white keys i and i + 1.
    const center = (i + 1) * WHITE_KEY_WIDTH;
    blackKeys.push({
      x: center - BLACK_KEY_WIDTH / 2,
      width: BLACK_KEY_WIDTH,
      height: BLACK_KEY_HEIGHT,
    });
  }

  return { whiteKeys, blackKeys };
}
