// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { SessionSummary } from '../session/session';
import { SummaryView } from './SummaryView';

function makeSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    questionsAttempted: 12,
    questionsCompleted: 9,
    stepAttempts: 30,
    acceptedSteps: 24,
    stepAccuracy: 0.8,
    totalDamageDealt: 45,
    totalActiveTimeMs: 3 * 60_000 + 5_000, // 3:05
    bossesDefeated: 1,
    equipmentEarned: 2,
    ...overrides,
  };
}

describe('SummaryView (MGP6-04)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the completed-session heading', () => {
    render(<SummaryView summary={makeSummary()} />);
    expect(screen.getByText('Session complete')).not.toBeNull();
  });

  it('displays questions attempted and completed', () => {
    render(<SummaryView summary={makeSummary({ questionsAttempted: 12, questionsCompleted: 9 })} />);
    expect(screen.getByText('Questions attempted').textContent).toBe('Questions attempted');
    expect(screen.getByText('Questions completed').textContent).toBe('Questions completed');
    // The values are the sibling <dd> elements.
    const dd = (label: string) => screen.getByText(label).parentElement?.querySelector('dd')?.textContent ?? '';
    expect(dd('Questions attempted')).toBe('12');
    expect(dd('Questions completed')).toBe('9');
  });

  it('displays step-level accuracy as a rounded percentage', () => {
    render(<SummaryView summary={makeSummary({ stepAccuracy: 0.75 })} />);
    const dd = screen.getByText('Step accuracy').parentElement?.querySelector('dd')?.textContent ?? '';
    expect(dd).toBe('75%');
  });

  it('displays total damage dealt', () => {
    render(<SummaryView summary={makeSummary({ totalDamageDealt: 45 })} />);
    const dd = screen.getByText('Total damage dealt').parentElement?.querySelector('dd')?.textContent ?? '';
    expect(dd).toBe('45');
  });

  it('formats total active time as minutes:seconds', () => {
    render(<SummaryView summary={makeSummary({ totalActiveTimeMs: 3 * 60_000 + 5_000 })} />);
    const dd = screen.getByText('Active time').parentElement?.querySelector('dd')?.textContent ?? '';
    expect(dd).toBe('3:05');
  });

  it('displays bosses defeated and equipment earned', () => {
    render(<SummaryView summary={makeSummary({ bossesDefeated: 1, equipmentEarned: 2 })} />);
    const dd = (label: string) => screen.getByText(label).parentElement?.querySelector('dd')?.textContent ?? '';
    expect(dd('Bosses defeated')).toBe('1');
    expect(dd('Equipment earned')).toBe('2');
  });

  it('renders all seven metric rows', () => {
    const { container } = render(<SummaryView summary={makeSummary()} />);
    expect(container.querySelectorAll('dt')).toHaveLength(7);
    expect(container.querySelectorAll('dd')).toHaveLength(7);
  });
});
