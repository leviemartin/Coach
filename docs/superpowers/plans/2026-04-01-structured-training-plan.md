# Structured Training Plan Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace free-text workout output with structured JSON via tool_use, eliminating all four independent text parsers and storing exercises as normalized DB rows.

**Architecture:** Head Coach splits into Synthesis Coach (commentary), Plan Builder (JSON via tool_use + Zod), and Plan Validator (business rules). New `plan_exercises` table stores individual exercises. Session creation copies structured rows instead of parsing text. One unified `PlanDayCard` component renders both draft and published plans.

**Tech Stack:** Next.js App Router, SQLite (better-sqlite3), Anthropic SDK (tool_use), Zod, Vitest, MUI

**Spec:** `docs/superpowers/specs/2026-04-01-structured-training-plan-design.md`

---

## File Map

### New files
- `dashboard/lib/plan-schema.ts` — Zod schemas + TypeScript types for WeekPlan/SessionPlan/ExerciseItem
- `dashboard/lib/plan-builder.ts` — Plan Builder coach (tool_use JSON output)
- `dashboard/lib/plan-validator.ts` — Plan Validator coach (business rules check)
- `dashboard/lib/plan-db.ts` — CRUD for plan_exercises table
- `dashboard/lib/synthesis-coach.ts` — Trimmed synthesis (replaces schedule-table portion of agents.ts)
- `dashboard/components/plan/PlanDayCard.tsx` — Unified day card (draft + published)
- `dashboard/components/plan/ExerciseRow.tsx` — Single exercise render (view + session modes)
- `dashboard/components/plan/SupersetBlock.tsx` — Superset grouping wrapper
- `dashboard/components/plan/SectionHeader.tsx` — Section label (WARM-UP, MAIN WORK, etc.)
- `dashboard/__tests__/plan-schema.test.ts` — Zod schema validation tests
- `dashboard/__tests__/plan-db.test.ts` — plan_exercises CRUD tests
- `dashboard/__tests__/plan-builder.test.ts` — Plan Builder tool definition tests
- `dashboard/__tests__/plan-validator.test.ts` — Business rules validation tests

### Modified files
- `dashboard/lib/db.ts` — Schema v10: add plan_exercises table, new columns on session_sets/session_cardio/plan_items
- `dashboard/lib/types.ts` — Add PlanExercise type, update PlanItem with new fields
- `dashboard/lib/agents.ts` — Replace buildSynthesisPrompt with trimmed synthesis, remove schedule table instructions
- `dashboard/lib/dialogue.ts` — Remove pipe-table update instructions, route changes through Plan Builder
- `dashboard/lib/session-db.ts` — Update createSession to copy from plan_exercises instead of parsing
- `dashboard/lib/constants.ts` — Add Plan Builder/Validator agent config
- `dashboard/app/api/checkin/route.ts` — New pipeline: Synthesis → Plan Builder → Validator → persist
- `dashboard/app/api/session/route.ts` — Read from plan_exercises, remove workout-parser dependency
- `dashboard/app/api/plan/route.ts` — Return plan_exercises data alongside plan_items
- `dashboard/app/plan/page.tsx` — Use unified PlanDayCard
- `dashboard/app/session/page.tsx` — No changes (delegates to SessionPage component)
- `dashboard/components/tracker/SessionPage.tsx` — Use structured data from session_sets (section, coach_cue, rest)
- `dashboard/components/checkin/PlanPreview.tsx` — Use unified PlanDayCard

---

## Task 1: Zod Schema + Types

**Files:**
- Create: `dashboard/lib/plan-schema.ts`
- Modify: `dashboard/lib/types.ts`
- Test: `dashboard/__tests__/plan-schema.test.ts`

- [ ] **Step 1: Write failing tests for Zod schema validation**

```typescript
// dashboard/__tests__/plan-schema.test.ts
import { describe, it, expect } from 'vitest';
import { WeekPlanSchema, SessionPlanSchema, ExerciseItemSchema } from '../lib/plan-schema';

describe('plan-schema', () => {
  const validExercise = {
    order: 0,
    exerciseName: 'Barbell Row',
    supersetGroup: 'A',
    type: 'strength',
    sets: 3,
    reps: 8,
    weightKg: 60,
    durationSeconds: null,
    restSeconds: 90,
    tempo: null,
    laterality: 'bilateral',
    coachCue: 'Chest to bar',
    rounds: null,
    targetIntensity: null,
    intervalWorkSeconds: null,
    intervalRestSeconds: null,
  };

  const validSession = {
    dayOrder: 1,
    suggestedDay: 'Monday',
    sessionType: 'upper_pull',
    focus: 'Upper Pull — Heavy Row + Pull-Up Progression',
    estimatedDurationMin: 55,
    sections: [
      {
        section: 'warm_up',
        exercises: [{ ...validExercise, order: 0, exerciseName: 'Bike', type: 'cardio_steady', supersetGroup: null, sets: 1, reps: null, weightKg: null, durationSeconds: 300, restSeconds: null, coachCue: null }],
      },
      {
        section: 'main_work',
        exercises: [validExercise],
      },
    ],
    sequenceOrder: 1,
    sequenceGroup: 'upper_compound',
    sequenceNotes: 'not within 24h of Upper Push',
    coachNotes: 'Grip focus today.',
  };

  const validWeekPlan = {
    weekNumber: 14,
    phaseId: 'reconstruction',
    sessions: [validSession],
    sequencingRules: [{ sessionOrder: 1, group: 'upper_compound', note: 'not within 24h of Upper Push' }],
    synthesisNotes: 'Recovery overrode Strength on Thursday — readiness was 32.',
  };

  it('validates a correct ExerciseItem', () => {
    const result = ExerciseItemSchema.safeParse(validExercise);
    expect(result.success).toBe(true);
  });

  it('rejects exercise with invalid type', () => {
    const result = ExerciseItemSchema.safeParse({ ...validExercise, type: 'swimming' });
    expect(result.success).toBe(false);
  });

  it('accepts string reps like "8-10" and "AMRAP"', () => {
    expect(ExerciseItemSchema.safeParse({ ...validExercise, reps: '8-10' }).success).toBe(true);
    expect(ExerciseItemSchema.safeParse({ ...validExercise, reps: 'AMRAP' }).success).toBe(true);
  });

  it('validates a correct SessionPlan', () => {
    const result = SessionPlanSchema.safeParse(validSession);
    expect(result.success).toBe(true);
  });

  it('rejects session with invalid section name', () => {
    const bad = { ...validSession, sections: [{ section: 'stretching', exercises: [] }] };
    const result = SessionPlanSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('validates a correct WeekPlan', () => {
    const result = WeekPlanSchema.safeParse(validWeekPlan);
    expect(result.success).toBe(true);
  });

  it('rejects week plan with no sessions', () => {
    const result = WeekPlanSchema.safeParse({ ...validWeekPlan, sessions: [] });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run __tests__/plan-schema.test.ts`
Expected: FAIL — cannot resolve `../lib/plan-schema`

- [ ] **Step 3: Implement Zod schemas**

