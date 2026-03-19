/** Monday of the week containing program start (Jan 1, 2026 = Wed → Mon Dec 29, 2025) */
export const PROGRAM_EPOCH = new Date('2025-12-29T00:00:00');
const MS_PER_DAY = 86_400_000;

/** Returns the training week number for a given date (default: today). Week 1 = Dec 29, 2025.
 *  Both epoch and input are normalized to local midnight to avoid UTC/local timezone mismatches
 *  (date-only strings like '2026-01-04' parse as UTC, while 'T00:00:00' parses as local). */
export function getTrainingWeek(date: Date = new Date()): number {
  const epochLocal = new Date(PROGRAM_EPOCH.getFullYear(), PROGRAM_EPOCH.getMonth(), PROGRAM_EPOCH.getDate());
  const dateLocal = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSince = Math.round((dateLocal.getTime() - epochLocal.getTime()) / MS_PER_DAY);
  if (daysSince < 0) return 1;
  return Math.floor(daysSince / 7) + 1;
}

/** Returns the week number for the plan being generated.
 *  On Sunday: plan is for next week (tomorrow's Monday).
 *  Any other day: plan is for current week. */
export function getPlanWeekNumber(): number {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getTrainingWeek(tomorrow);
}
