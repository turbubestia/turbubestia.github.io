# Turbubestia Repository Guidance

## Project
- Turbubestia is a collection of music-practice apps built with React, TypeScript, Vite, and Tailwind CSS v4.
- The application entry point is `src/main.tsx`; `src/App.tsx` renders the launcher or the selected app.
- Apps live under `src/apps/<id>/` and are registered in `src/apps/registry.ts`. The launcher discovers registered apps automatically; adding an app does not require new routing.

## Architecture
- Keep feature code within its app folder where practical. Separate substantial, independently testable domain rules from React presentation; use a hook as an adapter only when it provides a meaningful lifecycle or state boundary.
- For TypeScript and React details, follow `.github/instructions/typescript-react-style.instructions.md`. Use the `code-style` skill for deeper examples and boundary decisions.
- Reuse the libraries and utilities already in the project. For MIDI integrations, use the `webmidi` package rather than adding another MIDI abstraction.
- Follow the existing Tailwind v4 setup and theme tokens in `src/index.css`; do not introduce a Tailwind configuration file unless the project setup changes.

## Validation
- Run `npm test` for the Vitest suite when changing behavior or tests.
- Run `npm run lint` for lint validation.
- Run `npm run build` for TypeScript project checks and a production Vite build.
- Prefer the narrowest relevant test first, then run broader checks appropriate to the change. Report checks that could not be run.

## Deployment
- Vite `base` is `/` because this is a GitHub Pages user site served at the domain root. Do not change it to a repository-name subpath without an explicit deployment requirement.
- GitHub Pages deployment is handled by `.github/workflows/deploy.yml`; it builds with `npm ci` and `npm run build`, then deploys `dist/`.

## Change Scope
- Make the smallest coherent change that meets the request. Preserve existing user changes and avoid unrelated refactors.
- Add or update tests for meaningful behavior changes, following nearby Vitest conventions.
- Do not commit or perform destructive repository operations unless explicitly requested.
