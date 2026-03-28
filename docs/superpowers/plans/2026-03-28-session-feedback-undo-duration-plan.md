# Session Feedback, Undo & Duration Editing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-exercise RPE tracking, set-level and session-level undo, and editable durations for time-based exercises to the session tracker.

**Architecture:** New `session_exercise_feedback` table for RPE data, new columns on `session_sets` and `session_cardio` for actual durations. UI changes in existing tracker components. New `/api/session/feedback` endpoint. Session completion delayed client-side for undo toast.

**Tech Stack:** Next.js App Router, MUI, better-sqlite3, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-28-session-feedback-undo-duration-design.md`

---

### Task 1: Database Schema — New Table & Columns

**Files:**
- Modify: `dashboard/lib/db.ts` (add migration block after existing migrations ~line 250+)
- Modify: `dashboard/lib/types.ts` (add new types, extend existing interfaces)

- [ ] **Step 1: Add types to `dashboard/lib/types.ts`**

Add `ExerciseFeedback` interface and extend `SessionSetState` and `SessionCardioState`:

```typescript
// After SessionCardioState interface (~line 458), add:

export interface ExerciseFeedback {
  id?: number;
  sessionLogId: number;
  exerciseName: string;
  exerciseOrder: number;
  rpe: number; // 1-5
  createdAt?: string;
}
```

Extend `SessionSetState` — add after the `isModified` field:

```typescript
  prescribedDurationS: number | null;
  actualDurationS: number | null;
```

Extend `SessionCardioState` — add after the `completed` field:

```typescript
  actualDurationMin: number | null;
```

- [ ] **Step 2: Add database migrations to `dashboard/lib/db.ts`**

After the last existing migration block (around line 250+), add:

```typescript
  // Migration: session_exercise_feedback table
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_exercise_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_log_id INTEGER NOT NULL REFERENCES session_logs(id),
      exercise_name TEXT NOT NULL,
      exercise_order INTEGER NOT NULL,
      rpe INTEGER CHECK (rpe BETWEEN 1 AND 5),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(session_log_id, exercise_name)
    )
  `);

  // Migration: actual_duration_s on session_sets
  try {
    db.exec(`ALTER TABLE session_sets ADD COLUMN prescribed_duration_s INTEGER`);
  } catch {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE session_sets ADD COLUMN actual_duration_s INTEGER`);
  } catch {
    // Column already exists
  }

  // Migration: actual_duration_min on session_cardio
  try {
    db.exec(`ALTER TABLE session_cardio ADD COLUMN actual_duration_min REAL`);
  } catch {
    // Column already exists
  }
```

- [ ] **Step 3: Verify the app starts without errors**

Run: `cd dashboard && npm run dev`
Expected: App compiles and starts. Check browser console for no DB errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/db.ts dashboard/lib/types.ts
git commit -m "feat(session): add schema for exercise feedback, duration actuals"
```

---

### Task 2: Session DB — Feedback & Duration Functions

**Files:**
- Modify: `dashboard/lib/session-db.ts` (add functions, update existing ones)

- [ ] **Step 1: Update `createSession` to store `prescribed_duration_s`**

In `createSession()`, the `insertSet` prepared statement (line 37-42) needs the new column. Replace:

```typescript
  const insertSet = db.prepare(`
    INSERT INTO session_sets
    (session_log_id, exercise_name, exercise_order, superset_group, set_number,
     prescribed_weight_kg, prescribed_reps, completed, is_modified)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
  `);
```

With:

```typescript
  const insertSet = db.prepare(`
    INSERT INTO session_sets
    (session_log_id, exercise_name, exercise_order, superset_group, set_number,
     prescribed_weight_kg, prescribed_reps, prescribed_duration_s, completed, is_modified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
  `);
```

And update the `insertSet.run()` call (line 63-70) to include `durationSeconds`:

```typescript
      for (let s = 1; s <= ex.sets; s++) {
        insertSet.run(
          sessionId,
          ex.canonicalName,
          ex.order,
          ex.supersetGroup,
          s,
          ex.weightKg,
          ex.reps,
          ex.durationSeconds,
        );
      }
```

- [ ] **Step 2: Update `updateSet` to accept `actualDurationS`**

Replace the `updateSet` function (lines 79-101):

```typescript
export function updateSet(
  setId: number,
  actualWeightKg: number | null,
  actualReps: number | null,
  completed: boolean,
  actualDurationS?: number | null,
  _db?: Database.Database,
): void {
  const db = _db ?? getDb();
  const set = db.prepare('SELECT prescribed_weight_kg, prescribed_reps FROM session_sets WHERE id = ?').get(setId) as {
    prescribed_weight_kg: number | null;
    prescribed_reps: number | null;
  } | undefined;

  const isModified = set
    ? (actualWeightKg !== set.prescribed_weight_kg || actualReps !== set.prescribed_reps)
    : false;

  db.prepare(`
    UPDATE session_sets
    SET actual_weight_kg = ?, actual_reps = ?, completed = ?, is_modified = ?, actual_duration_s = ?
    WHERE id = ?
  `).run(actualWeightKg, actualReps, completed ? 1 : 0, isModified ? 1 : 0, actualDurationS ?? null, setId);
}
```

- [ ] **Step 3: Update `updateCardioRound` to accept `actualDurationMin`**

Replace the `updateCardioRound` function (lines 103-108):

```typescript
export function updateCardioRound(
  cardioId: number,
  completedRounds: number,
  completed: boolean,
  actualDurationMin?: number | null,
  _db?: Database.Database,
): void {
  const db = _db ?? getDb();
  db.prepare(`
    UPDATE session_cardio SET completed_rounds = ?, completed = ?, actual_duration_min = ? WHERE id = ?
  `).run(completedRounds, completed ? 1 : 0, actualDurationMin ?? null, cardioId);
}
```

- [ ] **Step 4: Update `getSessionSets` to return duration fields**

In `getSessionSets` (line 110-132), update the SELECT and mapping:

Replace the query:

```typescript
  const rows = db.prepare(`
    SELECT id, exercise_name, exercise_order, superset_group, set_number,
           prescribed_weight_kg, prescribed_reps, actual_weight_kg, actual_reps,
           completed, is_modified
    FROM session_sets WHERE session_log_id = ? ORDER BY exercise_order, set_number
  `).all(sessionId) as Array<Record<string, unknown>>;
```

With:

```typescript
  const rows = db.prepare(`
    SELECT id, exercise_name, exercise_order, superset_group, set_number,
           prescribed_weight_kg, prescribed_reps, actual_weight_kg, actual_reps,
           completed, is_modified, prescribed_duration_s, actual_duration_s
    FROM session_sets WHERE session_log_id = ? ORDER BY exercise_order, set_number
  `).all(sessionId) as Array<Record<string, unknown>>;
```

Add to the return mapping:

```typescript
    prescribedDurationS: r.prescribed_duration_s as number | null,
    actualDurationS: r.actual_duration_s as number | null,
```

- [ ] **Step 5: Update `getSessionCardio` to return `actualDurationMin`**

In `getSessionCardio` (line 134-152), update the SELECT:

```typescript
  const rows = db.prepare(`
    SELECT id, exercise_name, cardio_type, prescribed_rounds, completed_rounds,
           prescribed_duration_min, target_intensity, completed, actual_duration_min
    FROM session_cardio WHERE session_log_id = ? ORDER BY id
  `).all(sessionId) as Array<Record<string, unknown>>;
```

Add to the return mapping:

```typescript
    actualDurationMin: r.actual_duration_min as number | null,
```

- [ ] **Step 6: Add feedback CRUD functions**

Add at the end of `session-db.ts`:

```typescript
export function upsertExerciseFeedback(
  sessionLogId: number,
  exerciseName: string,
  exerciseOrder: number,
  rpe: number,
  _db?: Database.Database,
): void {
  const db = _db ?? getDb();
  db.prepare(`
    INSERT INTO session_exercise_feedback (session_log_id, exercise_name, exercise_order, rpe, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(session_log_id, exercise_name) DO UPDATE SET rpe = ?, created_at = datetime('now')
  `).run(sessionLogId, exerciseName, exerciseOrder, rpe, rpe);
}

export function getExerciseFeedback(sessionLogId: number, _db?: Database.Database): ExerciseFeedback[] {
  const db = _db ?? getDb();
  const rows = db.prepare(`
    SELECT id, session_log_id, exercise_name, exercise_order, rpe, created_at
    FROM session_exercise_feedback WHERE session_log_id = ? ORDER BY exercise_order
  `).all(sessionLogId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: r.id as number,
    sessionLogId: r.session_log_id as number,
    exerciseName: r.exercise_name as string,
    exerciseOrder: r.exercise_order as number,
    rpe: r.rpe as number,
    createdAt: r.created_at as string,
  }));
}
```

Also add the import for `ExerciseFeedback` at the top of the file:

```typescript
import type { ParsedExercise, SessionSetState, SessionCardioState, ExerciseFeedback } from './types';
```

- [ ] **Step 7: Update `deleteSession` to clean up feedback**

In `deleteSession` (line 326-331), add a line to delete feedback rows:

```typescript
export function deleteSession(sessionId: number): void {
  const db = getDb();
  db.prepare('DELETE FROM session_exercise_feedback WHERE session_log_id = ?').run(sessionId);
  db.prepare('DELETE FROM session_sets WHERE session_log_id = ?').run(sessionId);
  db.prepare('DELETE FROM session_cardio WHERE session_log_id = ?').run(sessionId);
  db.prepare('DELETE FROM session_logs WHERE id = ?').run(sessionId);
}
```

- [ ] **Step 8: Verify app still compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 9: Commit**

```bash
git add dashboard/lib/session-db.ts
git commit -m "feat(session): add feedback CRUD, duration actuals to set/cardio updates"
```

---

### Task 3: API Routes — Feedback Endpoint & Duration Params

**Files:**
- Create: `dashboard/app/api/session/feedback/route.ts`
- Modify: `dashboard/app/api/session/route.ts`

- [ ] **Step 1: Create feedback API route**

Create `dashboard/app/api/session/feedback/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { upsertExerciseFeedback, getExerciseFeedback } from '@/lib/session-db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionLogId = searchParams.get('sessionLogId');

  if (!sessionLogId) {
    return NextResponse.json({ error: 'sessionLogId required' }, { status: 400 });
  }

  const feedback = getExerciseFeedback(parseInt(sessionLogId));
  return NextResponse.json({ feedback });
}

export async function POST(request: Request) {
  const { sessionLogId, exerciseName, exerciseOrder, rpe } = await request.json();

  if (!sessionLogId || !exerciseName || rpe == null) {
    return NextResponse.json({ error: 'sessionLogId, exerciseName, and rpe required' }, { status: 400 });
  }

  if (rpe < 1 || rpe > 5) {
    return NextResponse.json({ error: 'rpe must be between 1 and 5' }, { status: 400 });
  }

  upsertExerciseFeedback(sessionLogId, exerciseName, exerciseOrder ?? 0, rpe);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Update session POST to accept duration fields**

In `dashboard/app/api/session/route.ts`, update the POST handler (line 155-169):

```typescript
export async function POST(request: Request) {
  const body = await request.json();

  if (body.type === 'set') {
    updateSet(body.setId, body.actualWeightKg, body.actualReps, body.completed, body.actualDurationS);
    return NextResponse.json({ success: true });
  }

  if (body.type === 'cardio') {
    updateCardioRound(body.cardioId, body.completedRounds, body.completed, body.actualDurationMin);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid update type' }, { status: 400 });
}
```

- [ ] **Step 3: Update session GET to return feedback on resume**

In `dashboard/app/api/session/route.ts`, add import at top:

```typescript
import { createSession, getActiveSession, getSessionSets, getSessionCardio, getExerciseFeedback, updateSet, updateCardioRound, deleteSession } from '@/lib/session-db';
```

Update `buildSessionResponse` to include feedback:

```typescript
function buildSessionResponse(
  planItem: PlanItem,
  sessionId: number,
  sets: ReturnType<typeof getSessionSets>,
  cardio: ReturnType<typeof getSessionCardio>,
  resumed: boolean,
) {
  const sessionType = deriveSessionType(planItem.sessionType);
  const exercises = planItem.workoutPlan
    ? parseWorkoutPlan(planItem.workoutPlan, sessionType)
    : [];

  const feedback = getExerciseFeedback(sessionId);

  return NextResponse.json({
    sessionId,
    sessionTitle: planItem.focus || planItem.sessionType,
    sessionType,
    exercises,
    sets,
    cardio,
    feedback,
    coachCues: planItem.coachCues || null,
    workoutDescription: planItem.workoutPlan || null,
    resumed,
  });
}
```

- [ ] **Step 4: Verify app compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/api/session/feedback/route.ts dashboard/app/api/session/route.ts
git commit -m "feat(session): feedback API route, duration params in set/cardio updates"
```

---

### Task 4: UI — Set-Level Undo & Editable Duration in StrengthExercise

**Files:**
- Modify: `dashboard/components/tracker/StrengthExercise.tsx`

- [ ] **Step 1: Add duration to edits state and props**

Replace the component props and edit state handling:

```typescript
interface StrengthExerciseProps {
  exerciseName: string;
  sets: SessionSetState[];
  durationSeconds?: number | null;
  isCurrent?: boolean;
  onUpdateSet: (setId: number, actualWeightKg: number | null, actualReps: number | null, completed: boolean, actualDurationS?: number | null) => void;
}

export default function StrengthExercise({ exerciseName, sets, durationSeconds, isCurrent = false, onUpdateSet }: StrengthExerciseProps) {
  // Track local edits before completing
  const [edits, setEdits] = useState<Record<number, { weight: string; reps: string; duration: string }>>({});

  const getEdit = (set: SessionSetState) => {
    if (edits[set.id!]) return edits[set.id!];
    return {
      weight: set.actualWeightKg?.toString() ?? set.prescribedWeightKg?.toString() ?? '',
      reps: set.actualReps?.toString() ?? set.prescribedReps?.toString() ?? '',
      duration: set.actualDurationS?.toString() ?? set.prescribedDurationS?.toString() ?? durationSeconds?.toString() ?? '',
    };
  };

  const updateEdit = (setId: number, field: 'weight' | 'reps' | 'duration', value: string) => {
    setEdits((prev) => ({
      ...prev,
      [setId]: { ...getEditById(setId), [field]: value },
    }));
  };

  const getEditById = (setId: number) => {
    const set = sets.find((s) => s.id === setId);
    if (!set) return { weight: '', reps: '', duration: '' };
    return getEdit(set);
  };

  const handleComplete = (set: SessionSetState) => {
    const edit = getEdit(set);
    const weight = edit.weight ? parseFloat(edit.weight) : null;
    const reps = edit.reps ? parseInt(edit.reps) : null;
    const dur = edit.duration ? parseInt(edit.duration) : null;
    const hasDuration = durationSeconds != null || set.prescribedDurationS != null;
    onUpdateSet(set.id!, weight, reps, !set.completed, hasDuration ? dur : undefined);
  };
```

- [ ] **Step 2: Update the completed set row to be tappable for undo**

In the render section, replace the completed branch (lines 100-111). The completed set should be tappable to toggle back:

```typescript
                {set.completed ? (
                  // Completed: tappable to undo
                  <Box
                    onClick={() => handleComplete(set)}
                    sx={{ display: 'flex', alignItems: 'center', flex: 1, cursor: 'pointer' }}
                  >
                    <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
                      {set.actualWeightKg != null && `${set.actualWeightKg}kg`}
                      {set.actualWeightKg != null && set.actualReps != null && ' × '}
                      {set.actualReps != null && `${set.actualReps} reps`}
                      {set.actualWeightKg == null && set.actualReps == null && (set.actualDurationS ?? durationSeconds) != null && `${set.actualDurationS ?? durationSeconds}s ✓`}
                      {set.actualWeightKg == null && set.actualReps == null && (set.actualDurationS ?? durationSeconds) == null && '✓'}
                    </Typography>
                    <CheckCircleIcon sx={{ color: semanticColors.recovery.good, fontSize: 20 }} />
                  </Box>
                ) : (
```

- [ ] **Step 3: Add editable duration field for time-based exercises**

Replace the duration-only display (lines 115-118) with an editable field:

```typescript
                    {!hasWeight && !hasReps && (durationSeconds != null || set.prescribedDurationS != null) && (
                      <>
                        <TextField
                          size="small"
                          value={edit.duration}
                          onChange={(e) => updateEdit(set.id!, 'duration', e.target.value)}
                          placeholder={set.prescribedDurationS?.toString() ?? durationSeconds?.toString() ?? '—'}
                          inputProps={{ inputMode: 'numeric', style: { textAlign: 'center', padding: '6px 8px' } }}
                          sx={{ width: 56, '& .MuiOutlinedInput-root': { borderRadius: '6px' } }}
                        />
                        <Typography variant="caption" color="text.secondary">s</Typography>
                      </>
                    )}
```

- [ ] **Step 4: Verify the component renders correctly**

Run: `cd dashboard && npm run dev`
Navigate to a session with a time-based exercise and a strength exercise. Verify:
- Duration field is editable for holds/hangs
- Tapping a completed set toggles it back to incomplete with values preserved
- Complete button still works

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/tracker/StrengthExercise.tsx
git commit -m "feat(session): set-level undo toggle, editable duration field"
```

---

### Task 5: UI — Per-Exercise RPE Component

**Files:**
- Create: `dashboard/components/tracker/ExerciseRpe.tsx`

- [ ] **Step 1: Create the RPE selector component**

```typescript
'use client';

import { Box, Typography } from '@mui/material';
import { semanticColors } from '@/lib/design-tokens';

const RPE_OPTIONS = [
  { value: 1, label: 'Too Easy' },
  { value: 2, label: 'Easy' },
  { value: 3, label: 'Right' },
  { value: 4, label: 'Hard' },
  { value: 5, label: 'Too Hard' },
] as const;

interface ExerciseRpeProps {
  selectedRpe: number | null;
  onSelect: (rpe: number) => void;
}

export default function ExerciseRpe({ selectedRpe, onSelect }: ExerciseRpeProps) {
  return (
    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.75}>
        How did this feel?
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {RPE_OPTIONS.map((opt) => {
          const isSelected = selectedRpe === opt.value;
          const color =
            opt.value <= 2 ? semanticColors.recovery.good :
            opt.value === 3 ? semanticColors.body :
            semanticColors.recovery.problem;

          return (
            <Box
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              sx={{
                flex: 1,
                py: 0.75,
                borderRadius: '6px',
                textAlign: 'center',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: isSelected ? color : 'divider',
                backgroundColor: isSelected ? `${color}18` : 'transparent',
                transition: 'all 0.15s ease',
                '&:hover': {
                  borderColor: color,
                  backgroundColor: `${color}0a`,
                },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '0.625rem',
                  color: isSelected ? color : 'text.secondary',
                  lineHeight: 1.2,
                }}
              >
                {opt.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/tracker/ExerciseRpe.tsx
git commit -m "feat(session): add ExerciseRpe selector component"
```

---

### Task 6: UI — Wire RPE Into StrengthExercise & SupersetBlock

**Files:**
- Modify: `dashboard/components/tracker/StrengthExercise.tsx`
- Modify: `dashboard/components/tracker/SupersetBlock.tsx`

- [ ] **Step 1: Add RPE props and rendering to StrengthExercise**

Update the interface and component in `StrengthExercise.tsx`:

Add to props interface:

```typescript
interface StrengthExerciseProps {
  exerciseName: string;
  sets: SessionSetState[];
  durationSeconds?: number | null;
  isCurrent?: boolean;
  onUpdateSet: (setId: number, actualWeightKg: number | null, actualReps: number | null, completed: boolean, actualDurationS?: number | null) => void;
  rpe?: number | null;
  onRpeSelect?: (exerciseName: string, rpe: number) => void;
}
```

Update the destructuring:

```typescript
export default function StrengthExercise({ exerciseName, sets, durationSeconds, isCurrent = false, onUpdateSet, rpe, onRpeSelect }: StrengthExerciseProps) {
```

Add import at top:

```typescript
import ExerciseRpe from './ExerciseRpe';
```

After the `</Stack>` that closes the sets list (before `</CardContent>`), add:

```typescript
        {/* RPE selector — shows when all sets for this exercise are complete */}
        {sets.length > 0 && sets.every((s) => s.completed) && onRpeSelect && (
          <ExerciseRpe
            selectedRpe={rpe ?? null}
            onSelect={(value) => onRpeSelect(exerciseName, value)}
          />
        )}
```

- [ ] **Step 2: Update SupersetBlock to pass RPE props through**

Update `SupersetBlock.tsx` interface:

```typescript
interface SupersetExercise {
  name: string;
  sets: SessionSetState[];
  durationSeconds?: number | null;
  rpe?: number | null;
}

interface SupersetBlockProps {
  groupName: string;
  exercises: SupersetExercise[];
  restSeconds: number | null;
  onUpdateSet: (setId: number, actualWeightKg: number | null, actualReps: number | null, completed: boolean, actualDurationS?: number | null) => void;
  onRpeSelect?: (exerciseName: string, rpe: number) => void;
}
```

Update destructuring:

```typescript
export default function SupersetBlock({ groupName, exercises, restSeconds, onUpdateSet, onRpeSelect }: SupersetBlockProps) {
```

Pass the new props through to `StrengthExercise` (in the render loop):

```typescript
            <StrengthExercise
              exerciseName={ex.name}
              sets={ex.sets}
              durationSeconds={ex.durationSeconds}
              onUpdateSet={onUpdateSet}
              rpe={ex.rpe}
              onRpeSelect={onRpeSelect}
            />
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/tracker/StrengthExercise.tsx dashboard/components/tracker/SupersetBlock.tsx
git commit -m "feat(session): wire RPE selector into exercise and superset components"
```

---

### Task 7: UI — Wire RPE & Duration Into SessionPage

**Files:**
- Modify: `dashboard/components/tracker/SessionPage.tsx`

- [ ] **Step 1: Add feedback state and types to SessionPage**

Add to the `SessionData` interface:

```typescript
interface SessionData {
  sessionId: number | null;
  sessionTitle: string;
  sessionType: string;
  exercises: ParsedExercise[];
  sets: SessionSetState[];
  cardio: SessionCardioState[];
  feedback: Array<{ exerciseName: string; exerciseOrder: number; rpe: number }>;
  coachCues: string | null;
  workoutDescription: string | null;
  resumed: boolean;
}
```

Add RPE state after the existing state declarations:

```typescript
  const [rpeFeedback, setRpeFeedback] = useState<Record<string, number>>({});
```

Initialize RPE state from loaded session data. In the `loadSession` function, after `setSession(data)`:

```typescript
        // Restore saved RPE feedback
        if (data.feedback?.length) {
          const rpeMap: Record<string, number> = {};
          for (const f of data.feedback) {
            rpeMap[f.exerciseName] = f.rpe;
          }
          setRpeFeedback(rpeMap);
        }
```

- [ ] **Step 2: Add RPE submit handler**

After `handleUpdateCardio`, add:

```typescript
  // ── Save per-exercise RPE ──────────────────────────────────────────────────
  const handleRpeSelect = useCallback(
    async (exerciseName: string, rpe: number) => {
      if (!session?.sessionId) return;

      setRpeFeedback((prev) => ({ ...prev, [exerciseName]: rpe }));

      const exercise = session.exercises.find((e) => e.canonicalName === exerciseName || e.name === exerciseName);

      try {
        await fetch('/api/session/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionLogId: session.sessionId,
            exerciseName,
            exerciseOrder: exercise?.order ?? 0,
            rpe,
          }),
        });
      } catch (err) {
        console.error('Failed to save RPE:', err);
      }
    },
    [session],
  );
```

- [ ] **Step 3: Update `handleUpdateSet` to pass duration**

Replace the `handleUpdateSet` signature and body:

```typescript
  const handleUpdateSet = useCallback(
    async (
      setId: number,
      actualWeightKg: number | null,
      actualReps: number | null,
      completed: boolean,
      actualDurationS?: number | null,
    ) => {
      if (!session) return;

      // Optimistic update
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sets: prev.sets.map((s) =>
            s.id === setId
              ? { ...s, actualWeightKg, actualReps, completed, actualDurationS: actualDurationS ?? s.actualDurationS }
              : s,
          ),
        };
      });

      try {
        await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'set', setId, actualWeightKg, actualReps, completed, actualDurationS }),
        });
      } catch (err) {
        console.error('Failed to persist set update:', err);
      }
    },
    [session],
  );
```

- [ ] **Step 4: Update `renderBlock` to pass RPE props**

In `renderBlock`, for single strength exercises, update the `StrengthExercise` render:

```typescript
      // Strength / bodyweight
      const exSets = session.sets.filter((s) => s.exerciseName === ex.canonicalName);
      return (
        <StrengthExercise
          key={ex.name}
          exerciseName={ex.name}
          sets={exSets}
          durationSeconds={ex.durationSeconds}
          isCurrent
          onUpdateSet={handleUpdateSet}
          rpe={rpeFeedback[ex.canonicalName] ?? null}
          onRpeSelect={(name, rpe) => handleRpeSelect(ex.canonicalName, rpe)}
        />
      );
```

For superset blocks, update the `supersetExercises` mapping and `SupersetBlock` render:

```typescript
    const supersetExercises = block.exercises.map((ex) => ({
      name: ex.name,
      sets: session.sets.filter((s) => s.exerciseName === ex.canonicalName),
      durationSeconds: ex.durationSeconds,
      rpe: rpeFeedback[ex.canonicalName] ?? null,
    }));

    return (
      <SupersetBlock
        key={`superset-${block.groupId}`}
        groupName={String(block.groupId)}
        exercises={supersetExercises}
        restSeconds={restSeconds}
        onUpdateSet={handleUpdateSet}
        onRpeSelect={(name, rpe) => {
          const ex = block.exercises.find((e) => e.name === name);
          handleRpeSelect(ex?.canonicalName ?? name, rpe);
        }}
      />
    );
```

- [ ] **Step 5: Verify end-to-end flow**

Run: `cd dashboard && npm run dev`
Start a session, complete all sets for an exercise, verify:
- RPE selector appears below completed exercise
- Tapping an RPE value highlights it
- Resuming the session (navigate away and back) restores RPE selections
- Set undo (tap completed set) toggles it back

- [ ] **Step 6: Commit**

```bash
git add dashboard/components/tracker/SessionPage.tsx
git commit -m "feat(session): wire RPE feedback and duration actuals into session page"
```

---

### Task 8: UI — Editable Duration for Cardio Components

**Files:**
- Modify: `dashboard/components/tracker/CardioSteady.tsx`
- Modify: `dashboard/components/tracker/CardioIntervals.tsx`

- [ ] **Step 1: Add editable duration to CardioSteady**

Update `CardioSteadyProps`:

```typescript
interface CardioSteadyProps {
  exerciseName: string;
  cardio: SessionCardioState;
  coachCue: string | null;
  workoutDescription?: string | null;
  onUpdateCardio: (cardioId: number, completedRounds: number, completed: boolean, actualDurationMin?: number | null) => void;
}
```

Add state and imports at the top of the component:

```typescript
import { useState } from 'react';
import { Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
```

Inside the component, before `handleToggle`:

```typescript
  const [editDuration, setEditDuration] = useState(
    cardio.actualDurationMin?.toString() ?? cardio.prescribedDurationMin?.toString() ?? ''
  );
```

Update `handleToggle`:

```typescript
  const handleToggle = () => {
    const dur = editDuration ? parseFloat(editDuration) : null;
    if (cardio.completed) {
      onUpdateCardio(cardio.id!, 0, false, dur);
    } else {
      onUpdateCardio(cardio.id!, 1, true, dur);
    }
  };
```

Replace the duration display block (the `{durationMin != null && (...)}` section, lines 57-70) with an editable version:

```typescript
        {durationMin != null && (
          <Box sx={{ mt: 1, mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              {cardio.completed ? (
                <Typography sx={{ ...typography.heroNumber, lineHeight: 1 }}>
                  {editDuration || formatDuration(durationMin)}
                </Typography>
              ) : (
                <TextField
                  size="small"
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  placeholder={durationMin.toString()}
                  inputProps={{ inputMode: 'decimal', style: { textAlign: 'center', padding: '8px 12px', fontSize: '2rem', fontWeight: 800 } }}
                  sx={{ width: 100, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                />
              )}
              {(cardio.completed ? parseFloat(editDuration || '0') : durationMin) < 60 && (
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 600, color: 'text.secondary' }}>
                  min
                </Typography>
              )}
            </Box>
          </Box>
        )}
```

- [ ] **Step 2: Update CardioIntervals `onUpdateCardio` prop**

Update `CardioIntervalsProps`:

```typescript
interface CardioIntervalsProps {
  exerciseName: string;
  cardio: SessionCardioState;
  coachCue: string | null;
  onUpdateCardio: (cardioId: number, completedRounds: number, completed: boolean, actualDurationMin?: number | null) => void;
}
```

No other changes needed for CardioIntervals — it tracks rounds, not duration. The prop type just needs to match the updated signature.

- [ ] **Step 3: Update `handleUpdateCardio` in SessionPage to pass duration**

In `SessionPage.tsx`, update `handleUpdateCardio`:

```typescript
  const handleUpdateCardio = useCallback(
    async (cardioId: number, completedRounds: number, completed: boolean, actualDurationMin?: number | null) => {
      if (!session) return;

      // Optimistic update
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          cardio: prev.cardio.map((c) =>
            c.id === cardioId
              ? { ...c, completedRounds, completed, actualDurationMin: actualDurationMin ?? c.actualDurationMin }
              : c,
          ),
        };
      });

      try {
        await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'cardio', cardioId, completedRounds, completed, actualDurationMin }),
        });
      } catch (err) {
        console.error('Failed to persist cardio update:', err);
      }
    },
    [session],
  );
