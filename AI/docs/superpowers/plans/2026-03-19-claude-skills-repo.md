# Claude Skills Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 14 reusable Claude Code skills in `~/.claude/skills/` covering workflow, web development, writing, and code quality.

**Architecture:** Each skill is a directory with a `SKILL.md` entrypoint following Claude Code's skill format. Skills use YAML frontmatter for invocation control and markdown content for instructions. Skills that wrap superpowers explicitly reference the upstream skill and add only personal preferences. No tests needed — skills are markdown files, not code.

**Tech Stack:** Claude Code skills (Markdown + YAML frontmatter)

**Spec:** `docs/superpowers/specs/2026-03-19-claude-skills-repo-design.md`

---

## File Structure

All skills live in `~/.claude/skills/`. Claude Code requires each skill to be a directory with `SKILL.md` as the entrypoint.

```
~/.claude/skills/
├── explore-codebase/SKILL.md      # Tier 1 — systematic codebase exploration
├── test-first/SKILL.md            # Tier 1 — TDD wrapper with preferences
├── enforce-conventions/SKILL.md   # Tier 1 — convention-matching ruleset
├── code-review-gate/SKILL.md      # Tier 1 — quality checklist before "done"
├── bugfix/SKILL.md                # Tier 2 — structured debugging workflow
├── greenfield/SKILL.md            # Tier 2 — new project scaffold
├── refactor-safely/SKILL.md       # Tier 3 — safe refactoring with tests
├── nextjs/SKILL.md                # Tier 4 — Next.js patterns
├── react-components/SKILL.md      # Tier 4 — React component design
├── api-design/SKILL.md            # Tier 4 — API route patterns
├── technical-docs/SKILL.md        # Tier 5 — README, architecture docs
├── blog-post/SKILL.md             # Tier 5 — articles and long-form
├── comms/SKILL.md                 # Tier 5 — PRs, commits, emails, release notes
└── copywriting/SKILL.md           # Tier 5 — product and marketing copy
```

**Important:** The original spec used `category/skill-name.md` flat files. Claude Code actually requires `skill-name/SKILL.md` directories. Categories are NOT subdirectories — all skills are top-level directories under `~/.claude/skills/`. Category is a logical grouping only.

---

### Task 1: Create skill directory structure

**Files:**
- Create: `~/.claude/skills/explore-codebase/` (and 13 more directories)

- [ ] **Step 1: Create all 14 skill directories**

```bash
mkdir -p ~/.claude/skills/{explore-codebase,test-first,enforce-conventions,code-review-gate,bugfix,greenfield,refactor-safely,nextjs,react-components,api-design,technical-docs,blog-post,comms,copywriting}
```

- [ ] **Step 2: Verify directories exist**

Run: `ls ~/.claude/skills/`
Expected: 14 directories listed alphabetically

Note: `~/.claude/skills/` is outside the AI repo. No git tracking needed — these are user-level config files.

---

### Task 2: Write `explore-codebase` skill (Tier 1)

**Files:**
- Create: `~/.claude/skills/explore-codebase/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

```markdown
---
name: explore-codebase
description: Systematic codebase exploration before making changes. Use when starting work on an unfamiliar or existing codebase, before modifying any code.
---

# /explore-codebase — Systematic Codebase Exploration

## When to Use

- Before making changes to any existing codebase you haven't explored yet
- When starting a new task in a project you haven't worked in recently
- When you need to understand project conventions before writing code

## Process

1. **Read project config** — Check for README.md, CLAUDE.md, package.json, pyproject.toml, Cargo.toml, or equivalent. Note the stack, scripts, and dependencies.

2. **Map directory structure** — List top 2 levels of the project tree. Identify where source code, tests, configs, and docs live.

3. **Identify test setup and CI** — Find the test framework, test directory, test config file, and how tests are run. Note the command (e.g., `npm test`, `pytest`, `cargo test`). Check for CI config (.github/workflows, .gitlab-ci.yml, etc.).

4. **Find conventions** — Check for:
   - Linting config (biome.json, .eslintrc, ruff.toml, .prettierrc)
   - Naming patterns (camelCase vs snake_case, file naming)
   - Import style (relative vs absolute, barrel files)
   - Error handling patterns
   - Component/module organization patterns

