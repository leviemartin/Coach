# Daily Log Page v2 — Smart Features

**Date:** 2026-03-21
**Status:** Draft
**Scope:** Enhance the existing daily log page with contextual workout labels, flexible session completion, one-tap bedtime logging, compliance indicators, progress tracking, streaks, and compliance trends
**Depends on:** Spec 2 (Daily Log + Tracking) — already implemented
**Blocks:** None

---

## 1. Problem Statement

The daily log page (Spec 2) is functional but lacks smart features that make it feel like a coaching tool rather than a checkbox list. Specific gaps:

- No visible workout label in the header — the athlete can't tell at a glance what session is planned
- Sessions are locked to their planned day — if the gym isn't available on Tuesday, there's no way to log Tuesday's workout on Wednesday
- Bedtime entry requires manually typing a time instead of one-tap "I'm going to bed now"
- No real-time feedback on how the day or week is shaping up
- No streak tracking to reinforce consistency
- No compliance trends to show progress over weeks/months

**Goal:** Make the daily log page best-in-class by adding contextual awareness, minimal-friction logging, real-time compliance feedback, and trend visibility — all without changing the underlying data model.

## 2. Component Architecture

```
page.tsx (date nav, header with workout label chip, week dots)
  |
DailyLog.tsx (parent — state orchestration + auto-save)
  |-- DayProgress.tsx         — progress ring + streak counter
  |-- SessionPicker.tsx       — flexible workout selection + completion
  |-- DailyChecklist.tsx      — core, rug, kitchen, hydration with compliance indicators
  |-- BedtimeCard.tsx         — "Lights Out" button + time picker + compliance indicator
  |-- NotesCard.tsx           — free-text notes
  |-- WeekComplianceBar.tsx   — per-metric tallies + overall week compliance %
  |-- ComplianceSparkline.tsx — last 4 weeks mini sparkline
```

**State management:** All form state lives in `DailyLog.tsx`. Each child receives its slice of `formData` + an `onUpdate` callback. Auto-save debounce (500ms) stays in the parent. Children don't know about persistence.

**Data flow:**
- `page.tsx` fetches: day log, week logs, uncompleted sessions for the week, streak data, compliance history
- Passes everything to `DailyLog.tsx`
- `DailyLog.tsx` computes derived values (progress, compliance counts) and distributes to children
- Compliance math functions live in `lib/daily-log.ts`

## 3. Feature Specifications

### 3.1 Workout Label Chip in Header

**Location:** Two places:
1. In the date navigation header (in `page.tsx`), as a chip below the date/week line
2. In the SessionPicker card, next to the completion checkbox

**Content:** The planned session's `focus` field (e.g. "Upper Pull & Grip"). Falls back to:
- "Rest Day" chip on days with no planned session
- "Family Day" chip on Saturdays

**Source:** From the `planned_session` data already returned by `GET /api/log?date=`.

### 3.2 Flexible Session Completion (SessionPicker.tsx)

**Default behavior:** Shows today's planned session pre-selected and highlighted.

**Flexible mode:** Below today's session, shows a collapsible list of all uncompleted sessions for the current week. Each row displays: `Day · Focus label` (e.g. `Tuesday · Upper Pull & Grip`).

- Today's session is pre-selected
- If today has no planned session (rest day), the list is expanded by default
- Athlete selects which session they're completing, then checks the completion box
- Once a session is marked completed on any day, it disappears from the list on all other days
- Completion saves with the selected session's `plan_item_id`, not the current day's planned session

**Completion checkbox:** Displayed with the workout label chip repeated next to it for context.

**Edge cases:**
- No plan for the week: shows "No plan this week" with link to check-in
- All sessions completed: shows "All sessions done this week" with green indicator
- Sick day toggled on: SessionPicker hidden

**API change:** `GET /api/log?date=YYYY-MM-DD` response adds `uncompleted_sessions` array — all `plan_items` for that week where no `daily_logs` row has `workout_completed=1` with a matching `workout_plan_item_id`. Requires a LEFT JOIN between `plan_items` and `daily_logs`.

