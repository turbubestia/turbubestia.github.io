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
        className="h-24 w-24 rounded border-2 border-rpg-border bg-rpg-slot object-contain p-2"
      />
    );
  }

  return (
    <div className="flex min-h-24 w-32 flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-rpg-border bg-rpg-slot p-3 text-center">
      <span className="font-pixel text-[10px] text-rpg-text-dim">{name}</span>
    </div>
  );
}
