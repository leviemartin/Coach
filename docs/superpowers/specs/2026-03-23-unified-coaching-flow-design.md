# Unified Coaching Flow — Design Spec

**Date:** 2026-03-23
**Status:** Draft — pending user review
**Scope:** End-to-end redesign of Daily Log, Checkin, Training Plan, and Session data flow

## Problem Statement

The Daily Log, Checkin, Training Plan, and Session pages were built independently. This creates:
- Data entered in daily logs not reaching coaches effectively (flat markdown summary, not structured)
- Duplicate data entry (daily log tracks bedtime/hydration/sessions, checkin re-asks the same)
- No conversation with coaches — checkin is fire-and-forget
- Training plan output is a dense pipe-separated table with no visual hierarchy
- No connection between session tracker completion data and coaching decisions
- Plan is day-locked (rigid), not flexible with sequencing guidance

## Design Principles

1. **One connected pipeline** — data enters once, flows one direction, no duplication
2. **Daily Log is the hub** — everything about a day lives here
3. **Coaches see everything** — full structured context, no domain filtering; coaches decide what's relevant
4. **Plain language UI** — no internal jargon (Rug Protocol → Mobility Work, Vampire Protocol → Lights Out)
5. **Every field has a coaching purpose** — if coaches don't use it, it doesn't belong
6. **Flexible scheduling** — sessions float within a week, guided by sequencing rules
7. **Two dialogue gates** — triage before coaches run, Head Coach conversation after

## Visual References

All mockups are in `docs/superpowers/specs/mockups/`:
- `daily-log-redesign.html` — Day view, swap mode, session summary, week overview
- `plan-preview-redesign.html` — Card-based plan with expandable workout details
- `end-to-end-flow.html` — Full pipeline visualization
- `field-coach-mapping.html` — Field-to-coach mapping table
- `architecture-approaches.html` — Approach comparison (selected: C — Phased Hub)

---

## Architecture: Phased Hub (Approach C)

Three pages, three clear jobs:

| Page | Route | Purpose | When Used |
|------|-------|---------|-----------|
| **Daily Log** | `/log` | Daily tracking hub — checklist, session launch, week overview | Every day |
| **Session Tracker** | `/session` | In-gym workout execution | During training |
| **Checkin** | `/checkin` | Weekly coaching session — review, triage, synthesis, dialogue | Sunday 20:00+ |

The Training Plan page (`/plan`) becomes **secondary** — its functionality is absorbed into the Daily Log (week overview panel) and the Checkin (plan preview + lock-in). The `/plan` route can remain as a standalone archive/overview but is no longer the primary way to view the week.

---

## 1. Data Model Changes

### 1.1 Daily Logs — Enhanced Fields

**Renamed fields (UI labels, DB columns unchanged):**

| UI Label | DB Field | Notes |
|----------|----------|-------|
| Session Done | `workout_completed` | Auto-set by session tracker |
| Core Work | `core_work_done` | Unchanged |
| Mobility Work | `rug_protocol_done` | UI rename only |
| No Food After 20:00 | `kitchen_cutoff_hit` | UI rename only |
| Hydration Logged | `hydration_tracked` | UI rename only |
| Lights Out | `vampire_bedtime` | UI rename only |
| Sick Day | `is_sick_day` | Unchanged |

**New columns on `daily_logs`:**

| DB Field | Type | Purpose |
|----------|------|---------|
| `energy_level` | INTEGER (1-5), nullable | Daily subjective energy |
| `pain_level` | INTEGER (0-3), nullable | 0=none, 1=mild, 2=moderate, 3=stop |
| `pain_area` | TEXT, nullable | Free text body area when pain > 0 |
| `sleep_disruption` | TEXT, nullable | Tag: "kids", "stress", "pain", "other", null=none |
| `session_summary` | TEXT, nullable | Auto-populated by session tracker on completion |
| `session_log_id` | INTEGER, nullable, FK → session_logs(id) | Links to actual session performed |

**Sleep disruption timing:** Logged in the morning, writes to the PREVIOUS day's record (the disruption affected last night's sleep). UI label: "How was last night?" If no daily_log exists for the previous date, one is created with only `sleep_disruption` populated and all other fields at defaults (matches existing upsert pattern).

