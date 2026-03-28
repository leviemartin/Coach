# Coach Data Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 8 data flow gaps so coaches receive structured RPE/duration data, weekly metrics persist narrative feedback and health aggregates, and tiered history surfaces effort trends.

**Architecture:** Extend `buildSessionDetailsSection()` in agents.ts to include RPE and duration inline. Add 8 columns to `weekly_metrics`, computed during checkin. Update tiered history formatting. Add diagnostic rules to 6 coach personas and CLAUDE.md.

**Tech Stack:** TypeScript, better-sqlite3, Next.js API routes, Markdown persona files

**Spec:** `docs/superpowers/specs/2026-03-28-coach-data-integration-design.md`

---

### Task 1: Schema & Types — Weekly Metrics Enrichment

**Files:**
- Modify: `dashboard/lib/db.ts` (migrations + upsertWeeklyMetrics + mapMetricsRow)
- Modify: `dashboard/lib/types.ts` (WeeklyMetrics interface)

- [ ] **Step 1: Add 8 new fields to `WeeklyMetrics` interface in `dashboard/lib/types.ts`**

After the existing `sleepDisruptionCount` field (~line 247), add:

```typescript
  avgRpe: number | null;
  hardExerciseCount: number | null;
  weekReflection: string | null;
  nextWeekConflicts: string | null;
  questionsForCoaches: string | null;
  sickDays: number | null;
  painAreasSummary: string | null; // JSON: [{"area":"lower back","days":3,"maxLevel":2}]
  sleepDisruptionBreakdown: string | null; // JSON: {"kids":4,"stress":1}
```

- [ ] **Step 2: Add column migrations in `dashboard/lib/db.ts`**

After the last existing migration block, add:

```typescript
  // Migration: weekly_metrics enrichment for coach data integration
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN avg_rpe REAL`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN hard_exercise_count INTEGER`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN week_reflection TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN next_week_conflicts TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN questions_for_coaches TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN sick_days INTEGER`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN pain_areas_summary TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN sleep_disruption_breakdown TEXT`); } catch { /* exists */ }
```

- [ ] **Step 3: Update `upsertWeeklyMetrics` in `dashboard/lib/db.ts`**

Add the 8 new columns to the INSERT statement and the `.run()` call. The INSERT column list becomes:

```typescript
export function upsertWeeklyMetrics(m: WeeklyMetrics): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO weekly_metrics (
      week_number, check_in_date, weight_kg, body_fat_pct, muscle_mass_kg,
      avg_sleep_score, avg_training_readiness, avg_rhr, avg_hrv,
      calories_avg, protein_avg, hydration_tracked, vampire_compliance_pct,
      rug_protocol_days, sessions_planned, sessions_completed,
      baker_cyst_pain, pullup_count, perceived_readiness, plan_satisfaction, model_used,
      kitchen_cutoff_compliance, avg_energy, pain_days, sleep_disruption_count,
      avg_rpe, hard_exercise_count, week_reflection, next_week_conflicts,
      questions_for_coaches, sick_days, pain_areas_summary, sleep_disruption_breakdown
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    m.weekNumber, m.checkInDate, m.weightKg, m.bodyFatPct, m.muscleMassKg,
    m.avgSleepScore, m.avgTrainingReadiness, m.avgRhr, m.avgHrv,
    m.caloriesAvg, m.proteinAvg, m.hydrationTracked ? 1 : 0,
    m.vampireCompliancePct, m.rugProtocolDays, m.sessionsPlanned,
    m.sessionsCompleted, m.bakerCystPain, m.pullupCount, m.perceivedReadiness, m.planSatisfaction, m.modelUsed,
    m.kitchenCutoffCompliance ?? null, m.avgEnergy ?? null, m.painDays ?? null, m.sleepDisruptionCount ?? null,
    m.avgRpe ?? null, m.hardExerciseCount ?? null, m.weekReflection ?? null, m.nextWeekConflicts ?? null,
    m.questionsForCoaches ?? null, m.sickDays ?? null, m.painAreasSummary ?? null, m.sleepDisruptionBreakdown ?? null
  );
}
```

- [ ] **Step 4: Update `mapMetricsRow` in `dashboard/lib/db.ts`**

