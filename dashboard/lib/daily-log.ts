import { getTrainingWeek } from './week';
import { getDailyLogsByWeek, getPlanItems, getWeekNotes } from './db';
import type { DailyLog } from './db';
import {
  computeDayCompliance,
  computeWeekCompliancePct,
  getBedtimeComplianceLevel,
  isBedtimeCompliant,
  getComplianceColor,
} from './compliance';
import type { DayComplianceInput, ComplianceResult, BedtimeLevel } from './compliance';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Get the full English day name from a date string (YYYY-MM-DD) */
export function getDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00'); // noon to avoid timezone edge cases
  return DAY_NAMES[d.getDay()];
}

/** Get the 3-letter day abbreviation from a date string (YYYY-MM-DD) */
export function getDayAbbrev(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return DAY_ABBREVS[d.getDay()];
}

/** Get the training week number for a date string */
export function getWeekForDate(dateStr: string): number {
  return getTrainingWeek(new Date(dateStr + 'T12:00:00'));
}

/** Return the calendar date one day before dateStr (YYYY-MM-DD).
 *  Uses noon to avoid DST boundary issues. */
export function getPreviousDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/** Find the plan_item matching a date (by week_number + day).
 *  Handles both day formats: "Monday" and "Mon Mar 17" */
export function findPlanItemForDate(dateStr: string): { id: number } | null {
  const weekNumber = getWeekForDate(dateStr);
  const dayName = getDayName(dateStr);
  const dayAbbrev = getDayAbbrev(dateStr);
  const items = getPlanItems(weekNumber);
  const match = items.find((item: { day: string }) =>
    item.day === dayName || item.day.startsWith(dayAbbrev)
  );
  if (!match || match.id == null) return null;
  return { id: match.id };
}

/** Convert a standard time (HH:MM) to 24h+ format for storage.
 *  Times 00:00-05:59 become 24:00-29:59 (after-midnight bedtimes). */
export function toBedtimeStorage(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (h < 6) {
    return `${h + 24}:${m.toString().padStart(2, '0')}`;
  }
  return time;
}

