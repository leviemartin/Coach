# Claude Skills Repository — Design Spec

**Date:** 2026-03-19
**Status:** Approved
**Location:** `~/.claude/skills/`

## Overview

A curated personal collection of 14 reusable Claude Code skills covering workflow, web development, writing, and code quality. Installed as user-level skills in `~/.claude/skills/`, supplemented by existing plugins for capabilities others have already nailed.

## Goals

1. **Fix testing gaps** — Claude must write tests before implementation, every time
2. **Enforce consistent code quality** — no more sloppy output slipping through
3. **Respect project conventions** — scan and match existing patterns before writing code
4. **Cover the full writing spectrum** — technical docs, blog posts, comms, copywriting
5. **Support both greenfield and existing codebases** — with appropriate workflows for each

## Architecture

### Location & Structure

```
~/.claude/skills/
├── workflow/
│   ├── explore-codebase.md
│   ├── test-first.md
│   ├── code-review-gate.md
│   ├── greenfield.md
│   └── bugfix.md
├── webdev/
│   ├── nextjs.md
│   ├── react-components.md
│   └── api-design.md
├── writing/
│   ├── technical-docs.md
│   ├── blog-post.md
│   ├── comms.md
│   └── copywriting.md
└── quality/
    ├── enforce-conventions.md
    └── refactor-safely.md
```

### Skill Format

Every skill follows this template:

```markdown
---
name: skill-name
description: One-line description — specific enough to match against user intent
user_invocable: true/false
---

# /skill-name — Title

## When to Use
Clear trigger conditions.

## Process
Numbered step-by-step instructions.

## Rules
Hard constraints — must always/never do.

## Output Format
What the deliverable looks like (if applicable).
```

### Design Decisions

- **Under 200 lines per skill.** Reference material goes in sibling files.
- **Skills reference each other.** `greenfield` invokes `test-first`. `bugfix` invokes `code-review-gate`. Keeps individual skills focused.
- **No duplication with superpowers.** Custom skills are thin wrappers or complements that add personal preferences on top of existing plugin workflows. They never reimplement what superpowers already covers. Specifically:
  - `test-first` wraps `superpowers:test-driven-development` and adds framework defaults + chaining to `code-review-gate`.
  - `code-review-gate` complements `superpowers:verification-before-completion` with a personal quality checklist (console.logs, TODOs, conventions, UI review).
  - `bugfix` complements `superpowers:systematic-debugging` with test-writing and review-gate chaining.
  - `explore-codebase` is more prescriptive than brainstorming's step 1 — it runs a specific scan procedure and outputs a summary. Brainstorming may invoke it, but they don't conflict.
- **`user_invocable: true`** for workflow skills called directly (`/test-first`, `/bugfix`, `/greenfield`). **`false`** for context-activated skills (`enforce-conventions`, `react-components`).
- **Context-activated skills are rulesets, not hooks.** Skills with `user_invocable: false` are instructions Claude should apply when the context matches (e.g., working in a Next.js project, writing code changes). They rely on Claude's skill-matching, not an automated trigger mechanism.

## Skill Inventory

### Tier 1: Pain Point Skills

#### `explore-codebase` (user_invocable: true)
- Read README, CLAUDE.md, package.json / pyproject.toml
- Map directory structure (top 2 levels)
- Identify stack, frameworks, test setup, CI config
- Find conventions — linting config, naming patterns, file organization
- Summarize findings in 10 lines or less
- Rule: Never make changes to an existing codebase without running this first
- Note: More prescriptive than brainstorming's "explore project context" step. Outputs a concrete summary that other skills can reference.

#### `test-first` (user_invocable: true)
- **Wraps `superpowers:test-driven-development`** — does not reimplement the Red-Green-Refactor cycle
- Adds personal preferences on top:
  - Framework defaults: Vitest for JS/TS, pytest for Python (when no test setup exists)
  - If project has no test setup, set it up before proceeding
  - Chains into `code-review-gate` when done
- Rule: Defer to superpowers TDD for the core workflow. This skill adds the preferences layer.

#### `enforce-conventions` (user_invocable: false)
- **Ruleset Claude applies when writing or modifying code** (not a hook or automated trigger)
- Before writing code, scan surrounding codebase for: naming conventions, file organization, import/export style, error handling patterns, test patterns
- Rule: Match what's there. Never introduce a new pattern when an existing one covers the case.
- Rule: If conventions conflict or are unclear, ask — don't guess.
- Rule: If the codebase itself has inconsistent conventions, follow the majority pattern in the directory being modified. If no majority exists, flag the inconsistency to the user and ask which pattern to follow.

