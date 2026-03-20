# Spec 2: Daily Log + Tracking

**Date:** 2026-03-20
**Status:** Draft
**Scope:** Daily compliance tracking page, sick day toggle, check-in integration, plan table simplification
**Depends on:** Spec 1 (Deployment + Auth)
**Blocks:** Spec 3 (UI/UX Audit)

---

## 1. Problem Statement

The athlete currently has no way to track daily compliance (workouts, sleep targets, mobility, hydration) between weekly check-ins. All data is either recalled from memory during the Sunday check-in or inferred from Garmin. This leads to:
- Inaccurate reporting (memory-based, not real-time)
- No sick day tracking — agents don't know about illness unless manually mentioned
- Duplicate tracking surfaces (plan table sub-tasks vs check-in form) that drift out of sync
- Hydration tracking showing zero compliance every week with no mechanism to improve

**Goal:** A single daily log page where the athlete checks off compliance items each day. Data persists, feeds automatically into the weekly check-in, and replaces the plan table's completion tracking.

## 2. Architecture Overview

```
[Daily Log Page /log]
        |
        v
  PUT /api/log  ------> daily_logs table (SQLite)
                              |
                              v
              GET /api/log/week-summary
                    |                |
                    v                v
          Check-in form       Agent shared context
          (pre-fill)          (auto-summary block)
```

**Data flows one direction:** Daily log -> database -> check-in. No sync between multiple tracking surfaces.

## 3. Data Model

### New Table: `daily_logs`

```sql
CREATE TABLE daily_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,            -- 'YYYY-MM-DD'
  week_number INTEGER NOT NULL,         -- denormalized for fast weekly queries
  workout_completed INTEGER DEFAULT 0,  -- 0/1
  workout_plan_item_id INTEGER,         -- FK to plan_items, nullable
  core_work_done INTEGER DEFAULT 0,     -- 0/1
  rug_protocol_done INTEGER DEFAULT 0,  -- 0/1
  vampire_bedtime TEXT,                 -- 'HH:MM' 24h+ format, nullable (see note)
  hydration_tracked INTEGER DEFAULT 0,  -- 0/1
  kitchen_cutoff_hit INTEGER DEFAULT 0, -- 0/1
  is_sick_day INTEGER DEFAULT 0,        -- 0/1
  notes TEXT,                           -- free-text
  created_at TEXT NOT NULL,             -- ISO timestamp
  updated_at TEXT NOT NULL,             -- ISO timestamp
  FOREIGN KEY (workout_plan_item_id) REFERENCES plan_items(id)
);

CREATE INDEX idx_daily_logs_week ON daily_logs(week_number);
CREATE INDEX idx_daily_logs_date ON daily_logs(date);
```

**Design decisions:**
- One row per date, upsert on save
- `week_number` computed using `getTrainingWeek()` from `lib/week.ts` — the existing function that handles epoch math and timezone normalization. `lib/daily-log.ts` must reuse this, not re-implement.
- `vampire_bedtime` uses **24-hour-plus format**: times before 06:00 are stored as 24+hour (e.g., 00:30 -> "24:30", 01:15 -> "25:15"). This makes compliance checking a simple numeric comparison (< 23:00 = compliant) and keeps times sortable. The UI time picker translates between standard time display and this storage format.
- `workout_plan_item_id` links to the planned session for display context, but the daily log owns the completion state
- Sick day is a binary flag — when set, the UI hides most fields but the row persists with whatever was logged
- `notes` is free-text for injury observations, sleep disruptions, etc.
- `sub_tasks` column on `plan_items` was added via ALTER TABLE migration (not in CREATE TABLE). It is retained for historical data but no longer written to after this spec.

### Schema Migration

- Bump `SCHEMA_VERSION` from 3 to 4 in `lib/db.ts`
- Add `daily_logs` table creation to `initTables()`
- No migration of existing data needed — the table starts empty and fills organically

## 4. API Endpoints

### `GET /api/log?date=YYYY-MM-DD`

Returns the daily log for the given date.