/** Convert stored 24h+ format back to display (24:30 -> 00:30) */
export function fromBedtimeStorage(stored: string): string {
  const [h, m] = stored.split(':').map(Number);
  if (h >= 24) {
    return `${(h - 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
  return stored;
}

export interface WeekSummary {
  week_number: number;
  days_logged: number;
  workouts: { completed: number; planned: number };
  core: { done: number; target: number };
  rug_protocol: { done: number; total: number };
  vampire: {
    compliant: number;
    total: number;
    avg_bedtime: string | null;
    daily: Array<{ date: string; bedtime: string; compliant: boolean }>;
  };
  hydration: { tracked: number; total: number };
  kitchen_cutoff: { hit: number; total: number };
  sick_days: number;
  notes: Array<{ date: string; text: string }>;
  energy_levels: Array<{ date: string; level: number }>;
  pain_days: Array<{ date: string; level: number; area: string | null }>;
  sleep_disruptions: Array<{ date: string; type: string }>;
  tagged_notes: Array<{ date: string; category: string; text: string }>;
}

/** Compute the weekly summary from daily logs. Denominator is always 7. */
export function computeWeekSummary(weekNumber: number): WeekSummary {
  const logs = getDailyLogsByWeek(weekNumber);
  const planItems = getPlanItems(weekNumber);

  const workoutsCompleted = logs.filter((l: DailyLog) => l.workout_completed).length;
  const coreDone = logs.filter((l: DailyLog) => l.core_work_done).length;
  const rugDone = logs.filter((l: DailyLog) => l.rug_protocol_done).length;
  const hydrationTracked = logs.filter((l: DailyLog) => l.hydration_tracked).length;
  const kitchenHit = logs.filter((l: DailyLog) => l.kitchen_cutoff_hit).length;
  const sickDays = logs.filter((l: DailyLog) => l.is_sick_day).length;

  // Vampire Protocol
  const bedtimeLogs = logs.filter((l: DailyLog) => l.vampire_bedtime);
  const compliantCount = bedtimeLogs.filter((l: DailyLog) => isBedtimeCompliant(l.vampire_bedtime!)).length;
  let avgBedtime: string | null = null;
  if (bedtimeLogs.length > 0) {
    const totalMinutes = bedtimeLogs.reduce((sum: number, l: DailyLog) => {
      const [h, m] = l.vampire_bedtime!.split(':').map(Number);
      return sum + h * 60 + m;
    }, 0);
    const avgMin = Math.round(totalMinutes / bedtimeLogs.length);
    const avgH = Math.floor(avgMin / 60);
    const avgM = avgMin % 60;
    avgBedtime = fromBedtimeStorage(`${avgH}:${avgM.toString().padStart(2, '0')}`);
  }

  const vampireDaily = bedtimeLogs.map((l: DailyLog) => ({
    date: l.date,
    bedtime: fromBedtimeStorage(l.vampire_bedtime!),
    compliant: isBedtimeCompliant(l.vampire_bedtime!),
  }));

  const notes = logs
    .filter((l: DailyLog) => l.notes && l.notes.trim())
    .map((l: DailyLog) => ({ date: l.date, text: l.notes!.trim() }));

  // Energy levels
  const energy_levels = logs
    .filter((l: DailyLog) => l.energy_level != null)
    .map((l: DailyLog) => ({ date: l.date, level: l.energy_level! }));

  // Pain days
  const pain_days = logs
    .filter((l: DailyLog) => l.pain_level != null && l.pain_level > 0)
    .map((l: DailyLog) => ({ date: l.date, level: l.pain_level!, area: l.pain_area }));

  // Sleep disruptions
  const sleep_disruptions = logs
    .filter((l: DailyLog) => l.sleep_disruption != null)
    .map((l: DailyLog) => ({ date: l.date, type: l.sleep_disruption! }));

  // Tagged notes (from daily_notes table)
  const tagged_notes = getWeekNotes(weekNumber).map(n => ({
    date: n.date,
    category: n.category,
    text: n.text,
  }));

  return {
    week_number: weekNumber,
    days_logged: logs.length,
    workouts: { completed: workoutsCompleted, planned: planItems.length },
    core: { done: coreDone, target: 3 },
    rug_protocol: { done: rugDone, total: 7 },
    vampire: { compliant: compliantCount, total: 7, avg_bedtime: avgBedtime, daily: vampireDaily },
    hydration: { tracked: hydrationTracked, total: 7 },
    kitchen_cutoff: { hit: kitchenHit, total: 7 },
    sick_days: sickDays,
    notes,
    energy_levels,
    pain_days,
    sleep_disruptions,
    tagged_notes,
  };
}

// ── Re-export client-safe compliance functions ────────────────────────────
// Pure functions live in compliance.ts (no server deps) so client components
// can import them directly. Re-exported here for backward compatibility.
export {
  computeDayCompliance,
  computeWeekCompliancePct,
  getBedtimeComplianceLevel,
  isBedtimeCompliant,
  getComplianceColor,
};
export type {
  DayComplianceInput,
  ComplianceResult,
  BedtimeLevel,
};

// ── Streak Computation ─────────────────────────────────────────────────────

export type StreakLogEntry = DayComplianceInput & { date: string };

/**
 * Compute the current and best consecutive compliance streaks across all logs.
 *
 * Rules:
 * - Walk every calendar date from first log date to currentDate (inclusive)
 * - Skip Saturdays (getDay() === 6) — family day, never breaks a streak
 * - A missing log counts as non-compliant (breaks the streak)
 * - A day is compliant if computeDayCompliance(log, hasSession).pct >= 80
 * - datesWithSessions is the set of dates that have a planned training session
 */
export function computeStreak(
  allLogs: StreakLogEntry[],
  currentDate: string,
  datesWithSessions: string[],
): { current: number; best: number } {
  if (allLogs.length === 0) return { current: 0, best: 0 };

  const logMap = new Map<string, StreakLogEntry>();
  for (const log of allLogs) {
    logMap.set(log.date, log);
  }

  const sessionSet = new Set(datesWithSessions);

  // Determine iteration range
  const firstDate = allLogs[0].date;
  const start = new Date(firstDate + 'T12:00:00');
  const end = new Date(currentDate + 'T12:00:00');

  let current = 0;
  let best = 0;
  let streak = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat
    if (dayOfWeek === 6) continue; // skip Saturdays

    const dateStr = d.toISOString().slice(0, 10);
    const log = logMap.get(dateStr);

    if (!log) {
      // Missing log — streak broken
      streak = 0;
      continue;
    }

    const hasSession = sessionSet.has(dateStr);
    const result = computeDayCompliance(log, hasSession);

    if (result.pct >= 80) {
      streak += 1;
      if (streak > best) best = streak;
    } else {
      streak = 0;
    }
  }

  current = streak;
  return { current, best };
}

/** Compute compliance % for each of the last N weeks. */
export function getComplianceTrend(
  currentWeek: number,
  weeks: number,
): Array<{ week_number: number; compliance_pct: number; days_logged: number }> {
  const result: Array<{ week_number: number; compliance_pct: number; days_logged: number }> = [];

  for (let w = currentWeek - weeks + 1; w <= currentWeek; w++) {
    if (w < 1) continue;
    const logs = getDailyLogsByWeek(w);
    if (logs.length === 0) {
      result.push({ week_number: w, compliance_pct: 0, days_logged: 0 });
      continue;
    }
    const planItems = getPlanItems(w);
    const hasPlanned = logs.map(l => {
      const dn = getDayName(l.date);
      const da = getDayAbbrev(l.date);
      return planItems.some((item: { day: string }) =>
        item.day === dn || item.day.startsWith(da)
      );
    });
    const pct = computeWeekCompliancePct(logs, hasPlanned);
    result.push({ week_number: w, compliance_pct: pct, days_logged: logs.length });
  }

  return result;
}

/** Format the week summary as a markdown block for agent context injection */
export function formatWeekSummaryForAgents(summary: WeekSummary): string {
  let md = `## Daily Log Summary (Week ${summary.week_number})\n`;
  md += `- Days logged: ${summary.days_logged}/7\n`;
  md += `- Workouts completed: ${summary.workouts.completed}/${summary.workouts.planned}\n`;
  md += `- Core work: ${summary.core.done}/${summary.core.target} target days\n`;
  md += `- Rug Protocol: ${summary.rug_protocol.done}/7 days\n`;

  md += `- Vampire Protocol: ${summary.vampire.compliant}/7 compliant`;
  if (summary.vampire.avg_bedtime) {
    md += ` (avg bedtime ${summary.vampire.avg_bedtime})`;
  }
  md += `\n`;
  if (summary.vampire.daily.length > 0) {
    const entries = summary.vampire.daily.map(d => {
      const dayName = getDayName(d.date).slice(0, 3);
      return `${dayName} ${d.bedtime} ${d.compliant ? '✓' : '✗'}`;
    });
    md += `  - ${entries.join(', ')}\n`;
  }

  md += `- Hydration tracked: ${summary.hydration.tracked}/7 days\n`;
  md += `- Kitchen Cutoff: ${summary.kitchen_cutoff.hit}/7\n`;
  md += `- Sick days: ${summary.sick_days}\n`;

  // Energy levels
  if (summary.energy_levels.length > 0) {
    const entries = summary.energy_levels.map(e => {
      const dayName = getDayName(e.date).slice(0, 3);
      return `${dayName}:${e.level}`;
    });
    md += `- Energy levels: ${entries.join(', ')}\n`;
  }

  // Pain flags
  if (summary.pain_days.length > 0) {
    md += `- Pain flags:\n`;
    for (const p of summary.pain_days) {
      const dayName = getDayName(p.date).slice(0, 3);
      const painLabel = ['none', 'mild', 'moderate', 'stop'][p.level] || `${p.level}`;
      md += `  - ${dayName}: ${painLabel}${p.area ? ` (${p.area})` : ''}\n`;
    }
  }

  // Sleep disruptions
  if (summary.sleep_disruptions.length > 0) {
    const entries = summary.sleep_disruptions.map(d => {
      const dayName = getDayName(d.date).slice(0, 3);
      return `${dayName}: ${d.type}`;
    });
    md += `- Sleep disruptions: ${entries.join(', ')}\n`;
  }

  // Tagged notes (preferred over old free-text notes)
  if (summary.tagged_notes.length > 0) {
    md += `- Notes:\n`;
    for (const n of summary.tagged_notes) {
      const dayName = getDayName(n.date).slice(0, 3);
      md += `  - ${dayName} (${n.category}): ${n.text}\n`;
    }
  } else if (summary.notes.length > 0) {
    md += `- Notes:\n`;
    for (const n of summary.notes) {
      const dayName = getDayName(n.date).slice(0, 3);
      md += `  - ${dayName}: ${n.text}\n`;
    }
  }

  return md;
}
