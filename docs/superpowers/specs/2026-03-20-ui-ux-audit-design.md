# Spec 3: UI/UX Audit + Fixes

**Date:** 2026-03-20
**Status:** Draft
**Scope:** Mobile and desktop UI/UX fixes — touch targets, responsiveness, error states, accessibility, consistency
**Depends on:** Spec 2 (Daily Log + Tracking) — TrainingPlanTable is read-only after Spec 2. However, Spec 3 can be implemented independently: Issue 14 applies to the expand/collapse button regardless of Spec 2 status (workout detail expansion exists in both read-only and current state).
**Blocks:** Nothing

---

## 1. Problem Statement

The dashboard was built with responsive breakpoints (MUI Grid + `sx` props) but a thorough audit reveals gaps: touch targets below accessibility standards, tables that overflow on mobile, silent API failures, missing loading states, inconsistent component patterns, and accessibility issues. These affect daily usability, especially on mobile where the athlete will use the daily log page (Spec 2).

**Goal:** Fix 18 identified UI/UX issues across mobile touch targets, responsive components, consistency patterns, error/loading states, and accessibility — without changing features or data models.

## 2. Issue Registry

### Critical

| # | Issue | File | Line(s) |
|---|-------|------|---------|
| 1 | Hamburger touch target < 44px (MUI default 40px) | `AppShell.tsx` | 16-32 |
| 2 | Markdown tables overflow horizontally on mobile | `MarkdownRenderer.tsx` | 56-67 |

### Major

| # | Issue | File | Line(s) |
|---|-------|------|---------|
| 3 | xs padding only 12px, content cramped | `AppShell.tsx` | 40 |
| 4 | Stepper labels overflow on xs screens | `CheckInForm.tsx` | 566 |
| 5 | Slider labels overlap thumb on mobile | `CheckInForm.tsx` | 246-261 |
| 6 | Card padding inconsistent across components | Multiple | Various |
| 7 | Chart heights fixed at 250px, too tall on xs | `TrendCharts.tsx` | 69-92 |
| 8 | Sidebar nav not scrollable on small viewports | `Sidebar.tsx` | 140-177 |
| 9 | Caption text (0.75rem) illegible on mobile | Global (10+ components) | Various |
| 10 | No progress indicator during Garmin sync | `CheckInForm.tsx` | 141-143 |
| 11 | Empty states have no CTA buttons | `TrendCharts.tsx` | 54-62 |
| 12 | API failures silently swallowed, spinner forever | Multiple pages + `RaceCountdown.tsx` | Various |
| 13 | Number inputs accept invalid values (negative, >7) | `CheckInForm.tsx` | 310-337 |
| 14 | Expand/collapse button missing visible keyboard focus indicator | `TrainingPlanTable.tsx` | 250-260 |

### Moderate

| # | Issue | File | Line(s) |
|---|-------|------|---------|
| 15 | Breadcrumb styling inconsistent across pages | `plan/page.tsx`, `trends/page.tsx`, `profile/page.tsx` | Various |
| 16 | Stepper step indicator not accessible to screen readers | `CheckInForm.tsx` | 566-589 |
| 17 | No skeleton loaders — layout jumps on content load | `trends/page.tsx`, `profile/page.tsx`, `dexa/page.tsx` | Various |
| 18 | All accordion sections expanded on mobile — long scroll | `DashboardSection.tsx` | 22 |

### Deferred (not in scope)

- Icon sizing standardization (Minor)
- Race countdown real-time update (Minor)
- Code block overflow in markdown (Minor)
- Print styles (Minor)
- Form label boldness inconsistency (Minor)
- Focus indicators on all custom elements (Minor)
- Color-only status badges (Moderate — needs design decision)
- Hamburger visual distinction (Moderate — cosmetic)

## 3. Fix Groups

### Group A: Mobile Touch & Spacing (Issues 1, 3, 5, 9)

**Issue 1 — Hamburger touch target:**
```typescript
// AppShell.tsx — IconButton for hamburger menu
sx={{ minWidth: 48, minHeight: 48 }}
```

**Issue 3 — xs padding:**
```typescript
// AppShell.tsx — main content Box
p: { xs: 2, sm: 2, md: 2.5 }  // was xs: 1.5
```

**Issue 5 — Slider label spacing:**
```typescript
// CheckInForm.tsx — Typography labels above sliders
sx={{ mb: 1 }}  // add margin below label
// Slider thumb size increase for mobile
sx={{ '& .MuiSlider-thumb': { height: 28, width: 28 } }}
```

**Issue 9 — Caption font sizes (global theme override):**

