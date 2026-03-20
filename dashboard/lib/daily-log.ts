import { getTrainingWeek } from './week';
import { getDailyLogsByWeek, getPlanItems } from './db';
import type { DailyLog } from './db';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Get the full English day name from a date string (YYYY-MM-DD) */
export function getDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00'); // noon to avoid timezone edge cases
  return DAY_NAMES[d.getDay()];
}

/** Get the training week number for a date string */
export function getWeekForDate(dateStr: string): number {
  return getTrainingWeek(new Date(dateStr + 'T12:00:00'));
}

/** Find the plan_item matching a date (by week_number + day name) */
export function findPlanItemForDate(dateStr: string): { id: number } | null {
  const weekNumber = getWeekForDate(dateStr);
  const dayName = getDayName(dateStr);
  const items = getPlanItems(weekNumber);
  const match = items.find((item: { day: string }) => item.day === dayName);
  return match ? { id: match.id } : null;
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

/** Is this bedtime compliant with the 23:00 Vampire Protocol target? */
export function isBedtimeCompliant(storedTime: string): boolean {
  const [h] = storedTime.split(':').map(Number);
  return h < 23;
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
  };
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

  if (summary.notes.length > 0) {
    md += `- Notes:\n`;
    for (const n of summary.notes) {
      const dayName = getDayName(n.date).slice(0, 3);
      md += `  - ${dayName}: ${n.text}\n`;
    }
  }

  return md;
}
