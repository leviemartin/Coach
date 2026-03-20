# Daily Log + Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily compliance tracking page (`/log`) where the athlete checks off workouts, sleep, mobility, and hydration. Data feeds automatically into the weekly check-in pipeline. Replaces the plan table's completion tracking with a simpler read-only display.

**Architecture:** New `daily_logs` SQLite table, 3 new API routes, 1 new page with auto-save, check-in integration via shared context injection + form pre-fill. TrainingPlanTable simplified to read-only, plan/complete endpoint migrated.

**Tech Stack:** Next.js 16, React 19, MUI 7, better-sqlite3, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-20-daily-log-tracking-design.md`

---

## File Structure

### New Files
```
dashboard/
  app/log/page.tsx                      # Daily log page with date routing
  app/api/log/route.ts                  # GET /api/log?date= and PUT /api/log
  app/api/log/week/route.ts             # GET /api/log/week?week=
  app/api/log/week-summary/route.ts     # GET /api/log/week-summary?week=
  app/api/plan/route.ts                 # GET /api/plan?week= (migrated from plan/complete)
  components/DailyLog.tsx               # Main daily log form (checkboxes, time picker, notes, auto-save)
  components/WeekDots.tsx               # Week overview dot navigation component
  lib/daily-log.ts                      # Shared logic: week summary, plan_item matching, bedtime conversion
```

### Modified Files
```
dashboard/
  lib/db.ts                             # Add daily_logs table, bump schema version, remove dead helpers
  lib/agents.ts                         # Add daily log summary to buildSharedContext()
  components/TrainingPlanTable.tsx       # Remove sub-task checkboxes and notes editing, make read-only
  components/CheckInForm.tsx             # Pre-fill fields from daily log week summary
  components/Sidebar.tsx                # Add "Daily Log" nav item
  app/page.tsx                          # Update plan fetch URL, remove PATCH calls
  app/plan/page.tsx                     # Update plan fetch URL, remove PATCH calls
  app/plan/[weekNumber]/page.tsx        # Update plan fetch URL
```

### Removed Files
```
dashboard/
  app/api/plan/complete/route.ts        # GET migrated to /api/plan, PATCH replaced by daily log
```

---

### Task 1: Database Schema — daily_logs Table

**Files:**
- Modify: `dashboard/lib/db.ts`

- [ ] **Step 1: Read the current db.ts**

Read `dashboard/lib/db.ts` in full to understand the current schema init, helper functions, and schema version pattern.

- [ ] **Step 2: Bump schema version and add daily_logs table**

In `lib/db.ts`:
- Change `const SCHEMA_VERSION = 3;` to `const SCHEMA_VERSION = 4;`
- Add to `initTables()` after the existing CREATE TABLE statements:

```typescript
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    week_number INTEGER NOT NULL,
    workout_completed INTEGER DEFAULT 0,
    workout_plan_item_id INTEGER,
    core_work_done INTEGER DEFAULT 0,
    rug_protocol_done INTEGER DEFAULT 0,
    vampire_bedtime TEXT,
    hydration_tracked INTEGER DEFAULT 0,
    kitchen_cutoff_hit INTEGER DEFAULT 0,
    is_sick_day INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (workout_plan_item_id) REFERENCES plan_items(id)
  );
  CREATE INDEX IF NOT EXISTS idx_daily_logs_week ON daily_logs(week_number);
  CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(date);
`);
```

- [ ] **Step 3: Add daily log DB helper functions**

Add to `lib/db.ts`:

