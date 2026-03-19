# Dashboard UI Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the OCR Training Coach dashboard from a sparse 4-card layout into an information-dense, readable command center with sparklines, accordion sections, and improved UX across all 8 pages.

**Architecture:** Component-first approach — build new reusable components (SparklineCard, TodaySession, DashboardAccordion), then compose them into the dashboard page. Extend the Garmin API to return richer data for sparklines and new metrics. Touch all 8 pages for consistency and information architecture improvements. No new dependencies needed — MUI Accordion, SparkLineChart already available via `@mui/x-charts`.

**Tech Stack:** Next.js 16, React 19, MUI 7.3, MUI X-Charts 8.27, better-sqlite3, TypeScript

---

## File Structure

### New Files
- `dashboard/components/SparklineCard.tsx` — Reusable metric card with sparkline, delta, status badge, and contextual subtitle
- `dashboard/components/TodaySession.tsx` — Prominent card showing today's workout from the current plan
- `dashboard/components/DashboardSection.tsx` — Accordion wrapper with summary line (collapsed) and full detail (expanded)
- `dashboard/components/ComplianceSummary.tsx` — Compliance & habits mini-view for dashboard accordion
- `dashboard/components/RecoverySummary.tsx` — Body & recovery mini-view for dashboard accordion
- `dashboard/components/PrioritiesList.tsx` — Coaching priorities with status indicators

### Modified Files
- `dashboard/app/api/garmin/route.ts` — Return extended summary with daily arrays for sparklines + new metrics (HRV, body battery, stress, ACWR, training effects)
- `dashboard/lib/garmin.ts` — Add `extractExtendedSummary()` with daily breakdowns for sparklines
- `dashboard/lib/types.ts` — Add `ExtendedGarminSummary` type, `DashboardData` type
- `dashboard/app/page.tsx` — Complete rewrite of dashboard layout with new components
- `dashboard/app/plan/page.tsx` — UI polish: better header, progress visualization
- `dashboard/app/trends/page.tsx` — Card layout improvements, section headers, better empty states
- `dashboard/components/TrendCharts.tsx` — Consistent card styling, responsive improvements
- `dashboard/app/races/page.tsx` — Card-based race display instead of raw table, better visual hierarchy
- `dashboard/app/dexa/page.tsx` — Card-based scan display, visual body comp comparison
- `dashboard/app/archive/page.tsx` — Richer archive entries with metric summaries
- `dashboard/app/checkin/page.tsx` — Section visual grouping improvements
- `dashboard/components/CheckInForm.tsx` — Card grouping, visual section breaks, progress context
- `dashboard/app/profile/page.tsx` — Structured profile cards instead of raw markdown dump
- `dashboard/app/checkin/results/page.tsx` — Minor polish for consistency
- `dashboard/components/Sidebar.tsx` — Visual refinements, active state improvements
- `dashboard/components/PhaseTimeline.tsx` — Minor polish
- `dashboard/components/PhaseDetailStrip.tsx` — Enhanced with more metrics

### Unchanged Files
- `dashboard/lib/db.ts` — No schema changes needed
- `dashboard/lib/week.ts` — No changes
- `dashboard/lib/parse-schedule.ts` — No changes
- `dashboard/lib/parse-hevy.ts` — No changes
- `dashboard/lib/theme.ts` — No changes (current M3 theme is solid)
- `dashboard/components/WorkoutDisplay.tsx` — No changes (already well-built)
- `dashboard/components/MarkdownRenderer.tsx` — No changes
- `dashboard/components/AgentBriefing.tsx` — No changes
- `dashboard/components/RaceCountdown.tsx` — No changes (races API unchanged)
- `dashboard/components/AppShell.tsx` — No changes
- `dashboard/components/ThemeRegistry.tsx` — No changes
- `dashboard/app/plan/[weekNumber]/page.tsx` — No changes (read-only archive view, uses TrainingPlanTable with readOnly=true)
- `dashboard/components/StatusBadge.tsx` — No changes (reused by SparklineCard)
- All API routes except `/api/garmin/route.ts` — No changes needed

---

## Task 1: Extend Garmin API for Sparkline Data

**Files:**
- Modify: `dashboard/lib/types.ts`
- Modify: `dashboard/lib/garmin.ts`
- Modify: `dashboard/app/api/garmin/route.ts`

The current `/api/garmin` returns a flat summary (avgSleep, avgReadiness, weight, activityCount). We need daily arrays for sparklines and additional metrics (HRV, body battery, stress, ACWR, training effects).

- [ ] **Step 1: Add ExtendedGarminSummary type**

In `dashboard/lib/types.ts`, add after the existing `GarminFreshness` interface:

```typescript
export interface SparklinePoint {
  date: string;
  value: number;
}

export interface ExtendedGarminSummary {
  // Current values (existing — superset of extractGarminSummary)
  weight: number | null;
  avgSleep: number | null;
  avgReadiness: number | null;
  avgRhr: number | null;
  bodyFat: number | null;
  muscleMass: number | null;
  activityCount: number;
  activities: GarminActivity[];  // Preserve existing field from extractGarminSummary

  // New metrics
  avgHrv: number | null;
  bodyBatteryHigh: number | null;
  avgStress: number | null;
  acwr: number | null;
  acwrStatus: string | null;
  avgAerobicTE: number | null;
  avgAnaerobicTE: number | null;

  // Daily sparkline data (7 days)
  dailyWeight: SparklinePoint[];
  dailySleep: SparklinePoint[];
  dailyReadiness: SparklinePoint[];
  dailyRhr: SparklinePoint[];
  dailyHrv: SparklinePoint[];
  dailyBodyBattery: SparklinePoint[];
  dailyStress: SparklinePoint[];

  // Deltas (vs previous period when available)
  weightDelta: number | null;     // vs 4 weeks ago
  sleepDelta: number | null;      // vs last week avg
  readinessDelta: number | null;  // vs last week avg
}
```

