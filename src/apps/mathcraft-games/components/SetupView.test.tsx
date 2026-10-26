// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { SessionSetup } from '../session/session';
import { SetupView } from './SetupView';

/** The enable checkbox inside the fieldset whose legend has `legendText`. */
function typeCheckbox(legendText: string): HTMLInputElement {
  const fieldset = typeCard(legendText);
  const checkbox = fieldset?.querySelector('input[aria-label^="Include "]');
  if (checkbox === null) {
    throw new Error(`no enable checkbox found for "${legendText}"`);
  }
  return checkbox as HTMLInputElement;
}

function typeCard(headingText: string): HTMLElement {
  const fieldset = screen.getByRole('heading', { name: headingText }).closest('fieldset');
  if (fieldset === null) {
    throw new Error(`no settings card found for "${headingText}"`);
  }
  return fieldset;
}

describe('SetupView (MGP6-01)', () => {
  afterEach(() => {
    cleanup();
  });

  it('offers the supported session durations with a default selection', () => {
    render(<SetupView onStart={() => undefined} />);
    expect(screen.getByRole('radio', { name: '2 min' })).not.toBeNull();
    expect(screen.getByRole('radio', { name: '5 min' })).not.toBeNull();
    expect(screen.getByRole('radio', { name: '10 min' })).not.toBeNull();
    // 5 minutes is the default.
    expect((screen.getByRole('radio', { name: '5 min' }) as HTMLInputElement).checked).toBe(true);
  });

  it('offers one grade preset per supported grade level', () => {
    render(<SetupView onStart={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Grade 2' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Grade 3' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Grade 4' })).not.toBeNull();
  });

  it('offers one include switch per operation and optional-limit switches', () => {
    const { container } = render(<SetupView onStart={() => undefined} />);
    expect(container.querySelectorAll('input[role="switch"]')).toHaveLength(7);
  });

  it('shows a settings card for each operation by default', () => {
    render(<SetupView onStart={() => undefined} />);
    expect(screen.getAllByRole('group', { name: 'Top Digits' })).toHaveLength(3);
    expect(screen.getAllByRole('group', { name: 'Bottom Digits' })).toHaveLength(3);
    expect(screen.getByText('Max Difference')).not.toBeNull();
  });

  it('allows configuring a problem type while it is excluded', () => {
    const onStart = vi.fn();
    render(<SetupView onStart={onStart} />);
    const subtraction = within(typeCard('Subtraction'));
    fireEvent.click(subtraction.getByRole('button', { name: 'Top Digits 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    expect(onStart.mock.calls[0][0].enabledConfigs).toEqual([
      { operation: 'addition', leftDigits: 1, rightDigits: 1 },
    ]);

    fireEvent.click(typeCheckbox('Subtraction'));
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    expect(onStart.mock.calls[1][0].enabledConfigs).toEqual([
      { operation: 'addition', leftDigits: 1, rightDigits: 1 },
      { operation: 'subtraction', leftDigits: 2, rightDigits: 1 },
    ]);
  });

  it('keeps a type\'s settings visible when its include switch is unchecked', () => {
    render(<SetupView onStart={() => undefined} />);
    fireEvent.click(typeCheckbox('Addition'));
    expect(screen.getAllByRole('group', { name: 'Top Digits' })).toHaveLength(3);
  });

  it('applies a grade preset, enabling its problem types and seeding their settings', () => {
    render(<SetupView onStart={() => undefined} />);
    // Grade 2 enables addition and subtraction.
    fireEvent.click(screen.getByRole('button', { name: 'Grade 2' }));
    expect(typeCheckbox('Addition').checked).toBe(true);
    expect(typeCheckbox('Subtraction').checked).toBe(true);
    expect(screen.getByText('Max Difference')).not.toBeNull();
  });

  it('disables Start when no problem type is enabled', () => {
    render(<SetupView onStart={() => undefined} />);
    const start = screen.getByRole('button', { name: 'Start session' }) as HTMLButtonElement;
    expect(start.disabled).toBe(false);
    // Uncheck the only type that is enabled by default.
    fireEvent.click(typeCheckbox('Addition'));
    expect(start.disabled).toBe(true);
  });

  it('reports the finalized setup and start action when Start is clicked', () => {
    const onStart = vi.fn();
    render(<SetupView onStart={onStart} />);
    // Select the 10-minute duration.
    fireEvent.click(screen.getByRole('radio', { name: '10 min' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    expect(onStart).toHaveBeenCalledTimes(1);
    const setup = onStart.mock.calls[0][0] as SessionSetup;
    expect(setup.durationMinutes).toBe(10);
    // Only addition is enabled by default.
    expect(setup.enabledConfigs).toEqual([{ operation: 'addition', leftDigits: 1, rightDigits: 1 }]);
  });

  it('does not call Start when no problem type is enabled', () => {
    const onStart = vi.fn();
    render(<SetupView onStart={onStart} />);
    fireEvent.click(typeCheckbox('Addition'));
    const start = screen.getByRole('button', { name: 'Start session' }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    // A disabled button does not fire its handler.
    fireEvent.click(start);
    expect(onStart).not.toHaveBeenCalled();
  });
});
