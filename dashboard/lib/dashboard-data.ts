// dashboard/lib/dashboard-data.ts

import { semanticColors } from './design-tokens';

/**
 * Combined Readiness Score = 60% perceived (1-5 → 0-100) + 40% Garmin avg readiness
 * See CLAUDE.md Section 7: Combined Readiness Decision Matrix
 */
export function calculateRecoveryScore(
  perceivedReadiness: number | null, // 1-5 scale
  garminAvgReadiness: number | null,
): number | null {
  if (perceivedReadiness == null && garminAvgReadiness == null) return null;

  const perceived100 = perceivedReadiness != null
    ? (perceivedReadiness / 5) * 100
    : null;

  if (perceived100 != null && garminAvgReadiness != null) {
    return Math.round(0.6 * perceived100 + 0.4 * garminAvgReadiness);
  }
  return garminAvgReadiness != null
    ? Math.round(garminAvgReadiness)
    : Math.round(perceived100!);
}

/** Map recovery score to training directive */
export function getRecoveryDirective(score: number | null): string {
  if (score == null) return 'No data';
  if (score < 20) return 'Rest day';
  if (score < 35) return 'Deload — Zone 2 + mobility';
  if (score <= 50) return 'Reduce volume 20%';
  return 'Train as programmed';
}

/** Map recovery score to semantic color */
export function getRecoveryColor(score: number | null): string {
  if (score == null) return '#94a3b8';
  if (score > 50) return semanticColors.recovery.good;
  if (score >= 35) return semanticColors.recovery.caution;
  return semanticColors.recovery.problem;
}

/** Map sleep score to bar color */
export function getSleepBarColor(score: number): string {
  if (score >= 75) return semanticColors.recovery.good;
  if (score >= 60) return semanticColors.recovery.caution;
  return semanticColors.recovery.problem;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Build 7-day sleep bar data (Mon-Sun) from Garmin daily sleep scores */
export function buildSleepBars(
  dailySleep: Array<{ date: string; score: number }>,
): Array<{ day: string; score: number | null }> {
  // Map dates to day-of-week (ISO: Mon=1, Sun=7)
  const scoreByDay = new Map<number, number>();
  for (const d of dailySleep) {
    const dt = new Date(d.date + 'T12:00:00'); // noon to avoid TZ issues
    const dow = dt.getDay(); // 0=Sun, 1=Mon...6=Sat
    const isoDow = dow === 0 ? 6 : dow - 1; // 0=Mon...6=Sun
    scoreByDay.set(isoDow, d.score);
  }

  return DAY_NAMES.map((day, i) => ({
    day,
    score: scoreByDay.get(i) ?? null,
  }));
}

/** Parse weight target string like "<97kg" or "89kg" to number */
function parseWeightTarget(target: string): number {
  const match = target.match(/([\d.]+)\s*kg/i);
  return match ? parseFloat(match[1]) : 89; // fallback to race weight
}

/** Build phase targets from periodization phases */
export function buildPhaseTargets(
  phases: Array<{
    number: number;
    name: string;
    dateRange: string;
    weightTarget: string;
    focus: string[];
  }>,
): Array<{
  phaseNumber: number;
  name: string;
  targetWeightKg: number;
}> {
  return phases.map((p) => ({
    phaseNumber: p.number,
    name: p.name,
    targetWeightKg: parseWeightTarget(p.weightTarget),
  }));
}
