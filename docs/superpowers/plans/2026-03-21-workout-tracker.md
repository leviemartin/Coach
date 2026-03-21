# Workout Tracker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-optimized workout tracker at `/session` that pre-loads prescribed workouts from the training plan, supports strength sets, supersets, and cardio (intervals + steady state), logs actual performance, and flows data to the daily log and check-in pipeline.

**Architecture:** The tracker parses existing workout plan text (letter-number notation like `A1:/B1:` for supersets) into structured exercise data. A new session log schema stores actual vs prescribed performance. The `/session` page is a mobile-first React UI with set-by-set logging. On completion, session data auto-updates the daily log. At check-in, session logs replace the Hevy CSV step. Coach format changes are documented but require athlete approval before implementation — the initial version parses the existing markdown format.

**Tech Stack:** Next.js 15, MUI 6, TypeScript, better-sqlite3, React state management (no external state library)

**Spec:** `docs/superpowers/specs/2026-03-21-dashboard-redesign-design.md` — Section 2

**Plan 2 of 3** — Depends on Plan 1 (design system) for card components and design tokens. Independent of Plan 3 (page refresh).

---

## Important: Coach Format Changes

The spec lists 6 coach format changes. These require athlete approval before implementation. This plan is structured to work in two phases:

**Phase A (Tasks 1-12):** Build the tracker using the EXISTING workout plan format. Parse the current letter-number notation (`A1:`, `B1:/B2:`, sections with `[3 rounds, 90s rest]`) into structured data. This works today without any coach changes.