- [ ] **Step 2: Add extractExtendedSummary function**

In `dashboard/lib/garmin.ts`, add a new function that extracts daily arrays and computed metrics:

```typescript
export function extractExtendedSummary(data: GarminData): ExtendedGarminSummary {
  const health = data.health_stats_7d;
  const perf = data.performance_stats;

  // Existing summary values
  const basic = extractGarminSummary(data);

  // Daily sparkline arrays
  const sleepDays = health?.sleep?.daily || [];
  const dailySleep = sleepDays
    .filter(d => d.score != null)
    .map(d => ({ date: d.date, value: d.score }));

  const readinessDays = perf?.training_readiness?.daily || [];
  const dailyReadiness = readinessDays
    .filter(d => d.score != null)
    .map(d => ({ date: d.date, value: d.score }));

  const healthDays = health?.daily || [];
  const dailyRhr = healthDays
    .filter(d => d.resting_heart_rate != null)
    .map(d => ({ date: d.date, value: d.resting_heart_rate! }));

  const dailyBodyBattery = healthDays
    .filter(d => d.body_battery_high != null)
    .map(d => ({ date: d.date, value: d.body_battery_high! }));

  const dailyStress = healthDays
    .filter(d => d.avg_stress_level != null)
    .map(d => ({ date: d.date, value: d.avg_stress_level! }));

  // Body comp daily
  const bodyCompDays = health?.body_composition?.daily || [];
  const dailyWeight = bodyCompDays
    .filter(d => d.weight_kg != null)
    .map(d => ({ date: d.date || '', value: d.weight_kg! }));

  // HRV from 4-week data
  const hrv4w = perf?.hrv_4w as Record<string, unknown> | undefined;
  const hrvDaily = (hrv4w?.daily as Array<{ date: string; value: number }>) || [];
  const dailyHrv = hrvDaily
    .slice(-7)
    .filter(d => d.value != null)
    .map(d => ({ date: d.date, value: d.value }));
  const avgHrv = dailyHrv.length
    ? Math.round(dailyHrv.reduce((s, d) => s + d.value, 0) / dailyHrv.length)
    : null;

  // Body battery high avg
  const bbDays = healthDays.filter(d => d.body_battery_high != null);
  const bodyBatteryHigh = bbDays.length
    ? Math.round(bbDays.reduce((s, d) => s + d.body_battery_high!, 0) / bbDays.length)
    : null;

  // Stress avg
  const stressDays = healthDays.filter(d => d.avg_stress_level != null);
  const avgStress = stressDays.length
    ? Math.round(stressDays.reduce((s, d) => s + d.avg_stress_level!, 0) / stressDays.length)
    : null;

  // ACWR from training status
  const trainingStatus = perf?.training_status;
  const acwr = trainingStatus?.acute_training_load?.acwr_percent
    ? Math.round(trainingStatus.acute_training_load.acwr_percent * 100) / 100
    : null;
  const acwrStatus = trainingStatus?.acute_training_load?.acwr_status || null;

  // Training effects
  const te = perf?.training_effects_7d;
  const avgAerobicTE = te?.aerobic?.avg ?? null;
  const avgAnaerobicTE = te?.anaerobic?.avg ?? null;

  // Weight delta (current vs first reading in the week)
  const weightDelta = dailyWeight.length >= 2
    ? Math.round((dailyWeight[dailyWeight.length - 1].value - dailyWeight[0].value) * 10) / 10
    : null;

  return {
    ...basic,
    avgHrv,
    bodyBatteryHigh,
    avgStress,
    acwr,
    acwrStatus,
    avgAerobicTE,
    avgAnaerobicTE,
    dailyWeight,
    dailySleep,
    dailyReadiness,
    dailyRhr,
    dailyHrv,
    dailyBodyBattery,
    dailyStress,
    weightDelta,
    sleepDelta: null, // Requires 4-week context — can be computed later
    readinessDelta: null,
  };
}
```

- [ ] **Step 3: Update the API route to return extended summary**

In `dashboard/app/api/garmin/route.ts`:

```typescript
import { readGarminData, extractExtendedSummary } from '@/lib/garmin';

export async function GET() {
  const freshness = readGarminData();
  const summary = freshness.data ? extractExtendedSummary(freshness.data) : null;

  return NextResponse.json({
    timestamp: freshness.timestamp,
    ageHours: Math.round(freshness.ageHours * 10) / 10,
    status: freshness.status,
    summary,
  });
}
```

- [ ] **Step 4: Verify the dev server starts and the API returns extended data**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npm run dev`
Then: `curl -s http://localhost:3000/api/garmin | head -100`
Expected: JSON with `dailySleep`, `dailyReadiness`, `avgHrv`, etc. fields present.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/types.ts dashboard/lib/garmin.ts dashboard/app/api/garmin/route.ts
git commit -m "feat: extend Garmin API with sparkline data and new metrics (HRV, ACWR, body battery)"
```

---

## Task 2: SparklineCard Component

**Files:**
- Create: `dashboard/components/SparklineCard.tsx`

A reusable metric card that shows: value, delta arrow, sparkline (last 7 days), status badge, and contextual label. Used across the dashboard for weight, sleep, readiness, HRV, body battery, etc.

- [ ] **Step 1: Create SparklineCard component**

```tsx
'use client';

import { Card, CardContent, Typography, Box, Chip } from '@mui/material';
import { SparkLineChart } from '@mui/x-charts/SparkLineChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import StatusBadge from './StatusBadge';

