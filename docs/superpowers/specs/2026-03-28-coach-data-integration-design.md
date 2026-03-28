# Coach Data Integration: RPE, Duration & Metrics Enrichment

**Date:** 2026-03-28
**Status:** Approved
**Scope:** Close 8 data flow gaps between athlete input, coach context, and historical persistence

## Problem

The session tracker now captures per-exercise RPE (1-5) and actual duration for time-based exercises. But coaches never see this data in structured form — it only exists as text blobs in session summaries. Additionally, several existing data points (week reflections, sick days, pain areas, sleep disruption causes) are collected but leak out of the history pipeline, making multi-week trend detection impossible.

## Gaps Addressed

| # | Gap | Category |
|---|-----|----------|
| 1 | RPE & duration not in structured coach context | Coach blind spot |
| 2 | Coach personas lack RPE/duration diagnostic rules | No action triggers |
| 3 | No RPE metrics in weekly_metrics for tiered history | Data loss |
| 4 | Coach cues don't explain RPE-driven adjustments | No feedback loop |
| 5 | Week reflection/conflicts/questions not stored | Data loss |
| 6 | Sick days not in weekly_metrics | Data loss |
| 7 | Pain area summary lost in weekly aggregation | Data loss |
| 8 | Sleep disruption not aggregated by cause | Data loss |

## Design

### 1. Structured RPE & Duration in Coach Context

**File:** `dashboard/lib/agents.ts` — `buildSessionDetailsSection()`

Currently queries `getWeekSessions()` which returns sets and cardio per session. Extend to also call `getExerciseFeedback()` per session and read `actualDurationS`/`actualDurationMin` from the set/cardio data already returned.

**Format change for session details passed to coaches:**

Before:
```
### Session: Upper Push (Mon, 95% compliance)
- Bench Press: 3/3 sets @ 80kg ✓
- Incline DB Press: 3/3 sets @ 22.5kg ✓ (prescribed 20kg)
- Dead Hang: 3/3 sets
- Zone 2 Walk: 1/1 rounds ✓
```

After:
```
### Session: Upper Push (Mon, 95% compliance)
- Bench Press: 3/3 sets @ 80kg ✓ | RPE: 3/5 (Right)
- Incline DB Press: 3/3 sets @ 22.5kg ✓ (prescribed 20kg) | RPE: 4/5 (Hard)
- Dead Hang: 3/3 sets | RPE: 5/5 (Too Hard) | Duration: 40s → 30s (set 3)
- Zone 2 Walk: 1/1 rounds ✓ | Duration: 20min → 25min
```

RPE and duration annotations only appear when data exists. Exercises without feedback show no annotation (no "RPE: —" noise).

**Data retrieval:** `getExerciseFeedback(sessionId)` already exists from the session tracker implementation. Import and call it in `buildSessionDetailsSection()`.

**Duration extraction:** `SessionSetState` already has `prescribedDurationS` and `actualDurationS`. `SessionCardioState` already has `prescribedDurationMin` and `actualDurationMin`. These are returned by `getWeekSessions()` — just need to be formatted into the output string.

### 2. Weekly Metrics Enrichment

**File:** `dashboard/lib/db.ts` — schema migrations + `upsertWeeklyMetrics()`
**File:** `dashboard/lib/types.ts` — `WeeklyMetrics` interface

Eight new columns on `weekly_metrics`:

| Column | Type | Source | Computation |
|--------|------|--------|-------------|
| `avg_rpe` | REAL | `session_exercise_feedback` | Mean of all RPE values for exercises completed this week |
| `hard_exercise_count` | INTEGER | `session_exercise_feedback` | Count of exercises with RPE >= 4 this week |
| `week_reflection` | TEXT | SubjectiveInputs form | Direct from athlete input |
| `next_week_conflicts` | TEXT | SubjectiveInputs form | Direct from athlete input |
| `questions_for_coaches` | TEXT | SubjectiveInputs form | Direct from athlete input |
| `sick_days` | INTEGER | `daily_logs` | Count of `is_sick_day = 1` for the week |
| `pain_areas_summary` | TEXT | `daily_logs` | JSON: `[{"area":"lower back","days":3,"maxLevel":2}]` |
| `sleep_disruption_breakdown` | TEXT | `daily_logs` | JSON: `{"kids":4,"stress":1,"pain":1}` |

**Computation timing:** These are computed during the checkin flow when `upsertWeeklyMetrics()` is called. The RPE fields query `session_exercise_feedback` joined to `session_logs` for the current week. The daily log aggregations query `daily_logs` for the current week.

