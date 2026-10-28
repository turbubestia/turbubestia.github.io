// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AnswerEntryHandle } from './AnswerEntry';
import { AnswerEntry } from './AnswerEntry';

interface EntryProps {
  disabled?: boolean;
  nextEnabled?: boolean;
  onSubmit: (answer: string) => { status: 'accepted' | 'wrong' };
  onNext: () => void;
  onAcceptingChange?: (accepting: boolean) => void;
}

function makeProps(overrides: Partial<EntryProps> = {}): EntryProps {
  return {
    disabled: false,
    onSubmit: vi.fn(() => ({ status: 'accepted' as const })),
    onNext: vi.fn(),
    ...overrides,
  };
}

/** The text of the aria-live answer display ("_" when empty). */
function displayText(container: HTMLElement): string {
  return container.querySelector('[aria-live="polite"]')?.textContent ?? '';
}

/** The className of the answer display (used to detect the red wrong-answer state). */
function displayClass(container: HTMLElement): string {
  return container.querySelector('[aria-live="polite"]')?.className ?? '';
}

describe('AnswerEntry (MGP6-02, MGP6-06)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the on-screen keypad (0–9, delete, enter)', () => {
    render(<AnswerEntry {...makeProps()} />);
    expect(screen.getByRole('group', { name: 'Answer keypad' })).not.toBeNull();
    for (const digit of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
      expect(screen.getByRole('button', { name: digit })).not.toBeNull();
    }
    expect(screen.getByRole('button', { name: '⌫' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'ENTER' })).not.toBeNull();
  });

  it('appends digits and deletes via the imperative handle (physical keyboard)', () => {
    const ref = createRef<AnswerEntryHandle>();
    const { container } = render(<AnswerEntry ref={ref} {...makeProps()} />);
    act(() => {
      ref.current?.appendDigit('1');
      ref.current?.appendDigit('2');
    });
    expect(displayText(container)).toBe('12');
    act(() => {
      ref.current?.deleteDigit();
    });
    expect(displayText(container)).toBe('1');
  });

  it('submits the entered value and clears entry on a non-wrong outcome', () => {
    const onSubmit = vi.fn(() => ({ status: 'accepted' as const }));
    const ref = createRef<AnswerEntryHandle>();
    const { container } = render(<AnswerEntry ref={ref} {...makeProps({ onSubmit })} />);
    act(() => {
      ref.current?.appendDigit('5');
    });
    act(() => {
      ref.current?.submit();
    });
    expect(onSubmit).toHaveBeenCalledWith('5');
    // Entry is cleared after a non-wrong outcome.
    expect(displayText(container)).toBe('_');
  });

  it('does not submit an empty entry', () => {
    const onSubmit = vi.fn(() => ({ status: 'accepted' as const }));
    const ref = createRef<AnswerEntryHandle>();
    render(<AnswerEntry ref={ref} {...makeProps({ onSubmit })} />);
    act(() => {
      ref.current?.submit();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('uses Enter to advance once Next is enabled, including through the keyboard handle', () => {
    const onSubmit = vi.fn(() => ({ status: 'accepted' as const }));
    const onNext = vi.fn();
    const ref = createRef<AnswerEntryHandle>();
    render(<AnswerEntry ref={ref} {...makeProps({ onSubmit, onNext, nextEnabled: true })} />);

    const nextButton = screen.getByRole('button', { name: 'NEXT' });
    expect((nextButton as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('button', { name: 'ENTER' })).toBeNull();
    expect((screen.getByRole('button', { name: '1' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(nextButton);
    act(() => {
      ref.current?.activateEnter();
    });

    expect(onNext).toHaveBeenCalledTimes(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('no-ops all input while externally disabled', () => {
    const onSubmit = vi.fn(() => ({ status: 'accepted' as const }));
    const ref = createRef<AnswerEntryHandle>();
    const { container } = render(<AnswerEntry ref={ref} {...makeProps({ onSubmit, disabled: true })} />);
    act(() => {
      ref.current?.appendDigit('3');
      ref.current?.submit();
    });
    expect(displayText(container)).toBe('_');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('reports accepting-state changes via onAcceptingChange', () => {
    const onAcceptingChange = vi.fn();
    render(<AnswerEntry {...makeProps({ onSubmit: () => ({ status: 'accepted' }), onAcceptingChange })} />);
    // Initially accepting.
    expect(onAcceptingChange).toHaveBeenLastCalledWith(true);
  });

  describe('wrong-answer feedback interval (fake timers)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows the entered value in red for exactly 1s, then discards it and re-enables entry', () => {
      const onSubmit = vi.fn(() => ({ status: 'wrong' as const }));
      const ref = createRef<AnswerEntryHandle>();
      const { container } = render(<AnswerEntry ref={ref} {...makeProps({ onSubmit })} />);

      act(() => {
        ref.current?.appendDigit('7');
      });
      act(() => {
        ref.current?.submit();
      });
      expect(onSubmit).toHaveBeenCalledWith('7');

      // During the interval: value shown in red, entry disabled.
      expect(displayText(container)).toBe('7');
      expect(displayClass(container)).toContain('text-red-400');
      expect((screen.getByRole('button', { name: '1' }) as HTMLButtonElement).disabled).toBe(true);

      // Just before 1s the feedback is still active.
      act(() => {
        vi.advanceTimersByTime(999);
      });
      expect(displayText(container)).toBe('7');
      expect(displayClass(container)).toContain('text-red-400');

      // At 1s the value is discarded and entry re-enables on the same step.
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(displayText(container)).toBe('_');
      expect(displayClass(container)).not.toContain('text-red-400');
      // A digit key is enabled again (the submit key stays disabled while entry is empty).
      expect((screen.getByRole('button', { name: '1' }) as HTMLButtonElement).disabled).toBe(false);
    });

    it('no-ops input during the wrong-answer interval', () => {
      const onSubmit = vi.fn(() => ({ status: 'wrong' as const }));
      const ref = createRef<AnswerEntryHandle>();
      const { container } = render(<AnswerEntry ref={ref} {...makeProps({ onSubmit })} />);

      act(() => {
        ref.current?.appendDigit('9');
      });
      act(() => {
        ref.current?.submit();
      });
      // Attempting to type during the interval is ignored.
      act(() => {
        ref.current?.appendDigit('4');
      });
      expect(displayText(container)).toBe('9');
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('reports non-accepting during the interval and accepting again after it ends', () => {
      const onAcceptingChange = vi.fn();
      const ref = createRef<AnswerEntryHandle>();
      render(<AnswerEntry ref={ref} {...makeProps({ onSubmit: () => ({ status: 'wrong' }), onAcceptingChange })} />);

      act(() => {
        ref.current?.appendDigit('2');
      });
      act(() => {
        ref.current?.submit();
      });
      expect(onAcceptingChange).toHaveBeenLastCalledWith(false);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onAcceptingChange).toHaveBeenLastCalledWith(true);
    });

    it('cleans up the wrong-answer timer on unmount', () => {
      const clearSpy = vi.spyOn(window, 'clearTimeout');
      const ref = createRef<AnswerEntryHandle>();
      const { unmount } = render(<AnswerEntry ref={ref} {...makeProps({ onSubmit: () => ({ status: 'wrong' }) })} />);
      act(() => {
        ref.current?.appendDigit('1');
      });
      act(() => {
        ref.current?.submit();
      });
      unmount();
      expect(clearSpy).toHaveBeenCalled();
      clearSpy.mockRestore();
    });
  });
});
