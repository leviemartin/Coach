# Dashboard Redesign + Mobile Workout Tracker

**Date:** 2026-03-21
**Status:** Design approved, pending implementation plan
**Approach:** B — Full Visual Redesign + Mobile Workout Tracker

## Problem Statement

The current dashboard UI is functional but has significant UX gaps:

1. Sparkline cards don't tell a story — 7-day window, single color, no journey context
2. No "journey from start" view — can't see 102kg → 98.5kg arc at a glance
3. Recovery section is a flat text table — no visual hierarchy or trend direction
4. Protocol compliance is buried in a collapsible accordion despite being coaching priority #1
5. Missing data points that competitors surface (zone distribution, training load focus, endurance score, sleep patterns)
6. Design language feels generic — no coaching personality, no visual weight distinction
7. Mobile experience is scroll-heavy with no workout tracking capability
8. Today's session is a one-liner when it should be the primary action card

Additionally, the Hevy app workflow (open Hevy → workout → export CSV → paste in check-in) adds friction that a built-in tracker would eliminate.

## Constraints

- **Backend untouched** — All existing API routes, coach personas (logic/personality), state files, check-in pipeline, Garmin connector, and auth system remain unchanged
- **Coach output format changes allowed** — but every change requires explicit athlete approval before implementation
- **Current UI stays live** — build in a git worktree, swap when ready
- **Small context windows** — implementation tasks must be atomic, self-contained, with explicit file lists
- **MUI framework** — stay within MUI component library, no framework migration

## Design System

### Semantic Color System

Colors map to coaching concepts, not decoration:

| Color | Hex | Meaning | Usage |
|-------|-----|---------|-------|
| Green | `#22c55e` | On track / Good | Recovery >50, Sleep >75, compliance hit |
| Amber | `#f59e0b` | Caution / Adjust | Dad baseline zone, Sleep 60-75, ACWR 1.3-1.5 |
| Red | `#ef4444` | Problem / Deload | Recovery <35, Sleep <60, late bedtime |
| Blue | `#3b82f6` | Informational / Body | Weight, HRV, body metrics |
| Purple | `#8b5cf6` | Protocols / Habits | Vampire, Rug, compliance, supersets |
| Teal | `#14b8a6` | Steady state cardio | Zone 2 work, recovery sessions |
| Orange | `#f97316` | Interval / Anaerobic | Rower sprints, StairMaster intervals |

### Card Hierarchy (3 levels)

1. **Hero Card** — Big number (32-42px, weight 800), semantic color, left border accent. For Tier 1 dashboard metrics (Recovery, Weight, Sleep, Compliance).
2. **Metric Card** — Medium number (20-24px, weight 700), optional sparkline, no accent border. For Tier 3 metrics (HRV, zone distribution, training load).
3. **Detail Row** — Label + value inline (13px). For secondary metrics within sections.

### Typography Scale

| Element | Size | Weight | Usage |
|---------|------|--------|-------|
| Hero number | 42px | 800 | Recovery score, single bold metric |
| Primary metric | 32px | 800 | Weight, sleep score in Hero Cards |
| Section title | 20px | 700 | "Upper Body + OCR Grip" |
| Metric value | 24px | 700 | HRV, ACWR in Metric Cards |
| Body text | 13-14px | 400-600 | Exercise lists, descriptions |
| Category label | 11px | 600 | Uppercase, letter-spacing 1px, "TIER 1 — THE GLANCE" |
| Caption | 10px | 500 | Legends, axis labels, supporting text |

## Section 1: Dashboard Home Page

### Layout: 3-Tier Information Hierarchy

**Tier 1 — The Glance** (what you see in 2 seconds)

4-column grid of Hero Cards:

1. **Recovery Score** — Single bold number (42px), color-coded green/amber/red. Maps to Combined Readiness Decision Matrix. Subtext shows training directive ("Train as programmed" / "Reduce volume 20%" / "Deload"). Replaces scattered HRV + Body Battery + Readiness cards.

2. **Weight Journey** — Current weight (32px) with "▼ 3.5kg from start" in green. Full-program sparkline from W1 to current week. Phase-stepped dashed target line (follows periodization weight targets — goes flat during Dad Phase maintenance). Area fill under actual line. Legend: Actual / Phase target / Current position.

