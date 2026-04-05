# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the new `coaching-platform` repo with multi-tenant PostgreSQL on Supabase, auth (Google OAuth + magic link + MFA), Brutalist design system with palette picker, Terra API skeleton, AI service layer with model tier routing, email skeleton, and an app shell with invite-only signup and admin route group.

**Architecture:** Next.js 16 App Router with React 19 and MUI 7. Supabase handles PostgreSQL (with RLS for tenant isolation) and Auth (Google OAuth primary, magic link secondary, TOTP MFA). Railway deploys the Docker container. The AI service layer wraps the Anthropic SDK with model tier routing. Terra API skeleton receives webhooks and normalizes wearable data. Email service uses Resend for transactional emails.

**Tech Stack:** Next.js 16, React 19, MUI 7, TypeScript 5, Supabase (PostgreSQL + Auth), @anthropic-ai/sdk, Resend, Docker, Railway

**Spec Reference:** `docs/design/2026-04-05-multi-user-coaching-platform-design.md`

**Design Mockups:** `docs/design/mockups/` (dashboard-layout.html, trends-layout.html, program-timeline.html)

---

## File Structure

```
coaching-platform/
├── .env.local.example          # Environment variable template
├── .gitignore
├── Dockerfile
├── README.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── middleware.ts                # Auth middleware — validates Supabase session, injects athlete_id
├── vitest.config.ts
├── supabase/
│   └── migrations/
│       ├── 001_athletes.sql        # athletes, athlete_profiles tables + RLS
│       ├── 002_journeys.sql        # journeys, coaching_teams tables + RLS
│       ├── 003_daily_tracking.sql  # daily_logs, daily_notes tables + RLS
│       ├── 004_sessions.sql        # session_logs, session_sets, session_cardio + RLS
│       ├── 005_plans.sql           # plan_items, ceiling_history + RLS
│       ├── 006_metrics.sql         # weekly_metrics, strategic_reviews + RLS
│       ├── 007_wearables.sql       # wearable_connections, wearable_data_daily, wearable_data_activities, nutrition_data_daily + RLS
│       ├── 008_system.sql          # invite_codes, consent_records, notification_preferences, dexa_scans + RLS
│       └── 009_admin.sql           # admin role, admin-specific policies
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client (anon key)
│   │   ├── server.ts               # Server Supabase client (service role for admin)
│   │   ├── middleware.ts            # Supabase auth helpers for middleware
│   │   └── types.ts                # Generated DB types (from supabase gen types)
│   ├── ai/
│   │   ├── client.ts               # Anthropic SDK wrapper
│   │   ├── model-router.ts         # Model tier routing logic (Opus/Sonnet/Haiku)
│   │   ├── escalation.ts           # Dynamic escalation rules
│   │   └── types.ts                # AI service types (ModelTier, CoachingMoment, etc.)
│   ├── terra/
│   │   ├── client.ts               # Terra API client
│   │   ├── normalize.ts            # Data normalization (Terra → internal schema)
│   │   ├── types.ts                # Terra data types + normalized internal types
│   │   └── connectors/
│   │       └── garmin-nutrition.ts  # Custom Garmin nutrition connector (plugin #1)
│   ├── email/
│   │   ├── client.ts               # Resend client wrapper
│   │   ├── templates.ts            # Email template definitions
│   │   └── types.ts                # Notification types and preferences
│   ├── theme/
│   │   ├── palettes.ts             # 4-5 curated color palettes
│   │   ├── theme.ts                # MUI theme builder from palette
│   │   ├── design-tokens.ts        # Shared design tokens (borders, spacing, typography)
│   │   └── types.ts                # Palette and theme types
│   ├── auth/
│   │   ├── invite.ts               # Invite code validation and management
│   │   └── types.ts                # Auth-related types
│   └── constants.ts                # App-wide constants
├── app/
│   ├── layout.tsx                  # Root layout with Providers
│   ├── page.tsx                    # Landing/redirect (authenticated → dashboard, else → login)
│   ├── globals.css                 # Global styles
│   ├── auth/
│   │   ├── login/page.tsx          # Login page (Google OAuth + magic link)
│   │   ├── signup/page.tsx         # Invite-only signup page
│   │   ├── callback/route.ts       # OAuth callback handler
│   │   └── error/page.tsx          # Auth error page
│   ├── dashboard/page.tsx          # Dashboard shell (placeholder for Phase 4)
│   ├── api/
│   │   ├── auth/
│   │   │   └── callback/route.ts   # Supabase auth callback
│   │   ├── invite/
│   │   │   ├── validate/route.ts   # Validate invite code
│   │   │   └── route.ts            # Create invite (admin only)
│   │   ├── terra/
│   │   │   └── webhook/route.ts    # Terra webhook receiver
│   │   ├── athlete/
│   │   │   ├── export/route.ts     # GDPR data export
│   │   │   └── delete/route.ts     # GDPR data deletion
│   │   └── admin/
│   │       ├── athletes/route.ts   # List all athletes (admin only)
│   │       ├── invites/route.ts    # Manage invites (admin only)
│   │       └── health/route.ts     # System health (admin only)
│   ├── admin/
│   │   ├── layout.tsx              # Admin layout (404 for non-admin)
│   │   └── page.tsx                # Admin dashboard shell
│   └── settings/
│       └── page.tsx                # Settings shell (theme picker works in Phase 1)
├── components/
│   ├── Providers.tsx               # Theme + Supabase + context providers
│   ├── AppShell.tsx                # Sidebar nav + mobile bottom nav
│   ├── ThemeRegistry.tsx           # MUI + Emotion SSR cache
│   └── PalettePicker.tsx           # Theme palette selector
└── __tests__/
    ├── lib/
    │   ├── ai/model-router.test.ts
    │   ├── ai/escalation.test.ts
    │   ├── terra/normalize.test.ts
    │   ├── email/client.test.ts
    │   ├── theme/palettes.test.ts
    │   └── auth/invite.test.ts
    └── api/
        ├── invite.test.ts
        └── terra-webhook.test.ts
```

---

## Task 1: Repository Setup

**Files:**
- Create: `coaching-platform/package.json`
- Create: `coaching-platform/tsconfig.json`
- Create: `coaching-platform/next.config.ts`
- Create: `coaching-platform/vitest.config.ts`
- Create: `coaching-platform/.gitignore`
- Create: `coaching-platform/.env.local.example`

- [ ] **Step 1: Create repo and initialize Next.js**

```bash
cd /Users/martinlevie/AI
mkdir coaching-platform && cd coaching-platform
git init
npx create-next-app@latest . --typescript --eslint --app --src-dir=false --import-alias="@/*" --turbopack --yes
```

- [ ] **Step 2: Install core dependencies**

```bash
npm install @mui/material @mui/icons-material @emotion/react @emotion/styled @fontsource-variable/inter @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk resend
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom @types/node
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
});
```

- [ ] **Step 4: Create .env.local.example**

Create `.env.local.example`:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Auth
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Anthropic
ANTHROPIC_API_KEY=your-anthropic-key

# Terra
TERRA_API_KEY=your-terra-key
TERRA_DEV_ID=your-terra-dev-id
TERRA_SIGNING_SECRET=your-terra-signing-secret

# Resend
RESEND_API_KEY=your-resend-key
RESEND_FROM_EMAIL=coach@yourdomain.com

# Admin
ADMIN_EMAIL=martin@youremail.com
```

- [ ] **Step 5: Update .gitignore**

Append to `.gitignore`:
```
# Supabase
supabase/.temp/

# Environment
.env.local
.env.production

# Superpowers
.superpowers/
```

- [ ] **Step 6: Verify setup**

```bash
npm run dev
# Expected: Next.js dev server starts on localhost:3000
# Ctrl+C to stop
npm run build
# Expected: Build succeeds
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: initialize coaching-platform repo with Next.js 16, MUI 7, Supabase, Vitest"
```

---

## Task 2: Supabase Project Setup

**Files:**
- Create: `supabase/migrations/001_athletes.sql`
- Create: `supabase/migrations/002_journeys.sql`
- Create: `supabase/migrations/003_daily_tracking.sql`
- Create: `supabase/migrations/004_sessions.sql`
- Create: `supabase/migrations/005_plans.sql`
- Create: `supabase/migrations/006_metrics.sql`
- Create: `supabase/migrations/007_wearables.sql`
- Create: `supabase/migrations/008_system.sql`
- Create: `supabase/migrations/009_admin.sql`

> **Prerequisites:** Create a Supabase project at https://supabase.com/dashboard. Enable Google OAuth provider in Authentication > Providers. Note the project URL, anon key, and service role key.

- [ ] **Step 1: Install Supabase CLI**

```bash
npx supabase init
npx supabase link --project-ref your-project-ref
```

- [ ] **Step 2: Create athletes migration (001)**

Create `supabase/migrations/001_athletes.sql`:
```sql
-- Athletes table (core identity)
CREATE TABLE athletes (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'onboarding', 'active', 'paused', 'archived')),
  invite_code TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  onboarding_completed_at TIMESTAMPTZ
);

-- Athlete profiles (detailed info from intake)
CREATE TABLE athlete_profiles (
  athlete_id UUID PRIMARY KEY REFERENCES athletes(id) ON DELETE CASCADE,
  height_cm REAL,
  weight_kg REAL,
  frame_size TEXT,
  date_of_birth DATE,
  gender TEXT,
  experience_level TEXT
    CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'comeback')),
  training_history_summary JSONB DEFAULT '{}'::JSONB,
  lifestyle_constraints JSONB DEFAULT '{}'::JSONB,
  injury_history JSONB DEFAULT '[]'::JSONB,
  equipment_access JSONB DEFAULT '{}'::JSONB,
  nutrition_preferences JSONB DEFAULT '{}'::JSONB,
  mental_profile JSONB DEFAULT '{}'::JSONB,
  country TEXT,
  timezone TEXT DEFAULT 'UTC',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_profiles ENABLE ROW LEVEL SECURITY;

-- Athletes: users can only read/update their own row
CREATE POLICY "athletes_select_own" ON athletes
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "athletes_update_own" ON athletes
  FOR UPDATE USING (auth.uid() = id);

-- Admin: can read all athletes
CREATE POLICY "athletes_admin_select" ON athletes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM athletes WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Profiles: users can only read/update their own
CREATE POLICY "profiles_select_own" ON athlete_profiles
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "profiles_insert_own" ON athlete_profiles
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "profiles_update_own" ON athlete_profiles
  FOR UPDATE USING (auth.uid() = athlete_id);
