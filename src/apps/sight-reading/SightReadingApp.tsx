import { useCallback, useEffect, useRef, useState } from 'react';
import { NoteProducer, StaffNote } from './note';
import { useMidi } from './useMidi';
import { StaffCanvas } from './StaffCanvas';

type HandMode = 'lh' | 'rh' | 'bt';

interface GameState {
  trebleNotes: StaffNote[];
  bassNotes: StaffNote[];
  trebleMatches: boolean[];
  bassMatches: boolean[];
  matchCount: number;
}

interface NoteRange {
  low: StaffNote;
  high: StaffNote;
}

const NOTE_OPTIONS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

function freshState(producer: NoteProducer, interval: number, count: number): GameState {
  const produced = producer.produce(interval, count);
  return {
    trebleNotes: produced.treble,
    bassNotes: produced.bass,
    trebleMatches: new Array(count).fill(false),
    bassMatches: new Array(count).fill(false),
    matchCount: 0,
  };
}

export function SightReadingApp() {
  // Settings ---------------------------------------------------------------
  const [handMode, setHandMode] = useState<HandMode>('bt');
  const [noteCount, setNoteCount] = useState(2);
  const [noteDelay, setNoteDelay] = useState(1);
  const [interval, setIntervalSize] = useState(3);
  const [trebleRange, setTrebleRange] = useState<NoteRange>({
    low: new StaffNote('B', '', 3),
    high: new StaffNote('A', '', 5),
  });
  const [bassRange, setBassRange] = useState<NoteRange>({
    low: new StaffNote('E', '', 2),
    high: new StaffNote('C', '', 4),
  });
  const [showLabels, setShowLabels] = useState(false);

  // Game state -------------------------------------------------------------
  // The producer is mutable but created once; useState keeps it stable
  // across renders without constructing a throwaway instance each render.
  const [producer] = useState(
    () =>
      new NoteProducer(
        new StaffNote('B', '', 3),
        new StaffNote('A', '', 5),
        new StaffNote('E', '', 2),
        new StaffNote('C', '', 4),
      ),
  );
  const [game, setGame] = useState<GameState>(() => freshState(producer, 3, 2));
  const timerRef = useRef<number | null>(null);

  const rhEnabled = handMode !== 'lh';
  const lhEnabled = handMode !== 'rh';

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const produce = useCallback(
    (count: number, stepInterval: number) => {
      clearTimer();
      setGame(freshState(producer, stepInterval, count));
    },
    [clearTimer, producer],
  );

  // MIDI -------------------------------------------------------------------
  const onNoteOn = useCallback(
    (note: StaffNote) => {
      setGame((prev) => {
        if (prev.matchCount >= noteCount) return prev;

        const pos = prev.matchCount;
        const trebleMatch = note.eq(prev.trebleNotes[pos]) && rhEnabled;
        const bassMatch = note.eq(prev.bassNotes[pos]) && lhEnabled;

        const trebleMatches = [...prev.trebleMatches];
        const bassMatches = [...prev.bassMatches];
        if (trebleMatch) trebleMatches[pos] = true;
        if (bassMatch) bassMatches[pos] = true;

        const done = (trebleMatches[pos] || !rhEnabled) && (bassMatches[pos] || !lhEnabled);
        const matchCount = done ? pos + 1 : pos;

        if (matchCount === noteCount) {
          clearTimer();
          timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            setGame(freshState(producer, interval, noteCount));
          }, noteDelay * 1000);
        }

        return { ...prev, trebleMatches, bassMatches, matchCount };
      });
    },
    [noteCount, rhEnabled, lhEnabled, noteDelay, interval, clearTimer, producer],
  );

  const onNoteOff = useCallback(
    (note: StaffNote) => {
      setGame((prev) => {
        if (prev.matchCount >= noteCount) return prev; // round over; timer advances

        const pos = prev.matchCount;
        const trebleMatch = note.eq(prev.trebleNotes[pos]) && rhEnabled;
        const bassMatch = note.eq(prev.bassNotes[pos]) && lhEnabled;

        const trebleMatches = [...prev.trebleMatches];
        const bassMatches = [...prev.bassMatches];
        if (trebleMatch) trebleMatches[pos] = false;
        if (bassMatch) bassMatches[pos] = false;

        return { ...prev, trebleMatches, bassMatches };
      });
    },
    [noteCount, rhEnabled, lhEnabled],
  );

  const midi = useMidi({ onNoteOn, onNoteOff });

  // Cleanup ----------------------------------------------------------------
  useEffect(() => clearTimer, [clearTimer]);

  // Settings handlers --------------------------------------------------------
  const updateTrebleRange = (part: 'low' | 'high', noteName: string, octave: number) => {
    const candidate = new StaffNote(noteName, '', octave);
    if (part === 'high') {
      if (candidate.gt(trebleRange.low)) {
        setTrebleRange({ low: trebleRange.low, high: candidate });
        producer.setTrebleRange(trebleRange.low, candidate);
        produce(noteCount, interval);
      } else {
        console.log(
          `Treble high note (${candidate}) must be higher than the treble low note ${trebleRange.low}`,
        );
      }
    } else {
      if (candidate.lt(trebleRange.high)) {
        setTrebleRange({ low: candidate, high: trebleRange.high });
        producer.setTrebleRange(candidate, trebleRange.high);
        produce(noteCount, interval);
      } else {
        console.log(
          `Treble low note (${candidate}) must be lower than the treble high note ${trebleRange.high}`,
        );
      }
    }
  };

  const updateBassRange = (part: 'low' | 'high', noteName: string, octave: number) => {
    const candidate = new StaffNote(noteName, '', octave);
    if (part === 'high') {
      if (candidate.gt(bassRange.low)) {
        setBassRange({ low: bassRange.low, high: candidate });
        producer.setBassRange(bassRange.low, candidate);
        produce(noteCount, interval);
      } else {
        console.log(
          `Bass high note (${candidate}) must be higher than the bass low note ${bassRange.low}`,
        );
      }
    } else {
      if (candidate.lt(bassRange.high)) {
        setBassRange({ low: candidate, high: bassRange.high });
        producer.setBassRange(candidate, bassRange.high);
        produce(noteCount, interval);
      } else {
        console.log(
          `Bass low note (${candidate}) must be lower than the bass high note ${bassRange.high}`,
        );
      }
    }
  };

  // UI -----------------------------------------------------------------------
  return (
    <div className="p-4">
    <MidiPanel midi={midi} />
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 md:flex-row">
      {/* Settings panel */}
      <div className="flex w-full max-w-xs flex-col gap-1">
        {/* <MidiPanel midi={midi} /> */}

        <Card title="Hand">
          <div className="flex gap-4 text-sm">
            {(
              [
                ['lh', 'LH'],
                ['rh', 'RH'],
                ['bt', 'Both'],
              ] as [HandMode, string][]
            ).map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-1">
                <input
                  type="radio"
                  name="hand"
                  checked={handMode === value}
                  onChange={() => setHandMode(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </Card>

        <Card title="Timing">
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center justify-between gap-2">
              Interval
              <input
                type="number"
                min={1}
                max={8}
                value={interval}
                onChange={(e) => setIntervalSize(Number(e.target.value))}
                className="w-16 rounded border border-panel-border bg-panel px-2 py-0.5"
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              Note delay (s)
              <input
                type="number"
                min={0.1}
                max={5}
                step={0.1}
                value={noteDelay}
                onChange={(e) => setNoteDelay(Number(e.target.value))}
                className="w-16 rounded border border-panel-border bg-panel px-2 py-0.5"
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              Note count
              <select
                value={noteCount}
                onChange={(e) => {
                  const count = Number(e.target.value);
                  setNoteCount(count);
                  produce(count, interval);
                }}
                className="w-16 rounded border border-panel-border bg-panel px-2 py-0.5"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={4}>4</option>
              </select>
            </label>
          </div>
        </Card>

        <Card title="Treble range">
          <RangeRow
            label="High"
            note={trebleRange.high.name}
            octave={trebleRange.high.octave}
            octaveMin={3}
            octaveMax={6}
            onChange={(n, o) => updateTrebleRange('high', n, o)}
          />
          <RangeRow
            label="Low"
            note={trebleRange.low.name}
            octave={trebleRange.low.octave}
            octaveMin={2}
            octaveMax={5}
            onChange={(n, o) => updateTrebleRange('low', n, o)}
          />
        </Card>

        <Card title="Bass range">
          <RangeRow
            label="High"
            note={bassRange.high.name}
            octave={bassRange.high.octave}
            octaveMin={2}
            octaveMax={5}
            onChange={(n, o) => updateBassRange('high', n, o)}
          />
          <RangeRow
            label="Low"
            note={bassRange.low.name}
            octave={bassRange.low.octave}
            octaveMin={1}
            octaveMax={4}
            onChange={(n, o) => updateBassRange('low', n, o)}
          />
        </Card>
      </div>

      {/* Staff */}
      <div className="flex flex-col items-center gap-3 rounded-xl border border-panel-border bg-panel p-3">
        <div
          className="cursor-pointer"
          title="Click to generate new notes"
          onClick={() => produce(noteCount, interval)}
        >
          <StaffCanvas
            trebleNotes={game.trebleNotes}
            trebleMatches={game.trebleMatches}
            bassNotes={game.bassNotes}
            bassMatches={game.bassMatches}
            rhEnabled={rhEnabled}
            lhEnabled={lhEnabled}
            showLabels={showLabels}
          />
        </div>
        <button
          onClick={() => setShowLabels((v) => !v)}
          className="w-full rounded-lg border border-panel-border bg-panel px-4 py-1.5 text-sm hover:bg-panel/70"
        >
          {showLabels ? 'Hide notes' : 'Show notes'}
        </button>
      </div>
    </div>
    </div>
  );
}

// Small presentational helpers ------------------------------------------------

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-panel p-2">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">
        {title}
      </h2>
      {children}
    </div>
  );
}