interface SparklineCardProps {
  label: string;
  value: number | string | null;
  unit?: string;
  sparklineData?: number[];
  delta?: number | null;
  deltaLabel?: string;          // e.g. "vs last week"
  invertDelta?: boolean;        // true = negative delta is good (e.g. weight loss)
  target?: string;              // e.g. "Target: 89kg"
  // StatusBadge thresholds (optional — omit for no badge)
  greenThreshold?: number;
  yellowThreshold?: number;
  invertBadge?: boolean;        // true = lower is better
  // Sizing
  minHeight?: number;
}

function DeltaIndicator({ delta, invert = false, label }: { delta: number; invert?: boolean; label?: string }) {
  const isGood = invert ? delta < 0 : delta > 0;
  const isNeutral = delta === 0;
  const color = isNeutral ? 'text.secondary' : isGood ? 'success.main' : 'error.main';
  const Icon = delta > 0 ? TrendingUpIcon : delta < 0 ? TrendingDownIcon : TrendingFlatIcon;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Icon sx={{ fontSize: 16, color }} />
      <Typography variant="caption" sx={{ color, fontWeight: 600 }}>
        {delta > 0 ? '+' : ''}{delta}
      </Typography>
      {label && (
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      )}
    </Box>
  );
}

export default function SparklineCard({
  label,
  value,
  unit = '',
  sparklineData,
  delta,
  deltaLabel,
  invertDelta = false,
  target,
  greenThreshold,
  yellowThreshold,
  invertBadge,
  minHeight = 120,
}: SparklineCardProps) {
  const displayValue = value != null ? `${value}${unit}` : '—';
  const hasSparkline = sparklineData && sparklineData.length >= 2;
  const numValue = typeof value === 'number' ? value : null;

  return (
    <Card sx={{ minHeight, display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', pb: '12px !important', pt: 1.5, px: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, letterSpacing: 0.3 }}>
          {label}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
          <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.1 }}>
            {displayValue}
          </Typography>
          {greenThreshold != null && yellowThreshold != null && numValue != null && (
            <StatusBadge
              value={numValue}
              greenThreshold={greenThreshold}
              yellowThreshold={yellowThreshold}
              invert={invertBadge}
              size="small"
            />
          )}
        </Box>

        {delta != null && (
          <DeltaIndicator delta={delta} invert={invertDelta} label={deltaLabel} />
        )}

        {hasSparkline && (
          <Box sx={{ mt: 'auto', pt: 1, mx: -1 }}>
            <SparkLineChart
              data={sparklineData}
              height={40}
              curve="natural"
              area
              colors={['#1565C0']}
            />
          </Box>
        )}

        {target && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: hasSparkline ? 0 : 'auto' }}>
            {target}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify SparkLineChart import works**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npx tsc --noEmit --pretty 2>&1 | grep -i sparkline`
Expected: No import errors. MUI X-Charts 8.27 includes SparkLineChart.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/SparklineCard.tsx
git commit -m "feat: add SparklineCard component with delta indicators and status badges"
```

---

## Task 3: TodaySession Component

**Files:**
- Create: `dashboard/components/TodaySession.tsx`

Full-width card at the top of the dashboard showing today's programmed workout. If today is a rest/family day, shows that. If no plan exists, shows CTA to run check-in.

- [ ] **Step 1: Create TodaySession component**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Box, Chip, Button, Skeleton } from '@mui/material';
import { alpha } from '@mui/material/styles';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import { useRouter } from 'next/navigation';
import type { PlanItem, SubTask } from '@/lib/types';
import WorkoutDisplay from './WorkoutDisplay';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface TodaySessionProps {
  items: PlanItem[] | null;  // null = loading, [] = no plan
  onToggleSubTask?: (id: number, subTasks: SubTask[]) => void;
}