5. **Summarize findings** — Output a concise summary (10 lines max) covering: stack, test setup, key conventions, and anything unusual.

## Rules

- Never make changes to an existing codebase without exploring it first.
- The summary is for your own reference — don't ask the user to confirm obvious facts you can read from config files.
- If the project has a CLAUDE.md, treat it as the authoritative source for conventions.
- If there's no test setup, flag this — it affects how other skills (test-first, bugfix) will operate.
```

- [ ] **Step 2: Verify skill is discoverable**

Open a new Claude Code session and run: `What skills are available?`
Expected: `explore-codebase` appears in the list.

---

### Task 3: Write `test-first` skill (Tier 1)

**Files:**
- Create: `~/.claude/skills/test-first/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

```markdown
---
name: test-first
description: Enforce test-driven development with personal framework preferences. Use when implementing any feature or bugfix — wraps superpowers TDD with defaults.
---

# /test-first — Test-Driven Development with Preferences

## When to Use

- Before implementing any feature or bugfix
- Invoke via `/test-first` or let superpowers:test-driven-development handle the core TDD cycle directly

## Process

1. **Check test setup exists.** If the project has no test framework configured:
   - JS/TS projects: Install and configure Vitest
   - Python projects: Install and configure pytest
   - Other: Ask the user which framework to use
   - Do NOT proceed to implementation until tests can run.

2. **Defer to superpowers:test-driven-development** for the core Red-Green-Refactor cycle. Follow that skill's process exactly.

3. **After all tests pass**, invoke `/code-review-gate` before claiming the work is done.

## Rules

- This skill adds preferences on top of superpowers TDD — it does NOT replace it.
- Framework defaults only apply when NO test setup exists. If the project already uses Jest, Mocha, unittest, etc., use what's there.
- Never skip the code-review-gate chain. Every test-first workflow ends with a quality check.
- If superpowers:test-driven-development is not available, fall back to the core TDD cycle yourself: write failing test → run it → implement → run it → refactor → run it.
```

- [ ] **Step 2: Verify skill is discoverable**

Open a new Claude Code session and check `/test-first` appears.

---

### Task 4: Write `enforce-conventions` skill (Tier 1)

**Files:**
- Create: `~/.claude/skills/enforce-conventions/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

```markdown
---
name: enforce-conventions
description: Match existing project conventions when writing or modifying code. Scans codebase patterns for naming, imports, error handling, and file organization.
user-invocable: false
---

# Enforce Conventions — Codebase Pattern Matching

## When to Use

Apply these rules whenever you are writing or modifying code in an existing project. This is not a workflow to invoke — it is a set of constraints that govern how you write code.

## Process

Before writing or modifying code, scan the surrounding codebase for:

1. **Naming conventions** — Are files camelCase, kebab-case, PascalCase, snake_case? Are variables/functions consistent? Are components PascalCase?
2. **File organization** — Where do similar files live? Is there a pattern (e.g., co-located tests, barrel files, feature folders)?
3. **Import style** — Relative or absolute imports? Path aliases? Import ordering?
4. **Export patterns** — Default exports or named exports? Re-exports from index files?
5. **Error handling** — Try/catch patterns, error types, error response shapes?
6. **Test patterns** — describe/it or test()? What's the fixture approach? How are mocks structured?

## Rules

- **Match what's there.** Never introduce a new pattern when an existing one covers the case.
- **If conventions conflict or are unclear, ask** — don't guess.
- **Inconsistent codebase tiebreaker:** Follow the majority pattern in the directory you're modifying. If no majority exists, flag the inconsistency to the user and ask which pattern to follow.
- **CLAUDE.md is authoritative.** If the project has a CLAUDE.md that specifies conventions, follow it over inferred patterns.
- **Do not refactor existing code to match your preferred style.** Your job is to blend in, not impose.
```

- [ ] **Step 2: Verify skill loads automatically**

In a Claude Code session, ask Claude to modify a file in a project. Claude should reference convention scanning in its approach.

---

### Task 5: Write `code-review-gate` skill (Tier 1)

**Files:**
- Create: `~/.claude/skills/code-review-gate/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