**Phase B (Tasks 13-14):** After athlete approves coach format changes, update coaches to output structured JSON alongside the markdown table, and update the parser to use it. This is optional — Phase A is fully functional.

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `dashboard/lib/workout-parser.ts` | Parse workout plan text into structured exercises (strength, supersets, cardio) |
| `dashboard/lib/session-db.ts` | Session log CRUD: create/update/complete sessions, read sets, check ceilings |
| `dashboard/lib/exercise-registry.ts` | Canonical exercise name matching and normalization |
| `dashboard/components/tracker/SessionPage.tsx` | Main tracker page orchestrator — loads workout, manages state |
| `dashboard/components/tracker/StrengthExercise.tsx` | Set-by-set logging for strength exercises |
| `dashboard/components/tracker/SupersetBlock.tsx` | Round-based superset logging (A+B paired) |
| `dashboard/components/tracker/CardioIntervals.tsx` | Round grid for interval protocols |
| `dashboard/components/tracker/CardioSteady.tsx` | Duration target + complete button |
| `dashboard/components/tracker/ExerciseList.tsx` | Scrollable exercise list with progress indicators |
| `dashboard/components/tracker/SessionComplete.tsx` | Summary screen: stats, weight changes, ceiling check |
| `dashboard/components/tracker/SessionProgress.tsx` | Top progress bar showing exercises completed |
| `dashboard/app/session/page.tsx` | Next.js page wrapper for `/session` |
| `dashboard/app/api/session/route.ts` | API: GET (load today's session), POST (create/update session log) |
| `dashboard/app/api/session/complete/route.ts` | API: POST (finalize session, update daily log) |
| `dashboard/__tests__/workout-parser.test.ts` | Unit tests for workout text parsing |
| `dashboard/__tests__/session-db.test.ts` | Unit tests for session log CRUD |
| `state/exercise_registry.json` | Canonical exercise names with aliases |

### Modified Files

| File | Changes |
|------|---------|
| `dashboard/lib/db.ts` | Add session_logs, session_sets, session_cardio tables to schema init |
| `dashboard/lib/types.ts` | Add session-related types (ParsedExercise, SessionState, etc.) |
| `dashboard/components/Sidebar.tsx` | Add "Session" nav item (conditional on active session) |

---

## Task 1: Exercise Registry

**Files:**
- Create: `state/exercise_registry.json`

- [ ] **Step 1: Create the exercise registry**

Build the initial registry from exercises that appear in recent training plans. Read `state/current_ceilings.json` to get known exercise names, and add common exercises from the coach personas.

```json
{
  "version": 1,
  "exercises": [
    {
      "canonical": "Pull-Up",
      "aliases": ["Pull-ups", "Pullup", "Pull Up", "Assisted Pull-Up"],
      "type": "strength",
      "tracks_weight": true
    },
    {
      "canonical": "Dead Hang",
      "aliases": ["Deadhang", "Dead-Hang"],
      "type": "strength",
      "tracks_weight": false
    },
    {
      "canonical": "DB Row",
      "aliases": ["Dumbbell Row", "DB Rows", "Dumbbell Rows"],
      "type": "strength",
      "tracks_weight": true
    },
    {
      "canonical": "Lat Pulldown",
      "aliases": ["Cable Lat Pull Down", "Lat Pull Down", "Lat Pull-Down"],
      "type": "strength",
      "tracks_weight": true
    },
    {
      "canonical": "Leg Press",
      "aliases": ["Leg press", "Incline Leg Press"],
      "type": "strength",
      "tracks_weight": true
    },
    {
      "canonical": "Goblet Squat",
      "aliases": ["Goblet Squats", "DB Goblet Squat"],
      "type": "strength",
      "tracks_weight": true
    },
    {
      "canonical": "Face Pull",
      "aliases": ["Face Pulls", "Cable Face Pull"],
      "type": "strength",
      "tracks_weight": true
    },
    {
      "canonical": "Farmer Carry",
      "aliases": ["Farmer Walk", "Farmer's Carry", "Farmer Carries"],
      "type": "carry",
      "tracks_weight": true
    },
    {
      "canonical": "Med Ball Slam",
      "aliases": ["Medicine Ball Slam", "Med Ball Slams", "Ball Slam"],
      "type": "strength",
      "tracks_weight": true
    },
    {
      "canonical": "Push-Up",
      "aliases": ["Push-ups", "Pushup", "Push Up", "Explosive Push-Up"],
      "type": "strength",
      "tracks_weight": false
    },
    {
      "canonical": "Plank",
      "aliases": ["Front Plank", "RKC Plank"],
      "type": "timed",
      "tracks_weight": false
    },
    {
      "canonical": "Pallof Press",
      "aliases": ["Pallof", "Cable Pallof Press"],
      "type": "strength",
      "tracks_weight": true
    },
    {
      "canonical": "Rower Sprint",
      "aliases": ["Rower Sprints", "Rowing Sprint", "Rowing Intervals"],
      "type": "cardio_intervals",
      "tracks_weight": false
    },
    {
      "canonical": "Zone 2 Rower",
      "aliases": ["Rower Zone 2", "Easy Row", "Recovery Row"],
      "type": "cardio_steady",
      "tracks_weight": false
    },
    {
      "canonical": "StairMaster Intervals",
      "aliases": ["StairMaster", "Stair Intervals", "StairMaster Z4"],
      "type": "cardio_intervals",
      "tracks_weight": false
    },
    {
      "canonical": "Sunday Ruck",
      "aliases": ["Ruck", "Weighted Walk", "Vest Walk"],
      "type": "ruck",
      "tracks_weight": false
    }
  ]
}
```

This is a starter set. The Head Coach extends it when introducing new exercises.

- [ ] **Step 2: Commit**

```bash
git add state/exercise_registry.json
git commit -m "feat(tracker): add exercise name registry with canonical names and aliases"
```

---

## Task 2: Session Types + Parsed Exercise Types

**Files:**
- Modify: `dashboard/lib/types.ts`

- [ ] **Step 1: Add tracker types at end of types.ts**

```typescript
// --- Workout Tracker Types ---

export type ExerciseType = 'strength' | 'carry' | 'timed' | 'cardio_intervals' | 'cardio_steady' | 'ruck';

export interface ParsedExercise {
  name: string;
  canonicalName: string;
  type: ExerciseType;
  order: number;
  supersetGroup: number | null; // null = standalone, number = grouped
  sets: number;
  reps: number | null;          // null for timed exercises
  weightKg: number | null;      // null for bodyweight
  durationSeconds: number | null; // for timed holds, cardio
  restSeconds: number | null;
  rounds: number | null;        // for cardio intervals
  targetIntensity: string | null; // '>300W', 'HR 120-135'
  coachCue: string | null;
}

export interface SessionSetState {
  id?: number;                    // DB id, undefined before persistence
  exerciseName: string;
  exerciseOrder: number;
  supersetGroup: number | null;
  setNumber: number;
  prescribedWeightKg: number | null;
  prescribedReps: number | null;
  actualWeightKg: number | null;
  actualReps: number | null;
  completed: boolean;
  isModified: boolean;
}

export interface SessionCardioState {
  id?: number;                    // DB id, undefined before persistence
  exerciseName: string;
  cardioType: 'intervals' | 'steady_state';
  prescribedRounds: number | null;
  completedRounds: number;
  prescribedDurationMin: number | null;
  targetIntensity: string | null;
  completed: boolean;
}

export interface SessionState {
  id: number | null;           // null until persisted
  date: string;
  weekNumber: number;
  sessionType: string;
  sessionTitle: string;
  exercises: ParsedExercise[];
  sets: SessionSetState[];
  cardio: SessionCardioState[];
  startedAt: string | null;
  completedAt: string | null;
  notes: string;
}

export interface RegistryExercise {
  canonical: string;
  aliases: string[];
  type: ExerciseType;
  tracks_weight: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/lib/types.ts
git commit -m "feat(types): add workout tracker types (ParsedExercise, SessionState, etc.)"
```

---

## Task 3: Exercise Registry Loader

**Files:**
- Create: `dashboard/lib/exercise-registry.ts`

- [ ] **Step 1: Create registry module**

```typescript
// dashboard/lib/exercise-registry.ts
import fs from 'fs';
import path from 'path';
import type { RegistryExercise, ExerciseType } from './types';

const REGISTRY_PATH = path.join(process.cwd(), '..', 'state', 'exercise_registry.json');

let cachedRegistry: RegistryExercise[] | null = null;

function loadRegistry(): RegistryExercise[] {
  if (cachedRegistry) return cachedRegistry;
  try {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
    const data = JSON.parse(raw);
    cachedRegistry = data.exercises || [];
    return cachedRegistry!;
  } catch {
    return [];
  }
}

/**
 * Match an exercise name string to its canonical form and type.
 * Uses case-insensitive matching against canonical names and aliases.
 * Returns the canonical name and type, or the original name with 'strength' default.
 */
export function resolveExercise(name: string): { canonical: string; type: ExerciseType } {
  const registry = loadRegistry();
  const lower = name.toLowerCase().trim();

  for (const entry of registry) {
    if (entry.canonical.toLowerCase() === lower) {
      return { canonical: entry.canonical, type: entry.type };
    }
    for (const alias of entry.aliases) {
      if (alias.toLowerCase() === lower) {
        return { canonical: entry.canonical, type: entry.type };
      }
    }
  }

  // Fuzzy: check if the name contains a canonical name
  for (const entry of registry) {
    if (lower.includes(entry.canonical.toLowerCase()) ||
        entry.canonical.toLowerCase().includes(lower)) {
      return { canonical: entry.canonical, type: entry.type };
    }
  }

  return { canonical: name.trim(), type: 'strength' };
}

/** Check if an exercise tracks weight */
export function exerciseTracksWeight(canonicalName: string): boolean {
  const registry = loadRegistry();
  const entry = registry.find((e) => e.canonical === canonicalName);
  return entry?.tracks_weight ?? true;
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/lib/exercise-registry.ts
git commit -m "feat(tracker): add exercise registry loader with canonical name resolution"
```

---

## Task 4: Workout Parser + Tests

**Files:**
- Create: `dashboard/lib/workout-parser.ts`
- Create: `dashboard/__tests__/workout-parser-v2.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// dashboard/__tests__/workout-parser-v2.test.ts
import { describe, it, expect } from 'vitest';
import { parseWorkoutPlan } from '../lib/workout-parser';

describe('parseWorkoutPlan', () => {
  it('parses standalone exercises with weight and reps', () => {
    const text = `A1: Pull-ups 5×3 (assisted -20kg)
B1: Dead Hang 3×30s
C1: DB Rows 3×10 @22.5kg`;
    const result = parseWorkoutPlan(text, 'strength');
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Pull-ups');
    expect(result[0].sets).toBe(5);
    expect(result[0].reps).toBe(3);
    expect(result[0].supersetGroup).toBeNull();
    expect(result[1].name).toBe('Dead Hang');
    expect(result[1].durationSeconds).toBe(30);
    expect(result[2].weightKg).toBe(22.5);
  });

  it('parses supersets (same letter, different number)', () => {
    const text = `A1: Lat Pulldown 3×10 @50kg [3 rounds, 90s rest]
A2: Face Pulls 3×15 @15kg`;
    const result = parseWorkoutPlan(text, 'strength');
    expect(result).toHaveLength(2);
    expect(result[0].supersetGroup).toBe(1);
    expect(result[1].supersetGroup).toBe(1);
    expect(result[0].restSeconds).toBe(90);
  });

  it('parses multiple superset groups', () => {
    const text = `A1: Lat Pulldown 3×10 @50kg
A2: Face Pulls 3×15 @15kg
B1: DB Rows 3×10 @22.5kg
B2: Push-ups 3×12`;
    const result = parseWorkoutPlan(text, 'strength');
    expect(result[0].supersetGroup).toBe(1); // A group
    expect(result[1].supersetGroup).toBe(1);
    expect(result[2].supersetGroup).toBe(2); // B group
    expect(result[3].supersetGroup).toBe(2);
  });

  it('parses cardio intervals', () => {
    const text = `Rower Sprints: 8 rounds, 20s work / 1:40 rest, >300W target. Damper 7-9`;
    const result = parseWorkoutPlan(text, 'cardio_intervals');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('cardio_intervals');
    expect(result[0].rounds).toBe(8);
    expect(result[0].durationSeconds).toBe(20);
    expect(result[0].targetIntensity).toBe('>300W');
  });

  it('parses steady state cardio', () => {
    const text = `Zone 2 Rower: 20 min, HR 120-135`;
    const result = parseWorkoutPlan(text, 'cardio_steady');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('cardio_steady');
    expect(result[0].durationSeconds).toBe(1200);
  });

  it('handles mixed format with warm-up sections', () => {
    const text = `Warm-up:
- 5 min rower easy
- Band pull-aparts 2×15

A1: Lat Pulldown 3×10 @50kg
A2: Face Pulls 3×15 @15kg
B1: DB Rows 3×10 @22.5kg`;
    const result = parseWorkoutPlan(text, 'strength');
    // Should skip warm-up section items and parse main exercises
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.find(e => e.name.includes('Lat Pulldown'))).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run __tests__/workout-parser-v2.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the parser**

```typescript
// dashboard/lib/workout-parser.ts
import { resolveExercise } from './exercise-registry';
import type { ParsedExercise, ExerciseType } from './types';

/**
 * Parse workout plan text (from Head Coach output) into structured exercises.
 *
 * Handles:
 * - Letter-number notation: A1: Exercise 3×10 @50kg
 * - Supersets: same letter = superset group (A1+A2, B1+B2)
 * - Round/rest info: [3 rounds, 90s rest]
 * - Cardio intervals: "8 rounds, 20s work / 1:40 rest, >300W"
 * - Steady state: "20 min, HR 120-135"
 * - Timed holds: "3×30s"
 * - Warm-up/cool-down sections (parsed but marked)
 */
export function parseWorkoutPlan(
  text: string,
  sessionType: string,
): ParsedExercise[] {
  if (!text || !text.trim()) return [];

  // For cardio sessions, use specialized parsers
  if (sessionType === 'cardio_intervals' || sessionType === 'cardio_steady') {
    return parseCardioText(text, sessionType as 'cardio_intervals' | 'cardio_steady');
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const exercises: ParsedExercise[] = [];
  const supersetGroupMap = new Map<string, number>();
  let nextGroupId = 1;
  let order = 0;
  let inWarmup = false;
  let currentRest: number | null = null;

  for (const line of lines) {
    // Detect section headers
    if (/^(warm-up|cool-down|finish)\s*:/i.test(line)) {
      inWarmup = true;
      continue;
    }

    // Reset warmup flag on main exercise labels
    if (/^[A-Z]\d:/i.test(line)) {
      inWarmup = false;
    }

    // Skip warmup items (dash-prefixed)
    if (inWarmup && line.startsWith('-')) continue;

    // Extract rest info from brackets: [3 rounds, 90s rest]
    const restMatch = line.match(/\[.*?(\d+)s?\s*rest.*?\]/i);
    if (restMatch) {
      currentRest = parseInt(restMatch[1]);
    }

    // Parse letter-number labeled exercises: "A1: Exercise 3×10 @50kg"
    const labelMatch = line.match(/^([A-Z])(\d):\s*(.*)/i);
    if (labelMatch) {
      const letter = labelMatch[1].toUpperCase();
      const exerciseText = labelMatch[3];

      // Determine superset group
      let supersetGroup: number | null = null;
      if (supersetGroupMap.has(letter)) {
        supersetGroup = supersetGroupMap.get(letter)!;
      } else {
        // Check if there's another exercise with the same letter
        const hasPartner = lines.some((l) => {
          const m = l.match(/^([A-Z])\d:/i);
          return m && m[1].toUpperCase() === letter && l !== line;
        });
        if (hasPartner) {
          supersetGroup = nextGroupId++;
          supersetGroupMap.set(letter, supersetGroup);
        }
      }

      const parsed = parseExerciseText(exerciseText, order++, supersetGroup, currentRest);
      if (parsed) exercises.push(parsed);
      continue;
    }

    // Parse unlabeled exercises (dash-prefixed main exercises)
    if (line.startsWith('-') && !inWarmup) {
      const exerciseText = line.replace(/^-\s*/, '');
      const parsed = parseExerciseText(exerciseText, order++, null, null);
      if (parsed) exercises.push(parsed);
    }
  }

  return exercises;
}

function parseExerciseText(
  text: string,
  order: number,
  supersetGroup: number | null,
  restSeconds: number | null,
): ParsedExercise | null {
  // Remove bracket annotations
  const clean = text.replace(/\[.*?\]/g, '').trim();
  if (!clean) return null;

  // Extract sets × reps: "3×10", "5x3", "3×30s"
  const setsRepsMatch = clean.match(/(\d+)\s*[×x]\s*(\d+)(s)?/i);
  let sets = setsRepsMatch ? parseInt(setsRepsMatch[1]) : 1;
  let reps: number | null = setsRepsMatch ? parseInt(setsRepsMatch[2]) : null;
  let durationSeconds: number | null = null;

  // If the reps end with 's', it's a timed hold (e.g., 3×30s)
  if (setsRepsMatch && setsRepsMatch[3] === 's') {
    durationSeconds = reps;
    reps = null;
  }

  // Extract weight: "@50kg", "@22.5kg", "(assisted -20kg)"
  const weightMatch = clean.match(/@\s*([\d.]+)\s*kg/i);
  const assistedMatch = clean.match(/assisted\s*-?\s*([\d.]+)\s*kg/i);
  let weightKg: number | null = weightMatch ? parseFloat(weightMatch[1]) : null;
  if (assistedMatch && !weightKg) {
    weightKg = -parseFloat(assistedMatch[1]); // Negative for assisted
  }

  // Extract exercise name (everything before the sets/reps/weight notation)
  let name = clean
    .replace(/\d+\s*[×x]\s*\d+s?/gi, '')  // Remove sets×reps
    .replace(/@\s*[\d.]+\s*kg/gi, '')        // Remove @weight
    .replace(/\(assisted\s*-?\s*[\d.]+\s*kg\)/gi, '') // Remove (assisted)
    .replace(/\(.*?\)/g, '')                  // Remove other parentheticals
    .trim()
    .replace(/\s+/g, ' ');

  if (!name) return null;

  const resolved = resolveExercise(name);

  return {
    name,
    canonicalName: resolved.canonical,
    type: resolved.type,
    order,
    supersetGroup,
    sets,
    reps,
    weightKg,
    durationSeconds,
    restSeconds,
    rounds: null,
    targetIntensity: null,
    coachCue: null,
  };
}

function parseCardioText(
  text: string,
  type: 'cardio_intervals' | 'cardio_steady',
): ParsedExercise[] {
  const resolved = resolveExercise(text.split(':')[0]?.trim() || text.trim());

  if (type === 'cardio_intervals') {
    const roundsMatch = text.match(/(\d+)\s*rounds?/i);
    const workMatch = text.match(/(\d+)s\s*work/i);
    const restMatch = text.match(/([\d:]+)\s*rest/i);
    const intensityMatch = text.match(/(>[<>]?\d+W|HR\s*\d+-\d+)/i);

    let restSeconds: number | null = null;
    if (restMatch) {
      const restStr = restMatch[1];
      if (restStr.includes(':')) {
        const [min, sec] = restStr.split(':').map(Number);
        restSeconds = min * 60 + sec;
      } else {
        restSeconds = parseInt(restStr);
      }
    }

    // Extract coach cue — everything after the structured data
    const coachCue = text.replace(/.*?(?:target|bpm)\s*/i, '').trim() || null;

    return [{
      name: text.split(':')[0]?.trim() || text.trim(),
      canonicalName: resolved.canonical,
      type: 'cardio_intervals',
      order: 0,
      supersetGroup: null,
      sets: 1,
      reps: null,
      weightKg: null,
      durationSeconds: workMatch ? parseInt(workMatch[1]) : null,
      restSeconds,
      rounds: roundsMatch ? parseInt(roundsMatch[1]) : null,
      targetIntensity: intensityMatch ? intensityMatch[1] : null,
      coachCue,
    }];
  }

  // Steady state
  const durationMatch = text.match(/(\d+)\s*min/i);
  const intensityMatch = text.match(/(HR\s*\d+-\d+|Zone\s*\d)/i);

  return [{
    name: text.split(':')[0]?.trim() || text.trim(),
    canonicalName: resolved.canonical,
    type: 'cardio_steady',
    order: 0,
    supersetGroup: null,
    sets: 1,
    reps: null,
    weightKg: null,
    durationSeconds: durationMatch ? parseInt(durationMatch[1]) * 60 : null,
    restSeconds: null,
    rounds: null,
    targetIntensity: intensityMatch ? intensityMatch[1] : null,
    coachCue: null,
  }];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run __tests__/workout-parser-v2.test.ts`
Expected: All PASS (some tests may need iteration on the parser regex)

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/workout-parser.ts dashboard/__tests__/workout-parser-v2.test.ts
git commit -m "feat(tracker): add workout plan parser with superset and cardio support"
```

---

## Task 5: Session Log Database Schema + CRUD

**Files:**
- Modify: `dashboard/lib/db.ts`
- Create: `dashboard/lib/session-db.ts`
- Create: `dashboard/__tests__/session-db.test.ts`

- [ ] **Step 1: Add session tables to db.ts schema init**

In `dashboard/lib/db.ts`, update `SCHEMA_VERSION` to `5` and add after the existing `CREATE TABLE` statements:

```sql
CREATE TABLE IF NOT EXISTS session_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  session_type TEXT NOT NULL,
  session_title TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  notes TEXT,
  compliance_pct REAL,
  UNIQUE(date, session_title)
);

CREATE TABLE IF NOT EXISTS session_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_log_id INTEGER NOT NULL REFERENCES session_logs(id),
  exercise_name TEXT NOT NULL,
  exercise_order INTEGER NOT NULL,
  superset_group INTEGER,
  set_number INTEGER NOT NULL,
  prescribed_weight_kg REAL,
  prescribed_reps INTEGER,
  actual_weight_kg REAL,
  actual_reps INTEGER,
  completed INTEGER NOT NULL DEFAULT 0,
  is_modified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS session_cardio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_log_id INTEGER NOT NULL REFERENCES session_logs(id),
  exercise_name TEXT NOT NULL,
  cardio_type TEXT NOT NULL,
  prescribed_rounds INTEGER,
  completed_rounds INTEGER,
  prescribed_duration_min REAL,
  target_intensity TEXT,
  completed INTEGER NOT NULL DEFAULT 0
);
```

- [ ] **Step 2: Write session-db.ts CRUD functions**

```typescript
// dashboard/lib/session-db.ts
import { getDb } from './db';
import { getTrainingWeek } from './week';
import type { ParsedExercise, SessionSetState, SessionCardioState } from './types';

/** Create a new session log and populate sets/cardio from parsed exercises */
export function createSession(
  date: string,
  sessionType: string,
  sessionTitle: string,
  exercises: ParsedExercise[],
): number {
  const db = getDb();
  const weekNumber = getTrainingWeek();

  const insert = db.prepare(`
    INSERT OR REPLACE INTO session_logs (date, week_number, session_type, session_title, started_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = insert.run(date, weekNumber, sessionType, sessionTitle, new Date().toISOString());
  const sessionId = Number(result.lastInsertRowid);

  // Clear any existing sets/cardio for this session (in case of re-start)
  db.prepare('DELETE FROM session_sets WHERE session_log_id = ?').run(sessionId);
  db.prepare('DELETE FROM session_cardio WHERE session_log_id = ?').run(sessionId);

  const insertSet = db.prepare(`
    INSERT INTO session_sets
    (session_log_id, exercise_name, exercise_order, superset_group, set_number,
     prescribed_weight_kg, prescribed_reps, completed, is_modified)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
  `);

  const insertCardio = db.prepare(`
    INSERT INTO session_cardio
    (session_log_id, exercise_name, cardio_type, prescribed_rounds,
     completed_rounds, prescribed_duration_min, target_intensity, completed)
    VALUES (?, ?, ?, ?, 0, ?, ?, 0)
  `);

  for (const ex of exercises) {
    if (ex.type === 'cardio_intervals' || ex.type === 'cardio_steady') {
      insertCardio.run(
        sessionId,
        ex.canonicalName,
        ex.type === 'cardio_intervals' ? 'intervals' : 'steady_state',
        ex.rounds,
        ex.durationSeconds ? ex.durationSeconds / 60 : null,
        ex.targetIntensity,
      );
    } else {
      for (let s = 1; s <= ex.sets; s++) {
        insertSet.run(
          sessionId,
          ex.canonicalName,
          ex.order,
          ex.supersetGroup,
          s,
          ex.weightKg,
          ex.reps,
        );
      }
    }
  }

  return sessionId;
}

/** Update a single set's actual values */
export function updateSet(
  setId: number,
  actualWeightKg: number | null,
  actualReps: number | null,
  completed: boolean,
): void {
  const db = getDb();
  const set = db.prepare('SELECT prescribed_weight_kg, prescribed_reps FROM session_sets WHERE id = ?').get(setId) as {
    prescribed_weight_kg: number | null;
    prescribed_reps: number | null;
  } | undefined;

  const isModified = set
    ? (actualWeightKg !== set.prescribed_weight_kg || actualReps !== set.prescribed_reps)
    : false;

  db.prepare(`
    UPDATE session_sets
    SET actual_weight_kg = ?, actual_reps = ?, completed = ?, is_modified = ?
    WHERE id = ?
  `).run(actualWeightKg, actualReps, completed ? 1 : 0, isModified ? 1 : 0, setId);
}

/** Update cardio round completion */
export function updateCardioRound(cardioId: number, completedRounds: number, completed: boolean): void {
  const db = getDb();
  db.prepare(`
    UPDATE session_cardio SET completed_rounds = ?, completed = ? WHERE id = ?
  `).run(completedRounds, completed ? 1 : 0, cardioId);
}

/** Get all sets for a session */
export function getSessionSets(sessionId: number): SessionSetState[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, exercise_name, exercise_order, superset_group, set_number,
           prescribed_weight_kg, prescribed_reps, actual_weight_kg, actual_reps,
           completed, is_modified
    FROM session_sets WHERE session_log_id = ? ORDER BY exercise_order, set_number
  `).all(sessionId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: r.id as number,
    exerciseName: r.exercise_name as string,
    exerciseOrder: r.exercise_order as number,
    supersetGroup: r.superset_group as number | null,
    setNumber: r.set_number as number,
    prescribedWeightKg: r.prescribed_weight_kg as number | null,
    prescribedReps: r.prescribed_reps as number | null,
    actualWeightKg: r.actual_weight_kg as number | null,
    actualReps: r.actual_reps as number | null,
    completed: (r.completed as number) === 1,
    isModified: (r.is_modified as number) === 1,
  }));
}

/** Get cardio entries for a session */
export function getSessionCardio(sessionId: number): SessionCardioState[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, exercise_name, cardio_type, prescribed_rounds, completed_rounds,
           prescribed_duration_min, target_intensity, completed
    FROM session_cardio WHERE session_log_id = ? ORDER BY id
  `).all(sessionId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: r.id as number,
    exerciseName: r.exercise_name as string,
    cardioType: r.cardio_type as 'intervals' | 'steady_state',
    prescribedRounds: r.prescribed_rounds as number | null,
    completedRounds: r.completed_rounds as number,
    prescribedDurationMin: r.prescribed_duration_min as number | null,
    targetIntensity: r.target_intensity as string | null,
    completed: (r.completed as number) === 1,
  }));
}

