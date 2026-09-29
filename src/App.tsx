import { useState } from 'react';
import { apps, type AppEntry } from './apps/registry';

export default function App() {
  const [activeApp, setActiveApp] = useState<AppEntry | null>(null);

  if (activeApp) {
    const ActiveComponent = activeApp.component;
    return (
      <div className="min-h-screen bg-bg text-neutral-300">
        <header className="flex items-center gap-3 border-b border-panel-border px-4 py-2">
          <button
            onClick={() => setActiveApp(null)}
            className="rounded-lg border border-panel-border bg-panel px-3 py-1 text-sm hover:bg-panel/70"
          >
            ← Apps
          </button>
          <h1 className="text-lg font-semibold text-neutral-100">{activeApp.title}</h1>
        </header>
        <ActiveComponent />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-8 text-neutral-300">
      <h1 className="mb-2 text-3xl font-bold text-neutral-100">Turbubestia</h1>
      <p className="mb-8 text-sm text-neutral-400">Music practice apps</p>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        {apps.map((app) => (
          <button
            key={app.id}
            onClick={() => setActiveApp(app)}
            className="flex w-40 flex-col items-center gap-3 rounded-2xl border border-panel-border bg-panel p-6 transition hover:scale-105 hover:border-neutral-400"
          >
            <span className="text-5xl">{app.icon}</span>
            <span className="text-sm font-medium text-neutral-200">{app.title}</span>
            <span className="text-center text-xs text-neutral-400">{app.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