Add the 8 new field mappings after `sleepDisruptionCount`:

```typescript
    avgRpe: r.avg_rpe as number | null,
    hardExerciseCount: r.hard_exercise_count as number | null,
    weekReflection: r.week_reflection as string | null,
    nextWeekConflicts: r.next_week_conflicts as string | null,
    questionsForCoaches: r.questions_for_coaches as string | null,
    sickDays: r.sick_days as number | null,
    painAreasSummary: r.pain_areas_summary as string | null,
    sleepDisruptionBreakdown: r.sleep_disruption_breakdown as string | null,
```

- [ ] **Step 5: Verify types compile**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No new errors in source files.

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/db.ts dashboard/lib/types.ts
git commit -m "feat(metrics): add 8 weekly_metrics columns for coach data integration"
```

---

### Task 2: Checkin Route — Compute & Persist New Metrics

**Files:**
- Modify: `dashboard/app/api/checkin/route.ts`
- Modify: `dashboard/lib/session-db.ts` (import needed for RPE query)

- [ ] **Step 1: Add RPE aggregation imports to checkin route**

In `dashboard/app/api/checkin/route.ts`, add to imports:

```typescript
import { getWeekSessions, getExerciseFeedback } from '@/lib/session-db';
import { getDailyLogsByWeek } from '@/lib/db';
```

Note: `getWeekSessions` is already used in agents.ts but not in the checkin route directly. `getDailyLogsByWeek` may already be available via `computeWeekSummary` but we need the raw logs for pain area aggregation.

- [ ] **Step 2: Compute RPE aggregates, sick days, pain areas, sleep disruption breakdown**

After the `const hasLogData = weekSummary.days_logged > 0;` line (~line 148), add the computation block:

```typescript
        // Compute RPE aggregates from session feedback
        const weekSessions = getWeekSessions(currentWeek);
        let totalRpe = 0;
        let rpeCount = 0;
        let hardCount = 0;
        for (const session of weekSessions) {
          const feedback = getExerciseFeedback(session.sets[0]?.id ?
            // Get session_log_id from the session — need to query it
            // Actually getWeekSessions returns date+title, we need sessionLogId
            // Let's get it from the DB directly
            0 : 0);
          // This approach won't work — we need session IDs
        }
```

Actually, `getWeekSessions` doesn't return session IDs. We need a helper. Add a function to `session-db.ts`:

In `dashboard/lib/session-db.ts`, add:

```typescript
export function getWeekSessionIds(weekNumber: number, _db?: Database.Database): number[] {
  const db = _db ?? getDb();
  const rows = db.prepare(`
    SELECT id FROM session_logs WHERE week_number = ? AND completed_at IS NOT NULL ORDER BY date
  `).all(weekNumber) as Array<{ id: number }>;
  return rows.map((r) => r.id);
}
```

Now in the checkin route, the computation becomes:

```typescript
        // Compute RPE aggregates from session feedback
        const sessionIds = getWeekSessionIds(currentWeek);
        let totalRpe = 0;
        let rpeCount = 0;
        let hardCount = 0;
        for (const sessionId of sessionIds) {
          const feedback = getExerciseFeedback(sessionId);
          for (const f of feedback) {
            totalRpe += f.rpe;
            rpeCount++;
            if (f.rpe >= 4) hardCount++;
          }
        }
        const avgRpe = rpeCount > 0 ? Math.round((totalRpe / rpeCount) * 10) / 10 : null;

        // Compute sick days
        const sickDays = hasLogData ? weekSummary.days_logged > 0
          ? logs.filter((l: { is_sick_day: number }) => l.is_sick_day).length
          : 0 : null;

        // Compute pain areas summary
        let painAreasSummary: string | null = null;
        if (hasLogData) {
          const dailyLogs = getDailyLogsByWeek(currentWeek);
          const areaMap = new Map<string, { days: number; maxLevel: number }>();
          for (const log of dailyLogs) {
            if (log.pain_level != null && log.pain_level > 0 && log.pain_area) {
              const existing = areaMap.get(log.pain_area) ?? { days: 0, maxLevel: 0 };
              existing.days++;
              existing.maxLevel = Math.max(existing.maxLevel, log.pain_level);
              areaMap.set(log.pain_area, existing);
            }
          }
          if (areaMap.size > 0) {
            painAreasSummary = JSON.stringify(
              Array.from(areaMap.entries()).map(([area, { days, maxLevel }]) => ({ area, days, maxLevel }))
            );
          }
        }

        // Compute sleep disruption breakdown
        let sleepDisruptionBreakdown: string | null = null;
        if (hasLogData) {
          const dailyLogs = getDailyLogsByWeek(currentWeek);
          const causeCounts: Record<string, number> = {};
          for (const log of dailyLogs) {
            if (log.sleep_disruption) {
              causeCounts[log.sleep_disruption] = (causeCounts[log.sleep_disruption] ?? 0) + 1;
            }
          }
          if (Object.keys(causeCounts).length > 0) {
            sleepDisruptionBreakdown = JSON.stringify(causeCounts);
          }
        }
