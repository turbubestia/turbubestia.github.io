# Mathcraft Games: Development Stages

## Purpose and Scope

This document guides the order of development and the boundaries between independently testable parts of Mathcraft Games. It is an architectural and workflow guide, not an implementation requirements document.

Use [README.md](README.md) as the current description of the intended experience. Detailed, testable acceptance criteria and resolutions for its open questions belong in the requirements-planning documents that will be drafted next. If implementation exposes ambiguity in behavior, return it to that requirements process rather than silently deciding it in a component or domain module.

The guiding dependency is:

```text
pure math rules and models
				-> math problem lifecycle and events
				-> game rules and event reactions
				-> session coordination
				-> React adapters
				-> presentation components
				-> integrated experience
```

Math and game behavior are separate domains. The math domain owns problem generation, step progression, answer checking, and the damage values assigned to math events. The game domain owns hero/enemy health, rewards, equipment, and combat progression; it reacts to generic events and does not inspect operands or operation types. React and visual components display state and forward user actions without becoming a second home for domain rules.

## Working Rules

- Build and verify a layer before depending on it from the next layer. Keep each change small enough that its behavior can be checked independently.
- Give each module or component one clear responsibility and a visible input/output boundary. Every part must have a practical way to test its behavior; this does not require a one-to-one test file for every source file.
- Test domain rules without React or a browser. Test UI through rendered output and user interactions, and test adapters at the boundary they connect.
- Prefer deterministic inputs for time, randomness, and external events so tests can control those sources. Use fake timers where time behavior is under test.
- Keep tests organized around behavior and ownership. Follow the repository's Vitest conventions and add UI-test tooling only if the implementation plan establishes it.
- Do not let a later stage duplicate or reinterpret rules already owned by an earlier stage.

## Stage 1: Math Primitives and Problem Generation

Establish framework-independent math types and rules first. This includes problem/configuration shapes, validation of supported settings, generation for the supported operations, and construction and verification of the complete arithmetic work snapshots for each problem.

**Boundary:** Inputs are explicit settings or injected random values; outputs are typed problem data and an ordered sequence of renderable arithmetic snapshots. This layer owns the placement of operands, regrouping, carries, partial products, answer values, active cells, and operator-line positions. It has no React, DOM, event-bus, or game dependencies.

**Test focus:** Valid and invalid configurations, operation coverage, configured ranges, carry/borrow constraints, snapshot dimensions and progression, generated answer/work consistency, and deterministic edge cases. Prefer seeded or injected randomness so tests assert properties without becoming flaky.

**Exit check:** Problem data can be generated and its arithmetic/work representation checked directly in Vitest, without rendering the app.

## Stage 2: Math Problem Lifecycle and Step Entry

Build the stateful math behavior on top of the primitives: the current problem, current arithmetic snapshot, answer validation against its expected value, retry behavior, progression to the next snapshot, completion, and the math-side event values described by the specification.

**Boundary:** Public operations represent student actions; the current snapshot exposes the work state to consumers. The lifecycle compares the submitted integer with the snapshot's expected value, retains the current snapshot after wrong or invalid input, and advances to the next precomputed snapshot after correct input. It decides what math event follows but does not construct display layout or mutate hero/enemy state.

**Test focus:** Correct and incorrect attempts, retrying the same snapshot, snapshot progression for carries and regrouping, multi-step multiplication including partial-product addition, completion exactly once, and the event payload/value for each relevant step. Test state transitions through the public API rather than private implementation details.

**Exit check:** A complete problem can be solved and inspected using only the math model and its tests; wrong attempts preserve the active step and accepted work.

## Stage 3: Typed Domain Events and Game Rules

Define the typed boundary between math and game domains, then implement game behavior that consumes it. Keep math-specific context out of game reactions: a generic hit carries its outcome and value, while solved and boss lifecycle events carry only the information their receiving domain needs.

Implement and test game state transitions independently of the math model and UI. The event transport can be wired later; domain tests should be able to deliver events directly or through a small in-memory test boundary.

**Boundary:** The game domain accepts generic events and owns combat/progression state. It must not import math problem-generation or answer-checking logic.

**Test focus:** Correct/wrong damage routing, healing, defeat and respawn, regular enemy health, boss-heart progression, rewards, equipment/stat display calculations, and invariants that decorative progression does not change combat calculations. Cover the boundary conditions in the specification, including health at or below zero.

**Exit check:** Game rules pass tests using synthetic events, without constructing a math problem or rendering React.