/** Complete a session — calculate compliance and update daily log */
export function completeSession(sessionId: number, notes: string): {
  compliancePct: number;
  weightChanges: Array<{ exercise: string; set: number; from: number | null; to: number | null }>;
} {
  const db = getDb();
  const sets = getSessionSets(sessionId);
  const cardio = getSessionCardio(sessionId);

  // Calculate compliance
  const totalSets = sets.length;
  const completedSets = sets.filter((s) => s.completed).length;
  const totalCardio = cardio.length;
  const completedCardio = cardio.filter((c) => c.completed).length;
  const total = totalSets + totalCardio;
  const done = completedSets + completedCardio;
  const compliancePct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Collect weight changes
  const weightChanges = sets
    .filter((s) => s.isModified && s.actualWeightKg !== s.prescribedWeightKg)
    .map((s) => ({
      exercise: s.exerciseName,
      set: s.setNumber,
      from: s.prescribedWeightKg,
      to: s.actualWeightKg,
    }));

  // Update session log
  db.prepare(`
    UPDATE session_logs SET completed_at = ?, notes = ?, compliance_pct = ? WHERE id = ?
  `).run(new Date().toISOString(), notes, compliancePct, sessionId);

  // Auto-update daily log: mark workout_completed = 1
  const session = db.prepare('SELECT date FROM session_logs WHERE id = ?').get(sessionId) as { date: string } | undefined;
  if (session) {
    db.prepare(`
      UPDATE daily_logs SET workout_completed = 1 WHERE date = ?
    `).run(session.date);
  }

  return { compliancePct, weightChanges };
}

