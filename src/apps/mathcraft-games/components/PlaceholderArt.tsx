import { useEffect, useState } from 'react';

// Placeholder art box (MGP6-07). Shows a logical asset name (not a filename) and,
// for animated assets, the current frame index. Frame cycling is isolated to this
// component via local state so only it re-renders each frame; the interval is
// cleaned up on unmount.

const DEFAULT_FRAMES = 9;
const DEFAULT_FRAME_MS = 166;

interface PlaceholderArtProps {
  /** Logical asset name to display (e.g., "Hero", "Boss"). */
  name: string;
  /** Number of frames for animated assets. Defaults to 9. */
  frames?: number;
  /** Per-frame duration in ms. Defaults to 166. */
  frameDurationMs?: number;
}

export function PlaceholderArt({ name, frames = DEFAULT_FRAMES, frameDurationMs = DEFAULT_FRAME_MS }: PlaceholderArtProps) {
  const animated = frames > 1;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!animated) {
      return;
    }
    const id = window.setInterval(() => setFrame((f) => (f + 1) % frames), frameDurationMs);
    return () => window.clearInterval(id);
  }, [animated, frames, frameDurationMs]);

  return (
    <div className="flex min-h-24 w-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-panel-border bg-bg p-3 text-center">
      <span className="text-xs text-neutral-400">{name}</span>
      {animated && (
        <span className="text-[10px] text-neutral-500" aria-hidden>
          frame {frame + 1}/{frames}
        </span>
      )}
    </div>
  );
}
