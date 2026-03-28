# Session Edit Mode & Completion Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow editing completed current-week sessions, show consistent completion status across all pages, and guard against swapping completed sessions.

**Architecture:** New edit API endpoint (`GET`/`PUT /api/session/edit`) loads and saves completed session data. SessionPage detects `?edit=true&sessionLogId=N` and switches to edit mode. TrainingPlanTable gets status chips and "Review Session" links. SessionSummaryCard gets "Edit Session" link. Swap endpoint rejects completed items.

**Tech Stack:** Next.js App Router, MUI, better-sqlite3, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-28-session-edit-completion-visibility-design.md`

---

### Task 1: Session DB — Edit Helpers

**Files:**
- Modify: `dashboard/lib/session-db.ts`

- [ ] **Step 1: Add `getCompletedSession` function**

This loads all data for a completed session by its ID. Add at the end of `session-db.ts`:

```typescript
export function getCompletedSession(sessionLogId: number, _db?: Database.Database): {
  sessionLogId: number;
  date: string;
  weekNumber: number;
  sessionType: string;
  sessionTitle: string;
  notes: string | null;
  compliancePct: number | null;
  sets: SessionSetState[];
  cardio: SessionCardioState[];
  feedback: ExerciseFeedback[];
} | null {
  const db = _db ?? getDb();
  const row = db.prepare(`
    SELECT id, date, week_number, session_type, session_title, notes, compliance_pct
    FROM session_logs WHERE id = ? AND completed_at IS NOT NULL
  `).get(sessionLogId) as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    sessionLogId: row.id as number,
    date: row.date as string,
    weekNumber: row.week_number as number,
    sessionType: row.session_type as string,
    sessionTitle: row.session_title as string,
    notes: row.notes as string | null,
    compliancePct: row.compliance_pct as number | null,
    sets: getSessionSets(sessionLogId, db),
    cardio: getSessionCardio(sessionLogId, db),
    feedback: getExerciseFeedback(sessionLogId, db),
  };
}
```

- [ ] **Step 2: Add `batchUpdateSets` function**

```typescript
export function batchUpdateSets(
  updates: Array<{ id: number; actualWeightKg: number | null; actualReps: number | null; actualDurationS: number | null }>,
  _db?: Database.Database,
): void {
  const db = _db ?? getDb();
  const stmt = db.prepare(`
    UPDATE session_sets
    SET actual_weight_kg = ?, actual_reps = ?, actual_duration_s = ?,
        is_modified = CASE WHEN (? != prescribed_weight_kg OR ? != prescribed_reps) THEN 1 ELSE 0 END
    WHERE id = ?
  `);
  const updateAll = db.transaction((rows: typeof updates) => {
    for (const r of rows) {
      stmt.run(r.actualWeightKg, r.actualReps, r.actualDurationS, r.actualWeightKg, r.actualReps, r.id);
    }
  });
  updateAll(updates);
}
```

- [ ] **Step 3: Add `batchUpdateCardio` function**

```typescript
export function batchUpdateCardio(
  updates: Array<{ id: number; completedRounds: number; actualDurationMin: number | null }>,
  _db?: Database.Database,
): void {
  const db = _db ?? getDb();
  const stmt = db.prepare(`
    UPDATE session_cardio SET completed_rounds = ?, actual_duration_min = ? WHERE id = ?
  `);
  const updateAll = db.transaction((rows: typeof updates) => {
    for (const r of rows) {
      stmt.run(r.completedRounds, r.actualDurationMin, r.id);
    }
  });
  updateAll(updates);
}
```

- [ ] **Step 4: Add `regenerateSessionSummary` function**

This recalculates compliance and rewrites the daily_log session_summary:

```typescript
export function regenerateSessionSummary(sessionLogId: number, notes: string, _db?: Database.Database): void {
  const db = _db ?? getDb();
  const sets = getSessionSets(sessionLogId, db);
  const cardio = getSessionCardio(sessionLogId, db);
  const feedback = getExerciseFeedback(sessionLogId, db);

  const totalSets = sets.length;
  const completedSets = sets.filter((s) => s.completed).length;
  const totalCardio = cardio.length;
  const completedCardio = cardio.filter((c) => c.completed).length;
  const total = totalSets + totalCardio;
  const done = completedSets + completedCardio;
  const compliancePct = total > 0 ? Math.round((done / total) * 100) : 0;

  const weightChanges = sets
    .filter((s) => s.isModified && s.actualWeightKg !== s.prescribedWeightKg)
    .map((s) => ({ exercise: s.exerciseName, set: s.setNumber, from: s.prescribedWeightKg, to: s.actualWeightKg }));

  // Update session_logs
  db.prepare(`UPDATE session_logs SET notes = ?, compliance_pct = ? WHERE id = ?`)
    .run(notes, compliancePct, sessionLogId);

  // Regenerate summary text
  const sessionRow = db.prepare('SELECT session_title, date FROM session_logs WHERE id = ?')
    .get(sessionLogId) as { session_title: string; date: string } | undefined;

  if (sessionRow) {
    const summaryText = generateSessionSummary(
      sessionRow.session_title,
      compliancePct,
      sets,
      cardio,
      weightChanges,
      feedback,
    );
    db.prepare(`UPDATE daily_logs SET session_summary = ? WHERE session_log_id = ?`)
      .run(summaryText, sessionLogId);
  }
}
```

- [ ] **Step 5: Verify types compile**

Run: `cd dashboard && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/session-db.ts
git commit -m "feat(session): add edit helpers — getCompletedSession, batchUpdate, regenerateSummary"
```

---

### Task 2: Edit API Endpoint

**Files:**
- Create: `dashboard/app/api/session/edit/route.ts`

- [ ] **Step 1: Create the edit API route**

```typescript
import { NextResponse } from 'next/server';
import { getTrainingWeek } from '@/lib/week';
import {
  getCompletedSession,
  batchUpdateSets,
  batchUpdateCardio,
  upsertExerciseFeedback,
  regenerateSessionSummary,
} from '@/lib/session-db';
import { parseWorkoutPlan } from '@/lib/workout-parser';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionLogId = searchParams.get('sessionLogId');

  if (!sessionLogId) {
    return NextResponse.json({ error: 'sessionLogId required' }, { status: 400 });
  }

  const session = getCompletedSession(parseInt(sessionLogId));
  if (!session) {
    return NextResponse.json({ error: 'Completed session not found' }, { status: 404 });
  }

  // Scope guard: only current week
  const currentWeek = getTrainingWeek();
  if (session.weekNumber !== currentWeek) {
    return NextResponse.json({ error: 'Can only edit current week sessions' }, { status: 403 });
  }

  // Parse exercises from workout plan for the UI (need exercise definitions for labels, superset groups, etc.)
  // We return the raw session data — the UI will use the set/cardio data directly
  return NextResponse.json({
    sessionLogId: session.sessionLogId,
    sessionTitle: session.sessionTitle,
    sessionType: session.sessionType,
    date: session.date,
    notes: session.notes,
    sets: session.sets,
    cardio: session.cardio,
    feedback: session.feedback,
  });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { sessionLogId, sets, cardio, feedback, notes } = body;

  if (!sessionLogId) {
    return NextResponse.json({ error: 'sessionLogId required' }, { status: 400 });
  }

  const session = getCompletedSession(sessionLogId);
  if (!session) {
    return NextResponse.json({ error: 'Completed session not found' }, { status: 404 });
  }

  // Scope guard: only current week
  const currentWeek = getTrainingWeek();
  if (session.weekNumber !== currentWeek) {
    return NextResponse.json({ error: 'Can only edit current week sessions' }, { status: 403 });
  }

  // Batch update sets
  if (sets && Array.isArray(sets)) {
    batchUpdateSets(sets);
  }

  // Batch update cardio
  if (cardio && Array.isArray(cardio)) {
    batchUpdateCardio(cardio);
  }

  // Upsert feedback
  if (feedback && Array.isArray(feedback)) {
    for (const f of feedback) {
      if (f.exerciseName && f.rpe >= 1 && f.rpe <= 5) {
        upsertExerciseFeedback(sessionLogId, f.exerciseName, f.exerciseOrder ?? 0, f.rpe);
      }
    }
  }

  // Regenerate summary
  regenerateSessionSummary(sessionLogId, notes ?? session.notes ?? '');

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd dashboard && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/api/session/edit/route.ts
git commit -m "feat(session): add GET/PUT /api/session/edit for completed session editing"
```

---

### Task 3: SessionPage — Edit Mode

**Files:**
- Modify: `dashboard/components/tracker/SessionPage.tsx`

- [ ] **Step 1: Detect edit mode from search params**

Read the current file first. In the state declarations area (after existing state), add:

```typescript
  const isEditMode = searchParams.get('edit') === 'true';
  const editSessionLogId = searchParams.get('sessionLogId');
