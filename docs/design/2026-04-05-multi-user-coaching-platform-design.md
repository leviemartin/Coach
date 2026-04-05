# Multi-User AI Coaching Platform — Product Design Spec

**Date:** April 5, 2026
**Status:** Approved
**Author:** Martin Levie + Claude
**Related:** [Competitive Landscape Research](competitive-landscape-research.md) | [Mockups](mockups/)

---

## 1. Product Vision

Transform the single-user OCR Training Coach into a multi-user, goal-agnostic AI coaching platform. Athletes receive a personalized team of AI coaching specialists — generated from deep research into their specific discipline — that adapts to their goals, lifestyle, and wearable data.

**Positioning:** "The coaching team that understands your actual life." Multi-domain coaching integration (training + nutrition + recovery + sleep + life context) with transparent AI reasoning. Serves comeback athletes, parents, busy professionals, and multi-discipline athletes — the segments consistently underserved by single-domain fitness apps.

**Business model:** Invite-only beta. Product owner (Martin) manages the platform. AI is the coach; athletes interact directly. No billing at launch — monetization ($20-40/month target) comes later.

**Target price point:** $20-40/month positions above single-domain tools (MacroFactor $6-12, Freeletics $8-11) and far below human coaching (Future $150-199, Caliber Premium $200+). Value prop: 7+ specialist AI coaches for the price of one app subscription.

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **App framework** | Next.js + React + MUI | Proven in current app, design system built on it |
| **Database** | PostgreSQL on Supabase | Multi-tenant ready, concurrent writes, Row-Level Security |
| **Auth** | Supabase Auth | Google OAuth (primary), magic link (secondary), TOTP MFA |
| **App hosting** | Railway | Docker container, proven deployment pipeline |
| **Wearable data** | Terra API + custom connector plugins | Single aggregator for 200+ devices, plugin model for gaps |
| **AI engine** | Claude API (Anthropic SDK) | Tiered: Opus / Sonnet / Haiku by moment importance |
| **Email** | Resend or Postmark | Transactional only, good deliverability, free tier |
| **Design system** | Light Brutalist | 3px borders, 0 border-radius, JetBrains Mono + DM Sans + Libre Franklin |

**Codebase approach:** New app from scratch in a separate repo. The current OCR Training Coach stays live on Railway. A migration tool imports Martin's full history as athlete #1 when the new platform is ready.

---

## 3. Multi-Tenant Architecture & Data Model

### Tenant Isolation

Every row in every table has an `athlete_id` foreign key. Supabase Row-Level Security (RLS) policies enforce that authenticated users can only read/write their own data. Even if application code has a bug, the database blocks cross-tenant access.

### Core Schema

```
athletes
  ├── id (UUID, from Supabase Auth)
  ├── email, display_name, avatar_url
  ├── created_at, onboarding_completed_at
  ├── invite_code (how they got in)
  └── status (invited / onboarding / active / paused / archived)

athlete_profiles
  ├── athlete_id FK
  ├── height_cm, weight_kg, frame_size
  ├── date_of_birth, gender
  ├── experience_level (beginner / intermediate / advanced / comeback)
  ├── training_history_summary (structured JSON)
  ├── lifestyle_constraints (structured JSON — family, work, schedule)
  ├── injury_history (structured JSON)
  ├── equipment_access (structured JSON — gym, home, outdoor)
  ├── nutrition_preferences (structured JSON)
  └── mental_profile (structured JSON — motivation style, accountability preference)

journeys
  ├── athlete_id FK
  ├── goal_type (OCR / marathon / powerlifting / general_fitness / weight_loss / hybrid / custom)
  ├── target_event (nullable — name, date, location)
  ├── target_metrics (JSON — race weight, time goal, strength targets, etc.)
  ├── status (planning / active / paused / completed / abandoned)
  ├── started_at, target_date, completed_at
  └── periodization (JSON — phases with dates, gates, milestones)

coaching_teams
  ├── journey_id FK
  ├── coach_slot (0-7, slot 0 = Head Coach always)
  ├── coach_type (universal / goal_specific)
  ├── persona_name, domain, responsibilities
  ├── persona_content (full markdown persona)
  ├── diagnostic_rules (JSON)
  ├── conflict_priority (integer)
  └── generated_at, research_sources (JSON)

daily_logs (per athlete per day — belongs to athlete, not journey)
session_logs, session_sets, session_cardio (per athlete)
weekly_metrics (per athlete per week)
plan_items (per athlete per journey)
ceiling_history (per athlete)
strategic_reviews (monthly/quarterly check-in records)
consent_records (GDPR consent tracking)
wearable_connections (per athlete, encrypted tokens)
invite_codes (admin-managed)
notification_preferences (per athlete per notification type)
dexa_scans (per athlete)
```

