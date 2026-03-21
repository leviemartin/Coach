# Daily Log v2 — Smart Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the daily log page with workout labels, flexible session completion, one-tap bedtime, compliance indicators, progress ring, streak counter, and compliance trends.

**Architecture:** Decompose the existing monolithic `DailyLog.tsx` (326 lines) into 7 focused sub-components. Add compliance math functions to `lib/daily-log.ts`. Extend existing API endpoints and add one new endpoint. Add a compliance trend chart to the existing Trends page.

**Tech Stack:** Next.js 14, React, MUI 6, MUI X-Charts, better-sqlite3, vitest

**Spec:** `docs/superpowers/specs/2026-03-21-daily-log-v2-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `dashboard/components/SessionPicker.tsx` | Flexible workout selection from uncompleted sessions + completion checkbox |
| `dashboard/components/DailyChecklist.tsx` | Core, rug, kitchen, hydration checkboxes with weekly compliance indicators |
| `dashboard/components/BedtimeCard.tsx` | "Lights Out" button + time picker + compliance indicator |
| `dashboard/components/DayProgress.tsx` | SVG progress ring + streak counter |
| `dashboard/components/WeekComplianceBar.tsx` | Per-metric tallies + overall week compliance % |
| `dashboard/components/ComplianceSparkline.tsx` | Last 4 weeks mini sparkline |
| `dashboard/components/NotesCard.tsx` | Free-text notes card |
| `dashboard/app/api/log/compliance-trend/route.ts` | GET endpoint for compliance trend data |
| `dashboard/__tests__/compliance.test.ts` | Tests for compliance math functions |

### Modified Files
| File | Changes |
|------|---------|
| `dashboard/lib/daily-log.ts` | Add `computeDayCompliance`, `computeWeekCompliancePct`, `computeStreak`, `getComplianceTrend`, `getUncompletedSessions` |
| `dashboard/lib/db.ts` | Add `getUncompletedSessionsForWeek`, `getAllDailyLogs` |
| `dashboard/app/api/log/route.ts` | GET: add `uncompleted_sessions` + `streak`. PUT: accept client `workout_plan_item_id` |
| `dashboard/app/log/page.tsx` | Add workout label chip to header, pass new props to DailyLog |
| `dashboard/components/DailyLog.tsx` | Refactor to orchestrator — distribute state to sub-components |
| `dashboard/components/TrendCharts.tsx` | Add compliance trend line chart |
| `dashboard/app/trends/page.tsx` | Fetch and pass compliance trend data |

---

### Task 1: Compliance Math — Core Functions

**Files:**
- Modify: `dashboard/lib/daily-log.ts`
- Create: `dashboard/__tests__/compliance.test.ts`

All downstream components depend on these pure functions. Build and test them first.

- [ ] **Step 1: Write failing tests for `computeDayCompliance`**

```typescript
// dashboard/__tests__/compliance.test.ts
import { describe, it, expect } from 'vitest';
import { computeDayCompliance } from '../lib/daily-log';