#### `code-review-gate` (user_invocable: true)
- **Complements `superpowers:verification-before-completion`** — adds a personal quality checklist
- Superpowers handles: running verification commands, confirming tests pass, evidence before assertions
- This skill adds these additional checks:
  1. No console.logs, TODOs, or commented-out code left behind
  2. Changes follow existing project conventions (invoke `enforce-conventions` check)
  3. No unnecessary files created
  4. Commit message is clear and descriptive
  5. If UI changed: flag for user review
- Rule: Fix failures before presenting work.

### Tier 2: Workflow Skills

#### `bugfix` (user_invocable: true)
- Reproduce: confirm the bug exists
- Locate: find relevant code
- Root cause: identify WHY, not just WHERE
- Write a failing test that captures the bug
- Fix: minimal change to resolve root cause
- Verify: test passes, no regressions
- Run `code-review-gate`
- Rule: No shotgun debugging. No "let me try this" without a hypothesis.

#### `greenfield` (user_invocable: true)
- Confirm stack choice with user
- Scaffold with opinionated defaults:
  - **JS/TS:** Biome (lint + format), Vitest, TypeScript strict
  - **Python:** Ruff (lint + format), pytest, pyproject.toml
  - **Both:** .gitignore, .env.example, editorconfig
  - Override defaults if user specifies preferences
- Write a single end-to-end test that proves the scaffold works
- Create CLAUDE.md with project conventions
- Initial commit
- Rule: Every greenfield project starts with a passing test and a CLAUDE.md

### Tier 3: Web Development Skills

#### `nextjs` (user_invocable: false)
- Enforces App Router patterns (unless project uses Pages Router)
- Server components by default, client components only when needed
- Proper data fetching (server components, route handlers)
- Image optimization, metadata, loading/error states
- References context7 for up-to-date API details

#### `react-components` (user_invocable: false)
- Props: typed with TypeScript, destructured, sensible defaults
- Composition over configuration
- Accessibility: semantic HTML, ARIA only when needed, keyboard navigation
- Test: render test + key interaction test minimum per component

#### `api-design` (user_invocable: false)
- Consistent error response shape across the project
- Input validation at the boundary
- Proper HTTP status codes
- Type the request/response

### Tier 4: Writing Skills

#### `technical-docs` (user_invocable: true)
- Structure: Purpose → Quick Start → Details → Reference
- Scannable: headers, bullet points, code examples
- Rule: Lead with what the reader needs to DO, not background

#### `blog-post` (user_invocable: true)
- Structure: Hook → Problem → Solution/Insight → Examples → Takeaway
- Voice: conversational but not fluffy, direct, concrete examples
- Rule: No "In this article, we will..." openings

#### `comms` (user_invocable: true)
- PR descriptions: What changed, why, how to test
- Commit messages: imperative mood, 50-char subject, body if needed
- Emails: bottom-line-up-front, then context
- Release notes: user-facing changes only, grouped by type

#### `copywriting` (user_invocable: true)
- Lead with the benefit, not the feature
- Short sentences, active voice
- Clear CTA

### Tier 5: Quality Skills

#### `refactor-safely` (user_invocable: true)
- Ensure tests exist for the code being refactored (write them if not)
- Make structural changes in small, testable steps
- Run tests after each step
- Never change behavior — only structure
- Rule: If tests don't exist and can't be written quickly, flag the risk to the user before proceeding

## Installed Plugins (Touch of C)

| Plugin | Source | Covers |
|--------|--------|--------|
| superpowers | Already installed | Brainstorming, TDD, debugging, plans, code review, git worktrees |
| code-simplifier | Already installed | Post-implementation cleanup |
| context7 | Already installed | Up-to-date library docs |
| document-skills | Anthropic official | DOCX, XLSX, PPTX, PDF creation/editing |
| Vercel Next.js skills | VoltAgent directory | Next.js upgrade paths, best practices |

## Implementation Order

1. **Tier 1 first** — `explore-codebase`, `enforce-conventions`, `test-first`, `code-review-gate` (highest impact on pain points; explore-codebase is prerequisite for enforce-conventions)
2. **Tier 2 next** — `bugfix`, `greenfield` (workflow foundation)
3. **Tier 5** — `refactor-safely` (quality)
4. **Tier 3** — `nextjs`, `react-components`, `api-design` (stack-specific)
5. **Tier 4 last** — writing skills (important but less urgent than code quality)
6. **Install plugins** — document-skills, Vercel Next.js (can happen anytime)
