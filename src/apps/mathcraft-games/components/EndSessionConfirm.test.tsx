// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EndSessionConfirm } from './EndSessionConfirm';

describe('EndSessionConfirm', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders an accessible confirmation dialog with cancel and confirm actions', () => {
    render(<EndSessionConfirm onCancel={() => undefined} onConfirm={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'End this session?' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'CANCEL' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'CONFIRM END SESSION' })).not.toBeNull();
  });

  it('forwards cancel and confirm actions', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<EndSessionConfirm onCancel={onCancel} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }));
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRM END SESSION' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});