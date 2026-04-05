/**
 * Tiered History Builder — Phase E, Task E1
 *
 * Provides coaches with different levels of detail based on recency:
 *   Tier 1 — Recent Detail:     last 2 weeks, full daily granularity
 *   Tier 2 — Weekly Summaries:  weeks 3-8 back, aggregated
 *   Tier 3 — Trends:            weeks 9+ back, long-term patterns
 */

import type { DailyLog, DailyNote } from './db';
import { getDailyLogsByWeek, getWeekNotes, getWeeklyMetrics, getCeilingHistory } from './db';
import type { WeeklyMetrics, CeilingEntry } from './types';
import type { SessionSetState, SessionCardioState } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DailyDetail {
  date: string;
  dayAbbrev: string;
  energyLevel: number | null;
  painLevel: number | null;
  painArea: string | null;
  sleepDisruption: string | null;
  bedtime: string | null;
  workoutCompleted: boolean;
  rugProtocolDone: boolean;
  hydrationTracked: boolean;
  kitchenCutoffHit: boolean;
  isSickDay: boolean;
  sessionSummary: string | null;
  notes: Array<{ category: string; text: string }>;
}

export interface WeekDetail {
  weekNumber: number;
  days: DailyDetail[];
}

export interface WeekSummaryTier {
  weekNumber: number;
  workoutCompliancePct: number | null;  // completed / planned
  rugCompliancePct: number;             // done / 7
  kitchenCutoffPct: number;             // hit / 7
  hydrationPct: number;                 // tracked / 7
  bedtimeCompliancePct: number | null;  // compliant / days-with-bedtime
  sessionsCompleted: number;
  sessionsPlanned: number | null;
  weightKg: number | null;
  weightDeltaKg: number | null;         // week-over-week weight change
  avgEnergy: number | null;
  painFlags: { count: number; areas: string[] };
  keyNotes: string[];
  avgRpe: number | null;
  hardExerciseCount: number | null;
  sickDays: number | null;
  painAreasSummary: string | null;
  sleepDisruptionBreakdown: string | null;
  weekReflection: string | null;
}

export interface WeightDataPoint {
  weekNumber: number;
  weightKg: number;
}

export interface CeilingProgressionEntry {
  exercise: string;
  history: Array<{ weekNumber: number; date: string; weightKg: number }>;
}

export interface InjuryFlag {
  weekNumber: number;
  area: string;
  level: number;
  source: 'daily-log';
  /** For 'daily-log' source: number of distinct weeks this area appeared with pain_level > 0 */
  occurrenceCount?: number;
}

export interface TrendData {
  weightCurve: WeightDataPoint[];
  ceilingProgression: CeilingProgressionEntry[];
  recurringInjuryFlags: InjuryFlag[];
  phaseMilestones: Array<{ weekNumber: number; checkInDate: string; note: string }>;
}

export interface TieredHistory {
  recentDetail: WeekDetail[];
  weeklySummaries: WeekSummaryTier[];
  trends: TrendData;
  format(): string;
}

// ── Dependency injection types for testability ────────────────────────────────

