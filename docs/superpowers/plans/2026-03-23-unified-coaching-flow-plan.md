# Unified Coaching Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Daily Log, Checkin, Training Plan, and Session pages into a unified data pipeline where data enters once and flows one direction to coaches.

**Architecture:** Daily Log becomes the hub page. Session Tracker writes back to daily log on completion. Checkin auto-assembles weekly data from daily logs and adds a triage agent + Head Coach dialogue. Plan items get flexible scheduling with sequencing rules. All coaches receive full structured context.

**Tech Stack:** Next.js 16, React 19, MUI v7, SQLite (better-sqlite3), Vitest, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-23-unified-coaching-flow-design.md`
**Mockups:** `docs/superpowers/specs/mockups/` (daily-log-redesign.html, plan-preview-redesign.html)

**File reference note:** This plan references functions and sections by name, not line numbers. The implementer should use Grep/Glob to find exact locations, as line numbers shift after edits.

---

## Phase Dependencies

```
Phase A (Daily Log enhancements) ──prerequisite──▸ Phase C (Checkin redesign)
Phase A ──prerequisite──▸ Phase E (Coach context injection)
Phase B (Plan model) ──independent after A
Phase D (Head Coach dialogue) ──independent after A
Recommended order: A → B → C → D → E
```

---

## Phase A: Daily Log Enhancements

**Goal:** Add new fields (energy, pain, sleep disruption), tagged notes, session writeback, and week overview to the daily log.

### Task A1: Database Schema — New Columns on daily_logs

**Files:**
- Modify: `dashboard/lib/db.ts` — SCHEMA_VERSION constant, daily_logs CREATE TABLE, migration logic, DailyLog interface
- Test: `dashboard/__tests__/daily-log-schema.test.ts`

- [ ] **Step 1: Write test for new daily_log columns**

```typescript
// dashboard/__tests__/daily-log-schema.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  // Copy the full schema init here from db.ts after changes
  return db;
}

