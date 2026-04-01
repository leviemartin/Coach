# Session Tracker Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the session tracker page to use structured data from `plan_exercises` / `session_sets` with proper section separation, coach cues, rest timers, per-exercise notes, and correct cardio rendering.

**Architecture:** The session API already populates `section`, `coach_cue`, `rest_seconds`, and `plan_exercise_id` on session_sets/session_cardio (from Task 8). The SessionPage and its child components need to read and render these fields. No backend changes needed.

**Tech Stack:** Next.js, MUI, TypeScript

---

## File Map

### Modified files
- `dashboard/components/tracker/SessionPage.tsx` — Add section grouping, coach cues display, notes input
- `dashboard/components/tracker/StrengthExercise.tsx` — Add coach cue, section label, notes field
- `dashboard/components/tracker/CardioIntervals.tsx` — Fix rendering (currently shows as strength sets)
- `dashboard/components/tracker/CardioSteady.tsx` — Add section label, coach cue
- `dashboard/components/tracker/SupersetBlock.tsx` — Add section awareness, rest timer display
- `dashboard/components/tracker/ExerciseRpe.tsx` — Add notes text field below RPE selector
- `dashboard/app/api/session/route.ts` — Return section/coachCue/restSeconds in response
- `dashboard/app/api/session/edit/route.ts` — Return section/coachCue/restSeconds for edit mode
- `dashboard/lib/types.ts` — Update SessionSetState and SessionCardioState with new fields
- `dashboard/lib/session-db.ts` — Update getSessionSets/getSessionCardio to read new columns

### New files
- `dashboard/components/tracker/SessionNotes.tsx` — Per-exercise notes input component

---

## Task 1: Update Types and DB Reads

**Files:**
- Modify: `dashboard/lib/types.ts`
- Modify: `dashboard/lib/session-db.ts`

- [ ] **Step 1: Add new fields to SessionSetState**

In `dashboard/lib/types.ts`, add to the `SessionSetState` interface:

```typescript
  section: string | null;
  restSeconds: number | null;
  coachCue: string | null;
  planExerciseId: number | null;
```

- [ ] **Step 2: Add new fields to SessionCardioState**

Add to `SessionCardioState`:

```typescript
  section: string | null;
  restSeconds: number | null;
  coachCue: string | null;
  planExerciseId: number | null;
  intervalWorkSeconds: number | null;
  intervalRestSeconds: number | null;
```

- [ ] **Step 3: Update getSessionSets in session-db.ts**

Update the SELECT query and mapping in `getSessionSets` to include the new columns:

```sql
SELECT id, exercise_name, exercise_order, superset_group, set_number,
       prescribed_weight_kg, prescribed_reps, actual_weight_kg, actual_reps,
       completed, is_modified, prescribed_duration_s, actual_duration_s,
       section, rest_seconds, coach_cue, plan_exercise_id
FROM session_sets WHERE session_log_id = ? ORDER BY exercise_order, set_number
```

Add to the row mapping:
```typescript
    section: r.section as string | null,
    restSeconds: r.rest_seconds as number | null,
    coachCue: r.coach_cue as string | null,
    planExerciseId: r.plan_exercise_id as number | null,
```

- [ ] **Step 4: Update getSessionCardio in session-db.ts**

Update the SELECT and mapping similarly:

```sql
SELECT id, exercise_name, cardio_type, prescribed_rounds, completed_rounds,
       prescribed_duration_min, target_intensity, completed, actual_duration_min,
       section, rest_seconds, coach_cue, plan_exercise_id,
       interval_work_seconds, interval_rest_seconds
FROM session_cardio WHERE session_log_id = ? ORDER BY id
```

Add to mapping:
```typescript
    section: r.section as string | null,
    restSeconds: r.rest_seconds as number | null,
    coachCue: r.coach_cue as string | null,
    planExerciseId: r.plan_exercise_id as number | null,
    intervalWorkSeconds: r.interval_work_seconds as number | null,
    intervalRestSeconds: r.interval_rest_seconds as number | null,
```