### Key Data Model Decisions

- **Journey is the central organizing concept.** One active journey per athlete. Past journeys archived with full history. Mid-journey updates modify the active journey. End-of-journey closes it and can spawn a new one.
- **Coaching teams belong to journeys, not athletes.** New journey = new coaching team generated. Universal coaches carry forward with minor adjustments; goal-specific coaches are regenerated.
- **Daily logs belong to the athlete, not the journey.** Health tracking is continuous regardless of active journey.
- **Coach personas stored in the database, not as markdown files.** Enables per-athlete customization while keeping the schema as the guardrail.

---

## 4. Authentication, Authorization & Security

### Auth Methods

- **Google OAuth (primary)** — pushed as the default signup/login path. One tap, Google handles password security + their own MFA.
- **Magic link via email (secondary)** — for athletes who refuse Google OAuth. Passwordless — one-time token sent to verified email.
- **No email + password.** Removed entirely. No weak passwords in the system.
- **MFA (TOTP)** — optional but encouraged for athletes (prompted during onboarding). **Mandatory for admin account.**

### Invite-Only Flow

1. Admin generates invite code/link from `/admin`
2. Athlete clicks link → signup page with invite code pre-filled
3. Account created → status = `invited`
4. Supabase Auth creates user, RLS active immediately
5. Athlete enters intake → status transitions `invited` → `onboarding` → `active`
6. No public signup page. No account creation without valid invite code.

### Authorization Layers (Defense in Depth)

| Layer | Function |
|---|---|
| **Supabase RLS** | Database-level: athlete can only access rows where `athlete_id = auth.uid()` |
| **API middleware** | Application-level: validates session token, injects `athlete_id` into every query |
| **Admin role** | `is_admin` flag on Martin's account. Read access to all athletes. No other account gets this. |
| **Rate limiting** | Per-user API rate limits, especially on AI endpoints (intake, synthesis, dialogue) |

### Data Protection

- All data encrypted at rest (Supabase default — AES-256)
- All data encrypted in transit (TLS 1.3)
- Session tokens: JWTs with 1-hour expiry + 30-day refresh tokens
- AI API calls send only minimum context needed — no unnecessary athlete data in prompts
- Terra API tokens stored encrypted per-athlete in `wearable_connections`

### GDPR Technical Plumbing (Built Now, Formalized Later)

- `GET /api/athlete/export` — full JSON export of all athlete data
- `DELETE /api/athlete/delete` — hard deletes all data, Supabase Auth account, Terra connection. Irreversible. Double confirmation required.
- `consent_records` table — tracks what the athlete consented to and when
- Athlete can revoke wearable connection at any time (deletes token + synced data)

### Intake Abuse Safeguards

- Validation rules flag dangerous patterns: BMI targets below healthy range, extreme caloric deficits, training volumes incompatible with stated experience, injury descriptions suggesting medical intervention
- Flagged intakes proceed but create an alert in admin feed with the specific concern
- Admin can pause accounts, edit coaching teams, override plan parameters

---

## 5. AI Engine & Coach System

### Coach Roster Model

**5 universal coaches (fixed, maintained by product owner):**