```

- [ ] **Step 2: Add edit mode loading path**

In the `loadSession` useEffect, before the existing fetch logic, add an edit-mode branch:

```typescript
    async function loadSession() {
      try {
        if (isEditMode && editSessionLogId) {
          // Edit mode: load completed session
          const res = await fetch(`/api/session/edit?sessionLogId=${editSessionLogId}`);
          if (!res.ok) {
            if (res.status === 403) {
              setError('Can only edit current week sessions');
            } else {
              setError('Session not found');
            }
            setLoading(false);
            return;
          }
          const data = await res.json();
          setSession({
            sessionId: data.sessionLogId,
            sessionTitle: data.sessionTitle,
            sessionType: data.sessionType,
            exercises: [], // Not needed in edit mode — we use set/cardio data directly
            sets: data.sets,
            cardio: data.cardio,
            feedback: data.feedback || [],
            coachCues: null,
            workoutDescription: null,
            resumed: false,
          });
          // Restore RPE feedback
          if (data.feedback?.length) {
            const rpeMap: Record<string, number> = {};
            for (const f of data.feedback) {
              rpeMap[f.exerciseName] = f.rpe;
            }
            setRpeFeedback(rpeMap);
          }
          // Set edit notes
          setEditNotes(data.notes || '');
          setLoading(false);
          return;
        }

        // ... existing session loading code follows
```

Add the editNotes state:

```typescript
  const [editNotes, setEditNotes] = useState('');
```

- [ ] **Step 3: Add save handler for edit mode**

After the existing `handleComplete` callback, add:

```typescript
  // ── Save edits to completed session ───────────────────────────────────────
  const handleSaveEdits = useCallback(async () => {
    if (!session?.sessionId) return;

    const setUpdates = session.sets.map((s) => ({
      id: s.id!,
      actualWeightKg: s.actualWeightKg,
      actualReps: s.actualReps,
      actualDurationS: s.actualDurationS ?? null,
    }));

    const cardioUpdates = session.cardio.map((c) => ({
      id: c.id!,
      completedRounds: c.completedRounds,
      actualDurationMin: c.actualDurationMin ?? null,
    }));

    const feedbackUpdates = Object.entries(rpeFeedback).map(([exerciseName, rpe]) => ({
      exerciseName,
      exerciseOrder: 0,
      rpe,
    }));

    try {
      const res = await fetch('/api/session/edit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionLogId: session.sessionId,
          sets: setUpdates,
          cardio: cardioUpdates,
          feedback: feedbackUpdates,
          notes: editNotes,
        }),
      });
      if (res.ok) {
        window.history.back();
      }
    } catch (err) {
      console.error('Failed to save edits:', err);
    }
  }, [session, rpeFeedback, editNotes]);