**Tiered history impact:** `buildTieredHistory()` in `tiered-history.ts` already reads from `weekly_metrics` for weeks 3-8 summaries. The new fields will automatically appear in the weekly summary tier once they exist in the table. The build function needs to be updated to format these new fields into the summary text:

- `avg_rpe` and `hard_exercise_count` → "Avg RPE: 3.4, Hard exercises (RPE≥4): 5"
- `sick_days` → "Sick days: 1" (only if > 0)
- `pain_areas_summary` → "Pain: lower back (3 days, max level 2), knee (1 day, max level 1)"
- `sleep_disruption_breakdown` → "Sleep disruptions: kids ×4, pain ×1"
- `week_reflection` → "Reflection: [text]" (truncated to 200 chars for summary tier)

### 3. Subjective Input Persistence

**File:** `dashboard/app/api/checkin/route.ts` — where SubjectiveInputs are processed

Currently, `weekReflection`, `nextWeekConflicts`, and `questionsForCoaches` from `CheckinSubjectiveData` are passed into the coach context but never stored. The checkin POST handler calls `upsertWeeklyMetrics()` — extend it to include these three text fields.

**No UI change needed.** SubjectiveInputs.tsx already collects these fields. The data just needs to flow through to the database.

### 4. Shared Data Reference in CLAUDE.md

**File:** `CLAUDE.md` — Section 6 (Diagnostic Logic)

Add a new subsection "Session Feedback Data (All Coaches)" that describes:

```markdown
### Session Feedback Data (All Coaches)
Coaches now receive per-exercise RPE and actual duration data in the session details section.

**RPE Scale (1-5):**
| RPE | Label | Meaning |
|-----|-------|---------|
| 1 | Too Easy | Could double the sets. Load needs to go up. |
| 2 | Easy | Comfortable throughout. 3+ reps in reserve. |
| 3 | Right | Challenging but manageable. 1-2 reps in reserve. Target zone. |
| 4 | Hard | Last set was a grind. 0-1 reps in reserve. |
| 5 | Too Hard | Form broke down or failed. Load needs to come down. |

RPE 1 and 5 are signals to adjust programming. RPE 2-4 is the working range.

**Duration Actuals:** For timed exercises (holds, hangs, cardio), actual duration appears alongside prescribed when the athlete logged a different value. Format: "Duration: 40s → 30s".

**Weekly Metrics (available in tiered history):**
- `avg_rpe` — mean RPE across all exercises that week
- `hard_exercise_count` — exercises rated RPE ≥ 4
- `sick_days` — days marked sick (context for low compliance)
- `pain_areas_summary` — which body areas, how many days, max severity
- `sleep_disruption_breakdown` — cause counts (kids, stress, pain, other)
- `week_reflection` — athlete's own narrative summary
- `questions_for_coaches` — must be addressed in synthesis
```

### 5. Domain-Specific Diagnostic Rules

Each specialist persona file gets 2-4 action rules for the new data. These follow the existing pattern (e.g., "Cortisol Floor Rule → Recovery Agent").

**Strength & Hypertrophy (01):**
```markdown
### RPE Overload Rule (Strength Agent)
If same exercise shows RPE ≥ 4 for 2+ consecutive weeks → reduce weight 5-10% next week.
If same exercise shows RPE ≤ 2 for 2+ consecutive weeks → increase weight 5-10% next week.

### Duration Progression Rule (Strength Agent)
If actual duration < prescribed on timed holds → reduce prescribed to actual + 5s next week. Do not jump back to original prescription.
```

**Endurance & Energy Systems (02):**
```markdown
### Cardio Duration Rule (Endurance Agent)
If cardio actual duration < prescribed → flag conditioning gap, hold current prescription.
If cardio actual duration > prescribed → athlete progressing, increase 10% next week.

### Effort-Effect Cross-Reference (Endurance Agent)
If RPE 5 but Garmin anaerobic TE < 1.0 → form or pacing issue, not true max effort. Cue technique, don't reduce intensity.
```

**Recovery & Sleep (05):**
```markdown
### RPE-Readiness Cross-Reference (Recovery Agent)
If week avg_rpe > 3.5 AND combined readiness < 40 → flag overreaching, recommend deload.
If hard_exercise_count > 6 in a week → recommend deload regardless of readiness.

### Sleep Disruption Triage (Recovery Agent)
"kids" disruptions = uncontrollable, do not reduce training volume for these.
"pain" disruptions = actionable, escalate to Mobility agent for prehab adjustment.
"stress" disruptions = behavioral, flag for Mental Performance agent.

### Sick Day Context (Recovery Agent)
If sick_days > 0, low compliance that week is medical, not behavioral. Do not flag as adherence failure.
```