```markdown
---
name: code-review-gate
description: Quality checklist before claiming work is complete. Complements superpowers verification with checks for console.logs, TODOs, conventions, and unnecessary files.
---

# /code-review-gate — Quality Gate Before Done

## When to Use

- Before claiming any implementation work is complete
- After `/test-first` finishes the TDD cycle
- After `/bugfix` verifies the fix
- Before committing code

## Process

Run superpowers:verification-before-completion first (tests pass, evidence before assertions). Then apply these additional checks:

1. **No debug artifacts** — Search for console.log, console.debug, debugger statements, print() calls used for debugging. Remove them.
2. **No TODOs or commented-out code** — If you added TODO comments, either do the TODO now or remove the comment. Never leave commented-out code blocks.
3. **Conventions check** — Verify your changes follow the project's existing conventions (invoke enforce-conventions mentally). Check naming, imports, file placement, error handling.
4. **No unnecessary files** — Did you create any files that aren't needed? Temp files, duplicate files, files that could be avoided by editing an existing one?
5. **Commit message ready** — Draft a clear commit message: imperative mood, 50-char subject line, body explaining why if the change isn't obvious.
6. **UI review flag** — If you changed anything visual (components, styles, layouts), tell the user: "I changed UI — please verify it looks right."

## Rules

- Fix every failure before presenting work. Do not list issues and ask if you should fix them — just fix them.
- This checklist applies to YOUR changes only, not pre-existing issues in the codebase.
- If superpowers:verification-before-completion is not available, run the test suite yourself and confirm it passes before proceeding with this checklist.
```

- [ ] **Step 2: Verify skill is discoverable**

Check `/code-review-gate` appears in available skills.

---

### Task 6: Write `bugfix` skill (Tier 2)

**Files:**
- Create: `~/.claude/skills/bugfix/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

```markdown
---
name: bugfix
description: Structured bug fixing — reproduce, root-cause, test, fix, verify. No shotgun debugging. Complements superpowers systematic-debugging.
---

# /bugfix — Structured Bug Fixing

## When to Use

- When the user reports a bug, error, or unexpected behavior
- When a test is failing and the cause isn't obvious
- When something "used to work but now doesn't"

## Process

1. **Reproduce** — Confirm the bug exists. Run the failing scenario or test. If you can't reproduce it, ask the user for exact steps.

2. **Locate** — Find the relevant code. If unfamiliar with the codebase, run `/explore-codebase` first.

3. **Root cause** — Identify WHY the bug happens, not just WHERE. Form a hypothesis before making changes. State your hypothesis explicitly.

4. **Write a failing test** — Write a test that captures the exact bug. Run it. Confirm it fails for the right reason (the bug, not a setup issue).

5. **Fix** — Make the minimal change to resolve the root cause. Do not refactor surrounding code, add features, or "improve" things while you're here.

6. **Verify** — Run the failing test. Confirm it passes. Run the full test suite. Confirm no regressions.

7. **Review gate** — Run `/code-review-gate` before presenting the fix.

## Rules

- **No shotgun debugging.** Never make a change without a hypothesis for why it will fix the bug.
- **No "let me try this."** Every change attempt must be preceded by: "I think the cause is X because Y, so I'll change Z."
- **Minimal fix only.** The diff should contain only what's needed to fix the bug. No drive-by refactoring.
- If superpowers:systematic-debugging is available, use it for the reproduce → root-cause phases. This skill adds the test-writing and review-gate steps.
```

- [ ] **Step 2: Verify skill is discoverable**

Check `/bugfix` appears in available skills.

---

### Task 7: Write `greenfield` skill (Tier 2)

**Files:**
- Create: `~/.claude/skills/greenfield/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