```

- [ ] **Step 4: Verify cardio duration editing works**

Run: `cd dashboard && npm run dev`
Navigate to a session with cardio. Verify:
- Duration field is editable (shows minutes)
- Value persists on completion
- Steady-state toggle (undo) works

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/tracker/CardioSteady.tsx dashboard/components/tracker/CardioIntervals.tsx dashboard/components/tracker/SessionPage.tsx
git commit -m "feat(session): editable duration for cardio components"
```

---

### Task 9: UI — Session-Level Undo Toast

**Files:**
- Modify: `dashboard/components/tracker/SessionComplete.tsx`
- Modify: `dashboard/components/tracker/SessionPage.tsx`

- [ ] **Step 1: Add undo toast to SessionComplete**

Update `SessionCompleteProps` and the component:

```typescript
interface SessionCompleteProps {
  compliancePct: number | null;
  weightChanges: WeightChange[];
  ceilingCheck: string | null;
  setsCompleted: number;
  exercisesCompleted: number;
  onClose: (notes: string) => void;
  onUndo?: () => void;
}
```

Add `Snackbar` to imports:

```typescript
import {
  Box,
  Button,
  Card,
  CardContent,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
```

Add `useRef` and `useEffect` to imports:

```typescript
import { useState, useRef, useEffect } from 'react';
```