**Mobility & Injury Prevention (06):**
```markdown
### Chronic Pain Detection (Mobility Agent)
If pain_areas_summary shows same area for 3+ consecutive weeks → flag for physio referral regardless of severity.
If RPE 5 on exercises involving a tracked pain area → immediate load reduction, not monitoring.

### Night Pain Cross-Reference (Mobility Agent)
If sleep disruption "pain" count > 2 AND pain_areas_summary shows active area → escalate severity: daytime pain + night pain = acute, not chronic management.
```

**Mental Performance & Habits (07):**
```markdown
### Narrative Theme Tracking (Mental Performance Agent)
Track recurring themes in week_reflection across weeks (stress, motivation, confidence, fatigue). Flag when a theme appears 3+ times in 4 weeks.

### Sick Day Compliance (Mental Performance Agent)
Do not flag compliance failures in weeks with sick_days > 0 as behavioral issues.

### Conflict Follow-Up (Mental Performance Agent)
If next_week_conflicts were logged last week, verify the plan accommodated them. If not, flag the gap.
```

**Head Coach (00):**
```markdown
### Questions Must Be Answered (Head Coach)
If questions_for_coaches is non-empty, the synthesis MUST address each question explicitly. No unanswered questions.

### RPE-Driven Changes (Head Coach)
When the plan adjusts weight, duration, or volume based on RPE data, state the reason in Coach's Cues. Format: "Adjusted [what] — RPE [value] last [timeframe]." Only add RPE cues when the prescription changed.

### Reflection Integration (Head Coach)
Reference week_reflection themes in the opening analysis when they relate to training decisions.
```

**OCR & Functional (03) and Nutrition & Body Comp (04):**
No new diagnostic rules. They see all data and benefit from RPE visibility in session details, but no domain-specific action triggers needed.

### 6. Coach Output Convention

Covered by the Head Coach rule above: "When adjusting weight, duration, or volume based on RPE data, state the reason in Coach's Cues." This applies to any coach that prescribes exercises — the Head Coach synthesizes all specialist recommendations into the plan, so the rule at Head Coach level covers all output.

## Files Affected

| File | Change |
|------|--------|
| `dashboard/lib/agents.ts` | `buildSessionDetailsSection()` — add RPE and duration to exercise lines. `buildTieredHistory()` call site — format new weekly_metrics fields. |
| `dashboard/lib/tiered-history.ts` | Format new weekly_metrics fields into summary tier (weeks 3-8) |
| `dashboard/lib/db.ts` | Add 8 columns to weekly_metrics (migrations). Update `upsertWeeklyMetrics()` to accept and store new fields. |
| `dashboard/lib/types.ts` | Extend `WeeklyMetrics` interface with 8 new fields. Extend `CheckinSubjectiveData` if needed. |
| `dashboard/app/api/checkin/route.ts` | Pass subjective text fields through to `upsertWeeklyMetrics()`. Compute RPE aggregates, sick days, pain summary, disruption breakdown. |
| `CLAUDE.md` | Add "Session Feedback Data" subsection to Section 6 (Diagnostic Logic) |
| `coaches/00_head_coach.md` | Add Questions, RPE-Driven Changes, Reflection Integration rules |
| `coaches/01_strength_hypertrophy.md` | Add RPE Overload Rule, Duration Progression Rule |
| `coaches/02_endurance_energy.md` | Add Cardio Duration Rule, Effort-Effect Cross-Reference |
| `coaches/05_recovery_sleep.md` | Add RPE-Readiness Cross-Reference, Sleep Disruption Triage, Sick Day Context |
| `coaches/06_mobility_injury.md` | Add Chronic Pain Detection, Night Pain Cross-Reference |
| `coaches/07_mental_performance.md` | Add Narrative Theme Tracking, Sick Day Compliance, Conflict Follow-Up |

## Not In Scope

- Triage Q&A persistence (useful but not a coach data flow issue)
- Training effect aggregation (coaches have raw Garmin JSON)
- Hydration actual intake tracking (requires behavioral change from athlete)
- Plan validation layer (separate concern)
- Coach briefing archive UI (separate concern)