describe('computeDayCompliance', () => {
  const fullDay = {
    workout_completed: 1,
    core_work_done: 1,
    rug_protocol_done: 1,
    vampire_bedtime: '22:30',
    hydration_tracked: 1,
    kitchen_cutoff_hit: 1,
    is_sick_day: 0,
  };

  it('returns 6/6 for a fully completed normal day with session', () => {
    const result = computeDayCompliance(fullDay, true);
    expect(result).toEqual({ checked: 6, total: 6, pct: 100 });
  });

  it('returns 5/5 for a rest day (no planned session)', () => {
    const restDay = { ...fullDay, workout_completed: 0 };
    const result = computeDayCompliance(restDay, false);
    expect(result).toEqual({ checked: 4, total: 5, pct: 80 });
  });

  it('returns 2/2 for a sick day with both items done', () => {
    const sickDay = { ...fullDay, is_sick_day: 1 };
    const result = computeDayCompliance(sickDay, true);
    expect(result).toEqual({ checked: 2, total: 2, pct: 100 });
  });

  it('returns 0/2 for a sick day with nothing done', () => {
    const sickEmpty = {
      workout_completed: 0, core_work_done: 0, rug_protocol_done: 0,
      vampire_bedtime: null, hydration_tracked: 0, kitchen_cutoff_hit: 0,
      is_sick_day: 1,
    };
    const result = computeDayCompliance(sickEmpty, false);
    expect(result).toEqual({ checked: 0, total: 2, pct: 0 });
  });

  it('counts bedtime as checked when any value is set', () => {
    const withBedtime = { ...fullDay, workout_completed: 0, core_work_done: 0,
      rug_protocol_done: 0, kitchen_cutoff_hit: 0, hydration_tracked: 0 };
    const result = computeDayCompliance(withBedtime, true);
    expect(result).toEqual({ checked: 1, total: 6, pct: Math.round(100 / 6) });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run __tests__/compliance.test.ts`
Expected: FAIL — `computeDayCompliance` is not exported from `lib/daily-log.ts`

- [ ] **Step 3: Implement `computeDayCompliance` in `lib/daily-log.ts`**

Add to the end of `dashboard/lib/daily-log.ts`:

```typescript
export interface DayComplianceInput {
  workout_completed: number;
  core_work_done: number;
  rug_protocol_done: number;
  vampire_bedtime: string | null;
  hydration_tracked: number;
  kitchen_cutoff_hit: number;
  is_sick_day: number;
}

export interface ComplianceResult {
  checked: number;
  total: number;
  pct: number;
}

/** Compute compliance for a single day.
 *  hasPlannedSession: whether this day has a planned workout session. */
export function computeDayCompliance(
  log: DayComplianceInput,
  hasPlannedSession: boolean,
): ComplianceResult {
  if (log.is_sick_day) {
    const checked = (log.hydration_tracked ? 1 : 0) + (log.vampire_bedtime ? 1 : 0);
    return { checked, total: 2, pct: Math.round((checked / 2) * 100) };
  }

  const items = [
    log.core_work_done,
    log.rug_protocol_done,
    log.vampire_bedtime ? 1 : 0,
    log.hydration_tracked,
    log.kitchen_cutoff_hit,
  ];
  if (hasPlannedSession) {
    items.push(log.workout_completed);
  }

  const checked = items.filter(Boolean).length;
  const total = items.length;
  return { checked, total, pct: total > 0 ? Math.round((checked / total) * 100) : 0 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run __tests__/compliance.test.ts`
Expected: PASS

- [ ] **Step 5: Add tests for `computeWeekCompliancePct`**

Append to `dashboard/__tests__/compliance.test.ts`:

```typescript
import { computeWeekCompliancePct } from '../lib/daily-log';

describe('computeWeekCompliancePct', () => {
  it('returns 100 for a perfect week', () => {
    const logs = Array.from({ length: 5 }, () => ({
      workout_completed: 1, core_work_done: 1, rug_protocol_done: 1,
      vampire_bedtime: '22:00', hydration_tracked: 1, kitchen_cutoff_hit: 1,
      is_sick_day: 0,
    }));
    // 5 training days, 4 have planned sessions
    const result = computeWeekCompliancePct(logs, [true, true, true, true, false]);
    expect(result).toBe(100);
  });

  it('adjusts denominator for sick days', () => {
    const logs = [
      { workout_completed: 1, core_work_done: 1, rug_protocol_done: 1,
        vampire_bedtime: '22:00', hydration_tracked: 1, kitchen_cutoff_hit: 1, is_sick_day: 0 },
      { workout_completed: 0, core_work_done: 0, rug_protocol_done: 0,
        vampire_bedtime: '22:00', hydration_tracked: 1, kitchen_cutoff_hit: 0, is_sick_day: 1 },
    ];
    // Day 1: 6/6, Day 2 (sick): 2/2 => 8/8 = 100
    const result = computeWeekCompliancePct(logs, [true, false]);
    expect(result).toBe(100);
  });

  it('returns 0 for empty week', () => {
    expect(computeWeekCompliancePct([], [])).toBe(0);
  });
});
```

- [ ] **Step 6: Implement `computeWeekCompliancePct`**

Add to `dashboard/lib/daily-log.ts`:

```typescript
/** Compute overall compliance % for a week from an array of day logs.
 *  hasPlannedSession[i] indicates whether logs[i] has a planned session. */
export function computeWeekCompliancePct(
  logs: DayComplianceInput[],
  hasPlannedSession: boolean[],
): number {
  if (logs.length === 0) return 0;
  let totalChecked = 0;
  let totalItems = 0;
  for (let i = 0; i < logs.length; i++) {
    const c = computeDayCompliance(logs[i], hasPlannedSession[i] ?? false);
    totalChecked += c.checked;
    totalItems += c.total;
  }
  return totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0;
}
```

- [ ] **Step 7: Run all compliance tests**

Run: `cd dashboard && npx vitest run __tests__/compliance.test.ts`
Expected: PASS

- [ ] **Step 8: Add tests for `getBedtimeComplianceLevel`**

Append to `dashboard/__tests__/compliance.test.ts`:

```typescript
import { getBedtimeComplianceLevel } from '../lib/daily-log';

describe('getBedtimeComplianceLevel', () => {
  it('returns "on-time" for before 23:00', () => {
    expect(getBedtimeComplianceLevel('22:30')).toBe('on-time');
  });
  it('returns "late" for 23:00-23:59', () => {
    expect(getBedtimeComplianceLevel('23:15')).toBe('late');
  });
  it('returns "way-late" for after midnight (24h+ format)', () => {
    expect(getBedtimeComplianceLevel('24:30')).toBe('way-late');
  });
  it('returns null when no bedtime', () => {
    expect(getBedtimeComplianceLevel(null)).toBeNull();
  });
});
```

- [ ] **Step 9: Implement `getBedtimeComplianceLevel`**

Add to `dashboard/lib/daily-log.ts`:

```typescript
export type BedtimeLevel = 'on-time' | 'late' | 'way-late';

/** Determine bedtime compliance level from stored 24h+ format. */
export function getBedtimeComplianceLevel(storedTime: string | null): BedtimeLevel | null {
  if (!storedTime) return null;
  const [h] = storedTime.split(':').map(Number);
  if (h < 23) return 'on-time';
  if (h < 24) return 'late';
  return 'way-late';
}
```

- [ ] **Step 10: Run all compliance tests**

Run: `cd dashboard && npx vitest run __tests__/compliance.test.ts`
Expected: PASS

- [ ] **Step 11: Add tests for `getComplianceColor`**

```typescript
import { getComplianceColor } from '../lib/daily-log';

describe('getComplianceColor', () => {
  it('returns green when target met', () => {
    expect(getComplianceColor(3, 3)).toBe('success');
    expect(getComplianceColor(7, 7)).toBe('success');
  });
  it('returns yellow when 1-2 behind', () => {
    expect(getComplianceColor(5, 7)).toBe('warning');
    expect(getComplianceColor(6, 7)).toBe('warning');
  });
  it('returns red when 3+ behind', () => {
    expect(getComplianceColor(4, 7)).toBe('error');
    expect(getComplianceColor(0, 7)).toBe('error');
  });
});
```

- [ ] **Step 12: Implement `getComplianceColor`**

```typescript
/** Universal compliance color: green = target met, yellow = 1-2 behind, red = 3+ behind. */
export function getComplianceColor(current: number, target: number): 'success' | 'warning' | 'error' {
  const behind = target - current;
  if (behind <= 0) return 'success';
  if (behind <= 2) return 'warning';
  return 'error';
}
```

- [ ] **Step 13: Run all compliance tests, then commit**

Run: `cd dashboard && npx vitest run __tests__/compliance.test.ts`
Expected: PASS

```bash
git add dashboard/lib/daily-log.ts dashboard/__tests__/compliance.test.ts
git commit -m "feat: add compliance math functions — day/week pct, bedtime level, color"
```

---

### Task 2: Streak Computation

**Files:**
- Modify: `dashboard/lib/daily-log.ts`
- Modify: `dashboard/lib/db.ts`
- Modify: `dashboard/__tests__/compliance.test.ts`

- [ ] **Step 1: Add `getAllDailyLogs` to `lib/db.ts`**

Add to `dashboard/lib/db.ts` after the existing `getDailyLogsByWeek` function (line ~563):

```typescript
export function getAllDailyLogs(): DailyLog[] {
  const db = getDb();
  return db.prepare('SELECT * FROM daily_logs ORDER BY date').all() as DailyLog[];
}
```

- [ ] **Step 2: Write failing tests for `computeStreak`**

Append to `dashboard/__tests__/compliance.test.ts`:

```typescript
import { computeStreak, type StreakLogEntry } from '../lib/daily-log';

describe('computeStreak', () => {
  const compliantDay = (date: string, isSick = false): StreakLogEntry => ({
    date,
    workout_completed: 1, core_work_done: 1, rug_protocol_done: 1,
    vampire_bedtime: '22:00', hydration_tracked: 1, kitchen_cutoff_hit: 1,
    is_sick_day: isSick ? 1 : 0,
  });

  const partialDay = (date: string): StreakLogEntry => ({
    date,
    workout_completed: 0, core_work_done: 0, rug_protocol_done: 0,
    vampire_bedtime: null, hydration_tracked: 0, kitchen_cutoff_hit: 0,
    is_sick_day: 0,
  });

  it('returns 0/0 for empty logs', () => {
    expect(computeStreak([], '2026-03-21', [])).toEqual({ current: 0, best: 0 });
  });

  it('counts consecutive compliant days', () => {
    const logs = [
      compliantDay('2026-03-19'),
      compliantDay('2026-03-20'),
      compliantDay('2026-03-21'),
    ];
    // All have planned sessions
    const result = computeStreak(logs, '2026-03-21', ['2026-03-19', '2026-03-20', '2026-03-21']);
    expect(result.current).toBe(3);
  });

  it('skips Saturdays (family day)', () => {
    // 2026-03-21 is Saturday
    const logs = [
      compliantDay('2026-03-20'), // Friday
      // Saturday 2026-03-21 skipped
      compliantDay('2026-03-22'), // Sunday
    ];
    const result = computeStreak(logs, '2026-03-22', ['2026-03-20', '2026-03-22']);
    expect(result.current).toBe(2);
  });

  it('sick day with both items maintains streak', () => {
    const logs = [
      compliantDay('2026-03-19'),
      compliantDay('2026-03-20', true), // sick but compliant
      compliantDay('2026-03-21'),
    ];
    const result = computeStreak(logs, '2026-03-21', ['2026-03-19', '2026-03-21']);
    expect(result.current).toBe(3);
  });

  it('tracks best streak separately', () => {
    const logs = [
      compliantDay('2026-03-17'),
      compliantDay('2026-03-18'),
      compliantDay('2026-03-19'),
      partialDay('2026-03-20'), // breaks streak
      compliantDay('2026-03-21'),
    ];
    const result = computeStreak(logs, '2026-03-21', ['2026-03-17', '2026-03-18', '2026-03-19', '2026-03-20', '2026-03-21']);
    expect(result.current).toBe(1);
    expect(result.best).toBe(3);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run __tests__/compliance.test.ts`
Expected: FAIL — `computeStreak` not exported

- [ ] **Step 4: Implement `computeStreak`**

Add to `dashboard/lib/daily-log.ts`:

```typescript
export type StreakLogEntry = DayComplianceInput & { date: string };

/** Compute current and best streak from daily logs.
 *  A day is compliant if >=80% of applicable items checked.
 *  Saturdays are skipped. datesWithSessions lists dates that have planned sessions. */
export function computeStreak(
  allLogs: StreakLogEntry[],
  currentDate: string,
  datesWithSessions: string[],
): { current: number; best: number } {
  if (allLogs.length === 0) return { current: 0, best: 0 };

  const sessionSet = new Set(datesWithSessions);
  const logMap = new Map(allLogs.map(l => [l.date, l]));

  // Walk all dates to compute best streak
  const sortedDates = [...logMap.keys()].sort();
  let best = 0;
  let currentRun = 0;
  let current = 0;

  // Generate all dates from first log to currentDate
  const startDate = sortedDates[0];
  const allDates: string[] = [];
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(currentDate + 'T12:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().slice(0, 10);
    allDates.push(ds);
  }

  for (const ds of allDates) {
    const dateObj = new Date(ds + 'T12:00:00');
    // Skip Saturdays
    if (dateObj.getDay() === 6) continue;

    const log = logMap.get(ds);
    if (!log) {
      // No log = streak broken (missed day)
      currentRun = 0;
      continue;
    }

    const compliance = computeDayCompliance(log, sessionSet.has(ds));
    if (compliance.pct >= 80) {
      currentRun++;
      if (currentRun > best) best = currentRun;
    } else {
      currentRun = 0;
    }
  }

  current = currentRun;
  return { current, best };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run __tests__/compliance.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/daily-log.ts dashboard/lib/db.ts dashboard/__tests__/compliance.test.ts
git commit -m "feat: add streak computation with Saturday skip and sick day support"
```

---

### Task 3: Uncompleted Sessions Query + API Updates

**Files:**
- Modify: `dashboard/lib/db.ts`
- Modify: `dashboard/lib/daily-log.ts`
- Modify: `dashboard/app/api/log/route.ts`

- [ ] **Step 1: Add `getUncompletedSessionsForWeek` to `lib/db.ts`**

Add after `getAllDailyLogs` in `dashboard/lib/db.ts`:

```typescript
export interface UncompletedSession {
  id: number;
  day: string;
  session_type: string;
  focus: string;
  workout_plan: string | null;
}

export function getUncompletedSessionsForWeek(weekNumber: number): UncompletedSession[] {
  const db = getDb();
  return db.prepare(`
    SELECT p.id, p.day, p.session_type, p.focus, p.workout_plan
    FROM plan_items p
    LEFT JOIN daily_logs d ON d.workout_plan_item_id = p.id AND d.workout_completed = 1
    WHERE p.week_number = ? AND d.id IS NULL
    ORDER BY p.id
  `).all(weekNumber) as UncompletedSession[];
}
```

- [ ] **Step 2: Update GET `/api/log` to include uncompleted sessions and streak**

Replace `dashboard/app/api/log/route.ts` GET handler:

```typescript
import { NextResponse } from 'next/server';
import { getDailyLog, upsertDailyLog, getPlanItems, getUncompletedSessionsForWeek, getAllDailyLogs } from '@/lib/db';
import { getWeekForDate, getDayName, getDayAbbrev, findPlanItemForDate, computeStreak, computeDayCompliance } from '@/lib/daily-log';

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
  const dayAbbrev = getDayAbbrev(date);
  const plannedSession = planItems.find((item: { day: string }) =>
    item.day === dayName || item.day.startsWith(dayAbbrev)
  ) || null;

  // Uncompleted sessions for the week
  const uncompletedSessions = getUncompletedSessionsForWeek(weekNumber);

  // Streak computation — determine which dates had planned sessions
  const allLogs = getAllDailyLogs();
  const datesWithSessions = allLogs
    .filter(l => {
      const dn = getDayName(l.date);
      const da = getDayAbbrev(l.date);
      const items = getPlanItems(l.week_number);
      return items.some((item: { day: string }) =>
        item.day === dn || item.day.startsWith(da)
      );
    })
    .map(l => l.date);

  const streak = computeStreak(allLogs, date, datesWithSessions);

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
    uncompleted_sessions: uncompletedSessions,
    streak,
  });
}
```

- [ ] **Step 3: Update PUT `/api/log` to accept client-provided `workout_plan_item_id`**

Replace the PUT handler in `dashboard/app/api/log/route.ts`:

```typescript
export async function PUT(request: Request) {
  const body = await request.json();

  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ error: 'Invalid date (YYYY-MM-DD)' }, { status: 400 });
  }

  const weekNumber = getWeekForDate(body.date);

  // Use client-provided workout_plan_item_id if present, else fallback to date-based lookup
  let workoutPlanItemId: number | null = null;
  if (body.workout_plan_item_id != null) {
    workoutPlanItemId = body.workout_plan_item_id;
  } else {
    const planItem = findPlanItemForDate(body.date);
    workoutPlanItemId = planItem?.id || null;
  }

  const saved = upsertDailyLog({
    date: body.date,
    week_number: weekNumber,
    workout_completed: body.workout_completed ? 1 : 0,
    workout_plan_item_id: workoutPlanItemId,
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

- [ ] **Step 4: Verify the app compiles**

Run: `cd dashboard && npx next build 2>&1 | head -30`
Expected: No TypeScript errors related to modified files

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/db.ts dashboard/app/api/log/route.ts
git commit -m "feat: add uncompleted sessions query and streak to GET /api/log, accept client workout_plan_item_id in PUT"
```

---

### Task 4: Compliance Trend Endpoint

**Files:**
- Modify: `dashboard/lib/daily-log.ts`
- Create: `dashboard/app/api/log/compliance-trend/route.ts`

- [ ] **Step 1: Implement `getComplianceTrend` in `lib/daily-log.ts`**

Add to `dashboard/lib/daily-log.ts`:

```typescript
import { getDailyLogsByWeek, getPlanItems, getAllDailyLogs } from './db';

/** Compute compliance % for each of the last N weeks. */
export function getComplianceTrend(
  currentWeek: number,
  weeks: number,
): Array<{ week_number: number; compliance_pct: number; days_logged: number }> {
  const result: Array<{ week_number: number; compliance_pct: number; days_logged: number }> = [];

  for (let w = currentWeek - weeks + 1; w <= currentWeek; w++) {
    if (w < 1) continue;
    const logs = getDailyLogsByWeek(w);
    if (logs.length === 0) {
      result.push({ week_number: w, compliance_pct: 0, days_logged: 0 });
      continue;
    }
    const planItems = getPlanItems(w);
    const hasPlanned = logs.map(l => {
      const dn = getDayName(l.date);
      const da = getDayAbbrev(l.date);
      return planItems.some((item: { day: string }) =>
        item.day === dn || item.day.startsWith(da)
      );
    });
    const pct = computeWeekCompliancePct(logs, hasPlanned);
    result.push({ week_number: w, compliance_pct: pct, days_logged: logs.length });
  }

  return result;
}
```

- [ ] **Step 2: Create the API route**

```typescript
// dashboard/app/api/log/compliance-trend/route.ts
import { NextResponse } from 'next/server';
import { getComplianceTrend, getWeekForDate } from '@/lib/daily-log';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weeksParam = searchParams.get('weeks');
  const weeks = weeksParam ? parseInt(weeksParam, 10) : 12;

  if (isNaN(weeks) || weeks < 1 || weeks > 52) {
    return NextResponse.json({ error: 'weeks must be 1-52' }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const currentWeek = getWeekForDate(today);
  const trend = getComplianceTrend(currentWeek, weeks);

  return NextResponse.json({ trend });
}
```

- [ ] **Step 3: Verify the endpoint compiles**

Run: `cd dashboard && npx next build 2>&1 | head -30`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/daily-log.ts dashboard/app/api/log/compliance-trend/route.ts
git commit -m "feat: add compliance trend endpoint GET /api/log/compliance-trend"
```

---

### Task 5: Extract NotesCard Component

**Files:**
- Create: `dashboard/components/NotesCard.tsx`

The simplest component — extract first to start the decomposition.

- [ ] **Step 1: Create `NotesCard.tsx`**

```typescript
// dashboard/components/NotesCard.tsx
'use client';

import { Card, CardContent, TextField, Typography } from '@mui/material';

interface NotesCardProps {
  notes: string | null;
  onUpdate: (notes: string | null) => void;
}

export default function NotesCard({ notes, onUpdate }: NotesCardProps) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Notes
        </Typography>
        <TextField
          multiline
          rows={3}
          fullWidth
          placeholder="Any notes (injuries, sleep disruptions, etc.)"
          value={notes || ''}
          onChange={(e) => onUpdate(e.target.value || null)}
          size="small"
        />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/NotesCard.tsx
git commit -m "feat: extract NotesCard component from DailyLog"
```

---

### Task 6: BedtimeCard Component

**Files:**
- Create: `dashboard/components/BedtimeCard.tsx`

- [ ] **Step 1: Create `BedtimeCard.tsx`**

```typescript
// dashboard/components/BedtimeCard.tsx
'use client';

import { useState } from 'react';
import { Box, Button, Card, CardContent, Chip, TextField, Typography } from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import EditIcon from '@mui/icons-material/Edit';

interface BedtimeCardProps {
  bedtime: string | null; // stored in 24h+ format
  onUpdate: (bedtime: string | null) => void;
}

function fromBedtimeStorage(stored: string): string {
  const [h, m] = stored.split(':').map(Number);
  if (h >= 24) return `${(h - 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  return stored;
}

function toBedtimeStorage(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (h < 6) return `${h + 24}:${m.toString().padStart(2, '0')}`;
  return time;
}

function getComplianceLevel(storedTime: string): { label: string; color: 'success' | 'warning' | 'error' } {
  const [h] = storedTime.split(':').map(Number);
  if (h < 23) return { label: 'On time', color: 'success' };
  if (h < 24) return { label: 'Late', color: 'warning' };
  return { label: 'Way late', color: 'error' };
}

export default function BedtimeCard({ bedtime, onUpdate }: BedtimeCardProps) {
  const [editing, setEditing] = useState(false);

  const displayTime = bedtime ? fromBedtimeStorage(bedtime) : '';
  const bedtimeHour = displayTime ? parseInt(displayTime.split(':')[0], 10) : null;
  const isAfterMidnight = bedtimeHour !== null && bedtimeHour >= 0 && bedtimeHour < 6;
  const compliance = bedtime ? getComplianceLevel(bedtime) : null;

  const handleLightsOut = () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    onUpdate(toBedtimeStorage(timeStr));
    setEditing(false);
  };

  const handleTimeChange = (raw: string) => {
    if (!raw) {
      onUpdate(null);
      return;
    }
    onUpdate(toBedtimeStorage(raw));
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Bedtime (Vampire Protocol)
        </Typography>

        {!bedtime && !editing ? (
          <Button
            variant="contained"
            startIcon={<DarkModeIcon />}
            onClick={handleLightsOut}
            sx={{
              bgcolor: '#312e81',
              '&:hover': { bgcolor: '#3730a3' },
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Lights Out
          </Button>
        ) : bedtime && !editing ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body1" fontWeight={600}>
              Logged at {displayTime}
            </Typography>
            <Button
              size="small"
              startIcon={<EditIcon />}
              onClick={() => setEditing(true)}
              sx={{ textTransform: 'none' }}
            >
              Edit
            </Button>
            {compliance && (
              <Chip label={compliance.label} size="small" color={compliance.color} />
            )}
          </Box>
        ) : (
          <Box>
            <TextField
              type="time"
              value={displayTime}
              onChange={(e) => handleTimeChange(e.target.value)}
              size="small"
              sx={{ width: { xs: '100%', sm: 200 } }}
              slotProps={{ inputLabel: { shrink: true } }}
              autoFocus={editing}
            />
            {bedtime && (
              <Button size="small" onClick={() => setEditing(false)} sx={{ ml: 1 }}>
                Done
              </Button>
            )}
          </Box>
        )}

        {isAfterMidnight && displayTime && (
          <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
            After midnight — logged as next-day bedtime
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/BedtimeCard.tsx
git commit -m "feat: create BedtimeCard with Lights Out button and compliance indicator"
```

---

### Task 7: DailyChecklist Component

**Files:**
- Create: `dashboard/components/DailyChecklist.tsx`

- [ ] **Step 1: Create `DailyChecklist.tsx`**

```typescript
// dashboard/components/DailyChecklist.tsx
'use client';

import { Box, Card, CardContent, Checkbox, Chip, FormControlLabel, Typography } from '@mui/material';

interface WeekTallies {
  core: number;
  rug: number;
  kitchen: number;
  hydration: number;
}

interface DailyChecklistProps {
  coreWorkDone: number;
  rugProtocolDone: number;
  kitchenCutoffHit: number;
  hydrationTracked: number;
  weekTallies: WeekTallies;
  onUpdate: (field: string, value: number) => void;
}

const ITEMS = [
  { field: 'core_work_done', label: 'Core work done', tallyKey: 'core' as const, target: 3 },
  { field: 'rug_protocol_done', label: 'Rug Protocol (GOWOD)', tallyKey: 'rug' as const, target: 7 },
  { field: 'kitchen_cutoff_hit', label: 'Kitchen Cutoff (20:00)', tallyKey: 'kitchen' as const, target: 7 },
  { field: 'hydration_tracked', label: 'Hydration tracked', tallyKey: 'hydration' as const, target: 7 },
];

// Import from lib/daily-log.ts: import { getComplianceColor } from '@/lib/daily-log';
// Use getComplianceColor(current, target) instead of a local getColor function.

export default function DailyChecklist({
  coreWorkDone, rugProtocolDone, kitchenCutoffHit, hydrationTracked,
  weekTallies, onUpdate,
}: DailyChecklistProps) {
  const values: Record<string, number> = {
    core_work_done: coreWorkDone,
    rug_protocol_done: rugProtocolDone,
    kitchen_cutoff_hit: kitchenCutoffHit,
    hydration_tracked: hydrationTracked,
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Daily Checklist
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {ITEMS.map((item) => (
            <Box key={item.field} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!values[item.field]}
                    onChange={(e) => onUpdate(item.field, e.target.checked ? 1 : 0)}
                  />
                }
                label={item.label}
              />
              <Chip
                label={`${weekTallies[item.tallyKey]}/${item.target}`}
                size="small"
                color={getComplianceColor(weekTallies[item.tallyKey], item.target)}
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: 22 }}
              />
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/DailyChecklist.tsx
git commit -m "feat: create DailyChecklist with weekly compliance indicators"
```

---

### Task 8: SessionPicker Component

**Files:**
- Create: `dashboard/components/SessionPicker.tsx`

- [ ] **Step 1: Create `SessionPicker.tsx`**

```typescript
// dashboard/components/SessionPicker.tsx
'use client';

import { useState } from 'react';
import {
  Box, Button, Card, CardContent, Checkbox, Chip,
  Collapse, FormControlLabel, Radio, RadioGroup, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useRouter } from 'next/navigation';

interface UncompletedSession {
  id: number;
  day: string;
  session_type: string;
  focus: string;
  workout_plan?: string | null;
}

interface PlannedSession {
  id?: number;
  session_type: string;
  focus: string;
  workout_plan?: string;
}

interface SessionPickerProps {
  date: string;
  plannedSession: PlannedSession | null;
  uncompletedSessions: UncompletedSession[];
  workoutCompleted: number;
  sessionsCompleted: number;
  sessionsPlanned: number;
  onUpdate: (completed: number, planItemId: number | null) => void;
}

// Import from lib/daily-log.ts: import { getComplianceColor } from '@/lib/daily-log';
// Use getComplianceColor(current, target) for color computation.

export default function SessionPicker({
  date, plannedSession, uncompletedSessions, workoutCompleted,
  sessionsCompleted, sessionsPlanned, onUpdate,
}: SessionPickerProps) {
  const router = useRouter();
  const [showOthers, setShowOthers] = useState(!plannedSession);
  const [selectedId, setSelectedId] = useState<number | null>(plannedSession?.id ?? null);

  const dateObj = new Date(date + 'T12:00:00');
  const isSaturday = dateObj.getDay() === 6;

  // No plan for the week
  if (!plannedSession && uncompletedSessions.length === 0) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {"Today's Session"}
          </Typography>
          {isSaturday ? (
            <Chip label="Family Day" size="small" color="secondary" variant="outlined" />
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">No plan this week.</Typography>
              <Button size="small" onClick={() => router.push('/checkin')}>Run Check-In</Button>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  }

  // All sessions done
  if (uncompletedSessions.length === 0 && workoutCompleted) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon color="success" />
            <Typography variant="body2" fontWeight={600}>All sessions done this week</Typography>
            <Chip
              label={`${sessionsCompleted}/${sessionsPlanned}`}
              size="small"
              color="success"
              variant="outlined"
              sx={{ ml: 'auto', fontSize: '0.7rem', height: 22 }}
            />
          </Box>
        </CardContent>
      </Card>
    );
  }

  const selectedSession = selectedId
    ? uncompletedSessions.find(s => s.id === selectedId) || plannedSession
    : plannedSession;

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            {"Today's Session"}
          </Typography>
          {sessionsPlanned > 0 && (
            <Chip
              label={`${sessionsCompleted}/${sessionsPlanned}`}
              size="small"
              color={getComplianceColor(sessionsCompleted, sessionsPlanned)}
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          )}
        </Box>

        {/* Selected/planned session details */}
        {selectedSession && (
          <Box sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Chip label={selectedSession.session_type} size="small" color="primary" />
              <Chip label={selectedSession.focus} size="small" variant="outlined" />
            </Box>
            {selectedSession.workout_plan && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {selectedSession.workout_plan}
              </Typography>
            )}
          </Box>
        )}

        {!plannedSession && !selectedSession && (
          <Chip label="Rest Day" size="small" variant="outlined" sx={{ mb: 1 }} />
        )}

        {/* Completion checkbox */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={!!workoutCompleted}
                onChange={(e) => onUpdate(e.target.checked ? 1 : 0, selectedId)}
              />
            }
            label="Session completed"
          />
          {selectedSession && (
            <Chip label={selectedSession.focus} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
          )}
        </Box>

        {/* Other uncompleted sessions */}
        {uncompletedSessions.length > 1 && (
          <Box sx={{ mt: 1 }}>
            <Button
              size="small"
              onClick={() => setShowOthers(!showOthers)}
              endIcon={showOthers ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ textTransform: 'none' }}
            >
              {showOthers ? 'Hide' : 'Show'} other sessions ({uncompletedSessions.length - (plannedSession ? 1 : 0)})
            </Button>
            <Collapse in={showOthers}>
              <RadioGroup
                value={selectedId ?? ''}
                onChange={(e) => setSelectedId(Number(e.target.value))}
                sx={{ mt: 0.5 }}
              >
                {uncompletedSessions
                  .filter(s => s.id !== plannedSession?.id)
                  .map((session) => (
                    <FormControlLabel
                      key={session.id}
                      value={session.id}
                      control={<Radio size="small" />}
                      label={
                        <Typography variant="body2">
                          {session.day} &middot; {session.focus}
                        </Typography>
                      }
                    />
                  ))}
              </RadioGroup>
            </Collapse>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/SessionPicker.tsx
git commit -m "feat: create SessionPicker with flexible session selection and compliance indicator"
```

---

### Task 9: DayProgress Component

**Files:**
- Create: `dashboard/components/DayProgress.tsx`

- [ ] **Step 1: Create `DayProgress.tsx`**

```typescript
// dashboard/components/DayProgress.tsx
'use client';

import { Box, Typography } from '@mui/material';

interface DayProgressProps {
  checked: number;
  total: number;
  streak: { current: number; best: number };
}

export default function DayProgress({ checked, total, streak }: DayProgressProps) {
  const pct = total > 0 ? checked / total : 0;
  const isComplete = pct === 1;

  // SVG ring parameters
  const size = 80;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, py: 1 }}>
      {/* Progress Ring */}
      <Box sx={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            opacity={0.12}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={isComplete ? '#22c55e' : '#3b82f6'}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s ease',
              ...(isComplete ? { filter: 'drop-shadow(0 0 4px #22c55e)' } : {}),
            }}
          />
        </svg>
        {/* Center text */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="body2" fontWeight={700} fontSize="0.85rem">
            {checked}/{total}
          </Typography>
        </Box>
      </Box>

      {/* Streak */}
      <Box sx={{ textAlign: 'left' }}>
        {streak.current > 0 && (
          <Typography variant="body2" fontWeight={700} sx={{ color: '#f97316' }}>
            {streak.current} day streak
          </Typography>
        )}
        {streak.current === 0 && (
          <Typography variant="body2" color="text.secondary">
            No active streak
          </Typography>
        )}
        {streak.best > 0 && (
          <Typography variant="caption" color="text.secondary">
            Best: {streak.best} days
          </Typography>
        )}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/DayProgress.tsx
git commit -m "feat: create DayProgress with SVG ring and streak counter"
```

---

### Task 10: WeekComplianceBar Component

**Files:**
- Create: `dashboard/components/WeekComplianceBar.tsx`

- [ ] **Step 1: Create `WeekComplianceBar.tsx`**

```typescript
// dashboard/components/WeekComplianceBar.tsx
'use client';

import { Box, Chip, Typography } from '@mui/material';

interface MetricTally {
  label: string;
  current: number;
  target: number;
}

interface WeekComplianceBarProps {
  metrics: MetricTally[];
  overallPct: number;
}

// Import from lib/daily-log.ts: import { getComplianceColor } from '@/lib/daily-log';
// Use getComplianceColor(current, target) for color computation.

export default function WeekComplianceBar({ metrics, overallPct }: WeekComplianceBarProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexWrap: 'wrap',
        py: 1.5,
        px: 1,
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', flex: 1 }}>
        {metrics.map((m) => (
          <Chip
            key={m.label}
            label={`${m.label} ${m.current}/${m.target}`}
            size="small"
            color={getComplianceColor(m.current, m.target)}
            variant="outlined"
            sx={{ fontSize: '0.65rem', height: 22 }}
          />
        ))}
      </Box>
      <Typography
        variant="h6"
        fontWeight={700}
        color={overallPct >= 80 ? 'success.main' : overallPct >= 50 ? 'warning.main' : 'error.main'}
      >
        {overallPct}%
      </Typography>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/WeekComplianceBar.tsx
git commit -m "feat: create WeekComplianceBar with per-metric tallies and overall percentage"
```

---

### Task 11: ComplianceSparkline Component

**Files:**
- Create: `dashboard/components/ComplianceSparkline.tsx`

- [ ] **Step 1: Create `ComplianceSparkline.tsx`**

```typescript
// dashboard/components/ComplianceSparkline.tsx
'use client';

import { Box, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { SparkLineChart } from '@mui/x-charts';

interface TrendPoint {
  week_number: number;
  compliance_pct: number;
  days_logged: number;
}

interface ComplianceSparklineProps {
  trend: TrendPoint[];
  currentWeek: number;
}

export default function ComplianceSparkline({ trend, currentWeek }: ComplianceSparklineProps) {
  const router = useRouter();

  if (trend.length === 0) return null;

  const data = trend.map(t => t.compliance_pct);
  const labels = trend.map(t =>
    t.week_number === currentWeek ? `W${t.week_number}: --` : `W${t.week_number}: ${t.compliance_pct}%`
  );

  return (
    <Box
      sx={{ py: 1, px: 1, cursor: 'pointer' }}
      onClick={() => router.push('/trends')}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          Weekly Compliance
        </Typography>
        <Typography variant="caption" color="text.disabled">
          (tap for full view)
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ width: 120, height: 40 }}>
          <SparkLineChart
            data={data}
            height={40}
            width={120}
            curve="natural"
            colors={['#3b82f6']}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {labels.map((label, i) => (
            <Typography key={i} variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
              {label}
            </Typography>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Verify SparkLineChart is available**

Run: `cd dashboard && node -e "try { require('@mui/x-charts'); console.log('OK'); } catch { console.log('MISSING'); }"`

If MISSING: `cd dashboard && npm install @mui/x-charts` (it's likely already present since TrendCharts uses MUI X-Charts)

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/ComplianceSparkline.tsx
git commit -m "feat: create ComplianceSparkline with 4-week trend mini chart"
```

---

### Task 12: Refactor DailyLog.tsx to Orchestrator

**Files:**
- Modify: `dashboard/components/DailyLog.tsx`
- Modify: `dashboard/app/log/page.tsx`

This is the integration task — rewire the parent to use the new sub-components.

- [ ] **Step 1: Update `page.tsx` interfaces and data fetching**

Read the current file, then update `dashboard/app/log/page.tsx` to:
1. Add `uncompletedSessions`, `streak`, and `complianceTrend` state
2. Extract them from the `GET /api/log` response
3. Fetch compliance trend from `/api/log/compliance-trend?weeks=4`
4. Add workout label chip to the header
5. Pass new props to `DailyLog`

Key changes to make in `page.tsx`:
- Add new state: `uncompletedSessions`, `streak`, `complianceTrend`
- In `fetchDayLog`: extract `uncompleted_sessions` and `streak` from response
- Add new `useEffect` to fetch compliance trend (once, not per day)
- Add `Chip` import and render workout label chip below date in header
- Update `DailyLog` props to include new data

- [ ] **Step 2: Rewrite `DailyLog.tsx` as orchestrator**

Replace `dashboard/components/DailyLog.tsx` with the orchestrator that:
1. Manages form state + auto-save (keep existing debounce logic)
2. Computes week tallies from `weekLogs` prop
3. Computes day compliance for `DayProgress`
4. Renders sub-components in the layout order from the spec:
   - DayProgress (if not Saturday)
   - Sick day toggle
   - SessionPicker (if not sick)
   - DailyChecklist (if not sick; hydration standalone if sick)
   - BedtimeCard
   - NotesCard
   - WeekComplianceBar
   - ComplianceSparkline

New props interface:
```typescript
interface DailyLogProps {
  date: string;
  log: LogData;
  plannedSession: PlannedSession | null;
  uncompletedSessions: UncompletedSession[];
  weekLogs: WeekLog[];
  streak: { current: number; best: number };
  complianceTrend: TrendPoint[];
  currentWeek: number;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}
```

- [ ] **Step 3: Verify the app compiles and renders**

Run: `cd dashboard && npx next build 2>&1 | head -30`
Expected: No errors

- [ ] **Step 4: Manual test**

Run: `cd dashboard && npx next dev`
Navigate to `/log`. Verify:
- Workout label chip appears in header
- Progress ring shows
- Checklist items have compliance indicators
- Bedtime card has Lights Out button
- Week compliance bar shows at bottom
- Sparkline renders (may be empty if no historical data)

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/DailyLog.tsx dashboard/app/log/page.tsx
git commit -m "feat: refactor DailyLog into orchestrator with all v2 sub-components"
```

---

### Task 13: Compliance Trend on Trends Page

**Files:**
- Modify: `dashboard/components/TrendCharts.tsx`
- Modify: `dashboard/app/trends/page.tsx`

- [ ] **Step 1: Add compliance trend chart to TrendCharts**

Read `dashboard/components/TrendCharts.tsx` fully, then add:
- New prop: `complianceTrend: Array<{ week_number: number; compliance_pct: number; days_logged: number }>`
- New state: `complianceView: 'weekly' | 'monthly'` (default `'weekly'`)
- New chart section at the end: "Weekly Compliance" card containing:
  - Toggle buttons (MUI `ToggleButtonGroup`) for Weekly / Monthly view
  - `LineChart` with week numbers on x-axis, 0-100% y-axis
  - For monthly view: group trend data by month (compute average compliance_pct for weeks in the same month), label x-axis with month names
  - Y-axis domain fixed to [0, 100] for consistent scale

- [ ] **Step 2: Update `app/trends/page.tsx` to fetch compliance trend**

Add to the existing `fetchTrends` function:
```typescript
const complianceRes = await fetch('/api/log/compliance-trend?weeks=52');
const complianceData = await complianceRes.json();
setComplianceTrend(complianceData.trend || []);
```

Pass `complianceTrend` to `TrendCharts`.

- [ ] **Step 3: Verify the trends page renders**

Run: `cd dashboard && npx next dev`
Navigate to `/trends`. Verify the compliance chart appears (may be empty with no data).

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/TrendCharts.tsx dashboard/app/trends/page.tsx
git commit -m "feat: add weekly compliance trend chart to Trends page"
```

---

### Task 14: Final Verification

- [ ] **Step 1: Run all tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `cd dashboard && npx next build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Manual verification checklist**

Run `cd dashboard && npx next dev` and verify each item:

1. `/log` — Workout label chip in header shows correct focus
2. `/log` — Rest Day / Family Day chips on appropriate days
3. `/log` — SessionPicker shows uncompleted sessions for the week
4. `/log` — Completing a session on wrong day works (flexible)
5. `/log` — Lights Out button stamps current time
6. `/log` — Bedtime compliance indicator (green/yellow/red)
7. `/log` — Checklist items show weekly tallies with colors
8. `/log` — Progress ring fills as items checked
9. `/log` — Progress ring goes green at 100%
10. `/log` — Sick day adjusts ring denominator to 2
11. `/log` — Streak counter shows and updates
12. `/log` — Week compliance bar at bottom
13. `/log` — Sparkline shows (with available data)
14. `/trends` — Compliance chart renders

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address final verification issues in daily log v2"
```