### 3.3 "Lights Out" Bedtime Button (BedtimeCard.tsx)

**Button behavior:**
- Prominent button at the top of the bedtime card (dark/indigo styling, moon icon)
- One tap stamps `new Date()` formatted as HH:MM into the bedtime field
- After tapping, button text changes to "Logged at 22:47" with a small "Edit" link
- If a bedtime is already logged, button shows the logged time instead of "Lights Out"

**Time picker:** Remains below the button for manual adjustment. Same after-midnight detection and 24h+ storage format as current implementation.

**Compliance indicator:** Inline badge below the time:
- Before 23:00: green "On time"
- 23:00-00:00: yellow "Late"
- After 00:00: red "Way late"

### 3.4 Daily Checklist with Compliance Indicators (DailyChecklist.tsx)

Each checkbox item shows a small inline indicator of the week's running tally for that metric. The indicator is caption-sized text with a colored dot — not loud, but always visible. Updates in real-time as items are checked.

**Items and targets:**
| Item | Target | Indicator |
|------|--------|-----------|
| Core work done | 3/week | `2/3 this week` |
| Rug Protocol (GOWOD) | 7/week | `5/7 this week` |
| Kitchen Cutoff (20:00) | 7/week | `6/7 this week` |
| Hydration tracked | 7/week | `0/7 this week` |

**Universal compliance colors:**
- Green: target met (full compliance)
- Yellow: 1-2 behind target
- Red: 3+ behind target

**Session completion indicator** (in SessionPicker): `3/4 completed` where denominator is planned sessions for the week. Same color rules.

**Data source:** Computed client-side from the `weekLogs` array already fetched by `page.tsx`. No new API call needed.

### 3.5 Day Progress Ring & Streak Counter (DayProgress.tsx)

**Progress ring:**
- Circular progress indicator positioned below the week dots, above the cards
- Shows fraction and fills proportionally (e.g. `4/6` with ring 67% filled)
- Denominator adjusts per day type:
  - Normal day: 6 items (session, core, rug, kitchen, hydration, bedtime)
  - Sick day: 2 items (hydration, bedtime)
  - Rest day with no session: 5 items (no session to complete)
  - Family day (Saturday): not applicable (no daily log expected)
- Fills in real-time as checkboxes are toggled
- At 100%: ring turns green with a subtle pulse animation

**Streak counter:**
- Displayed inside or directly below the progress ring
- Format: `12 day streak` with flame-colored accent
- **Compliance-based:** a day counts toward the streak if >=80% of applicable items are checked
- **Sick days:** with both hydration + bedtime logged = streak maintained
- **Family days (Saturday):** excluded — don't break or extend the streak
- Below the current streak: `Best: 23 days` in smaller text — all-time record, never resets

**Streak calculation:** Server-side in `lib/daily-log.ts`. Function `computeStreak(date: string)` walks backward through `daily_logs` counting consecutive compliant days. Returns `{ current: number, best: number }`.

**Best streak storage:** Computed on the fly by scanning all daily logs. The table is small (max ~365 rows/year), so a full scan is acceptable. No separate storage needed.

**API:** Add `streak` object to the `GET /api/log?date=` response: `{ current: 12, best: 23 }`.

### 3.6 Week Compliance Bar (WeekComplianceBar.tsx)

**Layout:** Horizontal bar below the daily cards, always visible.

**Left side:** Per-metric compact tallies as small chips/badges:
`Sessions 3/4 | Core 2/3 | Rug 5/7 | Kitchen 6/7 | Hydration 0/7 | Bedtime 3/7`

Each chip colored green/yellow/red per the universal compliance rule (Section 3.4).

**Right side:** Overall **Week Compliance %** in a larger, bold number (e.g. `62%`).

**Compliance % formula:**
- Numerator: sum of all checked items across all logged days this week
- Denominator: sum of all applicable items for logged days
- Sick days: only hydration + bedtime count (denominator = 2 for that day)
- Family days (Saturday): excluded entirely
- As the week progresses, the denominator grows naturally

