# Page Refresh Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the design system from Plan 1 to all remaining pages — Trends, Daily Log, Training Plan, Check-In, Profile, DEXA, Races, Sidebar, and mobile bottom nav. Ensure visual consistency across the entire app.

**Architecture:** Each page gets the same treatment: replace hardcoded colors with semantic tokens, upgrade cards to the HeroCard/MetricCard hierarchy where appropriate, apply typography scale, and add any new charts/visualizations specified in the spec. No backend changes. No new API routes (except one for bedtime consistency data on Trends).

**Tech Stack:** Next.js 15, MUI 6, MUI X-Charts, TypeScript, SVG

**Spec:** `docs/superpowers/specs/2026-03-21-dashboard-redesign-design.md` — Section 4

**Plan 3 of 3** — Depends on Plan 1 (design system components must exist). Independent of Plan 2 (workout tracker).

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `dashboard/components/MobileBottomNav.tsx` | Bottom navigation bar for mobile (Dashboard, Session, Log, Plan) |

### Modified Files

| File | Changes |
|------|---------|
| `dashboard/components/TrendCharts.tsx` | Semantic colors, weight journey chart, bedtime overlay, Training Load Focus chart, Endurance Score, streak tracking |
| `dashboard/app/log/page.tsx` | Design tokens, "Start Session" link, tracker auto-population |
| `dashboard/components/DailyLog.tsx` | Visual refresh with design tokens |
| `dashboard/components/DailyChecklist.tsx` | Semantic colors on compliance indicators |
| `dashboard/components/BedtimeCard.tsx` | Semantic colors for compliance levels |
| `dashboard/components/DayProgress.tsx` | Semantic colors on progress ring |
| `dashboard/components/ComplianceSparkline.tsx` | Semantic colors |
| `dashboard/components/WeekComplianceBar.tsx` | Semantic colors |
| `dashboard/app/plan/page.tsx` | Tracker status per day, "Start Session" buttons, visual refresh |
| `dashboard/components/TrainingPlanTable.tsx` | Design tokens, tracker status indicators, session type colors |
| `dashboard/app/checkin/page.tsx` | Card hierarchy on form steps |
| `dashboard/components/CheckInForm.tsx` | Design tokens on subjective inputs |
| `dashboard/components/AgentBriefing.tsx` | Design tokens on specialist cards |
| `dashboard/app/profile/page.tsx` | StatCards → HeroCard/MetricCard styles |
| `dashboard/app/dexa/page.tsx` | Semantic colors on body comp bar |
| `dashboard/app/races/page.tsx` | HeroCard treatment on countdown cards |
| `dashboard/components/Sidebar.tsx` | Race countdown compact style |
| `dashboard/components/AppShell.tsx` | Add MobileBottomNav for mobile viewports |
| `dashboard/components/RaceCountdown.tsx` | Compact HeroCard style |

---

## Task 1: Trends Page — Semantic Colors + Weight Journey Chart

**Files:**
- Modify: `dashboard/components/TrendCharts.tsx`

- [ ] **Step 1: Read the current TrendCharts component**

Read `dashboard/components/TrendCharts.tsx` to understand all chart sections.

- [ ] **Step 2: Replace CHART_COLORS with semantic colors**

Import `semanticColors` from `@/lib/design-tokens`. Replace the hardcoded `CHART_COLORS` object:

```typescript
import { semanticColors } from '@/lib/design-tokens';

const CHART_COLORS = {
  blue: semanticColors.body,
  green: semanticColors.recovery.good,
  purple: '#8b5cf6', // protocols
  orange: semanticColors.cardioIntervals,
  red: semanticColors.recovery.problem,
  teal: semanticColors.cardioSteady,
  pink: '#ec4899',
  amber: semanticColors.recovery.caution,
};
```

- [ ] **Step 3: Upgrade Weight Progression chart**

Replace the simple LineChart with the full journey view:
- Add a dashed reference line at 89kg (or phase-stepped targets if periodization data is available from the `dexaScans` prop context)
- Add start weight annotation
- Keep the existing LineChart but add `referenceLines` overlay

- [ ] **Step 4: Add bedtime consistency chart to Sleep & Readiness section**

