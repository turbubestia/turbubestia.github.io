// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RPGHeartRow } from './HealthHearts';

/**
 * Each heart renders exactly one fill-overlay div whose inline `clipPath`
 * encodes its fill: `inset(100% 0 0 0)` = empty, `inset(0% 0 0 0)` = full,
 * and an intermediate inset for a proportionally filled active heart.
 */
function getHeartFills(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('div'))
    .filter((el) => el.style.clipPath !== '')
    .map((el) => el.style.clipPath);
}

/** Read the A/B counter values from the row's counter block. */
function getCounter(container: HTMLElement): { current: string; total: string } {
  const counter = container.querySelector('[class*="min-w-"]');
  const spans = Array.from(counter?.querySelectorAll('span') ?? []);
  return { current: spans[0]?.textContent ?? '', total: spans[2]?.textContent ?? '' };
}

describe('RPGHeartRow (MGP6-07)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a single heart for a single-heart row with the correct A/B values', () => {
    const { container } = render(
      <RPGHeartRow selectedHeartIndex={0} currentHp={7} totalHp={12} maxHearts={1} />,
    );
    expect(getHeartFills(container)).toHaveLength(1);
    expect(getCounter(container)).toEqual({ current: '7', total: '12' });
  });

  it('renders N hearts for a multi-heart row with the active heart proportional, earlier empty, later full', () => {
    const { container } = render(
      <RPGHeartRow selectedHeartIndex={1} currentHp={5} totalHp={10} maxHearts={3} />,
    );
    const fills = getHeartFills(container);
    expect(fills).toHaveLength(3);
    // Heart 0 (before active) is empty.
    expect(fills[0]).toBe('inset(100% 0 0 0)');
    // Heart 1 (active) is filled to 5/10 = 50%.
    expect(fills[1]).toBe('inset(50% 0 0 0)');
    // Heart 2 (after active) is full.
    expect(fills[2]).toBe('inset(0% 0 0 0)');
  });

  it('reflects the active heart current/total in the A/B counter', () => {
    const { container } = render(
      <RPGHeartRow selectedHeartIndex={2} currentHp={3} totalHp={9} maxHearts={3} />,
    );
    expect(getCounter(container)).toEqual({ current: '3', total: '9' });
  });

  it('shows the HEART N sublabel for multi-heart rows', () => {
    render(<RPGHeartRow selectedHeartIndex={1} currentHp={4} totalHp={8} maxHearts={3} />);
    expect(screen.getByText('HEART 2')).not.toBeNull();
  });

  it('hides the HEART N sublabel for single-heart rows but keeps the A/B counter', () => {
    const { container } = render(
      <RPGHeartRow selectedHeartIndex={0} currentHp={4} totalHp={8} maxHearts={1} />,
    );
    expect(screen.queryByText(/HEART \d+/)).toBeNull();
    expect(getCounter(container)).toEqual({ current: '4', total: '8' });
  });

  it('clamps an out-of-range selectedHeartIndex down to the last heart', () => {
    const { container } = render(
      <RPGHeartRow selectedHeartIndex={99} currentHp={5} totalHp={10} maxHearts={3} />,
    );
    const fills = getHeartFills(container);
    // Clamped to index 2: hearts 0 and 1 empty, heart 2 proportional (50%).
    expect(fills[0]).toBe('inset(100% 0 0 0)');
    expect(fills[1]).toBe('inset(100% 0 0 0)');
    expect(fills[2]).toBe('inset(50% 0 0 0)');
    expect(screen.getByText('HEART 3')).not.toBeNull();
  });

  it('clamps a negative selectedHeartIndex up to the first heart', () => {
    const { container } = render(
      <RPGHeartRow selectedHeartIndex={-5} currentHp={5} totalHp={10} maxHearts={3} />,
    );
    const fills = getHeartFills(container);
    // Clamped to index 0: heart 0 proportional (50%), hearts 1 and 2 full.
    expect(fills[0]).toBe('inset(50% 0 0 0)');
    expect(fills[1]).toBe('inset(0% 0 0 0)');
    expect(fills[2]).toBe('inset(0% 0 0 0)');
    expect(screen.getByText('HEART 1')).not.toBeNull();
  });

  it('clamps a currentHp above totalHp down to the total in the A/B counter', () => {
    const { container } = render(
      <RPGHeartRow selectedHeartIndex={0} currentHp={20} totalHp={10} maxHearts={1} />,
    );
    expect(getCounter(container)).toEqual({ current: '10', total: '10' });
  });

  it('clamps a negative currentHp up to zero in the A/B counter', () => {
    const { container } = render(
      <RPGHeartRow selectedHeartIndex={0} currentHp={-5} totalHp={10} maxHearts={1} />,
    );
    expect(getCounter(container)).toEqual({ current: '0', total: '10' });
  });

  it('floors a zero totalHp to one in the A/B counter denominator', () => {
    const { container } = render(
      <RPGHeartRow selectedHeartIndex={0} currentHp={5} totalHp={0} maxHearts={1} />,
    );
    expect(getCounter(container)).toEqual({ current: '1', total: '1' });
  });
});