```

- [ ] **Step 3: Create journeys migration (002)**

Create `supabase/migrations/002_journeys.sql`:
```sql
-- Journeys (central organizing concept)
CREATE TABLE journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL
    CHECK (goal_type IN ('ocr', 'marathon', 'powerlifting', 'general_fitness', 'weight_loss', 'hybrid', 'custom')),
  goal_description TEXT,
  target_event JSONB, -- {name, date, location, format}
  target_metrics JSONB DEFAULT '{}'::JSONB, -- {race_weight, time_goal, strength_targets}
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'active', 'paused', 'completed', 'abandoned')),
  periodization JSONB DEFAULT '[]'::JSONB, -- [{phase, start, end, gates, milestones}]
  started_at TIMESTAMPTZ,
  target_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coaching teams (belong to journey)
CREATE TABLE coaching_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  coach_slot INTEGER NOT NULL CHECK (coach_slot >= 0 AND coach_slot <= 10),
  coach_type TEXT NOT NULL CHECK (coach_type IN ('universal', 'goal_specific')),
  persona_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  responsibilities TEXT[] NOT NULL DEFAULT '{}',
  persona_content TEXT NOT NULL, -- full markdown persona
  diagnostic_rules JSONB DEFAULT '[]'::JSONB,
  conflict_priority INTEGER NOT NULL DEFAULT 99,
  non_negotiable_rules JSONB DEFAULT '[]'::JSONB,
  tone TEXT,
  research_sources JSONB DEFAULT '[]'::JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (journey_id, coach_slot)
);

-- RLS
ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journeys_select_own" ON journeys
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "journeys_insert_own" ON journeys
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "journeys_update_own" ON journeys
  FOR UPDATE USING (auth.uid() = athlete_id);

CREATE POLICY "coaching_teams_select_own" ON coaching_teams
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM journeys WHERE journeys.id = coaching_teams.journey_id AND journeys.athlete_id = auth.uid())
  );
CREATE POLICY "coaching_teams_insert_own" ON coaching_teams
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM journeys WHERE journeys.id = coaching_teams.journey_id AND journeys.athlete_id = auth.uid())
  );
```

- [ ] **Step 4: Create daily tracking migration (003)**

Create `supabase/migrations/003_daily_tracking.sql`:
```sql
-- Daily logs (per athlete per day, belongs to athlete not journey)
CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 5),
  pain_level INTEGER DEFAULT 0 CHECK (pain_level BETWEEN 0 AND 3),
  pain_area TEXT,
  sleep_disruption_tags TEXT[] DEFAULT '{}', -- {kids, stress, pain, other}
  bedtime TIME,
  compliance_items JSONB DEFAULT '{}'::JSONB, -- dynamic, coach-generated
  hydration_ml INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, date)
);

-- Daily notes (tagged notes per day)
CREATE TABLE daily_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('injury', 'sleep', 'training', 'life', 'other')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_logs_select_own" ON daily_logs
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "daily_logs_insert_own" ON daily_logs
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "daily_logs_update_own" ON daily_logs
  FOR UPDATE USING (auth.uid() = athlete_id);

CREATE POLICY "daily_notes_select_own" ON daily_notes
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "daily_notes_insert_own" ON daily_notes
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "daily_notes_update_own" ON daily_notes
  FOR UPDATE USING (auth.uid() = athlete_id);
```

- [ ] **Step 5: Create sessions migration (004)**

Create `supabase/migrations/004_sessions.sql`:
```sql
-- Session logs
CREATE TABLE session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  journey_id UUID REFERENCES journeys(id) ON DELETE SET NULL,
  plan_item_id UUID,
  session_type TEXT NOT NULL,
  focus TEXT,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'skipped')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Session sets (individual strength sets)
CREATE TABLE session_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES session_logs(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  exercise_type TEXT DEFAULT 'strength'
    CHECK (exercise_type IN ('strength', 'cardio', 'mobility', 'warmup', 'cooldown')),
  set_number INTEGER NOT NULL,
  prescribed_reps INTEGER,
  prescribed_weight_kg REAL,
  actual_reps INTEGER,
  actual_weight_kg REAL,
  rpe INTEGER CHECK (rpe BETWEEN 1 AND 5),
  laterality TEXT CHECK (laterality IN ('bilateral', 'left', 'right', 'alternating')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Session cardio
CREATE TABLE session_cardio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES session_logs(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  prescribed_duration_sec INTEGER,
  actual_duration_sec INTEGER,
  prescribed_distance_m REAL,
  actual_distance_m REAL,
  avg_hr INTEGER,
  max_hr INTEGER,
  avg_watts REAL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_cardio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_logs_select_own" ON session_logs
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "session_logs_insert_own" ON session_logs
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "session_logs_update_own" ON session_logs
  FOR UPDATE USING (auth.uid() = athlete_id);

CREATE POLICY "session_sets_select_own" ON session_sets
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "session_sets_insert_own" ON session_sets
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "session_sets_update_own" ON session_sets
  FOR UPDATE USING (auth.uid() = athlete_id);

CREATE POLICY "session_cardio_select_own" ON session_cardio
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "session_cardio_insert_own" ON session_cardio
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "session_cardio_update_own" ON session_cardio
  FOR UPDATE USING (auth.uid() = athlete_id);
```

- [ ] **Step 6: Create plans migration (005)**

Create `supabase/migrations/005_plans.sql`:
```sql
-- Plan items (per athlete per journey)
CREATE TABLE plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Monday
  session_type TEXT NOT NULL,
  focus TEXT,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  sequence_group TEXT,
  sequence_notes TEXT,
  workout_detail JSONB NOT NULL DEFAULT '{}'::JSONB,
  coach_cues TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'skipped', 'swapped')),
  estimated_duration_min INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ceiling history (progressive overload tracking)
CREATE TABLE ceiling_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  date DATE NOT NULL,
  exercise TEXT NOT NULL,
  weight_kg REAL NOT NULL,
  reps INTEGER NOT NULL,
  source TEXT DEFAULT 'session', -- session or manual
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ceiling_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_items_select_own" ON plan_items
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "plan_items_insert_own" ON plan_items
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "plan_items_update_own" ON plan_items
  FOR UPDATE USING (auth.uid() = athlete_id);

CREATE POLICY "ceiling_history_select_own" ON ceiling_history
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "ceiling_history_insert_own" ON ceiling_history
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);
```

- [ ] **Step 7: Create metrics migration (006)**

Create `supabase/migrations/006_metrics.sql`:
```sql
-- Weekly metrics (check-in snapshot)
CREATE TABLE weekly_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  journey_id UUID REFERENCES journeys(id) ON DELETE SET NULL,
  week_number INTEGER NOT NULL,
  check_in_date DATE NOT NULL,
  weight_kg REAL,
  body_fat_pct REAL,
  muscle_mass_kg REAL,
  avg_sleep_score REAL,
  avg_training_readiness REAL,
  avg_rhr REAL,
  avg_hrv REAL,
  calories_avg REAL,
  protein_avg REAL,
  sessions_planned INTEGER,
  sessions_completed INTEGER,
  compliance_summary JSONB DEFAULT '{}'::JSONB, -- dynamic compliance tracking
  model_used TEXT DEFAULT 'sonnet',
  synthesis_content TEXT, -- the coaching synthesis output
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, week_number)
);

-- Strategic reviews (monthly/quarterly)
CREATE TABLE strategic_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  review_type TEXT NOT NULL CHECK (review_type IN ('monthly_quick', 'monthly_full', 'quarterly', 'mid_journey', 'end_journey')),
  review_date DATE NOT NULL,
  drift_signals JSONB DEFAULT '{}'::JSONB,
  review_content TEXT, -- full review output
  changes_made JSONB DEFAULT '[]'::JSONB, -- what was changed as a result
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE weekly_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategic_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_metrics_select_own" ON weekly_metrics
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "weekly_metrics_insert_own" ON weekly_metrics
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "weekly_metrics_update_own" ON weekly_metrics
  FOR UPDATE USING (auth.uid() = athlete_id);

CREATE POLICY "strategic_reviews_select_own" ON strategic_reviews
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "strategic_reviews_insert_own" ON strategic_reviews
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);
```

- [ ] **Step 8: Create wearables migration (007)**

Create `supabase/migrations/007_wearables.sql`:
```sql
-- Wearable connections (encrypted tokens)
CREATE TABLE wearable_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- garmin, whoop, fitbit, oura, apple_health, google_health
  terra_user_id TEXT, -- Terra's user reference (null for custom connectors)
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  connector_type TEXT NOT NULL DEFAULT 'terra' CHECK (connector_type IN ('terra', 'custom')),
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  last_sync_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, provider)
);

-- Wearable data (daily aggregates, normalized)
CREATE TABLE wearable_data_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  source TEXT NOT NULL,
  sleep JSONB, -- {score, duration_min, bedtime, wake_time, quality, stages}
  recovery JSONB, -- {score, hrv, rhr, body_battery}
  activity JSONB, -- {steps, active_calories, total_calories, distance_m}
  stress JSONB, -- {avg_score, max_score}
  body_comp JSONB, -- {weight_kg, body_fat_pct, muscle_mass_kg}
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, date, source)
);

-- Wearable activities (individual workouts from device)
CREATE TABLE wearable_data_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  source TEXT NOT NULL,
  activity_type TEXT,
  duration_min REAL,
  calories REAL,
  avg_hr INTEGER,
  max_hr INTEGER,
  hr_zones JSONB, -- normalized to 5 zones
  training_effect_aerobic REAL,
  training_effect_anaerobic REAL,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nutrition data (daily, from nutrition apps or custom connector)
CREATE TABLE nutrition_data_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  source TEXT NOT NULL,
  calories REAL,
  protein_g REAL,
  carbs_g REAL,
  fat_g REAL,
  hydration_ml REAL,
  meals JSONB, -- [{meal_type, items, calories, protein, carbs, fat}]
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, date, source)
);

-- RLS
ALTER TABLE wearable_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE wearable_data_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE wearable_data_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_data_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wearable_connections_select_own" ON wearable_connections
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "wearable_connections_insert_own" ON wearable_connections
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "wearable_connections_update_own" ON wearable_connections
  FOR UPDATE USING (auth.uid() = athlete_id);
CREATE POLICY "wearable_connections_delete_own" ON wearable_connections
  FOR DELETE USING (auth.uid() = athlete_id);

CREATE POLICY "wearable_data_daily_select_own" ON wearable_data_daily
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "wearable_data_daily_insert_own" ON wearable_data_daily
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "wearable_activities_select_own" ON wearable_data_activities
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "wearable_activities_insert_own" ON wearable_data_activities
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "nutrition_data_select_own" ON nutrition_data_daily
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "nutrition_data_insert_own" ON nutrition_data_daily
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);
```

- [ ] **Step 9: Create system tables migration (008)**

Create `supabase/migrations/008_system.sql`:
```sql
-- Invite codes
CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES athletes(id),
  used_by UUID REFERENCES athletes(id),
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consent records (GDPR)
CREATE TABLE consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL, -- data_processing, wearable_sync, ai_analysis, email_notifications
  granted BOOLEAN NOT NULL DEFAULT TRUE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