Update the component:

```typescript
export default function SessionComplete({
  compliancePct,
  weightChanges,
  ceilingCheck,
  setsCompleted,
  exercisesCompleted,
  onClose,
  onUndo,
}: SessionCompleteProps) {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const handleSubmit = () => {
    setIsSubmitting(true);
    setShowUndoToast(true);

    // Delay the actual completion by 10 seconds
    undoTimerRef.current = setTimeout(() => {
      setShowUndoToast(false);
      onClose(notes);
    }, 10000);
  };

  const handleUndo = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setShowUndoToast(false);
    setIsSubmitting(false);
    onUndo?.();
  };
```

Replace the CTA button:

```typescript
      {/* CTA */}
      <Button
        variant="contained"
        fullWidth
        disabled={isSubmitting}
        onClick={handleSubmit}
        sx={{
          minHeight: 52,
          borderRadius: '10px',
          fontWeight: 700,
          fontSize: '1rem',
          backgroundColor: isSubmitting ? '#94a3b8' : '#22c55e',
          '&:hover': { backgroundColor: isSubmitting ? '#94a3b8' : '#16a34a' },
        }}
      >
        {isSubmitting ? 'Logging session...' : 'Done — Log & Close'}
      </Button>

      {/* Undo toast */}
      <Snackbar
        open={showUndoToast}
        autoHideDuration={10000}
        onClose={() => {}}
        message="Session logged."
        action={
          <Button color="inherit" size="small" onClick={handleUndo} sx={{ fontWeight: 700 }}>
            Undo
          </Button>
        }
        sx={{
          '& .MuiSnackbarContent-root': {
            borderRadius: '10px',
            fontWeight: 600,
          },
        }}
      />
```