3. **Sleep Score** — Weekly average (32px), color-coded by threshold (>75 green, 60-75 amber, <60 red). Daily bars Mon-Sun colored by individual night quality. Rolling 7-day average line overlaid. Threshold reference lines at 75 and 60.

4. **Protocol Compliance Ring** — SVG ring showing overall compliance %, per-protocol breakdown below (Vampire days/7, Rug days/7, Hydration days/7). Purple accent.

**Tier 2 — Today's Action** (what to do right now)

Hero card showing today's prescribed workout:
- Session title + type badges (Strength, Functional, Cardio, etc.)
- Full exercise list visible (3-column grid: 3 exercises per row, each showing "exercise name sets×reps @weight")
- "Start Session →" button launches mobile tracker at `/session`
- "View Full Plan" link to plan page
- If rest day or family day: shows that context instead

**Tier 3 — Body & Performance** (weekly deep dive)

3-column grid of Metric Cards:

1. **HRV** — Current value with "↑/↓ Xms vs baseline" context. 28-day line chart with 4-week baseline band (shaded), smoothed trend line showing direction, daily values bouncing within range.

2. **Training Load Focus** — Load balance visualization (Low Aerobic / High Aerobic / Anaerobic) with shortage flags from Garmin. Zone distribution bar underneath as supporting context (stacked horizontal bar showing Z1-5 time). Endurance Score with trend vs 4-week average.

3. **Training Load (ACWR)** — ACWR value with OPTIMAL/CAUTION/HIGH badge. Body Battery High with zone indicator.

**Program Timeline** (bottom)

Phase timeline bar (existing component, visual refresh only). Shows current position (W12) and distance to Morzine Ultra.

## Section 2: Mobile Workout Tracker

### New page: `/session`

Replaces Hevy workflow. Pre-loads today's prescribed workout from the training plan.

**Dependency:** The tracker requires coach format change #1 (structured workout output) to be approved and implemented before it can pre-fill exercises. Until that is in place, the tracker cannot function — there is no interim manual-entry mode. The implementation plan must sequence coach format changes before tracker development.

### Strength Exercise View

- Current exercise highlighted with blue border
- Set-by-set logging: each set pre-fills with prescribed weight/reps
- Tap weight or reps to adjust before completing
- "Complete Set N ✓" button advances to next set
- Modified values get amber background highlight
- Completed sets show green checkmark, values become read-only
- Exercise list below shows progress (completed/current/pending)
- Progress bar at top showing exercises completed (e.g., "3/6")

### Superset View

- Grouped block with purple accent and "SUPERSET" badge
- Both exercises (A + B) shown together with "then immediately" divider
- Round-based completion: "Complete Round N (A + B) ✓"
- Each exercise has independent weight/reps fields per round
- Rest time shown in header (e.g., "3 rounds · 90s rest between rounds")

### Cardio: Intervals View

- Protocol specs card: work duration, rest duration, rounds, target intensity
- 8-cell round grid — tap to complete each round (turns green)
- Orange accent color for anaerobic, teal for steady state
- Coach cue visible (e.g., "Damper 7-9. MAX effort each sprint.")

### Cardio: Steady State View

- Duration target (large number)
- HR zone guidance
- Single "Mark Complete ✓" button
- Coach cue visible

### Session Complete Screen

- Summary: exercises done, sets completed, compliance %
- Weight adjustments flagged in amber card
- Ceiling check: whether any new ceilings were hit
- "Done — Log & Close" saves and auto-updates daily log
- "Add Session Notes" optional text field
- Footer: "Session data flows to your daily log automatically. Coaches see it at your next check-in."

### Data Flow

```
Training Plan → Tracker (pre-fills exercises) → Session Log (new table)
                                                      ↓
                                              Daily Log (auto-mark workout_completed)
                                                      ↓
                                              Check-In (session data replaces Hevy CSV)
                                                      ↓
                                              Coaches (see actual vs prescribed)
```

### Session Log Schema

New SQLite table `session_logs` storing completed workout data:

```sql
CREATE TABLE session_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,                    -- '2026-03-21'
  week_number INTEGER NOT NULL,          -- training week
  session_type TEXT NOT NULL,            -- 'strength' | 'cardio_steady' | 'cardio_intervals' | 'ruck' | 'mobility'
  session_title TEXT NOT NULL,           -- 'Upper Body + OCR Grip'
  started_at TEXT,                       -- ISO timestamp
  completed_at TEXT,                     -- ISO timestamp
  notes TEXT,                            -- athlete session notes
  compliance_pct REAL,                   -- 0-100, exercises completed vs planned
  UNIQUE(date, session_title)
);

CREATE TABLE session_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_log_id INTEGER NOT NULL REFERENCES session_logs(id),
  exercise_name TEXT NOT NULL,           -- canonical name from exercise registry
  exercise_order INTEGER NOT NULL,       -- position in workout
  superset_group INTEGER,                -- NULL if not superset, else group ID
  set_number INTEGER NOT NULL,           -- 1, 2, 3...
  prescribed_weight_kg REAL,             -- from training plan
  prescribed_reps INTEGER,              -- from training plan
  actual_weight_kg REAL,                 -- what athlete actually did
  actual_reps INTEGER,                   -- what athlete actually did
  completed INTEGER NOT NULL DEFAULT 0,  -- 0 or 1
  is_modified INTEGER NOT NULL DEFAULT 0 -- 1 if actual differs from prescribed
);

CREATE TABLE session_cardio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_log_id INTEGER NOT NULL REFERENCES session_logs(id),
  exercise_name TEXT NOT NULL,           -- 'Rower Sprints', 'Zone 2 Rower'
  cardio_type TEXT NOT NULL,             -- 'intervals' | 'steady_state'
  prescribed_rounds INTEGER,            -- for intervals
  completed_rounds INTEGER,             -- for intervals
  prescribed_duration_min REAL,          -- for steady state
  target_intensity TEXT,                 -- '>300W', 'HR 120-135', etc.
  completed INTEGER NOT NULL DEFAULT 0
);
```

**Ceiling integration:** On session completion, the tracker reads `state/current_ceilings.json` and checks if any completed set exceeds the current ceiling for that exercise. If so, it reports the new ceiling in the Session Complete screen. Ceiling updates are NOT auto-written — they flow through the check-in where coaches validate and update.

## Section 3: Sparkline Design

### Weight Sparkline

- **Data**: Weekly average weight from W1 to current week (full program history)
- **Actual line**: Solid blue, 2.5px stroke, natural curve
- **Area fill**: Gradient under actual line, 15% opacity
- **Target line**: Dashed gray, stepped through phase weight targets from periodization.md. Goes flat during maintenance phases (Dad Phase).
- **Phase dividers**: Vertical dashed lines at phase boundaries, labeled P1-P6
- **Current position**: Blue dot with "W12" label
- **Annotations**: Start weight label, target label, "Dad Phase" badge where applicable
- **Legend**: Actual / Phase target / Current position

### Sleep Sparkline

- **Data**: Daily sleep scores Mon-Sun for current week
- **Bars**: Individual bars per day, colored by quality (green >75, amber 60-75, red <60)
- **Average line**: Rolling 7-day average overlaid as dark line (0.4 opacity)
- **Threshold lines**: Dashed at 75 (green) and 60 (amber)
- **Score labels**: Score value inside each bar
- **Empty days**: Gray placeholder bar for days not yet recorded

### HRV Sparkline

- **Data**: 28 days of daily HRV readings
- **Baseline band**: 4-week average ± std dev as shaded blue rectangle (8% opacity)
- **Daily line**: Blue, 1.5px stroke, showing natural daily variation
- **Trend line**: Smoothed moving average, dark, 0.3 opacity, showing direction
- **Current position**: Blue dot with value label
- **Context text**: "↑/↓ Xms vs baseline" next to the main number

### Recovery Score (no sparkline)

- Single bold number, color is the visualization
- Subtext directive is the context

### Compliance Ring (no sparkline)

- SVG donut ring shows overall %, per-protocol breakdown below

## Section 4: Page-by-Page Changes