## Stage 4: Session Coordination and Domain Integration

Coordinate math and game domains into a session: setup choices, active-time tracking, pause/idle behavior, deferred boss triggers, queued boss problems, rewards during encounters, and session summary data. Keep coordination separate from the rules owned by either domain.

**Boundary:** A session-level model or coordinator owns cross-domain sequencing and lifecycle. Time and event delivery should be controllable in tests; the coordinator should invoke domain APIs rather than copy their calculations.

**Test focus:** Session start/end, pause/resume, idle pause, timer expiration during an active problem, scheduled and session-ending boss triggers, coalesced triggers, preserved work on respawn, and the summary values produced by the session.

**Exit check:** Cross-domain flows can be driven deterministically in tests with controlled time and events, and each domain remains independently testable.

## Stage 5: React Adapters

Add hooks or other React-facing adapters only where React needs to own a model's lifecycle, subscribe to updates, or expose a focused UI-facing API. Adapters translate between React lifecycle and the domain/session interfaces; they do not reimplement transitions.

**Boundary:** Domain modules remain framework-independent. An adapter owns cleanup for subscriptions, timers, or resources it creates, and exposes stable state and actions to components.

**Test focus:** Subscription updates, initial state, action forwarding, and cleanup on unmount when those behaviors are meaningful. Prefer testing the underlying domain directly for domain rules rather than retesting them through the hook.

**Exit check:** React can observe and operate the session through the adapter, and disposing the adapter does not leave owned resources active.

## Stage 6: Presentation Components

Build the interface from focused components after the data and action contracts are established. The problem/work display receives and renders the current arithmetic snapshot directly; answer entry forwards submissions through the adapter. Then add combat feedback, hero/enemy status, setup, pause/defeat flows, rewards, boss presentation, and summary views as their supporting states become available.

**Boundary:** Components render props/state, provide accessible controls, and report user actions through callbacks or the adapter. The work display may format supplied cell values and visually style row types and operator lines, but must not calculate arithmetic, infer cell placement, reconstruct carries/borrows/partial products, or derive operator-line positions. Components may own simple transient presentation state, but must not generate problems, validate answers, calculate damage, advance encounters, or manage session time.

**Test focus:** Snapshot cells, row types, active targets, and operator lines render exactly as supplied; also verify available/disabled controls, user actions producing the expected callback, and important feedback states such as wrong/correct answers, completion, pause, defeat, and boss/reward presentation. Test at component boundaries; a purely visual subcomponent can be covered through its parent when that is clearer.

**Exit check:** Each component has a clear contract and a practical isolated or parent-level test path; user actions reach the proper domain operation without bypassing the adapter/coordinator boundary.

## Stage 7: Integrated Playthrough and Quality Gate

Verify the assembled experience against the finalized requirements once those are drafted. Exercise representative end-to-end paths from session setup through problem solving, combat response, boss flow, and summary. Keep end-to-end checks focused on cross-layer wiring; detailed rule coverage remains in domain tests.

**Test focus:** Domain and adapter tests, UI interaction coverage for critical paths, and a small set of integrated flows that verify the domains communicate correctly. Include failure/edge flows that cross boundaries, not only a successful standard problem.

**Exit check:** `npm test`, `npm run lint`, and `npm run build` pass, and each finalized acceptance criterion maps to an appropriate test or an explicitly documented manual check.

## Provisional Module Map

Names and file splits are illustrative, not required. Choose the smallest set of modules that preserves the responsibilities and test boundaries above; do not create a file or hook solely to match this list.

```text
mathcraft-games/
	math/          problem/config types, generators, work rules, problem lifecycle
	game/          game state, combat/progression rules
	events/        shared typed event contract and, if useful, transport adapter
	session/       cross-domain orchestration and session lifecycle
	hooks/         React lifecycle/subscription adapters where needed
	components/    presentation components
	*.test.ts      domain behavior tests, grouped by responsibility
	*.test.tsx     adapter or rendered-interaction tests where appropriate
```

The exact placement of events and tests can follow the eventual module boundaries. In particular, choose an event transport only when the implementation requirements settle that decision; keeping the event contract independent makes either supported transport possible.

## Readiness for Requirements Planning

Before implementation planning begins, translate the specification into testable requirements and resolve the decisions it leaves open. Requirements should establish observable behavior and acceptance criteria. This guide then determines a sensible order and ownership for implementing those criteria; it must not be used to fill gaps in the requirements by implication.
