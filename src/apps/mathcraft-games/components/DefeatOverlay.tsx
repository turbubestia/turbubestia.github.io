// Defeat decision (MGP6-03, MGP6-04). Rendered when `snapshot.state.kind ===
// 'defeat'`; offers respawn and end-session. No input here mutates problem state.

interface DefeatOverlayProps {
  onRespawn: () => void;
  onEndSession: () => void;
}

export function DefeatOverlay({ onRespawn, onEndSession }: DefeatOverlayProps) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Defeated" className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div className="rpg-box flex w-full max-w-sm flex-col items-center gap-4 p-8">
        <h2 className="font-pixel text-base text-rose-400">DEFEATED</h2>
        <p className="text-center text-lg text-rpg-text-dim">The hero has fallen. Respawn to keep the encounter, or end the session.</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onRespawn}
            className="rpg-key-enter px-6 py-2 font-pixel text-xs tracking-wider"
          >
            RESPAWN
          </button>
          <button
            type="button"
            onClick={onEndSession}
            className="rpg-key px-6 py-2 font-pixel text-xs tracking-wider hover:bg-rpg-border hover:border-rpg-border-light"
          >
            END SESSION
          </button>
        </div>
      </div>
    </div>
  );
}
