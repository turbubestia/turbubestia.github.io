import { useState } from 'react';
import type { CarryMode, GradeLevel, ProblemConfig } from '../math';
import { GRADE_PRESETS } from '../math';
import type { SessionDurationMinutes, SessionSetup } from '../session/session';
import { SESSION_DURATIONS_MINUTES } from '../session/session';

// Session setup (MGP6-01). Offers supported durations, grade presets, enable
// controls per problem entry, and only the settings relevant to each enabled
// type. Holds the draft SessionSetup in local state; applying a preset seeds
// the enabled types/settings while still permitting adjustment. Start is
// disabled when no problem type is enabled (mirrors `isStartable`).

type OperationKey = 'addition' | 'subtraction' | 'multiplication';

interface DraftEntry {
  id: number;
  operation: OperationKey;
  enabled: boolean;
  config: ProblemConfig;
}

const TYPE_LABELS: Record<OperationKey, string> = {
  addition: 'Addition',
  subtraction: 'Subtraction',
  multiplication: 'Multiplication',
};

const CARRY_MODES: readonly CarryMode[] = ['forbidden', 'allowed', 'required'];
const GRADE_LEVELS: readonly GradeLevel[] = [2, 3, 4];
const DIGIT_COUNTS = [1, 2, 3, 4] as const;

function defaultDrafts(): DraftEntry[] {
  return [
    { id: 0, operation: 'addition', enabled: true, config: { operation: 'addition', leftDigits: 1, rightDigits: 1 } },
    { id: 1, operation: 'subtraction', enabled: false, config: { operation: 'subtraction', leftDigits: 1, rightDigits: 1 } },
    { id: 2, operation: 'multiplication', enabled: false, config: { operation: 'multiplication', leftDigits: 1, rightDigits: 1 } },
  ];
}

interface SetupViewProps {
  onStart: (setup: SessionSetup) => void;
}

export function SetupView({ onStart }: SetupViewProps) {
  const [duration, setDuration] = useState<SessionDurationMinutes>(5);
  const [drafts, setDrafts] = useState<DraftEntry[]>(defaultDrafts);

  const enabledConfigs = drafts.filter((d) => d.enabled).map((d) => d.config);
  const canStart = enabledConfigs.length > 0;

  const applyPreset = (level: GradeLevel) => {
    setDrafts(GRADE_PRESETS[level].enabled.map((config, i) => ({
      id: i,
      operation: config.operation,
      enabled: true,
      config: { ...config },
    })));
  };

  const setEnabled = (id: number, enabled: boolean) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, enabled } : d)));
  };

  const updateConfig = (id: number, patch: Partial<ProblemConfig>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, config: { ...d.config, ...patch } as ProblemConfig } : d)),
    );
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-3">
      <section aria-labelledby="setup-duration" className="flex flex-col gap-2">
        <h2 id="setup-duration" className="text-sm font-semibold text-neutral-200">
          Session length
        </h2>
        <div className="flex gap-3">
          {SESSION_DURATIONS_MINUTES.map((minutes) => (
            <label key={minutes} className="flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="duration"
                checked={duration === minutes}
                onChange={() => setDuration(minutes)}
              />
              {minutes} min
            </label>
          ))}
        </div>
      </section>

      <section aria-labelledby="setup-presets" className="flex flex-col gap-2">
        <h2 id="setup-presets" className="text-sm font-semibold text-neutral-200">
          Grade preset
        </h2>
        <div className="flex gap-3">
          {GRADE_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => applyPreset(level)}
              className="rounded-lg border border-panel-border bg-panel px-3 py-1.5 text-sm hover:bg-panel/70"
            >
              {GRADE_PRESETS[level].name}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="setup-types" className="flex flex-col gap-2">
        <h2 id="setup-types" className="text-sm font-semibold text-neutral-200">
          Problem types
        </h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {drafts.map((draft) => (
          <fieldset
            key={draft.id}
            aria-label={`${TYPE_LABELS[draft.operation]} settings`}
            className="rounded-xl border border-neutral-600 bg-neutral-700 p-3 text-neutral-300"
          >
            <legend className="sr-only">{TYPE_LABELS[draft.operation]}</legend>
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-neutral-100">{TYPE_LABELS[draft.operation]}</h3>
              <SwitchControl
                label={`Include ${TYPE_LABELS[draft.operation]} in session`}
                checked={draft.enabled}
                onChange={(enabled) => setEnabled(draft.id, enabled)}
                caption="Include"
              />
            </div>
            <TypeSettings config={draft.config} onChange={(patch) => updateConfig(draft.id, patch)} />
          </fieldset>
        ))}
        </div>
      </section>

      <button
        type="button"
        disabled={!canStart}
        onClick={() => onStart({ durationMinutes: duration, enabledConfigs })}
        className="self-start rounded-lg border border-panel-border bg-panel px-6 py-2 font-medium text-neutral-100 hover:bg-panel/70 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Start session
      </button>
    </div>
  );
}