Instead of per-component `sx` props, apply a global responsive override for the `caption` variant in `lib/theme.ts`:

```typescript
// In lib/theme.ts — typography overrides
caption: {
  fontSize: '0.75rem',
  fontWeight: 500,
  '@media (max-width:600px)': {
    fontSize: '0.8rem',
  },
},
```

This applies to all `variant="caption"` elements across the entire app — no individual component changes needed. Covers `SparklineCard`, `ComplianceSummary`, `TrainingPlanTable`, `RaceCountdown`, `PrioritiesList`, `PhaseTimeline`, `WorkoutDisplay`, `CheckInForm`, and any future components.

### Group B: Responsive Components (Issues 2, 4, 7, 18)

**Issue 2 — Markdown table overflow:**

Keep the existing `<TableContainer component={Paper} variant="outlined">` wrapper (preserves the styled border) and add `overflowX: 'auto'` to it. Add responsive font sizing to table cells:

```typescript
// MarkdownRenderer.tsx — table component override
table: ({ children }) => (
  <TableContainer
    component={Paper}
    variant="outlined"
    sx={{ overflowX: 'auto', mb: 2 }}
  >
    <Table size="small" sx={{ '& td, & th': { fontSize: { xs: '0.65rem', sm: '0.75rem' } } }}>
      {children}
    </Table>
  </TableContainer>
)
```

**Issue 4 — Stepper labels on mobile:**

Abbreviated labels on xs screens, full labels on sm+:
```typescript
const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
const STEP_LABELS = isSmall
  ? ['Garmin', 'Hevy', 'Survey', 'Review']
  : ['Garmin Data', 'Hevy Training Log', 'Survey', 'Review & Submit'];
```

**Issue 7 — Responsive chart heights:**
```typescript
// TrendCharts.tsx — all LineChart, BarChart, ScatterChart
const isXs = useMediaQuery(theme.breakpoints.down('sm'));
const isSm = useMediaQuery(theme.breakpoints.between('sm', 'md'));
const chartHeight = isXs ? 200 : isSm ? 250 : 300;

<LineChart height={chartHeight} ... />
```
Applied to all chart instances in the component.

**Issue 18 — Accordion collapse on mobile:**
```typescript
// DashboardSection.tsx
const isXs = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
<Accordion defaultExpanded={!isXs} ...>
```
On mobile, sections start collapsed — user taps to expand. On desktop, all expanded as before.

Note: `noSsr: true` prevents hydration mismatch. On the server, `useMediaQuery` returns `false` by default, which would cause all accordions to render collapsed and then re-expand on desktop after hydration. Since this is a single-user dashboard, the `noSsr` trade-off (no SSR for this component) is acceptable.

### Group C: Consistency & Patterns (Issues 6, 15)

**Issue 6 — Card padding constant:**

Add to `lib/theme.ts`:
```typescript
export const cardContentSx = {
  pb: '12px !important',
  pt: 1.5,
  px: { xs: 1.5, sm: 2 },
};
```

Import and apply in all components that actually use `<CardContent>`:
- `TrainingPlanTable.tsx`
- `CheckInForm.tsx`
- `SparklineCard.tsx`
- `TrendCharts.tsx`
- `AgentBriefing.tsx`
- `RaceCountdown.tsx`
- Any page-level files that create `<Card>/<CardContent>` directly (e.g., `races/page.tsx`)

Note: `ComplianceSummary.tsx` and `RecoverySummary.tsx` do NOT use `<CardContent>` — they are child components rendered inside cards owned by parent pages. Do not add the constant to these files.

**Issue 15 — Reusable breadcrumb component:**

New file `components/PageBreadcrumb.tsx`:
```typescript
interface PageBreadcrumbProps {
  items: Array<{ label: string; href?: string }>;
}
```
- Renders MUI `<Breadcrumbs>` with consistent styling
- Last item is current page (no link, `color="text.primary"`)
- Previous items are `<Link>` with `color="text.secondary"` and underline on hover
- Used by: `plan/page.tsx`, `plan/[weekNumber]/page.tsx`, `trends/page.tsx`, `profile/page.tsx`, `dexa/page.tsx`, `races/page.tsx`, `archive/page.tsx`, `archive/[weekNumber]/page.tsx`
- Note: `archive/page.tsx` and `archive/[weekNumber]/page.tsx` currently have no breadcrumbs — these are new additions, not replacements

### Group D: Error & Loading States (Issues 10, 11, 12, 13, 17)

**Issue 12 — API error handling pattern:**