/** Get active (incomplete) session for a date */
export function getActiveSession(date: string): { id: number; sessionTitle: string } | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, session_title FROM session_logs
    WHERE date = ? AND completed_at IS NULL
    ORDER BY started_at DESC LIMIT 1
  `).get(date) as { id: number; session_title: string } | undefined;

  return row ? { id: row.id, sessionTitle: row.session_title } : null;
}

/** Get completed sessions for a week (for check-in) */
export function getWeekSessions(weekNumber: number): Array<{
  date: string;
  sessionTitle: string;
  sessionType: string;
  compliancePct: number | null;
  sets: SessionSetState[];
  cardio: SessionCardioState[];
}> {
  const db = getDb();
  const sessions = db.prepare(`
    SELECT id, date, session_title, session_type, compliance_pct
    FROM session_logs WHERE week_number = ? AND completed_at IS NOT NULL
    ORDER BY date
  `).all(weekNumber) as Array<Record<string, unknown>>;

  return sessions.map((s) => ({
    date: s.date as string,
    sessionTitle: s.session_title as string,
    sessionType: s.session_type as string,
    compliancePct: s.compliance_pct as number | null,
    sets: getSessionSets(s.id as number),
    cardio: getSessionCardio(s.id as number),
  }));
}
```

- [ ] **Step 3: Write basic tests**