-- Notification preferences
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, notification_type)
);

-- DEXA scans
CREATE TABLE dexa_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  scan_date DATE NOT NULL,
  total_body_fat_pct REAL,
  lean_mass_kg REAL,
  fat_mass_kg REAL,
  bone_mineral_density REAL,
  regional_data JSONB, -- {arms, legs, trunk, etc.}
  source TEXT DEFAULT 'pdf_upload',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE dexa_scans ENABLE ROW LEVEL SECURITY;

-- Invite codes: only admin can manage, anyone can validate
CREATE POLICY "invite_codes_admin_all" ON invite_codes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM athletes WHERE id = auth.uid() AND is_admin = TRUE)
  );
CREATE POLICY "invite_codes_validate" ON invite_codes
  FOR SELECT USING (used_by IS NULL AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "consent_select_own" ON consent_records
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "consent_insert_own" ON consent_records
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "consent_update_own" ON consent_records
  FOR UPDATE USING (auth.uid() = athlete_id);

CREATE POLICY "notif_prefs_select_own" ON notification_preferences
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "notif_prefs_insert_own" ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "notif_prefs_update_own" ON notification_preferences
  FOR UPDATE USING (auth.uid() = athlete_id);

CREATE POLICY "dexa_select_own" ON dexa_scans
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "dexa_insert_own" ON dexa_scans
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);
```

- [ ] **Step 10: Create admin policies migration (009)**

Create `supabase/migrations/009_admin.sql`:
```sql
-- Admin read access across all tables
-- These policies allow admin to see all athlete data for monitoring

CREATE POLICY "admin_read_profiles" ON athlete_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM athletes WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "admin_read_journeys" ON journeys
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM athletes WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "admin_read_coaching_teams" ON coaching_teams
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM athletes WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "admin_read_daily_logs" ON daily_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM athletes WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "admin_read_session_logs" ON session_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM athletes WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "admin_read_weekly_metrics" ON weekly_metrics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM athletes WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "admin_read_wearable_connections" ON wearable_connections
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM athletes WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "admin_read_strategic_reviews" ON strategic_reviews
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM athletes WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Admin can update athlete status (pause, archive)
CREATE POLICY "admin_update_athletes" ON athletes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM athletes WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Admin can edit coaching teams (override AI-generated personas)
CREATE POLICY "admin_update_coaching_teams" ON coaching_teams
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM athletes WHERE id = auth.uid() AND is_admin = TRUE)
  );
```

- [ ] **Step 11: Run migrations**

```bash
npx supabase db push
# Expected: All 9 migrations applied successfully
```

- [ ] **Step 12: Generate TypeScript types**

```bash
npx supabase gen types typescript --project-id your-project-ref > lib/supabase/types.ts
```

- [ ] **Step 13: Commit**

```bash
git add supabase/ lib/supabase/types.ts
git commit -m "feat: add Supabase migrations for full multi-tenant schema with RLS"
```

---

## Task 3: Supabase Client Setup

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Create browser client**

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 2: Create server client**

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from Server Component — ignore
          }
        },
      },
    },
  );
}

// Admin client bypasses RLS — use only in admin API routes
export function createAdminSupabase() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    },
  );
}
```

- [ ] **Step 3: Create middleware helper**

Create `lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Public routes that don't require auth
  const publicPaths = ['/auth/', '/api/auth/', '/api/terra/webhook', '/api/invite/validate'];
  const isPublic = publicPaths.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 4: Create root middleware**

Create `middleware.ts`:
```typescript
import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/ middleware.ts
git commit -m "feat: add Supabase client setup with server/browser/middleware helpers"
```

---

## Task 4: Design System — Theme & Palettes

**Files:**
- Create: `lib/theme/types.ts`
- Create: `lib/theme/palettes.ts`
- Create: `lib/theme/design-tokens.ts`
- Create: `lib/theme/theme.ts`
- Create: `__tests__/lib/theme/palettes.test.ts`

- [ ] **Step 1: Write failing test for palettes**

Create `__tests__/lib/theme/palettes.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { palettes, getPalette, DEFAULT_PALETTE_ID } from '@/lib/theme/palettes';
import type { Palette } from '@/lib/theme/types';