**FK clarification:** The existing `workout_plan_item_id` tracks the *planned* session (what was prescribed for this day). The new `session_log_id` tracks the *actual* session performed. Both coexist — an athlete might do a different session than planned, so planned != actual. `workout_plan_item_id` is preserved, not deprecated.

### 1.2 Daily Notes — New Table

Replaces the single `notes` text field with structured, tagged notes. The existing `notes` TEXT column on `daily_logs` is deprecated — no longer written to by new code, but preserved for historical data. A one-time migration moves existing non-null `notes` values into `daily_notes` with category 'other'.

```sql
CREATE TABLE daily_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_log_id INTEGER NOT NULL REFERENCES daily_logs(id),
  category TEXT NOT NULL,  -- 'injury', 'sleep', 'training', 'life', 'other'
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_daily_notes_log ON daily_notes(daily_log_id);
CREATE INDEX idx_daily_notes_category ON daily_notes(category);
```

Multiple notes per day allowed. Coaches see notes grouped by date AND filterable by category.

### 1.3 Plan Items — Flexible Scheduling

**Modified columns:**

| Field | Change |
|-------|--------|
| `day` | Becomes **suggested day**, not fixed assignment |
| `day_order` | Kept as DB column name, but semantics change: now represents recommended execution order (not fixed day position). TypeScript property renamed to `sequenceOrder` in the `PlanItem` interface for clarity. No SQL column rename needed. |

**New columns:**

| Field | Type | Purpose |
|-------|------|---------|
| `sequence_notes` | TEXT, nullable | Coach reasoning: "needs 48h after heavy legs" |
| `sequence_group` | TEXT, nullable | Constraint group: sessions in same group shouldn't be on adjacent calendar days (e.g., "upper_compound" group means Upper Push and Upper Pull shouldn't be consecutive days). Rest days and family days count as separation. |
| `assigned_date` | TEXT, nullable | Actual scheduled date (updated on swap) |
| `status` | TEXT, default 'pending' | 'pending', 'scheduled', 'completed', 'skipped' |

**Scheduling model:** Coaches prescribe sessions with a recommended order and sequencing constraints. The athlete assigns sessions to days. The system warns when a swap violates a sequencing rule but never blocks it — the athlete always has final say.

**Sequencing rules:**
- "Adjacent" = consecutive calendar days (Mon-Tue, not Mon-Wed)
- Rest days and family days count as separation
- Warning text is auto-generated from `sequence_notes`: "Coach recommends: {sequence_notes}" with amber highlight
- If all remaining day slots would violate constraints, the warning still shows but placement proceeds — no deadlock possible

**`status` field supersedes existing `completed` boolean:**
- Migration backfills `status = 'completed'` where `completed = 1`, `status = 'pending'` otherwise
- `completed` and `completed_at` columns are deprecated — preserved for backward compat but no longer written to by new code
- All new code reads `status` exclusively

### 1.4 Weekly Metrics — Updated

**New fields to capture from daily logs:**

| Field | Source |
|-------|--------|
| `kitchen_cutoff_compliance` | Count from daily_logs.kitchen_cutoff_hit |
| `avg_energy` | Average from daily_logs.energy_level |
| `pain_days` | Count of days with pain_level > 0 |
| `sleep_disruption_count` | Count of non-null sleep_disruption |

**Removed from checkin form (auto-calculated):**
- `sessions_completed` → counted from daily_logs/session_logs
- `vampire_compliance_pct` → calculated from daily_logs.vampire_bedtime
- `rug_protocol_days` → counted from daily_logs.rug_protocol_done
- `hydration_tracked` → counted from daily_logs.hydration_tracked

---

## 2. Daily Log Page — Redesigned

**Route:** `/log?date=YYYY-MM-DD`

### 2.1 Day View (Default)

Top to bottom:
1. **Date navigation** — arrows, date picker, week number
2. **Today's session card** — shows suggested session with type chip, "Start Session" button, "Swap session" link
3. **"How was last night?"** — sleep disruption tag selector, writes to previous day's record
4. **"How are you feeling?"** — Energy (1-5 tap buttons) + Pain (None/Mild/Mod/Stop)
   - When pain > 0: text field for body area appears