**Response:**
```json
{
  "log": {
    "id": 1,
    "date": "2026-03-20",
    "week_number": 12,
    "workout_completed": 0,
    "core_work_done": 0,
    "rug_protocol_done": 0,
    "vampire_bedtime": null,
    "hydration_tracked": 0,
    "kitchen_cutoff_hit": 0,
    "is_sick_day": 0,
    "notes": ""
  },
  "planned_session": {
    "id": 42,
    "session_type": "Upper Body + Core",
    "focus": "Pull-up progression, bench press",
    "workout_plan": "..."
  }
}
```

- If no log exists for the date, returns a default (all zeros/nulls) with the date and computed week_number
- `planned_session` resolved by: (1) compute `week_number` from date via `getTrainingWeek()`, (2) derive day-of-week name from date as a full English name in title case (e.g., "Thursday") — must match the format stored in `plan_items.day` by `parse-schedule.ts`, (3) query `SELECT * FROM plan_items WHERE week_number = ? AND day = ?`. Returns null if no session planned (rest/family day).

### `PUT /api/log`

Upserts a daily log row.

**Request body:**
```json
{
  "date": "2026-03-20",
  "workout_completed": 1,
  "core_work_done": 1,
  "rug_protocol_done": 0,
  "vampire_bedtime": "23:15",
  "hydration_tracked": 1,
  "kitchen_cutoff_hit": 1,
  "is_sick_day": 0,
  "notes": "Knee felt tight during squats"
}
```

- `week_number` computed via `getTrainingWeek()` from `lib/week.ts`
- `workout_plan_item_id` resolved by matching date to plan_items: compute week_number + day-of-week name, query `plan_items WHERE week_number = ? AND day = ?`, take the first match's `id` (or null if no match)
- `vampire_bedtime` received from the UI in 24h+ format (see Section 3 note)
- Sets `created_at` on insert, `updated_at` on every upsert
- Returns the saved log row

### `GET /api/log/week?week=13`

Returns all daily logs for the given week number as an array (0-7 entries).

**Response:**
```json
{
  "week_number": 13,
  "logs": [
    { "date": "2026-03-23", "day": "Monday", "workout_completed": 1, "is_sick_day": 0, "..." : "..." },
    { "date": "2026-03-24", "day": "Tuesday", "workout_completed": 0, "is_sick_day": 1, "..." : "..." }
  ]
}
```

Used by the week overview dots component and for navigating between days.

### `GET /api/log/week-summary?week=13`

Returns aggregated compliance metrics for the week.

**Response:**
```json
{
  "week_number": 13,
  "days_logged": 5,
  "workouts": { "completed": 4, "planned": 4 },
  "core": { "done": 2, "target": 3 },
  "rug_protocol": { "done": 5, "total": 7 },
  "vampire": {
    "compliant": 3,
    "total": 7,
    "avg_bedtime": "23:45",
    "daily": [
      { "date": "2026-03-23", "bedtime": "22:30", "compliant": true },
      { "date": "2026-03-24", "bedtime": "23:15", "compliant": false }
    ]
  },
  "hydration": { "tracked": 0, "total": 7 },
  "kitchen_cutoff": { "hit": 6, "total": 7 },
  "sick_days": 0,
  "notes": [
    { "date": "2026-03-24", "text": "knee tight during squats" },
    { "date": "2026-03-26", "text": "kid up 3x overnight" }
  ]
}
```

**Denominator semantics:**
- `total` is always **7** for all non-workout items, regardless of how many days were logged. This gives agents an accurate compliance signal — "Rug Protocol: 1/7" is truthful, not "1/2" because only 2 days were logged.
- `days_logged` is included separately so the UI can show context (e.g., "5 of 7 days logged")
- `workouts.planned` comes from plan_items count for that week
- `core.target` is always 3 (non-negotiable rule)
- `vampire.compliant` counts days where stored bedtime < "23:00" (24h+ format makes this a safe numeric comparison)
- `vampire.daily` includes only days where bedtime was logged (for the per-day breakdown in agent context)

## 5. Daily Log Page (`/log`)