```typescript
export interface DailyLog {
  id: number;
  date: string;
  week_number: number;
  workout_completed: number;
  workout_plan_item_id: number | null;
  core_work_done: number;
  rug_protocol_done: number;
  vampire_bedtime: string | null;
  hydration_tracked: number;
  kitchen_cutoff_hit: number;
  is_sick_day: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function getDailyLog(date: string): DailyLog | null {
  const db = getDb();
  return db.prepare('SELECT * FROM daily_logs WHERE date = ?').get(date) as DailyLog | null;
}

export function getDailyLogsByWeek(weekNumber: number): DailyLog[] {
  const db = getDb();
  return db.prepare('SELECT * FROM daily_logs WHERE week_number = ? ORDER BY date').all(weekNumber) as DailyLog[];
}

export function upsertDailyLog(log: Omit<DailyLog, 'id' | 'created_at' | 'updated_at'>): DailyLog {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = getDailyLog(log.date);

  if (existing) {
    db.prepare(`
      UPDATE daily_logs SET
        week_number = ?, workout_completed = ?, workout_plan_item_id = ?,
        core_work_done = ?, rug_protocol_done = ?, vampire_bedtime = ?,
        hydration_tracked = ?, kitchen_cutoff_hit = ?, is_sick_day = ?,
        notes = ?, updated_at = ?
      WHERE date = ?
    `).run(
      log.week_number, log.workout_completed, log.workout_plan_item_id,
      log.core_work_done, log.rug_protocol_done, log.vampire_bedtime,
      log.hydration_tracked, log.kitchen_cutoff_hit, log.is_sick_day,
      log.notes, now, log.date
    );
  } else {
    db.prepare(`
      INSERT INTO daily_logs (
        date, week_number, workout_completed, workout_plan_item_id,
        core_work_done, rug_protocol_done, vampire_bedtime,
        hydration_tracked, kitchen_cutoff_hit, is_sick_day,
        notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      log.date, log.week_number, log.workout_completed, log.workout_plan_item_id,
      log.core_work_done, log.rug_protocol_done, log.vampire_bedtime,
      log.hydration_tracked, log.kitchen_cutoff_hit, log.is_sick_day,
      log.notes, now, now
    );
  }

  return getDailyLog(log.date)!;
}
```

- [ ] **Step 4: Remove dead completion helpers**

Remove these functions from `lib/db.ts` (they will have no callers after Task 6):
- `togglePlanItemComplete`
- `updatePlanItemSubTasks`
- `updatePlanItemNotes`

Also remove their exports. Check if any types related to these are also only used here and can be removed.

- [ ] **Step 5: Verify build**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npm run build`
Expected: Build succeeds (dead code removal may cause errors if still imported — fix any remaining imports in Task 6).

Note: If the build fails because `plan/complete/route.ts` still imports the removed functions, that's expected — it will be fixed in Task 6. In that case, temporarily keep the functions and remove them after Task 6.

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/db.ts
git commit -m "feat: add daily_logs table and helpers, bump schema to v4"
```

---

### Task 2: Shared Logic — lib/daily-log.ts

**Files:**
- Create: `dashboard/lib/daily-log.ts`

- [ ] **Step 1: Create daily-log.ts**

Create `dashboard/lib/daily-log.ts`:

```typescript
import { getTrainingWeek, PROGRAM_EPOCH } from './week';
import { getDailyLogsByWeek, getPlanItems } from './db';
import type { DailyLog } from './db';

const MS_PER_DAY = 86_400_000;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Get the full English day name from a date string (YYYY-MM-DD) */
export function getDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00'); // noon to avoid timezone edge cases
  return DAY_NAMES[d.getDay()];
}

/** Get the training week number for a date string */
export function getWeekForDate(dateStr: string): number {
  return getTrainingWeek(new Date(dateStr + 'T12:00:00'));
}

/** Find the plan_item matching a date (by week_number + day name) */
export function findPlanItemForDate(dateStr: string): { id: number } | null {
  const weekNumber = getWeekForDate(dateStr);
  const dayName = getDayName(dateStr);
  const items = getPlanItems(weekNumber);
  const match = items.find((item: { day: string }) => item.day === dayName);
  return match ? { id: match.id } : null;
}

/** Convert a standard time (HH:MM) to 24h+ format for storage.
 *  Times 00:00-05:59 become 24:00-29:59 (after-midnight bedtimes). */
export function toBedtimeStorage(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (h < 6) {
    return `${h + 24}:${m.toString().padStart(2, '0')}`;
  }
  return time;
}

