# Structured Training Plan Pipeline — Design Spec

> **Date:** 2026-04-01
> **Status:** Approved
> **Problem:** Coach AI outputs vary in format week-to-week, breaking Training Plan and Session page rendering. Four independent text parsers re-interpret raw workout text with different failure modes.
> **Solution:** Replace free-text workout output with structured JSON via `tool_use`, validated by Zod schema and a Validator agent. Eliminate all parsing. Store exercises as normalized DB rows.

---

## 1. Head Coach Role Split

The current Head Coach handles synthesis, plan building, and dialogue — too many responsibilities. The workout table output is where formatting breaks.

### New Roles

| Role | Input | Output | Model |
|------|-------|--------|-------|
| **Synthesis Coach** | Specialist outputs + shared context | Trimmed decision log: key trade-offs, conflict resolutions, priority overrides. No schedule table. | Opus |
| **Plan Builder Coach** | Synthesis decisions + shared context + ceilings + exercise registry + periodization | `WeekPlan` JSON via `tool_use` (Zod-validated) | Opus |
| **Plan Validator Coach** | Validated JSON + business rules checklist | Pass/fail with specific violation list. On fail: fix instructions back to Plan Builder (max 2 retries → 3 total attempts) | Sonnet |

**Synthesis Coach** keeps the Head Coach persona (strict, analytical, mandated phrases). Plan Builder and Validator are mechanical — no personality.

**Dialogue mode** stays on Synthesis Coach persona. Plan changes requested during dialogue route through Plan Builder → Validator before updating the draft.

### Failure Handling (after 3 attempts)

If all 3 Plan Builder attempts fail validation:
1. Present the plan with remaining violations flagged visually (warning badges on offending session cards)
2. Lock-in blocked until violations resolved
3. Athlete fixes via dialogue → targeted Plan Builder → Validator cycle on the affected session only

---

## 2. JSON Schema (tool_use Contract)

The exact shape the Plan Builder must produce. Everything downstream reads from this.

```typescript
// Week-level plan
interface WeekPlan {
  weekNumber: number;
  phaseId: string;                // e.g. "reconstruction"
  sessions: SessionPlan[];
  sequencingRules: SequencingRule[];
  synthesisNotes: string;         // trimmed decision log from Synthesis Coach
}

// Session-level (one per day that has activity)
interface SessionPlan {
  dayOrder: number;
  suggestedDay: string;           // "Monday", "Tuesday", etc.
  sessionType: string;            // enum: from syntax reference §27
  focus: string;                  // e.g. "Upper Pull — Heavy Row + Pull-Up Progression"
  estimatedDurationMin: number;   // validates against 50-60 min rule
  sections: ExerciseSection[];
  sequenceOrder: number;
  sequenceGroup: string | null;
  sequenceNotes: string | null;
  coachNotes: string | null;      // session-level coaching notes (brief)
}

// Section within a session
interface ExerciseSection {
  section: 'warm_up' | 'activation' | 'main_work' | 'accessory' | 'finisher' | 'cool_down';
  exercises: ExerciseItem[];
}

// Individual exercise
interface ExerciseItem {
  order: number;
  exerciseName: string;           // canonical name from exercise registry
  supersetGroup: string | null;   // "A", "B", "C" — null for standalone
  type: 'strength' | 'carry' | 'timed' | 'cardio_intervals' | 'cardio_steady' | 'ruck' | 'mobility';
  sets: number | null;
  reps: number | string | null;   // number, "8-10", "AMRAP", or null for timed
  weightKg: number | null;        // null for bodyweight
  durationSeconds: number | null;
  restSeconds: number | null;
  tempo: string | null;           // "3010" or null
  laterality: 'bilateral' | 'unilateral_each' | 'alternating';
  coachCue: string | null;        // per-exercise note
  // Cardio-specific
  rounds: number | null;
  targetIntensity: string | null; // ">300W", "Zone 4", "HR 130-145"
  intervalWorkSeconds: number | null;
  intervalRestSeconds: number | null;
}

// Sequencing constraint
interface SequencingRule {
  sessionOrder: number;
  group: string | null;
  note: string | null;            // "not within 24h of Upper Push"
}
```

### Key Design Decisions

