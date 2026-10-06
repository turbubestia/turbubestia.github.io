import {
  buildKeyboard,
  BLACK_KEY_FILL,
  C4_INDEX,
  KEYBOARD_HEIGHT,
  KEYBOARD_WIDTH,
  WHITE_KEY_HEIGHT,
  WHITE_KEY_WIDTH,
  type KeyStates,
} from './keyboard';

// Re-export the input type so consumers can build state arrays without importing keyboard directly.
export type { KeyStates };

export interface PianoKeyboardProps {
  /** 52 white-key color states, indexed by white-key position (0 = A0). */
  states: KeyStates;
  /** Rendered pixel width. Height is derived from the fixed aspect ratio. */
  width?: number;
}

// Corner radii in normalized units (a small fraction of a white key).
const WHITE_RADIUS = WHITE_KEY_WIDTH * 0.18;
const BLACK_RADIUS = WHITE_KEY_WIDTH * 0.12;
const LABEL_FONT_SIZE = 0.013;

/** Sharp top corners, rounded bottom corners for a white key. */
function whiteKeyPath(x: number, w: number, h: number): string {
  const r = WHITE_RADIUS;
  return (
    `M ${x} 0 ` +
    `L ${x + w} 0 ` +
    `L ${x + w} ${h - r} ` +
    `Q ${x + w} ${h} ${x + w - r} ${h} ` +
    `L ${x + r} ${h} ` +
    `Q ${x} ${h} ${x} ${h - r} Z`
  );
}

/** Flat top, rounded bottom corners for a black key. */
function blackKeyPath(x: number, w: number, h: number): string {
  const r = BLACK_RADIUS;
  return (
    `M ${x} 0 ` +
    `L ${x + w} 0 ` +
    `L ${x + w} ${h - r} ` +
    `Q ${x + w} ${h} ${x + w - r} ${h} ` +
    `L ${x + r} ${h} ` +
    `Q ${x} ${h} ${x} ${h - r} Z`
  );
}

/**
 * Presentational SVG piano keyboard. Maps the pure keyboard model to static
 * SVG elements only — no interaction, focusability, or PianoRange references.
 */
export function PianoKeyboard({ states, width = 520 }: PianoKeyboardProps) {
  const { whiteKeys, blackKeys } = buildKeyboard(states);
  const pixelWidth = width;
  const pixelHeight = width * (KEYBOARD_HEIGHT / KEYBOARD_WIDTH);

  const c4CenterX = (C4_INDEX + 0.5) * WHITE_KEY_WIDTH;

  return (
    <svg
      viewBox={`0 0 ${KEYBOARD_WIDTH} ${KEYBOARD_HEIGHT}`}
      width={pixelWidth}
      height={pixelHeight}
      aria-hidden="true"
      className="block"
    >
      {whiteKeys.map((key) => (
        <path
          key={key.index}
          d={whiteKeyPath(key.x, key.width, key.height)}
          fill={key.fill}
          stroke="#9ca3af"
          strokeWidth={0.0006}
        />
      ))}

      {blackKeys.map((key, i) => (
        <path
          key={i}
          d={blackKeyPath(key.x, key.width, key.height)}
          fill={BLACK_KEY_FILL}
        />
      ))}

      <text
        x={c4CenterX}
        y={WHITE_KEY_HEIGHT * 0.72}
        fontSize={LABEL_FONT_SIZE}
        textAnchor="middle"
        fill="#111827"
      >
        C4
      </text>
    </svg>
  );
}
