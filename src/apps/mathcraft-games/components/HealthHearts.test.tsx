// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { HealthHearts } from './HealthHearts';

/** Count the filled (♥) and empty (♡) heart glyphs rendered. */
function countHearts(container: HTMLElement): { filled: number; empty: number } {
  const spans = Array.from(container.querySelectorAll('span'));
  return {
    filled: spans.filter((s) => s.textContent === '♥').length,
    empty: spans.filter((s) => s.textContent === '♡').length,
  };
}

describe('HealthHearts (MGP6-07)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders one heart per max-health point', () => {
    const { container } = render(<HealthHearts current={3} max={5} />);
    const { filled, empty } = countHearts(container);
    expect(filled + empty).toBe(5);
  });

  it('fills hearts up to the current value and leaves the rest empty', () => {
    const { container } = render(<HealthHearts current={2} max={4} />);
    const { filled, empty } = countHearts(container);
    expect(filled).toBe(2);
    expect(empty).toBe(2);
  });

  it('renders all hearts filled when current equals max', () => {
    const { container } = render(<HealthHearts current={5} max={5} />);
    const { filled, empty } = countHearts(container);
    expect(filled).toBe(5);
    expect(empty).toBe(0);
  });

  it('renders all hearts empty when current is zero', () => {
    const { container } = render(<HealthHearts current={0} max={3} />);
    const { filled, empty } = countHearts(container);
    expect(filled).toBe(0);
    expect(empty).toBe(3);
  });

  it('clamps a current value above max down to max', () => {
    const { container } = render(<HealthHearts current={9} max={4} />);
    const { filled, empty } = countHearts(container);
    expect(filled).toBe(4);
    expect(empty).toBe(0);
  });

  it('clamps a negative current value up to zero', () => {
    const { container } = render(<HealthHearts current={-2} max={4} />);
    const { filled, empty } = countHearts(container);
    expect(filled).toBe(0);
    expect(empty).toBe(4);
  });

  it('exposes an accessible summary including the supplied label', () => {
    render(<HealthHearts current={3} max={5} label="Hero health" />);
    expect(screen.getByRole('img', { name: 'Hero health: 3 of 5' })).not.toBeNull();
  });

  it('exposes an accessible summary without a label', () => {
    render(<HealthHearts current={1} max={2} />);
    expect(screen.getByRole('img', { name: '1 of 2' })).not.toBeNull();
  });
});