- `reps` is `number | string | null` — supports ranges ("8-10") and tokens ("AMRAP")
- `supersetGroup` is a letter (A/B/C) — matches the convention coaches and athletes know
- Sections are explicit enums — warm-up and cool-down are structurally separated, not inferred by parsing
- `exerciseName` must match the exercise registry — Plan Builder gets the registry as context
- Each exercise carries its own `restSeconds` and `coachCue`

---

## 3. Database Schema Changes

### New Table: `plan_exercises`

```sql
CREATE TABLE plan_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_item_id INTEGER NOT NULL REFERENCES plan_items(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK(section IN ('warm_up','activation','main_work','accessory','finisher','cool_down')),
  exercise_order INTEGER NOT NULL,
  exercise_name TEXT NOT NULL,
  superset_group TEXT,
  type TEXT NOT NULL CHECK(type IN ('strength','carry','timed','cardio_intervals','cardio_steady','ruck','mobility')),
  sets INTEGER,
  reps TEXT,
  weight_kg REAL,
  duration_seconds INTEGER,
  rest_seconds INTEGER,
  tempo TEXT,
  laterality TEXT DEFAULT 'bilateral' CHECK(laterality IN ('bilateral','unilateral_each','alternating')),
  coach_cue TEXT,
  rounds INTEGER,
  target_intensity TEXT,
  interval_work_seconds INTEGER,
  interval_rest_seconds INTEGER
);
```

### Changes to `plan_items`

- `workout_plan` stays but is **deprecated** — only used for historical weeks (≤ Week 13). For new weeks, this column is NULL. The `plan_exercises` table is the source of truth.
- Add `synthesis_notes TEXT` — trimmed decision log from Synthesis Coach
- Add `estimated_duration_min INTEGER`
- `coach_cues` continues to store session-level notes (one string per session, not per exercise)
- Add `has_structured_exercises INTEGER DEFAULT 0` — flag to distinguish new-format plans from legacy text plans. UI checks this to decide whether to read from `plan_exercises` (structured) or fall back to `workout_plan` (legacy text parsers for archive pages).

### Changes to `session_sets`

- Add `section TEXT CHECK(section IN ('warm_up','activation','main_work','accessory','finisher','cool_down'))` — matches `plan_exercises` enum
- Add `rest_seconds INTEGER`
- Add `coach_cue TEXT`
- Add `plan_exercise_id INTEGER REFERENCES plan_exercises(id)` — direct link to prescription

### Changes to `session_cardio`

- Add `section TEXT CHECK(section IN ('warm_up','activation','main_work','accessory','finisher','cool_down'))` — matches `plan_exercises` enum
- Add `rest_seconds INTEGER`
- Add `coach_cue TEXT`
- Add `plan_exercise_id INTEGER REFERENCES plan_exercises(id)`
- Add `interval_work_seconds INTEGER`
- Add `interval_rest_seconds INTEGER`

All new columns nullable — existing data unaffected.

### Session Creation Flow (new)

```
Start Session → read plan_exercises for this plan_item_id
  → for each exercise:
    - strength/carry/timed → copy to session_sets (one row per set)
    - cardio_intervals/cardio_steady → copy to session_cardio
  → session page reads from session_sets/session_cardio directly
  → no parsing anywhere
```

---

## 4. End-to-End Pipeline

### Phase 1: Checkin (unchanged)
1. Weekly review auto-assembled from daily logs
2. Subjective inputs
3. Triage agent asks clarifying questions

### Phase 2: Specialist Analysis (unchanged)
4. All 7 specialists run sequentially

### Phase 3: Synthesis Coach (changed)
5. Reads specialist outputs + shared context
6. Produces trimmed decision log only — key trade-offs, conflict resolutions, priority overrides
7. No schedule table. No workout details. Just decisions.
8. Stored in `plan_items.synthesis_notes`

### Phase 4: Plan Builder Coach (new)
9. Receives: synthesis decisions + shared context + ceilings + exercise registry + periodization
10. Outputs: `WeekPlan` JSON via `tool_use`
11. Zod validates schema. If invalid → retry with error message (max 2 retries)
12. On success → pass to Validator