Replace all `.catch(() => {})` and empty `catch {}` blocks with proper error state. Standard pattern for all pages:

```typescript
const [error, setError] = useState<string | null>(null);

// In fetch calls
.catch((err) => setError(err.message || 'Failed to load data'));

// In render
{error && (
  <Alert
    severity="error"
    action={<Button onClick={() => { setError(null); loadData(); }}>Retry</Button>}
  >
    {error}
  </Alert>
)}
```

Apply to all pages and components with `.catch(() => {})`:
- `app/page.tsx`
- `app/trends/page.tsx`
- `app/profile/page.tsx`
- `app/dexa/page.tsx`
- `app/races/page.tsx`
- `app/plan/page.tsx`
- `app/plan/[weekNumber]/page.tsx`
- `app/archive/page.tsx`
- `app/archive/[weekNumber]/page.tsx`

For `components/RaceCountdown.tsx` (sidebar component), use a simpler inline fallback instead of the full Alert pattern — show a muted "Race data unavailable" text if the fetch fails, since it's not a full page.

**Issue 11 — Empty state CTAs:**
```typescript
// TrendCharts.tsx — when no metrics
<Box sx={{ textAlign: 'center', py: 4 }}>
  <Typography>No trend data yet.</Typography>
  <Button variant="contained" href="/checkin" sx={{ mt: 2 }}>
    Start Check-In
  </Button>
</Box>
```
Similar CTAs for other empty states: DEXA page ("Add DEXA Scan"), Races page ("Add Race").

**Issue 13 — Form validation:**

Add to number inputs in `CheckInForm.tsx` using MUI 7's `slotProps` API (note: `inputProps` is deprecated in MUI 7):
```typescript
slotProps={{ htmlInput: { min: 0, max: 7 } }}
```
On form submission, validate all numeric fields are within expected ranges. Show inline error text via `error` and `helperText` props if invalid.

**Issue 10 — Garmin sync progress:**

Keep the indeterminate `LinearProgress` (sync duration varies with network/Garmin API) but add elapsed time display:
```typescript
<Typography variant="body2" aria-live="polite">
  Syncing Garmin data... ({elapsedSeconds}s elapsed)
</Typography>
<LinearProgress />
```
Uses a `useEffect` interval counting up from 0. Do NOT use a determinate countdown — sync duration is unpredictable (5-45 seconds).

**Issue 17 — Skeleton loaders:**

New file `components/PageSkeleton.tsx` with a single generic skeleton component:
```typescript
interface PageSkeletonProps {
  variant: 'charts' | 'cards' | 'profile';
}
```
- `charts`: 2x2 grid of `<Skeleton variant="rectangular" height={250} />` cards
- `cards`: 3-column grid of card-shaped skeletons
- `profile`: text block skeletons matching profile layout

Used in: `trends/page.tsx`, `profile/page.tsx`, `dexa/page.tsx` — replaces `<CircularProgress>`.

Note: A `form` variant was considered but deferred — the check-in form only loads on laptop and the brief loading state is acceptable with `CircularProgress`.

### Group E: Accessibility (Issues 8, 14, 16)

**Issue 8 — Sidebar scrollable:**
```typescript
// Sidebar.tsx — split drawer content
<Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
  <List sx={{ overflowY: 'auto', flex: 1 }}>
    {/* nav items */}
  </List>
  <Box sx={{ mt: 'auto', p: 2 }}>
    <RaceCountdown />
  </Box>
</Box>
```

**Issue 14 — Expand/collapse visible focus indicator:**

The existing `TrainingPlanTable.tsx` already has correct `aria-label` and `aria-expanded` attributes on the expand/collapse `IconButton`. The only missing piece is a visible focus ring for keyboard users:
```typescript
// TrainingPlanTable.tsx — expand/collapse IconButton
sx={{
  '&:focus-visible': {
    outline: '2px solid',
    outlineColor: 'primary.main',
    outlineOffset: 2,
  },
}}
```
Also remove any `role="button"` from non-button Typography elements if present.

**Issue 16 — Stepper accessibility:**
MUI Stepper handles `aria-current` automatically when using `activeStep` prop. Verify this works correctly at implementation time. If not, manually add:
```typescript
<StepLabel
  StepIconProps={{ 'aria-current': activeStep === index ? 'step' : undefined }}
>
```

## 4. Files Changed / Created

### New Files

| File | Purpose |
|------|---------|
| `components/PageBreadcrumb.tsx` | Reusable breadcrumb with consistent styling |
| `components/PageSkeleton.tsx` | Skeleton loader variants (charts, cards, profile) |