```

- [ ] **Step 3: Pass subjective text fields and new aggregates into the metrics object**

Update the `metrics` object construction to include all 8 new fields:

After the existing `sleepDisruptionCount` line, add:

```typescript
          avgRpe,
          hardExerciseCount: rpeCount > 0 ? hardCount : null,
          weekReflection: subjectiveData?.weekReflection ?? null,
          nextWeekConflicts: subjectiveData?.nextWeekConflicts ?? null,
          questionsForCoaches: subjectiveData?.questionsForCoaches ?? null,
          sickDays: hasLogData ? sickDays : null,
          painAreasSummary,
          sleepDisruptionBreakdown,
```

- [ ] **Step 4: Update the import for `getWeekSessionIds`**

Make sure the import at top of checkin route includes `getWeekSessionIds`:

```typescript
import { getWeekSessionIds, getExerciseFeedback } from '@/lib/session-db';
```

- [ ] **Step 5: Verify types compile**

Run: `cd dashboard && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add dashboard/app/api/checkin/route.ts dashboard/lib/session-db.ts
git commit -m "feat(checkin): compute RPE aggregates, pain areas, sleep breakdown for weekly metrics"
```

---

### Task 3: Session Details — Structured RPE & Duration in Coach Context

**Files:**
- Modify: `dashboard/lib/agents.ts` (buildSessionDetailsSection function)

- [ ] **Step 1: Add `getExerciseFeedback` import**

In `dashboard/lib/agents.ts`, update the session-db import:

```typescript
import { getWeekSessions, getExerciseFeedback, getWeekSessionIds } from './session-db';
```

- [ ] **Step 2: Rewrite `buildSessionDetailsSection` to include RPE and duration**

Replace the function (lines 277-319):

```typescript
function buildSessionDetailsSection(sessions: ReturnType<typeof getWeekSessions>): string {
  if (sessions.length === 0) {
    return `### Session Details\nNo completed sessions recorded this week.\n\n`;
  }

  const rpeLabels = ['', 'Too Easy', 'Easy', 'Right', 'Hard', 'Too Hard'];

  let section = `### Session Details\n`;
  for (const s of sessions) {
    const complianceStr = s.compliancePct != null ? `${s.compliancePct}%` : 'N/A';
    section += `**${getDayAbbrev(s.date)} — ${s.sessionTitle}** (${s.sessionType}, compliance: ${complianceStr})\n`;

    // Get RPE feedback for this session (need session ID)
    // getWeekSessions doesn't return IDs, so we query feedback by matching date+title
    // Instead, look up session_log_id via the sets
    const sessionLogId = s.sets.length > 0 ? (s.sets[0] as Record<string, unknown>).sessionLogId as number | undefined : undefined;
    const feedback = sessionLogId ? getExerciseFeedback(sessionLogId) : [];
    const feedbackMap = new Map(feedback.map(f => [f.exerciseName, f]));

    // Summarize sets: group by exercise
    if (s.sets.length > 0) {
      const byExercise = new Map<string, typeof s.sets>();
      for (const set of s.sets) {
        const existing = byExercise.get(set.exerciseName) || [];
        existing.push(set);
        byExercise.set(set.exerciseName, existing);
      }
      for (const [name, sets] of byExercise) {
        const completedSets = sets.filter(st => st.completed);
        const totalSets = sets.length;
        const weightStr = sets[0].actualWeightKg != null
          ? `${sets[0].actualWeightKg}kg`
          : sets[0].prescribedWeightKg != null
            ? `${sets[0].prescribedWeightKg}kg (prescribed)`
            : 'BW';
        const modified = sets.some(st => st.isModified) ? ' [modified]' : '';

        let line = `- ${name}: ${completedSets.length}/${totalSets} sets @ ${weightStr}${modified}`;

        // RPE annotation
        const rpe = feedbackMap.get(name);
        if (rpe) {
          line += ` | RPE: ${rpe.rpe}/5 (${rpeLabels[rpe.rpe]})`;
        }

        // Duration annotation (for timed exercises)
        const durationChanges = sets.filter(st =>
          st.prescribedDurationS != null && st.actualDurationS != null && st.actualDurationS !== st.prescribedDurationS
        );
        if (durationChanges.length > 0) {
          const first = durationChanges[0];
          line += ` | Duration: ${first.prescribedDurationS}s → ${first.actualDurationS}s`;
        }

        section += line + '\n';
      }
    }

    // Summarize cardio
    if (s.cardio.length > 0) {
      for (const c of s.cardio) {
        const doneStr = c.completed ? 'done' : `${c.completedRounds}/${c.prescribedRounds ?? '?'} rounds`;
        let line = `- ${c.exerciseName}: ${doneStr}`;

        // RPE for cardio
        const rpe = feedbackMap.get(c.exerciseName);
        if (rpe) {
          line += ` | RPE: ${rpe.rpe}/5 (${rpeLabels[rpe.rpe]})`;
        }

        // Duration annotation for cardio
        if (c.actualDurationMin != null && c.prescribedDurationMin != null && c.actualDurationMin !== c.prescribedDurationMin) {
          line += ` | Duration: ${c.prescribedDurationMin}min → ${c.actualDurationMin}min`;
        }

        section += line + '\n';
      }
    }
    section += `\n`;
  }

  return section;
}
```

- [ ] **Step 3: Fix session ID lookup**

The current `getWeekSessions` doesn't return session IDs. We need to extend it. In `dashboard/lib/session-db.ts`, update `getWeekSessions` to include the session log ID in its return:

The current return type maps `s.id as number` into the session object but doesn't expose it. Update the return mapping to include `sessionLogId`:

In the `getWeekSessions` function, the `.map()` call currently returns `{ date, sessionTitle, sessionType, compliancePct, sets, cardio }`. Add `sessionLogId`:

```typescript
  return sessions.map((s) => ({
    sessionLogId: s.id as number,
    date: s.date as string,
    sessionTitle: s.session_title as string,
    sessionType: s.session_type as string,
    compliancePct: s.compliance_pct as number | null,
    sets: getSessionSets(s.id as number),
    cardio: getSessionCardio(s.id as number),
  }));