```typescript
// dashboard/__tests__/session-db.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createSession, getSessionSets, updateSet, completeSession } from '../lib/session-db';
import type { ParsedExercise } from '../lib/types';

describe('session-db', () => {
  const mockExercises: ParsedExercise[] = [
    {
      name: 'Pull-ups', canonicalName: 'Pull-Up', type: 'strength',
      order: 0, supersetGroup: null, sets: 3, reps: 5, weightKg: null,
      durationSeconds: null, restSeconds: null, rounds: null,
      targetIntensity: null, coachCue: null,
    },
    {
      name: 'DB Rows', canonicalName: 'DB Row', type: 'strength',
      order: 1, supersetGroup: null, sets: 3, reps: 10, weightKg: 22.5,
      durationSeconds: null, restSeconds: null, rounds: null,
      targetIntensity: null, coachCue: null,
    },
  ];

  it('creates a session with sets', () => {
    const id = createSession('2026-03-21', 'strength', 'Upper Body Test', mockExercises);
    expect(id).toBeGreaterThan(0);

    const sets = getSessionSets(id);
    expect(sets).toHaveLength(6); // 3 sets × 2 exercises
    expect(sets[0].exerciseName).toBe('Pull-Up');
    expect(sets[0].prescribedReps).toBe(5);
    expect(sets[3].exerciseName).toBe('DB Row');
    expect(sets[3].prescribedWeightKg).toBe(22.5);
  });

  it('updates a set with actual values', () => {
    const id = createSession('2026-03-22', 'strength', 'Test 2', mockExercises);
    const sets = getSessionSets(id);

    updateSet(sets[3].id!, 20, 10, true);

    const updated = getSessionSets(id);
    expect(updated[3].actualWeightKg).toBe(20);
    expect(updated[3].isModified).toBe(true);
    expect(updated[3].completed).toBe(true);
  });

  it('completes a session and calculates compliance', () => {
    const id = createSession('2026-03-23', 'strength', 'Test 3', mockExercises);
    const sets = getSessionSets(id);

    // Complete 4 of 6 sets
    for (let i = 0; i < 4; i++) {
      updateSet(sets[i].id!, sets[i].prescribedWeightKg, sets[i].prescribedReps, true);
    }

    const result = completeSession(id, 'Good session');
    expect(result.compliancePct).toBe(67); // 4/6 = 66.7 → 67
  });
});
```

