# Turbubestia

A collection of music practice apps for MIDI keyboards, built with React + TypeScript + Vite.

## Apps

- **Sight Reading** — practice reading notes on a MIDI keyboard. Notes are generated on treble and bass staves (rendered with [Vex.Flow](https://vexflow-toaster.github.io/vexflow/)); press the matching key on your connected MIDI device to mark them as read.

## Development

```bash
npm install
npm run dev      # start Vite dev server (http://localhost:5173/turbubestia.github.io/)
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build locally
npm run lint     # oxlint
```

> The dev server and build use `base: '/turbubestia.github.io/'` so the app works when published to GitHub Pages under that repository name.

## Adding a new app

1. Create a folder under `src/apps/`, e.g. `src/apps/rhythm/`, with a React component (default export or named).
2. Register it in [`src/apps/registry.ts`](src/apps/registry.ts):

   ```ts
   import { RhythmApp } from './rhythm/RhythmApp';

   export const apps: AppEntry[] = [
     // ...existing entries
     {
       id: 'rhythm',
       title: 'Rhythm',
       description: 'Practice rhythm patterns on a MIDI keyboard',
       icon: '🥁',
       component: RhythmApp,
     },
   ];
   ```

3. The launcher in `src/App.tsx` picks up new entries automatically — no routing changes needed.

## Project structure

```
src/
  main.tsx                  # entry point
  App.tsx                   # app launcher (grid of app cards)
  index.css                 # Tailwind v4 + theme tokens
  apps/
    registry.ts             # app registry (id, title, icon, component)
    sight-reading/
      note.ts               # StaffNote, NoteDistribution, NoteProducer
      useMidi.ts            # WebMIDI hook (devices, connect, note on/off)
      StaffCanvas.tsx       # Vex.Flow stave renderer
      SightReadingApp.tsx   # settings + game state
```

## Notes

- WebMIDI requires a secure context (HTTPS or `localhost`) and is supported in Chromium-based browsers.
- The sight-reading app works without a MIDI device: click the staff to generate new notes and use "Show notes" to reveal answers.
