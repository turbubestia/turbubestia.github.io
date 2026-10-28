---
name: draft-spec
description: "Collaboratively draft or improve a feature specification or contract from a user request or source document. Identify gaps, discuss design options and patterns, and save a reviewable draft under .issues/. Use when starting a feature or preparing its specification before requirement refinement."
argument-hint: "[optional source document or feature topic]"
---
# Goal
Help the user turn an initial feature idea or documentation file into a clear, reviewable specification or contract. This phase explores what the feature means and records design decisions; it does not produce locked requirements or implementation instructions.

## Input and Target
- Use the user's latest request and any attached, open, or explicitly named source documents.
- If the user identifies an existing specification, read it before making changes and preserve accepted decisions and relevant history.
- If no specification file exists, create `./.issues/{issue_name}.spec.md`. Reuse the issue name from related `.issues/{issue_name}.plan.request.md` files when available; otherwise derive a concise kebab-case name from the user's topic.
- Keep proposed design choices visibly distinct from decisions the user has accepted.

## Workflow
1. Summarize the desired outcome, users or callers, and the system boundary based on the available source material.
2. Identify missing behavior, contracts, constraints, failure cases, and unresolved design choices. Ask focused questions when an answer would change the expected behavior.
3. When design patterns or approaches matter, present a small set of relevant options, explain the trade-offs, and recommend one with a rationale. Do not silently make a recommendation a requirement.
4. Draft or update the specification, incorporating user answers and clearly marking unresolved questions and unaccepted proposals.
5. Present the draft for user review. Do not mark the specification as locked; the requirement-refinement phase owns requirement completeness and locking.

## Suggested Structure
- Purpose and desired outcomes
- Users, callers, and system context
- Behaviors and externally visible contracts
- Constraints, non-goals, and dependencies
- Failure cases and important edge cases
- Design notes: options, trade-offs, recommendation, and decision status
- Open questions

## In-Chat Mode
When the Feature Workflow runs in in-chat mode (no specification or `plan.request` document is provided, or the user explicitly asks to work directly in chat), present the specification as a clearly labeled section in the conversation instead of writing `./.issues/{issue_name}.spec.md`. Keep the same structure, open-question handling, and review step; only the medium changes from file to chat.

## Boundaries
- Do not write implementation code, pseudocode, or source/build files.
- Do not claim requirements are complete or mark the document `LOCKED`.
- Avoid prescribing implementation details unless the user explicitly accepts them as constraints or design decisions.