5. **Daily Checklist** — Core work, Mobility work, No food after 20:00, Hydration logged — each with weekly running tally chip (colored: green/amber/red)
6. **Lights Out** — indigo gradient button stamps current time, compliance indicator
7. **Tagged Notes** — category chip + text, "+ Add note" button, multiple per day
8. **Session Summary** (after gym) — auto-populated card with compliance %, expandable details showing every set/exercise

### 2.2 Swap Mode

When "Swap session" is tapped:
- Shows all sessions for the week as cards
- Current suggestion highlighted with "Suggested" chip
- Available sessions show sequencing info ("Seq #3 · 48h before heavy legs")
- Constraint violations show amber warning with explanation
- Completed sessions shown dimmed with "Done [Day]" chip
- Selecting a session updates `plan_items.assigned_date` and reassigns remaining sessions

### 2.3 Week Overview (Expandable Panel)

Always accessible via expand toggle:
- 7-day grid showing each day: name, session type, status (done/today/pending/family)
- Tap any day to navigate to that day's log
- Tap to swap sessions between days
- Sequencing guidance from coaches shown below the grid
- Session count chip: "3/5 sessions done"

### 2.4 Sunday Nudge

When today is Sunday and time is before 20:00:
- Soft banner: "Sunday's data isn't complete yet. Best results after 20:00."
- Checkin link becomes prominent after 20:00: "Your week is ready for review. Start check-in."

---

## 3. Session Tracker — Writeback

**Route:** `/session?planItemId=123` (unchanged)

### 3.1 On Session Complete

The session tracker writes back to the daily log:
1. `daily_logs.workout_completed` = 1
2. `daily_logs.session_log_id` = the completed session's ID
3. `daily_logs.session_summary` = generated text summary (exercises, compliance %, weight changes)
4. `plan_items.status` = 'completed'
5. `plan_items.assigned_date` = actual date performed
6. Ceiling progression check (unchanged)
7. Return to daily log page

### 3.2 Session Selection

When starting from the daily log, the athlete can pick any uncompleted session for the week. If the selected session breaks a sequencing rule, a warning is shown but doesn't block.

---

## 4. Checkin Flow — Redesigned

**Route:** `/checkin`

### 4.1 Step 1 — Weekly Review (Auto-Assembled)

Pulls and displays:
- **Garmin data** with freshness indicator. Thresholds: < 4 hours = green ("2 hours ago ✓"), 4-12 hours = amber ("sync recommended"), > 12 hours = red ("data is stale — sync before continuing"). Manual sync button. Keep manual until automation is ready.
- **Sessions completed** — each with summary card (type, focus, compliance %, key weight changes), expandable to full set details
- **Compliance dashboard** — all protocol tallies from daily logs (mobility, kitchen cutoff, hydration, bedtime times + compliance count)
- **Pain/energy 7-day trend** — daily values shown as a mini chart or sparkline
- **Sleep pattern** — bedtime times + disruption tags per night
- **Tagged notes** — grouped by date, showing category chips
- **Annotation field** — optional free text for context the daily logs don't capture ("deload week by choice", "travel disrupted everything")

### 4.2 Step 2 — Subjective Inputs

Only fields that daily logs cannot capture:
- Perceived readiness (1-5)
- Plan satisfaction (1-5)
- Week reflection (free text — "how did this week feel overall?")
- Next week conflicts (free text)
- Questions for coaches (free text)
- Model selection (see Section 7)

### 4.3 Step 3 — Triage Agent (Pre-Flight Q&A)

A lightweight AI agent scans the full assembled data and asks 3-5 targeted questions:
- Flags missing daily log entries ("You completed 4 sessions but only logged 5 of 7 days — want to backfill?")
- Clarifies ambiguous notes ("Wednesday note says 'shoulder felt off' — is this still an issue?")
- Highlights contradictions ("Pain level 2 on Thursday but completed heavy legs — intentional?")
- Probes unusual patterns ("Energy was 1-2 for three consecutive days — anything specific?")

Answers are stored as structured data:
```
{ topic, status, context, routing_hint }
```
- `routing_hint` values: "injury", "recovery", "training", "compliance", "nutrition", "general"
- **Storage:** Triage Q&A answers are ephemeral — held in client state during the checkin session and passed to Step 4 as part of the API payload. Not persisted to a database table.
- **Backfill actions:** If the triage agent prompts to backfill missing daily logs, the athlete navigates to the daily log page (or a modal) to fill in data via the existing daily log API. The triage agent does not write data directly.