| Slot | Coach | Domain |
|---|---|---|
| 0 | Head Coach | Coordination, conflict resolution, schedule generation |
| 1 | Recovery & Sleep | HRV, readiness, deloads, sleep protocols |
| 2 | Nutrition & Body Comp | Calories, protein, hydration, body comp |
| 3 | Mental Performance & Habits | Compliance, accountability, habit systems |
| 4 | Mobility & Injury Prevention | Pain monitoring, core, prehab, phase gates |

Universal coaches are parameterized per athlete (calorie targets, sleep thresholds, injury watchlists) but the template is fixed.

**2-3 goal-specific coaches (generated per journey via research):**

Generated during intake based on athlete's goal type. The AI performs deep research into best practices for the discipline — periodization models, proven protocols, expert methodology. Each coach fills a strict schema:

```
persona_name       — e.g., "Distance Running Specialist"
domain             — specific area of expertise
responsibilities   — enumerated list
diagnostic_rules   — if X then Y rules, referencing only supported metrics
conflict_priority  — integer ranking
non_negotiable_rules — athlete-specific protocols
tone               — communication style
research_sources   — what informed this persona
```

**The coach schema is the guardrail.** The AI cannot add fields, invent capabilities, or reference unsupported metrics. Schema validation rejects invalid coaches.

### Conflict Resolution Hierarchy

1. **Injury prevention** — Mobility agent has veto power
2. **Recovery** — Recovery agent overrides if combined readiness <35
3. **Athlete feedback** — Adjusts within bounds set by #1 and #2
4. **Race-specific preparation** — Goal-specific agent benchmarks
5. **Long-term progression** — Strength/Endurance agents inform periodization
6. **Sustainability** — Mental Performance agent flags complexity
7. **Optimization** — Nutrition agent fine-tunes around above priorities

### Coach Generation Pipeline

1. **Universal coaches instantiated** — copied from master templates, variables injected from athlete profile
2. **Goal-specific coaches generated** — AI researches discipline, drafts personas filling strict schema (Opus model)
3. **Schema validation** — all fields present, diagnostic rules reference valid metrics, no contradictions
4. **Athlete reviews coaching team** during onboarding — sees each coach's name, domain, responsibilities
5. **Head Coach calibration** — conflict resolution matrix injected based on specific coach combination

### Coaching Operations

**Weekly check-in (same 5-step flow, generalized):**
1. Weekly review — auto-assembled from daily logs, session data, wearable data
2. Subjective inputs — perceived readiness, plan satisfaction, reflection
3. Triage agent — scans assembled data, asks clarifying questions
4. Coach synthesis — all coaches analyze full context, Head Coach synthesizes
5. Head Coach dialogue — athlete discusses, challenges, refines before locking in

**Monthly strategic check-in (new):**
- System evaluates drift signals (compliance trends, goal proximity, pain patterns, life change notes)
- If stable → quick confirm: "Everything on track? Confirm or flag changes."
- If drift detected OR 3 months since last full review → full strategic review
- Can trigger: phase transition, coach roster adjustment, target revision, journey pivot

**Mid-journey reassessment (athlete-initiated):**
- Triggered from Program Timeline page
- Mini-intake: "What changed?" — structured form + 5-8 conversational follow-ups
- AI evaluates impact on current plan
- Can trigger same adjustments as monthly strategic review

### Model Tier Routing

| Moment | Model | Rationale |
|---|---|---|
| Coach generation | Opus | High stakes, research-heavy, infrequent |
| Intake conversational interview | Opus | Nuanced, needs deep follow-up |
| Phase transitions | Opus | Complex periodization logic |
| Injury reassessment | Opus | Safety-critical |
| Mid-journey reassessment | Opus | Significant plan changes |
| Monthly strategic review (full) | Opus | Strategic, infrequent |
| Weekly synthesis | Sonnet | Good enough for tactical planning, 10x cheaper |
| Weekly Head Coach dialogue | Sonnet | Conversational |
| Triage agent | Haiku | Pattern matching, question generation |
| Schema validation | Haiku | Structural checks |
| Monthly quick confirm | Haiku | Simple pass/fail |
| Intake safety validation | Sonnet | Needs judgment |

