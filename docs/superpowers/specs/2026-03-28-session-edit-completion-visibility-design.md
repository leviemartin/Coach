# Session Edit Mode & Completion Visibility

**Date:** 2026-03-28
**Status:** Approved
**Scope:** Edit completed sessions within current week, consistent completion visibility across all pages, swap guard for completed sessions

## Problem

Completed sessions are locked forever — no page allows editing RPE, duration, reps, or weights after completion. The Training Plan page shows no visual distinction between pending and completed sessions. There's no entry point to review or correct session data. This means the weekly checkin may contain inaccurate data that the athlete noticed but couldn't fix.

**Not in scope:** Editing sessions from previous weeks. Only current week sessions are editable.

## Design

### 1. Session Edit Mode

The session tracker (`/session`) gains an edit mode via query params: `?edit=true&sessionLogId={id}`.

**Behavior:**
- Loads existing `session_sets`, `session_cardio`, and `session_exercise_feedback` data from the completed session (not from `plan_items`)
- All fields pre-populated: weights, reps, duration, RPE selections
- All sets show as completed but are fully editable (same StrengthExercise, CardioSteady, CardioIntervals components, pre-filled)
- RPE selectors visible on all exercises (since all sets are already complete)
- The "Finish Session" banner and completion ceremony are replaced by a **"Save Changes"** button at the bottom
- No undo toast, no completion redirect — just save and go back
- After save, `daily_logs.session_summary` is regenerated to reflect updated data
- Redirect back to the referring page (Daily Log or Training Plan)

**What does NOT happen on edit save:**
- No new session_log created
- No ceiling re-check
- No plan_items status change
- No daily_logs.workout_completed change
- No completion timestamp update

### 2. Training Plan Completion Visibility

Each session card in `TrainingPlanTable` gains:

- **Status chip** next to session type: "Completed" (green), "Pending" (default), "Skipped" (gray)
- Completed cards get a subtle green-tinted left border (`semanticColors.recovery.good`)
- **Link text changes based on status:**
  - Pending: "Start Session →" → `/session?planItemId={id}`
  - Completed: "Review Session →" → `/session?edit=true&sessionLogId={id}`
- Rest days and Family Day: no chip, no link (unchanged)

Data source: `plan_items.status` already returned by `/api/plan`. The `session_log_id` for the "Review Session" link needs to be resolved — either by joining `daily_logs.session_log_id` for the plan item's date, or by adding the session_log_id to the plan API response.

### 3. Daily Log Edit Entry Point

The session summary area in the Daily Log page gains:

- An **"Edit Session →"** link below the session summary text
- Links to `/session?edit=true&sessionLogId={id}` where `id` comes from `daily_logs.session_log_id`
- Only shown when `session_log_id IS NOT NULL` (session tracked through session tracker)
- Only shown for current week sessions

The Week Overview grid already shows completion state correctly. No changes needed.

### 4. Swap Session Guard

**API change (`/api/plan/swap`):**
- If `plan_items.status === 'completed'` for the item being swapped, reject with `{ error: 'Cannot swap a completed session' }`

**UI change (`SwapSessionPicker`):**
- Filter out completed sessions from the list of swappable options

### 5. Edit API Endpoint

**New: `PUT /api/session/edit`**

```
Body: {
  sessionLogId: number,
  sets: Array<{
    id: number,
    actualWeightKg: number | null,
    actualReps: number | null,
    actualDurationS: number | null
  }>,
  cardio: Array<{
    id: number,
    completedRounds: number,
    actualDurationMin: number | null
  }>,
  feedback: Array<{
    exerciseName: string,
    exerciseOrder: number,
    rpe: number
  }>,
  notes: string
}
```

**Processing:**
1. Validate `sessionLogId` exists and `completed_at IS NOT NULL` (only edit completed sessions)
2. Validate session belongs to current week (scope guard)
3. Batch-update `session_sets` — weight, reps, duration, recalculate `is_modified`
4. Batch-update `session_cardio` — rounds, duration
5. Upsert `session_exercise_feedback` — RPE per exercise
6. Update `session_logs.notes`
7. Recalculate `compliance_pct`
8. Regenerate `daily_logs.session_summary` via `generateSessionSummary()`
9. Return `{ success: true }`

### 6. SessionPage Edit Mode Integration

The `SessionPage` component detects edit mode via `searchParams`:
- `edit=true` + `sessionLogId={id}` → edit mode
- Otherwise → normal session flow (unchanged)

**In edit mode:**
- Load session data via a new `GET /api/session/edit?sessionLogId={id}` that returns the completed session's sets, cardio, feedback, notes, and exercise definitions
- Initialize all state from the loaded data
- Hide the "All exercises complete → Finish Session" banner
- Show "Save Changes" button (always visible, not gated by completion state)
- On save: `PUT /api/session/edit` with all current state
- On save success: `window.location.href = referrer || '/log'`

## Files Affected

| File | Change |
|------|--------|
| `dashboard/app/api/session/edit/route.ts` | New — GET (load completed session) and PUT (save edits) |
| `dashboard/components/tracker/SessionPage.tsx` | Detect edit mode, load from edit API, show "Save Changes" instead of completion flow |
| `dashboard/components/tracker/SessionComplete.tsx` | Not used in edit mode (no changes needed) |
| `dashboard/components/TrainingPlanTable.tsx` | Add status chip, green border for completed, change link text/href for completed sessions |
| `dashboard/components/DailyLog.tsx` | Add "Edit Session →" link in session summary area |
| `dashboard/components/SwapSessionPicker.tsx` | Filter out completed sessions |
| `dashboard/app/api/plan/swap/route.ts` | Reject swap if plan item is completed |
| `dashboard/lib/session-db.ts` | Add `getCompletedSession()` helper, add `batchUpdateSets()`, `batchUpdateCardio()` helpers |
| `dashboard/app/plan/page.tsx` | Pass session_log_id data to TrainingPlanTable for completed sessions |