**Example:** Monday (6/6) + Tuesday (4/6) + Wednesday sick (2/2) = 12/14 = 86%

### 3.7 Compliance Sparkline (ComplianceSparkline.tsx)

**Location:** Directly below the week compliance bar on the daily log page.

**Content:** Simple sparkline showing the last 4 weeks' final compliance percentages. Each point labeled: `W9: 71% | W10: 68% | W11: 74% | W12: --`

- Current week shows as a dashed/in-progress point
- Tapping the sparkline navigates to the Trends page

### 3.8 Compliance Trends on Trends Page

**New chart:** "Weekly Compliance" line chart added to `/trends`.

- X-axis: weeks (or months in monthly view)
- Y-axis: 0-100%
- Toggle between weekly and monthly (monthly = average of that month's weeks)
- Sits alongside existing weight/body comp charts

**API:** New endpoint `GET /api/log/compliance-trend?weeks=12` returns:
```json
{
  "trend": [
    { "week_number": 9, "compliance_pct": 71, "days_logged": 6 },
    { "week_number": 10, "compliance_pct": 68, "days_logged": 5 },
    { "week_number": 11, "compliance_pct": 74, "days_logged": 7 }
  ]
}
```

**Computation:** New function `getComplianceTrend(weeks: number)` in `lib/daily-log.ts` computes the final compliance % for each past week.

## 4. Sick Day Behavior

Unchanged from Spec 2 with these clarifications for new features:

- **SessionPicker:** hidden
- **DailyChecklist:** hidden, except hydration checkbox which moves to a standalone card
- **BedtimeCard:** visible (bedtime still matters when sick)
- **DayProgress ring:** denominator = 2 (hydration + bedtime)
- **Streak:** sick day with both items checked = streak maintained
- **Week compliance %:** sick day contributes 2 to denominator, not 6
- **NotesCard:** visible (important for logging illness details)

## 5. Page Layout Order (Top to Bottom)

1. Date navigation header with workout label chip
2. Week dots
3. Day progress ring + streak counter
4. Sick day toggle
5. Session picker (hidden if sick)
6. Daily checklist with compliance indicators (hidden if sick; hydration standalone if sick)
7. Bedtime card with Lights Out button + compliance indicator
8. Notes card
9. Week compliance bar (per-metric tallies + overall %)
10. Compliance sparkline (last 4 weeks)

## 6. API Changes

### Modified: `GET /api/log?date=YYYY-MM-DD`

Add to response:
```json
{
  "log": { "..." },
  "planned_session": { "..." },
  "uncompleted_sessions": [
    { "id": 41, "day": "Tuesday", "session_type": "Strength", "focus": "Upper Pull & Grip" },
    { "id": 43, "day": "Thursday", "session_type": "Conditioning", "focus": "Rower Intervals" }
  ],
  "streak": { "current": 12, "best": 23 }
}
```

### New: `GET /api/log/compliance-trend?weeks=12`

Returns weekly compliance percentages for the last N weeks.

```json
{
  "trend": [
    { "week_number": 9, "compliance_pct": 71, "days_logged": 6 },
    { "week_number": 10, "compliance_pct": 68, "days_logged": 5 }
  ]
}
```

### Unchanged

- `PUT /api/log` — no changes, but `workout_plan_item_id` may now reference a session from a different day (flexible completion)
- `GET /api/log/week` — unchanged, still returns week logs for dot states and client-side compliance computation
- `GET /api/log/week-summary` — unchanged, used by check-in integration

## 7. New Logic in `lib/daily-log.ts`

### `computeStreak(date: string): { current: number, best: number }`
Walks backward through `daily_logs` from the given date. A day is compliant if >=80% of applicable items are checked. Skips family days (Saturdays). Returns current consecutive streak and all-time best.

### `computeDayCompliancePct(log: DailyLog, isSickDay: boolean): number`
Returns 0-100 for a single day. Adjusts denominator for sick days (2) vs normal days (5 or 6 depending on planned session).

### `computeWeekCompliancePct(weekLogs: DailyLog[], plannedSessionCount: number): number`
Aggregates all days in the week. Returns 0-100.

### `getComplianceTrend(weeks: number): Array<{ week_number, compliance_pct, days_logged }>`
Computes final compliance % for each of the last N weeks.

## 8. Files Changed / Created

### New Files

| File | Purpose |
|------|---------|
| `components/SessionPicker.tsx` | Flexible workout selection + completion |
| `components/DailyChecklist.tsx` | Checkboxes with weekly compliance indicators |
| `components/BedtimeCard.tsx` | Lights Out button + time picker + compliance indicator |
| `components/DayProgress.tsx` | Progress ring + streak counter |
| `components/WeekComplianceBar.tsx` | Per-metric tallies + overall week compliance % |
| `components/ComplianceSparkline.tsx` | Last 4 weeks mini sparkline |
| `components/NotesCard.tsx` | Extracted notes text field |
| `app/api/log/compliance-trend/route.ts` | Compliance trend endpoint |

### Modified Files

| File | Change |
|------|--------|
| `app/log/page.tsx` | Add workout label chip to header, fetch uncompleted sessions + streak, pass new props |
| `components/DailyLog.tsx` | Refactor into orchestrator — distribute state to new sub-components |
| `lib/daily-log.ts` | Add streak computation, day/week compliance %, compliance trend |
| `app/api/log/route.ts` | Add `uncompleted_sessions` and `streak` to GET response |
| `components/TrendCharts.tsx` | Add weekly compliance chart |
| `app/api/trends/route.ts` | Include compliance trend data (or consumed from new endpoint) |

### Removed Files

| File | Reason |
|------|--------|
| None | This spec enhances, does not remove |

## 9. Scope Boundaries

**In scope:**
- Workout label chip in header and session card
- Flexible session completion from weekly uncompleted list
- "Lights Out" one-tap bedtime button
- Per-item compliance indicators (green/yellow/red)
- Day progress ring with real-time fill
- Compliance-based streak counter with best-streak tracking
- Week compliance bar with overall %
- Compliance sparkline (last 4 weeks on daily log page)
- Full compliance trend chart on Trends page
- Sick day denominator adjustment for all compliance math
- API additions for uncompleted sessions, streak, compliance trend

**Out of scope:**
- Garmin bedtime auto-detection / reconciliation
- Push notifications or reminders
- Time-of-day adaptive reordering (morning vs evening view)
- Gamification beyond streaks (badges, levels, rewards)
- Home screen widget
- Weekend day swap mechanism (remains hardcoded Saturday = family)
- Changes to the data model (`daily_logs` table unchanged)
- Changes to check-in integration (Spec 2 handles this)

## 10. Verification Criteria

1. Workout label chip visible in header, showing correct session focus for the selected day
2. Workout label chip shows "Rest Day" / "Family Day" on appropriate days
3. SessionPicker shows all uncompleted sessions for the week
4. Completing a session on a non-planned day correctly links to that session's `plan_item_id`
5. Completed sessions disappear from the uncompleted list on all days
6. "Lights Out" button stamps current time and toggles to "Logged at HH:MM"
7. Bedtime compliance indicator shows correct color (green/yellow/red)
8. All checklist items show weekly running tally with correct colors
9. Day progress ring updates in real-time as items are checked
10. Progress ring shows 100% green pulse when all items complete
11. Progress ring denominator adjusts correctly for sick days (2) and rest days (5)
12. Streak counter shows correct current streak (>=80% compliance-based)
13. Streak survives sick days with both items checked
14. Streak skips family days (Saturdays)
15. Best streak displays and never resets
16. Week compliance bar shows correct per-metric tallies with colors
17. Week compliance % computes correctly with sick day denominator adjustment
18. Compliance sparkline shows last 4 weeks with current week as in-progress
19. Tapping sparkline navigates to Trends page
20. Trends page shows weekly compliance line chart with week/month toggle
21. `GET /api/log?date=` returns `uncompleted_sessions` and `streak`
22. `GET /api/log/compliance-trend?weeks=N` returns correct data
23. All new components render correctly on mobile (max-width 600px layout)
24. Auto-save still works with debounce across all new components