**Dynamic escalation:** Weekly synthesis auto-upgrades to Opus when:
- Pain level 3 reported
- Compliance drop >30% week-over-week
- Weight change >2kg in one week
- Sleep score average <50 for the week
- Athlete flagged "something changed" in notes
- Phase transition gate approaching (within 2 weeks)

### Adaptability

- **Coach schema** — new fields added as optional, backfilled later
- **Universal roster** — coaches can be promoted/split without breaking existing teams
- **Model routing** — configuration, not code. New models slot in by updating routing rules
- **Escalation rules** — configurable thresholds
- **Team size** — no hard limit on coaches per team
- **New operation types** — weekly/monthly/mid-journey are instances of a general pipeline (assemble → triage → synthesize → dialogue)

---

## 6. Wearable & Nutrition Data Pipeline

### Aggregator: Terra API

Single integration point for all wearables and nutrition apps.

**Supported at launch:**
- Wearables: Garmin, WHOOP, Fitbit, Oura, Apple Health, Google Health Connect
- Nutrition: MyFitnessPal (via Terra)

### Custom Connector Plugin Model

Terra does not support Garmin nutrition data (Garmin's nutrition tracking launched January 2026, Terra hasn't added support). The platform supports "custom connectors" as a plugin model alongside Terra.

- Martin's existing Garmin nutrition connector becomes the first plugin
- Other athletes using MyFitnessPal get nutrition via Terra
- The normalization layer treats all sources equally
- More custom connectors can be added as Terra gaps are discovered

### Connection Flow

1. During onboarding, athlete selects wearable(s) and nutrition app
2. Terra widget handles OAuth — athlete authorizes in-app
3. Tokens stored encrypted in `wearable_connections` (per athlete)
4. Terra sends data via webhooks to API endpoint
5. Athlete can disconnect anytime from settings (deletes token + synced data)

### Normalized Internal Schema

```
wearable_data_daily
  ├── athlete_id, date, source
  ├── sleep (score, duration_min, bedtime, wake_time, quality, stages JSON)
  ├── recovery (score, hrv, rhr, body_battery/equivalent)
  ├── activity (steps, active_calories, total_calories, distance_m)
  ├── stress (avg_score, max_score)
  ├── body_comp (weight_kg, body_fat_pct, muscle_mass_kg)
  └── raw_payload (JSON — full response for reprocessing)

wearable_data_activities
  ├── athlete_id, date, source
  ├── activity_type, duration_min, calories
  ├── avg_hr, max_hr, hr_zones (JSON — normalized to 5 zones)
  ├── training_effect_aerobic, training_effect_anaerobic
  └── raw_payload

nutrition_data_daily
  ├── athlete_id, date, source
  ├── calories, protein_g, carbs_g, fat_g
  ├── hydration_ml
  └── meals (JSON — if available)
```

**Design decisions:**
- Raw payload stored alongside normalized data for reprocessing
- Multiple sources per athlete allowed; conflict resolution by athlete-designated primary
- Not all wearables provide all fields — nulls are fine, coaches adapt
- Data freshness: <4h green, 4-12h amber, >12h red

### DEXA PDF Upload

Separate from wearable pipeline. Athlete uploads PDF → Claude extracts body comp data → stored in `dexa_scans` table. Infrequent (every few months per athlete).

---

## 7. Intake System

Two-phase intake: structured wizard for facts, conversational AI for depth.

### Phase 1: Structured Wizard (5 screens)

**Screen 1 — The Basics:** Display name, date of birth, gender, height, current weight, country/timezone.

**Screen 2 — Your Goal:** Goal type picker (Race Training / Strength / Weight Loss / General Fitness / Hybrid / Custom). Contextual follow-ups per type (event details, target lifts, target weight). Experience level (Beginner / Intermediate / Advanced / Comeback Athlete).

