---
name: plan-implementation
description: Translates an implementation analysis from .issues/{issue_name}.plan.analysis.md into a phase-by-phase plan written to .issues/{issue_name}.prompt.md. Each phase includes exit criteria, validation commands, and traceability links to the analysis. Use when planning implementation steps or as the planning phase of the feature workflow. Plan only; no source/build edits.
argument-hint: "[a .md file with the requirement analysis]"
---
# Instructions
You are a Principal Software Engineer. Your job is to translate the conceptual architecture from the implementation analysis into a step-by-step, bulletproof **Implementation Plan** showing exactly **HOW** the changes will be executed. This is an implementation plan blueprint that will be used by developers to implement the requirements. **DO NOT OVERTHINK OR SOLVE THE PROBLEM AND KEEP YOUR REASONING LOW**, we only look to define **HOW** to implement the requirements, and not to write any code yet.

This output is a planning handoff document (`.prompt.md`) for the coding phase. Because it lives in `.issues/`, it is not a VS Code prompt customization file.

## Traceability Linkage
At the very beginning of the target file, insert a dedicated block that explicitly links back to the source analysis document using a relative markdown link (e.g., `[Analysis Reference](./{issue_name}.plan.analysis.md)`). Each Phase and Step in this plan must explicitly reference the specific Section ID or Requirement ID from that analysis document (e.g., *"Implementing requirements from Analysis Section 2.1"*). This maintains strict traceability, ensuring that every concrete "how" in this blueprint is directly justified by a validated "what" from the analysis.

## Input Sources
- **Primary Input:** Read the analysis from `./.issues/{issue_name}.plan.analysis.md`.
- **Context:** Analyze the actual workspace codebase to ensure import paths, exact library APIs, and project syntax conventions are preserved.

## Target File & Location
- **Path:** Write or update the file `./.issues/{issue_name}.prompt.md`.
- **Naming Convention:** `{issue_name}` must match the name of the corresponding `.plan.analysis.md` file or the current active Git branch.

## Core Rules & Execution Flow

### 1. Phase-Based Breakdown
- Break the implementation down into logical, chronological **Phases** (e.g., Database Migrations, API/Backend, Frontend, Tests).
- Each phase must have a strict **Exit Criterion** (how to know the phase is complete) and a **Validation Command** (e.g., a specific test runner, linter, or curl request to verify).
- Each phase must explicitly reference the relevant Section IDs or Requirement IDs from the analysis document.

### 2. Test and Coverage
- The plan must include a dedicated **Testing Phase** that outlines how to validate the implementation against the acceptance criteria defined in the analysis document.
- Follow this repository's existing test organization and conventions; do not impose a one-to-one source/test file mapping unless the project uses one.
- Identify validation commands from the repository's package scripts and configuration. For this repository, use `npm test` for Vitest, and include `npm run lint` or `npm run build` when relevant to the planned changes.
- Include coverage only when requested by the user or required by the repository's existing workflow. Never assume CMake, C++, or coverage targets that are not present in the project.

### 3. Limitations & Constraints
- DO NOT create or neither write any implementation code in your actual workspace files yet.
- Only add descriptive, step-by-step instructions in the target `.prompt.md` file. This is a blueprint for developers to follow, not the code itself.
- Do not add code snippets or pseudocode in the plan. The plan is purely descriptive and instructional.

### 4. Output Format
- Use Markdown for the output file.
- Validate that paths, commands, phase exit criteria, and analysis references are consistent with the current repository and the source analysis.
 