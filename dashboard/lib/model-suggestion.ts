import { getRaces, getWeeklyMetrics } from './db';
import type { WeekSummary } from './daily-log';

export interface ModelSuggestion {
  suggestion: 'mixed' | 'opus' | 'sonnet';
  reasons: string[];
}

/**
 * Phase 2 transition date — April 6, 2026 (first Monday of April 2026).
 * TODO: derive dynamically from state/periodization.md or a settings key.
 */
const PHASE_2_START = new Date('2026-04-06T00:00:00');


export function suggestModel(
  compliance: WeekSummary,
  currentWeekNumber: number,
  combinedReadiness?: number,
  /** Override current date — used in tests only */
  _now?: Date,
): ModelSuggestion {
  const reasons: string[] = [];
  const now = _now ?? new Date();

  // 1. Pain level >= 2 this week
  const highPainDays = compliance.pain_days.filter((p) => p.level >= 2);
  if (highPainDays.length > 0) {
    const areas = highPainDays
      .map((p) => (p.area ? `${p.area}` : `level ${p.level}`))
      .join(', ');
    reasons.push(`Pain flagged this week (${areas})`);
  }

  // 2. Phase transition within 2 weeks (14 days)
  const msUntilPhase2 = PHASE_2_START.getTime() - now.getTime();
  const daysUntilPhase2 = msUntilPhase2 / (1000 * 60 * 60 * 24);
  if (daysUntilPhase2 >= 0 && daysUntilPhase2 <= 14) {
    reasons.push(
      `Phase 2 transition in ${Math.ceil(daysUntilPhase2)} day${Math.ceil(daysUntilPhase2) === 1 ? '' : 's'}`,
    );
  }

  // 3. Any registered race within 4 weeks (28 days)
  try {
    const races = getRaces();
    const upcomingRace = races.find((r) => {
      if (r.status === 'completed') return false;
      const raceDate = new Date(r.date + 'T00:00:00');
      const msUntil = raceDate.getTime() - now.getTime();
      const daysUntil = msUntil / (1000 * 60 * 60 * 24);
      return daysUntil >= 0 && daysUntil <= 28;
    });
    if (upcomingRace) {
      const daysUntil = Math.ceil(
        (new Date(upcomingRace.date + 'T00:00:00').getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      reasons.push(`${upcomingRace.name} is in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`);
    }
  } catch {
    // DB unavailable — skip this check
  }

  // 4. Previous week's plan satisfaction was 1 (too light) or 5 (too much)
  try {
    const prevMetrics = getWeeklyMetrics(currentWeekNumber - 1);
    if (prevMetrics.length > 0) {
      const prevSat = prevMetrics[0].planSatisfaction;
      if (prevSat === 1) {
        reasons.push('Last week felt too light — plan calibration needed');
      } else if (prevSat === 5) {
        reasons.push('Last week felt like too much — load review needed');
      }
    }
  } catch {
    // DB unavailable — skip this check
  }

  // 5. Combined readiness < 35 (recovery veto range)
  if (combinedReadiness !== undefined && combinedReadiness < 35) {
    reasons.push(`Combined readiness is ${combinedReadiness} (recovery veto range)`);
  }

  // Suggest Opus if any trigger fired, otherwise default to mixed
  const suggestion: ModelSuggestion['suggestion'] = reasons.length > 0 ? 'opus' : 'mixed';

  return { suggestion, reasons };
}