- [ ] **Step 4: Run tests**

Run: `cd dashboard && npx vitest run __tests__/session-db.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/db.ts dashboard/lib/session-db.ts dashboard/__tests__/session-db.test.ts
git commit -m "feat(tracker): add session log schema and CRUD with tests"
```

---

## Task 6: Session API Routes

**Files:**
- Create: `dashboard/app/api/session/route.ts`
- Create: `dashboard/app/api/session/complete/route.ts`

- [ ] **Step 1: Create GET/POST session route**

```typescript
// dashboard/app/api/session/route.ts
import { NextResponse } from 'next/server';
import { getPlanItems } from '@/lib/db';
import { getTrainingWeek } from '@/lib/week';
import { parseWorkoutPlan } from '@/lib/workout-parser';
import { createSession, getActiveSession, getSessionSets, getSessionCardio, updateSet, updateCardioRound } from '@/lib/session-db';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** GET: Load today's session (or resume active one) */
export async function GET() {
  const today = new Date().toISOString().split('T')[0];
  const todayName = DAY_NAMES[new Date().getDay()];
  const weekNumber = getTrainingWeek();

  // Check for active session
  const active = getActiveSession(today);
  if (active) {
    const sets = getSessionSets(active.id);
    const cardio = getSessionCardio(active.id);
    return NextResponse.json({
      sessionId: active.id,
      sessionTitle: active.sessionTitle,
      sets,
      cardio,
      resumed: true,
    });
  }

  // Load today's plan item
  const planItems = getPlanItems(weekNumber);
  const todayItem = planItems.find(
    (item) => item.day.toLowerCase() === todayName.toLowerCase(),
  );

  if (!todayItem || !todayItem.workoutPlan) {
    return NextResponse.json({ sessionId: null, message: 'No workout planned for today' });
  }

  // Determine session type from sessionType field
  const sessionTypeLower = todayItem.sessionType.toLowerCase();
  let sessionType = 'strength';
  if (sessionTypeLower.includes('cardio') || sessionTypeLower.includes('aerobic')) {
    sessionType = sessionTypeLower.includes('interval') || sessionTypeLower.includes('anaerobic')
      ? 'cardio_intervals' : 'cardio_steady';
  } else if (sessionTypeLower.includes('ruck')) {
    sessionType = 'ruck';
  } else if (sessionTypeLower.includes('mobility') || sessionTypeLower.includes('recovery')) {
    sessionType = 'mobility';
  }

  // Parse workout plan text into structured exercises
  const exercises = parseWorkoutPlan(todayItem.workoutPlan, sessionType);

  // Create session in DB
  const sessionId = createSession(
    today,
    sessionType,
    todayItem.focus || todayItem.sessionType,
    exercises,
  );

  const sets = getSessionSets(sessionId);
  const cardio = getSessionCardio(sessionId);

  return NextResponse.json({
    sessionId,
    sessionTitle: todayItem.focus || todayItem.sessionType,
    sessionType,
    exercises,
    sets,
    cardio,
    coachCues: todayItem.coachCues || null,
    resumed: false,
  });
}

/** POST: Update a set or cardio round */
export async function POST(request: Request) {
  const body = await request.json();

  if (body.type === 'set') {
    updateSet(body.setId, body.actualWeightKg, body.actualReps, body.completed);
    return NextResponse.json({ success: true });
  }

  if (body.type === 'cardio') {
    updateCardioRound(body.cardioId, body.completedRounds, body.completed);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid update type' }, { status: 400 });
}
```