### URL Structure

- `/log` — shows today's date by default
- `/log?date=2026-03-18` — view/edit a specific past date
- Cannot navigate to future dates (past today)

### Layout (Mobile-First)

```
+------------------------------+
|  <  Thursday, Mar 20 2026  > |  Date navigation arrows + date picker
|     Week 12                   |
+------------------------------+
|                               |
|  # SICK DAY                   |  Toggle switch, prominent, red when active
|                               |
+------------------------------+
|  TODAY'S SESSION              |
|  +------------------------+  |
|  | Upper Body + Core       |  |  From plan_items for this day
|  | Pull-up progression,    |  |
|  | bench press, rows       |  |
|  |                         |  |
|  | [ ] Session completed   |  |  Single checkbox
|  +------------------------+  |
+------------------------------+
|  DAILY CHECKLIST              |
|                               |
|  [ ] Core work done           |
|  [ ] Rug Protocol (GOWOD)    |
|  [ ] Kitchen Cutoff (20:00)  |
|  [ ] Hydration tracked        |
|                               |
|  Bedtime   [ 23:15 ]         |  Time picker input
|                               |
+------------------------------+
|  NOTES                        |
|  +------------------------+  |
|  | Knee felt tight during  |  |  Multiline text area
|  | squats                  |  |
|  +------------------------+  |
+------------------------------+
|  WEEK OVERVIEW                |
|  Mon * Tue * Wed o Thu @      |  Dots: * = all done, @ = partial,
|  Fri o Sat . Sun o            |  o = no log, . = family day
+------------------------------+
```

### Behavior

**Auto-save:** Every toggle, time change, or text edit triggers a debounced save (500ms delay). No submit button. Visual confirmation: brief "Saved" indicator that fades. On save failure (network error), show a red "Save failed — retrying" indicator and retry once after 2 seconds. If retry fails, show persistent "Offline — changes not saved" until next successful save.

**Sick day toggle:**
- When toggled ON: hides "Today's Session", "Core work", "Rug Protocol", "Kitchen Cutoff" sections. Shows only hydration, bedtime, and notes.
- Rationale: when sick with fever, you're not training. But hydration and sleep still matter for recovery.
- When toggled OFF: all sections reappear with their previous values preserved.

**Today's Session section:**
- If a plan_item exists for this day -> shows session type, focus, and workout summary with a completion checkbox
- If no plan_item (rest day) -> shows "Rest Day" label, no checkbox
- If it's the designated family day -> shows "Family Day" label, no checkbox
- Family day detection: hardcoded to Saturday. Weekend swap detection is deferred to a future enhancement — for now, if the athlete swaps Saturday/Sunday they simply log on both days as appropriate.

**Bedtime time picker:**
- Standard time picker UI showing HH:MM
- If the athlete selects a time between 00:00 and 05:59, the UI shows a subtle note: "After midnight — logged as next-day bedtime"
- Storage converts to 24h+ format (00:30 -> "24:30") before sending to the API
- Display converts back (stored "24:30" -> displayed "00:30 (+1)")

**Week overview dots:**
- Row of 7 dots for Mon-Sun
- Tapping a dot navigates to that day's log
- Dot states:
  - Filled: log exists and all applicable items checked
  - Half: log exists but incomplete
  - Empty: no log for this day
  - Dimmed: family day (no logging expected)
- Current day is highlighted/ringed

**Date navigation:**
- Left/right arrows step one day
- Tapping the date header opens a date picker
- Cannot navigate past today
- Can go back to any past date (for backfilling missed days)

### Desktop Layout

On wider screens (md+), the layout stays single-column but with more horizontal padding and larger touch targets. The daily log is intentionally simple — no multi-column layout needed.

## 6. Check-in Integration

### Agent Context Injection

In `lib/agents.ts` -> `buildSharedContext()`, add a call to the week summary logic (direct function call from `lib/daily-log.ts`, not via HTTP). Format as a markdown block appended to the shared context:

```markdown
## Daily Log Summary (Week 13)
- Days logged: 5/7
- Workouts completed: 4/4
- Core work: 2/3 target days (missed Wednesday)
- Rug Protocol: 5/7 days (2 days not logged)
- Vampire Protocol: 3/7 compliant (avg bedtime 23:45)
  - Mon 22:30 check, Tue 23:15 x, Wed 00:30 x, Thu 23:00 check, Fri 01:15 x, Sat 22:45 check, Sun 23:30 x
- Hydration tracked: 0/7 days
- Kitchen Cutoff: 6/7
- Sick days: 0
- Notes:
  - Tue: knee tight during squats
  - Thu: kid up 3x overnight
```

**Denominator is always 7** so agents see accurate compliance rates. Days without logs are implicitly treated as non-compliant, which is the correct conservative assumption.

**Placement:** After Garmin data, before subjective ratings. All 7 specialist agents receive this block. No changes to agent persona files — agents already understand compliance metrics from the non-negotiable rules in their context.

### Check-in Form Pre-fill

When `CheckInForm` loads on `/checkin`:

1. Fetch the current week's daily log summary
2. Pre-fill form fields, mapping daily log data to existing form field types:
   - `rug_protocol_days` (integer 0-7) -> `rug_protocol.done`
   - `bedtimeCompliance` (integer 0-7) -> `vampire.compliant`
   - `hydration_tracked` (boolean) -> `hydration.tracked > 0`
   - `sessions_completed` (integer) -> `workouts.completed`
3. Show a small indicator: "Pre-filled from daily logs" so the athlete knows
4. All pre-filled values are editable — the athlete can override before submitting
5. If no daily logs exist for the week -> fields remain empty (current behavior preserved)

## 7. TrainingPlanTable Simplification

### Remove Completion Tracking

**Current behavior:** `TrainingPlanTable.tsx` renders expandable rows with sub-task checkboxes and athlete notes editing. Each checkbox triggers `PATCH /api/plan/complete` to update `plan_items.sub_tasks` JSON. Notes editing uses `updatePlanItemNotes()`.

**New behavior:** `TrainingPlanTable.tsx` renders the weekly schedule as a read-only table. No checkboxes, no expandable sub-task rows, no athlete notes editing. The component displays:
- Day
- Session type
- Focus
- Workout plan (collapsed/expandable for long content)
- Coach's cues

**Athlete notes on plan items are removed.** The daily log's per-day notes field replaces this — it serves the same purpose (capturing session observations) and feeds directly into the check-in pipeline.

### Endpoint Migration

