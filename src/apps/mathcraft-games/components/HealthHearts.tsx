// Software-generated heart/fill representation for a current/max health value.
// Reusable for the hero and for regular-enemy / boss hearts. Renders fill/empty
// purely from the supplied numbers; no image assets (MGP6-07).

interface HealthHeartsProps {
  current: number;
  max: number;
  /** Accessible label describing what the hearts measure (e.g., "Hero health"). */
  label?: string;
}

export function HealthHearts({ current, max, label }: HealthHeartsProps) {
  const clamped = Math.max(0, Math.min(current, max));
  const hearts = Array.from({ length: max }, (_, i) => i < clamped);
  const summary = label ? `${label}: ${clamped} of ${max}` : `${clamped} of ${max}`;

  return (
    <div role="img" aria-label={summary} className="flex items-center gap-0.5 text-lg leading-none">
      {hearts.map((filled, i) => (
        <span key={i} aria-hidden className={filled ? 'text-red-500' : 'text-neutral-600'}>
          {filled ? '♥' : '♡'}
        </span>
      ))}
    </div>
  );
}