/** Convert stored 24h+ format back to display (24:30 -> 00:30) */
export function fromBedtimeStorage(stored: string): string {
  const [h, m] = stored.split(':').map(Number);
  if (h >= 24) {
    return `${(h - 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
  return stored;
}

/** Is this bedtime compliant with the 23:00 Vampire Protocol target? */
export function isBedtimeCompliant(storedTime: string): boolean {
  const [h] = storedTime.split(':').map(Number);
  return h < 23;
}

export interface WeekSummary {
  week_number: number;
  days_logged: number;
  workouts: { completed: number; planned: number };
  core: { done: number; target: number };
  rug_protocol: { done: number; total: number };
  vampire: {
    compliant: number;
    total: number;
    avg_bedtime: string | null;
    daily: Array<{ date: string; bedtime: string; compliant: boolean }>;
  };
  hydration: { tracked: number; total: number };
  kitchen_cutoff: { hit: number; total: number };
  sick_days: number;
  notes: Array<{ date: string; text: string }>;
}

/** Compute the weekly summary from daily logs. Denominator is always 7. */
export function computeWeekSummary(weekNumber: number): WeekSummary {
  const logs = getDailyLogsByWeek(weekNumber);
  const planItems = getPlanItems(weekNumber);

  const workoutsCompleted = logs.filter(l => l.workout_completed).length;
  const coreDone = logs.filter(l => l.core_work_done).length;
  const rugDone = logs.filter(l => l.rug_protocol_done).length;
  const hydrationTracked = logs.filter(l => l.hydration_tracked).length;
  const kitchenHit = logs.filter(l => l.kitchen_cutoff_hit).length;
  const sickDays = logs.filter(l => l.is_sick_day).length;

  // Vampire Protocol
  const bedtimeLogs = logs.filter(l => l.vampire_bedtime);
  const compliantCount = bedtimeLogs.filter(l => isBedtimeCompliant(l.vampire_bedtime!)).length;
  let avgBedtime: string | null = null;
  if (bedtimeLogs.length > 0) {
    const totalMinutes = bedtimeLogs.reduce((sum, l) => {
      const [h, m] = l.vampire_bedtime!.split(':').map(Number);
      return sum + h * 60 + m;
    }, 0);
    const avgMin = Math.round(totalMinutes / bedtimeLogs.length);
    const avgH = Math.floor(avgMin / 60);
    const avgM = avgMin % 60;
    avgBedtime = fromBedtimeStorage(`${avgH}:${avgM.toString().padStart(2, '0')}`);
  }

  const vampireDaily = bedtimeLogs.map(l => ({
    date: l.date,
    bedtime: fromBedtimeStorage(l.vampire_bedtime!),
    compliant: isBedtimeCompliant(l.vampire_bedtime!),
  }));

  const notes = logs
    .filter(l => l.notes && l.notes.trim())
    .map(l => ({ date: l.date, text: l.notes!.trim() }));

  return {
    week_number: weekNumber,
    days_logged: logs.length,
    workouts: { completed: workoutsCompleted, planned: planItems.length },
    core: { done: coreDone, target: 3 },
    rug_protocol: { done: rugDone, total: 7 },
    vampire: { compliant: compliantCount, total: 7, avg_bedtime: avgBedtime, daily: vampireDaily },
    hydration: { tracked: hydrationTracked, total: 7 },
    kitchen_cutoff: { hit: kitchenHit, total: 7 },
    sick_days: sickDays,
    notes,
  };
}

/** Format the week summary as a markdown block for agent context injection */
export function formatWeekSummaryForAgents(summary: WeekSummary): string {
  let md = `## Daily Log Summary (Week ${summary.week_number})\n`;
  md += `- Days logged: ${summary.days_logged}/7\n`;
  md += `- Workouts completed: ${summary.workouts.completed}/${summary.workouts.planned}\n`;
  md += `- Core work: ${summary.core.done}/${summary.core.target} target days\n`;
  md += `- Rug Protocol: ${summary.rug_protocol.done}/7 days\n`;

  md += `- Vampire Protocol: ${summary.vampire.compliant}/7 compliant`;
  if (summary.vampire.avg_bedtime) {
    md += ` (avg bedtime ${summary.vampire.avg_bedtime})`;
  }
  md += `\n`;
  if (summary.vampire.daily.length > 0) {
    const entries = summary.vampire.daily.map(d => {
      const dayName = getDayName(d.date).slice(0, 3);
      return `${dayName} ${d.bedtime} ${d.compliant ? '✓' : '✗'}`;
    });
    md += `  - ${entries.join(', ')}\n`;
  }

  md += `- Hydration tracked: ${summary.hydration.tracked}/7 days\n`;
  md += `- Kitchen Cutoff: ${summary.kitchen_cutoff.hit}/7\n`;
  md += `- Sick days: ${summary.sick_days}\n`;

  if (summary.notes.length > 0) {
    md += `- Notes:\n`;
    for (const n of summary.notes) {
      const dayName = getDayName(n.date).slice(0, 3);
      md += `  - ${dayName}: ${n.text}\n`;
    }
  }

  return md;
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/daily-log.ts
git commit -m "feat: add daily log shared logic (summary, bedtime conversion, plan matching)"
```

---

### Task 3: API Endpoints

**Files:**
- Create: `dashboard/app/api/log/route.ts`
- Create: `dashboard/app/api/log/week/route.ts`
- Create: `dashboard/app/api/log/week-summary/route.ts`

- [ ] **Step 1: Create GET/PUT /api/log**

Create `dashboard/app/api/log/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getDailyLog, upsertDailyLog, getPlanItems } from '@/lib/db';
import { getWeekForDate, getDayName, findPlanItemForDate } from '@/lib/daily-log';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date parameter (YYYY-MM-DD)' }, { status: 400 });
  }

  const log = getDailyLog(date);
  const weekNumber = getWeekForDate(date);
  const dayName = getDayName(date);
  const planItems = getPlanItems(weekNumber);
  const plannedSession = planItems.find((item: { day: string }) => item.day === dayName) || null;

  return NextResponse.json({
    log: log || {
      date,
      week_number: weekNumber,
      workout_completed: 0,
      core_work_done: 0,
      rug_protocol_done: 0,
      vampire_bedtime: null,
      hydration_tracked: 0,
      kitchen_cutoff_hit: 0,
      is_sick_day: 0,
      notes: '',
    },
    planned_session: plannedSession,
  });
}

