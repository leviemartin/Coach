# Design Language Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Material Design 3 Expressive with an athletic/data dashboard aesthetic — sharper corners, Inter font, subtle cards, functional color, generous spacing — and fix the cramped dashboard layout.

**Architecture:** Theme-first approach. Rewrite `theme.ts` to swap M3's rounded/decorative aesthetic for a tight, data-focused design. The MUI theme cascade handles most component updates automatically. Then fix the dashboard layout (remove training plan/compliance, 3-per-row cards, one-liner TodaySession). Finally sweep all components and pages for hardcoded M3 styles that override the theme.

**Tech Stack:** Next.js 16, React 19, MUI 7.3, MUI X-Charts 8.27, Inter font (via `@fontsource-variable/inter`)

---

## File Structure

### Modified Files (theme foundation)
- `dashboard/package.json` — Add `@fontsource-variable/inter`
- `dashboard/lib/theme.ts` — Complete rewrite: drop M3 color utilities, handpicked palette, Inter font, tight radii
- `dashboard/app/globals.css` — Import Inter font
- `dashboard/components/ThemeRegistry.tsx` — No changes needed (already consumes lightTheme/darkTheme)

### Modified Files (dashboard layout)
- `dashboard/app/page.tsx` — Remove training plan accordion, remove compliance section, simplify TodaySession, fix card grid to 3-per-row
- `dashboard/components/TodaySession.tsx` — Rewrite to minimal one-liner

### Modified Files (hardcoded style overrides)
- `dashboard/components/SparklineCard.tsx` — Remove hardcoded `#1565C0`, use theme colors
- `dashboard/components/DashboardSection.tsx` — Update `borderRadius: '12px !important'` to use theme
- `dashboard/components/Sidebar.tsx` — Update active state styling, section labels
- `dashboard/components/PhaseTimeline.tsx` — Update border radius overrides
- `dashboard/components/PhaseDetailStrip.tsx` — Minor style updates
- `dashboard/components/StatusBadge.tsx` — No changes (uses MUI Chip, theme cascades)
- `dashboard/components/RaceCountdown.tsx` — Minor style updates
- `dashboard/components/TrainingPlanTable.tsx` — Update hardcoded border radius
- `dashboard/components/AgentBriefing.tsx` — Update hardcoded border radius
- `dashboard/components/TrendCharts.tsx` — Remove hardcoded chart colors, use theme palette
- `dashboard/components/CheckInForm.tsx` — Update stepper/card styling
- `dashboard/components/WorkoutDisplay.tsx` — No changes (uses theme typography)

### Modified Files (pages)
- `dashboard/app/plan/page.tsx` — Style consistency
- `dashboard/app/trends/page.tsx` — Style consistency
- `dashboard/app/races/page.tsx` — Style consistency
- `dashboard/app/dexa/page.tsx` — Style consistency
- `dashboard/app/archive/page.tsx` — Style consistency
- `dashboard/app/checkin/page.tsx` — Style consistency
- `dashboard/app/checkin/results/page.tsx` — Style consistency
- `dashboard/app/profile/page.tsx` — Style consistency

### Unchanged Files (verified — no hardcoded M3 styles)
- `dashboard/components/AppShell.tsx` — Layout shell, no M3 overrides
- `dashboard/components/MarkdownRenderer.tsx` — Uses theme typography only
- `dashboard/components/WorkoutDisplay.tsx` — Uses theme typography only
- `dashboard/components/StatusBadge.tsx` — Uses MUI Chip, theme cascades

### Potentially Removable
- `dashboard/components/ComplianceSummary.tsx` — No longer used on dashboard after Task 2. Keep file for future use but skip style updates in Task 4.

---

## Task 1: Install Inter Font and Rewrite Theme

**Files:**
- Modify: `dashboard/package.json`
- Modify: `dashboard/lib/theme.ts`
- Modify: `dashboard/app/globals.css`

This is the foundation — everything else cascades from here.

- [ ] **Step 1: Install Inter font**

```bash
cd /Users/martinlevie/AI/Coach/dashboard && npm install @fontsource-variable/inter && npm uninstall @material/material-color-utilities
```

- [ ] **Step 2: Import Inter in globals.css**

Replace the entire content of `dashboard/app/globals.css`:

```css
@import '@fontsource-variable/inter';

*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
}
```