- [ ] **Step 2: Handle undo in SessionPage**

In `SessionPage.tsx`, the `isComplete` state controls showing the completion screen. Add an undo handler that restores the session view:

After the `handleComplete` callback, add:

```typescript
  // ── Undo session completion (cancels the delayed POST) ────────────────────
  const handleUndoComplete = useCallback(() => {
    setIsComplete(false);
    setCompleteResult(null);
  }, []);
```

Update the `SessionComplete` render (around line 376-389) to pass the undo handler:

```typescript
  if (isComplete) {
    return (
      <SessionComplete
        compliancePct={completeResult?.compliancePct ?? null}
        weightChanges={completeResult?.weightChanges ?? []}
        ceilingCheck={completeResult?.ceilingCheck ?? null}
        setsCompleted={completedSets}
        exercisesCompleted={blocks.filter((b) =>
          blockCompletion(b, session.sets, session.cardio).completed,
        ).length}
        onClose={handleComplete}
        onUndo={handleUndoComplete}
      />
    );
  }
```

Note: Also change the condition from `if (isComplete && completeResult)` to just `if (isComplete)` — the completion screen can show stats even before we have the API result (compliance is computable client-side). The `completeResult` being null is handled by the `??` fallbacks.

- [ ] **Step 3: Remove the immediate redirect from handleComplete**