- [ ] **Step 2: Create session complete route**

```typescript
// dashboard/app/api/session/complete/route.ts
import { NextResponse } from 'next/server';
import { completeSession, getSessionSets } from '@/lib/session-db';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  const { sessionId, notes } = await request.json();

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const result = completeSession(sessionId, notes || '');

  // Check ceilings — compare actual session weights vs current_ceilings.json
  // Informational only — ceiling updates flow through check-in where coaches validate
  let ceilingCheck: string | null = null;
  try {
    const ceilingsPath = path.join(process.cwd(), '..', 'state', 'current_ceilings.json');
    const raw = fs.readFileSync(ceilingsPath, 'utf-8');
    const ceilings = JSON.parse(raw);
    const ceilingEntries: Record<string, number> = ceilings.ceilings || {};

    const sets = getSessionSets(sessionId);
    const newCeilings: string[] = [];

    // Group sets by exercise and find max actual weight per exercise
    const maxByExercise = new Map<string, number>();
    for (const set of sets) {
      if (set.completed && set.actualWeightKg != null && set.actualWeightKg > 0) {
        const current = maxByExercise.get(set.exerciseName) ?? 0;
        if (set.actualWeightKg > current) {
          maxByExercise.set(set.exerciseName, set.actualWeightKg);
        }
      }
    }

    // Compare against current ceilings (case-insensitive key matching)
    for (const [exercise, maxWeight] of maxByExercise) {
      const ceilingKey = Object.keys(ceilingEntries).find(
        (k) => k.toLowerCase().replace(/[_\s-]/g, '') === exercise.toLowerCase().replace(/[_\s-]/g, ''),
      );
      const currentCeiling = ceilingKey ? ceilingEntries[ceilingKey] : null;
      if (currentCeiling != null && maxWeight > currentCeiling) {
        newCeilings.push(`${exercise}: ${currentCeiling}kg → ${maxWeight}kg`);
      }
    }

    ceilingCheck = newCeilings.length > 0
      ? `New ceilings: ${newCeilings.join(', ')}`
      : 'No new ceilings hit today.';
  } catch {
    ceilingCheck = 'Could not check ceilings.';
  }

  return NextResponse.json({
    success: true,
    compliancePct: result.compliancePct,
    weightChanges: result.weightChanges,
    ceilingCheck,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/api/session/route.ts dashboard/app/api/session/complete/route.ts
git commit -m "feat(api): add /api/session routes for workout tracker"
```

---

## Task 7: StrengthExercise Component

**Files:**
- Create: `dashboard/components/tracker/StrengthExercise.tsx`

- [ ] **Step 1: Create strength exercise component**

Mobile-optimized set-by-set logging. Each set shows prescribed weight/reps, tappable fields to adjust, and a "Complete Set" button. Completed sets show green checkmarks. Modified values get amber highlight.

The component receives `sets` (array of SessionSetState for one exercise), `onComplete` callback, and `onUpdateSet` callback. It manages which set is currently active (first uncompleted).

Key UI elements:
- Exercise name + prescribed summary (e.g., "3×10 @ 22.5kg")
- Per-set rows: set number, weight input, reps input, completion state
- Active set has blue border, completed sets have green checkmark
- Modified values show amber background
- "Complete Set N ✓" primary button

Implementation should follow the mockup from the brainstorming session.

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/tracker/StrengthExercise.tsx
git commit -m "feat(tracker): add StrengthExercise component with set-by-set logging"
```

---

## Task 8: SupersetBlock Component

**Files:**
- Create: `dashboard/components/tracker/SupersetBlock.tsx`

- [ ] **Step 1: Create superset component**

Round-based superset logging. Shows Exercise A and Exercise B paired with "then immediately" divider. "Complete Round N (A + B)" button. Purple accent color. Each exercise has independent weight/reps fields per round. Rest time shown in header.

Groups exercises by `supersetGroup` number. A round = one set of each exercise in the group.

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/tracker/SupersetBlock.tsx
git commit -m "feat(tracker): add SupersetBlock component with round-based logging"
```

---

## Task 9: Cardio Components

**Files:**
- Create: `dashboard/components/tracker/CardioIntervals.tsx`
- Create: `dashboard/components/tracker/CardioSteady.tsx`

- [ ] **Step 1: Create CardioIntervals**

Shows protocol specs (work/rest/rounds/target intensity), round grid (tap to complete), orange accent. Coach cue visible.

- [ ] **Step 2: Create CardioSteady**