export async function PUT(request: Request) {
  const body = await request.json();

  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ error: 'Invalid date (YYYY-MM-DD)' }, { status: 400 });
  }

  const weekNumber = getWeekForDate(body.date);
  const planItem = findPlanItemForDate(body.date);

  const saved = upsertDailyLog({
    date: body.date,
    week_number: weekNumber,
    workout_completed: body.workout_completed ? 1 : 0,
    workout_plan_item_id: planItem?.id || null,
    core_work_done: body.core_work_done ? 1 : 0,
    rug_protocol_done: body.rug_protocol_done ? 1 : 0,
    vampire_bedtime: body.vampire_bedtime || null,
    hydration_tracked: body.hydration_tracked ? 1 : 0,
    kitchen_cutoff_hit: body.kitchen_cutoff_hit ? 1 : 0,
    is_sick_day: body.is_sick_day ? 1 : 0,
    notes: body.notes || null,
  });

  return NextResponse.json({ log: saved });
}
```

- [ ] **Step 2: Create GET /api/log/week**

Create `dashboard/app/api/log/week/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getDailyLogsByWeek } from '@/lib/db';
import { getDayName } from '@/lib/daily-log';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get('week');

  if (!week || isNaN(Number(week))) {
    return NextResponse.json({ error: 'Invalid week parameter' }, { status: 400 });
  }

  const weekNumber = parseInt(week);
  const logs = getDailyLogsByWeek(weekNumber);
  const logsWithDay = logs.map(log => ({
    ...log,
    day: getDayName(log.date),
  }));

  return NextResponse.json({ week_number: weekNumber, logs: logsWithDay });
}
```

- [ ] **Step 3: Create GET /api/log/week-summary**

Create `dashboard/app/api/log/week-summary/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { computeWeekSummary } from '@/lib/daily-log';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get('week');

  if (!week || isNaN(Number(week))) {
    return NextResponse.json({ error: 'Invalid week parameter' }, { status: 400 });
  }

  const summary = computeWeekSummary(parseInt(week));
  return NextResponse.json(summary);
}
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npm run build`
Expected: Build succeeds. New API routes are generated.

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/api/log/
git commit -m "feat: add daily log API endpoints (GET/PUT log, week, week-summary)"
```

---

### Task 4: Daily Log Page + Components

**Files:**
- Create: `dashboard/app/log/page.tsx`
- Create: `dashboard/components/DailyLog.tsx`
- Create: `dashboard/components/WeekDots.tsx`
- Modify: `dashboard/components/Sidebar.tsx`

- [ ] **Step 1: Create WeekDots component**

Create `dashboard/components/WeekDots.tsx`:

```typescript
'use client';

import { Box, Typography } from '@mui/material';

interface DayStatus {
  date: string;
  day: string;
  status: 'complete' | 'partial' | 'empty' | 'family';
}

interface WeekDotsProps {
  days: DayStatus[];
  currentDate: string;
  onDayClick: (date: string) => void;
}

const DOT_COLORS = {
  complete: 'success.main',
  partial: 'warning.main',
  empty: 'action.disabled',
  family: 'action.disabledBackground',
};

export default function WeekDots({ days, currentDate, onDayClick }: WeekDotsProps) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
      {days.map((d) => (
        <Box
          key={d.date}
          onClick={() => d.status !== 'family' ? onDayClick(d.date) : undefined}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: d.status !== 'family' ? 'pointer' : 'default',
            opacity: d.status === 'family' ? 0.4 : 1,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {d.day.slice(0, 3)}
          </Typography>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: DOT_COLORS[d.status],
              border: d.date === currentDate ? '2px solid' : 'none',
              borderColor: 'primary.main',
              mt: 0.5,
            }}
          />
        </Box>
      ))}
    </Box>
  );
}
```

- [ ] **Step 2: Create DailyLog component**

Create `dashboard/components/DailyLog.tsx`. This is the main form component with auto-save, sick day toggle, and bedtime picker. Read the spec Section 5 for all behavior requirements.

The component should:
- Accept `date`, `log`, `plannedSession`, and `onSave` props
- Use MUI `Switch`, `Checkbox`, `TextField` (time type), and `TextField` (multiline) for inputs
- Implement debounced auto-save (500ms) on every change
- Show "Saved" / "Save failed" indicator
- Hide workout/core/rug/kitchen when sick day is on
- Convert bedtime times after midnight to 24h+ format before saving (import `toBedtimeStorage`, `fromBedtimeStorage` from `lib/daily-log`)

This component is too large to fully inline here. The implementer should build it following the spec's layout wireframe (Section 5) and behavior rules, using MUI components. Key structure:

```typescript
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Switch, Checkbox,
  FormControlLabel, TextField, Alert,
} from '@mui/material';
import { toBedtimeStorage, fromBedtimeStorage } from '@/lib/daily-log';

interface DailyLogProps {
  date: string;
  log: { /* DailyLog fields */ };
  plannedSession: { session_type: string; focus: string; workout_plan: string } | null;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}

export default function DailyLog({ date, log, plannedSession, onSave }: DailyLogProps) {
  // State for each field, initialized from log prop
  // Debounced save on every change
  // Sick day toggle hides workout/core/rug/kitchen sections
  // Bedtime time input with after-midnight note
  // Save status indicator ("Saved" / "Save failed — retrying")
}
```

The implementer should follow the spec Section 5 wireframe and behavior rules exactly. Key behaviors:
- Auto-save: debounce 500ms, retry once on failure after 2s, persistent error indicator
- Sick day: hides workout section, core, rug, kitchen. Shows hydration + bedtime + notes.
- Bedtime: standard time input, times 00:00-05:59 show "After midnight" note, stored as 24h+
- Today's Session: shows plan_item info if exists, "Rest Day" or "Family Day" if not
- Family day: hardcoded Saturday

- [ ] **Step 3: Create daily log page**

Create `dashboard/app/log/page.tsx`:

```typescript
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, IconButton, Card, CardContent } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DailyLog from '@/components/DailyLog';
import WeekDots from '@/components/WeekDots';
import { getTrainingWeek } from '@/lib/week';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LogPage() {
  const [currentDate, setCurrentDate] = useState(formatDate(new Date()));
  const [logData, setLogData] = useState<any>(null);
  const [weekLogs, setWeekLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const today = formatDate(new Date());
  const weekNumber = getTrainingWeek(new Date(currentDate + 'T12:00:00'));

  // Fetch log for current date
  const fetchLog = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/log?date=${currentDate}`);
    const data = await res.json();
    setLogData(data);
    setLoading(false);
  }, [currentDate]);

  // Fetch week logs for dots
  const fetchWeekLogs = useCallback(async () => {
    const res = await fetch(`/api/log/week?week=${weekNumber}`);
    const data = await res.json();
    setWeekLogs(data.logs || []);
  }, [weekNumber]);

  useEffect(() => { fetchLog(); }, [fetchLog]);
  useEffect(() => { fetchWeekLogs(); }, [fetchWeekLogs]);

  // Save handler
  const handleSave = async (data: Record<string, unknown>) => {
    const res = await fetch('/api/log', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, date: currentDate }),
    });
    if (!res.ok) throw new Error('Save failed');
    fetchWeekLogs(); // refresh dots
  };

  // Date navigation
  const navigate = (delta: number) => {
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    const newDate = formatDate(d);
    if (newDate <= today) setCurrentDate(newDate);
  };

  // Build week dots data
  // ... compute from weekLogs, marking Saturday as family day

  return (
    <Box>
      {/* Date navigation header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate(-1)}><ChevronLeftIcon /></IconButton>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6">{formatDisplayDate(currentDate)}</Typography>
          <Typography variant="body2" color="text.secondary">Week {weekNumber}</Typography>
        </Box>
        <IconButton onClick={() => navigate(1)} disabled={currentDate >= today}>
          <ChevronRightIcon />
        </IconButton>
      </Box>

      {/* Daily log form */}
      {logData && (
        <DailyLog
          date={currentDate}
          log={logData.log}
          plannedSession={logData.planned_session}
          onSave={handleSave}
        />
      )}

      {/* Week overview dots */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>Week Overview</Typography>
          <WeekDots
            days={/* computed from weekLogs */[]}
            currentDate={currentDate}
            onDayClick={(date) => setCurrentDate(date)}
          />
        </CardContent>
      </Card>
    </Box>
  );
}
```

The implementer should complete the week dots data computation (map weekLogs to DayStatus array, mark Saturday as family day, determine complete/partial/empty status).

- [ ] **Step 4: Add Daily Log to Sidebar navigation**

In `dashboard/components/Sidebar.tsx`, add to the `NAV_SECTIONS` array under the "Main" section:

```typescript
import EditNoteIcon from '@mui/icons-material/EditNote';

// In NAV_SECTIONS, Main items:
{ label: 'Daily Log', path: '/log', icon: <EditNoteIcon /> },
```

Add it after "Check-In" and before "Training Plan".

- [ ] **Step 5: Verify build**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npm run build`
Expected: Build succeeds. `/log` page is generated.

- [ ] **Step 6: Commit**

```bash
git add dashboard/app/log/ dashboard/components/DailyLog.tsx dashboard/components/WeekDots.tsx dashboard/components/Sidebar.tsx
git commit -m "feat: add daily log page with auto-save, sick day toggle, week dots"
```

---

### Task 5: Check-in Integration

**Files:**
- Modify: `dashboard/lib/agents.ts`
- Modify: `dashboard/components/CheckInForm.tsx`

- [ ] **Step 1: Add daily log summary to buildSharedContext()**

Read `dashboard/lib/agents.ts` in full. Then add the daily log summary injection.

Import at top:
```typescript
import { computeWeekSummary, formatWeekSummaryForAgents } from './daily-log';
import { getTrainingWeek } from './week';
```

In `buildSharedContext()`, after the Hevy Training Log section (after `context += \`## Hevy Training Log\n${hevySummary}\n\n\`;`), add:

```typescript
  // Daily Log Summary
  const currentWeek = getTrainingWeek();
  const weekSummary = computeWeekSummary(currentWeek);
  if (weekSummary.days_logged > 0) {
    context += formatWeekSummaryForAgents(weekSummary) + '\n';
  } else {
    context += '## Daily Log Summary\nNo daily logs recorded this week.\n\n';
  }
```

- [ ] **Step 2: Add pre-fill to CheckInForm**

Read `dashboard/components/CheckInForm.tsx` in full. Then add the pre-fill logic.

Add a `useEffect` that fetches the week summary on mount and pre-fills form fields:

```typescript
// After the existing useEffect hooks, add:
useEffect(() => {
  fetch(`/api/log/week-summary?week=${/* current training week */}`)
    .then(res => res.json())
    .then(summary => {
      if (summary.days_logged > 0) {
        setFormData(prev => ({
          ...prev,
          sessionsCompleted: summary.workouts.completed,
          rugProtocolDays: summary.rug_protocol.done,
          bedtimeCompliance: summary.vampire.compliant,
          hydrationTracked: summary.hydration.tracked > 0,
        }));
        setPrefilledFromLogs(true);
      }
    })
    .catch(() => {}); // Silent fail — form works without pre-fill
}, []);
```