```typescript
// dashboard/lib/plan-schema.ts
import { z } from 'zod';

// ── Exercise ─────────────────────────────────────────────────────────────

export const ExerciseTypeEnum = z.enum([
  'strength', 'carry', 'timed', 'cardio_intervals', 'cardio_steady', 'ruck', 'mobility',
]);

export const LateralityEnum = z.enum(['bilateral', 'unilateral_each', 'alternating']);

export const SectionEnum = z.enum([
  'warm_up', 'activation', 'main_work', 'accessory', 'finisher', 'cool_down',
]);

export const ExerciseItemSchema = z.object({
  order: z.number().int().min(0),
  exerciseName: z.string().min(1),
  supersetGroup: z.string().max(2).nullable(),
  type: ExerciseTypeEnum,
  sets: z.number().int().min(1).nullable(),
  reps: z.union([z.number().int().min(1), z.string().min(1), z.null()]),
  weightKg: z.number().nullable(),
  durationSeconds: z.number().int().min(1).nullable(),
  restSeconds: z.number().int().min(0).nullable(),
  tempo: z.string().regex(/^[\dX]{4}$/).nullable(),
  laterality: LateralityEnum,
  coachCue: z.string().nullable(),
  rounds: z.number().int().min(1).nullable(),
  targetIntensity: z.string().nullable(),
  intervalWorkSeconds: z.number().int().min(1).nullable(),
  intervalRestSeconds: z.number().int().min(1).nullable(),
});

// ── Section ──────────────────────────────────────────────────────────────

export const ExerciseSectionSchema = z.object({
  section: SectionEnum,
  exercises: z.array(ExerciseItemSchema),
});

// ── Session ──────────────────────────────────────────────────────────────

export const SessionTypeEnum = z.enum([
  'upper_push', 'upper_pull', 'lower_push', 'lower_pull', 'full_body',
  'strength', 'hypertrophy', 'power', 'conditioning',
  'steady_state_cardio', 'interval_cardio', 'threshold_cardio',
  'recovery', 'active_recovery', 'mobility',
  'sport_specific', 'hybrid', 'deload', 'testing', 'movement_prep',
  'ruck', 'rest', 'family_day',
]);

export const SessionPlanSchema = z.object({
  dayOrder: z.number().int().min(1),
  suggestedDay: z.string().min(1),
  sessionType: SessionTypeEnum,
  focus: z.string().min(1),
  estimatedDurationMin: z.number().int().min(0),
  sections: z.array(ExerciseSectionSchema).min(1),
  sequenceOrder: z.number().int().min(1),
  sequenceGroup: z.string().nullable(),
  sequenceNotes: z.string().nullable(),
  coachNotes: z.string().nullable(),
});

// ── Sequencing ───────────────────────────────────────────────────────────

export const SequencingRuleSchema = z.object({
  sessionOrder: z.number().int().min(1),
  group: z.string().nullable(),
  note: z.string().nullable(),
});

// ── Week Plan ────────────────────────────────────────────────────────────

export const WeekPlanSchema = z.object({
  weekNumber: z.number().int().min(1),
  phaseId: z.string().min(1),
  sessions: z.array(SessionPlanSchema).min(1),
  sequencingRules: z.array(SequencingRuleSchema),
  synthesisNotes: z.string(),
});

// ── Inferred types ───────────────────────────────────────────────────────

export type ExerciseItem = z.infer<typeof ExerciseItemSchema>;
export type ExerciseSection = z.infer<typeof ExerciseSectionSchema>;
export type SessionPlan = z.infer<typeof SessionPlanSchema>;
export type SequencingRule = z.infer<typeof SequencingRuleSchema>;
export type WeekPlan = z.infer<typeof WeekPlanSchema>;

// ── Tool definition for Anthropic API ────────────────────────────────────

export const WEEK_PLAN_TOOL = {
  name: 'save_week_plan',
  description: 'Save the structured weekly training plan. Call this tool with the complete plan for the week.',
  input_schema: {
    type: 'object' as const,
    required: ['weekNumber', 'phaseId', 'sessions', 'sequencingRules', 'synthesisNotes'],
    properties: {
      weekNumber: { type: 'integer', description: 'Training week number from program epoch' },
      phaseId: { type: 'string', description: 'Current periodization phase ID' },
      sessions: {
        type: 'array',
        description: 'Array of session plans for the week (training days only, not rest/family)',
        items: {
          type: 'object',
          required: ['dayOrder', 'suggestedDay', 'sessionType', 'focus', 'estimatedDurationMin', 'sections', 'sequenceOrder'],
          properties: {
            dayOrder: { type: 'integer' },
            suggestedDay: { type: 'string' },
            sessionType: { type: 'string', enum: SessionTypeEnum.options },
            focus: { type: 'string' },
            estimatedDurationMin: { type: 'integer' },
            sections: {
              type: 'array',
              items: {
                type: 'object',
                required: ['section', 'exercises'],
                properties: {
                  section: { type: 'string', enum: SectionEnum.options },
                  exercises: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['order', 'exerciseName', 'type', 'laterality'],
                      properties: {
                        order: { type: 'integer' },
                        exerciseName: { type: 'string' },
                        supersetGroup: { type: ['string', 'null'] },
                        type: { type: 'string', enum: ExerciseTypeEnum.options },
                        sets: { type: ['integer', 'null'] },
                        reps: { oneOf: [{ type: 'integer' }, { type: 'string' }, { type: 'null' }] },
                        weightKg: { type: ['number', 'null'] },
                        durationSeconds: { type: ['integer', 'null'] },
                        restSeconds: { type: ['integer', 'null'] },
                        tempo: { type: ['string', 'null'] },
                        laterality: { type: 'string', enum: LateralityEnum.options },
                        coachCue: { type: ['string', 'null'] },
                        rounds: { type: ['integer', 'null'] },
                        targetIntensity: { type: ['string', 'null'] },
                        intervalWorkSeconds: { type: ['integer', 'null'] },
                        intervalRestSeconds: { type: ['integer', 'null'] },
                      },
                    },
                  },
                },
              },
            },
            sequenceOrder: { type: 'integer' },
            sequenceGroup: { type: ['string', 'null'] },
            sequenceNotes: { type: ['string', 'null'] },
            coachNotes: { type: ['string', 'null'] },
          },
        },
      },
      sequencingRules: {
        type: 'array',
        items: {
          type: 'object',
          required: ['sessionOrder'],
          properties: {
            sessionOrder: { type: 'integer' },
            group: { type: ['string', 'null'] },
            note: { type: ['string', 'null'] },
          },
        },
      },
      synthesisNotes: { type: 'string' },
    },
  },
} as const;
```

- [ ] **Step 4: Update types.ts with PlanExercise and updated PlanItem**

Add to `dashboard/lib/types.ts` after the existing `PlanItem` interface:

```typescript
export interface PlanExercise {
  id?: number;
  planItemId: number;
  section: 'warm_up' | 'activation' | 'main_work' | 'accessory' | 'finisher' | 'cool_down';
  exerciseOrder: number;
  exerciseName: string;
  supersetGroup: string | null;
  type: ExerciseType;
  sets: number | null;
  reps: string | null;        // stored as string to support "8-10", "AMRAP"
  weightKg: number | null;
  durationSeconds: number | null;
  restSeconds: number | null;
  tempo: string | null;
  laterality: 'bilateral' | 'unilateral_each' | 'alternating';
  coachCue: string | null;
  rounds: number | null;
  targetIntensity: string | null;
  intervalWorkSeconds: number | null;
  intervalRestSeconds: number | null;
}
```

Add to `PlanItem` interface:

```typescript
  synthesisNotes?: string | null;
  estimatedDurationMin?: number | null;
  hasStructuredExercises?: boolean;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run __tests__/plan-schema.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/plan-schema.ts dashboard/lib/types.ts dashboard/__tests__/plan-schema.test.ts
git commit -m "feat: add Zod schemas and types for structured training plan"
```

---

## Task 2: Database Schema Migration

**Files:**
- Modify: `dashboard/lib/db.ts`
- Create: `dashboard/lib/plan-db.ts`
- Test: `dashboard/__tests__/plan-db.test.ts`

- [ ] **Step 1: Write failing tests for plan_exercises CRUD**

