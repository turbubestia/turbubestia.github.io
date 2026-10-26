import type { SessionSummary } from '../session/session';

// Completed-session summary (MGP6-04). Formats the supplied summary values for
// display only; no re-derivation.

interface SummaryViewProps {
  summary: SessionSummary;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function SummaryView({ summary }: SummaryViewProps) {
  const rows: [string, string][] = [
    ['Questions attempted', String(summary.questionsAttempted)],
    ['Questions completed', String(summary.questionsCompleted)],
    ['Step accuracy', `${Math.round(summary.stepAccuracy * 100)}%`],
    ['Total damage dealt', String(summary.totalDamageDealt)],
    ['Active time', formatDuration(summary.totalActiveTimeMs)],
    ['Bosses defeated', String(summary.bossesDefeated)],
    ['Equipment earned', String(summary.equipmentEarned)],
  ];

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <h2 className="text-xl font-semibold text-neutral-100">Session complete</h2>
      <dl className="flex flex-col divide-y divide-panel-border rounded-xl border border-panel-border bg-panel">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-4 py-2 text-sm">
            <dt className="text-neutral-400">{label}</dt>
            <dd className="font-mono text-neutral-100">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