- [ ] **Step 3: Rewrite theme.ts**

Replace the entire content of `dashboard/lib/theme.ts`. Drop the `@material/material-color-utilities` dependency entirely. Use a handpicked palette designed for a performance dashboard:

```typescript
'use client';

import { createTheme, type ThemeOptions } from '@mui/material/styles';

// Athletic dashboard palette — handpicked for data readability
const palette = {
  light: {
    primary: '#0f172a',        // Slate 900 — authoritative, not decorative
    primaryContrast: '#ffffff',
    secondary: '#3b82f6',      // Blue 500 — accent for interactive elements
    secondaryContrast: '#ffffff',
    error: '#ef4444',          // Red 500
    errorContrast: '#ffffff',
    warning: '#f59e0b',        // Amber 500
    warningContrast: '#000000',
    success: '#22c55e',        // Green 500
    successContrast: '#ffffff',
    info: '#3b82f6',           // Blue 500
    infoContrast: '#ffffff',
    background: '#f8fafc',     // Slate 50 — barely-there warmth
    paper: '#ffffff',
    textPrimary: '#0f172a',    // Slate 900
    textSecondary: '#64748b',  // Slate 500
    divider: '#e2e8f0',        // Slate 200
    surfaceHover: '#f1f5f9',   // Slate 100
  },
  dark: {
    primary: '#e2e8f0',        // Slate 200
    primaryContrast: '#0f172a',
    secondary: '#60a5fa',      // Blue 400
    secondaryContrast: '#0f172a',
    error: '#f87171',          // Red 400
    errorContrast: '#0f172a',
    warning: '#fbbf24',        // Amber 400
    warningContrast: '#0f172a',
    success: '#4ade80',        // Green 400
    successContrast: '#0f172a',
    info: '#60a5fa',           // Blue 400
    infoContrast: '#0f172a',
    background: '#0f172a',     // Slate 900
    paper: '#1e293b',          // Slate 800
    textPrimary: '#f1f5f9',    // Slate 100
    textSecondary: '#94a3b8',  // Slate 400
    divider: '#334155',        // Slate 700
    surfaceHover: '#1e293b',   // Slate 800
  },
};

function buildThemeOptions(mode: 'light' | 'dark'): ThemeOptions {
  const c = mode === 'light' ? palette.light : palette.dark;

  return {
    palette: {
      mode,
      primary: { main: c.primary, contrastText: c.primaryContrast },
      secondary: { main: c.secondary, contrastText: c.secondaryContrast },
      error: { main: c.error, contrastText: c.errorContrast },
      warning: { main: c.warning, contrastText: c.warningContrast },
      success: { main: c.success, contrastText: c.successContrast },
      info: { main: c.info, contrastText: c.infoContrast },
      background: { default: c.background, paper: c.paper },
      text: { primary: c.textPrimary, secondary: c.textSecondary },
      divider: c.divider,
    },
    shape: { borderRadius: 6 },
    typography: {
      fontFamily: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h1: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.025em' },
      h2: { fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.025em' },
      h3: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' },
      h4: { fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontSize: '1rem', fontWeight: 600 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      body1: { fontSize: '0.9375rem' },
      body2: { fontSize: '0.8125rem' },
      caption: { fontSize: '0.75rem', fontWeight: 500 },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            textTransform: 'none',
            fontWeight: 600,
            padding: '6px 16px',
            fontSize: '0.8125rem',
          },
        },
        defaultProps: { disableElevation: true },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 4, fontWeight: 600, fontSize: '0.75rem' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            border: 'none',
            backgroundImage: 'none',
          },
        },
        defaultProps: { elevation: 0 },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRadius: 0,
            borderRight: '1px solid',
            borderColor: c.divider,
          },
        },
      },
      MuiAccordion: {
        styleOverrides: {
          root: { borderRadius: 8, '&:before': { display: 'none' } },
        },
        defaultProps: { disableGutters: true, elevation: 0 },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 3, height: 6 },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: c.divider, fontSize: '0.8125rem' },
        },
      },
    },
  };
}

export const lightTheme = createTheme(buildThemeOptions('light'));
export const darkTheme = createTheme(buildThemeOptions('dark'));

// Export palette for direct use in components that need raw colors
export const dashboardPalette = palette;
```

- [ ] **Step 4: Verify dev server starts with new theme**

