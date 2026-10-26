// Defeat decision (MGP6-03, MGP6-04). Rendered when `snapshot.state.kind ===
// 'defeat'`; offers respawn and end-session. No input here mutates problem state.

interface DefeatOverlayProps {
  onRespawn: () => void;
  onEndSession: () => void;
}

export function DefeatOverlay({ onRespawn, onEndSession }: DefeatOverlayProps) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Defeated" className="fixed inset-0 z-40 flex items-center justify-center bg-bg/80">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-panel-border bg-panel p-8">
        <h2 className="text-xl font-semibold text-neutral-100">Defeated</h2>
        <p className="text-sm text-neutral-400">The hero has fallen. Respawn to keep the encounter, or end the session.</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onRespawn}
            className="rounded-lg border border-panel-border bg-bg px-6 py-2 font-medium text-neutral-100 hover:bg-bg/70"
          >
            Respawn
          </button>
          <button
            type="button"
            onClick={onEndSession}
            className="rounded-lg border border-panel-border bg-bg px-6 py-2 text-neutral-300 hover:bg-bg/70"
          >
            End session
          </button>
        </div>
      </div>
    </div>
  );
}