**Screen 3 — Your Setup:** Primary training location, available equipment checklist (contextual), training days per week, preferred session time, average session duration.

**Screen 4 — Connect Your Devices:** Terra widget for wearable connection. Nutrition app connection (MyFitnessPal via Terra, Garmin nutrition via custom connector). "I don't use a wearable" option. DEXA PDF upload (optional).

**Screen 5 — Your Life:** Work schedule type, family situation (partner, kids with ages), known schedule constraints, sleep situation, stress level.

### Phase 2: Conversational AI Interview (Opus)

AI receives all wizard data and conducts a deep-dive interview.

**Required coverage areas:**
- Injury history — past and current, aggravators, treatments
- Training history — what worked, what didn't, longest consistent streak
- Nutrition habits — eating patterns, restrictions, relationship with food (red flag detection)
- Mental/motivational profile — drivers, quit triggers, accountability style
- Goal depth — why this goal, definition of success, minimum acceptable outcome
- Lifestyle deep-dive — follow-ups on wizard answers

**No question limit.** The AI covers all areas to the depth needed. Complex backgrounds get more questions; simple cases wrap up faster.

**Estimated time shown upfront:** "This conversation takes 15-45 minutes depending on your background. It's how your coaching team gets to know you — the more detail you give, the better your plan."

**Save & resume.** Conversation state persisted after every answer. Athlete can close browser and return later. "Continue your intake" appears on dashboard. Context fully preserved.

**Desktop push.** Mobile users see: "For the best experience, we recommend completing your intake on a desktop or laptop." With "Send link to my email" option and "Continue anyway" escape hatch.

**Progress indicator.** Coverage-based (not step count): Basics, Injury History, Training History, Nutrition, Lifestyle, Mental Profile, Goal Depth. Areas fill in as the AI covers them.

**Red flag detection runs in parallel.** Dangerous patterns flagged → alert in admin feed, athlete sees gentle note recommending medical consultation.

**Output:** Structured `athlete_profile` record + `journey` record with initial periodization, ready for coach generation.

### Abbreviated Intakes

**Mid-journey:** Current profile shown (edit what changed). "What changed?" with category options. 5-8 conversational follow-ups focused on the change.

**End-of-journey:** Journey outcomes vs targets review. Conversational reflection (5-8 questions). If starting new journey, flows into full intake with pre-filled data.

---

## 8. Dashboard Page

**Hierarchy:** Score > Plan > Trends. One scroll maximum. Progressive disclosure.

**Mockup:** `docs/design/mockups/dashboard-layout.html`

### Row 1: Composite Readiness Score + Today's Session

**Readiness Score:** Weighted composite of sleep, recovery, nutrition, and training strain from wearable + daily log data. Sub-scores shown as pip bars. Traffic-light coaching decision label from the decision matrix:
- Green: Train as Programmed (>50)
- Yellow: Reduce Volume (35-50)
- Orange: Deload (20-35)
- Red: Rest Day (<20)

**Today's Session:** Session name, focus tags, session count for the week, estimated duration, Start Session button.

### Row 2: Week Overview + Protocol Compliance

**Week strip:** 7-day view showing all sessions with status (done/today/upcoming/rest). Color-coded.

**Compliance bars:** Dynamic, generated from coaching plan. Whatever protocols the coaching team prescribed become trackable items. Universal athletes might have generic items; OCR athletes have Lights Out, Mobility Work, etc.

### Row 3: Trend Sparklines

4 metric cards selected by the coaching team based on current phase priorities. Each shows: current value, trend delta, 7-day sparkline. Tap navigates to full Trends page filtered to that metric.

---

## 9. Trends Page

**Mockup:** `docs/design/mockups/trends-layout.html`

### Time Ranges
7 days / 30 days / 90 days / 6 months / 1 year / Journey (full span from start to now).

### AI Coaching Insight Banner
Proactive, data-grounded insight from the coaching team. Rotates based on current relevance. The market differentiator — nobody else surfaces AI reasoning this way.