export default function TodaySession({ items, onToggleSubTask }: TodaySessionProps) {
  const router = useRouter();
  const todayName = DAY_NAMES[new Date().getDay()];

  if (items === null) {
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Skeleton variant="text" width={200} height={32} />
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="rectangular" height={60} sx={{ mt: 1, borderRadius: 1 }} />
        </CardContent>
      </Card>
    );
  }

  const todayItem = items.find(
    (item) => item.day.toLowerCase() === todayName.toLowerCase()
  );

  if (!todayItem && items.length === 0) {
    return (
      <Card sx={{ mb: 3, borderStyle: 'dashed' }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={600}>No plan for this week</Typography>
            <Typography variant="body2" color="text.secondary">
              Run a check-in to generate your training plan.
            </Typography>
          </Box>
          <Button variant="contained" onClick={() => router.push('/checkin')}>
            Run Check-In
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!todayItem) {
    return null; // Today not in plan (shouldn't happen with 7-day plans)
  }

  const isRest = todayItem.sessionType.toLowerCase().includes('rest');
  const isFamily = todayItem.sessionType.toLowerCase().includes('family');
  const isRecovery = todayItem.sessionType.toLowerCase().includes('recovery');
  const allDone = todayItem.subTasks.length > 0 && todayItem.subTasks.every(st => st.completed);

  const Icon = isFamily ? FamilyRestroomIcon
    : isRest ? SelfImprovementIcon
    : allDone ? CheckCircleIcon
    : FitnessCenterIcon;

  const iconColor = allDone ? 'success.main'
    : isFamily ? 'success.main'
    : isRest ? 'info.main'
    : 'primary.main';

  return (
    <Card
      sx={{
        mb: 3,
        borderLeft: 4,
        borderColor: iconColor,
        ...(allDone && {
          bgcolor: (theme) => alpha(theme.palette.success.main, 0.06),
        }),
      }}
    >
      <CardContent sx={{ pb: '16px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Icon sx={{ fontSize: 32, color: iconColor, mt: 0.5 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h6" fontWeight={700}>
                {todayName}
              </Typography>
              <Chip label={todayItem.sessionType} size="small" color="primary" />
              {allDone && <Chip label="Complete" size="small" color="success" variant="outlined" />}
            </Box>

            {todayItem.focus && (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 0.5 }}>
                {todayItem.focus}
              </Typography>
            )}

            {/* Show workout preview for workout days */}
            {!isRest && !isFamily && todayItem.workoutPlan && (
              <Box sx={{ mt: 1.5, maxHeight: 200, overflow: 'hidden', position: 'relative' }}>
                <WorkoutDisplay content={todayItem.workoutPlan} dimmed={allDone} />
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 40,
                    background: (theme) =>
                      `linear-gradient(transparent, ${theme.palette.background.paper})`,
                  }}
                />
              </Box>
            )}

            {/* Sub-task chips */}
            {todayItem.subTasks.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, mt: 1.5, flexWrap: 'wrap' }}>
                {todayItem.subTasks.map((st) => (
                  <Chip
                    key={st.key}
                    label={st.label}
                    size="small"
                    color={st.completed ? 'success' : 'default'}
                    variant={st.completed ? 'filled' : 'outlined'}
                    onClick={
                      onToggleSubTask && todayItem.id != null
                        ? () => {
                            const updated = todayItem.subTasks.map(s =>
                              s.key === st.key ? { ...s, completed: !s.completed } : s
                            );
                            onToggleSubTask(todayItem.id!, updated);
                          }
                        : undefined
                    }
                    sx={{ cursor: onToggleSubTask ? 'pointer' : 'default', fontWeight: 600, fontSize: '0.7rem' }}
                  />
                ))}
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => router.push('/plan')}
              >
                View Full Plan
              </Button>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/TodaySession.tsx
git commit -m "feat: add TodaySession card component for dashboard"
```

---

## Task 4: DashboardSection (Accordion Wrapper) + Summary Components

**Files:**
- Create: `dashboard/components/DashboardSection.tsx`
- Create: `dashboard/components/ComplianceSummary.tsx`
- Create: `dashboard/components/RecoverySummary.tsx`
- Create: `dashboard/components/PrioritiesList.tsx`

- [ ] **Step 1: Create DashboardSection accordion wrapper**

```tsx
'use client';

import { Accordion, AccordionSummary, AccordionDetails, Typography, Box } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface DashboardSectionProps {
  title: string;
  summary: React.ReactNode;    // Shown in collapsed header
  children: React.ReactNode;   // Shown when expanded
  defaultExpanded?: boolean;
  icon?: React.ReactNode;
}

export default function DashboardSection({
  title,
  summary,
  children,
  defaultExpanded = true,
  icon,
}: DashboardSectionProps) {
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      sx={{
        '&:before': { display: 'none' },
        border: 1,
        borderColor: 'divider',
        borderRadius: '12px !important',
        overflow: 'hidden',
        mb: 2,
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          px: 2,
          '& .MuiAccordionSummary-content': {
            alignItems: 'center',
            gap: 2,
            my: 1,
          },
        }}
      >
        {icon && <Box sx={{ display: 'flex', color: 'text.secondary' }}>{icon}</Box>}
        <Typography variant="subtitle1" fontWeight={600} sx={{ minWidth: 'fit-content' }}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto', flexWrap: 'wrap' }}>
          {summary}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
        {children}
      </AccordionDetails>
    </Accordion>
  );
}
```

- [ ] **Step 2: Create ComplianceSummary component**

```tsx
'use client';

import { Box, Typography, LinearProgress, Chip } from '@mui/material';

interface ComplianceSummaryProps {
  vampirePct: number | null;     // Bedtime compliance percentage
  rugDays: number | null;        // Rug protocol days (out of 7)
  hydrationTracked: boolean;
  bedtimeCompliance: number | null; // Days before 23:00 (out of 7)
}

function ComplianceBar({ label, value, max, unit = '%' }: { label: string; value: number; max: number; unit?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct >= 70 ? 'success' : pct >= 40 ? 'warning' : 'error';

  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" fontWeight={500}>{label}</Typography>
        <Typography variant="body2" fontWeight={600} color={`${color}.main`}>
          {unit === '%' ? `${Math.round(value)}%` : `${value}/${max}`}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        color={color}
        sx={{ height: 6, borderRadius: 3 }}
      />
    </Box>
  );
}