```bash
cd /Users/martinlevie/AI/Coach/dashboard && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors. The `@material/material-color-utilities` import is gone from theme.ts, but it may still be imported elsewhere — check and we'll clean that up if needed.

- [ ] **Step 5: Commit**

```bash
git add dashboard/package.json dashboard/package-lock.json dashboard/lib/theme.ts dashboard/app/globals.css
git commit -m "feat: replace M3 Expressive with athletic dashboard theme (Inter, sharp corners, slate palette)"
```

---

## Task 2: Rewrite Dashboard Layout

**Files:**
- Modify: `dashboard/app/page.tsx`

Remove the training plan accordion, remove compliance section, fix sparkline card grid to 3 per row, simplify TodaySession usage.

- [ ] **Step 1: Rewrite page.tsx**

Key changes from current file:
1. **Remove imports**: `TrainingPlanTable`, `ComplianceSummary`, `FitnessCenterIcon` (plan), `ChecklistIcon` (compliance)
2. **Remove state**: `planItems` state (the full plan data) — keep a simpler version just for TodaySession
3. **Remove handlers**: `handleUpdateNotes` (only needed for TrainingPlanTable)
4. **Grid change**: SparklineCards from `lg: 2` (6/row) to `sm: 6, md: 4` (3/row on desktop, 2/row on tablet)
5. **Remove accordions**: "Weekly Training Plan" and "Compliance & Habits" — keep only "Body & Recovery" and "Coaching Priorities"
6. **Spacing**: Increase `spacing={3}` on grid (was 2), add `mb: 4` between sections

Full replacement code for `dashboard/app/page.tsx`:

```tsx
'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Typography, Box, Button, Chip, IconButton, Tooltip,
  Snackbar, Alert, Grid, Card, CardContent,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import { useRouter } from 'next/navigation';
import PhaseTimeline from '@/components/PhaseTimeline';
import PhaseDetailStrip from '@/components/PhaseDetailStrip';
import SparklineCard from '@/components/SparklineCard';
import TodaySession from '@/components/TodaySession';
import DashboardSection from '@/components/DashboardSection';
import RecoverySummary from '@/components/RecoverySummary';
import PrioritiesList from '@/components/PrioritiesList';
import { getTrainingWeek } from '@/lib/week';
import type { PhaseInfo } from '@/components/PhaseTimeline';
import type { PlanItem, SubTask, ExtendedGarminSummary } from '@/lib/types';

interface PeriodizationResponse {
  phases: PhaseInfo[];
  currentPhase: PhaseInfo;
  currentWeek: number;
  targets: { raceWeight: string; stretchWeight: string; protein: string; calories: string };
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