describe('palettes', () => {
  it('exports at least 4 palettes', () => {
    expect(Object.keys(palettes).length).toBeGreaterThanOrEqual(4);
  });

  it('every palette has light and dark variants', () => {
    for (const [id, palette] of Object.entries(palettes)) {
      expect(palette.light, `${id} missing light`).toBeDefined();
      expect(palette.dark, `${id} missing dark`).toBeDefined();
    }
  });

  it('every palette variant has all required color keys', () => {
    const requiredKeys: (keyof Palette['light'])[] = [
      'primary', 'primaryContrast', 'background', 'paper',
      'textPrimary', 'textSecondary', 'divider',
      'success', 'warning', 'error', 'info',
    ];
    for (const [id, palette] of Object.entries(palettes)) {
      for (const key of requiredKeys) {
        expect(palette.light[key], `${id}.light.${key}`).toBeTruthy();
        expect(palette.dark[key], `${id}.dark.${key}`).toBeTruthy();
      }
    }
  });

  it('getPalette returns default for unknown id', () => {
    expect(getPalette('nonexistent')).toEqual(palettes[DEFAULT_PALETTE_ID]);
  });

  it('getPalette returns correct palette for known id', () => {
    const ids = Object.keys(palettes);
    expect(getPalette(ids[0])).toEqual(palettes[ids[0]]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/lib/theme/palettes.test.ts
# Expected: FAIL — modules not found
```

- [ ] **Step 3: Create theme types**

Create `lib/theme/types.ts`:
```typescript
export interface PaletteColors {
  primary: string;
  primaryContrast: string;
  secondary: string;
  secondaryContrast: string;
  error: string;
  errorContrast: string;
  warning: string;
  warningContrast: string;
  success: string;
  successContrast: string;
  info: string;
  infoContrast: string;
  background: string;
  paper: string;
  textPrimary: string;
  textSecondary: string;
  divider: string;
  surfaceHover: string;
}

export interface Palette {
  id: string;
  name: string;
  light: PaletteColors;
  dark: PaletteColors;
}

export type PaletteId = string;
export type ThemeMode = 'light' | 'dark';
```

- [ ] **Step 4: Create palettes**

Create `lib/theme/palettes.ts`:
```typescript
import type { Palette } from './types';

export const DEFAULT_PALETTE_ID = 'concrete';

export const palettes: Record<string, Palette> = {
  concrete: {
    id: 'concrete',
    name: 'Concrete',
    light: {
      primary: '#18181b', primaryContrast: '#fafaf7',
      secondary: '#3b82f6', secondaryContrast: '#ffffff',
      error: '#ef4444', errorContrast: '#ffffff',
      warning: '#f59e0b', warningContrast: '#000000',
      success: '#22c55e', successContrast: '#ffffff',
      info: '#3b82f6', infoContrast: '#ffffff',
      background: '#f5f5f0', paper: '#fafaf7',
      textPrimary: '#18181b', textSecondary: '#71717a',
      divider: '#e4e4e0', surfaceHover: '#f0f0eb',
    },
    dark: {
      primary: '#e4e4e7', primaryContrast: '#0a0a0f',
      secondary: '#60a5fa', secondaryContrast: '#0a0a0f',
      error: '#f87171', errorContrast: '#0a0a0f',
      warning: '#fbbf24', warningContrast: '#0a0a0f',
      success: '#4ade80', successContrast: '#0a0a0f',
      info: '#60a5fa', infoContrast: '#0a0a0f',
      background: '#0a0a0f', paper: '#111116',
      textPrimary: '#e4e4e7', textSecondary: '#71717a',
      divider: '#27272a', surfaceHover: '#1a1a1f',
    },
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    light: {
      primary: '#1e293b', primaryContrast: '#f8fafc',
      secondary: '#6366f1', secondaryContrast: '#ffffff',
      error: '#ef4444', errorContrast: '#ffffff',
      warning: '#f59e0b', warningContrast: '#000000',
      success: '#22c55e', successContrast: '#ffffff',
      info: '#6366f1', infoContrast: '#ffffff',
      background: '#f1f5f9', paper: '#f8fafc',
      textPrimary: '#1e293b', textSecondary: '#64748b',
      divider: '#e2e8f0', surfaceHover: '#e2e8f0',
    },
    dark: {
      primary: '#e2e8f0', primaryContrast: '#0f172a',
      secondary: '#818cf8', secondaryContrast: '#0f172a',
      error: '#f87171', errorContrast: '#0f172a',
      warning: '#fbbf24', warningContrast: '#0f172a',
      success: '#4ade80', successContrast: '#0f172a',
      info: '#818cf8', infoContrast: '#0f172a',
      background: '#0f172a', paper: '#1e293b',
      textPrimary: '#e2e8f0', textSecondary: '#94a3b8',
      divider: '#334155', surfaceHover: '#1e293b',
    },
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    light: {
      primary: '#1a2e1a', primaryContrast: '#f5f7f4',
      secondary: '#16a34a', secondaryContrast: '#ffffff',
      error: '#dc2626', errorContrast: '#ffffff',
      warning: '#d97706', warningContrast: '#000000',
      success: '#16a34a', successContrast: '#ffffff',
      info: '#0891b2', infoContrast: '#ffffff',
      background: '#f0f4ef', paper: '#f5f7f4',
      textPrimary: '#1a2e1a', textSecondary: '#4a6741',
      divider: '#d4ddd2', surfaceHover: '#e5ebe3',
    },
    dark: {
      primary: '#d4ddd2', primaryContrast: '#0c1a0c',
      secondary: '#4ade80', secondaryContrast: '#0c1a0c',
      error: '#f87171', errorContrast: '#0c1a0c',
      warning: '#fbbf24', warningContrast: '#0c1a0c',
      success: '#4ade80', successContrast: '#0c1a0c',
      info: '#22d3ee', infoContrast: '#0c1a0c',
      background: '#0c1a0c', paper: '#142514',
      textPrimary: '#d4ddd2', textSecondary: '#7a9472',
      divider: '#1e3a1e', surfaceHover: '#1a2e1a',
    },
  },
  ember: {
    id: 'ember',
    name: 'Ember',
    light: {
      primary: '#292524', primaryContrast: '#fafaf9',
      secondary: '#ea580c', secondaryContrast: '#ffffff',
      error: '#dc2626', errorContrast: '#ffffff',
      warning: '#f59e0b', warningContrast: '#000000',
      success: '#16a34a', successContrast: '#ffffff',
      info: '#ea580c', infoContrast: '#ffffff',
      background: '#fafaf9', paper: '#ffffff',
      textPrimary: '#292524', textSecondary: '#78716c',
      divider: '#e7e5e4', surfaceHover: '#f5f5f4',
    },
    dark: {
      primary: '#e7e5e4', primaryContrast: '#1c1917',
      secondary: '#fb923c', secondaryContrast: '#1c1917',
      error: '#f87171', errorContrast: '#1c1917',
      warning: '#fbbf24', warningContrast: '#1c1917',
      success: '#4ade80', successContrast: '#1c1917',
      info: '#fb923c', infoContrast: '#1c1917',
      background: '#1c1917', paper: '#292524',
      textPrimary: '#e7e5e4', textSecondary: '#a8a29e',
      divider: '#44403c', surfaceHover: '#292524',
    },
  },
};

export function getPalette(id: string): Palette {
  return palettes[id] ?? palettes[DEFAULT_PALETTE_ID];
}

export function getAllPaletteIds(): string[] {
  return Object.keys(palettes);
}
```

- [ ] **Step 5: Create design tokens**

Create `lib/theme/design-tokens.ts`:
```typescript
// Light Brutalist design tokens — shared across all palettes
export const designTokens = {
  borders: {
    width: 3,
    style: 'solid',
  },
  shape: {
    borderRadius: 0,
  },
  typography: {
    heading: '"Libre Franklin", sans-serif',
    body: '"DM Sans", sans-serif',
    mono: '"JetBrains Mono", monospace',
  },
  spacing: {
    cardPadding: { xs: 12, sm: 16 },
    sectionGap: 16,
  },
} as const;
```

- [ ] **Step 6: Create theme builder**

Create `lib/theme/theme.ts`:
```typescript
'use client';

import { createTheme, type ThemeOptions } from '@mui/material/styles';
import type { PaletteColors, ThemeMode } from './types';
import { designTokens } from './design-tokens';

export function buildTheme(colors: PaletteColors, mode: ThemeMode) {
  const c = colors;
  const dt = designTokens;

  const options: ThemeOptions = {
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
    shape: { borderRadius: dt.shape.borderRadius },
    typography: {
      fontFamily: dt.typography.body,
      h1: { fontFamily: dt.typography.heading, fontSize: '1.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.5px' },
      h2: { fontFamily: dt.typography.heading, fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.5px' },
      h3: { fontFamily: dt.typography.heading, fontSize: '1.375rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.5px' },
      h4: { fontFamily: dt.typography.heading, fontSize: '1.125rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' },
      h5: { fontFamily: dt.typography.heading, fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' },
      h6: { fontFamily: dt.typography.heading, fontSize: '0.875rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' },
      subtitle1: { fontFamily: dt.typography.mono, fontWeight: 600, fontSize: '0.8125rem' },
      subtitle2: { fontFamily: dt.typography.mono, fontWeight: 600, fontSize: '0.75rem' },
      body1: { fontSize: '0.875rem' },
      body2: { fontFamily: dt.typography.mono, fontSize: '0.8125rem' },
      caption: { fontFamily: dt.typography.mono, fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px' },
    },
    components: {
      MuiButton: {
        styleOverrides: { root: { borderRadius: 0, textTransform: 'uppercase', fontFamily: dt.typography.mono, fontWeight: 700, letterSpacing: '1px', padding: '8px 20px', fontSize: '0.75rem' } },
        defaultProps: { disableElevation: true },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 0, fontFamily: dt.typography.mono, fontWeight: 700, fontSize: '0.625rem', letterSpacing: '1px', textTransform: 'uppercase' } },
      },
      MuiCard: {
        styleOverrides: { root: { borderRadius: 0, border: `${dt.borders.width}px ${dt.borders.style} ${c.primary}`, backgroundImage: 'none', boxShadow: 'none' } },
        defaultProps: { elevation: 0 },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none', borderRadius: 0 } },
      },
      MuiTextField: {
        styleOverrides: { root: { '& .MuiOutlinedInput-root': { borderRadius: 0, fontFamily: dt.typography.mono, fontSize: '0.875rem' } } },
      },
      MuiAccordion: {
        styleOverrides: { root: { borderRadius: 0, border: `${dt.borders.width}px ${dt.borders.style} ${c.primary}`, '&:before': { display: 'none' } } },
        defaultProps: { disableGutters: true, elevation: 0 },
      },
      MuiLinearProgress: {
        styleOverrides: { root: { borderRadius: 0, height: 6 } },
      },
      MuiTableCell: {
        styleOverrides: { root: { borderColor: c.divider, fontSize: '0.8125rem', fontFamily: dt.typography.mono } },
      },
    },
  };

  return createTheme(options);
}
```

- [ ] **Step 7: Run tests**

```bash
npx vitest run __tests__/lib/theme/palettes.test.ts
# Expected: All tests PASS
```

- [ ] **Step 8: Commit**

```bash
git add lib/theme/ __tests__/lib/theme/
git commit -m "feat: add Brutalist design system with 4 curated palettes and theme builder"
```

---

## Task 5: AI Service Layer

**Files:**
- Create: `lib/ai/types.ts`
- Create: `lib/ai/model-router.ts`
- Create: `lib/ai/escalation.ts`
- Create: `lib/ai/client.ts`
- Create: `__tests__/lib/ai/model-router.test.ts`
- Create: `__tests__/lib/ai/escalation.test.ts`

- [ ] **Step 1: Write failing test for model router**

Create `__tests__/lib/ai/model-router.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { getModel, type CoachingMoment } from '@/lib/ai/model-router';

describe('getModel', () => {
  it('returns opus for coach_generation', () => {
    expect(getModel('coach_generation')).toBe('claude-opus-4-6');
  });

  it('returns opus for intake_interview', () => {
    expect(getModel('intake_interview')).toBe('claude-opus-4-6');
  });

  it('returns opus for phase_transition', () => {
    expect(getModel('phase_transition')).toBe('claude-opus-4-6');
  });

  it('returns opus for injury_reassessment', () => {
    expect(getModel('injury_reassessment')).toBe('claude-opus-4-6');
  });

  it('returns sonnet for weekly_synthesis', () => {
    expect(getModel('weekly_synthesis')).toBe('claude-sonnet-4-6');
  });

  it('returns sonnet for weekly_dialogue', () => {
    expect(getModel('weekly_dialogue')).toBe('claude-sonnet-4-6');
  });

  it('returns haiku for triage', () => {
    expect(getModel('triage')).toBe('claude-haiku-4-5-20251001');
  });

  it('returns haiku for schema_validation', () => {
    expect(getModel('schema_validation')).toBe('claude-haiku-4-5-20251001');
  });

  it('returns sonnet for intake_safety_validation', () => {
    expect(getModel('intake_safety_validation')).toBe('claude-sonnet-4-6');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/lib/ai/model-router.test.ts
# Expected: FAIL — module not found
```

- [ ] **Step 3: Create AI types**

Create `lib/ai/types.ts`:
```typescript
export type ModelTier = 'opus' | 'sonnet' | 'haiku';

export type CoachingMoment =
  | 'coach_generation'
  | 'intake_interview'
  | 'phase_transition'
  | 'injury_reassessment'
  | 'mid_journey_reassessment'
  | 'monthly_strategic_review'
  | 'weekly_synthesis'
  | 'weekly_dialogue'
  | 'triage'
  | 'schema_validation'
  | 'monthly_quick_confirm'
  | 'intake_safety_validation';

export interface EscalationContext {
  painLevel?: number;
  complianceDropPct?: number;
  weightChangKg?: number;
  avgSleepScore?: number;
  athleteFlaggedChange?: boolean;
  weeksToPhaseGate?: number;
}

export interface AICallOptions {
  moment: CoachingMoment;
  escalationContext?: EscalationContext;
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
}
```

- [ ] **Step 4: Create model router**

Create `lib/ai/model-router.ts`:
```typescript
import type { CoachingMoment, ModelTier } from './types';

const MODEL_IDS: Record<ModelTier, string> = {
  opus: 'claude-opus-4-6',
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5-20251001',
};

const MOMENT_TIERS: Record<CoachingMoment, ModelTier> = {
  coach_generation: 'opus',
  intake_interview: 'opus',
  phase_transition: 'opus',
  injury_reassessment: 'opus',
  mid_journey_reassessment: 'opus',
  monthly_strategic_review: 'opus',
  weekly_synthesis: 'sonnet',
  weekly_dialogue: 'sonnet',
  triage: 'haiku',
  schema_validation: 'haiku',
  monthly_quick_confirm: 'haiku',
  intake_safety_validation: 'sonnet',
};

export type { CoachingMoment };

export function getModel(moment: CoachingMoment): string {
  return MODEL_IDS[MOMENT_TIERS[moment]];
}

export function getTier(moment: CoachingMoment): ModelTier {
  return MOMENT_TIERS[moment];
}
```

- [ ] **Step 5: Run model router test**

```bash
npx vitest run __tests__/lib/ai/model-router.test.ts
# Expected: All tests PASS
```

- [ ] **Step 6: Write failing test for escalation**

Create `__tests__/lib/ai/escalation.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { shouldEscalate } from '@/lib/ai/escalation';
import type { EscalationContext } from '@/lib/ai/types';

describe('shouldEscalate', () => {
  it('returns false when no signals present', () => {
    expect(shouldEscalate({})).toBe(false);
  });

  it('escalates on pain level 3', () => {
    expect(shouldEscalate({ painLevel: 3 })).toBe(true);
  });

  it('does not escalate on pain level 2', () => {
    expect(shouldEscalate({ painLevel: 2 })).toBe(false);
  });

  it('escalates on compliance drop >30%', () => {
    expect(shouldEscalate({ complianceDropPct: 35 })).toBe(true);
  });

  it('does not escalate on compliance drop 25%', () => {
    expect(shouldEscalate({ complianceDropPct: 25 })).toBe(false);
  });

  it('escalates on weight change >2kg', () => {
    expect(shouldEscalate({ weightChangKg: 2.5 })).toBe(true);
  });

  it('escalates on sleep score <50', () => {
    expect(shouldEscalate({ avgSleepScore: 45 })).toBe(true);
  });

  it('escalates when athlete flagged change', () => {
    expect(shouldEscalate({ athleteFlaggedChange: true })).toBe(true);
  });

  it('escalates when phase gate within 2 weeks', () => {
    expect(shouldEscalate({ weeksToPhaseGate: 1 })).toBe(true);
  });

  it('does not escalate when phase gate 3 weeks away', () => {
    expect(shouldEscalate({ weeksToPhaseGate: 3 })).toBe(false);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

```bash
npx vitest run __tests__/lib/ai/escalation.test.ts
# Expected: FAIL — module not found
```

- [ ] **Step 8: Create escalation logic**

Create `lib/ai/escalation.ts`:
```typescript
import type { EscalationContext } from './types';

const THRESHOLDS = {
  painLevel: 3,
  complianceDropPct: 30,
  weightChangeKg: 2,
  sleepScoreMin: 50,
  phaseGateWeeks: 2,
} as const;

export function shouldEscalate(ctx: EscalationContext): boolean {
  if (ctx.painLevel != null && ctx.painLevel >= THRESHOLDS.painLevel) return true;
  if (ctx.complianceDropPct != null && ctx.complianceDropPct > THRESHOLDS.complianceDropPct) return true;
  if (ctx.weightChangKg != null && Math.abs(ctx.weightChangKg) > THRESHOLDS.weightChangeKg) return true;
  if (ctx.avgSleepScore != null && ctx.avgSleepScore < THRESHOLDS.sleepScoreMin) return true;
  if (ctx.athleteFlaggedChange === true) return true;
  if (ctx.weeksToPhaseGate != null && ctx.weeksToPhaseGate <= THRESHOLDS.phaseGateWeeks) return true;
  return false;
}
```

- [ ] **Step 9: Run escalation test**

```bash
npx vitest run __tests__/lib/ai/escalation.test.ts
# Expected: All tests PASS
```

- [ ] **Step 10: Create AI client wrapper**

Create `lib/ai/client.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { getModel } from './model-router';
import { shouldEscalate } from './escalation';
import type { AICallOptions } from './types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function aiCall(options: AICallOptions) {
  const { moment, escalationContext, systemPrompt, userMessage, maxTokens = 4096 } = options;

  // Check if weekly synthesis should escalate to Opus
  let model = getModel(moment);
  if (moment === 'weekly_synthesis' && escalationContext && shouldEscalate(escalationContext)) {
    model = getModel('phase_transition'); // Opus
  }

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  return {
    content: response.content[0].type === 'text' ? response.content[0].text : '',
    model: response.model,
    usage: response.usage,
  };
}

export async function aiStream(options: AICallOptions) {
  const { moment, escalationContext, systemPrompt, userMessage, maxTokens = 4096 } = options;

  let model = getModel(moment);
  if (moment === 'weekly_synthesis' && escalationContext && shouldEscalate(escalationContext)) {
    model = getModel('phase_transition');
  }

  return anthropic.messages.stream({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
}
```

- [ ] **Step 11: Commit**

```bash
git add lib/ai/ __tests__/lib/ai/
git commit -m "feat: add AI service layer with model tier routing and dynamic escalation"
```

---

## Task 6: Terra API Skeleton

**Files:**
- Create: `lib/terra/types.ts`
- Create: `lib/terra/normalize.ts`
- Create: `lib/terra/client.ts`
- Create: `app/api/terra/webhook/route.ts`
- Create: `__tests__/lib/terra/normalize.test.ts`

- [ ] **Step 1: Write failing test for normalization**

Create `__tests__/lib/terra/normalize.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { normalizeDailyData, normalizeActivity } from '@/lib/terra/normalize';

describe('normalizeDailyData', () => {
  it('normalizes a Terra daily payload into internal schema', () => {
    const terraPayload = {
      sleep_data: { sleep_score: 78, duration_seconds: 27000, bedtime_start: '2026-04-05T23:15:00', bedtime_stop: '2026-04-06T06:45:00' },
      body_data: { weight_kg: 96.2, body_fat_percentage: 22.5, muscle_mass_kg: 37.1 },
      activity_data: { steps: 8500, active_calories: 450, total_calories: 2800, distance_meters: 6200 },
    };

    const result = normalizeDailyData(terraPayload, '2026-04-05', 'garmin');

    expect(result.date).toBe('2026-04-05');
    expect(result.source).toBe('garmin');
    expect(result.sleep?.score).toBe(78);
    expect(result.sleep?.duration_min).toBe(450);
    expect(result.body_comp?.weight_kg).toBe(96.2);
    expect(result.activity?.steps).toBe(8500);
    expect(result.raw_payload).toEqual(terraPayload);
  });

  it('handles missing fields gracefully', () => {
    const result = normalizeDailyData({}, '2026-04-05', 'whoop');

    expect(result.sleep).toBeNull();
    expect(result.body_comp).toBeNull();
    expect(result.activity).toBeNull();
    expect(result.source).toBe('whoop');
  });
});

describe('normalizeActivity', () => {
  it('normalizes a Terra activity into internal schema', () => {
    const terraActivity = {
      type: 'RUNNING',
      duration_seconds: 3600,
      calories: 650,
      heart_rate_data: { avg_hr: 145, max_hr: 172 },
      training_effect: { aerobic: 3.2, anaerobic: 1.8 },
    };

    const result = normalizeActivity(terraActivity, '2026-04-05', 'garmin');

    expect(result.activity_type).toBe('RUNNING');
    expect(result.duration_min).toBe(60);
    expect(result.avg_hr).toBe(145);
    expect(result.training_effect_aerobic).toBe(3.2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/lib/terra/normalize.test.ts
# Expected: FAIL — module not found
```

- [ ] **Step 3: Create Terra types**

Create `lib/terra/types.ts`:
```typescript
// Normalized internal types (what our app uses)
export interface NormalizedDailyData {
  date: string;
  source: string;
  sleep: { score: number; duration_min: number; bedtime: string; wake_time: string; quality?: string; stages?: Record<string, number> } | null;
  recovery: { score: number; hrv: number; rhr: number; body_battery?: number } | null;
  activity: { steps: number; active_calories: number; total_calories: number; distance_m: number } | null;
  stress: { avg_score: number; max_score: number } | null;
  body_comp: { weight_kg: number; body_fat_pct?: number; muscle_mass_kg?: number } | null;
  raw_payload: unknown;
}

export interface NormalizedActivity {
  date: string;
  source: string;
  activity_type: string;
  duration_min: number;
  calories: number;
  avg_hr: number | null;
  max_hr: number | null;
  hr_zones: Record<string, number> | null;
  training_effect_aerobic: number | null;
  training_effect_anaerobic: number | null;
  raw_payload: unknown;
}

export interface NormalizedNutrition {
  date: string;
  source: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  hydration_ml: number | null;
  meals: unknown[] | null;
  raw_payload: unknown;
}
```

- [ ] **Step 4: Create normalization functions**

Create `lib/terra/normalize.ts`:
```typescript
import type { NormalizedDailyData, NormalizedActivity } from './types';

export function normalizeDailyData(payload: Record<string, unknown>, date: string, source: string): NormalizedDailyData {
  const sleep = payload.sleep_data as Record<string, unknown> | undefined;
  const body = payload.body_data as Record<string, unknown> | undefined;
  const activity = payload.activity_data as Record<string, unknown> | undefined;
  const stress = payload.stress_data as Record<string, unknown> | undefined;
  const recovery = payload.recovery_data as Record<string, unknown> | undefined;

  return {
    date,
    source,
    sleep: sleep && sleep.duration_seconds != null ? {
      score: (sleep.sleep_score as number) ?? 0,
      duration_min: Math.round((sleep.duration_seconds as number) / 60),
      bedtime: (sleep.bedtime_start as string) ?? '',
      wake_time: (sleep.bedtime_stop as string) ?? '',
      quality: sleep.quality as string | undefined,
      stages: sleep.stages as Record<string, number> | undefined,
    } : null,
    recovery: recovery ? {
      score: (recovery.score as number) ?? 0,
      hrv: (recovery.hrv as number) ?? 0,
      rhr: (recovery.rhr as number) ?? 0,
      body_battery: recovery.body_battery as number | undefined,
    } : null,
    activity: activity && activity.steps != null ? {
      steps: (activity.steps as number) ?? 0,
      active_calories: (activity.active_calories as number) ?? 0,
      total_calories: (activity.total_calories as number) ?? 0,
      distance_m: (activity.distance_meters as number) ?? 0,
    } : null,
    stress: stress ? {
      avg_score: (stress.avg_score as number) ?? 0,
      max_score: (stress.max_score as number) ?? 0,
    } : null,
    body_comp: body && body.weight_kg != null ? {
      weight_kg: body.weight_kg as number,
      body_fat_pct: body.body_fat_percentage as number | undefined,
      muscle_mass_kg: body.muscle_mass_kg as number | undefined,
    } : null,
    raw_payload: payload,
  };
}

export function normalizeActivity(payload: Record<string, unknown>, date: string, source: string): NormalizedActivity {
  const hr = payload.heart_rate_data as Record<string, unknown> | undefined;
  const te = payload.training_effect as Record<string, unknown> | undefined;

  return {
    date,
    source,
    activity_type: (payload.type as string) ?? 'UNKNOWN',
    duration_min: Math.round(((payload.duration_seconds as number) ?? 0) / 60),
    calories: (payload.calories as number) ?? 0,
    avg_hr: (hr?.avg_hr as number) ?? null,
    max_hr: (hr?.max_hr as number) ?? null,
    hr_zones: (payload.hr_zones as Record<string, number>) ?? null,
    training_effect_aerobic: (te?.aerobic as number) ?? null,
    training_effect_anaerobic: (te?.anaerobic as number) ?? null,
    raw_payload: payload,
  };
}
```

- [ ] **Step 5: Run normalization tests**

```bash
npx vitest run __tests__/lib/terra/normalize.test.ts
# Expected: All tests PASS
```

- [ ] **Step 6: Create Terra client skeleton**

Create `lib/terra/client.ts`:
```typescript
// Terra API client — skeleton for Phase 2 implementation
// See: https://docs.tryterra.co/reference

const TERRA_API_BASE = 'https://api.tryterra.co/v2';

interface TerraConfig {
  apiKey: string;
  devId: string;
  signingSecret: string;
}

function getConfig(): TerraConfig {
  return {
    apiKey: process.env.TERRA_API_KEY!,
    devId: process.env.TERRA_DEV_ID!,
    signingSecret: process.env.TERRA_SIGNING_SECRET!,
  };
}

export async function generateWidgetSession(athleteId: string, referenceId: string) {
  const config = getConfig();
  const response = await fetch(`${TERRA_API_BASE}/auth/generateWidgetSession`, {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'dev-id': config.devId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reference_id: referenceId,
      providers: 'GARMIN,FITBIT,OURA,WHOOP',
      language: 'EN',
    }),
  });

  return response.json();
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const config = getConfig();
  // Terra uses HMAC-SHA256 for webhook verification
  // Full implementation in Phase 2
  return signature.length > 0 && config.signingSecret.length > 0;
}
```

- [ ] **Step 7: Create Terra webhook route**

Create `app/api/terra/webhook/route.ts`:
```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { verifyWebhookSignature } from '@/lib/terra/client';
import { normalizeDailyData, normalizeActivity } from '@/lib/terra/normalize';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('terra-signature') ?? '';

  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(body);
  const eventType = payload.type;

  // Log for now — full processing in Phase 2
  console.log(`[Terra webhook] type=${eventType} user=${payload.user?.reference_id}`);

  switch (eventType) {
    case 'daily':
    case 'sleep':
    case 'body': {
      const normalized = normalizeDailyData(payload.data ?? {}, payload.date ?? '', payload.user?.provider ?? '');
      console.log('[Terra webhook] normalized daily:', normalized.date, normalized.source);
      // Phase 2: Insert into wearable_data_daily
      break;
    }
    case 'activity': {
      const normalized = normalizeActivity(payload.data ?? {}, payload.date ?? '', payload.user?.provider ?? '');
      console.log('[Terra webhook] normalized activity:', normalized.activity_type);
      // Phase 2: Insert into wearable_data_activities
      break;
    }
    default:
      console.log(`[Terra webhook] unhandled type: ${eventType}`);
  }

  return NextResponse.json({ status: 'ok' });
}
```

- [ ] **Step 8: Commit**

```bash
git add lib/terra/ app/api/terra/ __tests__/lib/terra/
git commit -m "feat: add Terra API skeleton with data normalization and webhook receiver"
```

---

## Task 7: Email Service Skeleton

**Files:**
- Create: `lib/email/types.ts`
- Create: `lib/email/client.ts`
- Create: `lib/email/templates.ts`

- [ ] **Step 1: Create email types**

Create `lib/email/types.ts`:
```typescript
export type NotificationType =
  | 'weekly_checkin_reminder'
  | 'monthly_review_due'
  | 'plan_locked_in'
  | 'health_flag'
  | 'milestone_achieved'
  | 'intake_resume'
  | 'welcome'
  | 'wearable_disconnected';

// Health flags cannot be disabled
export const NON_DISABLEABLE: NotificationType[] = ['health_flag'];

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  type: NotificationType;
}
```

- [ ] **Step 2: Create email templates**

Create `lib/email/templates.ts`:
```typescript
import type { NotificationType } from './types';

interface TemplateData {
  athleteName: string;
  appUrl: string;
  [key: string]: string;
}

const TEMPLATES: Record<NotificationType, { subject: (d: TemplateData) => string; body: (d: TemplateData) => string }> = {
  weekly_checkin_reminder: {
    subject: () => 'Your weekly check-in is ready',
    body: (d) => wrap(`
      <h2>TIME TO CHECK IN</h2>
      <p>Your weekly data is assembled and ready for review.</p>
      <a href="${d.appUrl}/checkin" style="${btnStyle}">START CHECK-IN</a>
    `),
  },
  monthly_review_due: {
    subject: () => 'Time for your monthly review',
    body: (d) => wrap(`
      <h2>MONTHLY STRATEGIC REVIEW</h2>
      <p>Your coaching team wants to check if your journey is still on track.</p>
      <a href="${d.appUrl}/checkin?type=strategic" style="${btnStyle}">START REVIEW</a>
    `),
  },
  plan_locked_in: {
    subject: () => 'Your week is planned',
    body: (d) => wrap(`
      <h2>PLAN LOCKED IN</h2>
      <p>Your coaching team finalized this week's plan.</p>
      <a href="${d.appUrl}/plan" style="${btnStyle}">VIEW PLAN</a>
    `),
  },
  health_flag: {
    subject: () => 'Your coaching team flagged something',
    body: (d) => wrap(`
      <h2>ATTENTION NEEDED</h2>
      <p>${d.message}</p>
      <a href="${d.appUrl}/dashboard" style="${btnStyle}">VIEW DASHBOARD</a>
    `),
  },
  milestone_achieved: {
    subject: (d) => `Milestone reached: ${d.milestone}`,
    body: (d) => wrap(`
      <h2>MILESTONE REACHED</h2>
      <p>${d.milestone}</p>
      <p>Take a second to let that sink in.</p>
      <a href="${d.appUrl}/program" style="${btnStyle}">VIEW JOURNEY</a>
    `),
  },
  intake_resume: {
    subject: () => 'Continue your intake',
    body: (d) => wrap(`
      <h2>PICK UP WHERE YOU LEFT OFF</h2>
      <p>Your coaching intake is waiting for you.</p>
      <a href="${d.appUrl}/intake" style="${btnStyle}">CONTINUE INTAKE</a>
    `),
  },
  welcome: {
    subject: () => "Welcome — let's get started",
    body: (d) => wrap(`
      <h2>WELCOME, ${d.athleteName.toUpperCase()}</h2>
      <p>Your coaching platform is ready. Let's build your coaching team.</p>
      <a href="${d.appUrl}/intake" style="${btnStyle}">START INTAKE</a>
    `),
  },
  wearable_disconnected: {
    subject: (d) => `Your ${d.provider} stopped syncing`,
    body: (d) => wrap(`
      <h2>SYNC ISSUE</h2>
      <p>We haven't received data from your ${d.provider} in 48 hours.</p>
      <a href="${d.appUrl}/settings" style="${btnStyle}">CHECK CONNECTION</a>
    `),
  },
};

const btnStyle = 'display:inline-block;background:#18181b;color:#fafaf7;padding:12px 28px;font-family:"JetBrains Mono",monospace;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-decoration:none;';

function wrap(content: string): string {
  return `
    <div style="max-width:560px;margin:0 auto;font-family:'DM Sans',Helvetica,Arial,sans-serif;color:#18181b;background:#f5f5f0;padding:32px;">
      <div style="border:3px solid #18181b;background:#fafaf7;padding:32px;">
        ${content}
      </div>
      <p style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#71717a;text-align:center;margin-top:16px;letter-spacing:1px;">
        COACHING PLATFORM
      </p>
    </div>
  `;
}

export function renderEmail(type: NotificationType, data: TemplateData) {
  const template = TEMPLATES[type];
  return {
    subject: template.subject(data),
    html: template.body(data),
  };
}
```

- [ ] **Step 3: Create email client**

Create `lib/email/client.ts`:
```typescript
import { Resend } from 'resend';
import { renderEmail } from './templates';
import { NON_DISABLEABLE, type NotificationType, type EmailPayload } from './types';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'coach@example.com';

export async function sendNotification(
  to: string,
  type: NotificationType,
  data: Record<string, string>,
  isEnabled: boolean = true,
): Promise<{ sent: boolean; reason?: string }> {
  // Health flags cannot be disabled
  if (!isEnabled && !NON_DISABLEABLE.includes(type)) {
    return { sent: false, reason: 'disabled_by_user' };
  }

  const { subject, html } = renderEmail(type, {
    athleteName: data.athleteName ?? 'Athlete',
    appUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
    ...data,
  });

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
  });

  if (error) {
    console.error(`[Email] Failed to send ${type} to ${to}:`, error);
    return { sent: false, reason: error.message };
  }

  return { sent: true };
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/email/
git commit -m "feat: add email service skeleton with Resend client and Brutalist templates"
```

---

## Task 8: Auth Flow — Invite-Only Signup & Login

**Files:**
- Create: `lib/auth/invite.ts`
- Create: `lib/auth/types.ts`
- Create: `app/auth/login/page.tsx`
- Create: `app/auth/signup/page.tsx`
- Create: `app/auth/callback/route.ts`
- Create: `app/auth/error/page.tsx`
- Create: `app/api/invite/validate/route.ts`
- Create: `app/api/invite/route.ts`
- Create: `__tests__/lib/auth/invite.test.ts`

- [ ] **Step 1: Write failing test for invite validation**

Create `__tests__/lib/auth/invite.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { generateInviteCode, isValidInviteFormat } from '@/lib/auth/invite';

describe('invite codes', () => {
  it('generates a code with correct format', () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateInviteCode()));
    expect(codes.size).toBe(100);
  });

  it('validates correct format', () => {
    expect(isValidInviteFormat('ABCD-1234-EFGH')).toBe(true);
  });

  it('rejects incorrect format', () => {
    expect(isValidInviteFormat('abc')).toBe(false);
    expect(isValidInviteFormat('')).toBe(false);
    expect(isValidInviteFormat('ABCD-1234')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/lib/auth/invite.test.ts
# Expected: FAIL — module not found
```

- [ ] **Step 3: Create auth types**

Create `lib/auth/types.ts`:
```typescript
export interface InviteCode {
  id: string;
  code: string;
  createdBy: string;
  usedBy: string | null;
  expiresAt: string | null;
  usedAt: string | null;
  createdAt: string;
}
```

- [ ] **Step 4: Create invite logic**

Create `lib/auth/invite.ts`:
```typescript
import { randomBytes } from 'crypto';

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(12);
  const segments: string[] = [];

  for (let s = 0; s < 3; s++) {
    let segment = '';
    for (let i = 0; i < 4; i++) {
      segment += chars[bytes[s * 4 + i] % chars.length];
    }
    segments.push(segment);
  }

  return segments.join('-');
}

export function isValidInviteFormat(code: string): boolean {
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
}
```

- [ ] **Step 5: Run invite tests**

```bash
npx vitest run __tests__/lib/auth/invite.test.ts
# Expected: All tests PASS
```

- [ ] **Step 6: Create invite validation API route**

Create `app/api/invite/validate/route.ts`:
```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/server';
import { isValidInviteFormat } from '@/lib/auth/invite';

export async function POST(request: NextRequest) {
  const { code } = await request.json();

  if (!code || !isValidInviteFormat(code)) {
    return NextResponse.json({ valid: false, error: 'Invalid code format' }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('invite_codes')
    .select('id, code, expires_at, used_by')
    .eq('code', code)
    .is('used_by', null)
    .single();

  if (error || !data) {
    return NextResponse.json({ valid: false, error: 'Invalid or used invite code' }, { status: 404 });
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, error: 'Invite code expired' }, { status: 410 });
  }

  return NextResponse.json({ valid: true });
}
```

- [ ] **Step 7: Create invite management API route (admin only)**

Create `app/api/invite/route.ts`:
```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server';
import { generateInviteCode } from '@/lib/auth/invite';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check admin status
  const admin = createAdminSupabase();
  const { data: athlete } = await admin
    .from('athletes')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!athlete?.is_admin) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const expiresInDays = (body as Record<string, unknown>).expiresInDays as number | undefined;

  const code = generateInviteCode();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
    : null;

  const { error } = await admin.from('invite_codes').insert({
    code,
    created_by: user.id,
    expires_at: expiresAt,
  });

  if (error) {
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
  }

  return NextResponse.json({ code, expiresAt });
}

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const { data: athlete } = await admin
    .from('athletes')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!athlete?.is_admin) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: invites } = await admin
    .from('invite_codes')
    .select('*')
    .order('created_at', { ascending: false });

  return NextResponse.json({ invites: invites ?? [] });
}
```

- [ ] **Step 8: Create auth callback route**

Create `app/auth/callback/route.ts`:
```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirect') ?? '/dashboard';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );

    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(redirectTo, request.url));
}
```

- [ ] **Step 9: Create login page**

Create `app/auth/login/page.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { Box, Button, TextField, Typography, Divider, Alert } from '@mui/material';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  }

  async function handleMagicLink() {
    if (!email) return;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
    } else {
      setMagicLinkSent(true);
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Box sx={{ width: 400, border: 3, borderColor: 'primary.main', bgcolor: 'background.paper', p: 4 }}>
        <Typography variant="h3" gutterBottom>Sign In</Typography>

        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 0 }}>{error}</Alert>}

        <Button
          fullWidth
          variant="contained"
          onClick={handleGoogleLogin}
          sx={{ mb: 2, py: 1.5 }}
        >
          Continue with Google
        </Button>

        <Divider sx={{ my: 2 }}>
          <Typography variant="caption" color="text.secondary">OR</Typography>
        </Divider>

        {magicLinkSent ? (
          <Alert severity="success" sx={{ borderRadius: 0 }}>
            Check your email for a magic link to sign in.
          </Alert>
        ) : (
          <>
            <TextField
              fullWidth
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Button
              fullWidth
              variant="outlined"
              onClick={handleMagicLink}
              sx={{ py: 1.5 }}
            >
              Send Magic Link
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 10: Create signup page (invite-only)**

Create `app/auth/signup/page.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Box, Button, TextField, Typography, Alert } from '@mui/material';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState(searchParams.get('code') ?? '');
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  async function validateInvite() {
    setError('');
    const res = await fetch('/api/invite/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: inviteCode.toUpperCase() }),
    });
    const data = await res.json();
    if (data.valid) {
      setValidated(true);
    } else {
      setError(data.error ?? 'Invalid invite code');
    }
  }

  async function handleGoogleSignup() {
    // Store invite code in localStorage for post-auth processing
    localStorage.setItem('invite_code', inviteCode.toUpperCase());
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=/intake`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Box sx={{ width: 400, border: 3, borderColor: 'primary.main', bgcolor: 'background.paper', p: 4 }}>
        <Typography variant="h3" gutterBottom>Join</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter your invite code to get started.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 0 }}>{error}</Alert>}

        {!validated ? (
          <>
            <TextField
              fullWidth
              placeholder="XXXX-XXXX-XXXX"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              sx={{ mb: 2 }}
              inputProps={{ style: { textTransform: 'uppercase', letterSpacing: '2px' } }}
            />
            <Button fullWidth variant="contained" onClick={validateInvite} sx={{ py: 1.5 }}>
              Validate Code
            </Button>
          </>
        ) : (
          <>
            <Alert severity="success" sx={{ mb: 2, borderRadius: 0 }}>
              Invite code valid. Create your account.
            </Alert>
            <Button fullWidth variant="contained" onClick={handleGoogleSignup} sx={{ py: 1.5 }}>
              Continue with Google
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 11: Create auth error page**

Create `app/auth/error/page.tsx`:
```typescript
import { Box, Typography, Button } from '@mui/material';
import Link from 'next/link';

export default function AuthErrorPage() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Box sx={{ width: 400, border: 3, borderColor: 'error.main', bgcolor: 'background.paper', p: 4, textAlign: 'center' }}>
        <Typography variant="h3" color="error" gutterBottom>Auth Error</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Something went wrong during authentication. Please try again.
        </Typography>
        <Button component={Link} href="/auth/login" variant="contained">
          Back to Login
        </Button>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 12: Commit**

```bash
git add lib/auth/ app/auth/ app/api/invite/ __tests__/lib/auth/
git commit -m "feat: add invite-only auth flow with Google OAuth, magic link, and invite management"
```

---

## Task 9: App Shell — Providers, Layout, Navigation

**Files:**
- Create: `components/Providers.tsx`
- Create: `components/ThemeRegistry.tsx`
- Create: `components/AppShell.tsx`
- Create: `components/PalettePicker.tsx`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/page.tsx`
- Create: `app/dashboard/page.tsx`
- Create: `app/settings/page.tsx`
- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`
- Create: `lib/constants.ts`

- [ ] **Step 1: Create constants**

Create `lib/constants.ts`:
```typescript
export const APP_NAME = 'Coaching Platform';

export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: 'Dashboard' },
  { label: 'Daily Log', href: '/log', icon: 'EditNote' },
  { label: 'Session', href: '/session', icon: 'FitnessCenter' },
  { label: 'Plan', href: '/plan', icon: 'CalendarMonth' },
  { label: 'Program', href: '/program', icon: 'Timeline' },
  { label: 'Trends', href: '/trends', icon: 'TrendingUp' },
  { label: 'Check-in', href: '/checkin', icon: 'Checklist' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
] as const;

export const MOBILE_NAV_ITEMS = NAV_ITEMS.slice(0, 4); // Dashboard, Log, Session, Plan

export const PALETTE_STORAGE_KEY = 'coaching-platform-palette';
export const THEME_MODE_STORAGE_KEY = 'coaching-platform-theme-mode';
```

- [ ] **Step 2: Create ThemeRegistry**

Create `components/ThemeRegistry.tsx`:
```typescript
'use client';

import { useState, useMemo, createContext, useContext, useCallback, useEffect } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { buildTheme } from '@/lib/theme/theme';
import { getPalette, DEFAULT_PALETTE_ID } from '@/lib/theme/palettes';
import type { ThemeMode } from '@/lib/theme/types';
import { PALETTE_STORAGE_KEY, THEME_MODE_STORAGE_KEY } from '@/lib/constants';

interface ThemeContextValue {
  paletteId: string;
  mode: ThemeMode;
  setPaletteId: (id: string) => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  paletteId: DEFAULT_PALETTE_ID,
  mode: 'light',
  setPaletteId: () => {},
  setMode: () => {},
});

export function useThemeContext() {
  return useContext(ThemeContext);
}

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [paletteId, setPaletteIdState] = useState(DEFAULT_PALETTE_ID);
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    const savedPalette = localStorage.getItem(PALETTE_STORAGE_KEY);
    const savedMode = localStorage.getItem(THEME_MODE_STORAGE_KEY) as ThemeMode | null;
    if (savedPalette) setPaletteIdState(savedPalette);
    if (savedMode) setModeState(savedMode);
  }, []);

  const setPaletteId = useCallback((id: string) => {
    setPaletteIdState(id);
    localStorage.setItem(PALETTE_STORAGE_KEY, id);
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem(THEME_MODE_STORAGE_KEY, m);
  }, []);

  const theme = useMemo(() => {
    const palette = getPalette(paletteId);
    return buildTheme(mode === 'light' ? palette.light : palette.dark, mode);
  }, [paletteId, mode]);

  return (
    <ThemeContext.Provider value={{ paletteId, mode, setPaletteId, setMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 3: Create Providers**

Create `components/Providers.tsx`:
```typescript
'use client';

import ThemeRegistry from './ThemeRegistry';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeRegistry>
      {children}
    </ThemeRegistry>
  );
}
```

- [ ] **Step 4: Create AppShell**

Create `components/AppShell.tsx`:
```typescript
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Box, Drawer, List, ListItemButton, ListItemText, Typography, BottomNavigation, BottomNavigationAction, useMediaQuery, useTheme } from '@mui/material';
import { Dashboard, EditNote, FitnessCenter, CalendarMonth, Timeline, TrendingUp, Checklist, Settings, MoreHoriz } from '@mui/icons-material';
import { NAV_ITEMS, MOBILE_NAV_ITEMS, APP_NAME } from '@/lib/constants';

const ICON_MAP: Record<string, React.ReactNode> = {
  Dashboard: <Dashboard />,
  EditNote: <EditNote />,
  FitnessCenter: <FitnessCenter />,
  CalendarMonth: <CalendarMonth />,
  Timeline: <Timeline />,
  TrendingUp: <TrendingUp />,
  Checklist: <Checklist />,
  Settings: <Settings />,
};

const DRAWER_WIDTH = 220;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Don't render shell on auth pages
  if (pathname.startsWith('/auth')) {
    return <>{children}</>;
  }

  if (isMobile) {
    return (
      <Box sx={{ pb: 7 }}>
        {children}
        <BottomNavigation
          value={MOBILE_NAV_ITEMS.findIndex((item) => pathname.startsWith(item.href))}
          sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, borderTop: 3, borderColor: 'primary.main', zIndex: 1200 }}
        >
          {MOBILE_NAV_ITEMS.map((item) => (
            <BottomNavigationAction
              key={item.href}
              label={item.label}
              icon={ICON_MAP[item.icon]}
              component={Link}
              href={item.href}
              sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '1px' }}
            />
          ))}
          <BottomNavigationAction label="More" icon={<MoreHoriz />} />
        </BottomNavigation>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, borderRight: 3, borderColor: 'primary.main' },
        }}
      >
        <Box sx={{ p: 2, borderBottom: 3, borderColor: 'primary.main' }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>{APP_NAME}</Typography>
        </Box>
        <List>
          {NAV_ITEMS.map((item) => (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={pathname.startsWith(item.href)}
              sx={{
                borderLeft: pathname.startsWith(item.href) ? 3 : 0,
                borderColor: 'primary.main',
                '&.Mui-selected': { bgcolor: 'action.hover' },
              }}
            >
              {ICON_MAP[item.icon]}
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ variant: 'subtitle2', sx: { ml: 1 } }}
              />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, minHeight: '100vh', bgcolor: 'background.default' }}>
        {children}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 5: Create PalettePicker**

Create `components/PalettePicker.tsx`:
```typescript
'use client';

import { Box, Typography, Button } from '@mui/material';
import { useThemeContext } from './ThemeRegistry';
import { palettes, getAllPaletteIds } from '@/lib/theme/palettes';

export default function PalettePicker() {
  const { paletteId, setPaletteId, mode, setMode } = useThemeContext();

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Theme</Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <Button
          variant={mode === 'light' ? 'contained' : 'outlined'}
          onClick={() => setMode('light')}
          size="small"
        >
          Light
        </Button>
        <Button
          variant={mode === 'dark' ? 'contained' : 'outlined'}
          onClick={() => setMode('dark')}
          size="small"
        >
          Dark
        </Button>
      </Box>

      <Typography variant="h6" gutterBottom>Palette</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
        {getAllPaletteIds().map((id) => {
          const palette = palettes[id];
          const colors = palette.light;
          const isSelected = id === paletteId;

          return (
            <Box
              key={id}
              onClick={() => setPaletteId(id)}
              sx={{
                border: 3,
                borderColor: isSelected ? 'secondary.main' : 'primary.main',
                p: 2,
                cursor: 'pointer',
                bgcolor: colors.background,
                '&:hover': { borderColor: 'secondary.main' },
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ color: colors.textPrimary, mb: 1 }}
              >
                {palette.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {[colors.primary, colors.secondary, colors.success, colors.warning, colors.error].map((c, i) => (
                  <Box key={i} sx={{ width: 20, height: 20, bgcolor: c, border: 1, borderColor: colors.divider }} />
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 6: Create root layout**

Create `app/layout.tsx`:
```typescript
import type { Metadata } from 'next';
import Providers from '@/components/Providers';
import AppShell from '@/components/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Coaching Platform',
  description: 'AI-powered coaching for every athlete',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Libre+Franklin:wght@700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Create globals.css**

Create `app/globals.css`:
```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 8: Create root page (redirect)**

Create `app/page.tsx`:
```typescript
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function RootPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  } else {
    redirect('/auth/login');
  }
}
```

- [ ] **Step 9: Create dashboard shell**

Create `app/dashboard/page.tsx`:
```typescript
import { Box, Typography } from '@mui/material';

export default function DashboardPage() {
  return (
    <Box>
      <Typography variant="h2">Dashboard</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Full dashboard coming in Phase 4.
      </Typography>
    </Box>
  );
}
```

- [ ] **Step 10: Create settings page with palette picker**

Create `app/settings/page.tsx`:
```typescript
import { Box, Typography } from '@mui/material';
import PalettePicker from '@/components/PalettePicker';

export default function SettingsPage() {
  return (
    <Box>
      <Typography variant="h2" gutterBottom>Settings</Typography>
      <Box sx={{ maxWidth: 600, mt: 3 }}>
        <PalettePicker />
      </Box>
    </Box>
  );
}
```

- [ ] **Step 11: Create admin layout (404 for non-admin)**

Create `app/admin/layout.tsx`:
```typescript
import { notFound } from 'next/navigation';
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) notFound();

  const admin = createAdminSupabase();
  const { data: athlete } = await admin
    .from('athletes')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!athlete?.is_admin) notFound();

  return <>{children}</>;
}
```

- [ ] **Step 12: Create admin dashboard shell**

Create `app/admin/page.tsx`:
```typescript
import { Box, Typography } from '@mui/material';

