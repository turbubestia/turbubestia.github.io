// Pause presentation (MGP6-04). Renders the manual-pause and idle "Still There"
// states with a resume control; offers end-session in addition when the idle
// pause happened after expiration. State-driven; no local re-derivation.

interface PauseOverlayProps {
  /** 'manual' for a manual pause, 'idle' for the "Still There" idle pause. */
  kind: 'manual' | 'idle';
  /** True when the session expired before the idle pause (offers end-session). */
  offersEndSession: boolean;
  onResume: () => void;
  onEndSession: () => void;
}

export function PauseOverlay({ kind, offersEndSession, onResume, onEndSession }: PauseOverlayProps) {
  return (
    <div role="dialog" aria-modal="true" aria-label={kind === 'idle' ? 'Still there?' : 'Paused'} className="fixed inset-0 z-40 flex items-center justify-center bg-bg/80">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-panel-border bg-panel p-8">
        <h2 className="text-xl font-semibold text-neutral-100">{kind === 'idle' ? 'Still There?' : 'Paused'}</h2>
        {kind === 'idle' && <p className="text-sm text-neutral-400">No keyboard input for a minute.</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onResume}
            className="rounded-lg border border-panel-border bg-bg px-6 py-2 font-medium text-neutral-100 hover:bg-bg/70"
          >
            Resume
          </button>
          {offersEndSession && (
            <button
              type="button"
              onClick={onEndSession}
              className="rounded-lg border border-panel-border bg-bg px-6 py-2 text-neutral-300 hover:bg-bg/70"
            >
              End session
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
