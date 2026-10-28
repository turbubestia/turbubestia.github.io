// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DefeatOverlay } from './DefeatOverlay';

describe('DefeatOverlay (MGP6-03, MGP6-04)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the defeat dialog with respawn and end-session controls', () => {
    render(<DefeatOverlay onRespawn={() => undefined} onEndSession={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'Defeated' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'RESPAWN' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'END SESSION' })).not.toBeNull();
  });

  it('calls onRespawn when the respawn control is clicked', () => {
    const onRespawn = vi.fn();
    render(<DefeatOverlay onRespawn={onRespawn} onEndSession={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'RESPAWN' }));
    expect(onRespawn).toHaveBeenCalledTimes(1);
  });

  it('calls onEndSession when the end-session control is clicked', () => {
    const onEndSession = vi.fn();
    render(<DefeatOverlay onRespawn={() => undefined} onEndSession={onEndSession} />);
    fireEvent.click(screen.getByRole('button', { name: 'END SESSION' }));
    expect(onEndSession).toHaveBeenCalledTimes(1);
  });

  it('does not expose any answer-entry controls (no problem-state mutation)', () => {
    render(<DefeatOverlay onRespawn={() => undefined} onEndSession={() => undefined} />);
    // Only the two decision controls exist; no keypad or submit affordance.
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });
});