### Trends Page (Significant changes)

- Weight chart: full program sparkline with phase-stepped 89kg target path, start marker
- Add Training Load Focus chart matching dashboard card
- Add Endurance Score trend line
- Sleep chart: add bedtime consistency overlay (actual bedtime vs 23:00 Vampire Protocol target)
- Body comp chart: DEXA scan markers as scatter points for ground truth comparison
- Compliance chart: add streak tracking (longest streak per protocol)
- All charts adopt semantic color system

### Daily Log Page (Light changes)

- Apply design system tokens (card hierarchy, colors, typography)
- Session section links to tracker: "Start Session" button when workout is planned
- Auto-populated from tracker: if session was tracked, workout fields are pre-filled
- Compliance sparkline adopts semantic colors
- Existing v2 components (DayProgress, DailyChecklist, BedtimeCard) get visual refresh only

### Training Plan Page (Medium changes)

- Each day card shows tracker status: completed / in-progress / not started
- "Start Session" button per day launches tracker pre-loaded with that day's workout
- Exercise list renders from new structured format (supersets grouped, cardio protocol visible)
- Visual refresh with design system tokens
- Mobile: swipe-through day cards instead of vertical scroll

### Check-In Flow (Medium changes)

- Step 2 (Hevy CSV) becomes "Session Review": auto-populated from tracker data, shows week's sessions with completion stats and weight changes
- Falls back to manual Hevy CSV paste if no tracker data exists (backwards compatible)
- Coach briefings (AgentBriefing) get visual refresh with design system
- Subjective inputs get card hierarchy treatment

### Profile Page (Light changes)

- StatCards adopt Hero Card / Metric Card styles
- Visual refresh only, structure stays the same

### DEXA / Races / Archive (Light changes)

- Design system token application (card styles, colors, typography)
- No structural changes
- DEXA body comp bar adopts semantic colors
- Race countdown cards get Hero Card treatment

### Sidebar / Navigation (Light changes)

- Add "Session" nav item (when session is active, shows in sidebar with progress)
- Race countdown widget gets compact Hero Card style
- Mobile: add bottom nav bar with 4 items (Dashboard, Session, Log, Plan) for thumb-accessible navigation on mobile devices

## Coach Output Format Changes (Require Approval)

These changes modify coach output format only — personality, logic, and analysis capabilities are untouched.

1. **Structured workout output** — JSON-serializable format alongside the markdown table. Fields: `exercise_name`, `sets`, `reps`, `weight_kg`, `type` (strength/carry/hold/timed), `rest_seconds`
2. **Consistent exercise naming** — Canonical names across all coaches (e.g., always "Lat Pulldown", never "Cable Lat Pull Down"). Requires an exercise name registry stored as `state/exercise_registry.json` — a flat array of canonical exercise names with optional aliases. Coaches reference this file when generating plans. The registry is maintained by the Head Coach and updated when new exercises are introduced.
3. **Session type tagging** — Each day tagged as `strength` | `cardio_steady` | `cardio_intervals` | `ruck` | `mobility` | `rest` | `family`
4. **Superset grouping** — Exercises tagged with `superset_group` ID so the tracker pairs them
5. **Cardio protocol specs** — `work_seconds`, `rest_seconds`, `rounds`, `target_intensity` (watts/HR zone/pace), `equipment`
6. **Check-in input accepts session logs** — Coaches receive structured session data (actual vs prescribed per exercise) instead of Hevy CSV

## What Stays Untouched

- All existing API routes (new ones added for tracker, existing ones unchanged)
- Coach personas — logic, personality, analysis, conflict resolution
- State files — periodization.md, training_history.md, decisions_log.md, athlete_profile.md
- Check-in pipeline — agent orchestration, specialist analysis, Head Coach synthesis
- Garmin connector — data export and sync logic
- Auth system — NextAuth setup
- Database schema (extended for session logs, not modified)

## Implementation Strategy

- Build in a git worktree — current UI stays live until swap
- Each task is atomic with explicit file lists (read X, produce Y)
- Design system tokens built first, then components, then pages
- Tracker requires coach format changes — those get separate approval before implementation
- Independent components built in parallel where possible
