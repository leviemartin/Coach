# UI/UX Audit + Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 18 mobile and desktop UI/UX issues: touch targets, responsive components, error/loading states, accessibility, and consistency patterns — without changing features or data models.

**Architecture:** All changes are component-level `sx` prop updates, new reusable components (breadcrumb, skeleton), global theme overrides, and standardized error handling patterns across pages.

**Tech Stack:** Next.js 16, React 19, MUI 7, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-20-ui-ux-audit-design.md`

---

## File Structure

### New Files
```
dashboard/
  components/PageBreadcrumb.tsx         # Reusable breadcrumb with consistent styling
  components/PageSkeleton.tsx           # Skeleton loader variants (charts, cards, profile)
```

### Modified Files
```
dashboard/
  lib/theme.ts                          # cardContentSx constant, global caption responsive override
  components/AppShell.tsx               # Hamburger 48px touch target, xs padding
  components/MarkdownRenderer.tsx       # Table overflow, responsive cell font
  components/CheckInForm.tsx            # Stepper labels, slider spacing, validation, sync timer, aria
  components/TrendCharts.tsx            # Responsive chart heights, empty state CTAs
  components/TrainingPlanTable.tsx      # Focus indicator on expand/collapse
  components/AgentBriefing.tsx          # Card padding standardization
  components/RaceCountdown.tsx          # Card padding, inline error fallback
  components/SparklineCard.tsx          # Card padding standardization
  components/Sidebar.tsx                # Scrollable nav list
  components/DashboardSection.tsx       # Collapsed on mobile
  app/page.tsx                          # Error state + retry
  app/trends/page.tsx                   # Error state + retry, skeleton, empty CTA, breadcrumb
  app/profile/page.tsx                  # Error state + retry, skeleton, breadcrumb
  app/dexa/page.tsx                     # Error state + retry, skeleton, empty CTA, breadcrumb
  app/races/page.tsx                    # Error state + retry, empty CTA, breadcrumb
  app/plan/page.tsx                     # Error state + retry, breadcrumb
  app/plan/[weekNumber]/page.tsx        # Error state + retry, breadcrumb
  app/archive/page.tsx                  # Error state + retry, breadcrumb
  app/archive/[weekNumber]/page.tsx     # Error state + retry, breadcrumb
```

---

### Task 1: Theme — Card Padding + Caption Override

**Files:**
- Modify: `dashboard/lib/theme.ts`

- [ ] **Step 1: Read the current theme.ts**

Read `dashboard/lib/theme.ts` in full.

- [ ] **Step 2: Add cardContentSx constant**

Add at module level (exported):

```typescript
export const cardContentSx = {
  pb: '12px !important',
  pt: 1.5,
  px: { xs: 1.5, sm: 2 },
};
```

- [ ] **Step 3: Add global caption responsive override**

In the theme's typography overrides (inside the theme options or `createTheme` call), add:

```typescript
caption: {
  fontSize: '0.75rem',
  fontWeight: 500,
  '@media (max-width:600px)': {
    fontSize: '0.8rem',
  },
},
```

The exact location depends on the current theme structure — read the file first to find where typography variants are configured.

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/theme.ts
git commit -m "feat: add cardContentSx constant and global responsive caption font"
```

---

### Task 2: Reusable Components — Breadcrumb + Skeleton

**Files:**
- Create: `dashboard/components/PageBreadcrumb.tsx`
- Create: `dashboard/components/PageSkeleton.tsx`

- [ ] **Step 1: Create PageBreadcrumb**

Create `dashboard/components/PageBreadcrumb.tsx`:

```typescript
import { Breadcrumbs, Typography } from '@mui/material';
import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageBreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function PageBreadcrumb({ items }: PageBreadcrumbProps) {
  return (
    <Breadcrumbs sx={{ mb: 2 }}>
      {items.map((item, i) =>
        i < items.length - 1 && item.href ? (
          <Link
            key={item.label}
            href={item.href}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ '&:hover': { textDecoration: 'underline' } }}
            >
              {item.label}
            </Typography>
          </Link>
        ) : (
          <Typography key={item.label} variant="body2" color="text.primary">
            {item.label}
          </Typography>
        )
      )}
    </Breadcrumbs>
  );
}
```

- [ ] **Step 2: Create PageSkeleton**

Create `dashboard/components/PageSkeleton.tsx`:

```typescript
import { Box, Skeleton, Grid } from '@mui/material';

interface PageSkeletonProps {
  variant: 'charts' | 'cards' | 'profile';
}

export default function PageSkeleton({ variant }: PageSkeletonProps) {
  if (variant === 'charts') {
    return (
      <Grid container spacing={2}>
        {[1, 2, 3, 4].map(i => (
          <Grid key={i} size={{ xs: 12, md: 6 }}>
            <Skeleton variant="rectangular" height={250} sx={{ borderRadius: 1 }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (variant === 'cards') {
    return (
      <Grid container spacing={2}>
        {[1, 2, 3].map(i => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
            <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 1 }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  // profile
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
      <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
      <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 1 }} />
    </Box>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/PageBreadcrumb.tsx dashboard/components/PageSkeleton.tsx
git commit -m "feat: add reusable PageBreadcrumb and PageSkeleton components"
```

---

### Task 3: Mobile Touch & Spacing Fixes

**Files:**
- Modify: `dashboard/components/AppShell.tsx`
- Modify: `dashboard/components/CheckInForm.tsx`

- [ ] **Step 1: Fix hamburger touch target and xs padding**

Read `dashboard/components/AppShell.tsx`. Then:

Find the hamburger `IconButton` and add:
```typescript
sx={{ minWidth: 48, minHeight: 48 }}
```

Find the main content `Box` and change padding from `xs: 1.5` to `xs: 2`:
```typescript
p: { xs: 2, sm: 2, md: 2.5 }
```

- [ ] **Step 2: Fix slider label spacing and stepper labels**

Read `dashboard/components/CheckInForm.tsx` in full. Then:

**Slider labels:** Add `sx={{ mb: 1 }}` to all Typography labels that appear above Slider components. Add to the Slider components:
```typescript
sx={{ '& .MuiSlider-thumb': { height: 28, width: 28 } }}
```

**Stepper labels:** Add responsive labels. At the top of the component:
```typescript
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

// Inside component:
const theme = useTheme();
const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
const stepLabels = isSmall
  ? ['Garmin', 'Hevy', 'Survey', 'Review']
  : STEPS; // Keep the existing STEPS constant for full labels
```

Replace the `STEPS` references in the Stepper `<StepLabel>` rendering with `stepLabels[index]`.

**Form validation:** Find number inputs for sessions completed/planned. Change from `inputProps` to:
```typescript
slotProps={{ htmlInput: { min: 0, max: 7 } }}
```

Also migrate the Plan Feedback TextField (line ~408) from `inputProps={{ maxLength: 1000 }}` to:
```typescript
slotProps={{ htmlInput: { maxLength: 1000 } }}
```

**Garmin sync timer:** Find the sync progress indicator. Replace or augment with elapsed time:
```typescript
const [syncElapsed, setSyncElapsed] = useState(0);
// In sync useEffect:
const timer = setInterval(() => setSyncElapsed(s => s + 1), 1000);
// Clear on sync complete

<Typography variant="body2" aria-live="polite">
  Syncing Garmin data... ({syncElapsed}s elapsed)
</Typography>
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/AppShell.tsx dashboard/components/CheckInForm.tsx
git commit -m "fix: mobile touch targets, slider spacing, stepper labels, form validation"
```

---

### Task 4: Responsive Components

**Files:**
- Modify: `dashboard/components/MarkdownRenderer.tsx`
- Modify: `dashboard/components/TrendCharts.tsx`
- Modify: `dashboard/components/DashboardSection.tsx`

- [ ] **Step 1: Fix markdown table overflow**

Read `dashboard/components/MarkdownRenderer.tsx`. Find the table component override. Add `overflowX: 'auto'` to the TableContainer and responsive font to cells:

```typescript
// Keep existing TableContainer/Paper, add overflowX
<TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto', mb: 2 }}>
  <Table size="small" sx={{ '& td, & th': { fontSize: { xs: '0.65rem', sm: '0.75rem' } } }}>
    {children}
  </Table>
</TableContainer>
```

- [ ] **Step 2: Fix chart heights**

Read `dashboard/components/TrendCharts.tsx`. Add responsive heights to all chart components:

```typescript
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

// Inside component:
const theme = useTheme();
const isXs = useMediaQuery(theme.breakpoints.down('sm'));
const isSm = useMediaQuery(theme.breakpoints.between('sm', 'md'));
const chartHeight = isXs ? 200 : isSm ? 250 : 300;
```

Replace `height={250}` on standalone charts (Weight, Sleep/Readiness, Pull-ups, Strength Ceilings, Protocol Compliance, Nutrition, DEXA scatter) with `height={chartHeight}`.

**Exception:** The Body Composition section has two stacked charts with intentionally smaller heights (`height={200}` and `height={150}`). Scale these proportionally:
- `height={200}` -> `isXs ? 160 : isSm ? 200 : 200`
- `height={150}` -> `isXs ? 120 : isSm ? 150 : 150`