The existing `app/api/plan/complete/route.ts` handles both `GET` (list plan items) and `PATCH` (toggle completion). The `GET` handler is used by 3 pages:
- `app/page.tsx` — dashboard homepage (fetches today's plan items)
- `app/plan/page.tsx` — weekly plan view (fetches current week's plan items)
- `app/plan/[weekNumber]/page.tsx` — week detail (fetches specific week's plan items)

**Migration plan:**
1. Move the `GET` handler from `app/api/plan/complete/route.ts` to `app/api/plan/route.ts` (new file, or add GET to existing if it exists)
2. Update all 3 consumer pages to fetch from `/api/plan` instead of `/api/plan/complete`
3. Remove all `PATCH` calls from `app/page.tsx` and `app/plan/page.tsx` (these are the completion toggle calls)
4. Delete `app/api/plan/complete/route.ts`

### Dead Code Cleanup

After removing completion tracking and plan-item notes editing, the following become dead code and should be removed from `lib/db.ts`:
- `togglePlanItemComplete()` (if it exists)
- `updatePlanItemSubTasks()` (if it exists)
- `updatePlanItemNotes()` (if it exists)
- Any helper functions exclusively used by the PATCH handler

### Data Preservation

- The `plan_items` table schema is unchanged
- Existing `sub_tasks` column data is retained (historical record)
- `plan_items` insert logic during check-in continues to work (the schedule is still generated and stored)

## 8. Files Changed / Created

### New Files

| File | Purpose |
|------|---------|
| `app/log/page.tsx` | Daily log page with date routing |
| `components/DailyLog.tsx` | Main daily log form (checkboxes, time picker, notes, auto-save with error handling) |
| `components/WeekDots.tsx` | Week overview dot navigation component |
| `app/api/log/route.ts` | `GET /api/log?date=` and `PUT /api/log` |
| `app/api/log/week/route.ts` | `GET /api/log/week?week=` |
| `app/api/log/week-summary/route.ts` | `GET /api/log/week-summary?week=` |
| `app/api/plan/route.ts` | `GET /api/plan?week=` (migrated from plan/complete) |
| `lib/daily-log.ts` | Shared logic: week summary computation (reuses `getTrainingWeek()` from `lib/week.ts`), plan_item date matching, bedtime format conversion |

### Modified Files

| File | Change |
|------|--------|
| `lib/db.ts` | Add `daily_logs` table, bump schema version 3 -> 4, remove dead completion/notes helpers |
| `lib/agents.ts` | Add daily log summary to `buildSharedContext()` |
| `components/TrainingPlanTable.tsx` | Remove sub-task checkboxes and athlete notes editing, make read-only |
| `components/CheckInForm.tsx` | Pre-fill fields from daily log week summary |
| `components/Sidebar.tsx` | Add "Daily Log" nav item |
| `app/page.tsx` | Update plan fetch URL from `/api/plan/complete` to `/api/plan`, remove PATCH calls |
| `app/plan/page.tsx` | Update plan fetch URL, remove PATCH calls |
| `app/plan/[weekNumber]/page.tsx` | Update plan fetch URL |

### Removed Files

| File | Reason |
|------|--------|
| `app/api/plan/complete/route.ts` | GET migrated to `/api/plan`, PATCH replaced by daily log |

## 9. Scope Boundaries

**In scope:**
- `daily_logs` SQLite table with schema migration
- Daily log page (`/log`) with auto-save, sick day toggle, date navigation, save error handling
- Week overview dots component
- API endpoints for daily log CRUD and weekly summaries
- Check-in agent context injection (daily log summary block with 7-day denominators)
- Check-in form pre-fill from daily log data (mapped to existing form field types)
- TrainingPlanTable simplification (remove completion tracking)
- Migrate GET handler from `/api/plan/complete` to `/api/plan`
- Remove PATCH handler and update all consumer pages
- Dead code cleanup in `lib/db.ts`
- Bedtime 24h+ format handling (storage and UI conversion)

**Out of scope (deferred to Spec 3):**
- Mobile/desktop UI audit and polish
- Push notifications or reminders
- Hydration amount tracking (just yes/no for now)
- Historical daily log trends or charts
- Any deployment or auth changes
- Weekend day swap mechanism (family day hardcoded to Saturday)

## 10. Verification Criteria

Spec 2 is complete when:

1. `/log` page loads showing today's date with correct planned session
2. All checklist items toggle and auto-save (verify in DB)
3. Auto-save shows error state on network failure and retries
4. Sick day toggle hides workout/core/rug/kitchen, shows hydration + bedtime + notes
5. Bedtime time picker handles after-midnight correctly (00:30 stored as "24:30", displayed as "00:30 (+1)")
6. Bedtime compliance correctly identifies "24:30" as non-compliant
7. Date navigation works (arrows, picker), cannot go past today
8. Week overview dots reflect correct states (filled/half/empty/family)
9. Tapping a week dot navigates to that day's log
10. `GET /api/log/week-summary` returns correct aggregated data with 7-day denominators
11. Check-in form pre-fills from daily log data when available, mapped to existing field types
12. Check-in agent context includes daily log summary block with accurate compliance rates
13. TrainingPlanTable renders read-only (no checkboxes)
14. `/api/plan` GET endpoint works, all 3 consumer pages updated
15. `app/api/plan/complete/route.ts` is deleted, no PATCH calls remain in codebase
16. Dead completion helpers removed from `lib/db.ts`
17. Backfilling a past day's log works correctly
18. Empty week (no daily logs) doesn't break check-in (graceful fallback, 0/7 for all metrics)
