# Design System + Dashboard Home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a semantic design system and redesign the dashboard home page with 3-tier information hierarchy, Whoop-inspired recovery score, phase-aware weight sparkline, and compliance ring.

**Architecture:** New design token module defines semantic colors, card hierarchy, and typography. New specialized card components (HeroCard, MetricCard, etc.) replace SparklineCard on the dashboard. The Garmin API is extended to expose training load focus, endurance score, and HR zone data. The dashboard page is rewritten with a 3-tier layout. All changes are frontend-only — no coach or backend logic changes.

**Tech Stack:** Next.js 15, MUI 6, MUI X-Charts, TypeScript, SVG (for compliance ring and custom sparklines), better-sqlite3 (read-only for weight history)

**Spec:** `docs/superpowers/specs/2026-03-21-dashboard-redesign-design.md`

**Plan 1 of 3** — This plan is independent. Plan 2 (Workout Tracker) and Plan 3 (Page Refresh) are separate.

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `dashboard/lib/design-tokens.ts` | Semantic colors, card styles, typography constants |
| `dashboard/lib/dashboard-data.ts` | Data transformation functions: weight journey builder, sleep bar builder, HRV trend builder, recovery score calculator, compliance stats |
| `dashboard/components/HeroCard.tsx` | Tier 1 card: big number, semantic color, left border accent |
| `dashboard/components/MetricCard.tsx` | Tier 3 card: medium number, optional sparkline |
| `dashboard/components/DetailRow.tsx` | Inline label + value row |
| `dashboard/components/RecoveryScore.tsx` | Whoop-style recovery number with training directive |
| `dashboard/components/WeightJourney.tsx` | SVG sparkline: full program weight line + phase-stepped target + area fill |
| `dashboard/components/SleepBars.tsx` | SVG: daily bars colored by quality + rolling average line |
| `dashboard/components/HrvTrend.tsx` | SVG: 28-day line + baseline band + trend line |
| `dashboard/components/ComplianceRing.tsx` | SVG donut ring + per-protocol breakdown |
| `dashboard/components/TodayAction.tsx` | Tier 2 hero card: session title, exercise grid, Start Session button |
| `dashboard/components/TrainingLoadFocus.tsx` | Load balance bars (low aero/high aero/anaerobic) with shortage flags + endurance score |
| `dashboard/components/AcwrCard.tsx` | ACWR value + badge + body battery |
| `dashboard/components/HrZoneBar.tsx` | Stacked horizontal bar for HR zone distribution |
| `dashboard/app/api/dashboard/route.ts` | New aggregated API: combines Garmin, periodization, compliance, and weight history into one payload |
| `dashboard/__tests__/dashboard-data.test.ts` | Unit tests for all data transformation functions |

### Modified Files

| File | Changes |
|------|---------|
| `dashboard/lib/types.ts` | Add `DashboardPayload`, `WeightHistoryPoint`, `PhaseTarget`, `LoadFocusData` types |
| `dashboard/app/page.tsx` | Complete rewrite with 3-tier layout using new components |
| `dashboard/lib/garmin.ts` | Add `extractLoadFocus()` and `extractHrZones()` functions |

### Unchanged Files

All API routes, coach files, state files, auth, sidebar, and all other pages remain untouched.

---

## Task 1: Design Tokens

**Files:**
- Create: `dashboard/lib/design-tokens.ts`

- [ ] **Step 1: Create the design tokens file**

```typescript
// dashboard/lib/design-tokens.ts

/** Semantic colors — every color maps to a coaching concept */
export const semanticColors = {
  recovery: {
    good: '#22c55e',      // Recovery >50, Sleep >75
    caution: '#f59e0b',   // Dad baseline, Sleep 60-75
    problem: '#ef4444',   // Recovery <35, Sleep <60
  },
  body: '#3b82f6',        // Weight, HRV, metrics
  protocols: '#8b5cf6',   // Vampire, Rug, compliance
  cardioSteady: '#14b8a6', // Zone 2, recovery sessions
  cardioIntervals: '#f97316', // Rower sprints, StairMaster intervals
} as const;

/** Map a value to a semantic color using thresholds */
export function getSemanticColor(
  value: number,
  greenThreshold: number,
  yellowThreshold: number,
  invert = false,
): string {
  if (invert) {
    if (value <= greenThreshold) return semanticColors.recovery.good;
    if (value <= yellowThreshold) return semanticColors.recovery.caution;
    return semanticColors.recovery.problem;
  }
  if (value >= greenThreshold) return semanticColors.recovery.good;
  if (value >= yellowThreshold) return semanticColors.recovery.caution;
  return semanticColors.recovery.problem;
}

/** Card accent border styles keyed by semantic purpose */
export const cardAccents = {
  recovery: semanticColors.recovery.good,
  body: semanticColors.body,
  sleep: semanticColors.recovery.caution,
  protocols: semanticColors.protocols,
} as const;

/** Typography sizes for the card hierarchy */
export const typography = {
  heroNumber: { fontSize: '2.625rem', fontWeight: 800 },   // 42px
  primaryMetric: { fontSize: '2rem', fontWeight: 800 },     // 32px
  metricValue: { fontSize: '1.5rem', fontWeight: 700 },     // 24px
  sectionTitle: { fontSize: '1.25rem', fontWeight: 700 },   // 20px
  categoryLabel: {
    fontSize: '0.6875rem',  // 11px
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: '#94a3b8',
  },
} as const;

/** Shared card base styles */
export const cardBase = {
  borderRadius: '12px',
  padding: '20px',
} as const;

/** Hero card style (Tier 1) — includes left accent border */
export function heroCardSx(accentColor: string) {
  return {
    borderRadius: cardBase.borderRadius,
    borderLeft: `4px solid ${accentColor}`,
  };
}

/** Metric card style (Tier 3) — no accent border */
export const metricCardSx = {
  borderRadius: cardBase.borderRadius,
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/lib/design-tokens.ts
git commit -m "feat(design): add semantic color system and design tokens"
```

---

## Task 2: Types for Dashboard Payload

**Files:**
- Modify: `dashboard/lib/types.ts`

- [ ] **Step 1: Add new types at end of file**

Add these types after the existing type definitions:

```typescript
// --- Dashboard Redesign Types ---

export interface WeightHistoryPoint {
  weekNumber: number;
  avgWeightKg: number;
}

export interface PhaseTarget {
  phaseNumber: number;
  name: string;
  startWeek: number;
  endWeek: number;
  targetWeightKg: number;
}

export interface LoadFocusData {
  lowAerobic: number;
  lowAerobicTargetMin: number;
  lowAerobicTargetMax: number;
  highAerobic: number;
  highAerobicTargetMin: number;
  highAerobicTargetMax: number;
  anaerobic: number;
  anaerobicTargetMin: number;
  anaerobicTargetMax: number;
  description: string | null;
}

export interface HrZoneSummary {
  z1Minutes: number;
  z2Minutes: number;
  z3Minutes: number;
  z4Minutes: number;
  z5Minutes: number;
}

export interface DashboardPayload {
  // Tier 1
  recoveryScore: number | null;
  recoveryDirective: string;
  recoveryColor: string;
  weight: number | null;
  weightFromStart: number | null; // delta from W1
  weightHistory: WeightHistoryPoint[];
  phaseTargets: PhaseTarget[];
  currentWeek: number;
  avgSleep: number | null;
  dailySleepScores: Array<{ day: string; score: number | null }>;
  sleepAvg7d: number | null;
  compliancePct: number | null;
  vampireDays: number;
  rugDays: number;
  hydrationDays: number;

  // Tier 2
  todaySession: {
    title: string;
    sessionType: string;
    exercises: string[];
    badges: string[];
  } | null;

  // Tier 3
  avgHrv: number | null;
  hrvBaseline: number | null;
  hrvDelta: number | null;
  dailyHrv28d: SparklinePoint[];
  loadFocus: LoadFocusData | null;
  enduranceScore: number | null;
  hrZones: HrZoneSummary | null;
  acwr: number | null;
  acwrStatus: string | null;
  bodyBatteryHigh: number | null;

  // Timeline
  currentPhaseNumber: number;
  morzineDaysAway: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/lib/types.ts
git commit -m "feat(types): add DashboardPayload and supporting types"
```

---

## Task 3: Data Transformation Functions + Tests

**Files:**
- Create: `dashboard/lib/dashboard-data.ts`
- Create: `dashboard/__tests__/dashboard-data.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// dashboard/__tests__/dashboard-data.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateRecoveryScore,
  buildSleepBars,
  getRecoveryDirective,
  getSleepBarColor,
  buildPhaseTargets,
} from '../lib/dashboard-data';

describe('calculateRecoveryScore', () => {
  it('returns combined score: 60% perceived + 40% garmin', () => {
    // perceived 3/5 = 60/100, garmin avg = 50
    // combined = 0.6 * 60 + 0.4 * 50 = 36 + 20 = 56
    expect(calculateRecoveryScore(3, 50)).toBe(56);
  });

  it('returns garmin only when perceived is null', () => {
    expect(calculateRecoveryScore(null, 50)).toBe(50);
  });

  it('returns null when both are null', () => {
    expect(calculateRecoveryScore(null, null)).toBeNull();
  });
});

describe('getRecoveryDirective', () => {
  it('returns "Train as programmed" for score > 50', () => {
    expect(getRecoveryDirective(55)).toBe('Train as programmed');
  });

  it('returns "Reduce volume 20%" for score 35-50', () => {
    expect(getRecoveryDirective(42)).toBe('Reduce volume 20%');
  });

  it('returns "Deload — Zone 2 + mobility" for score < 35', () => {
    expect(getRecoveryDirective(30)).toBe('Deload — Zone 2 + mobility');
  });

  it('returns "Rest day" for score < 20', () => {
    expect(getRecoveryDirective(15)).toBe('Rest day');
  });
});

describe('getSleepBarColor', () => {
  it('returns green for score >= 75', () => {
    expect(getSleepBarColor(80)).toBe('#22c55e');
  });

  it('returns amber for score 60-74', () => {
    expect(getSleepBarColor(65)).toBe('#f59e0b');
  });

  it('returns red for score < 60', () => {
    expect(getSleepBarColor(45)).toBe('#ef4444');
  });
});

describe('buildSleepBars', () => {
  it('builds 7 bars Mon-Sun from daily sleep data', () => {
    const daily = [
      { date: '2026-03-16', score: 45 },
      { date: '2026-03-17', score: 68 },
      { date: '2026-03-18', score: 62 },
    ];
    const bars = buildSleepBars(daily);
    expect(bars).toHaveLength(7);
    expect(bars[0]).toEqual({ day: 'Mon', score: 45 });
    expect(bars[1]).toEqual({ day: 'Tue', score: 68 });
    expect(bars[6]).toEqual({ day: 'Sun', score: null });
  });
});

describe('buildPhaseTargets', () => {
  it('builds phase targets from periodization data', () => {
    const phases = [
      { number: 1, name: 'Reconstruction', dateRange: 'Jan-Mar 2026', weightTarget: '<97kg', focus: [] },
      { number: 2, name: 'Building', dateRange: 'Apr-Jun 2026', weightTarget: '<95kg', focus: [] },
    ];
    const targets = buildPhaseTargets(phases);
    expect(targets[0].targetWeightKg).toBe(97);
    expect(targets[1].targetWeightKg).toBe(95);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run __tests__/dashboard-data.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// dashboard/lib/dashboard-data.ts
import { semanticColors } from './design-tokens';

/**
 * Combined Readiness Score = 60% perceived (1-5 → 0-100) + 40% Garmin avg readiness
 * See CLAUDE.md Section 7: Combined Readiness Decision Matrix
 */
export function calculateRecoveryScore(
  perceivedReadiness: number | null, // 1-5 scale
  garminAvgReadiness: number | null,
): number | null {
  if (perceivedReadiness == null && garminAvgReadiness == null) return null;

  const perceived100 = perceivedReadiness != null
    ? ((perceivedReadiness - 1) / 4) * 100
    : null;

  if (perceived100 != null && garminAvgReadiness != null) {
    return Math.round(0.6 * perceived100 + 0.4 * garminAvgReadiness);
  }
  return garminAvgReadiness != null
    ? Math.round(garminAvgReadiness)
    : Math.round(perceived100!);
}

/** Map recovery score to training directive */
export function getRecoveryDirective(score: number | null): string {
  if (score == null) return 'No data';
  if (score < 20) return 'Rest day';
  if (score < 35) return 'Deload — Zone 2 + mobility';
  if (score <= 50) return 'Reduce volume 20%';
  return 'Train as programmed';
}

/** Map recovery score to semantic color */
export function getRecoveryColor(score: number | null): string {
  if (score == null) return '#94a3b8';
  if (score > 50) return semanticColors.recovery.good;
  if (score >= 35) return semanticColors.recovery.caution;
  return semanticColors.recovery.problem;
}

/** Map sleep score to bar color */
export function getSleepBarColor(score: number): string {
  if (score >= 75) return semanticColors.recovery.good;
  if (score >= 60) return semanticColors.recovery.caution;
  return semanticColors.recovery.problem;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Build 7-day sleep bar data (Mon-Sun) from Garmin daily sleep scores */
export function buildSleepBars(
  dailySleep: Array<{ date: string; score: number }>,
): Array<{ day: string; score: number | null }> {
  // Map dates to day-of-week (ISO: Mon=1, Sun=7)
  const scoreByDay = new Map<number, number>();
  for (const d of dailySleep) {
    const dt = new Date(d.date + 'T12:00:00'); // noon to avoid TZ issues
    const dow = dt.getDay(); // 0=Sun, 1=Mon...6=Sat
    const isoDow = dow === 0 ? 6 : dow - 1; // 0=Mon...6=Sun
    scoreByDay.set(isoDow, d.score);
  }

  return DAY_NAMES.map((day, i) => ({
    day,
    score: scoreByDay.get(i) ?? null,
  }));
}

/** Parse weight target string like "<97kg" or "89kg" to number */
function parseWeightTarget(target: string): number {
  const match = target.match(/([\d.]+)\s*kg/i);
  return match ? parseFloat(match[1]) : 89; // fallback to race weight
}

/** Build phase targets from periodization phases */
export function buildPhaseTargets(
  phases: Array<{
    number: number;
    name: string;
    dateRange: string;
    weightTarget: string;
    focus: string[];
  }>,
): Array<{
  phaseNumber: number;
  name: string;
  targetWeightKg: number;
}> {
  return phases.map((p) => ({
    phaseNumber: p.number,
    name: p.name,
    targetWeightKg: parseWeightTarget(p.weightTarget),
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run __tests__/dashboard-data.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/dashboard-data.ts dashboard/__tests__/dashboard-data.test.ts
git commit -m "feat(data): add recovery score, sleep bars, and phase target builders with tests"
```