After the existing Sleep & Readiness BarChart, add a new chart showing actual bedtime vs 23:00 target. This requires the sleep daily data to include `bedtime` field. If available from `WeeklyMetrics`, plot actual bedtimes as dots with a horizontal reference line at 23:00. Color dots green (<23:00), amber (23:00-01:00), red (>01:00).

- [ ] **Step 5: Add compliance streak tracking**

In the Protocol Compliance section, add a "longest streak" display per protocol under the existing bar chart. Calculate from the compliance trend data.

- [ ] **Step 6: Commit**

```bash
git add dashboard/components/TrendCharts.tsx
git commit -m "feat(trends): apply semantic colors, weight journey annotations, bedtime chart, streaks"
```

---

## Task 2: Trends Page — Training Load Focus + Endurance Score Charts

**Files:**
- Modify: `dashboard/components/TrendCharts.tsx`

- [ ] **Step 1: Add Training Load Focus chart**

After the "Training Load" section header, add a new card with:
- Stacked bar chart showing Low Aerobic / High Aerobic / Anaerobic load over weeks
- Shortage flags as annotations
- Uses `semanticColors.cardioSteady` for aerobic, `semanticColors.cardioIntervals` for anaerobic

Note: This requires load focus data in the weekly metrics. If not available in current `WeeklyMetrics`, add an empty state: "Training Load Focus data will appear after your first check-in with Garmin data."

- [ ] **Step 2: Add Endurance Score trend**

Add a line chart for Endurance Score if available. If not yet tracked in `WeeklyMetrics`, show empty state placeholder.

- [ ] **Step 3: Re-label Trends page sections**

Update the Trends page to match the groupings:
- "Body Composition" → "Body Composition" (unchanged)
- "Performance & Recovery" → "Performance & Recovery" (unchanged)
- "Training Load" → "Training Load" (add Load Focus + Endurance Score)
- "Protocol Compliance" → "Protocol Compliance" (add streaks)

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/TrendCharts.tsx
git commit -m "feat(trends): add Training Load Focus and Endurance Score charts"
```

---

## Task 3: Daily Log Page — Design Tokens + Tracker Link

**Files:**
- Modify: `dashboard/app/log/page.tsx`
- Modify: `dashboard/components/DailyLog.tsx`
- Modify: `dashboard/components/DailyChecklist.tsx`
- Modify: `dashboard/components/BedtimeCard.tsx`
- Modify: `dashboard/components/DayProgress.tsx`
- Modify: `dashboard/components/ComplianceSparkline.tsx`
- Modify: `dashboard/components/WeekComplianceBar.tsx`

- [ ] **Step 1: Read all Daily Log components**

Read each component file to understand current color usage.

- [ ] **Step 2: Apply semantic colors to DailyChecklist**

Replace hardcoded color logic in weekly tally chips with `semanticColors`:
- Compliance met → `semanticColors.recovery.good`
- Partial → `semanticColors.recovery.caution`
- Not met → `semanticColors.recovery.problem`

- [ ] **Step 3: Apply semantic colors to BedtimeCard**

Replace bedtime compliance colors:
- On time (<23:00) → `semanticColors.recovery.good`
- Late (23:00-24:00) → `semanticColors.recovery.caution`
- Way late (>24:00) → `semanticColors.recovery.problem`

- [ ] **Step 4: Apply semantic colors to DayProgress ring**

Update the circular progress ring to use `semanticColors` based on completion percentage.

- [ ] **Step 5: Apply semantic colors to ComplianceSparkline and WeekComplianceBar**

Update progress bars and sparklines to use the semantic color system.

- [ ] **Step 6: Add "Start Session" link to DailyLog**

In `DailyLog.tsx`, if a workout is planned for the current day and not yet completed, show a "Start Session" button that navigates to `/session`. If the session was already tracked, show "Session completed" with a green checkmark.

- [ ] **Step 7: Commit**

```bash
git add dashboard/app/log/page.tsx dashboard/components/DailyLog.tsx \
  dashboard/components/DailyChecklist.tsx dashboard/components/BedtimeCard.tsx \
  dashboard/components/DayProgress.tsx dashboard/components/ComplianceSparkline.tsx \
  dashboard/components/WeekComplianceBar.tsx
