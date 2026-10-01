// Pure sight-reading game logic. Framework-free: no React, DOM, or console
// usage, so it can be unit-tested directly with vitest.

import { NoteProducer, StaffNote } from './note';

export type HandMode = 'lh' | 'rh' | 'bt';

export interface NoteRange {
  low: StaffNote;
  high: StaffNote;
}

export interface GameSettings {
  handMode: HandMode;
  noteCount: number;
  /** Seconds to wait after a round completes before generating new notes. */
  noteDelay: number;
  /** Sliding-window step range passed to the NoteProducer. */
  interval: number;
  trebleRange: NoteRange;
  bassRange: NoteRange;
}

export interface GameState {
  trebleNotes: StaffNote[];
  bassNotes: StaffNote[];
  trebleMatches: boolean[];
  bassMatches: boolean[];
  /** Index of the next note to be matched (0-based). */
  matchCount: number;
}

/** Combined, immutable view of everything the UI needs to render. */
export interface GameSnapshot {
  state: GameState;
  settings: GameSettings;
}

export const DEFAULT_SETTINGS: GameSettings = {
  handMode: 'bt',
  noteCount: 2,
  noteDelay: 1,
  interval: 3,
  trebleRange: { low: new StaffNote('B', '', 3), high: new StaffNote('A', '', 5) },
  bassRange: { low: new StaffNote('E', '', 2), high: new StaffNote('C', '', 4) },
};

type Listener = () => void;

export class SightReadingGame {
  private state: GameState;
  private settings: GameSettings;
  private producer: NoteProducer;
  private timer: number | null = null;
  private listeners = new Set<Listener>();
  /** Stable snapshot object; replaced on every emit so React can compare by identity. */
  private snapshot: GameSnapshot;

  constructor(settings: GameSettings = DEFAULT_SETTINGS) {
    this.settings = { ...settings };
    this.producer = new NoteProducer(
      settings.trebleRange.low,
      settings.trebleRange.high,
      settings.bassRange.low,
      settings.bassRange.high,
    );
    this.state = this.freshState();
    this.snapshot = { state: this.state, settings: this.settings };
  }

  // --- observation (for React via useSyncExternalStore) --------------------

  getSnapshot(): GameSnapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // --- events (called by the UI / MIDI layer) -------------------------------

  noteOn(note: StaffNote): void {
    if (this.state.matchCount >= this.settings.noteCount) return; // round over; timer advances

    const pos = this.state.matchCount;
    const rh = this.rhEnabled;
    const lh = this.lhEnabled;

    const trebleMatches = [...this.state.trebleMatches];
    const bassMatches = [...this.state.bassMatches];
    if (note.eq(this.state.trebleNotes[pos]) && rh) trebleMatches[pos] = true;
    if (note.eq(this.state.bassNotes[pos]) && lh) bassMatches[pos] = true;

    const done = (trebleMatches[pos] || !rh) && (bassMatches[pos] || !lh);
    const matchCount = done ? pos + 1 : pos;
    this.state = { ...this.state, trebleMatches, bassMatches, matchCount };

    if (matchCount === this.settings.noteCount) this.scheduleNextRound();
    this.emit();
  }

  noteOff(note: StaffNote): void {
    if (this.state.matchCount >= this.settings.noteCount) return; // round over; timer advances

    const pos = this.state.matchCount;
    const rh = this.rhEnabled;
    const lh = this.lhEnabled;

    const trebleMatches = [...this.state.trebleMatches];
    const bassMatches = [...this.state.bassMatches];
    if (note.eq(this.state.trebleNotes[pos]) && rh) trebleMatches[pos] = false;
    if (note.eq(this.state.bassNotes[pos]) && lh) bassMatches[pos] = false;

    this.state = { ...this.state, trebleMatches, bassMatches };
    this.emit();
  }

  // --- settings -------------------------------------------------------------

  setHandMode(mode: HandMode): void {
    this.settings.handMode = mode;
    this.emit();
  }

  setNoteDelay(seconds: number): void {
    this.settings.noteDelay = seconds;
    this.emit();
  }

  setIntervalSize(size: number): void {
    this.settings.interval = size;
    this.emit();
  }

  setNoteCount(count: number): void {
    this.settings.noteCount = count;
    this.restart();
  }

  /** Returns false (and leaves the game unchanged) when high is not above low. */
  setTrebleRange(low: StaffNote, high: StaffNote): boolean {
    if (!high.gt(low)) return false;
    this.settings.trebleRange = { low, high };
    this.producer.setTrebleRange(low, high);
    this.restart();
    return true;
  }

  /** Returns false (and leaves the game unchanged) when high is not above low. */
  setBassRange(low: StaffNote, high: StaffNote): boolean {
    if (!high.gt(low)) return false;
    this.settings.bassRange = { low, high };
    this.producer.setBassRange(low, high);
    this.restart();
    return true;
  }

  /** Clears any pending auto-advance timer and generates a fresh round. */
  restart(): void {
    this.clearTimer();
    this.state = this.freshState();
    this.emit();
  }

  dispose(): void {
    this.clearTimer();
  }

  // --- internals --------------------------------------------------------------

  private get rhEnabled(): boolean {
    return this.settings.handMode !== 'lh';
  }

  private get lhEnabled(): boolean {
    return this.settings.handMode !== 'rh';
  }

  private freshState(): GameState {
    const produced = this.producer.produce(this.settings.interval, this.settings.noteCount);
    return {
      trebleNotes: produced.treble,
      bassNotes: produced.bass,
      trebleMatches: new Array(this.settings.noteCount).fill(false),
      bassMatches: new Array(this.settings.noteCount).fill(false),
      matchCount: 0,
    };
  }

  private scheduleNextRound(): void {
    this.clearTimer();
    // globalThis so the module stays usable in non-DOM test environments.
    this.timer = globalThis.setTimeout(() => {
      this.timer = null;
      this.state = this.freshState();
      this.emit();
    }, this.settings.noteDelay * 1000);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      globalThis.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private emit(): void {
    this.snapshot = { state: this.state, settings: this.settings };
    for (const listener of this.listeners) listener();
  }
}