```

- [ ] **Step 4: In edit mode, build exercise blocks from set/cardio data instead of exercises array**

In edit mode, `session.exercises` is empty (we load from the completed session, not from the plan). The blocks need to be derived from the set data. Add a helper after the existing `groupExercises` function:

```typescript
function buildBlocksFromSets(
  sets: SessionSetState[],
  cardio: SessionCardioState[],
): ExerciseBlock[] {
  const blocks: ExerciseBlock[] = [];
  const seenExercises = new Set<string>();
  const seenGroups = new Set<number>();

  for (const set of sets) {
    if (seenExercises.has(set.exerciseName)) continue;
    seenExercises.add(set.exerciseName);

    if (set.supersetGroup != null) {
      if (!seenGroups.has(set.supersetGroup)) {
        seenGroups.add(set.supersetGroup);
        const groupSets = sets.filter(s => s.supersetGroup === set.supersetGroup);
        const exerciseNames = [...new Set(groupSets.map(s => s.exerciseName))];
        blocks.push({
          kind: 'superset',
          groupId: set.supersetGroup,
          exercises: exerciseNames.map(name => ({
            name,
            canonicalName: name,
            type: 'strength' as const,
            order: groupSets.find(s => s.exerciseName === name)!.exerciseOrder,
            supersetGroup: set.supersetGroup,
            sets: groupSets.filter(s => s.exerciseName === name).length,
            reps: null,
            weightKg: null,
            durationSeconds: groupSets.find(s => s.exerciseName === name)?.prescribedDurationS ?? null,
            restSeconds: null,
            rounds: null,
            targetIntensity: null,
            coachCue: null,
          })),
        });
      }
    } else {
      const exSets = sets.filter(s => s.exerciseName === set.exerciseName);
      blocks.push({
        kind: 'single',
        exercise: {
          name: set.exerciseName,
          canonicalName: set.exerciseName,
          type: 'strength' as const,
          order: set.exerciseOrder,
          supersetGroup: null,
          sets: exSets.length,
          reps: null,
          weightKg: null,
          durationSeconds: exSets[0]?.prescribedDurationS ?? null,
          restSeconds: null,
          rounds: null,
          targetIntensity: null,
          coachCue: null,
        },
      });
    }
  }

  // Add cardio blocks
  for (const c of cardio) {
    blocks.push({
      kind: 'single',
      exercise: {
        name: c.exerciseName,
        canonicalName: c.exerciseName,
        type: c.cardioType === 'intervals' ? 'cardio_intervals' as const : 'cardio_steady' as const,
        order: blocks.length,
        supersetGroup: null,
        sets: 0,
        reps: null,
        weightKg: null,
        durationSeconds: c.prescribedDurationMin ? c.prescribedDurationMin * 60 : null,
        restSeconds: null,
        rounds: c.prescribedRounds,
        targetIntensity: c.targetIntensity,
        coachCue: null,
      },
    });
  }

  return blocks;
}
```

Update the blocks derivation:

```typescript
  const blocks = session
    ? (isEditMode ? buildBlocksFromSets(session.sets, session.cardio) : groupExercises(session.exercises))
    : [];
