---
name: code-style
description: "Apply this repository's detailed TypeScript and React coding standards. Use when designing or reviewing domain models, classes, interfaces, React hooks, components, or tests, especially when separating game or business logic from presentation."
---
# Purpose
Apply the repository's TypeScript and React conventions while keeping features understandable and testable. Use the generic examples in this skill to understand the separation between domain behavior, React integration, and presentation. Adapt the boundaries to the feature; do not create the same files mechanically.

## Choose the Boundary
1. Keep small, local UI state in a component when it is used only for presentation and has simple transitions.
2. Move substantial domain rules, calculations, validation, or state transitions into a framework-independent `.ts` module when they can be tested without rendering React. Prefer pure functions for stateless rules; use a class or explicit state model when behavior and state belong together over time.
3. Add a React hook when React needs to own lifecycle work, subscribe to an external model, or expose a focused UI-facing operation. The hook should adapt the model, not reimplement its business rules.
4. Keep components responsible for rendering, accessibility, and translating user input into domain or hook calls. Keep imperative rendering-library work inside the presentation boundary and its effects.
5. Do not split files mechanically. Extract a layer when it creates a real testability, reuse, or responsibility boundary; avoid forwarding-only hooks and one-function modules without a clear benefit.

## Layered Example: Domain, Hook, and UI

The files below demonstrate one possible split for a stateful feature:

- `examples/logic.ts` contains typed state, actions, and domain transitions without React or DOM dependencies.
- `examples/useLogic.ts` adapts those transitions to React state and exposes a small UI-facing API.
- `examples/UiLogic.tsx` renders state and forwards user actions through the hook. Simple input and presentation state remains local to the component.

This is illustrative, not a required file layout. A stateless rule may need only a pure function. A small feature may fit in one component. Introduce a separate hook only when it owns meaningful React lifecycle, shared UI behavior, or an adapter boundary; do not create forwarding-only layers.

Keep browser and framework dependencies out of domain logic when they are not essential to the domain. Keep domain transitions out of JSX event handlers. Use named operations or actions so behavior can be tested independently of rendering.

### Testing
Test domain functions and transitions directly without rendering React. Test hooks or components when their lifecycle, integration, or user-visible behavior needs coverage. Follow the repository's existing test organization and commands; do not require a one-to-one test file for every source file.

## TypeScript Conventions
- Use PascalCase for classes, interfaces, and type aliases; camelCase for variables and functions; uppercase names for established module constants.
- Use interfaces to name object contracts such as settings, state, snapshots, and component props. Use union types for finite value sets, as shown by the example action and status types.
- Prefer explicit public contracts and return types for exported functions and stateful operations. Use type-only imports when values are not needed at runtime.
- Do not add enums or parameter properties; the project uses `erasableSyntaxOnly`.
- When using an external store, keep its subscription and snapshot contract compatible with React's `useSyncExternalStore` requirements.

## Review Checklist
- Can core behavior be tested without rendering React?
- Does each extracted module have a real responsibility, rather than just forwarding calls?
- Are business rules defined once rather than duplicated in components and hooks?
- Does the hook clean up subscriptions, timers, or other resources it creates or owns?
- Are components driven by typed props and focused on presentation and user interaction?
- Do tests target behavior and boundary cases using the repository's Vitest conventions?