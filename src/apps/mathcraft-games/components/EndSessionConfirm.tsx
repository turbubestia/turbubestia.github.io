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
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4"
    >
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-panel-border bg-panel p-6">
        <h2 id="end-session-title" className="text-lg font-semibold text-neutral-100">
          End this session?
        </h2>
        <p className="text-sm text-neutral-400">Your progress will be included in the session summary.</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-panel-border bg-bg px-4 py-2 text-sm text-neutral-200 hover:bg-bg/70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg border border-red-500/50 bg-bg px-4 py-2 text-sm text-red-400 hover:bg-bg/70"
          >
            Confirm end session
          </button>
        </div>
      </div>
    </div>
  );
}