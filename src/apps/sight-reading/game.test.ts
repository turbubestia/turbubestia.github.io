import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffNote } from './note';
import { DEFAULT_SETTINGS, type GameSettings, SightReadingGame } from './game';

function makeSettings(overrides: Partial<GameSettings> = {}): GameSettings {
  return {
    handMode: 'bt',
    noteCount: 2,
    noteDelay: 1,
    interval: 3,
    trebleRange: { low: new StaffNote('B', '', 3), high: new StaffNote('A', '', 5) },
    bassRange: { low: new StaffNote('E', '', 2), high: new StaffNote('C', '', 4) },
    ...overrides,
  };
}

describe('SightReadingGame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('matching', () => {
    it('sets the treble match when the expected note is played', () => {
      const game = new SightReadingGame(makeSettings());
      const expected = game.getSnapshot().state.trebleNotes[0];

      game.noteOn(expected);

      const state = game.getSnapshot().state;
      expect(state.trebleMatches[0]).toBe(true);
      expect(state.bassMatches[0]).toBe(false);
    });

    it('sets the bass match when the expected note is played', () => {
      const game = new SightReadingGame(makeSettings());
      const expected = game.getSnapshot().state.bassNotes[0];

      game.noteOn(expected);

      const state = game.getSnapshot().state;
      expect(state.bassMatches[0]).toBe(true);
      expect(state.trebleMatches[0]).toBe(false);
    });

    it('ignores notes that do not match the current position', () => {
      const game = new SightReadingGame(makeSettings());
      const before = game.getSnapshot();
      // A note guaranteed to differ from both expected notes at pos 0.
      const wrong = new StaffNote(before.state.trebleNotes[0].index + 1);

      game.noteOn(wrong);

      expect(game.getSnapshot().state.trebleMatches[0]).toBe(false);
      expect(game.getSnapshot().state.bassMatches[0]).toBe(false);
      expect(game.getSnapshot().state.matchCount).toBe(0);
    });

    it('clears the match flag on noteOff', () => {
      const game = new SightReadingGame(makeSettings());
      const expected = game.getSnapshot().state.trebleNotes[0];

      game.noteOn(expected);
      expect(game.getSnapshot().state.trebleMatches[0]).toBe(true);

      game.noteOff(expected);
      expect(game.getSnapshot().state.trebleMatches[0]).toBe(false);
    });
  });

  describe('hand-mode gating', () => {
    it('left-hand mode ignores treble notes and completes on bass alone', () => {
      const game = new SightReadingGame(makeSettings({ handMode: 'lh' }));
      const snap = game.getSnapshot().state;

      game.noteOn(snap.trebleNotes[0]);
      expect(game.getSnapshot().state.trebleMatches[0]).toBe(false);
      expect(game.getSnapshot().state.matchCount).toBe(0);

      game.noteOn(snap.bassNotes[0]);
      expect(game.getSnapshot().state.matchCount).toBe(1);
    });

    it('right-hand mode ignores bass notes and completes on treble alone', () => {
      const game = new SightReadingGame(makeSettings({ handMode: 'rh' }));
      const snap = game.getSnapshot().state;

      game.noteOn(snap.bassNotes[0]);
      expect(game.getSnapshot().state.bassMatches[0]).toBe(false);
      expect(game.getSnapshot().state.matchCount).toBe(0);

      game.noteOn(snap.trebleNotes[0]);
      expect(game.getSnapshot().state.matchCount).toBe(1);
    });

    it('both-hands mode requires both notes to advance', () => {
      const game = new SightReadingGame(makeSettings({ handMode: 'bt' }));
      const snap = game.getSnapshot().state;

      game.noteOn(snap.trebleNotes[0]);
      expect(game.getSnapshot().state.matchCount).toBe(0);

      game.noteOn(snap.bassNotes[0]);
      expect(game.getSnapshot().state.matchCount).toBe(1);
    });
  });

  describe('round progression', () => {
    it('advances position by position for a two-note round', () => {
      const game = new SightReadingGame(makeSettings({ noteCount: 2 }));
      const snap = game.getSnapshot().state;

      // Position 0.
      game.noteOn(snap.trebleNotes[0]);
      game.noteOn(snap.bassNotes[0]);
      expect(game.getSnapshot().state.matchCount).toBe(1);

      // Position 1.
      game.noteOn(snap.trebleNotes[1]);
      game.noteOn(snap.bassNotes[1]);
      expect(game.getSnapshot().state.matchCount).toBe(2);
    });

    it('ignores input while the round is over and the timer is pending', () => {
      const game = new SightReadingGame(makeSettings({ noteCount: 1 }));
      const snap = game.getSnapshot().state;

      game.noteOn(snap.trebleNotes[0]);
      game.noteOn(snap.bassNotes[0]);
      expect(game.getSnapshot().state.matchCount).toBe(1);

      // Any further input must be a no-op until the timer fires.
      game.noteOn(new StaffNote(0));
      expect(game.getSnapshot().state.matchCount).toBe(1);
      expect(game.getSnapshot().state.trebleMatches[0]).toBe(true);
    });
  });

  describe('auto-advance', () => {
    it('generates a fresh round after the configured delay', () => {
      const game = new SightReadingGame(makeSettings({ noteCount: 1, noteDelay: 2 }));
      const before = game.getSnapshot().state;

      game.noteOn(before.trebleNotes[0]);
      game.noteOn(before.bassNotes[0]);
      expect(game.getSnapshot().state.matchCount).toBe(1);

      // Nothing happens before the delay elapses.
      vi.advanceTimersByTime(1999);
      expect(game.getSnapshot().state.matchCount).toBe(1);

      vi.advanceTimersByTime(1);
      const after = game.getSnapshot().state;
      expect(after.matchCount).toBe(0);
      expect(after.trebleMatches.every((m) => !m)).toBe(true);
      expect(after.bassMatches.every((m) => !m)).toBe(true);
    });

    it('restart cancels a pending auto-advance timer', () => {
      const game = new SightReadingGame(makeSettings({ noteCount: 1, noteDelay: 5 }));
      const before = game.getSnapshot().state;

      game.noteOn(before.trebleNotes[0]);
      game.noteOn(before.bassNotes[0]);

      game.restart();
      const afterRestart = game.getSnapshot().state;
      expect(afterRestart.matchCount).toBe(0);

      // The old timer must not fire a second regeneration.
      vi.advanceTimersByTime(5000);
      expect(game.getSnapshot().state).toBe(afterRestart);
    });
  });

  describe('settings', () => {
    it('setNoteCount regenerates with the new count', () => {
      const game = new SightReadingGame(makeSettings({ noteCount: 2 }));

      game.setNoteCount(4);

      const snap = game.getSnapshot();
      expect(snap.settings.noteCount).toBe(4);
      expect(snap.state.trebleNotes).toHaveLength(4);
      expect(snap.state.bassNotes).toHaveLength(4);
      expect(snap.state.matchCount).toBe(0);
    });

    it('setIntervalSize and setNoteDelay do not regenerate the round', () => {
      const game = new SightReadingGame(makeSettings());
      const before = game.getSnapshot().state;

      game.setIntervalSize(5);
      game.setNoteDelay(3);

      const snap = game.getSnapshot();
      expect(snap.settings.interval).toBe(5);
      expect(snap.settings.noteDelay).toBe(3);
      expect(snap.state.trebleNotes).toEqual(before.trebleNotes);
      expect(snap.state.bassNotes).toEqual(before.bassNotes);
    });

    it('setHandMode does not regenerate the round', () => {
      const game = new SightReadingGame(makeSettings());
      const before = game.getSnapshot().state;

      game.setHandMode('lh');

      const snap = game.getSnapshot();
      expect(snap.settings.handMode).toBe('lh');
      expect(snap.state.trebleNotes).toEqual(before.trebleNotes);
    });

    it('setTrebleRange rejects an inverted range without changing the game', () => {
      const game = new SightReadingGame(makeSettings());
      const before = game.getSnapshot();

      const ok = game.setTrebleRange(
        new StaffNote('A', '', 5), // low above high -> invalid
        new StaffNote('B', '', 3),
      );

      expect(ok).toBe(false);
      expect(game.getSnapshot().settings.trebleRange).toEqual(before.settings.trebleRange);
      expect(game.getSnapshot().state.trebleNotes).toEqual(before.state.trebleNotes);
    });

    it('setTrebleRange accepts a valid range and regenerates', () => {
      const game = new SightReadingGame(makeSettings());

      const ok = game.setTrebleRange(new StaffNote('C', '', 4), new StaffNote('E', '', 5));

      expect(ok).toBe(true);
      const snap = game.getSnapshot();
      expect(snap.settings.trebleRange.low.eq(new StaffNote('C', '', 4))).toBe(true);
      expect(snap.settings.trebleRange.high.eq(new StaffNote('E', '', 5))).toBe(true);
      expect(snap.state.matchCount).toBe(0);
    });

    it('setBassRange rejects an inverted range without changing the game', () => {
      const game = new SightReadingGame(makeSettings());
      const before = game.getSnapshot();

      const ok = game.setBassRange(new StaffNote('C', '', 4), new StaffNote('E', '', 2));

      expect(ok).toBe(false);
      expect(game.getSnapshot().settings.bassRange).toEqual(before.settings.bassRange);
      expect(game.getSnapshot().state.bassNotes).toEqual(before.state.bassNotes);
    });

    it('setBassRange accepts a valid range and regenerates', () => {
      const game = new SightReadingGame(makeSettings());

      const ok = game.setBassRange(new StaffNote('G', '', 2), new StaffNote('A', '', 3));

      expect(ok).toBe(true);
      const snap = game.getSnapshot();
      expect(snap.settings.bassRange.low.eq(new StaffNote('G', '', 2))).toBe(true);
      expect(snap.settings.bassRange.high.eq(new StaffNote('A', '', 3))).toBe(true);
    });
  });

  describe('subscription', () => {
    it('notifies listeners on note events, settings changes and restarts', () => {
      const game = new SightReadingGame(makeSettings());
      const listener = vi.fn();
      const unsubscribe = game.subscribe(listener);

      game.noteOn(new StaffNote(0));
      expect(listener).toHaveBeenCalledTimes(1);

      game.setHandMode('rh');
      expect(listener).toHaveBeenCalledTimes(2);

      game.restart();
      expect(listener).toHaveBeenCalledTimes(3);

      unsubscribe();
      game.restart();
      expect(listener).toHaveBeenCalledTimes(3);
    });

    it('returns a stable snapshot between emits', () => {
      const game = new SightReadingGame(makeSettings());
      const first = game.getSnapshot();

      expect(game.getSnapshot()).toBe(first);

      game.restart();
      expect(game.getSnapshot()).not.toBe(first);
    });
  });

  describe('defaults', () => {
    it('constructs with the default settings when none are given', () => {
      const game = new SightReadingGame();
      const snap = game.getSnapshot();

      expect(snap.settings.handMode).toBe(DEFAULT_SETTINGS.handMode);
      expect(snap.settings.noteCount).toBe(DEFAULT_SETTINGS.noteCount);
      expect(snap.state.trebleNotes).toHaveLength(DEFAULT_SETTINGS.noteCount);
    });
  });
});