  const selectedPhaseData = periodization?.phases.find(p => p.number === selectedPhase);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <Typography variant="h3">Dashboard</Typography>
        <Chip label={`Week ${getTrainingWeek()}`} size="small" />
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
        <Box sx={{ mb: 4, p: 3, bgcolor: 'secondary.main', color: 'secondary.contrastText', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">It&apos;s Sunday. Time for your check-in.</Typography>
            <Button variant="contained" size="large" onClick={() => router.push('/checkin')}
              sx={{ bgcolor: 'white', color: 'secondary.main', '&:hover': { bgcolor: 'grey.100' } }}>
              Start Check-In
            </Button>
          </Box>
        </Box>
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

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Program: 89kg race weight · {getProteinForWeight(summary?.weight ?? null)}/day · 2,350 kcal
      </Typography>

      {/* Today's Session — one-liner */}
      <TodaySession items={planItems} onToggleSubTask={handleUpdateSubTasks} />

      {/* Sparkline Metric Cards — 3 per row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
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
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <SparklineCard
            label="Avg Sleep"
            value={summary?.avgSleep ?? null}
            sparklineData={summary?.dailySleep.map(d => d.value)}
            greenThreshold={75}
            yellowThreshold={60}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <SparklineCard
            label="Avg Readiness"
            value={summary?.avgReadiness ?? null}
            sparklineData={summary?.dailyReadiness.map(d => d.value)}
            greenThreshold={50}
            yellowThreshold={30}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <SparklineCard
            label="HRV"
            value={summary?.avgHrv ?? null}
            unit=" ms"
            sparklineData={summary?.dailyHrv.map(d => d.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <SparklineCard
            label="Body Battery"
            value={summary?.bodyBatteryHigh ?? null}
            sparklineData={summary?.dailyBodyBattery.map(d => d.value)}
            greenThreshold={70}
            yellowThreshold={50}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <SparklineCard
            label="Activities"
            value={summary?.activityCount ?? null}
          />
        </Grid>
      </Grid>

      {/* Body & Recovery */}
      <DashboardSection
        title="Body & Recovery"
        icon={<MonitorHeartIcon />}
        summary={
          <Box sx={{ display: 'flex', gap: 1 }}>
            {summary?.acwr != null && (
              <Chip
                label={`ACWR ${summary.acwr}`}
                size="small"
                color={summary.acwr >= 0.8 && summary.acwr <= 1.3 ? 'success' : summary.acwr <= 1.5 ? 'warning' : 'error'}
              />
            )}
            {summary?.avgHrv != null && (
              <Chip label={`HRV ${summary.avgHrv}`} size="small" />
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

      {/* Coaching Priorities */}
      <DashboardSection
        title="Coaching Priorities"
        icon={<PriorityHighIcon />}
        summary={<Chip label="#1 Sleep · #2 Pull-ups" size="small" />}
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

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/page.tsx
git commit -m "feat: clean dashboard layout — remove plan/compliance, 3-per-row cards, more spacing"
```

---

## Task 3: Simplify TodaySession to One-Liner

**Files:**
- Modify: `dashboard/components/TodaySession.tsx`

Replace the full workout preview card with a minimal one-line session indicator.

- [ ] **Step 1: Rewrite TodaySession.tsx**

```tsx
'use client';

import { Typography, Box, Chip, Button, Skeleton } from '@mui/material';
import { useRouter } from 'next/navigation';
import type { PlanItem, SubTask } from '@/lib/types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface TodaySessionProps {
  items: PlanItem[] | null;
  onToggleSubTask?: (id: number, subTasks: SubTask[]) => void;
}

export default function TodaySession({ items, onToggleSubTask }: TodaySessionProps) {
  const router = useRouter();
  const todayName = DAY_NAMES[new Date().getDay()];

  if (items === null) {
    return (
      <Box sx={{ mb: 4 }}>
        <Skeleton variant="text" width={300} height={28} />
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="body1" color="text.secondary">No plan this week.</Typography>
        <Button size="small" onClick={() => router.push('/checkin')}>Run Check-In</Button>
      </Box>
    );
  }

  const todayItem = items.find(
    (item) => item.day.toLowerCase() === todayName.toLowerCase()
  );

  if (!todayItem) return null;

  const allDone = todayItem.subTasks.length > 0 && todayItem.subTasks.every(st => st.completed);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        mb: 4,
        py: 2,
        borderBottom: 1,
        borderColor: 'divider',
        flexWrap: 'wrap',
        ...(allDone && { opacity: 0.6 }),
      }}
    >
      <Typography variant="body1" fontWeight={700}>
        Today
      </Typography>
      <Chip
        label={todayItem.sessionType}
        size="small"
        color={allDone ? 'success' : 'default'}
        variant={allDone ? 'outlined' : 'filled'}
      />
      {todayItem.focus && (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          {todayItem.focus}
        </Typography>
      )}

      {/* Sub-task quick-toggles */}
      {todayItem.subTasks.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
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
              sx={{ cursor: onToggleSubTask ? 'pointer' : 'default' }}
            />
          ))}
        </Box>
      )}

      <Button size="small" variant="text" onClick={() => router.push('/plan')} sx={{ ml: todayItem.subTasks.length > 0 ? 0 : 'auto' }}>
        View Plan →
      </Button>
    </Box>
  );
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/TodaySession.tsx
git commit -m "feat: simplify TodaySession to minimal one-liner"
```

---

## Task 4: Update Components with Hardcoded Styles

**Files:**
- Modify: `dashboard/components/SparklineCard.tsx`
- Modify: `dashboard/components/DashboardSection.tsx`
- Modify: `dashboard/components/Sidebar.tsx`
- Modify: `dashboard/components/PhaseTimeline.tsx`
- Modify: `dashboard/components/RaceCountdown.tsx`
- Modify: `dashboard/components/RecoverySummary.tsx`
- Modify: `dashboard/components/PrioritiesList.tsx`

Sweep all components for hardcoded M3 styles (skip ComplianceSummary — no consumers after Task 2) (colors like `#1565C0`, `borderRadius: '12px !important'`, etc.) and update them to use the new theme.