export default function ComplianceSummary({
  vampirePct,
  rugDays,
  hydrationTracked,
  bedtimeCompliance,
}: ComplianceSummaryProps) {
  return (
    <Box>
      {vampirePct != null && (
        <ComplianceBar label="Vampire Protocol" value={vampirePct} max={100} />
      )}
      {bedtimeCompliance != null && (
        <ComplianceBar label="Bedtime < 23:00" value={bedtimeCompliance} max={7} unit="days" />
      )}
      {rugDays != null && (
        <ComplianceBar label="Rug Protocol" value={rugDays} max={7} unit="days" />
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
        <Typography variant="body2" fontWeight={500}>Hydration Tracking</Typography>
        <Chip
          label={hydrationTracked ? 'Yes' : 'No'}
          size="small"
          color={hydrationTracked ? 'success' : 'error'}
          variant="outlined"
        />
      </Box>
    </Box>
  );
}
```

- [ ] **Step 3: Create RecoverySummary component**

```tsx
'use client';

import { Box, Typography, Chip, Grid } from '@mui/material';

interface RecoverySummaryProps {
  avgHrv: number | null;
  bodyBatteryHigh: number | null;
  avgStress: number | null;
  acwr: number | null;
  acwrStatus: string | null;
  avgAerobicTE: number | null;
  avgAnaerobicTE: number | null;
  avgRhr: number | null;
}

function MetricRow({ label, value, unit, chipColor }: {
  label: string;
  value: string;
  unit?: string;
  chipColor?: 'success' | 'warning' | 'error' | 'default';
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      {chipColor ? (
        <Chip label={`${value}${unit || ''}`} size="small" color={chipColor} variant="outlined" sx={{ fontWeight: 600 }} />
      ) : (
        <Typography variant="body2" fontWeight={600}>{value}{unit || ''}</Typography>
      )}
    </Box>
  );
}

export default function RecoverySummary({
  avgHrv, bodyBatteryHigh, avgStress, acwr, acwrStatus,
  avgAerobicTE, avgAnaerobicTE, avgRhr,
}: RecoverySummaryProps) {
  const acwrColor = acwr == null ? 'default'
    : acwr >= 0.8 && acwr <= 1.3 ? 'success'
    : acwr <= 1.5 ? 'warning'
    : 'error';

  const bbColor = bodyBatteryHigh == null ? 'default'
    : bodyBatteryHigh >= 70 ? 'success'
    : bodyBatteryHigh >= 50 ? 'warning'
    : 'error';

  const anaerobicColor = avgAnaerobicTE == null ? 'default'
    : avgAnaerobicTE >= 1.0 ? 'success'
    : avgAnaerobicTE >= 0.5 ? 'warning'
    : 'error';

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 6 }}>
        {avgHrv != null && <MetricRow label="Avg HRV" value={String(avgHrv)} unit=" ms" />}
        {avgRhr != null && <MetricRow label="Avg RHR" value={String(avgRhr)} unit=" bpm" />}
        {bodyBatteryHigh != null && <MetricRow label="Body Battery High" value={String(bodyBatteryHigh)} chipColor={bbColor} />}
        {avgStress != null && <MetricRow label="Avg Stress" value={String(avgStress)} />}
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        {acwr != null && <MetricRow label="ACWR" value={String(acwr)} chipColor={acwrColor} />}
        {avgAerobicTE != null && <MetricRow label="Avg Aerobic TE" value={String(avgAerobicTE)} />}
        {avgAnaerobicTE != null && <MetricRow label="Avg Anaerobic TE" value={String(avgAnaerobicTE)} chipColor={anaerobicColor} />}
      </Grid>
    </Grid>
  );
}
```

- [ ] **Step 4: Create PrioritiesList component**

```tsx
'use client';

import { Box, Typography, Chip } from '@mui/material';

interface Priority {
  label: string;
  status: 'critical' | 'active' | 'monitoring';
  detail?: string;
}

// NOTE: These priorities are from CLAUDE.md section 11 and may change over time.
// When priorities update in CLAUDE.md, update this list manually.
const PRIORITIES: Priority[] = [
  { label: 'Sleep / Vampire Protocol', status: 'critical', detail: 'Bedtime compliance is #1 limiter' },
  { label: 'Pull-up Progression', status: 'active', detail: '2 → 5-6 by Zandvoort, 10 by race day' },
  { label: 'Core Stability 3x/week', status: 'active', detail: 'Protects lower back from kid-lifting' },
  { label: 'Aerobic High (Zone 4)', status: 'active', detail: 'StairMaster 3-4 min intervals' },
  { label: 'Anaerobic Deficit', status: 'active', detail: 'Rower 20s/>300W/1:40 rest' },
  { label: 'Hydration Tracking', status: 'critical', detail: 'Zero compliance — every week until started' },
  { label: 'Zandvoort Prep', status: 'monitoring', detail: '~8 weeks out — walk-to-jog progression' },
  { label: 'Baker\'s Cyst', status: 'monitoring', detail: 'Pain-free — physio before Phase 2' },
];

const STATUS_COLORS: Record<string, 'error' | 'warning' | 'info'> = {
  critical: 'error',
  active: 'warning',
  monitoring: 'info',
};