Add a state variable `const [prefilledFromLogs, setPrefilledFromLogs] = useState(false);` and show an indicator in the form when pre-filled:

```typescript
{prefilledFromLogs && (
  <Alert severity="info" sx={{ mb: 2 }}>
    Pre-filled from daily logs. You can adjust values before submitting.
  </Alert>
)}
```

The implementer needs to compute the current training week. Import `getTrainingWeek` from `@/lib/week` — but note this is a client component. `getTrainingWeek` uses `Date` only (no server imports), so it can be imported directly.

- [ ] **Step 3: Verify build**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/agents.ts dashboard/components/CheckInForm.tsx
git commit -m "feat: integrate daily log into check-in (agent context + form pre-fill)"
```

---

### Task 6: TrainingPlanTable Simplification + Endpoint Migration

**Files:**
- Create: `dashboard/app/api/plan/route.ts`
- Modify: `dashboard/components/TrainingPlanTable.tsx`
- Modify: `dashboard/app/page.tsx`
- Modify: `dashboard/app/plan/page.tsx`
- Modify: `dashboard/app/plan/[weekNumber]/page.tsx`
- Remove: `dashboard/app/api/plan/complete/route.ts`

- [ ] **Step 1: Create /api/plan route (migrate GET handler)**

Create `dashboard/app/api/plan/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getPlanItems, getLatestWeekNumber } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get('week');
  const weekNumber = week ? parseInt(week) : getLatestWeekNumber();
  const items = getPlanItems(weekNumber);
  return NextResponse.json({ items, weekNumber });
}
```

- [ ] **Step 2: Update consumer pages to use /api/plan**

Read each file first, then update fetch URLs.

In `dashboard/app/page.tsx`: Find all `fetch('/api/plan/complete` calls and replace with `fetch('/api/plan`. Remove any PATCH calls to `/api/plan/complete`. Remove any completion toggle handlers.

In `dashboard/app/plan/page.tsx`: Same — replace fetch URL, remove PATCH calls and completion toggle handlers.

In `dashboard/app/plan/[weekNumber]/page.tsx`: Replace fetch URL.

- [ ] **Step 3: Make TrainingPlanTable read-only**

Read `dashboard/components/TrainingPlanTable.tsx` in full. Then:

- Remove all checkbox rendering and toggle handlers (sub-task checkboxes, completion toggles)
- Remove `onUpdateNotes` prop and athlete notes editing UI
- Remove `onToggleComplete` prop and related handlers
- Keep the expand/collapse for workout detail text (but remove `role="button"` from Typography if present)
- Keep the read-only display: Day, Session Type, Focus, Workout Plan (expandable), Coach's Cues
- Simplify the component props to only accept `items` (read-only data)

- [ ] **Step 4: Delete plan/complete route**

Remove `dashboard/app/api/plan/complete/route.ts`.

- [ ] **Step 5: Remove dead DB helpers (if not done in Task 1)**

If `togglePlanItemComplete`, `updatePlanItemSubTasks`, and `updatePlanItemNotes` were not removed in Task 1 Step 4 (due to build dependency), remove them now from `lib/db.ts`.

- [ ] **Step 6: Verify build and check for dead imports**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npm run build`
Expected: Build succeeds with no errors. No remaining imports of removed functions.

Search for any remaining references:
```bash
grep -r "plan/complete" dashboard/app/ dashboard/components/ --include="*.ts" --include="*.tsx"
grep -r "togglePlanItemComplete\|updatePlanItemSubTasks\|updatePlanItemNotes" dashboard/ --include="*.ts" --include="*.tsx"
```
Expected: No matches.

- [ ] **Step 7: Commit**

```bash
git add dashboard/app/api/plan/ dashboard/components/TrainingPlanTable.tsx \
  dashboard/app/page.tsx dashboard/app/plan/ dashboard/lib/db.ts
git rm dashboard/app/api/plan/complete/route.ts
git commit -m "feat: simplify plan table to read-only, migrate GET to /api/plan, remove completion tracking"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run all verification criteria from the spec**

Per spec Section 10:
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

- [ ] **Step 2: Commit any final fixes**

If any issues found during verification, fix and commit.