### Modified Files

| File | Changes |
|------|---------|
| `components/AppShell.tsx` | Hamburger 48px touch target, xs padding 16px |
| `components/MarkdownRenderer.tsx` | TableContainer overflow, responsive cell font |
| `components/CheckInForm.tsx` | Stepper mobile labels, slider spacing, form validation (slotProps), Garmin sync elapsed timer, step aria |
| `components/TrendCharts.tsx` | Responsive chart heights, empty state CTAs |
| `components/TrainingPlanTable.tsx` | Focus-visible indicator on expand/collapse button |
| `components/AgentBriefing.tsx` | Card padding standardization |
| `components/RaceCountdown.tsx` | Card padding standardization, inline error fallback |
| `components/SparklineCard.tsx` | Card padding standardization |
| `components/Sidebar.tsx` | Scrollable nav list with flex layout |
| `components/DashboardSection.tsx` | Collapsed on mobile via useMediaQuery (noSsr) |
| `lib/theme.ts` | Add `cardContentSx` constant, global caption responsive font override |
| `app/page.tsx` | Error state + retry, skeleton loader |
| `app/trends/page.tsx` | Error state + retry, skeleton loader, empty state CTA, breadcrumb |
| `app/profile/page.tsx` | Error state + retry, skeleton loader, breadcrumb |
| `app/dexa/page.tsx` | Error state + retry, skeleton loader, empty state CTA, breadcrumb |
| `app/races/page.tsx` | Error state + retry, empty state CTA, breadcrumb |
| `app/plan/page.tsx` | Error state + retry, breadcrumb |
| `app/plan/[weekNumber]/page.tsx` | Error state + retry, breadcrumb |
| `app/archive/page.tsx` | Error state + retry, breadcrumb (new) |
| `app/archive/[weekNumber]/page.tsx` | Error state + retry, breadcrumb (new) |

### Not Changed

- No API routes modified
- No data model changes
- No new pages (only new reusable components)
- No deployment changes

## 5. Scope Boundaries

**In scope:**
- 18 UI/UX fixes (2 Critical, 12 Major, 4 Moderate)
- Mobile touch target compliance (48px minimum)
- Responsive table, chart, and stepper components
- Consistent card padding via shared constant
- Global caption font responsive override via theme
- Reusable breadcrumb component
- Error states with retry on all pages (including archive pages and RaceCountdown)
- Skeleton loaders for data-heavy pages
- Empty state CTAs
- Form input validation (MUI 7 slotProps API)
- Garmin sync elapsed time indicator
- Sidebar scroll on small viewports
- Accordion collapse on mobile (with noSsr hydration handling)
- Keyboard focus indicator on interactive elements
- Stepper screen reader support

**Out of scope (deferred):**
- Icon sizing standardization
- Race countdown real-time update
- Code block overflow in markdown
- Print styles
- Form label boldness consistency
- Focus indicators on all custom elements
- Color-only status badges
- Hamburger visual distinction

## 6. Verification Criteria

Spec 3 is complete when:

1. Hamburger button renders at 48x48px minimum on all breakpoints
2. Markdown tables scroll horizontally on 320px viewport without page overflow
3. All `<CardContent>` components (TrainingPlanTable, CheckInForm, SparklineCard, TrendCharts, AgentBriefing, RaceCountdown) use the shared `cardContentSx` constant
4. Charts render at 200px height on xs, 250px on sm, 300px on md+
5. Stepper labels are abbreviated and readable on xs screens
6. Sidebar nav is scrollable when items exceed viewport height
7. Dashboard sections start collapsed on xs, expanded on md+ (no hydration flash on desktop)
8. Every page with API calls shows an error alert with retry button on failure (test by blocking network) — including archive pages and plan/[weekNumber]
9. RaceCountdown shows inline "Race data unavailable" fallback on fetch failure
10. Trends, profile, and DEXA pages show skeleton loaders during fetch
11. Empty states on trends, DEXA, and races pages have actionable CTA buttons
12. Number inputs in check-in form use `slotProps.htmlInput` with min/max and reject invalid values
13. Garmin sync shows elapsed seconds counter (not a fixed countdown)
14. All sub-pages use the shared `PageBreadcrumb` component with consistent styling (including archive pages)
15. Expand/collapse button has visible focus ring on keyboard focus
16. Stepper has correct `aria-current` on active step
17. Slider labels have adequate spacing from thumb on mobile (no overlap)
18. Caption text is globally responsive via theme override (0.8rem on xs, 0.75rem on sm+)
19. No horizontal scroll on any page at 320px viewport width