function RangeRow({
  label,
  note,
  octave,
  octaveMin,
  octaveMax,
  onChange,
}: {
  label: string;
  note: string;
  octave: number;
  octaveMin: number;
  octaveMax: number;
  onChange: (noteName: string, octave: number) => void;
}) {
  return (
    <label className="mb-1 flex items-center justify-between gap-2 text-sm">
      {label}
      <span className="flex items-center gap-1">
        <select
          value={note}
          onChange={(e) => onChange(e.target.value, octave)}
          className="rounded border border-panel-border bg-panel px-2 py-0.5"
        >
          {NOTE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={octaveMin}
          max={octaveMax}
          value={octave}
          onChange={(e) => onChange(note, Number(e.target.value))}
          className="w-12 rounded border border-panel-border bg-panel px-2 py-0.5"
        />
      </span>
    </label>
  );
}

function MidiPanel({ midi }: { midi: ReturnType<typeof useMidi> }) {
  return (
      <div className="flex flex-row items-center justify-center gap-2 text-sm rounded-xl p-4 bg-panel">
        <p className="text-xs font-bold uppercase text-neutral-400">
          Devices
        </p>
        <select
          value={midi.devices[0] ?? ''}
          onChange={(e) => midi.connect(e.target.value)}
          disabled={midi.status === 'connected'}
          className="w-40 rounded-lg bg-neutral-800 py-1">
          {midi.devices.length === 0 && <option value="">No devices found</option>}
          {midi.devices.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            midi.status === 'connected' ? midi.disconnect() : midi.connect(midi.devices[0] ?? '')
          }
          disabled={midi.devices.length === 0}
          className={`w-40 rounded-lg px-3 py-1 disabled:opacity-40 ${
            midi.status === 'connected'
              ? 'bg-green-900 text-green-300 hover:bg-green-500'
              : 'bg-red-900 text-red-300 hover:bg-red-700'
          }`}>
          {midi.status === 'connected' ? 'Disconnect' : 'Connect'}
        </button>
        <button
          onClick={midi.refresh}
          className="w-40 rounded-lg bg-neutral-800 px-3 py-1 hover:bg-neutral-500">
          Refresh devices
        </button>
        <p className="text-xs text-neutral-400">
          Status:{' '}
          {midi.status === 'unsupported'
            ? 'WebMIDI not supported in this browser'
            : midi.status === 'connected'
              ? 'Connected'
              : 'Disconnected'}
        </p>
      </div>
  );
}
