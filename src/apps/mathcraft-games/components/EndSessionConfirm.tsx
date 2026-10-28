interface EndSessionConfirmProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export function EndSessionConfirm({ onCancel, onConfirm }: EndSessionConfirmProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-session-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div className="rpg-box flex w-full max-w-sm flex-col gap-4 p-6">
        <h2 id="end-session-title" className="font-pixel text-sm text-rpg-text">
          End this session?
        </h2>
        <p className="text-lg text-rpg-text-dim">Your progress will be included in the session summary.</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rpg-key px-4 py-2 font-pixel text-xs tracking-wider hover:bg-rpg-border hover:border-rpg-border-light"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="border border-red-500/50 bg-red-950 px-4 py-2 font-pixel text-xs tracking-wider text-red-400 transition hover:bg-red-900"
          >
            CONFIRM END SESSION
          </button>
        </div>
      </div>
    </div>
  );
}