```markdown
---
name: greenfield
description: Scaffold a new project from scratch with opinionated defaults — linting, formatting, testing, CLAUDE.md, and a passing test on first commit.
disable-model-invocation: true
---

# /greenfield — New Project Scaffold

## When to Use

Invoke with `/greenfield` when starting a brand new project from scratch.

## Process

1. **Confirm stack** — Ask the user what they're building and which stack to use. Do not assume.

2. **Scaffold with defaults** — Based on the stack, set up:

   **JS/TS projects:**
   - Package manager: npm (or user preference)
   - Linting + formatting: Biome
   - Testing: Vitest
   - TypeScript: strict mode
   - .gitignore, .env.example, .editorconfig

   **Python projects:**
   - Project config: pyproject.toml
   - Linting + formatting: Ruff
   - Testing: pytest
   - .gitignore, .env.example, .editorconfig

   **Override any default** if the user specifies a preference.

3. **Write a smoke test** — One test that proves the scaffold works:
   - JS/TS: a Vitest test that imports something and asserts it exists
   - Python: a pytest test that imports the main module
   - Run it. Confirm it passes.

4. **Create CLAUDE.md** — Write a project CLAUDE.md that documents:
   - What the project is (one sentence)
   - Stack and key dependencies
   - How to run tests
   - Key conventions (based on the tooling chosen)

5. **Git init + first commit** — Initialize git, create an initial commit with the scaffold.

6. **Chain to `/test-first`** — For the first real feature, use the test-first workflow.

## Rules

- Every greenfield project starts with a passing test and a CLAUDE.md. No exceptions.
- Do not over-scaffold. Only add what's needed for the first feature. No CI pipeline, no Docker, no deployment config unless the user asks.
- Ask before choosing the stack. Never assume Next.js, Django, etc.
```

- [ ] **Step 2: Verify skill is discoverable**

Check `/greenfield` appears in available skills.

---

### Task 8: Write `refactor-safely` skill (Tier 3)

**Files:**
- Create: `~/.claude/skills/refactor-safely/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

```markdown
---
name: refactor-safely
description: Refactor code with tests as guardrails — ensure behavior is preserved while improving structure. Write tests first if none exist.
---

# /refactor-safely — Safe Refactoring

## When to Use

- When improving code structure, readability, or organization
- When splitting large files, renaming, or reorganizing modules
- When the user says "refactor", "clean up", "simplify", or "reorganize"

## Process

1. **Verify test coverage** — Check if the code being refactored has tests. Run existing tests to confirm they pass.

2. **Write missing tests** — If tests don't exist for the code being refactored, write them BEFORE making structural changes. These tests lock in current behavior.
   - If tests can't be written quickly (e.g., deeply coupled code, no test infrastructure), flag the risk to the user: "This code has no tests. Refactoring without tests risks breaking behavior. Want me to add tests first, or proceed carefully?"

3. **Refactor in small steps** — Make one structural change at a time. After each change:
   - Run the test suite
   - Confirm all tests pass
   - If a test fails, revert the last change and try a different approach

4. **Verify behavior preserved** — After all changes, run the full test suite. The refactored code should produce identical behavior.

5. **Run `/code-review-gate`** — Quality check before presenting.

## Rules

- **Never change behavior during a refactor.** If you find a bug while refactoring, fix it in a separate commit with its own test.
- **Small steps only.** If you can't describe the change in one sentence, break it down further.
- **Tests are the safety net.** If tests don't exist and the user says "proceed without tests," acknowledge the risk in your commit message.
```

- [ ] **Step 2: Verify skill is discoverable**

Check `/refactor-safely` appears in available skills.

---

### Task 9: Write `nextjs` skill (Tier 4)

**Files:**
- Create: `~/.claude/skills/nextjs/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

```markdown
---
name: nextjs
description: Next.js development patterns — App Router, server components, data fetching, image optimization, metadata. Use when working in a Next.js project.
user-invocable: false
---

# Next.js Patterns

## When to Use

Apply these patterns when working in any Next.js project. Detect via: `next` in package.json dependencies, `next.config.*` file, or `app/` directory with `layout.tsx`.

## Patterns

### App Router (default)
- Use App Router patterns unless the project explicitly uses Pages Router (`pages/` directory).
- File conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`.
- Route groups with `(groupName)` for organization without affecting URL.

### Server vs Client Components
- **Server components by default.** Only add `'use client'` when the component needs: event handlers, useState/useEffect, browser APIs, or third-party client-only libraries.
- Never put `'use client'` on a page or layout unless absolutely necessary. Instead, extract the interactive part into a small client component and import it.

### Data Fetching
- Fetch data in server components, not with client-side useEffect.
- Use route handlers (`app/api/`) for mutations and external API calls.
- For real-time data, use client components with SWR or React Query — but prefer server components for initial loads.