The current `handleComplete` does `window.location.href = '/log'` after the API call. This should only happen after the toast timer expires (which is now managed by `SessionComplete`). Update:

```typescript
  const handleComplete = useCallback(
    async (notes: string) => {
      if (!session?.sessionId) return;

      try {
        const res = await fetch('/api/session/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.sessionId, notes }),
        });
        if (res.ok) {
          window.location.href = '/log';
        }
      } catch (err) {
        console.error('Failed to complete session:', err);
      }
    },
    [session],
  );
```

- [ ] **Step 4: Verify undo toast flow**

Run: `cd dashboard && npm run dev`
Complete a session and verify:
- Toast appears: "Session logged. Undo?"
- Tapping "Undo" returns to the completion screen with notes preserved
- Waiting 10 seconds triggers the API call and redirects to `/log`
- During the 10s window, the button shows "Logging session..."

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/tracker/SessionComplete.tsx dashboard/components/tracker/SessionPage.tsx
git commit -m "feat(session): 10-second undo toast on session completion"
```

---

### Task 10: Session Summary — Include RPE & Duration Actuals

**Files:**
- Modify: `dashboard/lib/session-db.ts`

- [ ] **Step 1: Enhance `generateSessionSummary` to include RPE and duration data**

Update the function signature to accept feedback:

```typescript
export function generateSessionSummary(
  sessionTitle: string,
  compliancePct: number,
  sets: SessionSetState[],
  cardio: SessionCardioState[],
  weightChanges: Array<{ exercise: string; set: number; from: number | null; to: number | null }>,
  feedback?: ExerciseFeedback[],
): string {
```

In the exercise loop (after the existing set summary line), add RPE if available:

After each `lines.push(...)` for a completed exercise (around line 199), add RPE lookup:

```typescript
      // Add RPE if recorded
      const rpe = feedback?.find((f) => f.exerciseName === name);
      if (rpe) {
        const rpeLabels = ['', 'Too Easy', 'Easy', 'Right', 'Hard', 'Too Hard'];
        lines.push(`  RPE: ${rpe.rpe}/5 (${rpeLabels[rpe.rpe]})`);
      }
```

For time-based exercises, include actual duration in the summary. Update the set summary logic to show duration changes:

After the weight check block for completed sets (around line 199), add:

```typescript
      // Duration changes for timed exercises
      const timedSets = exSets.filter((s) => s.prescribedDurationS != null && s.actualDurationS != null && s.actualDurationS !== s.prescribedDurationS);
      if (timedSets.length > 0) {
        const first = timedSets[0];
        lines.push(`  Duration: ${first.prescribedDurationS}s → ${first.actualDurationS}s`);
      }
```

- [ ] **Step 2: Update `completeSession` to pass feedback**

In `completeSession`, before the `generateSessionSummary` call:

```typescript
    const feedback = getExerciseFeedback(sessionId, db);
    const summaryText = generateSessionSummary(
      sessionRow.session_title,
      compliancePct,
      sets,
      cardio,
      weightChanges,
      feedback,
    );
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/session-db.ts
git commit -m "feat(session): include RPE and duration in session summary"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Full flow test**

Run: `cd dashboard && npm run dev`

Test the complete flow:
1. Start a session from the plan
2. Edit duration on a time-based exercise (change 40s to 30s)
3. Complete a set, then tap it to undo (set-level undo)
4. Complete all sets for an exercise — RPE selector appears
5. Rate RPE, move to next exercise
6. Complete all exercises, hit "Finish Session"
7. Add notes on completion screen
8. Hit "Done — Log & Close"
9. Verify undo toast appears for 10 seconds
10. Either undo or let it complete
11. Check daily log shows session summary with RPE data

- [ ] **Step 2: Resume test**

Navigate away mid-session and return. Verify:
- Set progress is preserved
- RPE selections are restored
- Duration edits are preserved

- [ ] **Step 3: Type check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit any final fixes if needed**