describe('daily_logs schema v6', () => {
  it('has energy_level column', () => {
    const db = createTestDb();
    const info = db.pragma('table_info(daily_logs)') as { name: string }[];
    expect(info.map(c => c.name)).toContain('energy_level');
  });

  it('has pain_level and pain_area columns', () => {
    const db = createTestDb();
    const info = db.pragma('table_info(daily_logs)') as { name: string }[];
    expect(info.map(c => c.name)).toContain('pain_level');
    expect(info.map(c => c.name)).toContain('pain_area');
  });

  it('has sleep_disruption column', () => {
    const db = createTestDb();
    const info = db.pragma('table_info(daily_logs)') as { name: string }[];
    expect(info.map(c => c.name)).toContain('sleep_disruption');
  });

  it('has session_summary and session_log_id columns', () => {
    const db = createTestDb();
    const info = db.pragma('table_info(daily_logs)') as { name: string }[];
    expect(info.map(c => c.name)).toContain('session_summary');
    expect(info.map(c => c.name)).toContain('session_log_id');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run __tests__/daily-log-schema.test.ts`
Expected: FAIL — schema doesn't have new columns yet

- [ ] **Step 3: Update schema — bump version, add columns**

In `dashboard/lib/db.ts`:

1. Line 9: Change `const SCHEMA_VERSION = 5` → `const SCHEMA_VERSION = 6`

2. Lines 124-144: Add new columns to the CREATE TABLE statement after `notes TEXT`:
```sql
energy_level INTEGER,
pain_level INTEGER,
pain_area TEXT,
sleep_disruption TEXT,
session_summary TEXT,
session_log_id INTEGER REFERENCES session_logs(id),
```

3. Update DailyLog interface (lines 587-602) to add:
```typescript
energy_level: number | null;
pain_level: number | null;
pain_area: string | null;
sleep_disruption: string | null;
session_summary: string | null;
session_log_id: number | null;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run __tests__/daily-log-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/db.ts dashboard/__tests__/daily-log-schema.test.ts
git commit -m "feat(db): add energy, pain, sleep disruption, session writeback columns to daily_logs"
```

### Task A2: Database Schema — daily_notes Table

**Files:**
- Modify: `dashboard/lib/db.ts` (add CREATE TABLE + CRUD functions)
- Test: `dashboard/__tests__/daily-notes.test.ts`

- [ ] **Step 1: Write test for daily_notes CRUD**

```typescript
// dashboard/__tests__/daily-notes.test.ts
import { describe, it, expect } from 'vitest';

describe('daily_notes table', () => {
  it('creates a note with category and text', () => {
    // Test insertDailyNote() returns note with id, category, text
  });

  it('retrieves notes by daily_log_id', () => {
    // Test getDailyNotes(dailyLogId) returns array
  });

  it('retrieves notes by week grouped by date', () => {
    // Test getWeekNotes(weekNumber) returns notes with date context
  });

  it('deletes a note by id', () => {
    // Test deleteDailyNote(id)
  });

  it('rejects invalid category', () => {
    // Category must be: injury, sleep, training, life, other
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Add CREATE TABLE and CRUD functions to db.ts**

Add after the daily_logs CREATE TABLE:
```sql
CREATE TABLE IF NOT EXISTS daily_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_log_id INTEGER NOT NULL REFERENCES daily_logs(id),
  category TEXT NOT NULL CHECK(category IN ('injury','sleep','training','life','other')),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_daily_notes_log ON daily_notes(daily_log_id);
CREATE INDEX IF NOT EXISTS idx_daily_notes_category ON daily_notes(category);
```

Add CRUD functions:
```typescript
export interface DailyNote {
  id: number;
  daily_log_id: number;
  category: 'injury' | 'sleep' | 'training' | 'life' | 'other';
  text: string;
  created_at: string;
}

export function insertDailyNote(dailyLogId: number, category: string, text: string): DailyNote { ... }
export function getDailyNotes(dailyLogId: number): DailyNote[] { ... }
export function getWeekNotes(weekNumber: number): (DailyNote & { date: string })[] { ... }
export function deleteDailyNote(id: number): void { ... }
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Migrate existing notes data**

Add migration in db.ts init: move non-null `daily_logs.notes` values into `daily_notes` with category 'other'.

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/db.ts dashboard/__tests__/daily-notes.test.ts
git commit -m "feat(db): add daily_notes table with tagged categories"
```

### Task A3: API — Update Daily Log Endpoints

**Files:**
- Modify: `dashboard/app/api/log/route.ts` — PUT handler (accept new fields), GET handler (return new fields)
- Create: `dashboard/app/api/log/notes/route.ts` (CRUD for daily notes)
- Test: `dashboard/__tests__/daily-log-api.test.ts`

- [ ] **Step 1: Write test for PUT accepting new fields**

Test that PUT /api/log with `energy_level`, `pain_level`, `pain_area`, `sleep_disruption` correctly saves to DB.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Update PUT handler to accept and save new fields**

In `app/api/log/route.ts` PUT handler, add the new fields to the upsert payload.

- [ ] **Step 4: Update GET handler to return new fields**

Ensure GET response includes `energy_level`, `pain_level`, `pain_area`, `sleep_disruption`, `session_summary`, `session_log_id`.

- [ ] **Step 5: Create notes API route**

```typescript
// dashboard/app/api/log/notes/route.ts
// POST: { daily_log_id, category, text } → insertDailyNote()
// GET: ?daily_log_id=N → getDailyNotes()
// DELETE: ?id=N → deleteDailyNote()
```

- [ ] **Step 6: Run tests to verify they pass**

- [ ] **Step 7: Commit**

```bash
git add dashboard/app/api/log/route.ts dashboard/app/api/log/notes/route.ts dashboard/__tests__/daily-log-api.test.ts
git commit -m "feat(api): daily log endpoints accept new fields, add notes CRUD"
```

### Task A4: API — Sleep Disruption Previous-Day Logic

**Files:**
- Modify: `dashboard/app/api/log/route.ts` (PUT handler — sleep_disruption writes to previous day)
- Test: `dashboard/__tests__/sleep-disruption.test.ts`

- [ ] **Step 1: Write test for previous-day write**

```typescript
describe('sleep disruption previous-day logic', () => {
  it('writes sleep_disruption to previous date record', () => {
    // PUT with date=2026-03-25, sleep_disruption='kids'
    // Should write to daily_log WHERE date=2026-03-24
  });

  it('auto-creates previous day log if missing', () => {
    // No log exists for 2026-03-24
    // PUT with date=2026-03-25, sleep_disruption='stress'
    // Should create log for 2026-03-24 with only sleep_disruption set
  });

  it('Monday sleep disruption writes to Sunday (cross-week)', () => {
    // date=Monday, previous=Sunday of prior week
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement previous-day logic in PUT handler**

When `sleep_disruption` is present in the payload, extract it, determine the previous date, and upsert that date's record with the disruption value. Remove `sleep_disruption` from the current date's payload.

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/api/log/route.ts dashboard/__tests__/sleep-disruption.test.ts
git commit -m "feat(api): sleep disruption writes to previous day's log"
```

### Task A5: UI — Energy and Pain Inputs

**Files:**
- Create: `dashboard/components/EnergyPainCard.tsx`
- Modify: `dashboard/components/DailyLog.tsx` — DailyLogProps interface, formData state
- Reference mockup: `docs/superpowers/specs/mockups/daily-log-redesign.html` (Energy/Pain section)

- [ ] **Step 1: Create EnergyPainCard component**

Tap-button selectors:
- Energy: 5 buttons (1-5), selected state uses amber background
- Pain: 4 buttons (None/Mild/Mod/Stop → 0-3), selected None uses green
- When pain > 0: text field appears for body area
- Follow existing component patterns (outlined Card, MUI sx props, design tokens)

- [ ] **Step 2: Integrate into DailyLog orchestrator**

Add `energy_level`, `pain_level`, `pain_area` to DailyLog formData state. Wire onChange to triggerSave. Place between sleep disruption and checklist sections.

- [ ] **Step 3: Verify in browser — fields render, auto-save works**

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/EnergyPainCard.tsx dashboard/components/DailyLog.tsx
git commit -m "feat(ui): add energy level and pain tracking inputs to daily log"
```

### Task A6: UI — Sleep Disruption Input

**Files:**
- Create: `dashboard/components/SleepDisruptionCard.tsx`
- Modify: `dashboard/components/DailyLog.tsx`
- Reference mockup: `docs/superpowers/specs/mockups/daily-log-redesign.html` ("How was last night?" section)

- [ ] **Step 1: Create SleepDisruptionCard component**

- Label: "How was last night?"
- Tag selector chips: None (default), Kids woke up, Stress/mind racing, Pain, Other
- Caption: "→ saved to [previous day] night"
- Follow existing chip patterns (MUI Chip, outlined or filled based on selection)

- [ ] **Step 2: Integrate into DailyLog orchestrator**

Place above the "How are you feeling?" section. Wire to triggerSave. The save logic sends `sleep_disruption` which the API writes to previous day (Task A4).

- [ ] **Step 3: Verify in browser**

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/SleepDisruptionCard.tsx dashboard/components/DailyLog.tsx
git commit -m "feat(ui): add sleep disruption tracking with previous-night attribution"
```

### Task A7: UI — Tagged Notes (Replace Free Text)

**Files:**
- Create: `dashboard/components/TaggedNotes.tsx`
- Modify: `dashboard/components/DailyLog.tsx` (replace NotesCard with TaggedNotes)
- Reference mockup: `docs/superpowers/specs/mockups/daily-log-redesign.html` (Notes section)

- [ ] **Step 1: Create TaggedNotes component**

- Shows existing notes as category-chip + text rows
- "+ Add note" button opens inline form: category selector (5 chips) + text input
- Delete button (X) on each note
- Calls POST/DELETE on `/api/log/notes`
- Categories use semantic colors: injury=orange, sleep=purple, training=blue, life=amber, other=slate

- [ ] **Step 2: Replace NotesCard in DailyLog orchestrator**

Remove NotesCard import and usage. Add TaggedNotes, passing `dailyLogId` as prop.

- [ ] **Step 3: Verify in browser — add, display, delete notes**

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/TaggedNotes.tsx dashboard/components/DailyLog.tsx
git commit -m "feat(ui): tagged notes replace free-text notes field"
```

### Task A8: UI — Rename Labels to Plain Language

**Files:**
- Modify: `dashboard/components/DailyChecklist.tsx` (labels)
- Modify: `dashboard/components/BedtimeCard.tsx` (labels if needed)
- Modify: `dashboard/components/WeekComplianceBar.tsx` (labels)

- [ ] **Step 1: Update labels in DailyChecklist**

- "Rug Protocol (GOWOD)" → "Mobility Work"
- "Kitchen Cutoff (20:00)" → "No Food After 20:00"
- "Hydration Tracked" → "Hydration Logged"
- "Core Work Done" → "Core Work"

- [ ] **Step 2: Update labels in WeekComplianceBar**

Same renames for the weekly tally chips.

- [ ] **Step 3: Verify in browser — all labels show plain language**

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/DailyChecklist.tsx dashboard/components/WeekComplianceBar.tsx
git commit -m "feat(ui): rename protocol jargon to plain language labels"
```

### Task A9: Session Writeback — Summary to Daily Log

**Files:**
- Modify: `dashboard/lib/session-db.ts` — completeSession() function (write summary + session_log_id)
- Modify: `dashboard/app/api/session/complete/route.ts` (return summary)
- Test: `dashboard/__tests__/session-writeback.test.ts`

- [ ] **Step 1: Write test for session writeback**

```typescript
describe('session writeback to daily log', () => {
  it('writes session_summary text to daily_logs on complete', () => {
    // After completeSession(), daily_logs.session_summary should contain exercise summary
  });

  it('sets session_log_id on daily_logs', () => {
    // daily_logs.session_log_id = the completed session's ID
  });

  it('generates readable summary text', () => {
    // Summary includes: exercise names, sets x reps @ weight, compliance %, skipped items
  });

  it('auto-creates daily_log if none exists for session date', () => {
    // No daily_log for today, session completes → creates log with workout_completed=1, summary, session_log_id
  });

  it('handles two sessions on same day — second overwrites summary', () => {
    // First session writes summary, second session overwrites with combined or latest summary
    // session_log_id points to most recent session
  });
});
```

**Note:** `plan_items.status = 'completed'` update on session complete is deferred to Phase B (Task B1) since the `status` column doesn't exist until then.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement writeback in completeSession()**

In `session-db.ts` completeSession() function, after computing compliance:
1. Generate summary text from session_sets and session_cardio
2. UPDATE daily_logs SET session_summary = ?, session_log_id = ? WHERE date = ?

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/session-db.ts dashboard/app/api/session/complete/route.ts dashboard/__tests__/session-writeback.test.ts
git commit -m "feat(session): write summary and session_log_id back to daily log on complete"
```

### Task A10: UI — Session Summary Display on Daily Log

**Files:**
- Create: `dashboard/components/SessionSummaryCard.tsx`
- Modify: `dashboard/components/DailyLog.tsx`
- Reference mockup: `docs/superpowers/specs/mockups/daily-log-redesign.html` (After Session section)

- [ ] **Step 1: Create SessionSummaryCard component**

- Shows when `session_summary` is non-null on the daily log
- Displays: session type chip, title, compliance %, completion time
- Expandable "Session details" section with individual exercise lines
- Green left-accent border (card-accent-green pattern from mockup)

- [ ] **Step 2: Integrate into DailyLog — show when session_summary exists**

- [ ] **Step 3: Verify in browser**

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/SessionSummaryCard.tsx dashboard/components/DailyLog.tsx
git commit -m "feat(ui): show session summary card on daily log after workout completion"
```

### Task A11: UI — Week Overview Panel

**Files:**
- Create: `dashboard/components/WeekOverview.tsx`
- Modify: `dashboard/components/DailyLog.tsx` (add expandable panel)
- Modify: `dashboard/app/api/plan/route.ts` (ensure GET returns plan for week)
- Reference mockup: `docs/superpowers/specs/mockups/daily-log-redesign.html` (Week Overview section)

- [ ] **Step 1: Create WeekOverview component**

- 7-day grid (Mon-Sun) using CSS grid
- Each cell shows: day name, session type (abbreviated), status (done/today/pending/family)
- Color coding: done=green border, today=blue border, family=dimmed
- Session count chip: "3/5 sessions done"
- Expandable via MUI Accordion or Collapse

- [ ] **Step 2: Fetch plan items for current week**

Use existing GET `/api/plan?week=N` endpoint.

- [ ] **Step 3: Integrate into DailyLog as expandable panel**

Place between the date header and the session card. Default collapsed on mobile, expanded on desktop.

- [ ] **Step 4: Verify in browser**

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/WeekOverview.tsx dashboard/components/DailyLog.tsx
git commit -m "feat(ui): add expandable week overview panel to daily log"
```

### Task A12: Update Compliance Utilities for New Fields

**Files:**
- Modify: `dashboard/lib/compliance.ts` — DayComplianceInput interface
- Modify: `dashboard/lib/daily-log.ts` — computeWeekSummary(), formatWeekSummaryForAgents(), WeekSummary interface
- Test: `dashboard/__tests__/compliance.test.ts` (update existing tests)

- [ ] **Step 1: Update DayComplianceInput interface**

Add `energy_level`, `pain_level` to the interface (for awareness, not compliance counting).

- [ ] **Step 2: Update computeWeekSummary()**

Add to WeekSummary: `energy_levels: number[]`, `pain_days: { date, level, area }[]`, `sleep_disruptions: { date, type }[]`.

- [ ] **Step 3: Update formatWeekSummaryForAgents()**

Include new data in the markdown output:
- Daily energy levels as a row
- Pain flags with body area and dates
- Sleep disruption tags per night
- Tagged notes grouped by category (query daily_notes)

- [ ] **Step 4: Run existing compliance tests + update as needed**

Run: `cd dashboard && npx vitest run __tests__/compliance.test.ts`

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/compliance.ts dashboard/lib/daily-log.ts dashboard/__tests__/compliance.test.ts
git commit -m "feat(compliance): include energy, pain, sleep disruption in weekly summary and agent context"
```

---

## Phase B: Plan Model — Flexible Scheduling

**Goal:** Change plan_items from rigid day-locked to flexible with sequencing rules.

### Task B1: Database Schema — Plan Items New Columns

**Files:**
- Modify: `dashboard/lib/db.ts` (plan_items CREATE TABLE, PlanItem interface)
- Modify: `dashboard/lib/types.ts` (PlanItem type — rename dayOrder to sequenceOrder)
- Test: `dashboard/__tests__/plan-items-schema.test.ts`

- [ ] **Step 1: Write test for new plan_items columns**

Test that `sequence_notes`, `sequence_group`, `assigned_date`, `status` columns exist.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Add columns to schema**

Add to plan_items CREATE TABLE:
```sql
sequence_notes TEXT,
sequence_group TEXT,
assigned_date TEXT,
status TEXT DEFAULT 'pending'
```

Backfill migration: `UPDATE plan_items SET status = 'completed' WHERE completed = 1`

- [ ] **Step 4: Update PlanItem interface**

In `dashboard/lib/types.ts`, add: `sequenceOrder`, `sequenceNotes`, `sequenceGroup`, `assignedDate`, `status`. Keep `dayOrder` as alias mapping in db.ts query functions.

- [ ] **Step 5: Run test to verify it passes**

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/db.ts dashboard/lib/types.ts dashboard/__tests__/plan-items-schema.test.ts
git commit -m "feat(db): add flexible scheduling columns to plan_items"
```

### Task B2: API — Session Swap with Sequencing Warnings

**Files:**
- Create: `dashboard/app/api/plan/swap/route.ts`
- Create: `dashboard/lib/sequencing.ts` (constraint checking logic)
- Test: `dashboard/__tests__/sequencing.test.ts`

- [ ] **Step 1: Write test for sequencing constraint checker**

```typescript
describe('sequencing constraints', () => {
  it('warns when same sequence_group sessions are adjacent', () => { });
  it('allows sessions with rest day between them', () => { });
  it('family day counts as separation', () => { });
  it('returns no warning when constraints are met', () => { });
  it('never blocks — always allows with warning', () => { });
});
```

- [ ] **Step 2: Implement sequencing.ts**

```typescript
export function checkSequencingConstraints(
  planItems: PlanItem[],
  sessionId: number,
  targetDate: string
): { allowed: true, warning?: string }
```

- [ ] **Step 3: Create swap API route**

POST `/api/plan/swap` — accepts `{ planItemId, targetDate }`, runs constraint check, updates `assigned_date`, returns warning if applicable.

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/sequencing.ts dashboard/app/api/plan/swap/route.ts dashboard/__tests__/sequencing.test.ts
git commit -m "feat(plan): session swap API with sequencing constraint warnings"
```

### Task B3: UI — Swap Mode on Daily Log

**Files:**
- Create: `dashboard/components/SwapSessionPicker.tsx`
- Modify: `dashboard/components/DailyLog.tsx` (replace SessionPicker with enhanced version)
- Reference mockup: `docs/superpowers/specs/mockups/daily-log-redesign.html` (Swap Mode section)

- [ ] **Step 1: Create SwapSessionPicker component**

- Shows all week's sessions as cards
- Current suggestion highlighted
- Available sessions show sequencing info from `sequence_notes`
- Warning cards (amber border) for constraint violations
- Completed sessions dimmed
- On select: calls `/api/plan/swap`, refreshes daily log

- [ ] **Step 2: Integrate into DailyLog — "Swap session" link expands picker**

- [ ] **Step 3: Verify in browser — swap works, warnings display**

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/SwapSessionPicker.tsx dashboard/components/DailyLog.tsx
git commit -m "feat(ui): swap mode with sequencing warnings on daily log"
```

### Task B4: Update Schedule Parser — Output Sequencing Metadata

**Files:**
- Modify: `dashboard/lib/parse-schedule.ts` (extract sequencing from coach output)
- Test: `dashboard/__tests__/parse-schedule-sequencing.test.ts`

**Expected coach output format for sequencing** (define the contract here so the parser can be built before coach personas are updated):

The Head Coach will output an additional section after the schedule table:
```
## Sequencing Rules
- Session 1 (Upper Push) → Seq #1, Group: upper_compound
- Session 2 (Upper Pull) → Seq #2, Group: upper_compound, Note: "not within 24h of Upper Push"
- Session 3 (Rower Sprints) → Seq #3, Note: "48h before heavy legs"
- Session 4 (Lower Heavy) → Seq #4, Note: "24h after compounds"
```

The parser extracts `sequence_notes`, `sequence_group`, and `sequence_order` from this section.

- [ ] **Step 1: Write test for sequencing metadata extraction**

Test against the expected format above. Verify each PlanItem gets its `sequenceNotes`, `sequenceGroup` populated.

- [ ] **Step 2: Implement extraction logic**

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/parse-schedule.ts dashboard/__tests__/parse-schedule-sequencing.test.ts
git commit -m "feat(parser): extract sequencing metadata from coach plan output"
```

### Task B5: Migrate completed Boolean Reads to status

**Files:**
- Modify: `dashboard/lib/db.ts` — all functions reading `plan_items.completed`
- Modify: `dashboard/lib/session-db.ts` — completeSession() to set `status = 'completed'`
- Modify: `dashboard/components/TrainingPlanTable.tsx` — read `status` instead of `completed`
- Modify: `dashboard/components/SessionPicker.tsx` — read `status`
- Modify: `dashboard/app/api/plan/route.ts` — any completion queries
- Test: `dashboard/__tests__/plan-status-migration.test.ts`

- [ ] **Step 1: Write test — status field is the source of truth**

```typescript
describe('plan_items status migration', () => {
  it('completeSession sets status to completed', () => { });
  it('getUncompletedSessionsForWeek uses status != completed', () => { });
  it('TrainingPlanTable reads status not completed boolean', () => { });
});
```

- [ ] **Step 2: Update all code paths to read status instead of completed**

Grep for `completed` in plan_items context. Update each to use `status`.

- [ ] **Step 3: Update completeSession() to set plan_items.status = 'completed'**

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/db.ts dashboard/lib/session-db.ts dashboard/components/TrainingPlanTable.tsx dashboard/components/SessionPicker.tsx dashboard/__tests__/plan-status-migration.test.ts
git commit -m "feat(plan): migrate completed boolean reads to status field"
```

---

## Phase C: Checkin Redesign

**Goal:** Redesign checkin from 4-step manual form to 5-step coaching session with auto-assembly, triage agent, and plan preview.

### Task C1: Checkin Step 1 — Weekly Review (Auto-Assembled)

**Files:**
- Create: `dashboard/components/checkin/WeeklyReview.tsx`
- Create: `dashboard/app/api/checkin/review/route.ts` (assembles all weekly data)
- Modify: `dashboard/app/checkin/page.tsx` (new step flow)

- [ ] **Step 1: Create review API endpoint**

GET `/api/checkin/review?week=N` — returns assembled data:
- All daily_logs for week (with new fields)
- All daily_notes for week (grouped by date + category)
- All completed session_logs with sets/cardio
- Garmin data with freshness indicator
- Compliance summary

- [ ] **Step 2: Create WeeklyReview component**

Renders the assembled data as a review dashboard:
- Sessions completed with summary cards
- Compliance dashboard
- Pain/energy 7-day sparkline
- Sleep pattern with disruption tags
- Tagged notes grouped by date
- Garmin freshness indicator with manual sync button
- Annotation text field

- [ ] **Step 3: Update checkin page to new 5-step flow**

Replace CheckInForm's 4-step stepper with 5 steps. Step 1 = WeeklyReview.

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/checkin/ dashboard/app/api/checkin/review/ dashboard/app/checkin/page.tsx
git commit -m "feat(checkin): step 1 — auto-assembled weekly review from daily logs"
```

### Task C2: Checkin Step 2 — Simplified Subjective Inputs

**Files:**
- Create: `dashboard/components/checkin/SubjectiveInputs.tsx`
- Modify: `dashboard/app/checkin/page.tsx` (step 2)

- [ ] **Step 1: Create SubjectiveInputs component**

Only fields daily logs can't capture:
- Perceived readiness (1-5)
- Plan satisfaction (1-5)
- Week reflection (free text)
- Next week conflicts (free text)
- Questions for coaches (free text)
- Model selection (Smart Mix / All Opus / All Sonnet) with descriptions and smart suggestion

- [ ] **Step 2: Remove duplicate and replaced fields from old CheckInForm**

Remove these fields (auto-calculated from daily logs now):
- sessionsCompleted, sessionsPlanned
- bedtimeCompliance, rugProtocolDays, hydrationTracked
- missedSessions, strengthWins, struggles (covered by tagged notes + session details)

Remove these fields (replaced by daily pain tracking):
- bakerCystPain (0-10 slider) — daily `pain_level` + `pain_area` captures this with more granularity
- lowerBackFatigue (0-10 slider) — same, covered by daily pain tracking

Remove Hevy CSV input:
- hevyCsv field — session tracker data now provides actual exercise/set data directly from the database. The Hevy CSV was a workaround for not having session tracking. Remove `parseHevyCsv()` and `formatHevySummary()` usage from the checkin flow. Session data comes from `getWeekSessions()` instead.

**What remains in the checkin form:** Only the 5 subjective fields listed in Step 1 + model selection.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/checkin/SubjectiveInputs.tsx dashboard/app/checkin/page.tsx
git commit -m "feat(checkin): step 2 — simplified subjective inputs, remove duplicates"
```

### Task C3: Checkin Step 3 — Triage Agent

**Files:**
- Create: `dashboard/components/checkin/TriageQA.tsx`
- Create: `dashboard/app/api/checkin/triage/route.ts`
- Create: `dashboard/lib/triage-agent.ts` (prompt construction + response parsing)

- [ ] **Step 1: Create triage agent API endpoint**

POST `/api/checkin/triage` — receives assembled weekly data, calls Sonnet, returns 3-5 structured questions.

- [ ] **Step 2: Create triage prompt builder**

In `lib/triage-agent.ts`: builds a prompt that scans the data for missing logs, contradictions, ambiguous notes, unusual patterns. Returns structured questions with `{ topic, question }`.

- [ ] **Step 3: Create TriageQA component**

Chat-like UI: questions displayed one at a time, athlete types answers. Answers stored in client state as `{ topic, status, context, routing_hint }`. "Submit to coaches" button when all answered.

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/checkin/TriageQA.tsx dashboard/app/api/checkin/triage/ dashboard/lib/triage-agent.ts
git commit -m "feat(checkin): step 3 — triage agent pre-flight Q&A"
```

### Task C4: Checkin Step 4 — Coach Synthesis with Structured Context

**Files:**
- Modify: `dashboard/lib/agents.ts` — buildSharedContext() function
- Modify: `dashboard/app/api/checkin/route.ts` (pass triage answers, use tiered history)

- [ ] **Step 1: Rewrite buildSharedContext() for structured injection**

Replace flat markdown summary with structured tables:
- Daily logs as a 7-day table (all fields)
- Session details with actuals vs prescribed
- Tagged notes grouped by date and category
- Triage clarifications
- Tiered history (2 weeks full, 3-8 weekly, 9+ trends)

- [ ] **Step 2: Update checkin API to accept triage answers in payload**

Add `triageClarifications` to the POST body. Include in shared context.

- [ ] **Step 3: Add new weekly_metrics columns (schema migration)**

ALTER TABLE weekly_metrics:
- ADD `kitchen_cutoff_compliance` INTEGER
- ADD `avg_energy` REAL
- ADD `pain_days` INTEGER
- ADD `sleep_disruption_count` INTEGER

- [ ] **Step 4: Update weekly_metrics upsert to auto-calculate**

Auto-calculate from daily logs: sessions_completed, vampire_compliance_pct, rug_protocol_days, hydration_tracked, kitchen_cutoff_compliance, avg_energy, pain_days, sleep_disruption_count.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/agents.ts dashboard/app/api/checkin/route.ts dashboard/lib/db.ts
git commit -m "feat(checkin): step 4 — structured context injection, weekly_metrics migration, tiered history"
```

### Task C5: Checkin Step 4 — Card-Based Plan Preview

**Files:**
- Create: `dashboard/components/checkin/PlanPreview.tsx`
- Create: `dashboard/components/checkin/PlanDayCard.tsx`
- Create: `dashboard/components/checkin/ExerciseBlock.tsx`
- Reference mockup: `docs/superpowers/specs/mockups/plan-preview-redesign.html`

- [ ] **Step 1: Create ExerciseBlock component**

Renders a superset/exercise group:
- Superset label with color-coded indicator (A=blue, B=purple, C=orange, D=amber)
- Exercise rows: name, sets x reps @ weight (bold)
- Rest time and round info
- Cardio blocks: teal border, interval structure

- [ ] **Step 2: Create PlanDayCard component**

Expandable card per day:
- Header: day name, date, session type chip, focus, sequencing chip
- Expanded: coach's note (amber box), warm-up, exercise blocks, cardio, cool-down
- Collapsed: just header row

- [ ] **Step 3: Create PlanPreview component**

Renders 7 PlanDayCards from parsed plan output. Shows "Draft — review before locking in" chip. "Discuss with Head Coach" and "Lock In Plan" buttons at bottom.

- [ ] **Step 4: Integrate into checkin results page**

Replace raw markdown table rendering with PlanPreview.

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/checkin/PlanPreview.tsx dashboard/components/checkin/PlanDayCard.tsx dashboard/components/checkin/ExerciseBlock.tsx
git commit -m "feat(checkin): card-based plan preview replacing raw table"
```

### Task C6: Model Selection UI with Smart Suggestions

**Files:**
- Create: `dashboard/components/checkin/ModelSelector.tsx`
- Create: `dashboard/lib/model-suggestion.ts`

- [ ] **Step 1: Create model suggestion logic**

```typescript
export function suggestModel(weekData: WeekReviewData): {
  suggestion: 'smart_mix' | 'all_opus' | 'all_sonnet';
  reasons: string[];
}
```

Checks: pain >= 2, phase transition within 2 weeks, race within 4 weeks, plan satisfaction 1 or 5, combined readiness < 35.

- [ ] **Step 2: Create ModelSelector component**

Three radio options with descriptions explaining when to use each. Shows smart suggestion nudge when applicable: "This week's data suggests a complex coaching conversation. Consider using All Opus."

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/checkin/ModelSelector.tsx dashboard/lib/model-suggestion.ts
git commit -m "feat(checkin): model selection with smart suggestions based on week data"
```

---

## Phase D: Head Coach Dialogue

**Goal:** Add open-ended conversation with Head Coach after synthesis, before plan lock-in.

### Task D1: Dialogue API Endpoint

**Files:**
- Create: `dashboard/app/api/checkin/dialogue/route.ts`
- Create: `dashboard/lib/dialogue.ts` (conversation management)

- [ ] **Step 1: Create dialogue API**

POST `/api/checkin/dialogue` — accepts `{ message, conversationHistory, specialistOutputs, sharedContext, draftPlan }`. Streams Head Coach response using Opus. Returns SSE stream.

- [ ] **Step 2: Create dialogue context builder**

In `lib/dialogue.ts`: builds the Head Coach prompt with specialist outputs, draft plan, shared context, and conversation history. Head Coach persona from `coaches/00_head_coach.md`.

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/api/checkin/dialogue/ dashboard/lib/dialogue.ts
git commit -m "feat(dialogue): Head Coach dialogue API with streaming"
```

### Task D2: Dialogue UI Component

**Files:**
- Create: `dashboard/components/checkin/HeadCoachDialogue.tsx`
- Modify: `dashboard/app/checkin/results/page.tsx` (add dialogue step)

- [ ] **Step 1: Create HeadCoachDialogue component**

Chat interface:
- Shows draft plan at top (PlanPreview component)
- Message history (alternating athlete/coach bubbles)
- Text input with send button
- Streaming response display
- "Lock In Plan" button (prominent, appears after at least viewing the plan)
- Conversation held in client state (ephemeral)

- [ ] **Step 2: Integrate into checkin results as Step 5**

After synthesis completes, show dialogue interface. Plan is NOT committed until "Lock In" is pressed.

- [ ] **Step 3: Implement lock-in flow**

On "Lock In": write plan_items to DB, save weekly_metrics, write weekly_log archive, redirect to daily log.

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/checkin/HeadCoachDialogue.tsx dashboard/app/checkin/results/page.tsx
git commit -m "feat(dialogue): Head Coach chat UI with plan lock-in"
```

---

## Phase E: Coach Context Injection

**Goal:** Ensure all coaches receive full structured data with tiered history.

### Task E1: Tiered History Builder

**Files:**
- Create: `dashboard/lib/tiered-history.ts`
- Test: `dashboard/__tests__/tiered-history.test.ts`

- [ ] **Step 1: Write test for tiered history**

```typescript
describe('tiered history', () => {
  it('returns full daily detail for last 2 weeks', () => { });
  it('returns weekly summaries for weeks 3-8', () => { });
  it('returns trend data for weeks 9+', () => { });
  it('handles weeks with no data gracefully', () => { });
});
```

- [ ] **Step 2: Implement tiered-history.ts**

```typescript
export function buildTieredHistory(currentWeek: number): {
  recentDetail: WeekDetail[];  // last 2 weeks, full daily
  weeklySummaries: WeekSummary[];  // weeks 3-8
  trends: TrendData;  // weeks 9+
}
```

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/tiered-history.ts dashboard/__tests__/tiered-history.test.ts
git commit -m "feat(context): tiered history builder for coach context injection"
```

### Task E2: Integrate Tiered History into buildSharedContext

**Note:** `buildSharedContext()` was already rewritten in Task C4 to use structured tables. This task adds the tiered history from E1 into that function.

**Files:**
- Modify: `dashboard/lib/agents.ts` — buildSharedContext() to call buildTieredHistory()
- Test: `dashboard/__tests__/agent-context.test.ts`

- [ ] **Step 1: Write test for tiered history integration**

Verify that buildSharedContext output includes all three tiers: recent detail (2 weeks), weekly summaries (3-8), and trends (9+).

- [ ] **Step 2: Wire buildTieredHistory() into buildSharedContext()**

Replace the hardcoded "last 4 weeks" history with the tiered approach from `lib/tiered-history.ts`.

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/agents.ts dashboard/__tests__/agent-context.test.ts
git commit -m "feat(context): integrate tiered history into coach context injection"
```

### Task E3: Coach Persona Updates

**Files:**
- Modify: `coaches/00_head_coach.md` through `coaches/07_mental_performance.md`

**IMPORTANT:** Each coach file modification requires athlete review before commit. Present the what and why for each change.

- [ ] **Step 1: Prepare change proposals for each coach**

Document for each coach:
- What changes (specific sections/instructions)
- Why (what new data they need to reference, what output format changes)

- [ ] **Step 2: Present to athlete for review**

- [ ] **Step 3: Apply approved changes**

- [ ] **Step 4: Commit each coach file individually with clear messages**

---

## Phase F: Navigation & Cleanup

**Goal:** Update navigation entry points and clean up deprecated code paths.

### Task F1: Navigation & Entry Points

**Files:**
- Modify: `dashboard/components/Sidebar.tsx` — reorder Daily Log higher
- Modify: `dashboard/app/page.tsx` — add "Go to today's log" link on dashboard
- Modify: `dashboard/app/log/page.tsx` — add Sunday 20:00+ nudge banner
- Modify: `dashboard/lib/session-db.ts` — completeSession redirects to daily log (not dashboard)

- [ ] **Step 1: Reorder sidebar — Daily Log after Dashboard**

- [ ] **Step 2: Add "Go to today's log" action on Dashboard page**

- [ ] **Step 3: Add Sunday nudge banner to daily log page**

Show soft banner before 20:00: "Sunday's data isn't complete yet. Best results after 20:00."
Show prominent banner after 20:00: "Your week is ready for review. Start check-in."

- [ ] **Step 4: Session tracker returns to daily log on complete**

Update redirect after session completion from `/` to `/log`.

- [ ] **Step 5: Training Plan page shows "secondary" indicator**

Add note or subtitle: "Full plan also available in Daily Log → Week Overview."

- [ ] **Step 6: Commit**

```bash
git add dashboard/components/Sidebar.tsx dashboard/app/page.tsx dashboard/app/log/page.tsx dashboard/lib/session-db.ts
git commit -m "feat(nav): daily log as primary entry point, sunday nudge, session returns to log"
```

### Task F2: Deprecate Old Code

**Files:**
- Modify: `dashboard/components/CheckInForm.tsx` — remove or archive (replaced by checkin/ components)
- Modify: `dashboard/lib/parse-hevy.ts` — mark as deprecated (no longer used in checkin flow)
- Verify: `daily_logs.notes` column — no new writes (all notes go to daily_notes table)
- Verify: `plan_items.completed` / `completed_at` — no new writes (all code reads `status`)

- [ ] **Step 1: Remove or archive CheckInForm.tsx**

If the new 5-step flow fully replaces it, delete. If any code still references it, archive with a deprecation comment.

- [ ] **Step 2: Add deprecation comments to parse-hevy.ts**

The Hevy CSV parser is no longer used in the checkin flow (session tracker data replaces it). Mark as deprecated. Do not delete yet in case the athlete wants to reference historical Hevy data.

- [ ] **Step 3: Grep for deprecated field usage**

Search for `daily_logs.notes` writes (should be none), `plan_items.completed` reads (should all be `status` now).

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/ dashboard/lib/parse-hevy.ts
git commit -m "chore: deprecate CheckInForm, Hevy parser, old completion fields"
```