```

Then in `buildSessionDetailsSection`, replace the awkward sessionLogId lookup with:

```typescript
    const feedback = getExerciseFeedback(s.sessionLogId);
    const feedbackMap = new Map(feedback.map(f => [f.exerciseName, f]));
```

- [ ] **Step 4: Verify types compile**

Run: `cd dashboard && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/agents.ts dashboard/lib/session-db.ts
git commit -m "feat(agents): include RPE and duration in structured session details for coaches"
```

---

### Task 4: Tiered History — Surface New Metrics in Weekly Summaries

**Files:**
- Modify: `dashboard/lib/tiered-history.ts` (formatWeeklySummaries function)

- [ ] **Step 1: Extend `formatWeeklySummaries` to include new weekly_metrics fields**

In `dashboard/lib/tiered-history.ts`, in the `formatWeeklySummaries` function, after the existing `- Pain flags: ${painStr}\n` line (~line 400), add new metric lines:

Read the current file first, then add after the pain flags line within the `for (const s of summaries...)` loop. We need to read the `WeeklyMetrics` for each summary week since `WeekSummaryTier` doesn't have the new fields.

Actually, the simpler approach: extend `WeekSummaryTier` to include the new fields and populate them from `weekly_metrics` in `buildWeekSummary`.

In `WeekSummaryTier` interface, add after `keyNotes`:

```typescript
  avgRpe: number | null;
  hardExerciseCount: number | null;
  sickDays: number | null;
  painAreasSummary: string | null;
  sleepDisruptionBreakdown: string | null;
  weekReflection: string | null;