### Images and Metadata
- Always use `next/image` for images (automatic optimization).
- Export `metadata` or `generateMetadata` from pages and layouts.
- Use `loading.tsx` for Suspense boundaries. Use `error.tsx` for error boundaries.

### Performance
- Dynamic imports with `next/dynamic` for heavy client components.
- Use `context7` plugin for up-to-date Next.js API details when unsure about a specific API.

## Rules

- Do not mix App Router and Pages Router patterns in the same project unless the project is mid-migration.
- Follow the project's existing routing conventions. If they use route groups, use route groups.
- Check `next.config.*` for custom configuration before assuming defaults.
```

- [ ] **Step 2: Verify skill auto-activates**

In a Next.js project, ask Claude to add a feature. It should reference server components and App Router patterns.

---

### Task 10: Write `react-components` skill (Tier 4)

**Files:**
- Create: `~/.claude/skills/react-components/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

```markdown
---
name: react-components
description: React component design — TypeScript props, composition, accessibility, and testing. Use when building or modifying React components.
user-invocable: false
---

# React Component Design

## When to Use

Apply when creating or modifying React components. Detect via: `react` in package.json, `.tsx`/`.jsx` files, or JSX syntax.

## Patterns

### Props
- Type all props with TypeScript interfaces. Export the props type.
- Destructure props in the function signature.
- Provide sensible defaults for optional props.
- Prefer specific prop types over `string` or `any`. Use union types for constrained values.

### Composition
- Prefer `children` and render props over mega-prop components.
- Use slots (named children via props) for flexible layouts.
- Extract shared logic into custom hooks, not wrapper components.
- Keep components focused — one component, one responsibility.

### Accessibility
- Use semantic HTML elements (`button`, `nav`, `main`, `section`, `article`) before reaching for divs.
- ARIA attributes only when semantic HTML isn't sufficient.
- All interactive elements must be keyboard accessible.
- Images need alt text. Decorative images get `alt=""`.
- Form inputs need associated labels.

### Testing
- Every component gets at minimum:
  1. A render test (does it render without crashing?)
  2. A key interaction test (does clicking/typing do what it should?)
- Use Testing Library patterns: query by role, text, or label — not by test ID or class name.
- Test behavior, not implementation details.

## Rules

- Match the project's existing component patterns. If they use arrow functions, use arrow functions. If they use function declarations, use function declarations.
- Do not introduce a new state management pattern without discussing it with the user.
- Do not add dependencies (like a component library) without asking.
```

- [ ] **Step 2: Verify skill auto-activates**

In a React project, ask Claude to create a component. Check it uses TypeScript props, semantic HTML, and offers a test.

---

### Task 11: Write `api-design` skill (Tier 4)

**Files:**
- Create: `~/.claude/skills/api-design/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

```markdown
---
name: api-design
description: API route design — consistent error shapes, input validation, proper HTTP status codes, typed requests and responses. Use when building API endpoints.
user-invocable: false
---

# API Design Patterns

## When to Use

Apply when creating or modifying API routes, REST endpoints, or route handlers. Detect via: files in `app/api/`, `routes/`, `controllers/`, or any server-side request handling.

## Patterns

### Consistent Error Shape
Use the same error response format across the entire project. If the project already has one, match it. If not, use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description"
  }
}
```

### Input Validation
- Validate all input at the API boundary (request body, query params, path params).
- Use the project's existing validation library (Zod, Yup, Joi, Pydantic, etc.). If none exists, use Zod for JS/TS or Pydantic for Python.
- Return 400 with a clear message for validation failures.

### HTTP Status Codes
- 200: Success with response body
- 201: Created (after POST that creates a resource)
- 204: Success with no response body (DELETE)
- 400: Client error (validation, bad input)
- 401: Not authenticated
- 403: Not authorized (authenticated but not allowed)
- 404: Resource not found
- 500: Server error (unexpected — should be rare)

### Type Safety
- Type the request body, query params, and response for every endpoint.
- In TypeScript: use Zod schemas that infer types. In Python: use Pydantic models.

## Rules

- Match the project's existing API patterns before introducing new ones.
- Never expose internal error details (stack traces, SQL errors) in API responses.
- Every new endpoint needs at least one happy-path test and one error-path test.
```

- [ ] **Step 2: Verify skill auto-activates**

In a project with API routes, ask Claude to add an endpoint. Check it validates input and uses proper status codes.