- [ ] **Step 1: Update SparklineCard**

In `SparklineCard.tsx`:
- Change `color="#1565C0"` on SparkLineChart to `color="currentColor"` or use theme's `secondary.main`. Since SparkLineChart needs a hex color, use the theme hook:

```tsx
import { useTheme } from '@mui/material/styles';
// Inside the component:
const theme = useTheme();
// On the SparkLineChart:
color={theme.palette.secondary.main}
```

- Remove the `minHeight` prop default of 120 — let the card size naturally based on content.

- [ ] **Step 2: Update DashboardSection**

In `DashboardSection.tsx`:
- Change `borderRadius: '12px !important'` to `borderRadius: 2` (uses theme shape.borderRadius * 2 = 12px... actually with new theme borderRadius=6, `2` = 12px which is still round. Use `1` for 6px or remove the override entirely to let the Accordion theme default handle it.)
- Change `border: 1, borderColor: 'divider'` to just a subtle background: `bgcolor: 'background.paper'` — cards in the new design don't have borders.

Updated component:
```tsx
<Accordion
  defaultExpanded={defaultExpanded}
  disableGutters
  elevation={0}
  sx={{
    bgcolor: 'background.paper',
    mb: 3,
  }}
>
```

- [ ] **Step 3: Update Sidebar**

In `Sidebar.tsx`:
- Change active state `bgcolor: 'primary.main'` to `bgcolor: 'action.selected'` with subtle text highlight — the current primary (slate 900) fills too aggressively in the new palette.
- Active text: `color: 'secondary.main'` (blue accent) instead of white-on-primary.

```tsx
'&.Mui-selected': {
  bgcolor: 'action.selected',
  color: 'secondary.main',
  '& .MuiListItemIcon-root': { color: 'secondary.main' },
  '&:hover': { bgcolor: 'action.hover' },
},
```

- Change `borderRadius: 2` on ListItemButton to `borderRadius: 1` (tighter).

- [ ] **Step 4: Update PhaseTimeline**

In `PhaseTimeline.tsx`:
- The rounded corners on first/last segments use `borderRadius: '8px 0 0 8px'` — change to `4px`.
- The `warning.main` color for selected/current indicators may need checking against the new palette.

- [ ] **Step 5: Update RaceCountdown**

In `RaceCountdown.tsx`:
- The `LinearProgress` `borderRadius: 4` can stay (theme default handles this now).
- Check the `bgcolor: 'background.default'` on the card — may need to be `background.paper` for contrast.

- [ ] **Step 6: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add dashboard/components/SparklineCard.tsx dashboard/components/DashboardSection.tsx dashboard/components/Sidebar.tsx dashboard/components/PhaseTimeline.tsx dashboard/components/RaceCountdown.tsx dashboard/components/RecoverySummary.tsx dashboard/components/ComplianceSummary.tsx dashboard/components/PrioritiesList.tsx
git commit -m "feat: update component styles for athletic dashboard design language"
```

---

## Task 5: Update TrendCharts Colors

**Files:**
- Modify: `dashboard/components/TrendCharts.tsx`

The TrendCharts component has many hardcoded hex colors for chart series. Update them to work with both light and dark themes.

- [ ] **Step 1: Replace hardcoded chart colors**

The current chart colors are M3-inspired hex values. Replace with a consistent palette that works in both modes:

```typescript
// At top of TrendCharts.tsx — dashboard chart colors
const CHART_COLORS = {
  blue: '#3b82f6',
  green: '#22c55e',
  purple: '#8b5cf6',
  orange: '#f97316',
  red: '#ef4444',
  teal: '#14b8a6',
  pink: '#ec4899',
  amber: '#f59e0b',
};
```

Replace individual chart color references:
- Weight: `#1565C0` → `CHART_COLORS.blue`
- Sleep: `#7E57C2` → `CHART_COLORS.purple`
- Readiness: `#26A69A` → `CHART_COLORS.teal`
- Vampire: `#5C6BC0` → `CHART_COLORS.blue`
- Rug: `#AB47BC` → `CHART_COLORS.purple`
- Hydration: `#29B6F6` → `CHART_COLORS.teal`
- Ceilings: `#EF5350` → `CHART_COLORS.red`
- Pull-ups: `#FF7043` → `CHART_COLORS.orange`
- Calories: `#FFA726` → `CHART_COLORS.amber`
- Protein: `#66BB6A` → `CHART_COLORS.green`
- Garmin BF%: `#FF7043` → `CHART_COLORS.orange`
- DEXA BF%: `#E91E63` → `CHART_COLORS.pink`
- Muscle mass: `#4CAF50` → `CHART_COLORS.green`

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/TrendCharts.tsx
git commit -m "feat: consistent chart color palette across TrendCharts"
```

---

## Task 6: Update TrainingPlanTable and AgentBriefing

**Files:**
- Modify: `dashboard/components/TrainingPlanTable.tsx`
- Modify: `dashboard/components/AgentBriefing.tsx`

These components have hardcoded border-radius and color values.

- [ ] **Step 1: Update TrainingPlanTable**

In `TrainingPlanTable.tsx`:
- The progress `LinearProgress` has `borderRadius: 4` — let theme handle it (remove override).
- Check for any hardcoded `borderRadius` on cards/boxes.

- [ ] **Step 2: Update AgentBriefing**

In `AgentBriefing.tsx`:
- The `AGENT_COLORS` map uses M3-style colors. These are semantic (per-agent identity), so they can stay — they're not theme colors. No change needed.
- Check `LinearProgress` overrides.

- [ ] **Step 3: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/TrainingPlanTable.tsx dashboard/components/AgentBriefing.tsx
git commit -m "feat: update TrainingPlanTable and AgentBriefing for new design language"
```

