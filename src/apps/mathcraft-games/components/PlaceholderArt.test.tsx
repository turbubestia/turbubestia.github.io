// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { PlaceholderArt } from './PlaceholderArt';

/** The "frame N/M" label text within a container, or null when not animated. */
function frameLabel(container: HTMLElement): string | null {
  const match = container.textContent?.match(/frame (\d+)\/(\d+)/);
  return match === null ? null : `frame ${match[1]}/${match[2]}`;
}

describe('PlaceholderArt (MGP6-07)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('displays the logical asset name', () => {
    render(<PlaceholderArt name="Hero" />);
    expect(screen.getByText('Hero')).not.toBeNull();
  });

  it('shows the initial frame index for an animated asset using the 9-frame default', () => {
    const { container } = render(<PlaceholderArt name="Boss" />);
    expect(frameLabel(container)).toBe('frame 1/9');
  });

  it('cycles to the next frame after one default frame duration (166ms)', () => {
    const { container } = render(<PlaceholderArt name="Boss" />);
    act(() => {
      vi.advanceTimersByTime(166);
    });
    expect(frameLabel(container)).toBe('frame 2/9');
  });

  it('wraps back to the first frame after a full default cycle', () => {
    const { container } = render(<PlaceholderArt name="Boss" />);
    act(() => {
      vi.advanceTimersByTime(9 * 166);
    });
    expect(frameLabel(container)).toBe('frame 1/9');
  });

  it('honors per-asset frame count and duration overrides', () => {
    const { container } = render(<PlaceholderArt name="Enemy" frames={3} frameDurationMs={100} />);
    expect(frameLabel(container)).toBe('frame 1/3');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(frameLabel(container)).toBe('frame 2/3');
    act(() => {
      vi.advanceTimersByTime(200); // two more frames -> wraps to frame 1
    });
    expect(frameLabel(container)).toBe('frame 1/3');
  });

  it('does not show a frame index for a non-animated asset (single frame)', () => {
    const { container } = render(<PlaceholderArt name="Hero" frames={1} />);
    expect(frameLabel(container)).toBeNull();
    // Advancing time must not introduce a frame label.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(frameLabel(container)).toBeNull();
  });

  it('cleans up its interval on unmount', () => {
    const clearSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = render(<PlaceholderArt name="Boss" />);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
