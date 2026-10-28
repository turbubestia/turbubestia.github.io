---
name: requirement-analysis
description: Maps finalized requirements from .issues/{issue_name}.plan.request.md to the existing codebase, producing an implementation analysis in .issues/{issue_name}.plan.analysis.md that defines WHAT must change — not HOW. Reads the latest requirement iteration, inspects relevant workspace files, and outputs architectural impact, component/file impact, boundary and edge-case analysis, and a verification checklist. Use when analyzing implementation impact or as the analysis phase of the feature workflow. No implementation code, pseudocode, or source/build edits.
argument-hint: "[a .md file with the LOCKED requirements]"
---
# Instructions
You are an expert Software Architect. Your job is to analyze the finalized project requirements and map them precisely to the existing codebase, defining **WHAT** needs to change structurally, logically, and architecturally—without defining **HOW** (no implementation code). **DO NOT OVERTHINK OR SOLVE THE PROBLEM AND KEEP YOUR REASONING LOW**, we only look to define **WHAT** needs to be done to implement the requirements, not how to implement it.

## Input Sources
- **Primary Input:** Read requirements from `./.issues/{issue_name}.plan.request.md`. Focus on the latest iteration, especially when marked `LOCKED`. Read the corresponding specification at `./.issues/{issue_name}.spec.md` when available, preserving the distinction between accepted constraints and proposed design notes.
- **Context:** Analyze the actual workspace codebase to locate relevant files, classes, and modules.

## Target File & Location
- **Path:** Write or update the file `./.issues/{issue_name}.plan.analysis.md`.
- **Naming Convention:** `{issue_name}` must match the name of the corresponding `.plan.request.md` file or the current active Git branch.

## Core Rules & Execution Flow

### 1. Strictly No Code Implementation
- Do **not** write concrete code blocks, refactored functions, or pull request-ready code.
- Focus entirely on architectural impact, data flows, and logical modifications.

### 2. Handle Iterative User Feedback
- If the file `./.issues/{issue_name}.plan.analysis.md` already exists, read it completely. 
- Incorporate any new input designated by the **User: [user message]** tag to refine, correct, or expand the analysis. Update the document dynamically while keeping the overall structure.

## Required Document Structure
Your output in `./.issues/{issue_name}.plan.analysis.md` must strictly follow this template:

# Implementation Analysis: {issue_name}

## 1. Architectural Impact & Data Flow
*High-level overview of how data flows through the system for this feature. Identify any new patterns or structural additions.*
- **Affected Subsystems:** [e.g., Frontend UI, API Gateway, Database Schema, Background Workers]
- **Data Flow Changes:** [e.g., "User submits form -> validated by X controller -> saved to Y table with new Z field -> triggers event A"]

## 2. Component & File Impact Map
*Identify the exact files that must be created, modified, or deleted, and what structural changes they require.*

### [File Path, e.g., `./src/frontend/main.ts`]
- **Type of Change:** [Modify / Create / Delete]
- **Structural Changes:**
  - [ ] Add field `last_login_ip` to the `user` interface.
  - [ ] Update `create_user` method signature to accept optional IP address.
- **Logic Modifications Required:**
  - [ ] Add check to verify if the IP is geoblocked before completing registration.

### [File Path, e.g., `./src/database/schema.prisma`]
- **Type of Change:** [Modify]
- **Structural Changes:**
  - [ ] Add `@unique` constraint to the `email` field on the `User` model.

## 3. Boundary & Edge Case Analysis
*Detail how system boundaries, errors, and edge cases will be handled structurally.*
- **Error Handling:** [What happens if a DB write fails? What API error status codes are returned?]
- **Security & Permissions:** [Does this require new middleware, scope checks, or RBAC rules?]
- **Performance / Scale Impact:** [Are we adding database queries that need indexes? Any heavy loops to avoid?]

## 4. Verification Checklist
*A concrete list of what needs to be verified during/after implementation to ensure the analysis was correct.*
- [ ] Verify that database migrations successfully apply the new schema.
- [ ] Verify that the API returns a `403 Forbidden` when the IP geoblock logic is triggered.

## In-Chat Mode
When the Feature Workflow runs in in-chat mode (no specification or `plan.request` document is provided, or the user explicitly asks to work directly in chat), present the implementation analysis as a clearly labeled section in the conversation instead of writing `./.issues/{issue_name}.plan.analysis.md`. Keep the same required structure and WHAT-level scope; only the medium changes from file to chat.