These get injected into the coaching context as resolved clarifications.

On completion: "Submit to coaches" button.

**Model:** Sonnet (structured question generation, doesn't need deep reasoning).

### 4.4 Step 4 — Coach Synthesis (Streaming)

7 specialists run, then Head Coach synthesizes. Same streaming SSE approach as today.

**Key changes to data injection:**
- All coaches see full structured context (no domain filtering)
- Daily granularity included (not just weekly averages)
- Session actuals vs prescribed included (every set, weight deviations, skipped exercises)
- Tagged notes grouped by date and category
- Pain/energy daily patterns
- Triage Q&A answers as resolved clarifications
- Tiered history (see Section 6)

**Output:** Head Coach produces a DRAFT plan — not committed yet. Plan uses the new format: sessions with sequence_order, sequence_notes, sequence_group, suggested days.

**Plan preview:** Card-based layout matching the daily log design language (see `mockups/plan-preview-redesign.html`). Each day is an expandable card showing:
- Session type chip + focus
- Sequencing chip with constraint info
- Expandable workout details: warm-up, supersets grouped with color-coded indicators, cardio blocks, cool-down
- Coach's notes prominently displayed
- Weights bolded for quick scanning

### 4.5 Step 5 — Head Coach Dialogue

Open-ended conversation with the Head Coach:
- Ask "why" about any decision in the plan
- Request swaps or adjustments
- Challenge reasoning
- Raise scheduling conflicts
- Head Coach has access to full specialist outputs + all data

Conversation continues until athlete says "lock it in."

**Dialogue persistence:** The conversation is held in client state. If the athlete closes the browser mid-dialogue, the conversation is lost and the plan remains uncommitted (draft state). The athlete can re-run Step 4+5 from the checkin page. Given the cost of Opus, a future improvement could persist dialogue messages to a table for resume capability, but this is out of scope for the initial implementation.

**On lock-in:**
1. `plan_items` written to DB with sequencing metadata
2. `weekly_metrics` row saved (auto-populated from daily logs + Garmin + subjective inputs)
3. `weekly_logs/week_NN_YYYY-MM-DD.md` written (specialist outputs + synthesis + dialogue)
4. `ceiling_history` updated if applicable
5. Sessions appear on next week's daily log
6. "Locked in." confirmation

**Model:** Opus (open conversation requires strongest reasoning).

---

## 5. Coach Data Injection — Structured Full Context

### 5.1 Principle

All 7 specialist coaches receive the same full context. No domain filtering — coaches decide what's relevant based on their expertise. Data is structured for readability, not hidden.

### 5.2 Shared Context Structure

```markdown
## Athlete Profile
[from state/athlete_profile.md]

## Current Phase & Periodization
[from state/periodization.md]

## This Week's Data (Week NN)

### Daily Logs (7-day detail)
| Day | Energy | Pain | Pain Area | Sleep Disruption | Bedtime | Compliant | Kitchen | Core | Mobility | Hydration | Session |
|-----|--------|------|-----------|-----------------|---------|-----------|---------|------|----------|-----------|---------|
| Mon | 3      | 0    | —         | —               | 22:30   | ✓         | ✓       | ✓    | ✓        | ✗         | Upper Push (92%) |
| Tue | 2      | 1    | left knee | kids            | 23:45   | ✗         | ✓       | ✗    | ✓        | ✗         | StairMaster Z4 (100%) |
[... all 7 days]

### Session Details
[For each completed session: exercises, prescribed vs actual, compliance %, skipped items, weight changes]

### Tagged Notes
Mon (training): "Felt strong on bench, increased weight"
Tue (injury): "Left knee tight after warm-up, eased during session"
Tue (sleep): "Kids woke at 2am and 4am"
[... grouped by date]

### Triage Clarifications
1. Topic: Left knee pain (Tue) — Status: Resolved by Wed — Context: Warm-up stiffness, not structural
2. Topic: Skipped Thursday session — Status: Schedule conflict — Context: Family obligation, not fatigue

### Garmin Summary (7-day)
[Weight, sleep scores, readiness, HRV, training effects, ACWR, HR zones, body composition]

### Subjective Inputs
- Perceived readiness: 3/5 (normal)
- Plan satisfaction: 4/5 (slightly too much)
- Reflection: "Good week overall, knee was a concern but resolved"
- Next week conflicts: "Thursday evening unavailable"
- Questions: "Can we add more pull-up volume?"

## Historical Context

### Recent Detail (Weeks NN-1, NN-2)
[Full daily granularity for past 2 weeks]

### Weekly Summaries (Weeks NN-3 through NN-8)
[Compliance %, session count, weight changes, pain flags, key notes per week]

### Long-Term Trends (Week 1 through NN-9)
[Weight curve, ceiling progression, recurring injury flags, phase milestones]

## Reference Data
- Current ceilings: [from current_ceilings.json]
- Decisions log: [from decisions_log.md]
- Previous plan satisfaction + adjustments
```

### 5.3 Coach Persona Updates

Coach personas (`coaches/*.md`) will need updates to leverage the new structured data (daily granularity, tagged notes, session actuals, pain/energy patterns, sequencing output). These updates are part of this implementation — not a separate track — because the coaches need to understand the new data format to produce useful output.

**Review requirement:** Before any coach persona file is modified, the proposed changes must be presented to the athlete with:
- **What** specifically changes in the persona
- **Why** the change is needed (what gap in coaching output does it address)

The athlete approves before the change is committed. This applies to every coach file touched during implementation.

---

## 6. Data Lifecycle & History

### 6.1 Tiered History for Coach Context

| Depth | Granularity | Content |
|-------|-------------|---------|
| **Last 2 weeks** | Full daily detail | Every daily log field, every session set, every note |
| **Weeks 3-8** | Weekly summaries | Compliance %, session count, weight changes, pain flags, key notes |
| **Weeks 9+** | Trend data | Weight curve, ceiling progression, recurring injury flags, phase milestones |

This gives coaches recent detail for next week's programming AND long-term patterns for trajectory decisions without blowing up context size.

### 6.2 Write Path (Single Direction)

```
Daily Log → SQLite (daily_logs + daily_notes)
Session Tracker → SQLite (session_logs/sets/cardio) → Daily Log (summary writeback)
Checkin → SQLite (weekly_metrics) + File (weekly_logs/week_NN.md)
Plan Lock → SQLite (plan_items + sequencing) + File (current_ceilings.json)
```

### 6.3 Archive

- `state/weekly_logs/week_NN_YYYY-MM-DD.md` — full coaching synthesis (write-once, human-readable)
- SQLite tables persist all structured data (queryable, no separate archival needed)
- Garmin JSON is external input, consumed read-only

### 6.4 No Sync Issues

- SQLite is the single source of truth for all structured data
- Markdown files are write-once archives (never re-read for app logic)
- No data enters twice, no two tables store the same fact

---

## 7. Model Selection — Smart Mix

### 7.1 Default Configuration

| Agent | Default Model | Reasoning |
|-------|--------------|-----------|
| Triage Agent | Sonnet | Structured question generation |
| Strength & Hypertrophy | Sonnet | Scoped analysis with structured input |
| Endurance & Energy Systems | Sonnet | HR zone analysis, training load |
| OCR & Functional Movement | Sonnet | Benchmark tracking |
| Nutrition & Body Comp | Sonnet | Compliance checking |
| Recovery & Sleep | Opus | Cross-references many signals, has veto power |
| Mobility & Injury Prevention | Sonnet | Pain pattern analysis |
| Mental Performance & Habits | Sonnet | Protocol compliance |
| Head Coach Synthesis | Opus | Conflict resolution, plan generation |
| Head Coach Dialogue | Opus | Open conversation, strong reasoning |

### 7.2 Selection Options (UI)

Three options presented in Step 2 of the checkin:

**Smart Mix** (default, pre-selected)
- "Recommended for most weeks. Specialists run on Sonnet for speed, Recovery and Head Coach use Opus for deeper reasoning. Best balance of quality and cost."
- Estimated cost: roughly 2-3x All Sonnet (based on Anthropic pricing as of March 2026)

**All Opus**
- "Use when this week involves complex decisions that need maximum analytical depth."
- When to use: phase transitions, injury decisions requiring careful analysis, race preparation, major disagreement with previous week's plan, recovery agent veto situations
- Estimated cost: roughly 5-6x All Sonnet

**All Sonnet**
- "Use for routine maintenance weeks where training is on track with no injuries or major decisions. Fastest results."
- Estimated cost: lowest tier (baseline)

### 7.3 Smart Suggestions

The system suggests "All Opus" when it detects any of:
- Pain level reached 2 or 3 this week
- Phase transition is within 2 weeks
- Race is within 4 weeks
- Previous week's plan satisfaction was 1 (too light) or 5 (too much)
- Combined readiness score < 35 (recovery veto range)

Displayed as a nudge: "This week's data suggests a complex coaching conversation. Consider using All Opus." The athlete still chooses.

---

## 8. Navigation Changes

### 8.1 Sidebar Updates

| Current | New |
|---------|-----|
| Dashboard | Dashboard (unchanged) |
| Check-In | Check-In (redesigned) |
| Daily Log | Daily Log (hub — primary daily page) |
| Training Plan | Training Plan (secondary — archive/overview) |
| Session | Session (unchanged, launched from Daily Log) |

### 8.2 Entry Points

- **Daily use:** Open app → Daily Log (or Dashboard → "Go to today's log")
- **Start workout:** Daily Log → "Start Session" → Session Tracker → on complete → back to Daily Log
- **Sunday checkin:** Daily Log (Sunday 20:00+) → "Start Check-In" banner → Checkin flow
- **View plan:** Daily Log → Week Overview panel (expandable), OR Training Plan page for full archive

---

## 9. What Does NOT Change

- Session Tracker in-gym UX (set/rep/weight logging, cardio tracking, exercise navigation)
- Dashboard page (continues reading from weekly_metrics + Garmin)
- Garmin connector (remains manual sync for now)
- Coach persona files (separate review process for any changes)
- Trends, Archive, DEXA Scans pages
- State files structure (athlete_profile.md, periodization.md, decisions_log.md)

---

## 10. Implementation Considerations

### 10.1 Migration

**`daily_logs` — ALTER TABLE:**
- ADD `energy_level` INTEGER
- ADD `pain_level` INTEGER
- ADD `pain_area` TEXT
- ADD `sleep_disruption` TEXT
- ADD `session_summary` TEXT
- ADD `session_log_id` INTEGER REFERENCES session_logs(id)

**`daily_notes` — CREATE TABLE** (see Section 1.2 for full schema)

**One-time data migration:** Existing `daily_logs.notes` values migrated to `daily_notes` with category 'other'. Original `notes` column preserved but deprecated.

**`plan_items` — ALTER TABLE:**
- ADD `sequence_notes` TEXT
- ADD `sequence_group` TEXT
- ADD `assigned_date` TEXT
- ADD `status` TEXT DEFAULT 'pending'
- Backfill: `status = 'completed'` WHERE `completed = 1`, `status = 'pending'` otherwise
- `day_order` column name unchanged (semantics shift to sequence order; TypeScript property renamed)
- `completed` and `completed_at` columns preserved but deprecated

**`weekly_metrics` — ALTER TABLE:**
- ADD `kitchen_cutoff_compliance` INTEGER
- ADD `avg_energy` REAL
- ADD `pain_days` INTEGER
- ADD `sleep_disruption_count` INTEGER

All new columns are nullable. Existing data preserved.

### 10.2 Phased Delivery

This spec can be shipped incrementally:
1. **Phase A:** Daily Log enhancements (new fields, tagged notes, session writeback, week overview)
2. **Phase B:** Plan model changes (flexible scheduling, sequencing metadata)
3. **Phase C:** Checkin redesign (5-step flow, triage agent, plan preview)
4. **Phase D:** Head Coach dialogue
5. **Phase E:** Coach context injection improvements (structured data, tiered history)

**Dependencies:** Phase A is a prerequisite for Phases C and E (they read from the enhanced daily log data). Phases B and D can proceed independently after A. Recommended order: A → B → C → D → E.

Each phase is independently valuable. Phase A alone fixes the "daily log data not reaching coaches" problem.

### 10.3 Coach Persona Updates

Coach persona updates are part of the phased delivery (primarily Phase C and E). Each persona update requires athlete review before commit — see Section 5.3. Updates include:
- Referencing the new structured data format (daily tables, tagged notes, session actuals)
- Leveraging daily granularity (pain/energy patterns, not just weekly averages)
- Outputting sequencing metadata with plans (sequence_order, sequence_notes, sequence_group)
- Supporting the Head Coach dialogue step