- [ ] **Step 5: Run tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests pass (new fields are nullable, existing tests don't check them)

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/types.ts dashboard/lib/session-db.ts
git commit -m "feat: expose section/coachCue/restSeconds in session set/cardio reads"
```

---

## Task 2: Session API Returns New Fields

**Files:**
- Modify: `dashboard/app/api/session/route.ts`
- Modify: `dashboard/app/api/session/edit/route.ts`

- [ ] **Step 1: Read current session route**

Read `dashboard/app/api/session/route.ts`. The `buildSessionResponse` function builds the JSON response. Since `getSessionSets` and `getSessionCardio` now return the new fields, and the response just passes `sets` and `cardio` directly, no changes should be needed to the main route — the new fields are automatically included.

Verify by reading the route and confirming sets/cardio are passed through without field filtering.

- [ ] **Step 2: Read and update edit route**

Read `dashboard/app/api/session/edit/route.ts`. Verify it also uses `getSessionSets`/`getSessionCardio` and passes the data through. If it does field-level mapping, add the new fields.

- [ ] **Step 3: Run tests and commit**

```bash
npx vitest run
git add dashboard/app/api/session/route.ts dashboard/app/api/session/edit/route.ts
git commit -m "feat: session API includes section/coachCue/restSeconds fields"
```

---

## Task 3: Section-Grouped Exercise Rendering in SessionPage

**Files:**
- Modify: `dashboard/components/tracker/SessionPage.tsx`

- [ ] **Step 1: Read current SessionPage.tsx fully**

Understand the current flow: how exercises are grouped into blocks, how blocks are rendered, how the "current block" navigation works.

- [ ] **Step 2: Add section grouping**

The session page currently renders all exercises in a flat list. Update to group by section:

1. After building `ExerciseBlock[]`, group them by section using the `section` field from the first set of each exercise.
2. Render section headers between groups using the same `SectionHeader` component from `@/components/plan/SectionHeader`.
3. Warm-up and cool-down sections should render with simplified controls (checkboxes instead of full weight/rep inputs).

In `buildBlocksFromSets`, the sets now have `section` field. Use it:

```typescript
// After building blocks, tag each with its section
for (const block of blocks) {
  if (block.kind === 'single') {
    const firstSet = sets.find(s => s.exerciseName === block.exercise.name);
    block.section = firstSet?.section ?? 'main_work';
  } else {
    const firstSet = sets.find(s => s.exerciseName === block.exercises[0].name);
    block.section = firstSet?.section ?? 'main_work';
  }
}
```

Add `section?: string` to the `ExerciseBlock` type.

- [ ] **Step 3: Display coach cues**

For each exercise block, if the first set has a `coachCue`, display it as an italic hint below the exercise name:

```tsx
{coachCue && (
  <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', fontStyle: 'italic', mb: 1 }}>
    {coachCue}
  </Typography>
)}
```

The coach cue comes from `sets[0].coachCue` for the exercise.

- [ ] **Step 4: Run tests and commit**

```bash
npx vitest run
git add dashboard/components/tracker/SessionPage.tsx
git commit -m "feat: session page groups exercises by section with coach cues"
```

---

## Task 4: Per-Exercise Notes Input

**Files:**
- Create: `dashboard/components/tracker/SessionNotes.tsx`
- Modify: `dashboard/components/tracker/ExerciseRpe.tsx`
- Modify: `dashboard/app/api/session/feedback/route.ts`
- Modify: `dashboard/lib/session-db.ts`

- [ ] **Step 1: Add notes column to session_exercise_feedback table**

In `dashboard/lib/db.ts`, add a migration:

```typescript
try { db.exec(`ALTER TABLE session_exercise_feedback ADD COLUMN notes TEXT`); } catch { /* exists */ }
```

Update `upsertExerciseFeedback` in session-db.ts to accept and store notes:

```typescript
export function upsertExerciseFeedback(
  sessionLogId: number,
  exerciseName: string,
  exerciseOrder: number,
  rpe: number,
  notes?: string | null,
  _db?: Database.Database,
): void {
  const db = _db ?? getDb();
  db.prepare(`
    INSERT INTO session_exercise_feedback (session_log_id, exercise_name, exercise_order, rpe, notes, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(session_log_id, exercise_name) DO UPDATE SET rpe = ?, notes = ?, created_at = datetime('now')
  `).run(sessionLogId, exerciseName, exerciseOrder, rpe, notes ?? null, rpe, notes ?? null);
}
```

Update `getExerciseFeedback` to return notes:

```typescript
// Add to the return mapping:
    notes: r.notes as string | null,
```

Update `ExerciseFeedback` type in types.ts:

```typescript
export interface ExerciseFeedback {
  id?: number;
  sessionLogId: number;
  exerciseName: string;
  exerciseOrder: number;
  rpe: number;
  notes?: string | null;
  createdAt?: string;
}
```

- [ ] **Step 2: Update ExerciseRpe component to include notes**

Read `dashboard/components/tracker/ExerciseRpe.tsx`. Add a TextField below the RPE selector:

```tsx
<TextField
  size="small"
  multiline
  minRows={1}
  maxRows={3}
  placeholder="Notes (optional)"
  value={notes}
  onChange={(e) => onNotesChange?.(e.target.value)}
  sx={{ mt: 1, width: '100%' }}
/>
```

Update the component props to include `notes` and `onNotesChange`.

- [ ] **Step 3: Update feedback API route**

Read `dashboard/app/api/session/feedback/route.ts`. Update to accept and pass `notes` field alongside `rpe`.

- [ ] **Step 4: Wire up notes in SessionPage**

In SessionPage, add notes state alongside rpeFeedback:

```typescript
const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({});
```

Pass notes to ExerciseRpe and handle changes. Send notes when RPE is submitted.

- [ ] **Step 5: Run tests and commit**

```bash
npx vitest run
git add dashboard/lib/db.ts dashboard/lib/session-db.ts dashboard/lib/types.ts \
  dashboard/components/tracker/ExerciseRpe.tsx dashboard/app/api/session/feedback/route.ts \
  dashboard/components/tracker/SessionPage.tsx
git commit -m "feat: add per-exercise notes input below RPE selector"
```

---

## Task 5: Fix Cardio Rendering

**Files:**
- Modify: `dashboard/components/tracker/SessionPage.tsx`
- Modify: `dashboard/components/tracker/CardioIntervals.tsx`

- [ ] **Step 1: Fix cardio type detection in SessionPage**

Currently, cardio exercises stored via `createSessionFromPlanExercises` go to `session_cardio` table correctly. But in `buildBlocksFromSets`, cardio blocks are built from the `cardio` array, not from `sets`. Verify the cardio exercises aren't being duplicated (showing as both strength sets AND cardio).

Check if the session API response includes exercises that are both in `sets` (wrong) and `cardio` (right). If the structured session creation correctly routes cardio to `session_cardio` only, then the rendering should work. The issue in the screenshot was likely from old data.

- [ ] **Step 2: Update CardioIntervals to show interval specs**

The CardioIntervals component should display `intervalWorkSeconds` and `intervalRestSeconds` from the cardio state:

```tsx
{cardio.intervalWorkSeconds && cardio.intervalRestSeconds && (
  <Typography variant="body2" color="text.secondary">
    {cardio.intervalWorkSeconds}s work / {cardio.intervalRestSeconds}s rest
  </Typography>
)}
```

Also display coach cue if available:

```tsx
{cardio.coachCue && (
  <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', fontStyle: 'italic', mt: 0.5 }}>
    {cardio.coachCue}
  </Typography>
)}
```

- [ ] **Step 3: Run tests and commit**

```bash
npx vitest run
git add dashboard/components/tracker/SessionPage.tsx dashboard/components/tracker/CardioIntervals.tsx
git commit -m "fix: correct cardio rendering with interval specs and coach cues"
```

---

## Task 6: Rest Timer Display

**Files:**
- Modify: `dashboard/components/tracker/StrengthExercise.tsx`
- Modify: `dashboard/components/tracker/SupersetBlock.tsx`

- [ ] **Step 1: Add rest seconds display to StrengthExercise**

After completing a set, show a rest timer hint:

```tsx
{set.completed && restSeconds && (
  <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', ml: 1 }}>
    Rest {restSeconds}s
  </Typography>
)}
```

Get `restSeconds` from the first set's `restSeconds` field. Add it as a prop.

- [ ] **Step 2: Add rest display to SupersetBlock header**

The superset block should show the rest period in its header:

```tsx
{restSeconds && (
  <Typography variant="caption" color="text.secondary">
    {restSeconds}s rest between rounds
  </Typography>
)}
```

Get `restSeconds` from the first set in the superset group.

- [ ] **Step 3: Run tests and commit**

```bash
npx vitest run
git add dashboard/components/tracker/StrengthExercise.tsx dashboard/components/tracker/SupersetBlock.tsx
git commit -m "feat: display rest timers on strength exercises and superset blocks"
```

---

## Task 7: Warm-up / Cool-down Simplified Controls

**Files:**
- Modify: `dashboard/components/tracker/SessionPage.tsx`

- [ ] **Step 1: Render warm-up/cool-down as checkboxes**

For exercises in `warm_up` and `cool_down` sections, render simplified controls instead of full weight/rep inputs:

```tsx
if (section === 'warm_up' || section === 'cool_down') {
  // Simple checkbox per exercise: name + duration/description + done checkbox
  return <WarmupExercise exercise={exercise} sets={exerciseSets} onToggle={handleToggle} />;
}
```

Create a simple inline component (or add logic to the render) that shows:
- Exercise name
- Duration or description
- Single "Done" checkbox that marks all sets complete

- [ ] **Step 2: Run tests and commit**

```bash
npx vitest run
git add dashboard/components/tracker/SessionPage.tsx
git commit -m "feat: simplified warm-up/cool-down controls in session tracker"
```

---

## Task 8: End-to-End Verification

- [ ] **Step 1: Run full test suite**

```bash
cd dashboard && npx vitest run
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Start dev server and test**

Navigate to session page with a structured plan item. Verify:
- Sections (WARM-UP, MAIN WORK, COOL-DOWN) display as headers
- Coach cues show below exercise names
- RPE selector has notes field below it
- Cardio intervals show work/rest specs (not "3 reps" strength format)
- Rest seconds display after completing sets
- Warm-up/cool-down have simplified checkbox controls

- [ ] **Step 4: Commit and push**

```bash
git push
```