export interface TieredHistoryDeps {
  getDailyLogsByWeek: (weekNumber: number) => DailyLog[];
  getWeekNotes: (weekNumber: number) => (DailyNote & { date: string })[];
  getWeeklyMetrics: (weekNumber?: number) => WeeklyMetrics[];
  getCeilingHistory: (exercise?: string) => CeilingEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayAbbrev(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return DAY_ABBREVS[d.getDay()];
}

/** Check if a stored bedtime (24h+ format) is before 23:00. */
function isBedtimeCompliant(stored: string): boolean {
  const [h] = stored.split(':').map(Number);
  return h < 23;
}

/** Convert stored 24h+ bedtime back to display format. */
function displayBedtime(stored: string): string {
  const [h, m] = stored.split(':').map(Number);
  if (h >= 24) {
    return `${(h - 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
  return stored;
}

function pct(n: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((n / total) * 100);
}

// ── Tier 1: Recent Detail ─────────────────────────────────────────────────────

function buildWeekDetail(weekNumber: number, deps: TieredHistoryDeps): WeekDetail {
  const logs = deps.getDailyLogsByWeek(weekNumber);
  const notes = deps.getWeekNotes(weekNumber);

  // Group notes by date
  const notesByDate = new Map<string, Array<{ category: string; text: string }>>();
  for (const n of notes) {
    const list = notesByDate.get(n.date) ?? [];
    list.push({ category: n.category, text: n.text });
    notesByDate.set(n.date, list);
  }

  const days: DailyDetail[] = logs.map((log) => ({
    date: log.date,
    dayAbbrev: dayAbbrev(log.date),
    energyLevel: log.energy_level,
    painLevel: log.pain_level,
    painArea: log.pain_area,
    sleepDisruption: log.sleep_disruption,
    bedtime: log.vampire_bedtime ? displayBedtime(log.vampire_bedtime) : null,
    workoutCompleted: log.workout_completed === 1,
    rugProtocolDone: log.rug_protocol_done === 1,
    hydrationTracked: log.hydration_tracked === 1,
    kitchenCutoffHit: log.kitchen_cutoff_hit === 1,
    isSickDay: log.is_sick_day === 1,
    sessionSummary: log.session_summary,
    notes: notesByDate.get(log.date) ?? [],
  }));

  return { weekNumber, days };
}

// ── Tier 2: Weekly Summaries ──────────────────────────────────────────────────

function buildWeekSummary(
  weekNumber: number,
  deps: TieredHistoryDeps,
  prevWeightKg: number | null = null,
): WeekSummaryTier {
  const logs = deps.getDailyLogsByWeek(weekNumber);
  const notes = deps.getWeekNotes(weekNumber);
  const metrics = deps.getWeeklyMetrics(weekNumber);
  const metric = metrics.length > 0 ? metrics[0] : null;

  const workoutsCompleted = logs.filter((l) => l.workout_completed).length;
  const rugDone = logs.filter((l) => l.rug_protocol_done).length;
  const hydrationTracked = logs.filter((l) => l.hydration_tracked).length;
  const kitchenHit = logs.filter((l) => l.kitchen_cutoff_hit).length;
  const sickDays = logs.filter((l) => l.is_sick_day).length;

  // Bedtime compliance
  const bedtimeLogs = logs.filter((l) => l.vampire_bedtime != null);
  const bedtimeCompliant = bedtimeLogs.filter((l) => isBedtimeCompliant(l.vampire_bedtime!)).length;
  const bedtimeCompliancePct = bedtimeLogs.length > 0
    ? Math.round((bedtimeCompliant / bedtimeLogs.length) * 100)
    : null;

  // Sessions planned — use metric if available; null when unknown (avoids misleading 100% compliance)
  const sessionsPlanned = metric?.sessionsPlanned ?? null;
  const sessionsCompleted = metric?.sessionsCompleted ?? workoutsCompleted;

  // Weight from metric and week-over-week delta
  const weightKg = metric?.weightKg ?? null;
  const weightDeltaKg = (weightKg != null && prevWeightKg != null)
    ? Math.round((weightKg - prevWeightKg) * 10) / 10
    : null;

  // Average energy
  const energyLogs = logs.filter((l) => l.energy_level != null);
  const avgEnergy = energyLogs.length > 0
    ? Math.round(energyLogs.reduce((s, l) => s + l.energy_level!, 0) / energyLogs.length * 10) / 10
    : metric?.avgEnergy ?? null;

  // Pain flags
  const painLogs = logs.filter((l) => l.pain_level != null && l.pain_level > 0);
  const painAreas = [...new Set(painLogs.map((l) => l.pain_area).filter(Boolean) as string[])];

  // Key notes — just the text
  const keyNotes = notes.map((n) => `${n.date} (${n.category}): ${n.text}`);

  return {
    weekNumber,
    workoutCompliancePct: sessionsPlanned != null && sessionsPlanned > 0 ? pct(workoutsCompleted, sessionsPlanned) : null,
    rugCompliancePct: pct(rugDone, 7),
    kitchenCutoffPct: pct(kitchenHit, 7),
    hydrationPct: pct(hydrationTracked, 7),
    bedtimeCompliancePct,
    sessionsCompleted,
    sessionsPlanned,
    weightKg,
    weightDeltaKg,
    avgEnergy,
    painFlags: { count: painLogs.length, areas: painAreas },
    keyNotes,
    avgRpe: metric?.avgRpe ?? null,
    hardExerciseCount: metric?.hardExerciseCount ?? null,
    sickDays: metric?.sickDays ?? sickDays,
    painAreasSummary: metric?.painAreasSummary ?? null,
    sleepDisruptionBreakdown: metric?.sleepDisruptionBreakdown ?? null,
    weekReflection: metric?.weekReflection ?? null,
  };
}

// ── Tier 3: Trends ────────────────────────────────────────────────────────────

function buildTrends(upToWeek: number, deps: TieredHistoryDeps): TrendData {
  const allMetrics = deps.getWeeklyMetrics();
  const allCeilings = deps.getCeilingHistory();

  // Filter to all weeks up to and including upToWeek (which is currentWeek - 9)
  const trendWeeks = allMetrics.filter((m) => m.weekNumber <= upToWeek);

  // Weight curve
  const weightCurve: WeightDataPoint[] = trendWeeks
    .filter((m) => m.weightKg != null)
    .map((m) => ({ weekNumber: m.weekNumber, weightKg: m.weightKg! }));

  // Ceiling progression — group by exercise
  const exerciseMap = new Map<string, CeilingProgressionEntry>();
  for (const entry of allCeilings) {
    if (entry.weekNumber > upToWeek) continue;
    const existing = exerciseMap.get(entry.exercise) ?? { exercise: entry.exercise, history: [] };
    existing.history.push({ weekNumber: entry.weekNumber, date: entry.date, weightKg: entry.weightKg });
    exerciseMap.set(entry.exercise, existing);
  }
  const ceilingProgression = Array.from(exerciseMap.values());

  // Recurring injury flags from daily logs — count occurrences per body area across trend weeks
  // An area is "recurring" if it appears with pain_level > 0 in 2+ distinct weeks
  const injuryFlags: InjuryFlag[] = [];
  const areaWeekSet = new Map<string, Set<number>>(); // area → set of week numbers
  const areaMaxLevel = new Map<string, number>();      // area → highest pain level seen
  for (const m of trendWeeks) {
    const logs = deps.getDailyLogsByWeek(m.weekNumber);
    for (const log of logs) {
      if (log.pain_level != null && log.pain_level > 0 && log.pain_area) {
        const area = log.pain_area;
        const weekSet = areaWeekSet.get(area) ?? new Set<number>();
        weekSet.add(m.weekNumber);
        areaWeekSet.set(area, weekSet);
        const prev = areaMaxLevel.get(area) ?? 0;
        if (log.pain_level > prev) areaMaxLevel.set(area, log.pain_level);
      }
    }
  }
  for (const [area, weekSet] of areaWeekSet.entries()) {
    if (weekSet.size >= 2) {
      const firstWeek = Math.min(...weekSet);
      injuryFlags.push({
        weekNumber: firstWeek,
        area,
        level: areaMaxLevel.get(area) ?? 1,
        source: 'daily-log',
        occurrenceCount: weekSet.size,
      });
    }
  }

  // Sort all flags by week number
  injuryFlags.sort((a, b) => a.weekNumber - b.weekNumber);

  // Phase milestones — weeks where body weight crossed key thresholds
  const phaseMilestones: Array<{ weekNumber: number; checkInDate: string; note: string }> = [];
  let prev: WeeklyMetrics | null = null;
  for (const m of trendWeeks) {
    if (prev?.weightKg != null && m.weightKg != null) {
      const thresholds = [102, 100, 99, 97, 95, 92, 89, 87];
      for (const t of thresholds) {
        if (prev.weightKg > t && m.weightKg <= t) {
          phaseMilestones.push({
            weekNumber: m.weekNumber,
            checkInDate: m.checkInDate,
            note: `Weight crossed below ${t}kg (was ${prev.weightKg.toFixed(1)}kg, now ${m.weightKg.toFixed(1)}kg)`,
          });
        }
      }
    }
    prev = m;
  }

  return { weightCurve, ceilingProgression, recurringInjuryFlags: injuryFlags, phaseMilestones };
}

// ── Markdown Formatters ───────────────────────────────────────────────────────

function formatRecentDetail(detail: WeekDetail[]): string {
  if (detail.length === 0) return '';

  const weekNums = detail.map((w) => w.weekNumber).join(', ');
  let md = `### Recent Detail (Week${detail.length > 1 ? 's' : ''} ${weekNums})\n\n`;

  for (const week of detail) {
    md += `**Week ${week.weekNumber}**\n\n`;
    if (week.days.length === 0) {
      md += `_No daily logs recorded for this week._\n\n`;
      continue;
    }

    md += `| Day | Workout | Rug | Bedtime | Hydration | Kitchen | Energy | Pain | Sick | Session / Notes |\n`;
    md += `|-----|---------|-----|---------|-----------|---------|--------|------|------|-----------------|\n`;

    for (const d of week.days) {
      const workout = d.workoutCompleted ? '✓' : '✗';
      const rug = d.rugProtocolDone ? '✓' : '✗';
      const bedtime = d.bedtime ?? '—';
      const hydration = d.hydrationTracked ? '✓' : '✗';
      const kitchen = d.kitchenCutoffHit ? '✓' : '✗';
      const energy = d.energyLevel != null ? String(d.energyLevel) : '—';
      const painStr = d.painLevel != null && d.painLevel > 0
        ? `${d.painLevel}${d.painArea ? ` (${d.painArea})` : ''}`
        : '—';
      const sick = d.isSickDay ? '🤒' : '—';

      const noteParts: string[] = [];
      if (d.sessionSummary) noteParts.push(d.sessionSummary.split('\n')[0]);
      if (d.sleepDisruption) noteParts.push(`Sleep: ${d.sleepDisruption}`);
      for (const n of d.notes) noteParts.push(`[${n.category}] ${n.text}`);
      const notes = noteParts.join(' | ') || '—';

      md += `| ${d.dayAbbrev} ${d.date} | ${workout} | ${rug} | ${bedtime} | ${hydration} | ${kitchen} | ${energy} | ${painStr} | ${sick} | ${notes} |\n`;
    }

    md += '\n';
  }

  return md;
}

function formatWeeklySummaries(summaries: WeekSummaryTier[]): string {
  if (summaries.length === 0) return '';

  const firstWeek = summaries[summaries.length - 1]?.weekNumber;
  const lastWeek = summaries[0]?.weekNumber;
  const rangeLabel = firstWeek === lastWeek
    ? `Week ${firstWeek}`
    : `Weeks ${firstWeek} through ${lastWeek}`;

  let md = `### Weekly Summaries (${rangeLabel})\n\n`;

  for (const s of summaries.slice().reverse()) {
    const workoutStr = s.workoutCompliancePct != null
      ? `${s.sessionsCompleted}/${s.sessionsPlanned} (${s.workoutCompliancePct}%)`
      : `${s.sessionsCompleted} completed`;
    const bedtimeStr = s.bedtimeCompliancePct != null ? `${s.bedtimeCompliancePct}%` : 'no data';
    let weightStr = s.weightKg != null ? `${s.weightKg}kg` : 'no data';
    if (s.weightKg != null && s.weightDeltaKg != null) {
      const sign = s.weightDeltaKg > 0 ? '+' : '';
      weightStr += ` (${sign}${s.weightDeltaKg}kg)`;
    }
    const energyStr = s.avgEnergy != null ? String(s.avgEnergy) : 'no data';
    const painStr = s.painFlags.count > 0
      ? `${s.painFlags.count} days${s.painFlags.areas.length > 0 ? ` (${s.painFlags.areas.join(', ')})` : ''}`
      : 'none';

    md += `**Week ${s.weekNumber}**\n`;
    md += `- Workouts: ${workoutStr}\n`;
    md += `- Rug: ${s.rugCompliancePct}% | Kitchen: ${s.kitchenCutoffPct}% | Hydration: ${s.hydrationPct}%\n`;
    md += `- Bedtime compliance: ${bedtimeStr}\n`;
    md += `- Weight: ${weightStr} | Avg energy: ${energyStr}\n`;
    md += `- Pain flags: ${painStr}\n`;
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
    if (s.keyNotes.length > 0) {
      md += `- Notes:\n`;
      for (const note of s.keyNotes) {
        md += `  - ${note}\n`;
      }
    }
    md += '\n';
  }

  return md;
}

function formatTrends(trends: TrendData, upToWeek: number): string {
  let md = `### Long-Term Trends (Week 1 through Week ${upToWeek})\n\n`;

  // Weight curve
  if (trends.weightCurve.length > 0) {
    md += `**Weight Curve**\n`;
    const points = trends.weightCurve.map((p) => `W${p.weekNumber}: ${p.weightKg}kg`).join(' → ');
    md += `${points}\n\n`;
  } else {
    md += `**Weight Curve**: no data\n\n`;
  }

  // Ceiling progression
  if (trends.ceilingProgression.length > 0) {
    md += `**Strength Ceilings**\n`;
    for (const ex of trends.ceilingProgression) {
      const history = ex.history.map((h) => `W${h.weekNumber}: ${h.weightKg}kg`).join(' → ');
      md += `- ${ex.exercise}: ${history}\n`;
    }
    md += '\n';
  }

  // Recurring injury flags
  if (trends.recurringInjuryFlags.length > 0) {
    md += `**Injury Flags**\n`;
    for (const flag of trends.recurringInjuryFlags) {
      if (flag.source === 'daily-log') {
        md += `- W${flag.weekNumber}: ${flag.area} (level ${flag.level}, recurring — ${flag.occurrenceCount} weeks)\n`;
      } else {
        md += `- W${flag.weekNumber}: ${flag.area} (level ${flag.level})\n`;
      }
    }
    md += '\n';
  }

  // Phase milestones
  if (trends.phaseMilestones.length > 0) {
    md += `**Phase Milestones**\n`;
    for (const m of trends.phaseMilestones) {
      md += `- W${m.weekNumber} (${m.checkInDate}): ${m.note}\n`;
    }
    md += '\n';
  }

  return md;
}

// ── Main Entry Point ──────────────────────────────────────────────────────────

/**
 * Build tiered coaching history relative to the current week.
 *
 * @param currentWeek  The current training week number (1-based)
 * @param _deps        Optional dependency overrides — used in tests to inject in-memory DB functions
 */
export function buildTieredHistory(
  currentWeek: number,
  _deps?: Partial<TieredHistoryDeps>,
): TieredHistory {
  const deps: TieredHistoryDeps = {
    getDailyLogsByWeek: (wn) => getDailyLogsByWeek(wn),
    getWeekNotes: (wn) => getWeekNotes(wn),
    getWeeklyMetrics: (wn) => getWeeklyMetrics(wn),
    getCeilingHistory: (ex) => getCeilingHistory(ex),
    ..._deps,
  };

  // Tier 1: last 2 completed weeks (currentWeek - 1, currentWeek - 2)
  const recentDetail: WeekDetail[] = [];
  for (let offset = 1; offset <= 2; offset++) {
    const w = currentWeek - offset;
    if (w >= 1) {
      recentDetail.push(buildWeekDetail(w, deps));
    }
  }

  // Tier 2: weeks 3-8 back
  // We need previous-week weight for delta computation. Fetch all metrics once.
  const allMetricsForSummary = deps.getWeeklyMetrics();
  const metricsMap = new Map<number, WeeklyMetrics>();
  for (const m of allMetricsForSummary) {
    metricsMap.set(m.weekNumber, m);
  }

  const weeklySummaries: WeekSummaryTier[] = [];
  for (let offset = 3; offset <= 8; offset++) {
    const w = currentWeek - offset;
    if (w >= 1) {
      const prevWeightKg = metricsMap.get(w - 1)?.weightKg ?? null;
      weeklySummaries.push(buildWeekSummary(w, deps, prevWeightKg));
    }
  }

  // Tier 3: weeks 9+ back (up to week currentWeek - 9)
  const trendCutoff = currentWeek - 9;
  const trends = trendCutoff >= 1
    ? buildTrends(trendCutoff, deps)
    : { weightCurve: [], ceilingProgression: [], recurringInjuryFlags: [], phaseMilestones: [] };

  function format(): string {
    let md = `## Coaching History\n\n`;

    if (recentDetail.length > 0) {
      md += formatRecentDetail(recentDetail);
    }

    if (weeklySummaries.length > 0) {
      md += formatWeeklySummaries(weeklySummaries);
    }

    if (trendCutoff >= 1) {
      md += formatTrends(trends, trendCutoff);
    }

    return md;
  }

  return { recentDetail, weeklySummaries, trends, format };
}