git commit -m "feat(daily-log): apply design system tokens and add tracker link"
```

---

## Task 4: Training Plan Page — Tracker Status + Visual Refresh

**Files:**
- Modify: `dashboard/app/plan/page.tsx`
- Modify: `dashboard/components/TrainingPlanTable.tsx`

- [ ] **Step 1: Read current TrainingPlanTable**

Read `dashboard/components/TrainingPlanTable.tsx` to understand card layout and session type chip colors.

- [ ] **Step 2: Add tracker status indicators**

For each day card, check if a session log exists for that date:
- Not started → show "Start Session" button (links to `/session`)
- In progress → show amber "In Progress" chip
- Completed → show green "Completed" chip with compliance %

This requires fetching session status. Add a lightweight client-side check against `/api/session/week`.

- [ ] **Step 3: Apply design system to session type chips**

Replace hardcoded chip colors with semantic mapping:
- Strength → `semanticColors.body` background
- Recovery/Mobility → `semanticColors.cardioSteady` background
- Cardio → `semanticColors.cardioIntervals` background
- Family → `semanticColors.recovery.good` background
- Ruck → `semanticColors.recovery.good` background

- [ ] **Step 4: Apply typography tokens to section headers**

Use `typography.categoryLabel` for day labels and `typography.sectionTitle` for session titles.

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/plan/page.tsx dashboard/components/TrainingPlanTable.tsx
git commit -m "feat(plan): add tracker status indicators and apply design system"
```

---

## Task 5: Check-In Page — Design Token Refresh

**Files:**
- Modify: `dashboard/app/checkin/page.tsx`
- Modify: `dashboard/components/CheckInForm.tsx`
- Modify: `dashboard/components/AgentBriefing.tsx`

- [ ] **Step 1: Read current CheckInForm and AgentBriefing**

Read both components to understand color usage and card structure.

- [ ] **Step 2: Apply card hierarchy to CheckInForm steps**

Use `MetricCard` or design tokens for the step content areas. Apply `typography.categoryLabel` for step labels.

- [ ] **Step 3: Apply design system to AgentBriefing**

Update specialist agent cards to use the card hierarchy. Apply consistent color mapping per agent domain:
- Strength → Red accent
- Endurance → Green accent
- OCR → Orange accent
- Nutrition → Purple accent
- Recovery → Teal accent
- Mobility → Amber accent
- Mental → Indigo accent

These are existing colors — just ensure they use the semantic system consistently.

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/checkin/page.tsx dashboard/components/CheckInForm.tsx \
  dashboard/components/AgentBriefing.tsx
git commit -m "feat(checkin): apply design system tokens to check-in flow"
```

---

## Task 6: Profile Page — HeroCard Treatment

**Files:**
- Modify: `dashboard/app/profile/page.tsx`

- [ ] **Step 1: Read current Profile page**

Read `dashboard/app/profile/page.tsx` to understand StatCard usage.

- [ ] **Step 2: Replace StatCards with HeroCard/MetricCard styles**

Import `HeroCard` and `MetricCard` from Plan 1 components. Apply:
- "Current Phase" → HeroCard with body accent
- "Current Weight" → HeroCard with body accent
- "Race Weight Target" → MetricCard
- "Next Race" → HeroCard with recovery accent (countdown emphasis)

Apply `typography.categoryLabel` for labels and `typography.primaryMetric` for values.

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/profile/page.tsx
git commit -m "feat(profile): apply HeroCard/MetricCard styles to stat cards"
```

---

## Task 7: DEXA Page — Semantic Colors

**Files:**
- Modify: `dashboard/app/dexa/page.tsx`

- [ ] **Step 1: Read current DEXA page**

Read `dashboard/app/dexa/page.tsx` to understand body comp bar and delta card colors.

- [ ] **Step 2: Apply semantic colors to BodyCompBar**

Replace hardcoded colors:
- Fat: `#f44336` → `semanticColors.recovery.problem`
- Lean: `#2196f3` → `semanticColors.body`
- Bone: `#9e9e9e` → keep (neutral gray)

- [ ] **Step 3: Apply semantic colors to DeltaItem**