### Chart Panels (Dynamic Per Athlete)

Default set, coaching team determines which panels appear:
- **Body Composition** — weight trend (smoothed), muscle mass, body fat %. Current/target/trend.
- **Sleep & Recovery** — sleep score trend, HRV trend, average bedtime.
- **Strength Progression** — ceiling history with category filtering (upper push/pull, lower, etc.).
- **Nutrition** — calorie and protein trends vs targets.
- **Training Load** — ACWR with optimal band visualization + HR zone distribution.
- **Behavior Insights Engine** — multi-variable correlations with confidence levels.

### Behavior Insights Engine

The WHOOP killer feature done richer:
- Correlates continuous variables (bedtime hour, not just binary "slept well")
- Correlates against multiple outcomes (sleep quality, workout performance, weight trend, pain levels)
- Three pattern types: Positive Correlation (green), Negative Correlation (red), Emerging Pattern (blue — needs more data)
- Each insight shows data point count for confidence
- Surfaces proactively: "Your deadlift RPE drops by 0.8 when you sleep before 23:00 AND hit protein targets"

---

## 10. Program Timeline Page

**Mockup:** `docs/design/mockups/program-timeline.html`

### Journey Header
Journey name, start date, target date, current week number, days-to-go countdown, progress bar.

### Phase Timeline
Proportional blocks showing all periodization phases. Current phase highlighted (yellow). Completed phases green. Future phases muted. Phase transition gates shown below with specific requirements.

### Milestones + Top-10 Priorities (Side by Side)

**Milestones:** Achieved (green) and upcoming goals. "Look how far I've come" + "here's what's next."

**Top-10 Priorities:** Ranked list of coaching team's current focus areas. Each shows owning coach and one-line rationale. #1 gets red alert border for critical issues. First 5 shown, expand for rest. **Display only** — athletes raise concerns through check-ins. Reordering is a future consideration.

### Coaching Team Grid

Cards for each coach: universal (dark border) vs goal-specific (blue border). Slot number, type label, name, domain summary. "View Full Profile" opens detail view with complete persona, diagnostic rules, conflict resolution priority.

### Action Bar

- **Request Reassessment** — triggers mid-journey intake flow
- **View Journey History** — shows past completed/abandoned journeys

---

## 11. Daily Log

### Design Principle: Mobile-First Hub

The daily log is the most-used page. Quick taps, not forms. Designed for phone use.

### Fixed Core Fields (Every Athlete)

- Energy level (1-5)
- Pain level (0-3) + body area
- Sleep disruption tags (kids / stress / pain / other)
- Bedtime (actual time)
- Tagged notes (injury / sleep / training / life / other)

### Dynamic Compliance Items (Coach-Generated)

Whatever protocols the coaching team prescribes become trackable toggle items. Examples:
- OCR athlete: Lights Out, Mobility Work, No Food After 20:00, Hydration Logged
- Marathon runner: Foam Rolling, Stretching Routine, Carb Loading
- Powerlifter: Belt Work, Deload Compliance, Grip Training

Compliance items are added/removed when the coaching team updates the plan.

---

## 12. Navigation & Page Structure

### Desktop Sidebar

| Page | Description |
|---|---|
| **Dashboard** | Score > Plan > Trends hero |
| **Daily Log** | Mobile-first daily tracking hub |
| **Session** | Session tracker for gym use |
| **Plan** | Current week's plan with session cards |
| **Program** | Journey timeline, coaches, priorities |
| **Trends** | Analytics, charts, behavior insights |
| **Check-in** | Weekly + monthly strategic check-ins |
| **Settings** | Profile, wearables, theme, data export/delete |

### Mobile Bottom Nav

| Dashboard | Log | Session | Plan | More... |

"More" drawer: Program, Trends, Check-in, Settings.

### Platform Guidance

