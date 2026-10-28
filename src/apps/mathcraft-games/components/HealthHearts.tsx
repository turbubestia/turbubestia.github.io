// Proportional A/B health-heart row for the hero, regular enemies, and bosses.
// Renders fill/empty purely from the supplied numbers; no image assets (MGP6-07).

interface RPGHeartProps {
  /** 0-indexed position of the active/selected heart. */
  selectedHeartIndex: number;
  /** 0-indexed position of this specific heart in the rendered row. */
  heartIndex: number;
  /** Current HP remaining for the active heart (A). */
  currentHp: number;
  /** Total HP capacity of the active heart (B). */
  totalHp: number;
  /** Size in pixels for the heart (default: 48). */
  size?: number;
  /** Optional custom class name. */
  className?: string;
}

interface RPGHeartRowProps {
  /** 0-indexed position of the active/selected heart. */
  selectedHeartIndex: number;
  /** Current HP remaining for the active heart (A). */
  currentHp: number;
  /** Total hit points for the active heart (B). */
  totalHp: number;
  /** Number of hearts to render in the row (default 3). */
  maxHearts?: number;
  /** Size in pixels for each heart (default: 52). */
  heartSize?: number;
}

export function RPGHeart({
  selectedHeartIndex,
  heartIndex,
  currentHp,
  totalHp,
  size = 48,
  className = '',
}: RPGHeartProps) {
  // Determine fill fraction (0.0 to 1.0) for this heart based on spec:
  // - Heart index < selectedHeartIndex -> Empty (0.0)
  // - Heart index === selectedHeartIndex -> Proportional (currentHp / totalHp)
  // - Heart index > selectedHeartIndex -> Fully Filled (1.0)
  let fillFraction = 0;

  if (heartIndex < selectedHeartIndex) {
    fillFraction = 0;
  } else if (heartIndex === selectedHeartIndex) {
    fillFraction = totalHp > 0 ? Math.max(0, Math.min(1, currentHp / totalHp)) : 0;
  } else {
    fillFraction = 1;
  }

  // Clip path percentage from bottom to top for pixelated/clean vertical fill
  const fillPercentage = Math.round(fillFraction * 100);

  return (
    <div
      className={`relative inline-block select-none filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)] ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Heart Frame / Background Outline (Dark Iron RPG Pixel Border) */}
      <svg
        viewBox="0 0 16 16"
        className="absolute inset-0 w-full h-full text-slate-900"
        shapeRendering="crispEdges"
      >
        {/* Outer Pixelated Heart Shield/Border Frame */}
        <path
          fill="currentColor"
          d="M3 1h3v1h1v1h2V2h1V1h3v1h1v3h-1v2h-1v2h-1v2h-1v2H7v-2H6v-2H5V7H4V5H3V2h0z"
        />
        {/* Empty Inner Base Background (Darkened/Depleted Heart Interior) */}
        <path
          fill="#1e1017"
          d="M3 2h3v1h1v1h2V3h1V2h3v3h-1v2h-1v2h-1v2H8v-2H7V9H6V7H5V5H4V2h-1z"
        />
        {/* Dark Red Shadow Accent on empty container */}
        <path
          fill="#3b0914"
          d="M4 3h2v1h1v1h2V4h1V3h2v2h-1v2h-1v2H9v1H8v-1H7V9H6V7H5V5H4V3z"
        />
      </svg>

      {/* Filled Heart Interior Overlay with Clip Path according to fill percentage */}
      <div
        className="absolute inset-0 w-full h-full overflow-hidden transition-all duration-300 ease-out"
        style={{
          clipPath: `inset(${100 - fillPercentage}% 0 0 0)`,
        }}
      >
        <svg
          viewBox="0 0 16 16"
          className="w-full h-full"
          shapeRendering="crispEdges"
        >
          {/* Main Bright Ruby Red Body (Minecraft Dungeons Style) */}
          <path
            fill="#e11d48"
            d="M3 2h3v1h1v1h2V3h1V2h3v3h-1v2h-1v2h-1v2H8v-2H7V9H6V7H5V5H4V2h-1z"
          />
          {/* Dark Red Shading Layer (Bottom/Sides) */}
          <path
            fill="#9f1239"
            d="M4 5v1h1v2h1v2h1v2h2v-2h1V8h1V6h1V5h-1v2h-1v2H9v1H8v-1H7V9H6V7H5V5H4z"
          />
          {/* Deep Shadow Accent */}
          <path
            fill="#881337"
            d="M7 11h2v1H7v-1zM6 9h1v2H6V9zM5 7h1v2H5V7z"
          />
          {/* Pixel Gloss Highlight (Top-Left Specular Shine) */}
          <path
            fill="#fecdd3"
            d="M4 3h1v1H4V3zM4 4h2v1H4V4z"
          />
          <path
            fill="#ffffff"
            d="M4 3h1v1H4V3z"
          />
        </svg>
      </div>

      {/* Selected Heart Visual Indicator / Pulse Ring Overlay */}
      {heartIndex === selectedHeartIndex && (
        <div className="absolute -inset-1 rounded-sm border-2 border-amber-400/80 animate-pulse pointer-events-none shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
      )}
    </div>
  );
}

export function RPGHeartRow({
  selectedHeartIndex,
  currentHp,
  totalHp,
  maxHearts = 3,
  heartSize = 52,
}: RPGHeartRowProps) {
  // Ensure the selected index stays within [0, maxHearts - 1].
  const clampedIndex = Math.max(0, Math.min(maxHearts - 1, selectedHeartIndex));
  const safeTotalHp = Math.max(1, totalHp);
  const safeCurrentHp = Math.max(0, Math.min(safeTotalHp, currentHp));

  return (
    <div className="inline-flex items-center gap-3 bg-slate-950/90 border-2 border-amber-900/60 p-3 rounded-xl shadow-2xl backdrop-blur-md">
      {/* Hearts Array (Up to maxHearts in a single row) */}
      <div className="flex items-center gap-2">
        {Array.from({ length: maxHearts }).map((_, index) => (
          <RPGHeart
            key={index}
            heartIndex={index}
            selectedHeartIndex={clampedIndex}
            currentHp={safeCurrentHp}
            totalHp={safeTotalHp}
            size={heartSize}
          />
        ))}
      </div>

      {/* A/B Hit Point Counter attached to the right of the rightmost heart */}
      <div className="flex flex-col justify-center min-w-[70px] px-3 py-1 bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/30 rounded-lg shadow-inner select-none font-mono">
        <div className="flex items-baseline justify-center gap-0.5 tracking-wider">
          {/* Current Remainder HP (A) */}
          <span className="text-xl font-black text-rose-400 drop-shadow-[0_2px_4px_rgba(225,29,72,0.8)]">
            {safeCurrentHp}
          </span>
          <span className="text-sm font-bold text-amber-500/70">/</span>
          {/* Selected Heart Total HP (B) */}
          <span className="text-sm font-bold text-slate-300">
            {safeTotalHp}
          </span>
        </div>
        {maxHearts > 1 && (
          <div className="text-[10px] text-amber-400/80 uppercase font-bold text-center tracking-widest mt-0.5 border-t border-slate-800 pt-0.5">
            HEART {clampedIndex + 1}
          </div>
        )}
      </div>
    </div>
  );
}

export default RPGHeartRow;