Also add empty state CTA when no data:
```typescript
{metrics.length === 0 ? (
  <Box sx={{ textAlign: 'center', py: 4 }}>
    <Typography color="text.secondary">No trend data yet.</Typography>
    <Button variant="contained" href="/checkin" sx={{ mt: 2 }}>Start Check-In</Button>
  </Box>
) : (
  /* existing chart rendering */
)}
```

- [ ] **Step 3: Fix accordion collapse on mobile**

Read `dashboard/components/DashboardSection.tsx`. Add:

```typescript
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

// Inside component:
const theme = useTheme();
const isXs = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
```

Change `defaultExpanded={true}` (or equivalent) to `defaultExpanded={!isXs}`.

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/MarkdownRenderer.tsx dashboard/components/TrendCharts.tsx dashboard/components/DashboardSection.tsx
git commit -m "fix: responsive tables, charts, accordion collapse on mobile"
```

---

### Task 5: Card Padding Standardization

**Files:**
- Modify: `dashboard/components/TrainingPlanTable.tsx`
- Modify: `dashboard/components/SparklineCard.tsx`
- Modify: `dashboard/components/AgentBriefing.tsx`
- Modify: `dashboard/components/RaceCountdown.tsx`
- Modify: `dashboard/components/TrendCharts.tsx` (if not done in Task 4)
- Modify: `dashboard/components/CheckInForm.tsx` (if has CardContent)

- [ ] **Step 1: Apply cardContentSx to CardContent components (per-component guidance)**

Read each file listed above. Import the shared constant:

```typescript
import { cardContentSx } from '@/lib/theme';
```

**Per-component application:**

- **AgentBriefing.tsx**: Apply `cardContentSx` directly — no conflicts expected.
- **TrendCharts.tsx**: Apply `cardContentSx` to chart cards. Check for existing `sx` and merge with `cardContentSx` first (spread order: `{ ...cardContentSx, ...existing }`).
- **CheckInForm.tsx**: Apply where `<CardContent>` is used. Merge with any existing sx.
- **TrainingPlanTable.tsx**: Apply. The existing `sx={{ pb: '12px !important', pt: 1.5 }}` is a subset of `cardContentSx` — replace with the constant.
- **SparklineCard.tsx**: This component has extra layout styles (`flex: 1, display: 'flex', flexDirection: 'column'`). Merge: `sx={{ ...cardContentSx, flex: 1, display: 'flex', flexDirection: 'column' }}`.
- **RaceCountdown.tsx**: **SKIP** — this component uses compact `p: 1.5` intentionally for its sidebar context. Do not apply `cardContentSx`.

- [ ] **Step 2: Add focus-visible indicator and clean up accessibility on TrainingPlanTable**

In `TrainingPlanTable.tsx`, add focus ring to the expand/collapse `IconButton`:
```typescript
<IconButton
  sx={{
    '&:focus-visible': {
      outline: '2px solid',
      outlineColor: 'primary.main',
      outlineOffset: 2,
    },
  }}
>
```

Also find and remove `role="button"` and `tabIndex={0}` from any Typography element (e.g., the coach cues preview text ~line 284). The adjacent IconButton already provides the interactive target — the Typography should not duplicate it.

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/TrainingPlanTable.tsx dashboard/components/SparklineCard.tsx \
  dashboard/components/AgentBriefing.tsx dashboard/components/RaceCountdown.tsx \
  dashboard/components/TrendCharts.tsx dashboard/components/CheckInForm.tsx
git commit -m "fix: standardize card padding, add focus indicator to expand button"
```

---

### Task 6: Sidebar Scrollable + Stepper Accessibility

**Files:**
- Modify: `dashboard/components/Sidebar.tsx`

- [ ] **Step 1: Make sidebar scrollable**

Read `dashboard/components/Sidebar.tsx`. Wrap the drawer content in a flex column:

```typescript
<Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
  <List sx={{ overflowY: 'auto', flex: 1 }}>
    {/* existing nav items */}
  </List>
  <Box sx={{ mt: 'auto', p: 2 }}>
    <RaceCountdown />
  </Box>
</Box>
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/Sidebar.tsx
git commit -m "fix: make sidebar nav scrollable on small viewports"
```

---

### Task 7: Error States + Skeleton Loaders on All Pages

**Files:**
- Modify: `dashboard/app/page.tsx`
- Modify: `dashboard/app/trends/page.tsx`
- Modify: `dashboard/app/profile/page.tsx`
- Modify: `dashboard/app/dexa/page.tsx`
- Modify: `dashboard/app/races/page.tsx`
- Modify: `dashboard/app/plan/page.tsx`
- Modify: `dashboard/app/plan/[weekNumber]/page.tsx`
- Modify: `dashboard/app/archive/page.tsx`
- Modify: `dashboard/app/archive/[weekNumber]/page.tsx`
- Modify: `dashboard/components/RaceCountdown.tsx`