function TypeSettings({ config, onChange }: { config: ProblemConfig; onChange: (patch: Partial<ProblemConfig>) => void }) {
  const digits = (
    <>
      <DigitField label="Top Digits" value={config.leftDigits} onChange={(value) => onChange({ leftDigits: value })} />
      <DigitField label="Bottom Digits" value={config.rightDigits} onChange={(value) => onChange({ rightDigits: value })} />
    </>
  );

  if (config.operation === 'addition') {
    return (
      <div className="flex flex-col gap-1">
        {digits}
        <ModeField
          label="Carry"
          value={config.carryMode ?? 'allowed'}
          noModeLabel="No Carry"
          onChange={(v) => onChange({ carryMode: v as CarryMode })}
        />
        <OptionalNumberField
          label="Max Result"
          value={config.maxResult}
          fallback={9999}
          min={2}
          max={9999}
          onChange={(value) => onChange({ maxResult: value })}
        />
      </div>
    );
  }

  if (config.operation === 'subtraction') {
    return (
      <div className="flex flex-col gap-1">
        {digits}
        <ModeField
          label="Borrow"
          value={config.borrowMode ?? 'allowed'}
          noModeLabel="No Borrow"
          onChange={(v) => onChange({ borrowMode: v as CarryMode })}
        />
        <OptionalNumberField
          label="Max Difference"
          value={config.maxDifference}
          fallback={9999}
          min={0}
          max={9999}
          onChange={(value) => onChange({ maxDifference: value })}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {digits}
      <ModeField
        label="Carry"
        value={config.carryMode ?? 'allowed'}
        noModeLabel="No Carry"
        onChange={(v) => onChange({ carryMode: v as CarryMode })}
      />
      <OptionalNumberField
        label="Min Factor"
        value={config.minFactor}
        fallback={1}
        min={1}
        max={9999}
        onChange={(value) => onChange({ minFactor: value })}
      />
      <OptionalNumberField
        label="Max Factor"
        value={config.maxFactor}
        fallback={9999}
        min={1}
        max={9999}
        onChange={(value) => onChange({ maxFactor: value })}
      />
    </div>
  );
}

function DigitField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="text-sm">{label}</span>
      <div role="group" aria-label={label} className="flex gap-1">
        {DIGIT_COUNTS.map((count) => (
          <button
            key={count}
            type="button"
            aria-label={`${label} ${count}`}
            aria-pressed={value === count}
            onClick={() => onChange(count)}
            className={`h-8 w-8 rounded-md border text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
              value === count
                ? 'border-blue-500 bg-blue-600 text-white'
                : 'border-neutral-400 text-neutral-200 hover:bg-neutral-600'
            }`}
          >
            {count}
          </button>
        ))}
      </div>
    </div>
  );
}

function ModeField({
  label,
  value,
  noModeLabel,
  onChange,
}: {
  label: string;
  value: CarryMode;
  noModeLabel: string;
  onChange: (value: CarryMode) => void;
}) {
  const labels: Record<CarryMode, string> = {
    forbidden: noModeLabel,
    allowed: 'Allowed',
    required: 'Required',
  };

  return (
    <div className="flex items-center justify-between gap-1">
      <span className="text-sm">{label}</span>
      <div role="group" aria-label={label} className="flex gap-1">
        {CARRY_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={value === mode}
            onClick={() => onChange(mode)}
            className={`rounded-md border px-2 py-0.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
              value === mode
                ? 'border-blue-500 bg-blue-600 text-white'
                : 'border-neutral-400 text-neutral-200 hover:bg-neutral-600'
            }`}
          >
            {labels[mode]}
          </button>
        ))}
      </div>
    </div>
  );
}

function OptionalNumberField({
  label,
  value,
  fallback,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number | undefined;
  fallback: number;
  min: number;
  max: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-1">
      <label className="flex items-center gap-1 text-sm">
        {label}
        <input
          type="number"
          value={value ?? fallback}
          min={min}
          max={max}
          disabled={value === undefined}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-20 rounded border border-neutral-400 bg-neutral-800 px-1 py-0.5 text-center disabled:text-neutral-500"
        />
      </label>
      <SwitchControl
        label={`Enable ${label.toLowerCase()}`}
        checked={value !== undefined}
        onChange={(enabled) => onChange(enabled ? fallback : undefined)}
      />
    </div>
  );
}

function SwitchControl({
  label,
  checked,
  onChange,
  caption,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  caption?: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      {caption}
      <span className="relative inline-flex h-6 w-12 shrink-0 rounded-full bg-neutral-500 transition-colors has-checked:bg-blue-600">
        <input
          type="checkbox"
          role="switch"
          aria-label={label}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="pointer-events-none absolute left-0.5 top-0.5 size-5 rounded-full bg-neutral-200 transition-transform peer-checked:translate-x-6" />
      </span>
    </label>
  );
}