### Phase 5: Plan Validator Coach (new)
13. Receives validated JSON + business rules:
    - No machine-machine supersets
    - Pull-up bar not superset with cable machines
    - Pull-ups in every upper body session
    - Core stability 3x/week minimum
    - Session duration ≤ 60 min (excluding warm-up/cool-down)
    - Sunday = outdoor ruck only (no gym equipment)
    - Saturday = family day (no training)
    - Every loaded exercise has a weight
    - No exercise appears twice in same session
    - Minimum session length 40 min
14. Returns pass or violation list with fix instructions
15. On violations → Plan Builder gets fix instructions, produces corrected JSON
16. After 3 failures → present plan with violation warnings, block lock-in

### Phase 6: Persist + Present Draft
17. Write `plan_items` rows (one per session/day)
18. Write `plan_exercises` rows (exercises for each session)
19. Present draft via unified `PlanDayCard` component (reads structured data)
20. Draft chip: "Draft — review before locking in"

### Phase 7: Dialogue (changed)
21. Athlete discusses, challenges, requests changes
22. Plan changes route through Plan Builder → Validator
23. Updated `plan_exercises` rows replace draft
24. Lock-in blocked if unresolved violations

### Phase 8: Lock In
25. Status changes from draft to published
26. Training Plan page reads from `plan_exercises` (same component as draft)
27. Mandated phrase: "Locked in."

### Phase 9: Start Session (changed)
28. API copies `plan_exercises` into `session_sets`/`session_cardio`
29. No parsing. Direct structured copy.
30. Session page fully self-contained from its own DB rows
31. Warm-up, main work, cool-down render from `section` column
32. Coach cues, rest timers, RPE input all available per exercise

### Eliminated Code

- `parseScheduleTable()` — dead for new weeks
- `workout-parser.ts` — dead for new weeks
- `WorkoutDisplay.tsx` parser (788 lines) — replaced
- `ExerciseBlock.tsx` parser — replaced
- `normalizeWorkoutText()` — dead for new weeks
- Pipe-separated schedule table in synthesis output — gone

---

## 5. UI Unification

### One Component, Two Modes

A single unified `PlanDayCard` component renders both draft (checkin) and published (training plan page) plans. The only difference is a status indicator:

| Context | Status | Actions |
|---------|--------|---------|
| Checkin draft | Draft (amber) | Discuss, Lock In |
| Published plan | Published (green) | Start Session, Swap Day |
| Completed session | Completed (blue) | View Summary |
| Skipped | Skipped (grey) | — |

### Card Structure

```
┌─────────────────────────────────────────────┐
│ Mon Apr 6    [Strength]  Upper Pull — Heavy  │
│              Est. 55 min                     │
├─────────────────────────────────────────────┤
│ WARM-UP                                      │
│   W1: 5 min Bike · Zone 2                   │
│   W2: Band Pull-Aparts · 2×15               │
│                                              │
│ MAIN WORK                                    │
│   ┌ Superset A · 3 rounds · 90s rest ─────┐ │
│   │ A1: Barbell Row · 3×8 @ 60kg          │ │
│   │ A2: Face Pull · 3×15 @ 12.5kg         │ │
│   └────────────────────────────────────────┘ │
│   B1: Lat Pulldown · 3×10 @ 50kg            │
│       [3 sets · 90s rest]                    │
│                                              │
│ ACCESSORY                                    │
│   ┌ Superset C · 3 rounds · 60s rest ─────┐ │
│   │ C1: Hammer Curl · 3×12 @ 14kg         │ │
│   │ C2: Dead Hang · 3×30s                 │ │
│   └────────────────────────────────────────┘ │
│                                              │
│ COOL-DOWN                                    │
│   CD1: 5 min Walk · Zone 1                  │
│                                              │
│ Coach Notes: Grip focus today...             │
├─────────────────────────────────────────────┤
│ [Start Session]                    [Swap Day] │
└─────────────────────────────────────────────┘
```

### Session Page

Same visual structure as the plan card but with input fields:
- Each set row: actual weight/reps inputs (pre-filled with prescribed)
- Timed exercises: actual duration input
- Each exercise: RPE selector (1-5)
- Cardio: rounds completed + actual duration
- Session-level notes field at bottom
- Warm-up/cool-down: simple checkboxes (done/not done) instead of weight inputs

### Components to Retire

- `WorkoutDisplay.tsx` (788-line parser)
- `ExerciseBlock.tsx` parser
- `TrainingPlanTable.tsx`

