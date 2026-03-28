# Session Tracker: Exercise Feedback, Undo & Duration Editing

**Date:** 2026-03-28
**Status:** Approved
**Scope:** Session tracker page — three gaps identified during real workout usage

## Problem

Three missing capabilities in the session tracker reduce data quality and create friction during workouts:

1. **No per-exercise effort tracking** — the athlete can't indicate how hard each exercise felt. Supersets may have one easy and one hard exercise, but coaches have no signal to rebalance.
2. **No set-level undo** — accidentally completing a set (e.g., tapping set 3 when on set 1) is irreversible during the session. Session completion is also irreversible.
3. **Time-based exercises are display-only** — dead hangs, holds, and cardio durations can't be edited. If the athlete holds 30s instead of prescribed 40s, that data is lost. Progressive overload for time-based exercises is blind.

## Design

### 1. Per-Exercise RPE (1-5)

**Scale definition:**

| RPE | Label | Meaning | Coach Action |
|-----|-------|---------|--------------|
| 1 | Too Easy | Could double the sets. Weight/duration needs to go up. | Increase load |
| 2 | Easy | Comfortable throughout. 3+ reps/seconds in reserve. | Monitor |
| 3 | Right | Challenging but manageable. 1-2 reps in reserve. Target zone. | Maintain |
| 4 | Hard | Last set was a grind. 0-1 reps in reserve. | Monitor |
| 5 | Too Hard | Form broke down or failed. Weight/duration needs to come down. | Decrease load |

1 and 5 are explicit signals to adjust programming. 2-4 are the working range.

**UI behavior:**

- When all sets for an exercise are completed, a row of 5 tappable buttons slides in below the last set: `Too Easy | Easy | Right | Hard | Too Hard`
- Compact single row, small text labels
- Tapping one highlights it and saves immediately via API
- Optional — athlete can skip and move on (row stays visible but unselected)
- For supersets, each exercise gets its own independent RPE row
- On session resume, previously saved RPE selections are restored

**Data flow:**

- RPE saved immediately on tap (not deferred to session completion)
- Upsert pattern — changing selection overwrites the previous value
- Available to all coaches via checkin data assembly and direct query

### 2. Set-Level Undo

**UI behavior:**

- Tapping a completed set toggles it back to incomplete
- `actual_weight_kg`, `actual_reps`, and `actual_duration_s` values remain populated but become editable again
- `completed` flag flips back to 0
- Uses the same `POST /api/session` endpoint already in place — sends `completed: false`
- For cardio intervals, same pattern — tapping a completed round uncompletes it

No new API required. The existing update endpoint already accepts `completed` as a field.

### 3. Session-Level Undo Toast

**UI behavior:**

- After tapping "Done - Log & Close" on the completion screen, a toast/snackbar appears at the bottom: "Session logged. Undo?" with a tappable "Undo" action
- Toast auto-dismisses after 10 seconds
- Implementation: delay the actual `POST /api/session/complete` call by 10 seconds
- If "Undo" is tapped: cancel the pending request, restore the completion screen state, navigate back to the active session
- If timer expires: POST fires, redirect to `/log` happens
- During the 10-second window, the UI shows the toast over the completion screen (no navigation yet)

### 4. Editable Duration for Time-Based Exercises

**Strength exercises (holds, hangs, stretches):**

- Exercises with `durationSeconds` render an editable number input pre-filled with the prescribed duration
- Same styling as weight/reps fields, with "s" suffix label
- On set completion, value saves to `session_sets.actual_duration_s`

**Cardio exercises (steady state, intervals):**

- Exercises with `prescribed_duration_min` render an editable field showing minutes
- On completion, value saves to `session_cardio.actual_duration_min`

**Unit convention:**

- UI displays seconds for holds/hangs, minutes for cardio — matching how athletes think about each
- Database stores seconds for strength (`actual_duration_s` INTEGER), minutes for cardio (`actual_duration_min` REAL) — matching their respective prescribed columns

## Database Changes

### New Table: `session_exercise_feedback`

```sql
CREATE TABLE session_exercise_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_log_id INTEGER NOT NULL REFERENCES session_logs(id),
  exercise_name TEXT NOT NULL,
  exercise_order INTEGER NOT NULL,
  rpe INTEGER CHECK (rpe BETWEEN 1 AND 5),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_log_id, exercise_name)
);
```

### Modified Table: `session_sets`

```sql
ALTER TABLE session_sets ADD COLUMN actual_duration_s INTEGER;
```

### Modified Table: `session_cardio`

```sql
ALTER TABLE session_cardio ADD COLUMN actual_duration_min REAL;
```

## API Changes

### Modified: `POST /api/session`

Extend the existing set/cardio update endpoint:

- For sets with duration: accept `actualDurationS` in body. Writes to `session_sets.actual_duration_s`.
- For cardio: accept `actualDurationMin` in body. Writes to `session_cardio.actual_duration_min`.
- For set undo: sending `completed: false` with current actuals already works structurally — UI just needs to call it.

### New: `POST /api/session/feedback`

```
Body: { sessionLogId: number, exerciseName: string, exerciseOrder: number, rpe: number }
Response: { success: true }
```

Upserts into `session_exercise_feedback`. If a row exists for that session + exercise, updates the RPE.

### Modified: `GET /api/session`

When resuming an in-progress session, also return any existing `session_exercise_feedback` rows so RPE selections are restored.

### New: `GET /api/session/feedback`

```
Query: ?sessionLogId=123
Response: { feedback: [{ exerciseName, exerciseOrder, rpe, createdAt }] }
```

Returns all exercise feedback for a session. Used by checkin flow and coach analysis.

### Unchanged: `POST /api/session/complete`

No backend change. The 10-second delay is client-side only — the completion screen holds a timer before firing the existing endpoint.

## Files Affected

| File | Change |
|------|--------|
| `dashboard/lib/db.ts` | Add `session_exercise_feedback` table creation, ALTER statements for new columns |
| `dashboard/lib/session-db.ts` | Add `upsertExerciseFeedback()`, `getExerciseFeedback()`. Extend `updateSet()` for `actual_duration_s`. Extend `updateCardio()` for `actual_duration_min`. |
| `dashboard/lib/types.ts` | Add `ExerciseFeedback` type. Extend `SessionSet` and `SessionCardio` types with duration actuals. |
| `dashboard/app/api/session/route.ts` | Accept `actualDurationS`/`actualDurationMin` in POST. Return feedback on GET resume. |
| `dashboard/app/api/session/feedback/route.ts` | New — GET and POST handlers for exercise feedback. |
| `dashboard/components/tracker/StrengthExercise.tsx` | Add editable duration field for time-based exercises. Add set undo toggle. Add RPE row after exercise completion. |
| `dashboard/components/tracker/CardioSteady.tsx` | Add editable duration field. |
| `dashboard/components/tracker/CardioIntervals.tsx` | Add editable duration field per round. Add round undo toggle. |
| `dashboard/components/tracker/SupersetBlock.tsx` | Pass RPE props through to child exercises. |
| `dashboard/components/tracker/SessionComplete.tsx` | Add 10-second undo toast with delayed API call. |
| `dashboard/components/tracker/SessionPage.tsx` | Manage RPE state. Wire up feedback API calls. Handle undo toast lifecycle. |
