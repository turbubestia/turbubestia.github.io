interface PlaceholderArtProps {
  /** Logical asset name to display (e.g., "Hero", "Boss"). */
  name: string;
  /** Optional static asset file to render instead of the placeholder box. */
  src?: string;
  /** Accessible label for the rendered asset or fallback box. */
  alt?: string;
}

export function PlaceholderArt({ name, src, alt }: PlaceholderArtProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt ?? name}
        className="h-24 w-24 rounded-lg border border-panel-border bg-bg object-contain p-2"
      />
    );
  }

  return (
    <div className="flex min-h-24 w-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-panel-border bg-bg p-3 text-center">
      <span className="text-xs text-neutral-400">{name}</span>
    </div>
  );
}
