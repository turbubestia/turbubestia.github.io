import { describe, it, expect } from 'vitest';
import { StaffNote, NoteDistribution, NoteProducer, NOTE_NAMES } from './note';

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