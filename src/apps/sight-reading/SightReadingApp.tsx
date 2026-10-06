// system
import { useState } from 'react';
// user logic
import { StaffNote } from './note';
import { DEFAULT_SETTINGS, type GameSettings, type HandMode } from './game';
// react hooks
import { useMidi } from './useMidi';
import { useSightReadingGame } from './useSightReadingGame';
// ui components
import { StaffCanvas } from './StaffCanvas';

const NOTE_OPTIONS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export function SightReadingApp() 
{
  const { game, snapshot } = useSightReadingGame(DEFAULT_SETTINGS);
  const { state, settings } = snapshot;

  const rhEnabled = settings.handMode !== 'lh';
  const lhEnabled = settings.handMode !== 'rh';

  const [showLabels, setShowLabels] = useState(false);

  // MIDI -------------------------------------------------------------------
  const midi = useMidi({
    onNoteOn: (note) => game.noteOn(note),
    onNoteOff: (note) => game.noteOff(note),
  });

  // UI -----------------------------------------------------------------------
  return (
    <div className="p-4">
    <MidiPanel midi={midi} />
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 md:flex-row">
      {/* Settings panel */}
      <SettingsPanel
        settings={settings}
        onHandMode={(mode) => game.setHandMode(mode)}
        onInterval={(size) => game.setIntervalSize(size)}
        onNoteDelay={(seconds) => game.setNoteDelay(seconds)}
        onNoteCount={(count) => game.setNoteCount(count)}
        onTrebleRange={(low, high) => game.setTrebleRange(low, high)}
        onBassRange={(low, high) => game.setBassRange(low, high)}
      />

      {/* Staff */}
      <div className="flex flex-col items-center gap-3 rounded-xl border border-panel-border bg-panel p-3">
        <div
          className="cursor-pointer"
          title="Click to generate new notes"
          onClick={() => game.restart()}
        >
          <StaffCanvas
            trebleNotes={state.trebleNotes}
            trebleMatches={state.trebleMatches}
            bassNotes={state.bassNotes}
            bassMatches={state.bassMatches}
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

function SettingsPanel({
  settings,
  onHandMode,
  onInterval,
  onNoteDelay,
  onNoteCount,
  onTrebleRange,
  onBassRange,
}: {
  settings: GameSettings;
  onHandMode: (mode: HandMode) => void;
  onInterval: (size: number) => void;
  onNoteDelay: (seconds: number) => void;
  onNoteCount: (count: number) => void;
  onTrebleRange: (low: StaffNote, high: StaffNote) => void;
  onBassRange: (low: StaffNote, high: StaffNote) => void;
}) {
  return (
    <div className="flex w-full max-w-xs flex-col gap-1">
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
                checked={settings.handMode === value}
                onChange={() => onHandMode(value)}
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
              value={settings.interval}
              onChange={(e) => onInterval(Number(e.target.value))}
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
              value={settings.noteDelay}
              onChange={(e) => onNoteDelay(Number(e.target.value))}
              className="w-16 rounded border border-panel-border bg-panel px-2 py-0.5"
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            Note count
            <select
              value={settings.noteCount}
              onChange={(e) => onNoteCount(Number(e.target.value))}
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
          note={settings.trebleRange.high.name}
          octave={settings.trebleRange.high.octave}
          octaveMin={3}
          octaveMax={6}
          onChange={(n, o) => onTrebleRange(settings.trebleRange.low, new StaffNote(n, '', o))}
        />
        <RangeRow
          label="Low"
          note={settings.trebleRange.low.name}
          octave={settings.trebleRange.low.octave}
          octaveMin={2}
          octaveMax={5}
          onChange={(n, o) => onTrebleRange(new StaffNote(n, '', o), settings.trebleRange.high)}
        />
      </Card>

      <Card title="Bass range">
        <RangeRow
          label="High"
          note={settings.bassRange.high.name}
          octave={settings.bassRange.high.octave}
          octaveMin={2}
          octaveMax={5}
          onChange={(n, o) => onBassRange(settings.bassRange.low, new StaffNote(n, '', o))}
        />
        <RangeRow
          label="Low"
          note={settings.bassRange.low.name}
          octave={settings.bassRange.low.octave}
          octaveMin={1}
          octaveMax={4}
          onChange={(n, o) => onBassRange(new StaffNote(n, '', o), settings.bassRange.high)}
        />
      </Card>
    </div>
  );
}

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