```

In `buildWeekSummary`, before the return statement, add:

```typescript
  // New enrichment fields from weekly_metrics
  const avgRpe = metric?.avgRpe ?? null;
  const hardExerciseCount = metric?.hardExerciseCount ?? null;
  const metricSickDays = metric?.sickDays ?? sickDays;
  const painAreasSummaryRaw = metric?.painAreasSummary ?? null;
  const sleepDisruptionBreakdownRaw = metric?.sleepDisruptionBreakdown ?? null;
  const weekReflectionText = metric?.weekReflection ?? null;
```

Wait — `buildWeekSummary` computes from daily logs, not from `weekly_metrics`. But for weeks 3-8, the daily logs may no longer be available (or we'd need to recompute). The `weekly_metrics` stored values are the source of truth for historical weeks. Let me check — actually `buildWeekSummary` DOES call `deps.getDailyLogsByWeek(weekNumber)` and `deps.getWeeklyMetrics(weekNumber)`. It already uses both. So the metric fields are available.

Add to the return object:

```typescript
    avgRpe: metric?.avgRpe ?? null,
    hardExerciseCount: metric?.hardExerciseCount ?? null,
    sickDays: metric?.sickDays ?? sickDays,
    painAreasSummary: metric?.painAreasSummary ?? null,
    sleepDisruptionBreakdown: metric?.sleepDisruptionBreakdown ?? null,
    weekReflection: metric?.weekReflection ?? null,
```

Note: `sickDays` in the local scope is computed from `logs.filter(l => l.is_sick_day).length` — but this doesn't exist yet in `buildWeekSummary`. Add it:

After the existing `const kitchenHit = ...` line, add:

```typescript
  const sickDays = logs.filter((l) => l.is_sick_day).length;
```

- [ ] **Step 2: Format the new fields in `formatWeeklySummaries`**

After the `- Pain flags: ${painStr}\n` line, add:

```typescript
    if (s.avgRpe != null) {
      md += `- Avg RPE: ${s.avgRpe}/5${s.hardExerciseCount ? `, Hard exercises (RPE≥4): ${s.hardExerciseCount}` : ''}\n`;
    }
    if (s.sickDays != null && s.sickDays > 0) {
      md += `- Sick days: ${s.sickDays}\n`;
    }
    if (s.painAreasSummary) {
      try {
        const areas = JSON.parse(s.painAreasSummary) as Array<{ area: string; days: number; maxLevel: number }>;
        if (areas.length > 0) {
          const areaStr = areas.map(a => `${a.area} (${a.days}d, max ${a.maxLevel})`).join(', ');
          md += `- Pain areas: ${areaStr}\n`;
        }
      } catch { /* invalid JSON, skip */ }
    }
    if (s.sleepDisruptionBreakdown) {
      try {
        const breakdown = JSON.parse(s.sleepDisruptionBreakdown) as Record<string, number>;
        const parts = Object.entries(breakdown).map(([cause, count]) => `${cause} ×${count}`);
        if (parts.length > 0) {
          md += `- Sleep disruptions: ${parts.join(', ')}\n`;
        }
      } catch { /* invalid JSON, skip */ }
    }
    if (s.weekReflection) {
      const truncated = s.weekReflection.length > 200 ? s.weekReflection.slice(0, 200) + '...' : s.weekReflection;
      md += `- Reflection: "${truncated}"\n`;
    }
```

- [ ] **Step 3: Verify types compile**

Run: `cd dashboard && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/tiered-history.ts
git commit -m "feat(history): surface RPE, pain areas, sleep disruption, reflection in weekly summaries"
```

---

### Task 5: CLAUDE.md — Session Feedback Data Reference

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add Session Feedback Data subsection to Section 6 (Diagnostic Logic)**

After the existing "Superset Rest Times" rule (~line in Section 6), add:

```markdown
### Session Feedback Data (All Coaches)
Coaches receive per-exercise RPE and actual duration data in the session details section.

