---
name: TypeScript and React Style
description: "High-level TypeScript and React conventions for source files in this repository, including separation of domain logic from presentation."
applyTo: "src/**/*.{ts,tsx}"
---
# TypeScript and React Conventions

- Follow the existing TypeScript, React, and testing patterns in the nearest relevant files. Prefer a small, consistent change over a new abstraction.
- Keep substantial domain rules and state transitions out of large React components. Put framework-independent logic in TypeScript modules when it benefits from independent testing or reuse.
- Use React hooks to connect external state and lifecycle to React; keep them focused on subscriptions, effects, and UI-facing orchestration rather than duplicating domain rules.
- Keep components focused on rendering and translating user events into clear callbacks. Keep simple, local presentation state in the component when extracting it would add indirection.
- Use interfaces for object contracts and props, and union types for closed sets of values. This project enables `erasableSyntaxOnly`; do not introduce TypeScript enums or parameter properties.
- Use type-only imports when an import is only used as a type. Add concise comments for non-obvious invariants, not narration.
- For substantial stateful features or unclear model/hook/component boundaries, use the `code-style` skill for detailed guidance and repository examples before editing.