```typescript
// dashboard/__tests__/plan-db.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, initTablesOn, insertPlanItems } from '../lib/db';
import {
  insertPlanExercises,
  getPlanExercises,
  deletePlanExercises,
} from '../lib/plan-db';
import type { PlanExercise } from '../lib/types';

describe('plan-db', () => {
  let planItemId: number;

  beforeEach(() => {
    // Insert a plan_item to use as parent
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO plan_items (week_number, day_order, day, session_type, focus, has_structured_exercises)
      VALUES (14, 1, 'Monday', 'upper_pull', 'Upper Pull — Heavy Row', 1)
    `).run();
    planItemId = Number(result.lastInsertRowid);
  });

  const makeExercises = (parentId: number): PlanExercise[] => [
    {
      planItemId: parentId,
      section: 'warm_up',
      exerciseOrder: 0,
      exerciseName: 'Bike',
      supersetGroup: null,
      type: 'cardio_steady',
      sets: 1,
      reps: null,
      weightKg: null,
      durationSeconds: 300,
      restSeconds: null,
      tempo: null,
      laterality: 'bilateral',
      coachCue: null,
      rounds: null,
      targetIntensity: 'Zone 2',
      intervalWorkSeconds: null,
      intervalRestSeconds: null,
    },
    {
      planItemId: parentId,
      section: 'main_work',
      exerciseOrder: 1,
      exerciseName: 'Barbell Row',
      supersetGroup: 'A',
      type: 'strength',
      sets: 3,
      reps: '8',
      weightKg: 60,
      durationSeconds: null,
      restSeconds: 90,
      tempo: null,
      laterality: 'bilateral',
      coachCue: 'Chest to bar',
      rounds: null,
      targetIntensity: null,
      intervalWorkSeconds: null,
      intervalRestSeconds: null,
    },
    {
      planItemId: parentId,
      section: 'main_work',
      exerciseOrder: 2,
      exerciseName: 'Face Pull',
      supersetGroup: 'A',
      type: 'strength',
      sets: 3,
      reps: '15',
      weightKg: 12.5,
      durationSeconds: null,
      restSeconds: 90,
      tempo: null,
      laterality: 'bilateral',
      coachCue: null,
      rounds: null,
      targetIntensity: null,
      intervalWorkSeconds: null,
      intervalRestSeconds: null,
    },
  ];

  it('inserts and retrieves plan exercises', () => {
    const exercises = makeExercises(planItemId);
    insertPlanExercises(exercises);

    const result = getPlanExercises(planItemId);
    expect(result).toHaveLength(3);
    expect(result[0].exerciseName).toBe('Bike');
    expect(result[0].section).toBe('warm_up');
    expect(result[1].exerciseName).toBe('Barbell Row');
    expect(result[1].supersetGroup).toBe('A');
    expect(result[1].weightKg).toBe(60);
    expect(result[1].coachCue).toBe('Chest to bar');
    expect(result[2].supersetGroup).toBe('A');
  });

  it('deletes plan exercises for a plan item', () => {
    insertPlanExercises(makeExercises(planItemId));
    expect(getPlanExercises(planItemId)).toHaveLength(3);

    deletePlanExercises(planItemId);
    expect(getPlanExercises(planItemId)).toHaveLength(0);
  });

  it('cascades delete when plan_item is deleted', () => {
    insertPlanExercises(makeExercises(planItemId));
    const db = getDb();
    db.prepare('DELETE FROM plan_items WHERE id = ?').run(planItemId);
    expect(getPlanExercises(planItemId)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run __tests__/plan-db.test.ts`
Expected: FAIL — plan_exercises table does not exist, plan-db module not found

- [ ] **Step 3: Add schema migration to db.ts**

In `dashboard/lib/db.ts`, increment `SCHEMA_VERSION` to 10 and add after the existing `session_cardio` CREATE TABLE:

```typescript
// After line 195 (end of session_cardio CREATE TABLE)
// Add inside the same db.exec block:

    CREATE TABLE IF NOT EXISTS plan_exercises (
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
    CREATE INDEX IF NOT EXISTS idx_plan_exercises_plan_item ON plan_exercises(plan_item_id);
```

Add ALTER TABLE migrations (after existing migrations) for new columns:

```typescript
  // Migration v10: structured plan exercises
  try { db.exec(`ALTER TABLE plan_items ADD COLUMN synthesis_notes TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE plan_items ADD COLUMN estimated_duration_min INTEGER`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE plan_items ADD COLUMN has_structured_exercises INTEGER DEFAULT 0`); } catch { /* exists */ }

  try { db.exec(`ALTER TABLE session_sets ADD COLUMN section TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_sets ADD COLUMN rest_seconds INTEGER`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_sets ADD COLUMN coach_cue TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_sets ADD COLUMN plan_exercise_id INTEGER REFERENCES plan_exercises(id)`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_sets ADD COLUMN prescribed_duration_s INTEGER`); } catch { /* exists — added in prior schema */ }
  try { db.exec(`ALTER TABLE session_sets ADD COLUMN actual_duration_s INTEGER`); } catch { /* exists — added in prior schema */ }

  try { db.exec(`ALTER TABLE session_cardio ADD COLUMN section TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_cardio ADD COLUMN rest_seconds INTEGER`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_cardio ADD COLUMN coach_cue TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_cardio ADD COLUMN plan_exercise_id INTEGER REFERENCES plan_exercises(id)`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_cardio ADD COLUMN interval_work_seconds INTEGER`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_cardio ADD COLUMN interval_rest_seconds INTEGER`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_cardio ADD COLUMN actual_duration_min REAL`); } catch { /* exists — may already exist */ }
```

Update `mapPlanRow` in `db.ts` to include new fields:

```typescript
    synthesisNotes: (r.synthesis_notes as string) || null,
    estimatedDurationMin: (r.estimated_duration_min as number) || null,
    hasStructuredExercises: !!(r.has_structured_exercises),
```

- [ ] **Step 4: Implement plan-db.ts CRUD**

```typescript
// dashboard/lib/plan-db.ts
import { getDb } from './db';
import type { PlanExercise } from './types';
import type Database from 'better-sqlite3';

export function insertPlanExercises(exercises: PlanExercise[], _db?: Database.Database): void {
  const db = _db ?? getDb();
  const stmt = db.prepare(`
    INSERT INTO plan_exercises (
      plan_item_id, section, exercise_order, exercise_name, superset_group,
      type, sets, reps, weight_kg, duration_seconds, rest_seconds, tempo,
      laterality, coach_cue, rounds, target_intensity,
      interval_work_seconds, interval_rest_seconds
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction((rows: PlanExercise[]) => {
    for (const ex of rows) {
      stmt.run(
        ex.planItemId, ex.section, ex.exerciseOrder, ex.exerciseName, ex.supersetGroup,
        ex.type, ex.sets, ex.reps, ex.weightKg, ex.durationSeconds, ex.restSeconds, ex.tempo,
        ex.laterality, ex.coachCue, ex.rounds, ex.targetIntensity,
        ex.intervalWorkSeconds, ex.intervalRestSeconds,
      );
    }
  });
  insertAll(exercises);
}

export function getPlanExercises(planItemId: number, _db?: Database.Database): PlanExercise[] {
  const db = _db ?? getDb();
  const rows = db.prepare(
    'SELECT * FROM plan_exercises WHERE plan_item_id = ? ORDER BY exercise_order ASC'
  ).all(planItemId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: r.id as number,
    planItemId: r.plan_item_id as number,
    section: r.section as PlanExercise['section'],
    exerciseOrder: r.exercise_order as number,
    exerciseName: r.exercise_name as string,
    supersetGroup: r.superset_group as string | null,
    type: r.type as PlanExercise['type'],
    sets: r.sets as number | null,
    reps: r.reps as string | null,
    weightKg: r.weight_kg as number | null,
    durationSeconds: r.duration_seconds as number | null,
    restSeconds: r.rest_seconds as number | null,
    tempo: r.tempo as string | null,
    laterality: (r.laterality as PlanExercise['laterality']) ?? 'bilateral',
    coachCue: r.coach_cue as string | null,
    rounds: r.rounds as number | null,
    targetIntensity: r.target_intensity as string | null,
    intervalWorkSeconds: r.interval_work_seconds as number | null,
    intervalRestSeconds: r.interval_rest_seconds as number | null,
  }));
}

export function deletePlanExercises(planItemId: number, _db?: Database.Database): void {
  const db = _db ?? getDb();
  db.prepare('DELETE FROM plan_exercises WHERE plan_item_id = ?').run(planItemId);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run __tests__/plan-db.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 6: Run existing tests to verify no regressions**

Run: `cd dashboard && npx vitest run`
Expected: All existing tests still PASS (schema changes are additive)

- [ ] **Step 7: Commit**

```bash
git add dashboard/lib/db.ts dashboard/lib/plan-db.ts dashboard/lib/types.ts dashboard/__tests__/plan-db.test.ts
git commit -m "feat: add plan_exercises table and CRUD operations"
```

---

## Task 3: Plan Builder Coach

**Files:**
- Create: `dashboard/lib/plan-builder.ts`
- Modify: `dashboard/lib/constants.ts`
- Test: `dashboard/__tests__/plan-builder.test.ts`

- [ ] **Step 1: Write tests for Plan Builder prompt construction and tool definition**

```typescript
// dashboard/__tests__/plan-builder.test.ts
import { describe, it, expect } from 'vitest';
import { buildPlanBuilderPrompt, extractWeekPlanFromResponse } from '../lib/plan-builder';
import { WeekPlanSchema } from '../lib/plan-schema';

describe('plan-builder', () => {
  it('builds a prompt that includes synthesis notes', () => {
    const prompt = buildPlanBuilderPrompt(
      'Recovery overrode Strength on Thursday.',
      'shared context here',
      '{"Barbell Row": 60}',
      'Phase 1: Reconstruction',
      14,
    );
    expect(prompt).toContain('Recovery overrode Strength on Thursday');
    expect(prompt).toContain('shared context here');
    expect(prompt).toContain('Barbell Row');
    expect(prompt).toContain('Week 14');
  });

  it('extracts and validates a WeekPlan from a mock tool_use response', () => {
    const mockToolInput = {
      weekNumber: 14,
      phaseId: 'reconstruction',
      sessions: [{
        dayOrder: 1,
        suggestedDay: 'Monday',
        sessionType: 'upper_pull',
        focus: 'Upper Pull',
        estimatedDurationMin: 55,
        sections: [{
          section: 'main_work',
          exercises: [{
            order: 0,
            exerciseName: 'Barbell Row',
            supersetGroup: null,
            type: 'strength',
            sets: 3,
            reps: 8,
            weightKg: 60,
            durationSeconds: null,
            restSeconds: 90,
            tempo: null,
            laterality: 'bilateral',
            coachCue: null,
            rounds: null,
            targetIntensity: null,
            intervalWorkSeconds: null,
            intervalRestSeconds: null,
          }],
        }],
        sequenceOrder: 1,
        sequenceGroup: null,
        sequenceNotes: null,
        coachNotes: null,
      }],
      sequencingRules: [],
      synthesisNotes: 'Test notes.',
    };

    const result = extractWeekPlanFromResponse(mockToolInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sessions).toHaveLength(1);
      expect(result.data.sessions[0].sections[0].exercises[0].exerciseName).toBe('Barbell Row');
    }
  });

  it('rejects invalid tool_use response', () => {
    const result = extractWeekPlanFromResponse({ weekNumber: 14 });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run __tests__/plan-builder.test.ts`
Expected: FAIL — cannot resolve `../lib/plan-builder`

- [ ] **Step 3: Implement plan-builder.ts**

```typescript
// dashboard/lib/plan-builder.ts
import { getClient } from './agents';
import { readAgentPersona, readCeilings, readPeriodization } from './state';
import { OPUS_MODEL } from './constants';
import { WeekPlanSchema, WEEK_PLAN_TOOL } from './plan-schema';
import type { WeekPlan } from './plan-schema';

// ── Prompt Builder ───────────────────────────────────────────────────────

export function buildPlanBuilderPrompt(
  synthesisNotes: string,
  sharedContext: string,
  ceilingsJson: string,
  periodization: string,
  weekNumber: number,
  fixInstructions?: string,
): string {
  let prompt = `# Plan Builder — Week ${weekNumber}\n\n`;
  prompt += `You are the Plan Builder. Your ONLY job is to produce a structured weekly training plan by calling the save_week_plan tool. Do NOT output any text — only call the tool.\n\n`;

  prompt += `## Synthesis Decisions\n${synthesisNotes}\n\n`;
  prompt += `## Athlete Context\n${sharedContext}\n\n`;
  prompt += `## Current Ceilings (starting weights)\n${ceilingsJson}\n\n`;
  prompt += `## Periodization\n${periodization}\n\n`;

  prompt += `## Rules\n`;
  prompt += `- Every loaded exercise MUST have a weightKg value\n`;
  prompt += `- exerciseName must be a standard gym exercise name\n`;
  prompt += `- Supersets: same supersetGroup letter (A, B, C). Standalone exercises: supersetGroup = null\n`;
  prompt += `- Never superset two machines. Pair machine + portable/bodyweight.\n`;
  prompt += `- Pull-up bar is in the free weight area, NOT near cable machines. Never superset pull-ups with cable exercises.\n`;
  prompt += `- Session duration 50-60 min (main work only, excluding warm_up and cool_down)\n`;
  prompt += `- Minimum session length 40 min total\n`;
  prompt += `- Sunday = outdoor ruck with dog. No gym equipment.\n`;
  prompt += `- Saturday = family day. No training. Use sessionType "family_day".\n`;
  prompt += `- Pull-ups in every upper body session\n`;
  prompt += `- Core stability 3x/week minimum\n`;
  prompt += `- Each exercise appears ONCE per session\n`;
  prompt += `- Warm-up section: 5-10 min general + activation\n`;
  prompt += `- Cool-down section: 3-5 min light movement\n\n`;

  if (fixInstructions) {
    prompt += `## FIXES REQUIRED\nThe Validator found these violations in your previous output. Fix them:\n${fixInstructions}\n\n`;
  }

  prompt += `Call the save_week_plan tool now with the complete weekly plan.`;

  return prompt;
}

// ── Extraction + Validation ──────────────────────────────────────────────

export function extractWeekPlanFromResponse(
  toolInput: unknown,
): { success: true; data: WeekPlan } | { success: false; error: string } {
  const result = WeekPlanSchema.safeParse(toolInput);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.issues.map(
    (i) => `${i.path.join('.')}: ${i.message}`
  ).join('\n');
  return { success: false, error: errors };
}

// ── API Call ─────────────────────────────────────────────────────────────

export async function runPlanBuilder(
  synthesisNotes: string,
  sharedContext: string,
  weekNumber: number,
  fixInstructions?: string,
): Promise<{ success: true; data: WeekPlan } | { success: false; error: string }> {
  const client = getClient();
  const ceilings = readCeilings();
  const periodization = readPeriodization();

  const prompt = buildPlanBuilderPrompt(
    synthesisNotes,
    sharedContext,
    JSON.stringify(ceilings.ceilings, null, 2),
    periodization,
    weekNumber,
    fixInstructions,
  );

  const response = await client.messages.create({
    model: OPUS_MODEL,
    max_tokens: 8000,
    tools: [WEEK_PLAN_TOOL],
    tool_choice: { type: 'tool', name: 'save_week_plan' },
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract tool_use block
  const toolBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    return { success: false, error: 'Plan Builder did not call the save_week_plan tool.' };
  }

  return extractWeekPlanFromResponse(toolBlock.input);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run __tests__/plan-builder.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/plan-builder.ts dashboard/__tests__/plan-builder.test.ts
git commit -m "feat: add Plan Builder coach with tool_use and Zod validation"
```

---

## Task 4: Plan Validator Coach

**Files:**
- Create: `dashboard/lib/plan-validator.ts`
- Test: `dashboard/__tests__/plan-validator.test.ts`

- [ ] **Step 1: Write tests for business rule validation**

```typescript
// dashboard/__tests__/plan-validator.test.ts
import { describe, it, expect } from 'vitest';
import { validatePlanRules, type PlanViolation } from '../lib/plan-validator';
import type { WeekPlan, SessionPlan, ExerciseItem } from '../lib/plan-schema';

function makeExercise(overrides: Partial<ExerciseItem> = {}): ExerciseItem {
  return {
    order: 0, exerciseName: 'Test Exercise', supersetGroup: null,
    type: 'strength', sets: 3, reps: 8, weightKg: 50,
    durationSeconds: null, restSeconds: 90, tempo: null,
    laterality: 'bilateral', coachCue: null, rounds: null,
    targetIntensity: null, intervalWorkSeconds: null, intervalRestSeconds: null,
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionPlan> = {}): SessionPlan {
  return {
    dayOrder: 1, suggestedDay: 'Monday', sessionType: 'upper_pull',
    focus: 'Upper Pull', estimatedDurationMin: 55,
    sections: [{ section: 'main_work', exercises: [makeExercise()] }],
    sequenceOrder: 1, sequenceGroup: null, sequenceNotes: null, coachNotes: null,
    ...overrides,
  };
}

function makePlan(sessions: SessionPlan[]): WeekPlan {
  return {
    weekNumber: 14, phaseId: 'reconstruction',
    sessions, sequencingRules: [], synthesisNotes: 'Test.',
  };
}

describe('plan-validator', () => {
  it('passes a valid plan', () => {
    const plan = makePlan([
      makeSession({
        sessionType: 'upper_pull',
        sections: [{
          section: 'main_work',
          exercises: [
            makeExercise({ exerciseName: 'Pull-Up', supersetGroup: 'A', order: 0 }),
            makeExercise({ exerciseName: 'DB Curl', supersetGroup: 'A', order: 1 }),
            makeExercise({ exerciseName: 'Pallof Press', order: 2 }),
          ],
        }],
      }),
      makeSession({ dayOrder: 2, suggestedDay: 'Wednesday', sessionType: 'strength', sections: [{ section: 'main_work', exercises: [makeExercise({ exerciseName: 'Pallof Press' })] }] }),
      makeSession({ dayOrder: 3, suggestedDay: 'Friday', sessionType: 'upper_push', sections: [{ section: 'main_work', exercises: [makeExercise({ exerciseName: 'Pull-Up' }), makeExercise({ exerciseName: 'Pallof Press', order: 1 })] }] }),
      makeSession({ dayOrder: 4, suggestedDay: 'Sunday', sessionType: 'ruck', estimatedDurationMin: 90, sections: [{ section: 'main_work', exercises: [makeExercise({ exerciseName: 'Ruck Walk', type: 'ruck', weightKg: null })] }] }),
    ]);
    const violations = validatePlanRules(plan);
    expect(violations).toHaveLength(0);
  });

  it('detects machine-machine superset', () => {
    const plan = makePlan([makeSession({
      sections: [{
        section: 'main_work',
        exercises: [
          makeExercise({ exerciseName: 'Lat Pulldown', supersetGroup: 'A', order: 0 }),
          makeExercise({ exerciseName: 'Cable Row', supersetGroup: 'A', order: 1 }),
        ],
      }],
    })]);
    const violations = validatePlanRules(plan);
    expect(violations.some(v => v.rule === 'no_machine_machine_superset')).toBe(true);
  });

  it('detects missing pull-ups in upper body session', () => {
    const plan = makePlan([makeSession({
      sessionType: 'upper_pull',
      sections: [{
        section: 'main_work',
        exercises: [makeExercise({ exerciseName: 'Barbell Row' })],
      }],
    })]);
    const violations = validatePlanRules(plan);
    expect(violations.some(v => v.rule === 'pullups_in_upper')).toBe(true);
  });

  it('detects loaded exercise without weight', () => {
    const plan = makePlan([makeSession({
      sections: [{
        section: 'main_work',
        exercises: [makeExercise({ exerciseName: 'Barbell Row', weightKg: null })],
      }],
    })]);
    const violations = validatePlanRules(plan);
    expect(violations.some(v => v.rule === 'loaded_exercise_needs_weight')).toBe(true);
  });

  it('detects Sunday session with gym equipment', () => {
    const plan = makePlan([makeSession({
      suggestedDay: 'Sunday',
      sessionType: 'strength',
      sections: [{
        section: 'main_work',
        exercises: [makeExercise({ exerciseName: 'Lat Pulldown' })],
      }],
    })]);
    const violations = validatePlanRules(plan);
    expect(violations.some(v => v.rule === 'sunday_outdoor_only')).toBe(true);
  });

  it('detects Saturday training', () => {
    const plan = makePlan([makeSession({
      suggestedDay: 'Saturday',
      sessionType: 'strength',
    })]);
    const violations = validatePlanRules(plan);
    expect(violations.some(v => v.rule === 'saturday_family_day')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run __tests__/plan-validator.test.ts`
Expected: FAIL — cannot resolve `../lib/plan-validator`

- [ ] **Step 3: Implement plan-validator.ts**

```typescript
// dashboard/lib/plan-validator.ts
import type { WeekPlan, SessionPlan, ExerciseItem } from './plan-schema';

export interface PlanViolation {
  rule: string;
  sessionIndex: number;
  sessionFocus: string;
  message: string;
}

// Machine exercises that occupy a fixed station (cable stacks, plate-loaded machines, etc.)
const MACHINE_EXERCISES = new Set([
  'lat pulldown', 'cable row', 'seated row', 'chest press', 'chest fly machine',
  'leg press', 'hamstring curl', 'leg extension', 'leg curl', 'smith machine',
  'cable crossover', 'cable fly', 'cable lateral raise', 'cable curl',
  'cable tricep pushdown', 'cable tricep extension', 'cable face pull',
  'hip abduction', 'hip adduction', 'calf raise machine', 'hack squat',
  'pec deck', 'shoulder press machine', 'assisted dip machine',
  'assisted pull-up machine',
]);

// Bodyweight / portable exercises that are done at the pull-up bar area
const PULLUP_BAR_EXERCISES = new Set([
  'pull-up', 'pull-ups', 'chin-up', 'chin-ups', 'negative pull-up',
  'negative pull-ups', 'dead hang', 'hanging knee raise', 'hanging leg raise',
  'toes to bar',
]);

// Exercises that count as "pull-up progression"
const PULLUP_VARIANTS = new Set([
  'pull-up', 'pull-ups', 'chin-up', 'chin-ups', 'negative pull-up',
  'negative pull-ups', 'assisted pull-up', 'band-assisted pull-up',
  'band-assisted pull-ups', 'lat pulldown', // lat pulldown counts as pull-up regression
]);

// Exercises that count as core stability
const CORE_EXERCISES = new Set([
  'pallof press', 'dead bug', 'bird dog', 'plank', 'side plank',
  'ab rollout', 'farmer carry', "farmer's carry", "farmer's walk",
  'suitcase carry', 'hanging knee raise', 'hanging leg raise',
  'cable woodchop', 'anti-rotation press', 'copenhagen plank',
]);

// Bodyweight exercises that don't need a weightKg value
const BODYWEIGHT_EXERCISES = new Set([
  'pull-up', 'pull-ups', 'chin-up', 'chin-ups', 'push-up', 'push-ups',
  'dip', 'dips', 'negative pull-up', 'negative pull-ups', 'dead hang',
  'plank', 'side plank', 'dead bug', 'bird dog', 'burpee', 'burpees',
  'mountain climber', 'mountain climbers', 'box jump', 'broad jump',
  'hanging knee raise', 'hanging leg raise', 'toes to bar',
  'band pull-apart', 'band pull-aparts', 'face pull',
  'ruck walk', 'walking',
]);

function isMachine(name: string): boolean {
  return MACHINE_EXERCISES.has(name.toLowerCase());
}

function isPullupBar(name: string): boolean {
  return PULLUP_BAR_EXERCISES.has(name.toLowerCase());
}

function isUpperSession(sessionType: string): boolean {
  const t = sessionType.toLowerCase();
  return t.includes('upper') || t === 'full_body';
}

function isCableExercise(name: string): boolean {
  return name.toLowerCase().startsWith('cable') || name.toLowerCase().includes('lat pulldown');
}

export function validatePlanRules(plan: WeekPlan): PlanViolation[] {
  const violations: PlanViolation[] = [];

  let weekCoreCount = 0;

  for (let si = 0; si < plan.sessions.length; si++) {
    const session = plan.sessions[si];
    const allExercises = session.sections.flatMap((s) => s.exercises);

    // Rule: Saturday = family day
    if (session.suggestedDay === 'Saturday' && session.sessionType !== 'family_day' && session.sessionType !== 'rest') {
      violations.push({
        rule: 'saturday_family_day',
        sessionIndex: si,
        sessionFocus: session.focus,
        message: `Saturday must be family day. Got sessionType "${session.sessionType}".`,
      });
    }

    // Rule: Sunday = outdoor ruck only
    if (session.suggestedDay === 'Sunday' && session.sessionType !== 'ruck' && session.sessionType !== 'active_recovery') {
      violations.push({
        rule: 'sunday_outdoor_only',
        sessionIndex: si,
        sessionFocus: session.focus,
        message: `Sunday must be outdoor ruck or active recovery. Got sessionType "${session.sessionType}".`,
      });
    }

    // Rule: no machine-machine supersets
    const supersetGroups = new Map<string, ExerciseItem[]>();
    for (const ex of allExercises) {
      if (ex.supersetGroup) {
        const group = supersetGroups.get(ex.supersetGroup) ?? [];
        group.push(ex);
        supersetGroups.set(ex.supersetGroup, group);
      }
    }
    for (const [group, exercises] of supersetGroups) {
      const machineCount = exercises.filter((e) => isMachine(e.exerciseName)).length;
      if (machineCount >= 2) {
        violations.push({
          rule: 'no_machine_machine_superset',
          sessionIndex: si,
          sessionFocus: session.focus,
          message: `Superset ${group}: ${exercises.map(e => e.exerciseName).join(' + ')} — cannot pair two machines.`,
        });
      }
      // Rule: no pull-up bar + cable machine supersets
      const hasPullupBar = exercises.some((e) => isPullupBar(e.exerciseName));
      const hasCable = exercises.some((e) => isCableExercise(e.exerciseName));
      if (hasPullupBar && hasCable) {
        violations.push({
          rule: 'no_pullup_cable_superset',
          sessionIndex: si,
          sessionFocus: session.focus,
          message: `Superset ${group}: ${exercises.map(e => e.exerciseName).join(' + ')} — pull-up bar is not near cable machines.`,
        });
      }
    }

    // Rule: pull-ups in every upper body session
    if (isUpperSession(session.sessionType)) {
      const hasPullup = allExercises.some((e) =>
        PULLUP_VARIANTS.has(e.exerciseName.toLowerCase())
      );
      if (!hasPullup) {
        violations.push({
          rule: 'pullups_in_upper',
          sessionIndex: si,
          sessionFocus: session.focus,
          message: `Upper body session missing pull-up progression exercise.`,
        });
      }
    }

    // Rule: loaded exercises must have weight
    for (const ex of allExercises) {
      if (ex.type === 'strength' && ex.weightKg == null && !BODYWEIGHT_EXERCISES.has(ex.exerciseName.toLowerCase())) {
        violations.push({
          rule: 'loaded_exercise_needs_weight',
          sessionIndex: si,
          sessionFocus: session.focus,
          message: `"${ex.exerciseName}" is a strength exercise with no weightKg.`,
        });
      }
    }

    // Rule: no duplicate exercises in a session
    const exerciseNames = allExercises.map((e) => e.exerciseName.toLowerCase());
    const seen = new Set<string>();
    for (const name of exerciseNames) {
      if (seen.has(name)) {
        violations.push({
          rule: 'no_duplicate_exercise',
          sessionIndex: si,
          sessionFocus: session.focus,
          message: `"${name}" appears more than once in the session.`,
        });
      }
      seen.add(name);
    }

    // Count core exercises across the week
    weekCoreCount += allExercises.filter((e) =>
      CORE_EXERCISES.has(e.exerciseName.toLowerCase())
    ).length > 0 ? 1 : 0;
  }

  // Rule: core stability 3x/week
  if (weekCoreCount < 3) {
    violations.push({
      rule: 'core_3x_week',
      sessionIndex: -1,
      sessionFocus: 'Week-level',
      message: `Core stability in ${weekCoreCount} sessions, minimum is 3.`,
    });
  }

  return violations;
}

// ── Format violations for Plan Builder fix instructions ───────────────────

export function formatViolationsForFix(violations: PlanViolation[]): string {
  return violations.map((v, i) =>
    `${i + 1}. [${v.rule}] Session "${v.sessionFocus}": ${v.message}`
  ).join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run __tests__/plan-validator.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/plan-validator.ts dashboard/__tests__/plan-validator.test.ts
git commit -m "feat: add Plan Validator with business rules checking"
```

---

## Task 5: Synthesis Coach

**Files:**
- Create: `dashboard/lib/synthesis-coach.ts`
- Modify: `dashboard/lib/agents.ts`

- [ ] **Step 1: Create synthesis-coach.ts**

```typescript
// dashboard/lib/synthesis-coach.ts
import { getClient } from './agents';
import { readAgentPersona } from './state';
import { OPUS_MODEL } from './constants';
import type { AgentOutput } from './types';

function buildSynthesisSystemPrompt(): string {
  const persona = readAgentPersona('head_coach');
  const instructions = `
# Synthesis Mode

You are producing a TRIMMED DECISION LOG. Not an essay. Not a full plan.

## Output Rules
1. Lead with the 2-3 most important decisions this week and WHY
2. Show inter-agent conflicts only where they changed the plan
3. Address athlete plan feedback directly if satisfaction was ≤2 or ≥4
4. Do NOT output any schedule, table, or workout details — the Plan Builder handles that
5. Keep total output under 500 words
6. End with your mandated closing phrase

## Format
- Use bullet points for decisions
- Quote which specialist drove each decision
- State what changed from last week and why
`;
  return (persona ? persona + '\n\n' : '') + instructions;
}

export function buildSynthesisUserPrompt(
  specialistOutputs: AgentOutput[],
  sharedContext: string,
): string {
  let prompt = `# Specialist Assessments\n\n`;
  for (const output of specialistOutputs) {
    prompt += `## ${output.label}\n`;
    prompt += output.error ? `**ERROR:** ${output.error}\n\n` : `${output.content}\n\n`;
  }
  prompt += `## Athlete Check-In Data\n${sharedContext}\n\n`;
  prompt += `Produce your trimmed decision log now.`;
  return prompt;
}

export async function* streamSynthesis(
  specialistOutputs: AgentOutput[],
  sharedContext: string,
): AsyncGenerator<string> {
  const client = getClient();
  const systemPrompt = buildSynthesisSystemPrompt();
  const userPrompt = buildSynthesisUserPrompt(specialistOutputs, sharedContext);

  const stream = client.messages.stream({
    model: OPUS_MODEL,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      'delta' in event &&
      event.delta.type === 'text_delta' &&
      'text' in event.delta
    ) {
      yield event.delta.text;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/lib/synthesis-coach.ts
git commit -m "feat: add Synthesis Coach for trimmed decision log output"
```

---

## Task 6: New Checkin Pipeline

**Files:**
- Modify: `dashboard/app/api/checkin/route.ts`
- Modify: `dashboard/lib/db.ts` (add insertPlanItemsStructured helper)

- [ ] **Step 1: Add helper to convert WeekPlan → plan_items + plan_exercises**

Add to `dashboard/lib/plan-db.ts`:

```typescript
import { getDb } from './db';
import { insertPlanExercises } from './plan-db';
import type { WeekPlan, SessionPlan } from './plan-schema';
import type { PlanItem, PlanExercise } from './types';

export function persistWeekPlan(plan: WeekPlan): { planItemIds: number[] } {
  const db = getDb();
  const planItemIds: number[] = [];

  const insertItem = db.prepare(`
    INSERT INTO plan_items (
      week_number, day_order, day, session_type, focus,
      starting_weight, workout_plan, coach_cues, athlete_notes,
      completed, sequence_notes, sequence_group, assigned_date, status,
      synthesis_notes, estimated_duration_min, has_structured_exercises
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', 0, ?, ?, NULL, 'pending', ?, ?, 1)
  `);

  const insertExercise = db.prepare(`
    INSERT INTO plan_exercises (
      plan_item_id, section, exercise_order, exercise_name, superset_group,
      type, sets, reps, weight_kg, duration_seconds, rest_seconds, tempo,
      laterality, coach_cue, rounds, target_intensity,
      interval_work_seconds, interval_rest_seconds
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const session of plan.sessions) {
      const result = insertItem.run(
        plan.weekNumber,
        session.dayOrder,
        session.suggestedDay,
        session.sessionType,
        session.focus,
        '', // starting_weight deprecated — weights are per-exercise now
        null, // workout_plan deprecated for structured plans
        session.coachNotes || '',
        session.sequenceNotes || null,
        session.sequenceGroup || null,
        plan.synthesisNotes,
        session.estimatedDurationMin,
      );
      const planItemId = Number(result.lastInsertRowid);
      planItemIds.push(planItemId);

      for (const section of session.sections) {
        for (const ex of section.exercises) {
          insertExercise.run(
            planItemId, section.section, ex.order, ex.exerciseName, ex.supersetGroup,
            ex.type, ex.sets, ex.reps != null ? String(ex.reps) : null, ex.weightKg,
            ex.durationSeconds, ex.restSeconds, ex.tempo,
            ex.laterality, ex.coachCue, ex.rounds, ex.targetIntensity,
            ex.intervalWorkSeconds, ex.intervalRestSeconds,
          );
        }
      }
    }
  })();

  return { planItemIds };
}
```

- [ ] **Step 2: Rewrite checkin route to use new pipeline**

Replace the Phase 2 (synthesis) and Phase 3 (persist) sections in `dashboard/app/api/checkin/route.ts`. The key changes:

1. Replace `streamHeadCoachSynthesis` with `streamSynthesis` from synthesis-coach.ts
2. After synthesis, call `runPlanBuilder` from plan-builder.ts
3. Run `validatePlanRules` from plan-validator.ts
4. On violations, retry Plan Builder with fix instructions (max 2 retries)
5. Replace `parseScheduleTable` + `insertPlanItems` with `persistWeekPlan`
6. Send structured plan items to client instead of raw text

The full implementation should be done by the executing agent following these steps:

1. Import new modules: `streamSynthesis`, `runPlanBuilder`, `validatePlanRules`, `formatViolationsForFix`, `persistWeekPlan`
2. Remove imports: `parseScheduleTable`, `streamHeadCoachSynthesis` (from agents.ts)
3. Replace Phase 2 with: stream synthesis → collect full text
4. Add Phase 3: run Plan Builder (tool_use) → Zod validate → Validator rules check → retry loop
5. Replace Phase 4 persist: `deletePlanItems(weekNumber)` → `persistWeekPlan(validatedPlan)`
6. Send `plan_builder_complete` event with plan item count and any remaining violations

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/plan-db.ts dashboard/app/api/checkin/route.ts
git commit -m "feat: wire up new checkin pipeline with Plan Builder + Validator"
```

---

## Task 7: Plan API — Return Structured Exercises

**Files:**
- Modify: `dashboard/app/api/plan/route.ts`

- [ ] **Step 1: Read current plan route**

Read `dashboard/app/api/plan/route.ts` to understand the current response shape.

- [ ] **Step 2: Update plan API to include plan_exercises**

The GET handler should:
1. Load plan_items for the current week (existing)
2. For items where `has_structured_exercises` is true, load `plan_exercises` via `getPlanExercises(item.id)`
3. Return `{ items, exercises: Record<number, PlanExercise[]> }` where the key is plan_item_id
4. For legacy items (has_structured_exercises false), return exercises as empty array

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/api/plan/route.ts
git commit -m "feat: plan API returns structured exercises alongside plan items"
```

---

## Task 8: Session Creation from Structured Data

**Files:**
- Modify: `dashboard/lib/session-db.ts`
- Modify: `dashboard/app/api/session/route.ts`

- [ ] **Step 1: Add createSessionFromPlanExercises to session-db.ts**

```typescript
export function createSessionFromPlanExercises(
  date: string,
  sessionType: string,
  sessionTitle: string,
  planExercises: PlanExercise[],
  _db?: Database.Database,
): number {
  const db = _db ?? getDb();
  const weekNumber = getTrainingWeek();

  const existing = db.prepare(`
    SELECT id FROM session_logs WHERE date = ? AND session_title = ?
  `).get(date, sessionTitle) as { id: number } | undefined;

  let sessionId: number;
  if (existing) {
    sessionId = existing.id;
  } else {
    const insert = db.prepare(`
      INSERT INTO session_logs (date, week_number, session_type, session_title, started_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = insert.run(date, weekNumber, sessionType, sessionTitle, new Date().toISOString());
    sessionId = Number(result.lastInsertRowid);
  }

  db.prepare('DELETE FROM session_sets WHERE session_log_id = ?').run(sessionId);
  db.prepare('DELETE FROM session_cardio WHERE session_log_id = ?').run(sessionId);

  const insertSet = db.prepare(`
    INSERT INTO session_sets
    (session_log_id, exercise_name, exercise_order, superset_group, set_number,
     prescribed_weight_kg, prescribed_reps, prescribed_duration_s, completed, is_modified,
     section, rest_seconds, coach_cue, plan_exercise_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
  `);

  const insertCardio = db.prepare(`
    INSERT INTO session_cardio
    (session_log_id, exercise_name, cardio_type, prescribed_rounds,
     completed_rounds, prescribed_duration_min, target_intensity, completed,
     section, rest_seconds, coach_cue, plan_exercise_id,
     interval_work_seconds, interval_rest_seconds)
    VALUES (?, ?, ?, ?, 0, ?, ?, 0, ?, ?, ?, ?, ?, ?)
  `);

  for (const ex of planExercises) {
    if (ex.type === 'cardio_intervals' || ex.type === 'cardio_steady') {
      insertCardio.run(
        sessionId, ex.exerciseName,
        ex.type === 'cardio_intervals' ? 'intervals' : 'steady_state',
        ex.rounds,
        ex.durationSeconds ? ex.durationSeconds / 60 : null,
        ex.targetIntensity,
        ex.section, ex.restSeconds, ex.coachCue, ex.id ?? null,
        ex.intervalWorkSeconds, ex.intervalRestSeconds,
      );
    } else {
      const numSets = ex.sets ?? 1;
      const repsNum = ex.reps != null ? parseInt(String(ex.reps), 10) : null;
      const supersetGroupInt = ex.supersetGroup
        ? ex.supersetGroup.charCodeAt(0) - 64 // A=1, B=2, C=3
        : null;

      for (let s = 1; s <= numSets; s++) {
        insertSet.run(
          sessionId, ex.exerciseName, ex.exerciseOrder, supersetGroupInt, s,
          ex.weightKg, isNaN(repsNum ?? NaN) ? null : repsNum,
          ex.durationSeconds,
          ex.section, ex.restSeconds, ex.coachCue, ex.id ?? null,
        );
      }
    }
  }

  return sessionId;
}
```

- [ ] **Step 2: Update session API route**

In `dashboard/app/api/session/route.ts`:
1. Import `getPlanExercises` from `plan-db`
2. Import `createSessionFromPlanExercises` from `session-db`
3. When `targetItem.hasStructuredExercises` is true:
   - Call `getPlanExercises(targetItem.id!)` to get structured exercises
   - Call `createSessionFromPlanExercises` instead of parsing + `createSession`
   - Remove dependency on `parseWorkoutPlan` from `workout-parser.ts` for structured plans
4. Keep the old path as fallback for legacy plan items

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/session-db.ts dashboard/app/api/session/route.ts
git commit -m "feat: session creation from structured plan_exercises (no parsing)"
```

---

## Task 9: Unified PlanDayCard Component

**Files:**
- Create: `dashboard/components/plan/SectionHeader.tsx`
- Create: `dashboard/components/plan/ExerciseRow.tsx`
- Create: `dashboard/components/plan/SupersetBlock.tsx`
- Create: `dashboard/components/plan/PlanDayCard.tsx`

- [ ] **Step 1: Create SectionHeader**

```typescript
// dashboard/components/plan/SectionHeader.tsx
'use client';
import React from 'react';
import { Typography } from '@mui/material';

const SECTION_LABELS: Record<string, string> = {
  warm_up: 'WARM-UP',
  activation: 'ACTIVATION',
  main_work: 'MAIN WORK',
  accessory: 'ACCESSORY',
  finisher: 'FINISHER',
  cool_down: 'COOL-DOWN',
};

export default function SectionHeader({ section }: { section: string }) {
  return (
    <Typography sx={{
      fontSize: '0.6875rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '1.5px',
      color: '#64748b',
      mt: 2,
      mb: 0.75,
    }}>
      {SECTION_LABELS[section] ?? section.toUpperCase()}
    </Typography>
  );
}
```

- [ ] **Step 2: Create ExerciseRow**

```typescript
// dashboard/components/plan/ExerciseRow.tsx
'use client';
import React from 'react';
import { Box, Typography } from '@mui/material';
import type { PlanExercise } from '@/lib/types';

interface ExerciseRowProps {
  exercise: PlanExercise;
  label: string; // "A1", "B2", "W1", etc.
}

function formatDetail(ex: PlanExercise): string {
  const parts: string[] = [];
  if (ex.sets && ex.reps) parts.push(`${ex.sets}x${ex.reps}`);
  else if (ex.sets && ex.durationSeconds) parts.push(`${ex.sets}x${ex.durationSeconds}s`);
  else if (ex.durationSeconds) {
    const min = ex.durationSeconds >= 60 ? `${Math.round(ex.durationSeconds / 60)} min` : `${ex.durationSeconds}s`;
    parts.push(min);
  }
  if (ex.weightKg != null) parts.push(`@ ${ex.weightKg}kg`);
  if (ex.targetIntensity) parts.push(`· ${ex.targetIntensity}`);
  if (ex.laterality === 'unilateral_each') parts.push('/side');
  if (ex.laterality === 'alternating') parts.push('alt');
  return parts.join(' ');
}

export default function ExerciseRow({ exercise, label }: ExerciseRowProps) {
  const detail = formatDetail(exercise);
  const weightMatch = detail.match(/(@ [\d.]+kg)/);

  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.25, pl: 1 }}>
      {label && (
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', minWidth: 24 }}>
          {label}
        </Typography>
      )}
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: '#0f172a' }}>
        {exercise.exerciseName}
      </Typography>
      <Typography sx={{ fontSize: '0.8125rem', color: '#475569' }}>
        {weightMatch ? (
          <>
            {detail.split(weightMatch[1])[0]}
            <Box component="span" sx={{ fontWeight: 700, color: '#0f172a' }}>{weightMatch[1]}</Box>
            {detail.split(weightMatch[1])[1]}
          </>
        ) : detail}
      </Typography>
      {exercise.coachCue && (
        <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', ml: 'auto' }}>
          {exercise.coachCue}
        </Typography>
      )}
    </Box>
  );
}
```

- [ ] **Step 3: Create SupersetBlock**

```typescript
// dashboard/components/plan/SupersetBlock.tsx
'use client';
import React from 'react';
import { Box, Typography } from '@mui/material';
import type { PlanExercise } from '@/lib/types';
import ExerciseRow from './ExerciseRow';

const SUPERSET_COLORS: Record<string, { bg: string; border: string }> = {
  A: { bg: '#eff6ff', border: '#bfdbfe' },
  B: { bg: '#f5f3ff', border: '#ddd6fe' },
  C: { bg: '#fff7ed', border: '#fed7aa' },
  D: { bg: '#fefce8', border: '#fde68a' },
};

interface SupersetBlockProps {
  groupLetter: string;
  exercises: PlanExercise[];
}

export default function SupersetBlock({ groupLetter, exercises }: SupersetBlockProps) {
  const colors = SUPERSET_COLORS[groupLetter] ?? { bg: '#f8fafc', border: '#e2e8f0' };
  const firstEx = exercises[0];
  const restInfo = firstEx?.restSeconds ? `${firstEx.restSeconds}s rest` : '';
  const setsInfo = firstEx?.sets ? `${firstEx.sets} rounds` : '';
  const roundLabel = [setsInfo, restInfo].filter(Boolean).join(' · ');

  return (
    <Box sx={{
      border: `1px solid ${colors.border}`,
      borderRadius: '8px',
      bgcolor: colors.bg,
      px: 1.5,
      py: 1,
      my: 0.5,
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b' }}>
          Superset {groupLetter}
        </Typography>
        {roundLabel && (
          <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
            {roundLabel}
          </Typography>
        )}
      </Box>
      {exercises.map((ex, i) => (
        <ExerciseRow
          key={ex.id ?? i}
          exercise={ex}
          label={`${groupLetter}${i + 1}`}
        />
      ))}
    </Box>
  );
}
```

- [ ] **Step 4: Create unified PlanDayCard**

```typescript
// dashboard/components/plan/PlanDayCard.tsx
'use client';
import React, { useState } from 'react';
import { Box, Typography, Chip, Collapse, Button, Divider } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import type { PlanItem, PlanExercise } from '@/lib/types';
import SectionHeader from './SectionHeader';
import ExerciseRow from './ExerciseRow';
import SupersetBlock from './SupersetBlock';

interface PlanDayCardProps {
  item: PlanItem;
  exercises: PlanExercise[];
  defaultExpanded?: boolean;
  status: 'draft' | 'published' | 'completed' | 'skipped';
  onStartSession?: () => void;
  onSwapDay?: () => void;
}

const STATUS_CHIPS: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#b45309', bg: '#fef3c7' },
  published: { label: 'Published', color: '#15803d', bg: '#dcfce7' },
  completed: { label: 'Completed', color: '#1d4ed8', bg: '#dbeafe' },
  skipped: { label: 'Skipped', color: '#64748b', bg: '#f1f5f9' },
};

function getSessionChipStyle(sessionType: string) {
  const t = sessionType.toLowerCase();
  if (t.includes('strength') || t.includes('upper') || t.includes('lower') || t.includes('full')) return { bg: '#dbeafe', text: '#1d4ed8' };
  if (t.includes('cardio') || t.includes('interval')) return { bg: '#ffedd5', text: '#c2410c' };
  if (t.includes('recovery') || t.includes('mobility')) return { bg: '#ede9fe', text: '#6d28d9' };
  if (t.includes('ruck') || t.includes('hike')) return { bg: '#ccfbf1', text: '#0f766e' };
  if (t.includes('rest') || t.includes('family')) return { bg: '#f1f5f9', text: '#475569' };
  return { bg: '#f1f5f9', text: '#0f172a' };
}

function isRestOrFamily(item: PlanItem): boolean {
  const t = item.sessionType.toLowerCase();
  return t.includes('rest') || t.includes('family');
}

export default function PlanDayCard({ item, exercises, defaultExpanded = false, status, onStartSession, onSwapDay }: PlanDayCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isRest = isRestOrFamily(item);
  const chipStyle = getSessionChipStyle(item.sessionType);
  const statusChip = STATUS_CHIPS[status];

  // Group exercises by section, then by superset
  const sections = new Map<string, PlanExercise[]>();
  for (const ex of exercises) {
    const group = sections.get(ex.section) ?? [];
    group.push(ex);
    sections.set(ex.section, group);
  }

  const sectionOrder = ['warm_up', 'activation', 'main_work', 'accessory', 'finisher', 'cool_down'];

  function renderExercises(sectionExercises: PlanExercise[]) {
    const rendered: React.ReactNode[] = [];
    const seenGroups = new Set<string>();
    let standaloneIndex = 0;

    for (const ex of sectionExercises) {
      if (ex.supersetGroup && !seenGroups.has(ex.supersetGroup)) {
        seenGroups.add(ex.supersetGroup);
        const grouped = sectionExercises.filter(e => e.supersetGroup === ex.supersetGroup);
        rendered.push(
          <SupersetBlock key={`ss-${ex.supersetGroup}`} groupLetter={ex.supersetGroup} exercises={grouped} />
        );
      } else if (!ex.supersetGroup) {
        const letter = String.fromCharCode(65 + standaloneIndex); // A, B, C...
        standaloneIndex++;
        rendered.push(
          <ExerciseRow key={ex.id ?? ex.exerciseOrder} exercise={ex} label={`${letter}1`} />
        );
      }
    }
    return rendered;
  }

  return (
    <Box sx={{
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      bgcolor: '#fff',
      mb: 1.5,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <Box
        onClick={() => !isRest && setExpanded(!expanded)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5,
          cursor: isRest ? 'default' : 'pointer',
          '&:hover': isRest ? {} : { bgcolor: '#f8fafc' },
        }}
      >
        {!isRest && (expanded ? <KeyboardArrowDownIcon sx={{ color: '#94a3b8' }} /> : <KeyboardArrowRightIcon sx={{ color: '#94a3b8' }} />)}
        <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', minWidth: 40 }}>
          {item.day.slice(0, 3)}
        </Typography>
        <Chip label={item.sessionType.replace(/_/g, ' ')} size="small" sx={{ bgcolor: chipStyle.bg, color: chipStyle.text, fontWeight: 600, fontSize: '0.75rem' }} />
        <Typography sx={{ fontSize: '0.875rem', color: '#334155', flex: 1 }}>{item.focus}</Typography>
        {item.estimatedDurationMin && (
          <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.estimatedDurationMin} min</Typography>
        )}
        <Chip label={statusChip.label} size="small" sx={{ bgcolor: statusChip.bg, color: statusChip.color, fontWeight: 600, fontSize: '0.6875rem' }} />
      </Box>

      {/* Expanded content */}
      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ px: 2, py: 1.5 }}>
          {sectionOrder.map((sectionKey) => {
            const sectionExercises = sections.get(sectionKey);
            if (!sectionExercises?.length) return null;
            return (
              <React.Fragment key={sectionKey}>
                <SectionHeader section={sectionKey} />
                {renderExercises(sectionExercises)}
              </React.Fragment>
            );
          })}

          {item.coachCues && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: '8px' }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', mb: 0.5 }}>Coach Notes</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#334155' }}>{item.coachCues}</Typography>
            </Box>
          )}
        </Box>

        {/* Actions */}
        {(onStartSession || onSwapDay) && (
          <>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 1 }}>
              {onStartSession && <Button size="small" variant="contained" onClick={onStartSession}>Start Session</Button>}
              {onSwapDay && <Button size="small" variant="text" onClick={onSwapDay}>Swap Day</Button>}
            </Box>
          </>
        )}
      </Collapse>
    </Box>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/plan/
git commit -m "feat: add unified PlanDayCard, ExerciseRow, SupersetBlock components"
```

---

## Task 10: Wire Up Plan Page + Checkin Preview

**Files:**
- Modify: `dashboard/app/plan/page.tsx`
- Modify: `dashboard/components/checkin/PlanPreview.tsx`

- [ ] **Step 1: Update Plan page to use PlanDayCard**

Replace `TrainingPlanTable` usage with the new unified `PlanDayCard`. The page should:
1. Fetch `/api/plan` which now returns `{ items, exercises }` 
2. For each item, render `<PlanDayCard item={item} exercises={exercises[item.id]} status="published" />`
3. Keep the briefing/synthesis section but display `synthesis_notes` from plan_items instead of the full markdown blob
4. Remove import of `TrainingPlanTable`

- [ ] **Step 2: Update PlanPreview to use PlanDayCard**

Replace `PlanDayCard` from `checkin/PlanDayCard.tsx` with the unified one from `plan/PlanDayCard.tsx`. The preview should:
1. Import `PlanDayCard` from `@/components/plan/PlanDayCard`
2. Pass `status="draft"` instead of `status="published"`
3. Pass exercises from the checkin state (now structured JSON, not parsed text)
4. Keep the Lock In and Discuss buttons

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/plan/page.tsx dashboard/components/checkin/PlanPreview.tsx
git commit -m "feat: wire up unified PlanDayCard on plan page and checkin preview"
```

---

## Task 11: Update Dialogue for Plan Changes

**Files:**
- Modify: `dashboard/lib/dialogue.ts`
- Modify: `dashboard/app/api/checkin/dialogue/route.ts`

- [ ] **Step 1: Update dialogue system prompt**

In `dashboard/lib/dialogue.ts`, replace the `dialogueInstructions` string:
1. Remove rule 8 about outputting pipe-separated tables
2. Add: "When the athlete requests a plan change, describe the change clearly. The system will route your description to the Plan Builder to produce updated structured data. Do NOT output workout tables or exercise lists."
3. Add: "When the athlete says 'lock it in', respond with 'Locked in.' followed by 'Time to work.' or 'Go get it done.'"

- [ ] **Step 2: Update dialogue route to handle plan changes**

When a dialogue response indicates a plan change (detected by keywords or explicit routing):
1. Extract the change description from the dialogue response
2. Call `runPlanBuilder` with the change as fix instructions
3. Run `validatePlanRules` on the result
4. Update `plan_exercises` rows for affected sessions
5. Send updated plan data to the client

This is a more complex change — the executing agent should read the current dialogue route and modify it to support a `plan_update` event alongside the existing `dialogue_chunk` events.

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/dialogue.ts dashboard/app/api/checkin/dialogue/route.ts
git commit -m "feat: dialogue plan changes route through Plan Builder instead of text tables"
```

---

## Task 12: Week 14 Migration Script

**Files:**
- Create: `dashboard/scripts/migrate-week-14.ts`

- [ ] **Step 1: Create migration script**

```typescript
// dashboard/scripts/migrate-week-14.ts
// Run with: cd dashboard && npx tsx scripts/migrate-week-14.ts

import { getDb } from '../lib/db';
import { runPlanBuilder } from '../lib/plan-builder';
import { validatePlanRules, formatViolationsForFix } from '../lib/plan-validator';
import { persistWeekPlan } from '../lib/plan-db';
import { getTrainingWeek } from '../lib/week';

async function main() {
  const db = getDb();
  const weekNumber = getTrainingWeek();

  console.log(`Migrating Week ${weekNumber} to structured format...`);

  // Step 1: Read existing plan items
  const existingItems = db.prepare(
    'SELECT * FROM plan_items WHERE week_number = ? ORDER BY day_order'
  ).all(weekNumber) as Array<Record<string, unknown>>;

  if (existingItems.length === 0) {
    console.log('No plan items found for this week.');
    return;
  }

  console.log(`Found ${existingItems.length} plan items.`);

  // Step 2: Build context from existing plan text
  const planSummary = existingItems.map((item) => {
    return `${item.day}: ${item.session_type} — ${item.focus}\nWorkout: ${item.workout_plan}\nCues: ${item.coach_cues}`;
  }).join('\n\n');

  const synthesisNotes = 'Migration from text-based plan. Preserve all exercises, weights, and structure from the existing plan.';

  // Step 3: Run Plan Builder
  console.log('Running Plan Builder...');
  let result = await runPlanBuilder(
    `${synthesisNotes}\n\n## Existing Plan to Restructure\n${planSummary}`,
    'Migration context — restructure existing plan into JSON format.',
    weekNumber,
  );

  // Step 4: Validate and retry
  if (result.success) {
    const violations = validatePlanRules(result.data);
    if (violations.length > 0) {
      console.log(`Validator found ${violations.length} violations. Retrying...`);
      const fixInstructions = formatViolationsForFix(violations);
      result = await runPlanBuilder(
        `${synthesisNotes}\n\n## Existing Plan to Restructure\n${planSummary}`,
        'Migration context.',
        weekNumber,
        fixInstructions,
      );
    }
  }

  if (!result.success) {
    console.error('Plan Builder failed:', result.error);
    process.exit(1);
  }

  // Step 5: Delete old plan items and persist new structured data
  console.log('Persisting structured plan...');
  db.prepare('DELETE FROM plan_items WHERE week_number = ?').run(weekNumber);
  const { planItemIds } = persistWeekPlan(result.data);
  console.log(`Created ${planItemIds.length} structured plan items.`);

  // Step 6: Clean session data for this week
  console.log('Cleaning session data for re-entry...');
  const sessionRows = db.prepare(
    'SELECT id FROM session_logs WHERE week_number = ?'
  ).all(weekNumber) as Array<{ id: number }>;

  for (const row of sessionRows) {
    db.prepare('DELETE FROM session_exercise_feedback WHERE session_log_id = ?').run(row.id);
    db.prepare('DELETE FROM session_sets WHERE session_log_id = ?').run(row.id);
    db.prepare('DELETE FROM session_cardio WHERE session_log_id = ?').run(row.id);
  }
  db.prepare('DELETE FROM session_logs WHERE week_number = ?').run(weekNumber);
  console.log(`Cleaned ${sessionRows.length} sessions.`);

  console.log('Migration complete. Re-enter completed sessions through the session page.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run migration**

Run: `cd dashboard && npx tsx scripts/migrate-week-14.ts`
Expected: Structured plan created, old sessions cleaned

- [ ] **Step 3: Commit**

```bash
git add dashboard/scripts/migrate-week-14.ts
git commit -m "feat: add Week 14 migration script (text plan → structured exercises)"
```

---

## Task 13: Cleanup + Head Coach Persona Update

**Files:**
- Modify: `coaches/00_head_coach.md`
- Modify: `dashboard/lib/agents.ts`

- [ ] **Step 1: Trim Head Coach persona**

In `coaches/00_head_coach.md`:
1. Remove all workout formatting instructions (cell format, superset notation, equipment rules, etc.)
2. Keep: identity, coaching philosophy, conflict resolution, mandated phrases, communication rules
3. Add note: "Workout plan structure is handled by the Plan Builder. Your role is synthesis and dialogue."

- [ ] **Step 2: Clean up agents.ts**

In `dashboard/lib/agents.ts`:
1. Remove `buildSynthesisPrompt` function (replaced by synthesis-coach.ts)
2. Remove `streamHeadCoachSynthesis` function (replaced by synthesis-coach.ts)
3. Keep: `buildSharedContext`, `runSpecialistsSequentially`, `getClient`, and all specialist-related code

- [ ] **Step 3: Run full test suite**

Run: `cd dashboard && npx vitest run`
Expected: All tests PASS. Some old tests related to `parseScheduleTable`, `normalizeWorkoutText`, `workout-parser` may need updating if they import removed functions — update imports but keep the test files (they test code still used for archive pages).

- [ ] **Step 4: Commit**

```bash
git add coaches/00_head_coach.md dashboard/lib/agents.ts
git commit -m "refactor: trim Head Coach persona, remove old synthesis prompt builder"
```

---

## Task 14: End-to-End Verification

- [ ] **Step 1: Run full test suite**

Run: `cd dashboard && npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Start dev server and verify plan page**

Run: `cd dashboard && npm run dev`
Navigate to the plan page, verify Week 14 renders with structured exercise cards.

- [ ] **Step 3: Verify session creation**

Click "Start Session" on a plan item. Verify:
- Exercises load with correct names, sets, reps, weights
- Warm-up and cool-down sections are separated
- Coach cues show inline
- Superset grouping is correct

- [ ] **Step 4: Verify archive page**

Navigate to an old week in the archive. Verify it still renders using the legacy text parsers.

- [ ] **Step 5: Deploy to Railway and verify**

Push to main, verify the production deployment works. Test the plan page and session page on mobile.

- [ ] **Step 6: Final commit**

```bash
git commit -m "chore: end-to-end verification complete"
```

---

## Summary

| Task | What it does | Files |
|------|-------------|-------|
| 1 | Zod schemas + types | plan-schema.ts, types.ts |
| 2 | DB migration (plan_exercises table + new columns) | db.ts, plan-db.ts |
| 3 | Plan Builder coach (tool_use) | plan-builder.ts |
| 4 | Plan Validator (business rules) | plan-validator.ts |
| 5 | Synthesis Coach (trimmed output) | synthesis-coach.ts |
| 6 | New checkin pipeline | checkin/route.ts, plan-db.ts |
| 7 | Plan API returns structured data | plan/route.ts |
| 8 | Session creation from structured data | session-db.ts, session/route.ts |
| 9 | Unified PlanDayCard components | components/plan/*.tsx |
| 10 | Wire up plan page + checkin preview | plan/page.tsx, PlanPreview.tsx |
| 11 | Dialogue plan changes via Plan Builder | dialogue.ts, dialogue/route.ts |
| 12 | Week 14 migration script | scripts/migrate-week-14.ts |
| 13 | Cleanup + persona update | 00_head_coach.md, agents.ts |
| 14 | End-to-end verification | — |