Shows duration target (large number), HR zone guidance, single "Mark Complete ✓" button. Teal accent. Coach cue visible.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/tracker/CardioIntervals.tsx dashboard/components/tracker/CardioSteady.tsx
git commit -m "feat(tracker): add CardioIntervals and CardioSteady components"
```

---

## Task 10: ExerciseList + SessionProgress + SessionComplete

**Files:**
- Create: `dashboard/components/tracker/ExerciseList.tsx`
- Create: `dashboard/components/tracker/SessionProgress.tsx`
- Create: `dashboard/components/tracker/SessionComplete.tsx`

- [ ] **Step 1: Create ExerciseList**

Scrollable list showing all exercises with progress: completed (green, strikethrough), current (blue border, set progress), pending (gray). Tapping scrolls to that exercise.

- [ ] **Step 2: Create SessionProgress**

Top progress bar: thin horizontal bar showing exercises completed (e.g., 3/6 = 50% fill). Counter text on the right.

- [ ] **Step 3: Create SessionComplete**

Summary screen shown after all exercises done:
- Big green checkmark + "Session Complete" header
- Stats grid: exercises done, sets completed, compliance %
- Weight adjustments card (amber) listing deviations
- Ceiling check card (green) showing ceiling status
- "Done — Log & Close" button (calls /api/session/complete)
- "Add Session Notes" text field

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/tracker/ExerciseList.tsx \
  dashboard/components/tracker/SessionProgress.tsx \
  dashboard/components/tracker/SessionComplete.tsx
git commit -m "feat(tracker): add ExerciseList, SessionProgress, and SessionComplete components"
```

---

## Task 11: SessionPage Orchestrator

**Files:**
- Create: `dashboard/components/tracker/SessionPage.tsx`
- Create: `dashboard/app/session/page.tsx`

- [ ] **Step 1: Create SessionPage orchestrator**

Main component that:
1. Calls `GET /api/session` on mount to load/resume today's workout
2. Manages session state (current exercise index, set states)
3. Renders the right component for each exercise type (StrengthExercise, SupersetBlock, CardioIntervals, CardioSteady)
4. Shows ExerciseList at bottom
5. Shows SessionProgress at top
6. Switches to SessionComplete when all exercises are done
7. Handles "Complete Set" → `POST /api/session` to persist
8. Handles "Done — Log & Close" → `POST /api/session/complete`

Groups exercises by superset_group before rendering. Standalone exercises render as StrengthExercise. Grouped exercises render as SupersetBlock.

- [ ] **Step 2: Create page wrapper**

```typescript
// dashboard/app/session/page.tsx
import SessionPage from '@/components/tracker/SessionPage';

export default function SessionRoute() {
  return <SessionPage />;
}
```

- [ ] **Step 3: Manual smoke test on mobile viewport**

Run: `cd dashboard && npm run dev`
Open `http://localhost:3000/session` in Chrome DevTools mobile view (375px width).
Verify:
- Exercises load from today's plan
- Set completion works
- Weight/reps tappable and editable
- Progress bar updates
- Session complete screen shows after all exercises

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/tracker/SessionPage.tsx dashboard/app/session/page.tsx
git commit -m "feat(tracker): add SessionPage orchestrator and /session route"
```

---

## Task 12: Sidebar + Navigation Integration

**Files:**
- Modify: `dashboard/components/Sidebar.tsx`

- [ ] **Step 1: Add Session nav item**

Read `dashboard/components/Sidebar.tsx`. Add a "Session" item to the `Main` nav section, positioned after "Daily Log":

```typescript
{ label: 'Session', path: '/session', icon: <PlayArrowIcon /> },
```

Import `PlayArrowIcon` from `@mui/icons-material/PlayArrow`.

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/Sidebar.tsx
git commit -m "feat(nav): add Session item to sidebar navigation"
```

---

## Task 13: Check-In Integration — Session Review Step

**Files:**
- Modify: `dashboard/components/CheckInForm.tsx`

- [ ] **Step 1: Read the current CheckInForm**

Read `dashboard/components/CheckInForm.tsx` to understand the 4-step flow.

- [ ] **Step 2: Modify Step 2 (Hevy CSV)**

In the check-in stepper, modify Step 2:
- Check if session logs exist for the current week via `GET /api/session/week?week=N`
- If session data exists: show "Session Review" with a summary of completed sessions, sets, compliance, and weight changes. Include a "Use this data" button.
- If no session data: fall back to the existing Hevy CSV paste textarea (backwards compatible)
- The data from session review replaces what the Hevy CSV would have provided

- [ ] **Step 3: Create week session API**

Create `dashboard/app/api/session/week/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getWeekSessions } from '@/lib/session-db';
import { getTrainingWeek } from '@/lib/week';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = parseInt(searchParams.get('week') || String(getTrainingWeek()));
  const sessions = getWeekSessions(week);
  return NextResponse.json({ sessions });
}
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/CheckInForm.tsx dashboard/app/api/session/week/route.ts
git commit -m "feat(checkin): add Session Review step with fallback to Hevy CSV"
```

---

## Task 14: Coach Format Changes Documentation (Requires Approval)

**Files:**
- Create: `docs/coach-format-changes.md`

This task documents the 6 coach format changes from the spec. These are NOT implemented in this plan — they require explicit athlete approval.

- [ ] **Step 1: Write the documentation**

Create `docs/coach-format-changes.md` listing each change with:
- What changes in the coach output
- Why it's needed
- Which coach files are affected
- Example before/after
- Impact on existing functionality

The 6 changes:
1. Structured workout output (JSON alongside markdown)
2. Consistent exercise naming (use registry)
3. Session type tagging per day
4. Superset grouping tags
5. Cardio protocol specs
6. Check-in accepts session logs

- [ ] **Step 2: Commit**

```bash
git add docs/coach-format-changes.md
git commit -m "docs: coach format changes specification (requires athlete approval)"
```

---

## Task 15: Final Integration Test

- [ ] **Step 1: Run all tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests pass (existing + new parser + session DB tests)

- [ ] **Step 2: Run build**

Run: `cd dashboard && npx next build`
Expected: Build succeeds

- [ ] **Step 3: End-to-end smoke test**

1. Open dashboard → verify "Start Session" is accessible via sidebar
2. Navigate to `/session` → verify workout loads from plan
3. Complete a few sets → verify persistence (refresh page, data survives)
4. Complete all exercises → verify Session Complete screen
5. Tap "Done — Log & Close" → verify daily log shows workout_completed = 1
6. Go to Check-In → verify Step 2 shows "Session Review" with session data
7. Verify Hevy CSV fallback works when no session data exists

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(tracker): integration fixes from end-to-end testing"
```