- [ ] **Step 1: Add error handling pattern to each page**

For each page file listed above, read it first, then:

1. Add error state: `const [error, setError] = useState<string | null>(null);`
2. Replace `.catch(() => {})` and empty `catch {}` blocks with `.catch((err) => setError(err.message || 'Failed to load data'))`
3. Add error UI:

```typescript
import { Alert, Button } from '@mui/material';

{error && (
  <Alert
    severity="error"
    action={<Button onClick={() => { setError(null); loadData(); }}>Retry</Button>}
    sx={{ mb: 2 }}
  >
    {error}
  </Alert>
)}
```

Where `loadData()` is the function that fetches data (may need to extract fetch logic into a named function if it's inline).

- [ ] **Step 2: Add skeleton loaders to data-heavy pages**

For `trends/page.tsx`, `profile/page.tsx`, `dexa/page.tsx`:

Replace `<CircularProgress>` loading state with:

```typescript
import PageSkeleton from '@/components/PageSkeleton';

{loading && !error && <PageSkeleton variant="charts" />}  // trends
{loading && !error && <PageSkeleton variant="profile" />}  // profile
{loading && !error && <PageSkeleton variant="cards" />}    // dexa
```

- [ ] **Step 3: Add breadcrumbs to all sub-pages**

For each page that's not the dashboard root, add:

```typescript
import PageBreadcrumb from '@/components/PageBreadcrumb';

// At the top of the page content:
<PageBreadcrumb items={[
  { label: 'Dashboard', href: '/' },
  { label: 'Page Name' },
]} />
```

Pages and their breadcrumbs:
- `trends/page.tsx`: Dashboard > Trends
- `profile/page.tsx`: Dashboard > Profile
- `dexa/page.tsx`: Dashboard > DEXA Scans
- `races/page.tsx`: Dashboard > Races
- `plan/page.tsx`: Dashboard > Training Plan
- `plan/[weekNumber]/page.tsx`: Dashboard > Training Plan > Week N
- `archive/page.tsx`: Dashboard > Archive
- `archive/[weekNumber]/page.tsx`: Dashboard > Archive > Week N

- [ ] **Step 4: Add empty state CTAs**

For pages with empty data states:
- `dexa/page.tsx`: "No DEXA scans yet." + Button "Add DEXA Scan"
- `races/page.tsx`: "No races added yet." + Button "Add Race"

Note: TrendCharts empty state CTA is already handled in Task 4 Step 2 — do not duplicate here.

- [ ] **Step 5: Add inline fallback to RaceCountdown**

Read `dashboard/components/RaceCountdown.tsx`. Replace the `.catch(() => {})` with:

```typescript
.catch(() => setError(true));

// In render:
{error ? (
  <Typography variant="caption" color="text.secondary">Race data unavailable</Typography>
) : (
  /* existing countdown rendering */
)}
```

- [ ] **Step 6: Verify build**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npm run build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add dashboard/app/ dashboard/components/RaceCountdown.tsx
git commit -m "fix: add error states, skeleton loaders, breadcrumbs, empty CTAs to all pages"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run all verification criteria from the spec**

Per spec Section 6:
1. Hamburger button renders at 48x48px minimum
2. Markdown tables scroll horizontally on 320px viewport
3. All CardContent components use shared cardContentSx
4. Charts render at 200/250/300px by breakpoint
5. Stepper labels abbreviated on xs
6. Sidebar scrollable when items exceed viewport
7. Dashboard sections collapsed on xs, expanded on md+ (no hydration flash)
8. Every page shows error alert with retry on API failure
9. RaceCountdown shows inline fallback on failure
10. Skeleton loaders on trends, profile, DEXA pages
11. Empty state CTAs on trends, DEXA, races
12. Number inputs use slotProps with min/max
13. Garmin sync shows elapsed seconds
14. All sub-pages use PageBreadcrumb
15. Expand/collapse has visible focus ring
16. Stepper has correct aria-current
17. Slider labels have spacing from thumb
18. Caption text globally responsive via theme
19. No horizontal scroll on any page at 320px

- [ ] **Step 2: Verify no silent error swallows remain**

```bash
grep -rn "catch(() => {})\|catch {}" dashboard/app/ dashboard/components/ --include="*.ts" --include="*.tsx"
```
Expected: No matches (all have been replaced with error handling).

- [ ] **Step 3: Commit any final fixes**
