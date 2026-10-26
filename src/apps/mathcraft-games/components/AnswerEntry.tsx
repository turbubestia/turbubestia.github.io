import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import type { SubmitOutcome } from '../session/session';

// Transient answer entry for the active step (MGP6-02, MGP6-06). Owns the entry
// string and the fixed 2-second wrong-answer feedback interval; digit-append,
// delete, and submit are fed by both the physical keyboard (via the handle) and
// the on-screen keypad. Performs no validation; outcomes come from submitAnswer.

/** Imperative entry operations used by the physical-keyboard listener. */
export interface AnswerEntryHandle {
  appendDigit: (digit: string) => void;
  deleteDigit: () => void;
  submit: () => void;
  activateEnter: () => void;
}

interface AnswerEntryProps {
  /** External disable: paused, no active problem, etc. */
  disabled?: boolean;
  /** Switches Enter from answer submission to advancing after combat presentation. */
  nextEnabled?: boolean;
  onSubmit: (answer: string) => SubmitOutcome;
  onNext: () => void;
  /** Reports whether entry currently accepts input (false during wrong-answer feedback). */
  onAcceptingChange?: (accepting: boolean) => void;
}

const WRONG_FEEDBACK_MS = 2000;
const MAX_ENTRY_LENGTH = 8;
const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const AnswerEntry = forwardRef<AnswerEntryHandle, AnswerEntryProps>(function AnswerEntry(
  { disabled = false, nextEnabled = false, onSubmit, onNext, onAcceptingChange },
  ref,
) {
  const [value, setValue] = useState('');
  // Non-null during the wrong-answer feedback interval; holds the entered value
  // so it stays visible (in red) for the full interval before being discarded.
  const [wrongValue, setWrongValue] = useState<string | null>(null);
  const accepting = !disabled && wrongValue === null;

  // The feedback timer always runs to completion and is cleaned up on unmount.
  useEffect(() => {
    if (wrongValue === null) {
      return;
    }
    const id = window.setTimeout(() => setWrongValue(null), WRONG_FEEDBACK_MS);
    return () => window.clearTimeout(id);
  }, [wrongValue]);

  useEffect(() => {
    onAcceptingChange?.(accepting);
  }, [accepting, onAcceptingChange]);

  const appendDigit = useCallback(
    (digit: string) => {
      if (!accepting || nextEnabled) {
        return;
      }
      setValue((v) => (v.length >= MAX_ENTRY_LENGTH ? v : v + digit));
    },
    [accepting, nextEnabled],
  );

  const deleteDigit = useCallback(() => {
    if (!accepting || nextEnabled) {
      return;
    }
    setValue((v) => v.slice(0, -1));
  }, [accepting, nextEnabled]);

  const submit = useCallback(() => {
    if (!accepting || value === '') {
      return;
    }
    const outcome = onSubmit(value);
    if (outcome.status === 'wrong') {
      // Keep the entered value visible in red for the full feedback interval.
      setValue('');
      setWrongValue(value);
    } else {
      setValue('');
    }
  }, [accepting, value, onSubmit]);

  const activateEnter = useCallback(() => {
    if (!accepting) {
      return;
    }
    if (nextEnabled) {
      onNext();
      return;
    }
    submit();
  }, [accepting, nextEnabled, onNext, submit]);

  useImperativeHandle(ref, () => ({ appendDigit, deleteDigit, submit, activateEnter }), [appendDigit, deleteDigit, submit, activateEnter]);

  const display = wrongValue ?? value;

  return (
    <div className="flex w-full min-w-0 max-w-sm flex-col items-center gap-3">
      <div
        aria-live="polite"
        className={`flex h-12 w-full items-center justify-center rounded-lg border font-mono text-2xl ${
          wrongValue !== null ? 'border-red-500 bg-bg text-red-400' : 'border-panel-border bg-bg text-neutral-100'
        }`}
      >
        {display === '' ? <span className="text-neutral-600">_</span> : display}
      </div>

      <div role="group" aria-label="Answer keypad" className="grid w-full grid-cols-3 gap-2">
        {KEYPAD_DIGITS.map((digit) => (
          <KeypadButton key={digit} onClick={() => appendDigit(digit)} disabled={!accepting || nextEnabled}>
            {digit}
          </KeypadButton>
        ))}
        <KeypadButton onClick={deleteDigit} disabled={!accepting || nextEnabled} ariaLabel="Delete last digit">
          ⌫
        </KeypadButton>
        <KeypadButton onClick={() => appendDigit('0')} disabled={!accepting || nextEnabled}>
          0
        </KeypadButton>
        <KeypadButton
          onClick={activateEnter}
          disabled={!accepting || (!nextEnabled && value === '')}
          ariaLabel={nextEnabled ? 'Next' : 'Submit answer'}
        >
          {nextEnabled ? 'Next' : 'Enter'}
        </KeypadButton>
      </div>
    </div>
  );
});

function KeypadButton({
  children,
  onClick,
  disabled,
  ariaLabel,
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="h-12 w-full rounded-lg border border-panel-border bg-panel text-lg font-mono hover:bg-panel/70 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
