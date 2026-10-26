// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PauseOverlay } from './PauseOverlay';

describe('PauseOverlay (MGP6-04)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the manual-pause heading and a resume control', () => {
    render(<PauseOverlay kind="manual" offersEndSession={false} onResume={() => undefined} onEndSession={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'Paused' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Resume' })).not.toBeNull();
  });

  it('renders the idle "Still There" heading and its explanatory text', () => {
    render(<PauseOverlay kind="idle" offersEndSession={false} onResume={() => undefined} onEndSession={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'Still there?' })).not.toBeNull();
    expect(screen.getByText('No keyboard input for a minute.')).not.toBeNull();
  });

  it('does not offer end-session for a manual pause', () => {
    render(<PauseOverlay kind="manual" offersEndSession={false} onResume={() => undefined} onEndSession={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'End session' })).toBeNull();
  });

  it('does not offer end-session for a non-expired idle pause', () => {
    render(<PauseOverlay kind="idle" offersEndSession={false} onResume={() => undefined} onEndSession={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'End session' })).toBeNull();
  });

  it('offers end-session in addition to resume when the idle pause is post-expiration', () => {
    render(<PauseOverlay kind="idle" offersEndSession={true} onResume={() => undefined} onEndSession={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Resume' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'End session' })).not.toBeNull();
  });

  it('calls onResume when the resume control is clicked', () => {
    const onResume = vi.fn();
    render(<PauseOverlay kind="manual" offersEndSession={false} onResume={onResume} onEndSession={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('calls onEndSession when the end-session control is clicked', () => {
    const onEndSession = vi.fn();
    render(<PauseOverlay kind="idle" offersEndSession={true} onResume={() => undefined} onEndSession={onEndSession} />);
    fireEvent.click(screen.getByRole('button', { name: 'End session' }));
    expect(onEndSession).toHaveBeenCalledTimes(1);
  });
});
