import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { suggestModel } from '@/lib/model-suggestion';
import type { WeekSummary } from '@/lib/daily-log';

/**
 * A stable "now" well outside all time-based trigger windows:
 * - Phase 2 starts 2026-04-06 — STABLE_NOW is ~81 days before, so no phase trigger
 * - Races in DB are controlled per-test
 */
const STABLE_NOW = new Date('2026-01-15T12:00:00');

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  getRaces: vi.fn(),
  getWeeklyMetrics: vi.fn(),
}));

import * as dbMock from '@/lib/db';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeCompliance(overrides: Partial<WeekSummary> = {}): WeekSummary {
  return {
    week_number: 12,
    days_logged: 5,
    workouts: { completed: 3, planned: 4 },
    core: { done: 2, target: 3 },
    rug_protocol: { done: 4, total: 7 },
    vampire: { compliant: 3, total: 7, avg_bedtime: null, daily: [] },
    hydration: { tracked: 2, total: 7 },
    kitchen_cutoff: { hit: 4, total: 7 },
    sick_days: 0,
    notes: [],
    energy_levels: [],
    pain_days: [],
    sleep_disruptions: [],
    tagged_notes: [],
    ...overrides,
  };
}

function makeMetrics(planSatisfaction: number) {
  return [{
    weekNumber: 11,
    checkInDate: '2026-01-11',
    planSatisfaction,
    weightKg: null, bodyFatPct: null, muscleMassKg: null,
    avgSleepScore: null, avgTrainingReadiness: null, avgRhr: null, avgHrv: null,
    caloriesAvg: null, proteinAvg: null, hydrationTracked: false,
    vampireCompliancePct: null, rugProtocolDays: null, sessionsPlanned: null,
    sessionsCompleted: null, bakerCystPain: null, pullupCount: null,
    perceivedReadiness: null, modelUsed: 'mixed',
    kitchenCutoffCompliance: null, avgEnergy: null, painDays: null,
    sleepDisruptionCount: null,
    avgRpe: null, hardExerciseCount: null, weekReflection: null, nextWeekConflicts: null,
    questionsForCoaches: null, sickDays: null, painAreasSummary: null, sleepDisruptionBreakdown: null,
  }];
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(dbMock.getRaces).mockReturnValue([]);
  vi.mocked(dbMock.getWeeklyMetrics).mockReturnValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('suggestModel', () => {
  // ── Baseline ──

  it('returns mixed with no reasons when everything is normal', () => {
    const result = suggestModel(makeCompliance(), 12, undefined, STABLE_NOW);
    expect(result.suggestion).toBe('mixed');
    expect(result.reasons).toHaveLength(0);
  });

  // ── Pain ──

  it('returns opus when pain level >= 2', () => {
    const compliance = makeCompliance({
      pain_days: [{ date: '2026-01-13', level: 2, area: 'knee' }],
    });
    const result = suggestModel(compliance, 12, undefined, STABLE_NOW);
    expect(result.suggestion).toBe('opus');
    expect(result.reasons.some((r) => r.includes('Pain'))).toBe(true);
  });

  it('includes pain area in the reason text', () => {
    const compliance = makeCompliance({
      pain_days: [{ date: '2026-01-13', level: 2, area: 'lower back' }],
    });
    const result = suggestModel(compliance, 12, undefined, STABLE_NOW);
    expect(result.reasons[0]).toContain('lower back');
  });

  it('does not trigger on pain level 1', () => {
    const compliance = makeCompliance({
      pain_days: [{ date: '2026-01-13', level: 1, area: null }],
    });
    const result = suggestModel(compliance, 12, undefined, STABLE_NOW);
    expect(result.suggestion).toBe('mixed');
  });

  // ── Combined readiness ──

  it('returns opus when combined readiness < 35', () => {
    const result = suggestModel(makeCompliance(), 12, 30, STABLE_NOW);
    expect(result.suggestion).toBe('opus');
    expect(result.reasons.some((r) => r.includes('readiness'))).toBe(true);
  });

  it('does not trigger readiness nudge at exactly 35', () => {
    const result = suggestModel(makeCompliance(), 12, 35, STABLE_NOW);
    expect(result.suggestion).toBe('mixed');
  });

  it('returns mixed when combined readiness is undefined and no other triggers', () => {
    const result = suggestModel(makeCompliance(), 12, undefined, STABLE_NOW);
    expect(result.suggestion).toBe('mixed');
  });

  // ── Plan satisfaction ──

  it('returns opus when previous week plan satisfaction was 1 (too light)', () => {
    vi.mocked(dbMock.getWeeklyMetrics).mockReturnValue(makeMetrics(1));
    const result = suggestModel(makeCompliance(), 12, undefined, STABLE_NOW);
    expect(result.suggestion).toBe('opus');
    expect(result.reasons.some((r) => r.includes('too light'))).toBe(true);
  });

  it('returns opus when previous week plan satisfaction was 5 (too much)', () => {
    vi.mocked(dbMock.getWeeklyMetrics).mockReturnValue(makeMetrics(5));
    const result = suggestModel(makeCompliance(), 12, undefined, STABLE_NOW);
    expect(result.suggestion).toBe('opus');
    expect(result.reasons.some((r) => r.includes('too much'))).toBe(true);
  });

  it('does not trigger on neutral plan satisfaction (2, 3, 4)', () => {
    for (const sat of [2, 3, 4]) {
      vi.mocked(dbMock.getWeeklyMetrics).mockReturnValue(makeMetrics(sat));
      const result = suggestModel(makeCompliance(), 12, undefined, STABLE_NOW);
      expect(result.suggestion).toBe('mixed');
    }
  });

  // ── Race proximity ──

  it('returns opus when a race is within 4 weeks', () => {
    // Use a fixed "now" and a race date 14 days ahead
    const testNow = new Date('2026-01-15T12:00:00');
    const raceDate = '2026-01-29'; // 14 days later
    vi.mocked(dbMock.getRaces).mockReturnValue([
      { id: 'race-1', name: 'Spartan Zandvoort', date: raceDate, location: 'NL', type: 'super', status: 'planned', notes: '' },
    ]);
    const result = suggestModel(makeCompliance(), 12, undefined, testNow);
    expect(result.suggestion).toBe('opus');
    expect(result.reasons.some((r) => r.includes('Spartan Zandvoort'))).toBe(true);
  });

  it('does not trigger on a completed race within 4 weeks', () => {
    const testNow = new Date('2026-01-15T12:00:00');
    vi.mocked(dbMock.getRaces).mockReturnValue([
      { id: 'race-1', name: 'Past Race', date: '2026-01-29', location: 'NL', type: 'super', status: 'completed', notes: '' },
    ]);
    const result = suggestModel(makeCompliance(), 12, undefined, testNow);
    expect(result.suggestion).toBe('mixed');
  });

  it('does not trigger on a race more than 4 weeks away', () => {
    const testNow = new Date('2026-01-15T12:00:00');
    vi.mocked(dbMock.getRaces).mockReturnValue([
      { id: 'race-1', name: 'Far Race', date: '2026-02-25', location: 'NL', type: 'super', status: 'planned', notes: '' },
    ]);
    const result = suggestModel(makeCompliance(), 12, undefined, testNow);
    expect(result.suggestion).toBe('mixed');
  });

  // ── Phase transition ──

  it('returns opus when phase transition is within 2 weeks', () => {
    // Phase 2 starts 2026-04-06. Use a now 10 days before.
    const testNow = new Date('2026-03-27T12:00:00');
    const result = suggestModel(makeCompliance(), 12, undefined, testNow);
    expect(result.suggestion).toBe('opus');
    expect(result.reasons.some((r) => r.toLowerCase().includes('phase'))).toBe(true);
  });

  it('does not trigger phase transition nudge more than 2 weeks out', () => {
    // 20 days before Phase 2
    const testNow = new Date('2026-03-17T12:00:00');
    const result = suggestModel(makeCompliance(), 12, undefined, testNow);
    expect(result.suggestion).toBe('mixed');
  });

  it('does not trigger phase transition nudge after it has passed', () => {
    // 5 days after Phase 2 start
    const testNow = new Date('2026-04-11T12:00:00');
    const result = suggestModel(makeCompliance(), 12, undefined, testNow);
    expect(result.suggestion).toBe('mixed');
  });

  // ── Multi-reason accumulation ──

  it('accumulates multiple reasons', () => {
    const compliance = makeCompliance({
      pain_days: [{ date: '2026-01-13', level: 3, area: 'knee' }],
    });
    const result = suggestModel(compliance, 12, 28, STABLE_NOW);
    expect(result.suggestion).toBe('opus');
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });

  // ── Error resilience ──

  it('handles getRaces throwing gracefully', () => {
    vi.mocked(dbMock.getRaces).mockImplementation(() => { throw new Error('DB error'); });
    expect(() => suggestModel(makeCompliance(), 12, undefined, STABLE_NOW)).not.toThrow();
  });

  it('handles getWeeklyMetrics throwing gracefully', () => {
    vi.mocked(dbMock.getWeeklyMetrics).mockImplementation(() => { throw new Error('DB error'); });
    expect(() => suggestModel(makeCompliance(), 12, undefined, STABLE_NOW)).not.toThrow();
  });
});