---

### Task 12: Write `technical-docs` skill (Tier 5)

**Files:**
- Create: `~/.claude/skills/technical-docs/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

```markdown
---
name: technical-docs
description: Write technical documentation — READMEs, architecture docs, API docs. Structure for scannability, lead with action.
---

# /technical-docs — Technical Documentation

## When to Use

- When writing or updating READMEs
- When documenting architecture or design decisions
- When writing API documentation
- When the user asks for "docs", "documentation", or "write-up"

## Structure

Follow this order, scaling each section to its complexity:

1. **Purpose** — One paragraph: what is this, who is it for, why does it exist?
2. **Quick Start** — Minimum steps to get running. Code blocks, copy-pasteable commands.
3. **Details** — Architecture, configuration, key concepts. Use headers and bullet points.
4. **Reference** — API reference, environment variables, config options. Table format preferred.

## Rules

- **Lead with what the reader needs to DO, not background.** "Run `npm install`" before "This project uses Node.js because..."
- **Scannable format.** Headers, bullet points, code blocks, tables. Walls of text are a failure.
- **Code examples must work.** Never write pseudocode in docs. Every command and code snippet should be copy-pasteable.
- **No "In this document, we will..."** or "This section describes..." — just describe it.
- **Keep it current.** If you change code, update the docs that reference it in the same commit.
```

- [ ] **Step 2: Verify skill is discoverable**

Check `/technical-docs` appears in available skills.

---

### Task 13: Write `blog-post` skill (Tier 5)

**Files:**
- Create: `~/.claude/skills/blog-post/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

```markdown
---
name: blog-post
description: Write blog posts and articles — hook, problem, solution, examples, takeaway. Conversational voice, concrete examples, no filler.
---

# /blog-post — Blog Post & Article Writing

## When to Use

- When writing blog posts, articles, or long-form content
- When the user asks for a "post", "article", "write-up" (non-technical), or "explainer"

## Structure

1. **Hook** — 1-2 sentences that grab attention. A question, surprising fact, or relatable problem.
2. **Problem** — What's the pain point or gap? Why should the reader care?
3. **Solution / Insight** — Your main argument or approach. Be specific.
4. **Examples** — Concrete, real-world examples. Code if relevant. Screenshots if describing UI.
5. **Takeaway** — What should the reader do next? One clear action or insight to remember.

## Voice

- Conversational but not fluffy. Write like you're explaining to a smart colleague over coffee.
- Direct. Short sentences for emphasis. Longer sentences for nuance.
- Concrete over abstract. "We reduced build time from 45s to 8s" beats "We significantly improved performance."
- Use "you" and "I" freely.

## Rules

- **No "In this article, we will..." openings.** Start with the hook.
- **No filler paragraphs.** Every paragraph earns its place by adding information or insight.
- **No jargon without context.** If you use a technical term, make sure the target audience knows it or explain it inline.
- **Headers are navigation.** A reader skimming headers should understand the article's arc.
- Ask the user about target audience and tone before writing if not specified.
```

- [ ] **Step 2: Verify skill is discoverable**

Check `/blog-post` appears in available skills.

---

### Task 14: Write `comms` skill (Tier 5)

**Files:**
- Create: `~/.claude/skills/comms/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

```markdown
---
name: comms
description: Write clear communications — PR descriptions, commit messages, emails, release notes. Bottom-line-up-front, concise, actionable.
---

# /comms — Communication Writing

## When to Use

- When writing PR descriptions, commit messages, release notes, or emails
- When the user asks to "write an email", "draft a PR", "write release notes"
- When helping compose any professional communication

## Formats

### PR Descriptions
```
## What changed
[1-3 bullet points — what the code does differently now]

## Why
[1-2 sentences — the motivation, ticket reference, or user impact]

## How to test
[Step-by-step: how a reviewer can verify this works]
```

### Commit Messages
- Subject: imperative mood, 50 characters max ("Add user search endpoint", not "Added user search endpoint")
- Body (if needed): explain WHY, not WHAT. The diff shows what changed.
- Blank line between subject and body.

### Emails
- **Bottom-line-up-front.** First sentence = the point or ask.
- Then context: what you need, why, by when.
- Close with a clear next step.
- Keep it under 5 sentences for routine requests.