**RPE Scale (1-5):**
| RPE | Label | Meaning |
|-----|-------|---------|
| 1 | Too Easy | Could double the sets. Load needs to go up. |
| 2 | Easy | Comfortable throughout. 3+ reps in reserve. |
| 3 | Right | Challenging but manageable. 1-2 reps in reserve. Target zone. |
| 4 | Hard | Last set was a grind. 0-1 reps in reserve. |
| 5 | Too Hard | Form broke down or failed. Load needs to come down. |

RPE 1 and 5 are signals to adjust programming. RPE 2-4 is the working range.

**Duration Actuals:** For timed exercises (holds, hangs, cardio), actual duration appears alongside prescribed when the athlete logged a different value. Format: "Duration: 40s → 30s".

**Weekly Metrics (available in tiered history):**
- `avg_rpe` — mean RPE across all exercises that week
- `hard_exercise_count` — exercises rated RPE ≥ 4
- `sick_days` — days marked sick (context for low compliance)
- `pain_areas_summary` — which body areas, how many days, max severity
- `sleep_disruption_breakdown` — cause counts (kids, stress, pain, other)
- `week_reflection` — athlete's own narrative summary
- `questions_for_coaches` — must be addressed in synthesis
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Session Feedback Data reference to CLAUDE.md diagnostic logic"
```

---

### Task 6: Coach Personas — Diagnostic Rules

**Files:**
- Modify: `coaches/00_head_coach.md`
- Modify: `coaches/01_strength_hypertrophy.md`
- Modify: `coaches/02_endurance_energy.md`
- Modify: `coaches/05_recovery_sleep.md`
- Modify: `coaches/06_mobility_injury.md`
- Modify: `coaches/07_mental_performance.md`

- [ ] **Step 1: Read all 6 persona files**

Read each file to find the right insertion point (typically after existing diagnostic rules or at the end of the persona).

- [ ] **Step 2: Add rules to `coaches/00_head_coach.md`**

Append before the closing section:

```markdown
## Session Feedback Rules

### Questions Must Be Answered (Head Coach)
If `questions_for_coaches` is non-empty in the subjective inputs, the synthesis MUST address each question explicitly. No unanswered questions.

### RPE-Driven Changes (Head Coach)
When the plan adjusts weight, duration, or volume based on RPE data, state the reason in Coach's Cues. Format: "Adjusted [what] — RPE [value] last [timeframe]." Only add RPE cues when the prescription changed from last week.

### Reflection Integration (Head Coach)
Reference `week_reflection` themes in the opening analysis when they relate to training decisions. Do not parrot back the reflection — extract the actionable signal.
```

- [ ] **Step 3: Add rules to `coaches/01_strength_hypertrophy.md`**

Append:

```markdown
## Session Feedback Rules

### RPE Overload Rule (Strength Agent)
If same exercise shows RPE ≥ 4 for 2+ consecutive weeks → reduce weight 5-10% next week.
If same exercise shows RPE ≤ 2 for 2+ consecutive weeks → increase weight 5-10% next week.
Cross-reference RPE with ceiling data: RPE 2 + ceiling stall = increase weight.

### Duration Progression Rule (Strength Agent)
If actual duration < prescribed on timed holds (dead hangs, stretches) → reduce prescribed to actual + 5s next week. Do not jump back to original prescription. Build back gradually.
```

- [ ] **Step 4: Add rules to `coaches/02_endurance_energy.md`**

Append:

```markdown
## Session Feedback Rules

### Cardio Duration Rule (Endurance Agent)
If cardio actual duration < prescribed → flag conditioning gap, hold current prescription next week.
If cardio actual duration > prescribed → athlete progressing, increase 10% next week.

### Effort-Effect Cross-Reference (Endurance Agent)
If RPE 5 but Garmin anaerobic TE < 1.0 → form or pacing issue, not true max effort. Cue technique, don't reduce intensity.
If RPE 2 but Garmin aerobic TE > 3.0 → effort underreported, trust Garmin. Do not increase load based on RPE alone.
```

- [ ] **Step 5: Add rules to `coaches/05_recovery_sleep.md`**

Append:

```markdown
## Session Feedback Rules

