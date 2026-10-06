import { describe, it, expect } from 'vitest';
import { StaffNote, NoteDistribution, NoteProducer, NOTE_NAMES, PianoRange } from './note';

describe('StaffNote', () => {
    it('build from a flat index', () => {
        // index 0 = A0 (position 5 in NOTE_NAMES)
        const a0 = new StaffNote(0);
        expect(a0.name).toBe('A');
        expect(a0.octave).toBe(0);
        expect(a0.accidental).toBe('');

        // index 2 = C1 (position 0 of octave 1)
        const c1 = new StaffNote(2);
        expect(c1.name).toBe('C');
        expect(c1.octave).toBe(1);
        expect(c1.accidental).toBe('');
    });

    it('builds from name accidental and octave', () => {
        const note = new StaffNote('C', '', 4);
        expect(note.index).toBe(NOTE_NAMES.length * 4 + 0 - 5);
        expect(note.toString()).toBe('C/4');
    });

    it('round-trips index to name/octave', () => {
        for (let i = 0; i < 30; i++) {
            const fromIndex = new StaffNote(i);
            const fromName = new StaffNote(fromIndex.name, '', fromIndex.octave);
            expect(fromName.index).toBe(i);
        }
    });

    it('throws for unknown note name', () => {
        expect(() => new StaffNote('X', '', 4)).toThrow(/unknown note name/);
    });

    it('throws for notes below A0', () => {
        expect(() => new StaffNote('G', '', 0)).toThrow(/below A0/);
    });

    it('compares by index', () => {
        const a = new StaffNote(5);
        const b = new StaffNote(6);
        expect(a.lt(b)).toBe(true);
        expect(b.gt(a)).toBe(true);
        expect(a.eq(new StaffNote(5))).toBe(true);
    });
});

describe('NoteDistribution', () => {
  it('generates notes within the sliding window', () => {
    const dist = new NoteDistribution(new StaffNote(0), new StaffNote(20));
    const notes = dist.generateRandomNotes(10);
    expect(notes).toHaveLength(10);
    for (const n of notes) {
      expect(n.index).toBeGreaterThanOrEqual(dist.winLow);
      expect(n.index).toBeLessThanOrEqual(dist.winHigh);
    }
  });

  it('never emits two consecutive equal notes', () => {
    const dist = new NoteDistribution(new StaffNote(0), new StaffNote(20));
    const notes = dist.generateRandomNotes(50);
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i].index).not.toBe(notes[i - 1].index);
    }
  });

  it('clamps the window at the boundaries', () => {
    const dist = new NoteDistribution(new StaffNote(0), new StaffNote(20));
    for (let i = 0; i < 50; i++) dist.moveWindow(-1);
    expect(dist.winLow).toBe(0);
    expect(dist.winHigh).toBe(2);

    for (let i = 0; i < 50; i++) dist.moveWindow(1);
    expect(dist.winHigh).toBe(20);
    expect(dist.winLow).toBe(18);
  });
});

describe('NoteProducer', () => {
  it('produces the requested number of treble and bass notes', () => {
    const producer = new NoteProducer(
      new StaffNote(10), new StaffNote(30),
      new StaffNote(0), new StaffNote(20),
    );
    const { treble, bass } = producer.produce(3, 8);
    expect(treble).toHaveLength(8);
    expect(bass).toHaveLength(8);
  });

  it('keeps notes inside their configured ranges', () => {
    const producer = new NoteProducer(
      new StaffNote(10), new StaffNote(30),
      new StaffNote(0), new StaffNote(20),
    );
    for (let i = 0; i < 20; i++) {
      const { treble, bass } = producer.produce(4, 5);
      for (const n of treble) {
        expect(n.index).toBeGreaterThanOrEqual(10);
        expect(n.index).toBeLessThanOrEqual(30);
      }
      for (const n of bass) {
        expect(n.index).toBeGreaterThanOrEqual(0);
        expect(n.index).toBeLessThanOrEqual(20);
      }
    }
  });

  it('recovers from being stuck at a boundary', () => {
    const producer = new NoteProducer(
      new StaffNote(10), new StaffNote(30),
      new StaffNote(0), new StaffNote(20),
    );
    // hammer the windows toward the low boundary, then keep producing;
    // after ~7 cycles at the boundary the direction must reset to free drift.
    for (let i = 0; i < 30; i++) producer.produce(1, 1);
    // just assert it keeps working without throwing
    expect(() => producer.produce(2, 4)).not.toThrow();
  });
});