### Components to Build

- `PlanDayCard` (unified, reads from `plan_exercises`)
- `ExerciseRow` (renders one exercise, adapts to view-only vs session tracking context)
- `SupersetBlock` (wraps grouped exercises)

---

## 6. Migration Plan (Current Week 14)

### Step 1: Schema Migration
- Add `plan_exercises` table
- Add new columns to `session_sets` and `session_cardio`
- Add `synthesis_notes` and `estimated_duration_min` to `plan_items`
- Non-destructive: all new columns nullable

### Step 2: Migrate Week 14 Plan Data
- One-time script reads current `plan_items` for Week 14
- Runs each session's `workout_plan` text through Plan Builder coach (JSON tool_use)
- Validator checks output
- Inserts `plan_exercises` rows linked to existing `plan_items`
- Does NOT re-run specialists or synthesis

### Step 3: Clean Week 14 Session Data
- Delete `session_sets`, `session_cardio`, `session_exercise_feedback`, `session_logs` for Week 14
- Athlete re-enters completed sessions through the new session page (2-3 sessions)

### Step 4: Codebase Changes
- New checkin pipeline (Synthesis Coach → Plan Builder → Validator)
- New unified `PlanDayCard` reading from `plan_exercises`
- New session creation (copy from `plan_exercises`, no parsing)
- Remove schedule table output from Head Coach synthesis prompt
- Old parsers stay for archive pages (historical weeks only)

### Step 5: Validation
- Verify Week 14 plan renders correctly
- Start a session, confirm exercises/sets/weights/sections correct
- Complete a session, confirm feedback and notes persist
- Verify archive pages still render old weeks

### Order of Operations
Schema migration → Plan Builder + Validator agents → Unified UI components → Migrate Week 14 → Clean session data → Wire up new checkin pipeline → End-to-end test

---

## 7. Conflict Sweep

Issues found during codebase exploration that must be addressed:

### 7.1 Dialogue Plan Update Instructions
`dialogue.ts` line 47 tells the Head Coach to "output the FULL updated schedule table in pipe-separated format." In the new system, dialogue plan changes go through Plan Builder → Validator. Remove this instruction; replace with instructions to describe the requested change for the Plan Builder to execute.

### 7.2 `/api/plan/reimport` Route
Re-parses synthesis text to recreate plan items. Becomes obsolete. Should re-run Plan Builder on synthesis decisions, not re-parse text.

### 7.3 `parse-hevy.ts` References
`agents.ts` imports `formatHevySummary` and `parseHevyCsv`. If Hevy CSV import is dead code (replaced by session tracker), remove to avoid confusion.

### 7.4 `model-suggestion.ts`
Not referenced in the new checkin flow. Remove if unused.

### 7.5 `deriveSessionType()` Fragile String Matching
`/api/session/route.ts` does string matching on session type. With structured data, `session_type` comes directly from the Plan Builder's enum — no derivation needed.

### 7.6 `ExerciseFeedback` String Matching
Feedback currently matched to exercises by name string. With `plan_exercise_id` on `session_sets`, feedback should link to exercise ID — eliminates name mismatch bugs.

### 7.7 Head Coach Persona File
`coaches/00_head_coach.md` contains detailed workout formatting instructions that belong to the Plan Builder. Trim to focus on coaching philosophy, conflict resolution, and dialogue behavior only.

---

## 8. Syntax Reference Integration

The training plan syntax reference (`docs/training-plan-syntax-reference.md`) becomes the Plan Builder coach's primary reference for:
- Exercise naming conventions (§1-18)
- Session structure sections (§21)
- Session type naming (§20)
- Exercise labeling (§24)
- Equipment modifiers (§25)
- Data model atoms (§26)
- Enum values (§27)

The Plan Builder's system prompt includes the relevant enums and naming conventions from this reference. The full 865-line document is not passed in-context — only the enum tables and the data model atom summary (§26-27) that map directly to the JSON schema fields.

---

## 9. What This Spec Does NOT Cover

- Changes to the Triage agent flow
- Changes to specialist agent prompts (they still output free text)
- Garmin data pipeline changes
- Daily log changes
- Dashboard page changes
- Mobile/responsive layout specifics (follows existing MUI patterns)
- Archive page redesign (historical weeks keep existing rendering)