| Context | Recommended Platform |
|---|---|
| Intake interview | Desktop (pushed) |
| Weekly/monthly check-in | Desktop (recommended) |
| Plan review | Desktop or tablet |
| Daily log | Mobile-first |
| Session tracker (gym) | Mobile-first |
| Dashboard at a glance | Mobile-friendly |
| Program timeline | Desktop (detail-heavy) |
| Trends/analytics | Desktop or tablet |

---

## 13. Email Notifications

**Provider:** Resend or Postmark. Transactional only. No marketing emails.

| Trigger | Email | Timing |
|---|---|---|
| Weekly check-in reminder | "Your weekly check-in is ready" | Sunday 18:00 athlete timezone |
| Monthly strategic review due | "Time for your monthly review" | 1st of month, or drift detected |
| Plan locked in | "Your week is planned" | After check-in completion |
| Urgent health flag | "Your coaching team flagged something" | Wearable threshold breach |
| Journey milestone achieved | "Milestone reached" | Condition met |
| Intake save & resume | "Continue your intake" | 24h after abandoned intake |
| Welcome / onboarding | "Welcome — let's get started" | On account creation |
| Wearable disconnected | "Your [device] stopped syncing" | 48h without data |

Athlete preferences: toggles per type in settings. Health flags cannot be disabled (safety). Email templates follow Brutalist design language.

---

## 14. Admin View

**Route:** `/admin` — returns 404 for non-admin accounts (not 403).

### Pages

**Athletes Overview:** Table with status, journey goal, phase, last check-in, compliance sparkline. Filters by status, goal type, flagged. Click-through to read-only athlete dashboard.

**Flagged Items Feed:** Intake safety flags, coach personas pending review, inactive athletes (>14 days), wearable disconnections (>7 days), system errors. Actions: dismiss, view details, pause account, edit coaching team.

**Coach Generation Log:** Every generated persona with athlete, goal, coaches, research sources, validation status, athlete approval. View/edit full persona content.

**System Health:** AI API cost breakdown per athlete/month, Terra sync status, database health, email delivery stats.

**Invite Management:** Generate codes/links, set expiry, track usage.

Intentionally minimal. Architected for expansion.

---

## 15. Theme & Design System

### Light Brutalist (Carried Forward)

- **Borders:** 3px solid, 0 border-radius everywhere
- **Typography:** Libre Franklin (headings, 900 weight, uppercase), DM Sans (body), JetBrains Mono (data, labels, monospace)
- **Progress indicators:** Pip bars, not circles
- **Cards:** 3px border, no shadow, no rounded corners
- **Buttons:** 0 radius, uppercase, JetBrains Mono, letter-spacing

### Curated Palette Picker

4-5 pre-built color palettes, all designed to work within the Brutalist system:
- Each palette defines: primary, background, paper, accent, success/warning/error, text colors
- Athletes select in settings
- No custom colors — curated only
- Light and dark variants per palette

Palette design is a dedicated task during the UI implementation phase.

---

## 16. Migration (OCR Coach → New Platform)

### What Migrates

| Source | Destination |
|---|---|
| `weekly_metrics` | `weekly_metrics` (add `athlete_id`) |
| `daily_logs` + `daily_notes` | `daily_logs` + `daily_notes` (add `athlete_id`) |
| `session_logs` + `session_sets` + `session_cardio` | Same tables (add `athlete_id`) |
| `ceiling_history` | `ceiling_history` (add `athlete_id`) |
| `plan_items` | `plan_items` (add `athlete_id`, `journey_id`) |
| `dexa_scans` | `dexa_scans` (add `athlete_id`) |
| `state/training_history.md` | Parsed into structured records |
| `state/decisions_log.md` | Parsed into structured records |
| `coaches/*.md` | `coaching_teams` rows under journey #1 |
| `state/periodization.md` | `journeys.periodization` JSON |
| `state/athlete_profile.md` | `athlete_profiles` record |

### Migration Principles