### RPE-Readiness Cross-Reference (Recovery Agent)
If week avg_rpe > 3.5 AND combined readiness < 40 → flag overreaching, recommend deload next week.
If hard_exercise_count > 6 in a week → recommend deload regardless of readiness score.

### Sleep Disruption Triage (Recovery Agent)
Use `sleep_disruption_breakdown` to categorize causes:
- "kids" disruptions = uncontrollable, do NOT reduce training volume for these.
- "pain" disruptions = actionable, escalate to Mobility agent for prehab adjustment.
- "stress" disruptions = behavioral, flag for Mental Performance agent.

### Sick Day Context (Recovery Agent)
If `sick_days` > 0, low compliance that week is medical, not behavioral. Do not flag as adherence failure. Factor into readiness assessment: sick days depress readiness for 1-2 weeks after.
```

- [ ] **Step 6: Add rules to `coaches/06_mobility_injury.md`**

Append:

```markdown
## Session Feedback Rules

### Chronic Pain Detection (Mobility Agent)
If `pain_areas_summary` shows same area for 3+ consecutive weeks (check tiered history) → flag for physio referral regardless of current severity level.
If RPE 5 on exercises involving a tracked pain area → immediate load reduction for that movement pattern, not just monitoring.

### Night Pain Cross-Reference (Mobility Agent)
If `sleep_disruption_breakdown` shows "pain" count > 2 AND `pain_areas_summary` shows an active area → escalate severity. Daytime pain + night pain = acute phase, switch from chronic management to acute recovery protocol.
```

- [ ] **Step 7: Add rules to `coaches/07_mental_performance.md`**

Append:

```markdown
## Session Feedback Rules

### Narrative Theme Tracking (Mental Performance Agent)
Track recurring themes in `week_reflection` across weeks using tiered history. Flag when a theme (stress, motivation, confidence, fatigue) appears 3+ times in 4 weeks. This signals a structural issue, not a bad week.

### Sick Day Compliance (Mental Performance Agent)
Do not flag compliance failures in weeks with `sick_days` > 0 as behavioral issues. Reframe: "compliance was 60% — but 2 sick days account for the gap."

### Conflict Follow-Up (Mental Performance Agent)
If `next_week_conflicts` were logged in previous week's tiered history, verify the current plan accommodated them. If conflicts were flagged but the plan didn't adjust, flag the gap to Head Coach.
```

- [ ] **Step 8: Commit**

```bash
git add coaches/00_head_coach.md coaches/01_strength_hypertrophy.md coaches/02_endurance_energy.md coaches/05_recovery_sleep.md coaches/06_mobility_injury.md coaches/07_mental_performance.md
git commit -m "feat(coaches): add RPE, duration, and enrichment diagnostic rules to 6 personas"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Type check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No new type errors.

- [ ] **Step 2: Verify session details include RPE format**

Start the dev server: `cd dashboard && npm run dev`
If there's a completed session with RPE feedback in the DB, check `/api/checkin/review` response includes RPE in session details section.

- [ ] **Step 3: Verify weekly_metrics columns exist**

Run a quick SQLite check:
```bash
cd /Users/martinlevie/AI/Coach && node -e "const db = require('better-sqlite3')('./dashboard/coaching.db'); console.log(db.prepare('PRAGMA table_info(weekly_metrics)').all().map(c => c.name).join(', '))"
```
Expected: should include `avg_rpe, hard_exercise_count, week_reflection, next_week_conflicts, questions_for_coaches, sick_days, pain_areas_summary, sleep_disruption_breakdown`

- [ ] **Step 4: Verify coach personas have new rules**

Quick grep:
```bash
grep -l "Session Feedback Rules" coaches/*.md
```
Expected: 00, 01, 02, 05, 06, 07

- [ ] **Step 5: Verify CLAUDE.md has data reference**

```bash
grep "Session Feedback Data" CLAUDE.md
```
Expected: Match found.

- [ ] **Step 6: Commit any fixes if needed**