---

## Task 4: Extend Garmin Extraction — Load Focus + HR Zones

**Files:**
- Modify: `dashboard/lib/garmin.ts`
- Modify: `dashboard/lib/types.ts` (already extended in Task 2)

- [ ] **Step 1: Add extractLoadFocus and extractHrZones to garmin.ts**

Add these functions at the end of `dashboard/lib/garmin.ts`, after the `extractExtendedSummary` function:

```typescript
import type { LoadFocusData, HrZoneSummary } from './types';

/** Extract training load focus from Garmin data */
export function extractLoadFocus(data: GarminData): LoadFocusData | null {
  const lf = data.performance_stats?.training_status?.load_focus as Record<string, unknown> | undefined;
  if (!lf) return null;

  return {
    lowAerobic: (lf.low_aerobic as number) ?? 0,
    lowAerobicTargetMin: (lf.low_aerobic_target_min as number) ?? 0,
    lowAerobicTargetMax: (lf.low_aerobic_target_max as number) ?? 0,
    highAerobic: (lf.high_aerobic as number) ?? 0,
    highAerobicTargetMin: (lf.high_aerobic_target_min as number) ?? 0,
    highAerobicTargetMax: (lf.high_aerobic_target_max as number) ?? 0,
    anaerobic: (lf.anaerobic as number) ?? 0,
    anaerobicTargetMin: (lf.anaerobic_target_min as number) ?? 0,
    anaerobicTargetMax: (lf.anaerobic_target_max as number) ?? 0,
    description: (lf.description as string) ?? null,
  };
}

/** Extract HR zone totals from this week's activities */
export function extractHrZones(data: GarminData): HrZoneSummary | null {
  const activities = data.activities?.this_week || [];
  if (!activities.length) return null;

  const totals = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
  for (const a of activities) {
    if (a.zone_minutes) {
      totals.z1 += a.zone_minutes.z1 || 0;
      totals.z2 += a.zone_minutes.z2 || 0;
      totals.z3 += a.zone_minutes.z3 || 0;
      totals.z4 += a.zone_minutes.z4 || 0;
      totals.z5 += a.zone_minutes.z5 || 0;
    }
  }

  const hasData = totals.z1 + totals.z2 + totals.z3 + totals.z4 + totals.z5 > 0;
  if (!hasData) return null;

  return {
    z1Minutes: Math.round(totals.z1),
    z2Minutes: Math.round(totals.z2),
    z3Minutes: Math.round(totals.z3),
    z4Minutes: Math.round(totals.z4),
    z5Minutes: Math.round(totals.z5),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/lib/garmin.ts
git commit -m "feat(garmin): add extractLoadFocus and extractHrZones functions"
```

---

## Task 5: Dashboard API Route

**Files:**
- Create: `dashboard/app/api/dashboard/route.ts`

This new endpoint aggregates data from multiple sources into a single `DashboardPayload`, reducing client-side fetch calls from 4 to 1.

- [ ] **Step 1: Create the aggregated dashboard API**