---

## Task 7: Update All Pages for Design Consistency

**Files:**
- Modify: `dashboard/app/plan/page.tsx`
- Modify: `dashboard/app/trends/page.tsx`
- Modify: `dashboard/app/races/page.tsx`
- Modify: `dashboard/app/dexa/page.tsx`
- Modify: `dashboard/app/archive/page.tsx`
- Modify: `dashboard/app/checkin/page.tsx`
- Modify: `dashboard/app/checkin/results/page.tsx`
- Modify: `dashboard/app/profile/page.tsx`
- Modify: `dashboard/app/plan/[weekNumber]/page.tsx`
- Modify: `dashboard/app/archive/[weekNumber]/page.tsx`

Sweep all pages for:
1. **Page titles**: Use `variant="h3"` (was h4/h5) for consistency with new dashboard
2. **Spacing**: `mb: 4` between major sections (was mb: 2-3)
3. **Card variants**: Remove explicit `variant="outlined"` — new theme defaults to borderless
4. **Button styles**: Ensure no `borderRadius: 20` overrides remain
5. **Breadcrumb links**: Ensure consistent "← Dashboard" styling

Most pages should look correct already from the theme cascade. The main work is:
- Removing explicit `variant="outlined"` on Cards (new default is no border)
- Updating page heading sizes for consistency

- [ ] **Step 1: Update each page**

Read each page file. For each:
- Change `variant="h4"` page titles to `variant="h3"`
- Remove explicit `variant="outlined"` on Card components
- Ensure spacing `mb: 4` between major sections
- Remove any hardcoded `borderRadius` overrides on buttons/cards

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/plan/page.tsx dashboard/app/trends/page.tsx dashboard/app/races/page.tsx dashboard/app/dexa/page.tsx dashboard/app/archive/page.tsx dashboard/app/checkin/page.tsx dashboard/app/checkin/results/page.tsx dashboard/app/profile/page.tsx
git commit -m "feat: update all pages for design consistency — headings, spacing, card variants"
```

---

## Task 8: Final Verification and Build

- [ ] **Step 1: Run TypeScript check**

```bash
cd /Users/martinlevie/AI/Coach/dashboard && npx tsc --noEmit
```

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: All 26 routes compile.

- [ ] **Step 3: Visual smoke test**

Start dev server and check all pages in both light and dark mode:
1. Dashboard — cards have space, no training plan section, one-liner TodaySession
2. Plan — readable with new typography
3. Trends — chart colors consistent
4. Races — card layout with new styling
5. DEXA — scan cards with new styling
6. Archive — clean entries
7. Check-In — form steps clean
8. Profile — structured layout

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A && git commit -m "chore: final design language polish"
```