Use `semanticColors.recovery.good` for improvements and `semanticColors.recovery.problem` for regressions.

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/dexa/page.tsx
git commit -m "feat(dexa): apply semantic colors to body composition charts"
```

---

## Task 8: Races Page — HeroCard Countdown

**Files:**
- Modify: `dashboard/app/races/page.tsx`

- [ ] **Step 1: Read current Races page**

Read `dashboard/app/races/page.tsx` to understand RaceCard structure.

- [ ] **Step 2: Apply HeroCard treatment to countdown**

The countdown number (e.g., "12w 3d") should use `typography.primaryMetric` with bold weight. Apply semantic border colors based on race status.

- [ ] **Step 3: Apply design tokens**

Use `typography.categoryLabel` for date/location meta. Use the semantic color system for status chips.

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/races/page.tsx
git commit -m "feat(races): apply HeroCard treatment to race countdown cards"
```

---

## Task 9: Sidebar + Race Countdown Widget

**Files:**
- Modify: `dashboard/components/Sidebar.tsx`
- Modify: `dashboard/components/RaceCountdown.tsx`

- [ ] **Step 1: Read RaceCountdown component**

Read `dashboard/components/RaceCountdown.tsx` to understand current widget.

- [ ] **Step 2: Apply compact HeroCard style**

Update the sidebar race countdown widget to use `typography.metricValue` for the countdown number and `semanticColors` for the progress bar.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/Sidebar.tsx dashboard/components/RaceCountdown.tsx
git commit -m "feat(sidebar): apply design system to race countdown widget"
```

---

## Task 10: Mobile Bottom Navigation

**Files:**
- Create: `dashboard/components/MobileBottomNav.tsx`
- Modify: `dashboard/components/AppShell.tsx`

- [ ] **Step 1: Create MobileBottomNav**

```typescript
// dashboard/components/MobileBottomNav.tsx
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EditNoteIcon from '@mui/icons-material/EditNote';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { label: 'Session', path: '/session', icon: <PlayArrowIcon /> },
  { label: 'Log', path: '/log', icon: <EditNoteIcon /> },
  { label: 'Plan', path: '/plan', icon: <FitnessCenterIcon /> },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const currentIndex = NAV_ITEMS.findIndex((item) =>
    item.path === '/' ? pathname === '/' : pathname.startsWith(item.path),
  );

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: { xs: 'block', md: 'none' },
        zIndex: 1200,
        borderTop: 1,
        borderColor: 'divider',
      }}
      elevation={3}
    >
      <BottomNavigation
        value={currentIndex}
        onChange={(_, newValue) => {
          router.push(NAV_ITEMS[newValue].path);
        }}
        showLabels
        sx={{ height: 56 }}
      >
        {NAV_ITEMS.map((item) => (
          <BottomNavigationAction
            key={item.path}
            label={item.label}
            icon={item.icon}
            sx={{ minWidth: 0, '&.Mui-selected': { color: 'secondary.main' } }}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
```

- [ ] **Step 2: Add MobileBottomNav to AppShell**

Read `dashboard/components/AppShell.tsx`. Add `<MobileBottomNav />` as the last child, and add `pb: { xs: '72px', md: 0 }` to the main content area to prevent content from being hidden behind the nav bar.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/MobileBottomNav.tsx dashboard/components/AppShell.tsx
git commit -m "feat(mobile): add bottom navigation bar for mobile viewports"
```

---

## Task 11: Final Integration Test

- [ ] **Step 1: Run all tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `cd dashboard && npx next build`
Expected: Build succeeds

- [ ] **Step 3: Visual consistency check**

Open each page and verify design system consistency:
- [ ] Dashboard — uses new 3-tier layout (from Plan 1)
- [ ] Trends — semantic colors, weight journey annotations
- [ ] Daily Log — semantic colors, tracker link
- [ ] Training Plan — tracker status, semantic chip colors
- [ ] Session (tracker) — if Plan 2 is implemented
- [ ] Check-In — card hierarchy on form steps
- [ ] Profile — HeroCard/MetricCard stat cards
- [ ] DEXA — semantic body comp colors
- [ ] Races — HeroCard countdown treatment
- [ ] Archive — consistent card styles
- [ ] Sidebar — compact race countdown
- [ ] Mobile — bottom nav appears, pages scroll without overlap

- [ ] **Step 4: Dark mode check**

Toggle dark mode and verify all semantic colors work in both modes. The `semanticColors` are hardcoded hex values — they may need dark mode variants. Check each page in dark mode and note any unreadable text or invisible elements.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(pages): integration fixes from visual consistency check"
```