```typescript
// dashboard/app/api/dashboard/route.ts
import { NextResponse } from 'next/server';
import { readGarminData, extractExtendedSummary, extractLoadFocus, extractHrZones } from '@/lib/garmin';
import { getWeeklyMetrics } from '@/lib/db';
import { getTrainingWeek } from '@/lib/week';
import {
  calculateRecoveryScore,
  getRecoveryDirective,
  getRecoveryColor,
  buildSleepBars,
  buildPhaseTargets,
} from '@/lib/dashboard-data';
import type { DashboardPayload, WeightHistoryPoint } from '@/lib/types';

// Read periodization phases (same approach as /api/periodization)
import fs from 'fs';
import path from 'path';

function readPeriodizationPhases() {
  try {
    const filePath = path.join(process.cwd(), '..', 'state', 'periodization.md');
    const content = fs.readFileSync(filePath, 'utf-8');
    // Extract phase data from markdown — simplified parser
    const phases: Array<{
      number: number;
      name: string;
      dateRange: string;
      weightTarget: string;
      focus: string[];
      isCurrent: boolean;
    }> = [];

    const phaseRegex = /##\s*Phase\s+(\d+)[:\s]+(.*?)(?:\n|$)/g;
    let match;
    while ((match = phaseRegex.exec(content)) !== null) {
      phases.push({
        number: parseInt(match[1]),
        name: match[2].trim(),
        dateRange: '',
        weightTarget: '89kg',
        focus: [],
        isCurrent: false,
      });
    }
    return phases;
  } catch {
    return [];
  }
}

export async function GET() {
  const currentWeek = getTrainingWeek();
  const freshness = readGarminData();
  const garmin = freshness.data ? extractExtendedSummary(freshness.data) : null;
  const loadFocus = freshness.data ? extractLoadFocus(freshness.data) : null;
  const hrZones = freshness.data ? extractHrZones(freshness.data) : null;

  // Weight history from weekly_metrics
  const allMetrics = getWeeklyMetrics();
  const weightHistory: WeightHistoryPoint[] = allMetrics
    .filter((m) => m.weightKg != null)
    .map((m) => ({ weekNumber: m.weekNumber, avgWeightKg: m.weightKg! }));

  // Add current week from Garmin if not in metrics yet
  if (garmin?.weight && !weightHistory.find((w) => w.weekNumber === currentWeek)) {
    weightHistory.push({ weekNumber: currentWeek, avgWeightKg: garmin.weight });
  }

  // Recovery score — use latest perceived readiness from daily logs + Garmin
  // For now, use Garmin readiness only (perceived comes from daily log)
  const recoveryScore = calculateRecoveryScore(null, garmin?.avgReadiness ?? null);
  const recoveryDirective = getRecoveryDirective(recoveryScore);
  const recoveryColor = getRecoveryColor(recoveryScore);

  // Sleep bars
  const sleepBars = garmin?.dailySleep
    ? buildSleepBars(garmin.dailySleep.map((d) => ({ date: d.date, score: d.value })))
    : Array.from({ length: 7 }, (_, i) => ({
        day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
        score: null,
      }));

  // Weight from start (W1)
  const startWeight = weightHistory.length > 0
    ? weightHistory.reduce((min, w) => w.weekNumber < min.weekNumber ? w : min).avgWeightKg
    : null;
  const weightFromStart = garmin?.weight && startWeight
    ? Math.round((garmin.weight - startWeight) * 10) / 10
    : null;

  // Phase targets
  const phases = readPeriodizationPhases();
  const phaseTargets = buildPhaseTargets(phases);

  // HRV baseline from 4-week data
  const hrv4w = freshness.data?.performance_stats?.hrv_4w as Record<string, unknown> | undefined;
  const hrvDaily = (hrv4w?.daily as Array<Record<string, unknown>>) || [];
  const hrvValues = hrvDaily
    .map((d) => d.weekly_avg_hrv as number | undefined)
    .filter((v): v is number => v != null);
  const hrvBaseline = hrvValues.length > 0
    ? Math.round(hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length)
    : null;
  const hrvDelta = garmin?.avgHrv != null && hrvBaseline != null
    ? garmin.avgHrv - hrvBaseline
    : null;

  // Full 28-day HRV for sparkline
  const dailyHrv28d = hrvDaily
    .filter((d) => (d.weekly_avg_hrv as number | undefined) != null)
    .map((d) => ({ date: d.date as string, value: d.weekly_avg_hrv as number }));

  // Compliance from daily log week summary
  let compliancePct: number | null = null;
  let vampireDays = 0;
  let rugDays = 0;
  let hydrationDays = 0;
  try {
    const logRes = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/log/week-summary`,
      { cache: 'no-store' },
    );
    if (logRes.ok) {
      const logData = await logRes.json();
      vampireDays = logData.bedtime_compliant_days ?? 0;
      rugDays = logData.rug_days ?? 0;
      hydrationDays = logData.hydration_days ?? 0;
      const total = vampireDays + rugDays + hydrationDays;
      const max = 21; // 7 days × 3 protocols
      compliancePct = Math.round((total / max) * 100);
    }
  } catch {
    // Compliance data unavailable — continue without
  }

  // Morzine countdown
  const morzineDate = new Date('2027-07-05');
  const morzineDaysAway = Math.ceil((morzineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const payload: DashboardPayload = {
    recoveryScore,
    recoveryDirective,
    recoveryColor,
    weight: garmin?.weight ?? null,
    weightFromStart,
    weightHistory,
    phaseTargets,
    currentWeek,
    avgSleep: garmin?.avgSleep ?? null,
    dailySleepScores: sleepBars,
    sleepAvg7d: garmin?.avgSleep ?? null,
    compliancePct,
    vampireDays,
    rugDays,
    hydrationDays,
    todaySession: null, // Populated by client from /api/plan
    avgHrv: garmin?.avgHrv ?? null,
    hrvBaseline,
    hrvDelta,
    dailyHrv28d,
    loadFocus,
    enduranceScore: null, // Not yet available from Garmin connector
    hrZones,
    acwr: garmin?.acwr ?? null,
    acwrStatus: garmin?.acwrStatus ?? null,
    bodyBatteryHigh: garmin?.bodyBatteryHigh ?? null,
    currentPhaseNumber: 1, // Will be enriched by periodization
    morzineDaysAway,
  };

  return NextResponse.json(payload);
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/app/api/dashboard/route.ts
git commit -m "feat(api): add aggregated /api/dashboard endpoint"
```

---

## Task 6: HeroCard Component

**Files:**
- Create: `dashboard/components/HeroCard.tsx`

- [ ] **Step 1: Create HeroCard component**

```typescript
// dashboard/components/HeroCard.tsx
'use client';

import { Card, CardContent, Typography, Box } from '@mui/material';
import { heroCardSx, typography } from '@/lib/design-tokens';

interface HeroCardProps {
  label: string;
  accentColor: string;
  children: React.ReactNode;
}

export default function HeroCard({ label, accentColor, children }: HeroCardProps) {
  return (
    <Card sx={heroCardSx(accentColor)}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography sx={typography.categoryLabel}>
          {label}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/HeroCard.tsx
git commit -m "feat(ui): add HeroCard component (Tier 1)"
```

---

## Task 7: RecoveryScore Component

**Files:**
- Create: `dashboard/components/RecoveryScore.tsx`

- [ ] **Step 1: Create component**

```typescript
// dashboard/components/RecoveryScore.tsx
'use client';

import { Typography, Box } from '@mui/material';
import HeroCard from './HeroCard';
import { typography } from '@/lib/design-tokens';

interface RecoveryScoreProps {
  score: number | null;
  directive: string;
  color: string;
}

export default function RecoveryScore({ score, directive, color }: RecoveryScoreProps) {
  return (
    <HeroCard label="Recovery" accentColor={color}>
      <Box sx={{ textAlign: 'center', py: 1 }}>
        <Typography sx={{ ...typography.heroNumber, color, lineHeight: 1 }}>
          {score ?? '—'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {directive}
        </Typography>
      </Box>
    </HeroCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/RecoveryScore.tsx
git commit -m "feat(ui): add RecoveryScore component (Whoop-style)"
```

---

## Task 8: WeightJourney SVG Sparkline

**Files:**
- Create: `dashboard/components/WeightJourney.tsx`

- [ ] **Step 1: Create component**

This is the most complex sparkline — SVG with actual weight line, phase-stepped target line, area fill, and current position dot.

```typescript
// dashboard/components/WeightJourney.tsx
'use client';

import { Typography, Box } from '@mui/material';
import HeroCard from './HeroCard';
import { cardAccents, semanticColors, typography } from '@/lib/design-tokens';
import type { WeightHistoryPoint } from '@/lib/types';

interface WeightJourneyProps {
  currentWeight: number | null;
  weightFromStart: number | null;
  weightHistory: WeightHistoryPoint[];
  phaseTargets: Array<{ phaseNumber: number; name: string; targetWeightKg: number }>;
  currentWeek: number;
}

export default function WeightJourney({
  currentWeight,
  weightFromStart,
  weightHistory,
  phaseTargets,
  currentWeek,
}: WeightJourneyProps) {
  const hasHistory = weightHistory.length >= 2;

  // SVG dimensions
  const width = 340;
  const height = 120;
  const padTop = 10;
  const padBottom = 20;
  const padLeft = 24;
  const padRight = 10;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // Y-axis range: from max weight to race weight (89kg), with some padding
  const allWeights = weightHistory.map((w) => w.avgWeightKg);
  const targetWeights = phaseTargets.map((p) => p.targetWeightKg);
  const yMax = Math.max(...allWeights, ...targetWeights, 102) + 1;
  const yMin = Math.min(...targetWeights, 89) - 1;

  const toX = (week: number) => padLeft + ((week - 1) / Math.max(currentWeek, 78)) * chartW;
  const toY = (kg: number) => padTop + ((yMax - kg) / (yMax - yMin)) * chartH;

  // Build actual weight polyline
  const weightPoints = weightHistory
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map((w) => `${toX(w.weekNumber)},${toY(w.avgWeightKg)}`)
    .join(' ');

  // Build area fill polygon (weight line + baseline)
  const areaPoints = weightPoints
    + ` ${toX(weightHistory[weightHistory.length - 1]?.weekNumber ?? 1)},${toY(yMin)}`
    + ` ${toX(weightHistory[0]?.weekNumber ?? 1)},${toY(yMin)}`;

  // Phase target dashed line: stepped through phases
  // Approximate phase boundaries: P1=W1-13, P2=W14-26, P3=W27-44, P4=W45-57, P5=W58-70, P6=W71-78
  const phaseBoundaries = [1, 14, 27, 45, 58, 71, 79];
  const targetPoints = phaseTargets
    .flatMap((p, i) => {
      const startW = phaseBoundaries[i] || 1;
      const endW = phaseBoundaries[i + 1] || 79;
      return [
        `${toX(startW)},${toY(p.targetWeightKg)}`,
        `${toX(endW)},${toY(p.targetWeightKg)}`,
      ];
    })
    .join(' ');

  // Delta display
  const deltaText = weightFromStart != null
    ? `${weightFromStart > 0 ? '▲' : '▼'} ${Math.abs(weightFromStart)}kg from start`
    : null;
  const deltaColor = weightFromStart != null && weightFromStart <= 0
    ? semanticColors.recovery.good
    : semanticColors.recovery.problem;

  return (
    <HeroCard label="Weight" accentColor={cardAccents.body}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
        <Typography sx={{ ...typography.primaryMetric, lineHeight: 1.1 }}>
          {currentWeight ?? '—'}
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8', fontWeight: 600 }}>
          kg
        </Typography>
      </Box>
      {deltaText && (
        <Typography sx={{ fontSize: '0.75rem', color: deltaColor, fontWeight: 600, mt: 0.25 }}>
          {deltaText}
        </Typography>
      )}

      {hasHistory && (
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', marginTop: 8 }}>
          <defs>
            <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={semanticColors.body} />
              <stop offset="100%" stopColor={semanticColors.body} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Phase target dashed line */}
          {targetPoints && (
            <polyline
              points={targetPoints}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeDasharray="6,4"
              opacity="0.7"
            />
          )}

          {/* Area fill */}
          <polygon points={areaPoints} fill="url(#weightFill)" opacity="0.15" />

          {/* Actual weight line */}
          <polyline
            points={weightPoints}
            fill="none"
            stroke={semanticColors.body}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Current position dot */}
          {weightHistory.length > 0 && (
            <circle
              cx={toX(weightHistory[weightHistory.length - 1].weekNumber)}
              cy={toY(weightHistory[weightHistory.length - 1].avgWeightKg)}
              r="4"
              fill={semanticColors.body}
              stroke="white"
              strokeWidth="2"
            />
          )}

          {/* Start label */}
          <text x={padLeft} y={padTop - 2} fontSize="8" fill="#94a3b8" fontFamily="Inter, sans-serif">
            {Math.round(allWeights[0] ?? 102)}kg
          </text>

          {/* Target label */}
          <text x={width - padRight} y={toY(89) - 4} fontSize="8" fill="#94a3b8" textAnchor="end" fontFamily="Inter, sans-serif">
            89kg target
          </text>

          {/* Week label */}
          <text
            x={toX(currentWeek)}
            y={toY(weightHistory[weightHistory.length - 1]?.avgWeightKg ?? 99) + 14}
            fontSize="8"
            fill={semanticColors.body}
            textAnchor="middle"
            fontWeight="600"
            fontFamily="Inter, sans-serif"
          >
            W{currentWeek}
          </text>
        </svg>
      )}

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 16, height: 2, bgcolor: semanticColors.body, borderRadius: 1 }} />
          <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8' }}>Actual</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 16, height: 0, borderTop: '2px dashed #94a3b8' }} />
          <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8' }}>Phase target</Typography>
        </Box>
      </Box>
    </HeroCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/WeightJourney.tsx
git commit -m "feat(ui): add WeightJourney SVG sparkline with phase-stepped targets"
```

---

## Task 9: SleepBars Component

**Files:**
- Create: `dashboard/components/SleepBars.tsx`

- [ ] **Step 1: Create component**

```typescript
// dashboard/components/SleepBars.tsx
'use client';

import { Typography, Box } from '@mui/material';
import HeroCard from './HeroCard';
import { getSemanticColor, semanticColors, typography } from '@/lib/design-tokens';
import { getSleepBarColor } from '@/lib/dashboard-data';

interface SleepBarsProps {
  avgSleep: number | null;
  dailyScores: Array<{ day: string; score: number | null }>;
  sleepDelta: number | null;
}

export default function SleepBars({ avgSleep, dailyScores, sleepDelta }: SleepBarsProps) {
  const accentColor = avgSleep != null
    ? getSemanticColor(avgSleep, 75, 60)
    : semanticColors.recovery.caution;

  const maxScore = 100;
  const barH = 55; // max bar height in SVG units

  return (
    <HeroCard label="Avg Sleep" accentColor={accentColor}>
      <Typography sx={{ ...typography.primaryMetric, color: accentColor, lineHeight: 1.1, mt: 0.5 }}>
        {avgSleep ?? '—'}
      </Typography>
      {sleepDelta != null && (
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }}>
          This week · <Box component="span" sx={{ color: sleepDelta >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
            {sleepDelta >= 0 ? '▲' : '▼'} {Math.abs(sleepDelta)} vs last week
          </Box>
        </Typography>
      )}

      <svg viewBox="0 0 340 90" style={{ width: '100%', marginTop: 8 }}>
        {/* Threshold lines */}
        <line x1="0" y1={barH - (75 / maxScore) * barH + 10} x2="340" y2={barH - (75 / maxScore) * barH + 10}
          stroke={semanticColors.recovery.good} strokeWidth="0.5" strokeDasharray="4,4" opacity="0.5" />
        <line x1="0" y1={barH - (60 / maxScore) * barH + 10} x2="340" y2={barH - (60 / maxScore) * barH + 10}
          stroke={semanticColors.recovery.caution} strokeWidth="0.5" strokeDasharray="4,4" opacity="0.5" />

        {/* Bars */}
        {dailyScores.map((d, i) => {
          const barWidth = 32;
          const gap = (340 - 7 * barWidth) / 8;
          const x = gap + i * (barWidth + gap);
          const h = d.score != null ? (d.score / maxScore) * barH : 5;
          const y = barH - h + 10;
          const color = d.score != null ? getSleepBarColor(d.score) : '#e2e8f0';
          const opacity = d.score != null ? 0.8 : 0.3;

          return (
            <g key={d.day}>
              <rect x={x} y={y} width={barWidth} height={h} rx={4} fill={color} opacity={opacity} />
              {d.score != null && (
                <text x={x + barWidth / 2} y={y + 12} fontSize="8" fill="white" textAnchor="middle"
                  fontWeight="600" fontFamily="Inter, sans-serif">
                  {d.score}
                </text>
              )}
              <text x={x + barWidth / 2} y={80} fontSize="8" fill="#64748b" textAnchor="middle"
                fontFamily="Inter, sans-serif">
                {d.day}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
        {[
          { color: semanticColors.recovery.good, label: '>75' },
          { color: semanticColors.recovery.caution, label: '60-75' },
          { color: semanticColors.recovery.problem, label: '<60' },
        ].map(({ color, label }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, bgcolor: color, borderRadius: '2px' }} />
            <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8' }}>{label}</Typography>
          </Box>
        ))}
      </Box>
    </HeroCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/SleepBars.tsx
git commit -m "feat(ui): add SleepBars component with color-coded daily bars"
```

---

## Task 10: ComplianceRing Component

**Files:**
- Create: `dashboard/components/ComplianceRing.tsx`

- [ ] **Step 1: Create component**

```typescript
// dashboard/components/ComplianceRing.tsx
'use client';

import { Typography, Box } from '@mui/material';
import HeroCard from './HeroCard';
import { cardAccents, typography } from '@/lib/design-tokens';

interface ComplianceRingProps {
  compliancePct: number | null;
  vampireDays: number;
  rugDays: number;
  hydrationDays: number;
}

export default function ComplianceRing({
  compliancePct,
  vampireDays,
  rugDays,
  hydrationDays,
}: ComplianceRingProps) {
  const pct = compliancePct ?? 0;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <HeroCard label="Protocols" accentColor={cardAccents.protocols}>
      <Box sx={{ textAlign: 'center', py: 0.5 }}>
        <svg width="70" height="70" viewBox="0 0 70 70" style={{ margin: '0 auto', display: 'block' }}>
          <circle cx="35" cy="35" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="6" />
          <circle
            cx="35" cy="35" r={radius}
            fill="none"
            stroke={cardAccents.protocols}
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 35 35)"
          />
          <text x="35" y="38" textAnchor="middle" fontSize="16" fontWeight="800" fill="#0f172a">
            {pct}%
          </text>
        </svg>
        <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mt: 0.5 }}>
          {'\u{1F9DB}'} {vampireDays}/7 · {'\u{1F9D8}'} {rugDays}/7 · {'\u{1F4A7}'} {hydrationDays}/7
        </Typography>
      </Box>
    </HeroCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/ComplianceRing.tsx
git commit -m "feat(ui): add ComplianceRing SVG donut with protocol breakdown"
```

---

## Task 11: TodayAction Component

**Files:**
- Create: `dashboard/components/TodayAction.tsx`

- [ ] **Step 1: Create component**

```typescript
// dashboard/components/TodayAction.tsx
'use client';

import { Typography, Box, Button, Chip, Skeleton } from '@mui/material';
import { useRouter } from 'next/navigation';
import { typography } from '@/lib/design-tokens';
import type { PlanItem } from '@/lib/types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface TodayActionProps {
  items: PlanItem[] | null;
}

export default function TodayAction({ items }: TodayActionProps) {
  const router = useRouter();
  const todayName = DAY_NAMES[new Date().getDay()];

  if (items === null) {
    return <Skeleton variant="rounded" height={140} sx={{ borderRadius: '12px', mb: 3 }} />;
  }

  const todayItem = items.find(
    (item) => item.day.toLowerCase() === todayName.toLowerCase(),
  );

  if (!todayItem) {
    return (
      <Box sx={{
        bgcolor: 'background.paper', borderRadius: '12px', p: 2.5,
        border: 1, borderColor: 'divider', mb: 3,
      }}>
        <Typography sx={typography.categoryLabel}>Today — {todayName}</Typography>
        <Typography variant="body1" fontWeight={700} sx={{ mt: 0.5 }}>
          {items.length === 0 ? 'No plan this week' : 'Rest Day'}
        </Typography>
        {items.length === 0 && (
          <Button size="small" onClick={() => router.push('/checkin')} sx={{ mt: 1 }}>
            Run Check-In
          </Button>
        )}
      </Box>
    );
  }

  // Parse exercises from workout plan text (one per line, bullet or numbered)
  const exercises = (todayItem.workoutPlan || '')
    .split('\n')
    .map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter((l) => l.length > 0)
    .slice(0, 6); // Max 6 shown

  // Session type → badge color
  const badgeColors: Record<string, { bg: string; text: string }> = {
    strength: { bg: '#dbeafe', text: '#1d4ed8' },
    upper: { bg: '#dbeafe', text: '#1d4ed8' },
    lower: { bg: '#dbeafe', text: '#1d4ed8' },
    functional: { bg: '#fef3c7', text: '#92400e' },
    ocr: { bg: '#fef3c7', text: '#92400e' },
    cardio: { bg: '#ccfbf1', text: '#0f766e' },
    aerobic: { bg: '#ccfbf1', text: '#0f766e' },
    ruck: { bg: '#dcfce7', text: '#166534' },
    recovery: { bg: '#f0f9ff', text: '#0369a1' },
  };

  const sessionWords = todayItem.sessionType.toLowerCase().split(/[\s+&]/);
  const badges = sessionWords
    .map((w) => badgeColors[w])
    .filter((b): b is { bg: string; text: string } => b != null);
  if (badges.length === 0) badges.push({ bg: '#f1f5f9', text: '#475569' });

  return (
    <Box sx={{
      bgcolor: 'background.paper', borderRadius: '12px', p: 2.5,
      border: 1, borderColor: 'divider', mb: 3,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box>
          <Typography sx={typography.categoryLabel}>Today — {todayName}</Typography>
          <Typography sx={{ ...typography.sectionTitle, mt: 0.25 }}>
            {todayItem.focus || todayItem.sessionType}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {sessionWords.filter((w) => badgeColors[w]).map((w, i) => (
            <Chip
              key={i}
              label={w.charAt(0).toUpperCase() + w.slice(1)}
              size="small"
              sx={{
                bgcolor: badges[i]?.bg || '#f1f5f9',
                color: badges[i]?.text || '#475569',
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            />
          ))}
        </Box>
      </Box>

      {exercises.length > 0 && (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
          gap: 0.5,
          fontSize: '0.8125rem',
          color: 'text.secondary',
        }}>
          {exercises.map((ex, i) => (
            <Typography key={i} variant="body2" color="text.secondary">
              • {ex}
            </Typography>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button variant="contained" onClick={() => router.push('/plan')}>
          View Full Plan
        </Button>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/TodayAction.tsx
git commit -m "feat(ui): add TodayAction hero card with exercise preview"
```

---

## Task 12: Tier 3 Metric Components (HRV, Training Load, ACWR)

**Files:**
- Create: `dashboard/components/MetricCard.tsx`
- Create: `dashboard/components/HrvTrend.tsx`
- Create: `dashboard/components/TrainingLoadFocus.tsx`
- Create: `dashboard/components/AcwrCard.tsx`
- Create: `dashboard/components/HrZoneBar.tsx`

- [ ] **Step 1: Create MetricCard base**

```typescript
// dashboard/components/MetricCard.tsx
'use client';

import { Card, CardContent, Typography } from '@mui/material';
import { metricCardSx, typography } from '@/lib/design-tokens';

interface MetricCardProps {
  label: string;
  children: React.ReactNode;
}

export default function MetricCard({ label, children }: MetricCardProps) {
  return (
    <Card sx={metricCardSx}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography sx={typography.categoryLabel}>{label}</Typography>
        {children}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create HrvTrend**

```typescript
// dashboard/components/HrvTrend.tsx
'use client';

import { Typography, Box } from '@mui/material';
import MetricCard from './MetricCard';
import { semanticColors, typography } from '@/lib/design-tokens';
import type { SparklinePoint } from '@/lib/types';

interface HrvTrendProps {
  avgHrv: number | null;
  hrvBaseline: number | null;
  hrvDelta: number | null;
  dailyHrv28d: SparklinePoint[];
}

export default function HrvTrend({ avgHrv, hrvBaseline, hrvDelta, dailyHrv28d }: HrvTrendProps) {
  const hasData = dailyHrv28d.length >= 2;
  const values = dailyHrv28d.map((d) => d.value);
  const yMin = Math.min(...values, (hrvBaseline ?? 30) - 10) - 2;
  const yMax = Math.max(...values, (hrvBaseline ?? 50) + 10) + 2;

  const w = 300;
  const h = 80;
  const toX = (i: number) => 5 + (i / Math.max(dailyHrv28d.length - 1, 1)) * (w - 10);
  const toY = (v: number) => 5 + ((yMax - v) / (yMax - yMin)) * (h - 20);

  const linePoints = dailyHrv28d.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ');

  // Baseline band (±5ms around baseline)
  const bandTop = hrvBaseline != null ? toY(hrvBaseline + 5) : 0;
  const bandBottom = hrvBaseline != null ? toY(hrvBaseline - 5) : h;

  const deltaColor = hrvDelta != null && hrvDelta >= 0
    ? semanticColors.recovery.good
    : semanticColors.recovery.problem;

  return (
    <MetricCard label="HRV">
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mt: 0.5 }}>
        <Typography sx={{ ...typography.metricValue }}>{avgHrv ?? '—'}</Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>ms</Typography>
        {hrvDelta != null && (
          <Typography sx={{ fontSize: '0.75rem', color: deltaColor, fontWeight: 600, ml: 0.5 }}>
            {hrvDelta >= 0 ? '↑' : '↓'} {Math.abs(hrvDelta)}ms vs baseline
          </Typography>
        )}
      </Box>

      {hasData && (
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', marginTop: 8 }}>
          {/* Baseline band */}
          {hrvBaseline != null && (
            <rect x="0" y={bandTop} width={w} height={bandBottom - bandTop}
              fill={semanticColors.body} opacity="0.08" />
          )}

          {/* Daily line */}
          <polyline points={linePoints} fill="none" stroke={semanticColors.body}
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Current dot */}
          {dailyHrv28d.length > 0 && (
            <circle
              cx={toX(dailyHrv28d.length - 1)}
              cy={toY(dailyHrv28d[dailyHrv28d.length - 1].value)}
              r="3.5" fill={semanticColors.body} stroke="white" strokeWidth="1.5"
            />
          )}
        </svg>
      )}
    </MetricCard>
  );
}
```

- [ ] **Step 3: Create HrZoneBar**

```typescript
// dashboard/components/HrZoneBar.tsx
'use client';

import { Typography, Box } from '@mui/material';
import type { HrZoneSummary } from '@/lib/types';

const ZONE_COLORS = ['#93c5fd', '#93c5fd', '#22c55e', '#f59e0b', '#ef4444'];
const ZONE_LABELS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];

interface HrZoneBarProps {
  zones: HrZoneSummary;
}

export default function HrZoneBar({ zones }: HrZoneBarProps) {
  const values = [zones.z1Minutes, zones.z2Minutes, zones.z3Minutes, zones.z4Minutes, zones.z5Minutes];
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <Box sx={{ mt: 1.5 }}>
      <Box sx={{ display: 'flex', height: 20, borderRadius: 1, overflow: 'hidden' }}>
        {values.map((v, i) => {
          const pct = (v / total) * 100;
          if (pct < 1) return null;
          return (
            <Box key={i} sx={{ width: `${pct}%`, bgcolor: ZONE_COLORS[i] }} />
          );
        })}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        {values.map((v, i) => (
          <Typography key={i} sx={{ fontSize: '0.625rem', color: '#94a3b8' }}>
            {ZONE_LABELS[i]}: {v}m
          </Typography>
        ))}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 4: Create TrainingLoadFocus**

```typescript
// dashboard/components/TrainingLoadFocus.tsx
'use client';

import { Typography, Box, Chip } from '@mui/material';
import MetricCard from './MetricCard';
import HrZoneBar from './HrZoneBar';
import { semanticColors } from '@/lib/design-tokens';
import type { LoadFocusData, HrZoneSummary } from '@/lib/types';

interface TrainingLoadFocusProps {
  loadFocus: LoadFocusData | null;
  hrZones: HrZoneSummary | null;
  enduranceScore: number | null;
}

function LoadBar({ label, value, min, max }: { label: string; value: number; min: number; max: number }) {
  const inRange = value >= min && value <= max;
  const isShort = value < min;
  const color = inRange ? semanticColors.recovery.good : isShort ? semanticColors.recovery.caution : semanticColors.recovery.problem;
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
        <Typography sx={{ fontSize: '0.6875rem', color: '#64748b' }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.6875rem', color, fontWeight: 600 }}>
          {Math.round(value)} {isShort ? '(shortage)' : ''}
        </Typography>
      </Box>
      <Box sx={{ height: 6, bgcolor: '#e2e8f0', borderRadius: 1 }}>
        <Box sx={{ height: 6, bgcolor: color, borderRadius: 1, width: `${pct}%` }} />
      </Box>
    </Box>
  );
}

export default function TrainingLoadFocus({ loadFocus, hrZones, enduranceScore }: TrainingLoadFocusProps) {
  return (
    <MetricCard label="Training Load Focus">
      {loadFocus ? (
        <Box sx={{ mt: 1 }}>
          <LoadBar label="Low Aerobic" value={loadFocus.lowAerobic}
            min={loadFocus.lowAerobicTargetMin} max={loadFocus.lowAerobicTargetMax} />
          <LoadBar label="High Aerobic" value={loadFocus.highAerobic}
            min={loadFocus.highAerobicTargetMin} max={loadFocus.highAerobicTargetMax} />
          <LoadBar label="Anaerobic" value={loadFocus.anaerobic}
            min={loadFocus.anaerobicTargetMin} max={loadFocus.anaerobicTargetMax} />
        </Box>
      ) : (
        <Typography variant="body2" color="text.disabled" sx={{ mt: 1, fontStyle: 'italic' }}>
          No load data available
        </Typography>
      )}

      {hrZones && <HrZoneBar zones={hrZones} />}

      {enduranceScore != null && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
          <Typography sx={{ fontSize: '0.6875rem', color: '#64748b' }}>Endurance Score</Typography>
          <Chip label={enduranceScore} size="small" sx={{ fontWeight: 700 }} />
        </Box>
      )}
    </MetricCard>
  );
}
```

- [ ] **Step 5: Create AcwrCard**

```typescript
// dashboard/components/AcwrCard.tsx
'use client';

import { Typography, Box, Chip } from '@mui/material';
import MetricCard from './MetricCard';
import { semanticColors, typography } from '@/lib/design-tokens';

interface AcwrCardProps {
  acwr: number | null;
  acwrStatus: string | null;
  bodyBatteryHigh: number | null;
}

export default function AcwrCard({ acwr, acwrStatus, bodyBatteryHigh }: AcwrCardProps) {
  const acwrColor = acwr == null ? '#94a3b8'
    : acwr >= 0.8 && acwr <= 1.3 ? semanticColors.recovery.good
    : acwr <= 1.5 ? semanticColors.recovery.caution
    : semanticColors.recovery.problem;

  const acwrLabel = acwr == null ? 'No data'
    : acwr >= 0.8 && acwr <= 1.3 ? 'OPTIMAL'
    : acwr <= 1.5 ? 'CAUTION'
    : 'HIGH';

  const bbColor = bodyBatteryHigh == null ? '#94a3b8'
    : bodyBatteryHigh >= 70 ? semanticColors.recovery.good
    : bodyBatteryHigh >= 50 ? semanticColors.recovery.caution
    : semanticColors.recovery.problem;

  return (
    <MetricCard label="Training Load">
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
        <Typography sx={typography.metricValue}>{acwr ?? '—'}</Typography>
        <Chip
          label={acwrLabel}
          size="small"
          sx={{ bgcolor: `${acwrColor}20`, color: acwrColor, fontWeight: 700, fontSize: '0.6875rem' }}
        />
      </Box>
      <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
        ACWR sweet spot (0.8–1.3)
      </Typography>

      {bodyBatteryHigh != null && (
        <Box sx={{ mt: 1.5 }}>
          <Typography sx={{ fontSize: '0.6875rem', color: '#64748b' }}>Body Battery High</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700 }}>{bodyBatteryHigh}</Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: bbColor, fontWeight: 600 }}>
              {bodyBatteryHigh >= 70 ? 'Green zone' : bodyBatteryHigh >= 50 ? 'Yellow zone' : 'Red zone'}
            </Typography>
          </Box>
        </Box>
      )}
    </MetricCard>
  );
}
```

- [ ] **Step 6: Commit all Tier 3 components**

```bash
git add dashboard/components/MetricCard.tsx dashboard/components/HrvTrend.tsx \
  dashboard/components/HrZoneBar.tsx dashboard/components/TrainingLoadFocus.tsx \
  dashboard/components/AcwrCard.tsx
git commit -m "feat(ui): add Tier 3 metric components (HRV, Training Load Focus, ACWR)"
```

---

## Task 13: Rewrite Dashboard Page

**Files:**
- Modify: `dashboard/app/page.tsx` (complete rewrite)

- [ ] **Step 1: Read the current file**

Read `dashboard/app/page.tsx` to understand current imports and state management.

- [ ] **Step 2: Rewrite with 3-tier layout**

Replace the entire contents of `dashboard/app/page.tsx` with the new 3-tier layout using all the new components. The page should:

1. Fetch from `/api/dashboard` (single call) + `/api/plan` (for today's session) + `/api/periodization` (for phase timeline)
2. Render Tier 1: RecoveryScore, WeightJourney, SleepBars, ComplianceRing in a 4-column grid
3. Render Tier 2: TodayAction hero card
4. Render Tier 3: HrvTrend, TrainingLoadFocus, AcwrCard in a 3-column grid
5. Render Program Timeline (reuse existing PhaseTimeline + PhaseDetailStrip)
6. Keep existing Garmin sync button and Sunday check-in reminder
7. Remove old SparklineCard usage, RecoverySummary, PrioritiesList, and DashboardSection from this page

Key layout structure:

```tsx
// Tier 1 — The Glance
<Typography sx={typography.categoryLabel}>...</Typography>
<Grid container spacing={3}>
  <Grid size={{ xs: 12, sm: 6, md: 3 }}><RecoveryScore ... /></Grid>
  <Grid size={{ xs: 12, sm: 6, md: 3 }}><WeightJourney ... /></Grid>
  <Grid size={{ xs: 12, sm: 6, md: 3 }}><SleepBars ... /></Grid>
  <Grid size={{ xs: 12, sm: 6, md: 3 }}><ComplianceRing ... /></Grid>
</Grid>

// Tier 2 — Today's Action
<TodayAction items={planItems} />

// Tier 3 — Body & Performance
<Typography sx={typography.categoryLabel}>...</Typography>
<Grid container spacing={3}>
  <Grid size={{ xs: 12, md: 4 }}><HrvTrend ... /></Grid>
  <Grid size={{ xs: 12, md: 4 }}><TrainingLoadFocus ... /></Grid>
  <Grid size={{ xs: 12, md: 4 }}><AcwrCard ... /></Grid>
</Grid>

// Program Timeline
<PhaseTimeline ... />
<PhaseDetailStrip ... />
```

- [ ] **Step 3: Verify the page compiles and renders**

Run: `cd dashboard && npx next build`
Expected: Build succeeds (may have type warnings, no errors)

- [ ] **Step 4: Manual smoke test**

Run: `cd dashboard && npm run dev`
Open `http://localhost:3000` and verify:
- 4 hero cards in top row
- Today's session card below
- 3 metric cards in bottom row
- Phase timeline at bottom
- Garmin sync button works
- Responsive: cards stack on mobile

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/page.tsx
git commit -m "feat(dashboard): rewrite home page with 3-tier information hierarchy"
```

---

## Task 14: Clean Up Old Components

**Files:**
- Modify: `dashboard/app/page.tsx` (remove old imports if still referenced)

Old components that are NO LONGER used on the dashboard page but may still be used on other pages:
- `SparklineCard.tsx` — still used? Check Trends page. If only used on dashboard, can be removed.
- `RecoverySummary.tsx` — check if used elsewhere
- `DashboardSection.tsx` — check if used elsewhere

- [ ] **Step 1: Search for usages of old components**

Run: `cd dashboard && grep -rn "SparklineCard\|RecoverySummary\|DashboardSection\|PrioritiesList" --include="*.tsx" app/ components/ | grep -v node_modules`

- [ ] **Step 2: Remove unused imports from page.tsx only**

Do NOT delete component files if they're used on other pages. Only clean up imports in `page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/page.tsx
git commit -m "refactor(dashboard): remove unused component imports from home page"
```

---

## Task 15: Final Integration Test

- [ ] **Step 1: Run all tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `cd dashboard && npx next build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Manual verification checklist**

Open `http://localhost:3000` and verify:
- [ ] Recovery score shows with correct color (green/amber/red)
- [ ] Weight card shows full journey sparkline with phase target line
- [ ] Sleep card shows 7 colored bars with rolling average
- [ ] Compliance ring shows percentage with protocol breakdown
- [ ] Today's session shows exercises and session type badges
- [ ] HRV card shows trend with baseline band
- [ ] Training Load Focus shows 3 load bars with shortage flags
- [ ] ACWR card shows value with badge and body battery
- [ ] Phase timeline renders at bottom
- [ ] Dark mode toggle works for all new components
- [ ] Mobile responsive: cards stack properly
- [ ] Garmin sync button still works

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(dashboard): integration fixes from smoke test"
```