export default function PrioritiesList() {
  return (
    <Box>
      {PRIORITIES.map((p, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75, borderBottom: i < PRIORITIES.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 20, fontWeight: 600 }}>
            {i + 1}.
          </Typography>
          <Chip label={p.status} size="small" color={STATUS_COLORS[p.status]} variant="outlined" sx={{ minWidth: 80 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={600}>{p.label}</Typography>
            {p.detail && (
              <Typography variant="caption" color="text.secondary">{p.detail}</Typography>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/DashboardSection.tsx dashboard/components/ComplianceSummary.tsx dashboard/components/RecoverySummary.tsx dashboard/components/PrioritiesList.tsx
git commit -m "feat: add DashboardSection accordion, ComplianceSummary, RecoverySummary, PrioritiesList"
```

---

## Task 5: Rewrite Dashboard Home Page

**Files:**
- Modify: `dashboard/app/page.tsx`

This is the main event. Replace the sparse 4-card layout with the full information-dense dashboard.

- [ ] **Step 1: Rewrite page.tsx with new layout**

Replace the entire content of `dashboard/app/page.tsx` with the following:

```tsx
'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Typography, Box, Button, Chip, IconButton, Tooltip,
  Snackbar, Alert, Grid, Card, CardContent,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import ChecklistIcon from '@mui/icons-material/Checklist';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import { useRouter } from 'next/navigation';
import PhaseTimeline from '@/components/PhaseTimeline';
import PhaseDetailStrip from '@/components/PhaseDetailStrip';
import SparklineCard from '@/components/SparklineCard';
import TodaySession from '@/components/TodaySession';
import DashboardSection from '@/components/DashboardSection';
import ComplianceSummary from '@/components/ComplianceSummary';
import RecoverySummary from '@/components/RecoverySummary';
import PrioritiesList from '@/components/PrioritiesList';
import TrainingPlanTable from '@/components/TrainingPlanTable';
import { getTrainingWeek } from '@/lib/week';
import type { PhaseInfo } from '@/components/PhaseTimeline';
import type { PlanItem, SubTask, ExtendedGarminSummary } from '@/lib/types';

interface PeriodizationResponse {
  phases: PhaseInfo[];
  currentPhase: PhaseInfo;
  currentWeek: number;
  targets: {
    raceWeight: string;
    stretchWeight: string;
    protein: string;
    calories: string;
  };
}

function getProteinForWeight(weight: number | null): string {
  if (!weight) return '180g';
  if (weight >= 95) return '180g';
  if (weight >= 92) return '190g';
  return '200g';
}

export default function DashboardHome() {
  const router = useRouter();
  const [summary, setSummary] = useState<ExtendedGarminSummary | null>(null);
  const [periodization, setPeriodization] = useState<PeriodizationResponse | null>(null);
  const [planItems, setPlanItems] = useState<PlanItem[] | null>(null);
  const [selectedPhase, setSelectedPhase] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const syncAbortRef = useRef<AbortController | null>(null);

  const isSunday = new Date().getDay() === 0;

  const refreshSummary = useCallback(() => {
    fetch('/api/garmin')
      .then((r) => r.json())
      .then((data) => setSummary(data.summary))
      .catch(() => {});
  }, []);

  const loadPlan = useCallback(async () => {
    try {
      const res = await fetch('/api/plan/complete?action=list');
      if (res.ok) {
        const data = await res.json();
        setPlanItems(data.items || []);
      } else {
        setPlanItems([]);
      }
    } catch {
      setPlanItems([]);
    }
  }, []);

  useEffect(() => {
    refreshSummary();
    loadPlan();
    fetch('/api/periodization').then(r => r.json()).then(setPeriodization).catch(() => {});
  }, [refreshSummary, loadPlan]);

  useEffect(() => {
    if (periodization) setSelectedPhase(periodization.currentPhase.number);
  }, [periodization]);

  useEffect(() => {
    return () => { syncAbortRef.current?.abort(); };
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    const controller = new AbortController();
    syncAbortRef.current = controller;
    try {
      const res = await fetch('/api/garmin/sync', { method: 'POST', signal: controller.signal });
      const data = await res.json();
      if (data.success) {
        refreshSummary();
        setSyncResult({ type: 'success', message: 'Garmin data synced' });
      } else {
        setSyncResult({ type: 'error', message: data.error || 'Sync failed' });
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setSyncResult({ type: 'error', message: 'Could not reach sync endpoint' });
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateSubTasks = async (id: number, subTasks: SubTask[]) => {
    const allCompleted = subTasks.length > 0 && subTasks.every((st) => st.completed);
    setPlanItems((prev) =>
      prev?.map((item) =>
        item.id === id
          ? { ...item, subTasks, completed: allCompleted, completedAt: allCompleted ? new Date().toISOString() : null }
          : item
      ) ?? null
    );
    await fetch('/api/plan/complete', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, subTasks }),
    });
  };

  const handleUpdateNotes = async (id: number, notes: string) => {
    await fetch('/api/plan/complete', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, athleteNotes: notes }),
    });
  };

  const selectedPhaseData = periodization?.phases.find(p => p.number === selectedPhase);

  // Compute plan completion for accordion summary
  const planComplete = planItems
    ? planItems.filter(i => i.subTasks.length > 0 && i.subTasks.every(s => s.completed)).length
    : 0;
  const planTotal = planItems?.length ?? 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Typography variant="h4" fontWeight={700}>Dashboard</Typography>
        <Chip label={`Week ${getTrainingWeek()}`} variant="outlined" />
        <Tooltip title={syncing ? 'Syncing...' : 'Sync Garmin data'}>
          <IconButton onClick={handleSync} disabled={syncing} size="small">
            <SyncIcon sx={{
              animation: syncing ? 'spin 1s linear infinite' : 'none',
              '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
            }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Sunday reminder */}
      {isSunday && (
        <Card sx={{ mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">It&apos;s Sunday. Time for your check-in.</Typography>
            <Button variant="contained" color="inherit" size="large" onClick={() => router.push('/checkin')}
              sx={{ color: 'primary.main', bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}>
              Start Check-In
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Phase Timeline */}
      {periodization && (
        <PhaseTimeline
          phases={periodization.phases}
          currentPhaseNumber={periodization.currentPhase.number}
          selectedPhase={selectedPhase}
          onPhaseSelect={setSelectedPhase}
        />
      )}
      {selectedPhaseData && (
        <PhaseDetailStrip
          phase={selectedPhaseData}
          currentWeight={summary?.weight ?? null}
          isCurrentPhase={selectedPhase === periodization?.currentPhase.number}
        />
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Program: 89kg race weight · {getProteinForWeight(summary?.weight ?? null)}/day · 2,350 kcal
      </Typography>

      {/* Today's Session */}
      <TodaySession items={planItems} onToggleSubTask={handleUpdateSubTasks} />

      {/* Sparkline Metric Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 4, lg: 2 }}>
          <SparklineCard
            label="Weight"
            value={summary?.weight ?? null}
            unit="kg"
            sparklineData={summary?.dailyWeight.map(d => d.value)}
            delta={summary?.weightDelta}
            invertDelta
            target="Target: 89kg"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 4, lg: 2 }}>
          <SparklineCard
            label="Avg Sleep"
            value={summary?.avgSleep ?? null}
            sparklineData={summary?.dailySleep.map(d => d.value)}
            greenThreshold={75}
            yellowThreshold={60}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 4, lg: 2 }}>
          <SparklineCard
            label="Avg Readiness"
            value={summary?.avgReadiness ?? null}
            sparklineData={summary?.dailyReadiness.map(d => d.value)}
            greenThreshold={50}
            yellowThreshold={30}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 4, lg: 2 }}>
          <SparklineCard
            label="HRV"
            value={summary?.avgHrv ?? null}
            unit=" ms"
            sparklineData={summary?.dailyHrv.map(d => d.value)}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 4, lg: 2 }}>
          <SparklineCard
            label="Body Battery"
            value={summary?.bodyBatteryHigh ?? null}
            sparklineData={summary?.dailyBodyBattery.map(d => d.value)}
            greenThreshold={70}
            yellowThreshold={50}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 4, lg: 2 }}>
          <SparklineCard
            label="Activities"
            value={summary?.activityCount ?? null}
          />
        </Grid>
      </Grid>

      {/* Accordion Sections */}
      <DashboardSection
        title="Weekly Training Plan"
        icon={<FitnessCenterIcon />}
        summary={
          planTotal > 0
            ? <Chip label={`${planComplete}/${planTotal} complete`} size="small" variant="outlined" />
            : <Typography variant="caption" color="text.secondary">No plan</Typography>
        }
      >
        {planItems && planItems.length > 0 ? (
          <TrainingPlanTable
            items={planItems}
            onUpdateSubTasks={handleUpdateSubTasks}
            onUpdateNotes={handleUpdateNotes}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              No training plan for the current week.
            </Typography>
            <Button variant="outlined" size="small" onClick={() => router.push('/checkin')}>
              Run Check-In
            </Button>
          </Box>
        )}
      </DashboardSection>

      <DashboardSection
        title="Compliance & Habits"
        icon={<ChecklistIcon />}
        summary={
          <Box sx={{ display: 'flex', gap: 1 }}>
            {summary?.avgSleep != null && (
              <Chip label={`Sleep ${Math.round(summary.avgSleep)}`} size="small" variant="outlined" />
            )}
          </Box>
        }
      >
        <ComplianceSummary
          vampirePct={null}
          rugDays={null}
          hydrationTracked={false}
          bedtimeCompliance={null}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Compliance data populates after your first check-in of the week.
        </Typography>
      </DashboardSection>

      <DashboardSection
        title="Body & Recovery"
        icon={<MonitorHeartIcon />}
        summary={
          <Box sx={{ display: 'flex', gap: 1 }}>
            {summary?.acwr != null && (
              <Chip
                label={`ACWR ${summary.acwr}`}
                size="small"
                variant="outlined"
                color={summary.acwr >= 0.8 && summary.acwr <= 1.3 ? 'success' : summary.acwr <= 1.5 ? 'warning' : 'error'}
              />
            )}
            {summary?.avgHrv != null && (
              <Chip label={`HRV ${summary.avgHrv}`} size="small" variant="outlined" />
            )}
          </Box>
        }
      >
        <RecoverySummary
          avgHrv={summary?.avgHrv ?? null}
          bodyBatteryHigh={summary?.bodyBatteryHigh ?? null}
          avgStress={summary?.avgStress ?? null}
          acwr={summary?.acwr ?? null}
          acwrStatus={summary?.acwrStatus ?? null}
          avgAerobicTE={summary?.avgAerobicTE ?? null}
          avgAnaerobicTE={summary?.avgAnaerobicTE ?? null}
          avgRhr={summary?.avgRhr ?? null}
        />
      </DashboardSection>

      <DashboardSection
        title="Coaching Priorities"
        icon={<PriorityHighIcon />}
        summary={
          <Chip label="#1 Sleep · #2 Pull-ups" size="small" variant="outlined" />
        }
      >
        <PrioritiesList />
      </DashboardSection>

      <Snackbar open={syncResult !== null} autoHideDuration={4000} onClose={() => setSyncResult(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={syncResult?.type === 'success' ? 'success' : 'error'} onClose={() => setSyncResult(null)} variant="filled">
          {syncResult?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
```

- [ ] **Step 2: Verify the dashboard renders correctly**

Run: `npm run dev`
Navigate to `http://localhost:3000`
Expected: Today's session card, sparkline metric cards, expandable accordion sections.

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/page.tsx
git commit -m "feat: rewrite dashboard home with sparklines, TodaySession, and accordion sections"
```

---

## Task 6: Improve Training Plan Page

**Files:**
- Modify: `dashboard/app/plan/page.tsx`

Polish the plan page: better header with week range dates, progress ring instead of just text, briefing section refinement.

- [ ] **Step 1: Enhance plan page header and progress**

Changes:
- Add date range to header (e.g., "Week 12 · Mar 16-22")
- Replace plain text progress with a visual progress indicator alongside the text
- Make coach briefing default to expanded when first loaded
- Add "Back to Dashboard" breadcrumb link

- [ ] **Step 2: Verify plan page renders correctly**

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/plan/page.tsx
git commit -m "feat: polish training plan page header and progress display"
```

---

## Task 7: Improve Races Page

**Files:**
- Modify: `dashboard/app/races/page.tsx`

Replace the flat table with card-based race display for better visual hierarchy.

- [ ] **Step 1: Refactor races to card-based layout**

Changes:
- Each race as a Card with prominent countdown, status chip, and metadata
- Grid layout (2 columns on desktop, 1 on mobile)
- Past races in a collapsible "Past Races" section
- Keep the add/edit form as-is (it works well)
- Add visual countdown rings or prominent day counters

- [ ] **Step 2: Verify races page renders correctly**

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/races/page.tsx
git commit -m "feat: card-based race display with visual countdowns"
```

---

## Task 8: Improve DEXA Scans Page

**Files:**
- Modify: `dashboard/app/dexa/page.tsx`

Add visual body composition comparison between scans and better scan card layout.

- [ ] **Step 1: Enhance DEXA page**

Changes:
- Each scan as a card with visual body comp breakdown (horizontal bar for fat/lean/bone proportions)
- If >1 scan: show delta comparison card (fat loss, lean gain, etc.)
- Calibration info as a subtle card footer instead of plain text
- Keep the add form as-is (it works well)

- [ ] **Step 2: Verify DEXA page renders correctly**

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/dexa/page.tsx
git commit -m "feat: visual body composition cards for DEXA scans page"
```

---

## Task 9: Improve Archive Page

**Files:**
- Modify: `dashboard/app/archive/page.tsx`

Add metric preview chips to archive entries so you can see week-over-week changes at a glance.

- [ ] **Step 1: Enhance archive list entries**

Changes:
- Fetch metrics data from `/api/trends` to display alongside each week
- Show weight, sleep score, readiness as small chips on each archive row
- Visual indicator if that week had notable events (deload, missed sessions, etc.)
- Add plan completion percentage to each row if available

- [ ] **Step 2: Verify archive page renders correctly**

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/archive/page.tsx
git commit -m "feat: add metric previews to archive entries"
```

---

## Task 10: Improve Trends Page

**Files:**
- Modify: `dashboard/app/trends/page.tsx`
- Modify: `dashboard/components/TrendCharts.tsx`

Better visual grouping with section headers and consistent card sizing.

- [ ] **Step 1: Add section headers to TrendCharts**

Changes:
- Group charts into sections: "Body Composition" (weight, body fat, muscle), "Performance" (sleep, readiness, pull-ups), "Protocol Compliance" (vampire, rug, hydration), "Nutrition" (calories, protein), "Strength" (ceilings)
- Add `Typography` section headers between groups
- Consistent card heights within each row
- Better empty states with contextual guidance

- [ ] **Step 2: Verify trends page renders correctly**

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/trends/page.tsx dashboard/components/TrendCharts.tsx
git commit -m "feat: grouped trend charts with section headers"
```

---

## Task 11: Improve Check-In Form

**Files:**
- Modify: `dashboard/components/CheckInForm.tsx`

Better visual grouping and context in the subjective check-in step.

- [ ] **Step 1: Enhance CheckInForm visual grouping**

Changes:
- Step 2 (Subjective): Group related fields into visual card sub-sections:
  - "Pain & Fatigue" (Baker's Cyst + Lower Back)
  - "Training Completion" (sessions, misses, wins, struggles)
  - "Protocol Compliance" (bedtime, rug, hydration)
  - "Plan Feedback" (satisfaction, feedback text)
  - "Next Week" (conflicts, focus, questions)
- Add contextual helper text showing current week targets
- Step 3 (Review): Better visual summary with small status badges

- [ ] **Step 2: Verify check-in form renders correctly through all 4 steps**

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/CheckInForm.tsx
git commit -m "feat: visual grouping and context in check-in form"
```

---

## Task 12: Improve Profile Page

**Files:**
- Modify: `dashboard/app/profile/page.tsx`

Structure the raw markdown dump into organized sections.

- [ ] **Step 1: Enhance profile page layout**

Changes:
- Split profile markdown into sections (if possible via heading detection)
- Add quick-glance cards at the top: current weight, race weight target, current phase, next race countdown
- Keep periodization as collapsible markdown section
- Add links to related pages (DEXA, Trends, Races)

- [ ] **Step 2: Verify profile page renders correctly**

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/profile/page.tsx
git commit -m "feat: structured profile page with quick-glance cards"
```

---

## Task 13: Sidebar and Global Polish

**Files:**
- Modify: `dashboard/components/Sidebar.tsx`
- Modify: `dashboard/components/PhaseTimeline.tsx`
- Modify: `dashboard/components/PhaseDetailStrip.tsx`

Minor refinements for consistency with the new design.

- [ ] **Step 1: Polish sidebar**

Changes:
- Add subtle section dividers between nav groups (Main: Dashboard/Check-In/Plan, Data: Archive/Trends/DEXA, Meta: Races/Profile)
- Refine RaceCountdown spacing in sidebar

- [ ] **Step 2: Polish PhaseDetailStrip**

Changes:
- Add current week number to the strip
- If viewing current phase, show % through the phase as a subtle progress indicator

- [ ] **Step 3: Verify all pages render correctly**

Run: Navigate through all 8 pages in the browser.
Expected: Consistent styling, no visual regressions.

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/Sidebar.tsx dashboard/components/PhaseTimeline.tsx dashboard/components/PhaseDetailStrip.tsx
git commit -m "feat: sidebar grouping and PhaseDetailStrip enhancements"
```

---

## Task 14: Final Verification and Type-Check

- [ ] **Step 1: Run TypeScript compiler**

```bash
cd /Users/martinlevie/AI/Coach/dashboard && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 2: Run build**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 3: Manual smoke test**

Navigate through all pages:
1. Dashboard — sparklines render, today's session shows, accordions expand/collapse
2. Check-In — form steps work, visual grouping visible
3. Training Plan — progress shows, briefing expands, sub-tasks toggle
4. Archive — entries show metric previews
5. Trends — section headers group charts logically
6. DEXA — card-based scan display
7. Races — card-based race display with countdowns
8. Profile — structured layout with quick-glance cards

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final polish and type-check pass"
```