describe('PianoRange', () => {
  it('creates a valid default state with derived StaffNote boundaries', () => {
    const range = new PianoRange();
    // Default: left C3..G3, right C4..G4.
    expect(range.left_hand_low.index).toBe(new StaffNote('C', '', 3).index);
    expect(range.left_hand_high.index).toBe(new StaffNote('G', '', 3).index);
    expect(range.right_hand_low.index).toBe(new StaffNote('C', '', 4).index);
    expect(range.right_hand_high.index).toBe(new StaffNote('G', '', 4).index);
    // Each hand keeps at least the minimum 2-note gap.
    expect(range.left_hand_high.index - range.left_hand_low.index).toBeGreaterThanOrEqual(2);
    expect(range.right_hand_high.index - range.right_hand_low.index).toBeGreaterThanOrEqual(2);
  });

  it('moves the low boundary with side=0 and the high boundary with side=1', () => {
    const range = new PianoRange();
    const ll = range.left_hand_low.index;
    const lh = range.left_hand_high.index;

    range.moveLeftHandBy(0, 1); // low up by one
    expect(range.left_hand_low.index).toBe(ll + 1);
    expect(range.left_hand_high.index).toBe(lh); // high untouched

    range.moveLeftHandBy(1, -1); // high down by one
    expect(range.left_hand_high.index).toBe(lh - 1);
    expect(range.left_hand_low.index).toBe(ll + 1); // low still as set
  });

  it('repairs a low/high collision by nudging the high boundary up', () => {
    const range = new PianoRange();
    // Push the left low boundary up into/above the high boundary.
    range.moveLeftHandBy(0, 100);
    // After repair the high must sit at least 2 above the low.
    expect(range.left_hand_high.index).toBeGreaterThanOrEqual(range.left_hand_low.index + 2);
  });

  it('repairs a collision by nudging the low boundary down when the high is pushed down', () => {
    const range = new PianoRange();
    // Push the left high boundary far down, below the low boundary.
    range.moveLeftHandBy(1, -100);
    expect(range.left_hand_low.index).toBeLessThanOrEqual(range.left_hand_high.index - 2);
  });

  it('clamps the low boundary to the keyboard floor (index 0)', () => {
    const range = new PianoRange();
    range.moveLeftHandBy(0, -100);
    expect(range.left_hand_low.index).toBe(0);
  });

  it('clamps the high boundary to the keyboard ceiling (index 51)', () => {
    const range = new PianoRange();
    range.moveRightHandBy(1, 100);
    expect(range.right_hand_high.index).toBe(51);
  });

  it('keeps the low boundary within its legal sub-range (max 49)', () => {
    const range = new PianoRange();
    // Drive the right low boundary to the top; it must not exceed 49.
    range.moveRightHandBy(0, 100);
    expect(range.right_hand_low.index).toBeLessThanOrEqual(49);
  });

  it('keeps the high boundary within its legal sub-range (min 2)', () => {
    const range = new PianoRange();
    // Drive the left high boundary to the bottom; it must not go below 2.
    range.moveLeftHandBy(1, -100);
    expect(range.left_hand_high.index).toBeGreaterThanOrEqual(2);
  });

  it('maintains cross-hand separation (LL <= LR - 2 and HL <= HR - 2)', () => {
    const range = new PianoRange();
    // Try to collapse the gap between the hands by pushing them toward each other.
    range.moveLeftHandBy(0, 5);
    range.moveRightHandBy(0, -5);
    expect(range.left_hand_low.index).toBeLessThanOrEqual(range.right_hand_low.index - 2);
    expect(range.left_hand_high.index).toBeLessThanOrEqual(range.right_hand_high.index - 2);
  });

  it('leaves the other hand unchanged when moving a single hand', () => {
    const range = new PianoRange();
    const rl = range.right_hand_low.index;
    const rh = range.right_hand_high.index;

    range.moveLeftHandBy(0, 3);
    expect(range.right_hand_low.index).toBe(rl);
    expect(range.right_hand_high.index).toBe(rh);

    const ll = range.left_hand_low.index;
    const lh = range.left_hand_high.index;
    range.moveRightHandBy(1, -2);
    expect(range.left_hand_low.index).toBe(ll);
    expect(range.left_hand_high.index).toBe(lh);
  });

  it('produces equivalent end states for moveBy and moveTo with the same net delta', () => {
    const a = new PianoRange();
    const b = new PianoRange();

    // Same net movement expressed relatively vs. absolutely (left hand).
    const targetLow = a.left_hand_low.index + 4;
    a.moveLeftHandBy(0, 4);
    b.moveLeftHandTo(0, targetLow);

    expect(a.left_hand_low.index).toBe(b.left_hand_low.index);
    expect(a.left_hand_high.index).toBe(b.left_hand_high.index);
    expect(a.right_hand_low.index).toBe(b.right_hand_low.index);
    expect(a.right_hand_high.index).toBe(b.right_hand_high.index);

    // Same net movement expressed relatively vs. absolutely (right hand).
    const targetHigh = a.right_hand_high.index - 3;
    a.moveRightHandBy(1, -3);
    b.moveRightHandTo(1, targetHigh);

    expect(a.left_hand_low.index).toBe(b.left_hand_low.index);
    expect(a.left_hand_high.index).toBe(b.left_hand_high.index);
    expect(a.right_hand_low.index).toBe(b.right_hand_low.index);
    expect(a.right_hand_high.index).toBe(b.right_hand_high.index);
  });
});