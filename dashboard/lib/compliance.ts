/**
 * Client-safe compliance utility functions.
 *
 * These are pure functions with no server-side dependencies (no db, no path, no fs).
 * Extracted from daily-log.ts so they can be used in client components.
 */

// ── Day Compliance ──────────────────────────────────────────────────────────

export interface DayComplianceInput {
  workout_completed: number;
  core_work_done: number;
  rug_protocol_done: number;
  vampire_bedtime: string | null;
  hydration_tracked: number;
  kitchen_cutoff_hit: number;
  is_sick_day: number;
  energy_level?: number | null;  // optional, not in compliance calc
  pain_level?: number | null;    // optional, not in compliance calc
}

export interface ComplianceResult {
  checked: number;
  total: number;
  pct: number;
}

/**
 * Compute compliance for a single day.
 *
 * Sick days: only hydration + bedtime count (total = 2).
 * Normal days: core, rug, bedtime, hydration, kitchen (5) + workout if hasPlannedSession (6).
 */
export function computeDayCompliance(
  log: DayComplianceInput,
  hasPlannedSession: boolean,
): ComplianceResult {
  if (log.is_sick_day) {
    const checked =
      (log.hydration_tracked ? 1 : 0) +
      (log.vampire_bedtime ? 1 : 0);
    const total = 2;
    return { checked, total, pct: Math.round((checked / total) * 100) };
  }

  let checked =
    (log.core_work_done ? 1 : 0) +
    (log.rug_protocol_done ? 1 : 0) +
    (log.vampire_bedtime ? 1 : 0) +
    (log.hydration_tracked ? 1 : 0) +
    (log.kitchen_cutoff_hit ? 1 : 0);
  let total = 5;

  if (hasPlannedSession) {
    total += 1;
    checked += log.workout_completed ? 1 : 0;
  }

  return { checked, total, pct: Math.round((checked / total) * 100) };
}

/**
 * Aggregate compliance across multiple days.
 * Returns 0-100. Returns 0 for an empty week.
 */
export function computeWeekCompliancePct(
  logs: DayComplianceInput[],
  hasPlannedSession: boolean[],
): number {
  if (logs.length === 0) return 0;

  let totalChecked = 0;
  let totalItems = 0;

  for (let i = 0; i < logs.length; i++) {
    const result = computeDayCompliance(logs[i], hasPlannedSession[i] ?? false);
    totalChecked += result.checked;
    totalItems += result.total;
  }

  if (totalItems === 0) return 0;
  return Math.round((totalChecked / totalItems) * 100);
}

// ── Bedtime Compliance ──────────────────────────────────────────────────────

export type BedtimeLevel = 'on-time' | 'late' | 'way-late';

/**
 * Classify a stored bedtime string into a compliance level.
 * Uses 24h+ storage format: times >= 24:00 are after midnight.
 *
 * on-time  -> hour < 23
 * late     -> 23 <= hour < 24
 * way-late -> hour >= 24 (after midnight)
 */
export function getBedtimeComplianceLevel(storedTime: string | null): BedtimeLevel | null {
  if (!storedTime) return null;
  const [h] = storedTime.split(':').map(Number);
  if (h < 23) return 'on-time';
  if (h < 24) return 'late';
  return 'way-late';
}

/** Is this bedtime compliant with the 23:00 Vampire Protocol target? */
export function isBedtimeCompliant(storedTime: string): boolean {
  return getBedtimeComplianceLevel(storedTime) === 'on-time';
}

// ── Compliance Color ────────────────────────────────────────────────────────

/**
 * Map current vs target count to a traffic-light color.
 *
 * success -> current >= target (on track)
 * warning -> 1-2 behind target
 * error   -> 3+ behind target
 */
export function getComplianceColor(
  current: number,
  target: number,
): 'success' | 'warning' | 'error' {
  const gap = target - current;
  if (gap <= 0) return 'success';
  if (gap <= 2) return 'warning';
  return 'error';
}