```

- [ ] **Step 5: Replace the completion UI with Save Changes in edit mode**

In the main UI section, replace the "All done banner" and completion screen sections. Before the existing `{allDone && !isComplete && (` block, add:

```typescript
      {/* Edit mode: Save Changes button (always visible) */}
      {isEditMode && (
        <Box sx={{ mb: 3 }}>
          <TextField
            label="Session Notes"
            multiline
            minRows={2}
            fullWidth
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          />
          <Button
            variant="contained"
            fullWidth
            onClick={handleSaveEdits}
            sx={{
              minHeight: 52,
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '1rem',
              backgroundColor: semanticColors.body,
              '&:hover': { backgroundColor: '#2563eb' },
            }}
          >
            Save Changes
          </Button>
        </Box>
      )}
```

Add `TextField` and `Button` to imports if not already there (Button is likely imported, TextField may need adding).

Hide the completion banner and finish button in edit mode:

```typescript
      {allDone && !isComplete && !isEditMode && (
```

- [ ] **Step 6: In edit mode, show all blocks (not just current)**

In edit mode, all exercises should be visible at once (no block-by-block progression). Replace the single-block render section with:

```typescript
      {/* Exercise blocks */}
      {isEditMode ? (
        // Edit mode: show all blocks
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
          {blocks.map((block, idx) => (
            <Box key={idx}>{renderBlock(block)}</Box>
          ))}
        </Box>
      ) : (
        // Normal mode: show current block only
        <Box sx={{ mb: 3 }}>
          {blocks[currentBlockIndex] && renderBlock(blocks[currentBlockIndex])}
        </Box>
      )}
```

- [ ] **Step 7: Verify types compile and test manually**

Run: `cd dashboard && npx tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add dashboard/components/tracker/SessionPage.tsx
git commit -m "feat(session): add edit mode to SessionPage — load, edit, save completed sessions"
```

---

### Task 4: Training Plan — Completion Visibility

**Files:**
- Modify: `dashboard/components/TrainingPlanTable.tsx`
- Modify: `dashboard/app/api/plan/route.ts`
- Modify: `dashboard/lib/db.ts` (add sessionLogId lookup)

- [ ] **Step 1: Add session_log_id lookup to plan API**

The Training Plan needs `sessionLogId` for completed sessions to build the "Review Session" link. Add a helper to `dashboard/lib/db.ts`:

```typescript
export function getSessionLogIdForPlanItem(planItemId: number): number | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT sl.id FROM session_logs sl
    JOIN daily_logs dl ON dl.session_log_id = sl.id
    WHERE dl.workout_plan_item_id = ?
    LIMIT 1
  `).get(planItemId) as { id: number } | undefined;
  return row?.id ?? null;
}
```

- [ ] **Step 2: Update plan API to include sessionLogId for completed items**

In `dashboard/app/api/plan/route.ts`, add the import and enrich the response:

```typescript
import { NextResponse } from 'next/server';
import { getPlanItems, getLatestWeekNumber, getSessionLogIdForPlanItem } from '@/lib/db';
import { getTrainingWeek } from '@/lib/week';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get('week');
  const latestWeek = getLatestWeekNumber();
  const weekNumber = week ? parseInt(week) : (latestWeek || getTrainingWeek());
  const items = getPlanItems(weekNumber);

  // Enrich completed items with sessionLogId for edit links
  const enrichedItems = items.map(item => ({
    ...item,
    sessionLogId: item.status === 'completed' && item.id ? getSessionLogIdForPlanItem(item.id) : null,
  }));

  return NextResponse.json({ items: enrichedItems, weekNumber });
}
```

- [ ] **Step 3: Update TrainingPlanTable with status chips and conditional links**

Read the current file. Replace the session link section (lines 135-152) in the card render:

```typescript
                  {/* Status chip for completed sessions */}
                  {item.status === 'completed' && (
                    <Chip
                      label="Completed"
                      size="small"
                      sx={{
                        bgcolor: `${semanticColors.recovery.good}22`,
                        color: semanticColors.recovery.good,
                        fontWeight: 600,
                        fontSize: '0.6875rem',
                        height: 22,
                      }}
                    />
                  )}

                  {/* Session link — changes based on status */}
                  {!isSimpleDay && item.id != null && (
                    <Typography
                      component="a"
                      href={
                        item.status === 'completed' && (item as Record<string, unknown>).sessionLogId
                          ? `/session?edit=true&sessionLogId=${(item as Record<string, unknown>).sessionLogId}`
                          : `/session?planItemId=${item.id}`
                      }
                      sx={{
                        ml: 'auto',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: item.status === 'completed' ? semanticColors.recovery.good : semanticColors.body,
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      {item.status === 'completed' ? 'Review Session →' : 'Start Session →'}
                    </Typography>
                  )}
```

Add a green left border for completed cards. In the Card sx prop:

```typescript
              sx={{
                transition: 'all 0.2s ease',
                ...(item.status === 'completed' && {
                  borderLeft: `4px solid ${semanticColors.recovery.good}`,
                }),
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: 1,
                },
              }}
```

- [ ] **Step 4: Verify types compile**

Run: `cd dashboard && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/TrainingPlanTable.tsx dashboard/app/api/plan/route.ts dashboard/lib/db.ts
git commit -m "feat(plan): status chips, green border for completed sessions, Review Session link"
```

---

### Task 5: Daily Log — Edit Session Link

**Files:**
- Modify: `dashboard/components/SessionSummaryCard.tsx`

- [ ] **Step 1: Add sessionLogId prop and edit link**

Update the component to accept a sessionLogId and render an edit link:

```typescript
export interface SessionSummaryCardProps {
  sessionSummary: string;
  sessionLogId?: number | null;
  currentWeek?: boolean;
}
```

Update the function signature:

```typescript
export default function SessionSummaryCard({ sessionSummary, sessionLogId, currentWeek = true }: SessionSummaryCardProps) {
```

After the `</Collapse>` (line 126), before the closing `</Box>`, add the edit link:

```typescript
      {/* Edit Session link — only for current week sessions with a tracked session */}
      {sessionLogId && currentWeek && (
        <Box sx={{ px: 2, pb: 1.5, borderTop: '1px solid #f1f5f9' }}>
          <Typography
            component="a"
            href={`/session?edit=true&sessionLogId=${sessionLogId}`}
            sx={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#3b82f6',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            Edit Session →
          </Typography>
        </Box>
      )}
```

- [ ] **Step 2: Pass sessionLogId from DailyLog**

In `dashboard/components/DailyLog.tsx`, find where `SessionSummaryCard` is rendered (~line 489-491). Update to pass the sessionLogId:

```typescript
      {!isSick && formData.session_summary && (
        <SessionSummaryCard
          sessionSummary={formData.session_summary}
          sessionLogId={formData.session_log_id}
        />
      )}
```

The `formData` object already has `session_log_id` from the API response (confirmed in the log API route). Make sure the DailyLog's FormData interface includes `session_log_id: number | null`.

- [ ] **Step 3: Verify types compile**

Run: `cd dashboard && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/SessionSummaryCard.tsx dashboard/components/DailyLog.tsx
git commit -m "feat(log): add Edit Session link to SessionSummaryCard"
```

---

### Task 6: Swap Guard — Reject Completed Sessions

**Files:**
- Modify: `dashboard/app/api/plan/swap/route.ts`

- [ ] **Step 1: Add completion check to swap endpoint**

In `dashboard/app/api/plan/swap/route.ts`, after the `const item = getPlanItemById(planItemId);` line and the null check, add:

```typescript
    if (item.status === 'completed') {
      return NextResponse.json({ error: 'Cannot swap a completed session' }, { status: 400 });
    }
```

The `SwapSessionPicker` component already filters out completed items in the UI (line 45: `if (item.status === 'completed') return;` in handleSelect, and lines 90-117 render completed items as disabled). This backend guard ensures the API rejects it too.

- [ ] **Step 2: Commit**

```bash
git add dashboard/app/api/plan/swap/route.ts
git commit -m "feat(swap): reject swapping completed sessions"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Type check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No new type errors.

- [ ] **Step 2: Test edit flow end-to-end**

1. Complete a session through the session tracker
2. Navigate to `/log` — verify "Edit Session →" link appears below session summary
3. Click "Edit Session →" — session tracker opens in edit mode with pre-filled data
4. Change a weight, change an RPE, change a duration
5. Click "Save Changes"
6. Navigate back to `/log` — verify session summary updated
7. Navigate to `/plan` — verify "Review Session →" link and green status chip on completed session
8. Click "Review Session →" — same edit mode opens

- [ ] **Step 3: Test swap guard**

1. Complete a session
2. Try swapping that session from a different day's Daily Log
3. Verify the completed session is shown as disabled/grayed out in SwapSessionPicker
4. Verify API rejects a direct POST to `/api/plan/swap` with a completed planItemId

- [ ] **Step 4: Commit any fixes**
