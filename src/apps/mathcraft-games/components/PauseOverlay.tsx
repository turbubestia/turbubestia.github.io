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
    <div role="dialog" aria-modal="true" aria-label={kind === 'idle' ? 'Still there?' : 'Paused'} className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div className="rpg-box flex w-full max-w-sm flex-col items-center gap-4 p-8">
        <h2 className="font-pixel text-base text-rpg-text">{kind === 'idle' ? 'STILL THERE?' : 'PAUSED'}</h2>
        {kind === 'idle' && <p className="text-lg text-rpg-text-dim">No keyboard input for a minute.</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onResume}
            className="rpg-key-enter px-6 py-2 font-pixel text-xs tracking-wider"
          >
            RESUME
          </button>
          {offersEndSession && (
            <button
              type="button"
              onClick={onEndSession}
              className="rpg-key px-6 py-2 font-pixel text-xs tracking-wider hover:bg-rpg-border hover:border-rpg-border-light"
            >
              END SESSION
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