### Release Notes
- **User-facing changes only.** No internal refactors unless they affect behavior.
- Group by type: New, Improved, Fixed, Removed.
- One line per change. Lead with the benefit, not the implementation.

## Rules

- **Concise over comprehensive.** If it can be said in fewer words, use fewer words.
- **Active voice.** "We added search" not "Search functionality was added."
- **No hedging.** "This fixes the bug" not "This should hopefully fix the bug."
- Match the formality level to the context. Slack messages != formal emails.
```

- [ ] **Step 2: Verify skill is discoverable**

Check `/comms` appears in available skills.

---

### Task 15: Write `copywriting` skill (Tier 5)

**Files:**
- Create: `~/.claude/skills/copywriting/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

```markdown
---
name: copywriting
description: Write product and marketing copy — landing pages, feature descriptions, CTAs. Benefit-first, short sentences, active voice.
---

# /copywriting — Product & Marketing Copy

## When to Use

- When writing landing page copy, feature descriptions, or product announcements
- When the user asks for "copy", "marketing text", "landing page", or "product description"

## Principles

1. **Lead with the benefit, not the feature.** "Deploy in 30 seconds" not "One-click deployment button."
2. **Short sentences.** Punchy. Easy to scan.
3. **Active voice.** "You get instant feedback" not "Instant feedback is provided."
4. **Specific over vague.** Numbers, time savings, concrete outcomes.
5. **One idea per paragraph.** White space is your friend.

## Structure (Landing Page)

1. **Hero** — One sentence that captures the core value proposition. Subheadline adds specificity.
2. **Problem** — 2-3 sentences about the pain point.
3. **Solution** — How your product solves it. Feature highlights with benefit framing.
4. **Social proof** — Testimonials, logos, numbers if available.
5. **CTA** — Clear, specific action. "Start your free trial" not "Learn more."

## Rules

- **Ask the user for context** before writing: What's the product? Who's the audience? What action should they take?
- **No superlatives without evidence.** Don't say "best" or "fastest" unless you can back it up.
- **No buzzwords.** "AI-powered", "revolutionary", "game-changing" — delete these and say what it actually does.
- **Test the "so what?" rule.** After every sentence, ask: would the reader care? If not, cut it or reframe.
```

- [ ] **Step 2: Verify skill is discoverable**

Check `/copywriting` appears in available skills.

---

### Task 16: Install additional plugins

Plugin installation uses the `/install-plugin` command in Claude Code, which adds entries to `.claude/settings.json`.

- [ ] **Step 1: Install Anthropic document skills**

Run in Claude Code:
```
/install-plugin document-skills@anthropic-agent-skills
```

If the command or plugin name has changed, ask Claude: "How do I install the Anthropic document skills plugin?" and follow the current instructions.

- [ ] **Step 2: Check Vercel Next.js skills availability**

Ask Claude: "Is there a Vercel Next.js skills plugin I can install?"

Install if available. If not available as a plugin, skip — the custom `nextjs` skill covers the essentials.

- [ ] **Step 3: Verify plugins are active**

Check `~/.claude/settings.json` (user-level) or the project's `.claude/settings.json` for `enabledPlugins` entries. The superpowers, code-simplifier, and context7 plugins should already be present, plus any newly installed ones.

---

### Task 17: Final verification

- [ ] **Step 1: List all skills**

In a new Claude Code session, ask: `What skills are available?`

Expected: All 14 custom skills appear:
- explore-codebase, test-first, enforce-conventions, code-review-gate
- bugfix, greenfield
- refactor-safely
- nextjs, react-components, api-design
- technical-docs, blog-post, comms, copywriting

- [ ] **Step 2: Test a user-invocable skill**

Run `/explore-codebase` in the Coach project. Confirm it produces a structured summary.

- [ ] **Step 3: Test a context-activated skill**

In the Coach project (Next.js), ask Claude to add a component. Confirm it references:
- TypeScript props (react-components skill)
- Server components by default (nextjs skill)
- Convention matching (enforce-conventions skill)

- [ ] **Step 4: Test the full chain**

Ask Claude to add a small feature using `/test-first`. Confirm it:
1. Writes tests first
2. Implements to pass
3. Runs code-review-gate before claiming done