export default function AdminPage() {
  return (
    <Box>
      <Typography variant="h2">Admin</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Athletes overview, flagged items, coach log, system health, invites. Full implementation in Phase 4.
      </Typography>
    </Box>
  );
}
```

- [ ] **Step 13: Commit**

```bash
git add components/ app/ lib/constants.ts
git commit -m "feat: add app shell with sidebar nav, palette picker, auth pages, and admin skeleton"
```

---

## Task 10: GDPR API Routes

**Files:**
- Create: `app/api/athlete/export/route.ts`
- Create: `app/api/athlete/delete/route.ts`

- [ ] **Step 1: Create data export route**

Create `app/api/athlete/export/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const athleteId = user.id;

  // Fetch all athlete data in parallel
  const [
    { data: profile },
    { data: journeys },
    { data: dailyLogs },
    { data: dailyNotes },
    { data: sessionLogs },
    { data: sessionSets },
    { data: sessionCardio },
    { data: weeklyMetrics },
    { data: ceilingHistory },
    { data: planItems },
    { data: strategicReviews },
    { data: wearableData },
    { data: nutritionData },
    { data: dexaScans },
    { data: consents },
  ] = await Promise.all([
    supabase.from('athlete_profiles').select('*').eq('athlete_id', athleteId).single(),
    supabase.from('journeys').select('*').eq('athlete_id', athleteId),
    supabase.from('daily_logs').select('*').eq('athlete_id', athleteId),
    supabase.from('daily_notes').select('*').eq('athlete_id', athleteId),
    supabase.from('session_logs').select('*').eq('athlete_id', athleteId),
    supabase.from('session_sets').select('*').eq('athlete_id', athleteId),
    supabase.from('session_cardio').select('*').eq('athlete_id', athleteId),
    supabase.from('weekly_metrics').select('*').eq('athlete_id', athleteId),
    supabase.from('ceiling_history').select('*').eq('athlete_id', athleteId),
    supabase.from('plan_items').select('*').eq('athlete_id', athleteId),
    supabase.from('strategic_reviews').select('*').eq('athlete_id', athleteId),
    supabase.from('wearable_data_daily').select('*').eq('athlete_id', athleteId),
    supabase.from('nutrition_data_daily').select('*').eq('athlete_id', athleteId),
    supabase.from('dexa_scans').select('*').eq('athlete_id', athleteId),
    supabase.from('consent_records').select('*').eq('athlete_id', athleteId),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    athlete_id: athleteId,
    profile,
    journeys,
    daily_logs: dailyLogs,
    daily_notes: dailyNotes,
    session_logs: sessionLogs,
    session_sets: sessionSets,
    session_cardio: sessionCardio,
    weekly_metrics: weeklyMetrics,
    ceiling_history: ceilingHistory,
    plan_items: planItems,
    strategic_reviews: strategicReviews,
    wearable_data: wearableData,
    nutrition_data: nutritionData,
    dexa_scans: dexaScans,
    consent_records: consents,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="athlete-export-${athleteId}.json"`,
    },
  });
}
```

- [ ] **Step 2: Create data deletion route**

Create `app/api/athlete/delete/route.ts`:
```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Require explicit confirmation
  const body = await request.json();
  if (body.confirm !== 'DELETE_ALL_MY_DATA') {
    return NextResponse.json(
      { error: 'Must confirm with body: { "confirm": "DELETE_ALL_MY_DATA" }' },
      { status: 400 },
    );
  }

  const admin = createAdminSupabase();

  // Delete athlete record — CASCADE will handle all related tables
  const { error } = await admin
    .from('athletes')
    .delete()
    .eq('id', user.id);

  if (error) {
    console.error('[GDPR Delete] Failed:', error);
    return NextResponse.json({ error: 'Deletion failed' }, { status: 500 });
  }

  // Delete Supabase Auth user
  const { error: authError } = await admin.auth.admin.deleteUser(user.id);

  if (authError) {
    console.error('[GDPR Delete] Auth deletion failed:', authError);
    // Data is already gone, auth will be orphaned — flag for manual cleanup
  }

  return NextResponse.json({ deleted: true, athlete_id: user.id });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/athlete/
git commit -m "feat: add GDPR data export and deletion API routes"
```

---

## Task 11: Admin API Routes

**Files:**
- Create: `app/api/admin/athletes/route.ts`
- Create: `app/api/admin/health/route.ts`

- [ ] **Step 1: Create athletes list route**

Create `app/api/admin/athletes/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const admin = createAdminSupabase();
  const { data: athlete } = await admin
    .from('athletes')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!athlete?.is_admin) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: athletes } = await admin
    .from('athletes')
    .select(`
      id, email, display_name, status, created_at, onboarding_completed_at,
      athlete_profiles (experience_level),
      journeys (id, goal_type, status, target_event)
    `)
    .order('created_at', { ascending: false });

  return NextResponse.json({ athletes: athletes ?? [] });
}
```

- [ ] **Step 2: Create system health route**

Create `app/api/admin/health/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const admin = createAdminSupabase();
  const { data: athlete } = await admin
    .from('athletes')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!athlete?.is_admin) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Basic health stats
  const [
    { count: athleteCount },
    { count: activeJourneys },
    { count: wearableConnections },
  ] = await Promise.all([
    admin.from('athletes').select('*', { count: 'exact', head: true }),
    admin.from('journeys').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('wearable_connections').select('*', { count: 'exact', head: true }).eq('status', 'connected'),
  ]);

  return NextResponse.json({
    athletes: athleteCount ?? 0,
    active_journeys: activeJourneys ?? 0,
    wearable_connections: wearableConnections ?? 0,
    timestamp: new Date().toISOString(),
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/
git commit -m "feat: add admin API routes for athletes list and system health"
```

---

## Task 12: Dockerfile & Deployment Config

**Files:**
- Create: `Dockerfile`
- Create: `app/api/health/route.ts`

- [ ] **Step 1: Create health check route**

Create `app/api/health/route.ts`:
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
```

- [ ] **Step 2: Create Dockerfile**

Create `Dockerfile`:
```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Runtime
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
```

- [ ] **Step 3: Update next.config.ts for standalone output**

Modify `next.config.ts` to include:
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

- [ ] **Step 4: Verify build**

```bash
npm run build
# Expected: Build succeeds with standalone output
```

- [ ] **Step 5: Commit**

```bash
git add Dockerfile next.config.ts app/api/health/
git commit -m "feat: add Dockerfile and health check route for Railway deployment"
```

---

## Task 13: Run All Tests & Final Verification

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
# Expected: All tests pass (palettes, model-router, escalation, normalize, invite)
```

- [ ] **Step 2: Verify build**

```bash
npm run build
# Expected: Build succeeds
```

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev
# Expected: Dev server starts, login page renders at localhost:3000/auth/login
# Ctrl+C to stop
```

- [ ] **Step 4: Final commit if any changes**

```bash
git status
# If changes exist:
git add -A
git commit -m "fix: final Phase 1 adjustments after verification"
```

---

## Phase Transition: Phase 1 → Phase 2

### Phase 1 Verification Checklist

Before starting Phase 2, confirm:

- [ ] All tests pass (`npx vitest run`)
- [ ] Build succeeds (`npm run build`)
- [ ] Supabase migrations applied (9 migrations, all tables + RLS)
- [ ] Auth flow works: Google OAuth login → redirect to dashboard
- [ ] Invite code validation works via API
- [ ] Settings page renders with working palette picker (4 themes, light/dark toggle)
- [ ] Admin layout returns 404 for non-admin users
- [ ] Terra webhook endpoint accepts POST requests
- [ ] Health check endpoint returns 200
- [ ] Docker build succeeds

### Kickoff Prompt for Phase 2

Copy-paste this to start Phase 2:

```
I'm continuing development on the multi-user coaching platform (coaching-platform repo at /Users/martinlevie/AI/coaching-platform).

Phase 1 (Foundation) is complete. The following is in place:
- Supabase PostgreSQL with full multi-tenant schema (9 migrations, RLS on all tables)
- Auth: Google OAuth + magic link + invite-only signup
- Design system: Light Brutalist with 4 curated palettes (Concrete, Midnight, Forest, Ember)
- AI service layer with model tier routing (Opus/Sonnet/Haiku) and dynamic escalation
- Terra API skeleton with webhook receiver and data normalization functions
- Email service skeleton with Resend and Brutalist email templates
- App shell with sidebar nav, mobile bottom nav, palette picker in settings
- Admin route group (404 for non-admin)
- GDPR routes (data export + deletion)
- Dockerfile for Railway deployment

The full product spec is at: /Users/martinlevie/AI/Coach/docs/design/2026-04-05-multi-user-coaching-platform-design.md

Phase 2 is: Data Pipeline — Full Terra wearable integration, Garmin nutrition custom connector migration, data normalization for all sources, DEXA PDF upload + AI extraction, wearable data freshness monitoring, nutrition data pipeline.

Please write the Phase 2 implementation plan following the same format as Phase 1 (at /Users/martinlevie/AI/Coach/docs/design/plans/2026-04-06-phase-1-foundation.md). Use the writing-plans skill. Save it to docs/design/plans/YYYY-MM-DD-phase-2-data-pipeline.md.
```