- **Full history preserved** — every weekly metric, every session set, every daily note
- **Narrative content parsed into structured records** — training history and decisions log become first-class DB records
- **Martin becomes athlete #1** with a pre-populated journey (Spartan Ultra Morzine 2027)
- **Migration tool flags parsing ambiguities** for manual review
- **Reversible** — migration can be re-run; old app stays live until confirmed

---

## 17. Build Phases

**Approach:** Foundation-first, then feature layers.

### Phase 1: Foundation
- Supabase setup (PostgreSQL + Auth + RLS)
- Multi-tenant DB schema with all tables
- Design system (Brutalist theme + palette picker infrastructure)
- Terra API skeleton (connection flow, webhook receiver, normalization layer)
- Custom connector plugin model (Garmin nutrition as first plugin)
- AI service layer with model tier routing
- Email service skeleton
- App shell with auth flow (invite-only signup, Google OAuth, magic link, MFA)
- Admin route group skeleton

### Phase 2: Data Pipeline
- Terra wearable integration (full sync for all supported devices)
- Garmin nutrition custom connector migration
- Data normalization for all sources
- DEXA PDF upload + AI extraction
- Wearable data freshness monitoring
- Nutrition data pipeline

### Phase 3: AI Engine
- Coach template schema + validation
- Universal coach master templates (5 coaches)
- Research-backed goal-specific coach generation pipeline
- Intake safety validation rules
- Triage agent (generalized from current)
- Synthesis engine (multi-coach, generalized)
- Head Coach dialogue (generalized)
- Model tier escalation logic
- Conflict resolution matrix builder

### Phase 4: All UI + Flows
- Intake wizard (5 screens) + conversational AI interview + save & resume
- Dashboard (Score > Plan > Trends)
- Daily log (fixed core + dynamic compliance)
- Session tracker (carried forward, multi-tenant)
- Plan creation + preview (card-based)
- Weekly check-in (5-step flow, generalized)
- Monthly strategic check-in (with smart skip logic)
- Trends page (charts + Behavior Insights Engine)
- Program Timeline (journey + coaches + priorities)
- Settings (profile, wearables, theme, data export/delete)
- Admin pages (athletes, flagged items, coach log, system health, invites)

### Phase 5: Integration + Polish
- OCR data migration tool
- Curated palette design (4-5 themes)
- Email notification templates + triggers
- Domain setup + branding
- App naming + domain purchase
- Mobile responsive polish
- GDPR consent flows
- Performance optimization

---

## 18. Competitive Differentiators

Based on [competitive landscape research](competitive-landscape-research.md):

1. **Multi-agent transparency** — nobody shows AI reasoning. Coach debate model is unique.
2. **Behavior Insights Engine** — richer than WHOOP's binary correlation. Multi-variable, continuous, proactive.
3. **Cross-metric correlation** — biggest analytical gap in the market. Sleep x training x nutrition x life context.
4. **Contextual life awareness** — tracking toddler disruptions, work stress, family schedules. Nobody else does this.
5. **Coach-athlete dialogue** — structured check-in flow, not reactive Q&A chat.
6. **Multi-domain integration** — training + nutrition + recovery + sleep in one AI system that understands interactions.
7. **"Journey" time range** — full training arc visualization. No competitor offers this.

---

## 19. Open Items

- **App name** — needs dedicated research session. Coach/mentor + bold/aspirational vibe. .com or .app domain.
- **Palette designs** — 4-5 curated themes to be designed during Phase 4.
- **Exercise library** — table stakes per competitive research (500+ demos). Build vs. license decision needed.
- **Pricing model details** — tiers, annual discount, free trial. Deferred until closer to monetization.
- **Legal** — privacy policy, terms of service, data processing agreements. Deferred until closer to public launch.

---

## Appendix: Mockups

| Mockup | File |
|---|---|
| Dashboard (Desktop) | `docs/design/mockups/dashboard-layout.html` |
| Trends Page (Desktop) | `docs/design/mockups/trends-layout.html` |
| Program Timeline (Desktop) | `docs/design/mockups/program-timeline.html` |
