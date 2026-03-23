/**
 * Tests for E1: Tiered History Builder
 */
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import {
  initTablesOn,
  upsertDailyLog,
  insertDailyNote,
  getDailyLogsByWeek,
  getWeekNotes,
} from '../lib/db';
import type { DailyLog, DailyNote } from '../lib/db';
import type { WeeklyMetrics, CeilingEntry } from '../lib/types';
import { buildTieredHistory } from '../lib/tiered-history';
import type { TieredHistoryDeps } from '../lib/tiered-history';

// ── Test DB helpers ───────────────────────────────────────────────────────────

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initTablesOn(db);
  return db;
}

function insertLog(
  db: Database.Database,
  date: string,
  weekNumber: number,
  overrides: Partial<Omit<DailyLog, 'id' | 'date' | 'week_number' | 'created_at' | 'updated_at'>> = {}
): DailyLog {
  return upsertDailyLog(
    {
      date,
      week_number: weekNumber,
      workout_completed: overrides.workout_completed ?? 0,
      workout_plan_item_id: overrides.workout_plan_item_id ?? null,
      core_work_done: overrides.core_work_done ?? 0,
      rug_protocol_done: overrides.rug_protocol_done ?? 0,
      vampire_bedtime: overrides.vampire_bedtime ?? null,
      hydration_tracked: overrides.hydration_tracked ?? 0,
      kitchen_cutoff_hit: overrides.kitchen_cutoff_hit ?? 0,
      is_sick_day: overrides.is_sick_day ?? 0,
      notes: overrides.notes ?? null,
      energy_level: overrides.energy_level ?? null,
      pain_level: overrides.pain_level ?? null,
      pain_area: overrides.pain_area ?? null,
      sleep_disruption: overrides.sleep_disruption ?? null,
      session_summary: overrides.session_summary ?? null,
      session_log_id: overrides.session_log_id ?? null,
    },
    db
  );
}

/** Build deps from an in-memory DB, with optional override for metrics/ceilings. */
function makeDeps(
  db: Database.Database,
  metricsOverride?: WeeklyMetrics[],
  ceilingsOverride?: CeilingEntry[]
): TieredHistoryDeps {
  return {
    getDailyLogsByWeek: (wn) => getDailyLogsByWeek(wn, db),
    getWeekNotes: (wn) => getWeekNotes(wn, db),
    getWeeklyMetrics: () => metricsOverride ?? [],
    getCeilingHistory: () => ceilingsOverride ?? [],
  };
}

/**
 * Like makeDeps but the metrics mock filters by weekNumber when an argument is provided.
 * This more faithfully represents the production DB behaviour.
 */
function makeDepsFiltered(
  db: Database.Database,
  metricsOverride?: WeeklyMetrics[],
  ceilingsOverride?: CeilingEntry[]
): TieredHistoryDeps {
  return {
    getDailyLogsByWeek: (wn) => getDailyLogsByWeek(wn, db),
    getWeekNotes: (wn) => getWeekNotes(wn, db),
    getWeeklyMetrics: (wn?: number) => {
      const all = metricsOverride ?? [];
      return wn != null ? all.filter((m) => m.weekNumber === wn) : all;
    },
    getCeilingHistory: () => ceilingsOverride ?? [],
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EMPTY_METRICS: WeeklyMetrics[] = [];
const EMPTY_CEILINGS: CeilingEntry[] = [];

function makeMetric(weekNumber: number, overrides: Partial<WeeklyMetrics> = {}): WeeklyMetrics {
  return {
    weekNumber,
    checkInDate: `2026-01-${String(weekNumber).padStart(2, '0')}`,
    weightKg: 100 - weekNumber * 0.5,
    bodyFatPct: null,
    muscleMassKg: null,
    avgSleepScore: null,
    avgTrainingReadiness: null,
    avgRhr: null,
    avgHrv: null,
    caloriesAvg: null,
    proteinAvg: null,
    hydrationTracked: false,
    vampireCompliancePct: null,
    rugProtocolDays: null,
    sessionsPlanned: 4,
    sessionsCompleted: 3,
    bakerCystPain: null,
    pullupCount: null,
    perceivedReadiness: null,
    planSatisfaction: null,
    modelUsed: 'sonnet',
    kitchenCutoffCompliance: null,
    avgEnergy: null,
    painDays: null,
    sleepDisruptionCount: null,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('tiered history', () => {
  // ── Tier 1 ──────────────────────────────────────────────────────────────────

  describe('Tier 1 — recent detail (last 2 weeks)', () => {
    it('returns full daily detail for last 2 weeks', () => {
      const db = createTestDb();
      const currentWeek = 10;

      // Week 9 — 3 logs
      insertLog(db, '2026-02-23', 9, {
        workout_completed: 1, core_work_done: 1, energy_level: 4,
        vampire_bedtime: '22:30', session_summary: 'Upper A (95% compliance)',
      });
      insertLog(db, '2026-02-24', 9, { rug_protocol_done: 1, energy_level: 3 });
      insertLog(db, '2026-02-25', 9, { workout_completed: 1, pain_level: 1, pain_area: 'knee' });

      // Week 8 — 2 logs
      insertLog(db, '2026-02-16', 8, { workout_completed: 1, kitchen_cutoff_hit: 1 });
      insertLog(db, '2026-02-17', 8, { hydration_tracked: 1 });

      const result = buildTieredHistory(currentWeek, makeDeps(db));

      expect(result.recentDetail).toHaveLength(2);

      const week9 = result.recentDetail.find((w) => w.weekNumber === 9)!;
      expect(week9).toBeDefined();
      expect(week9.days).toHaveLength(3);

      const day1 = week9.days[0];
      expect(day1.date).toBe('2026-02-23');
      expect(day1.workoutCompleted).toBe(true);
      expect(day1.coreWorkDone).toBe(true);
      expect(day1.energyLevel).toBe(4);
      expect(day1.bedtime).toBe('22:30');
      expect(day1.sessionSummary).toBe('Upper A (95% compliance)');

      const painDay = week9.days.find((d) => d.date === '2026-02-25')!;
      expect(painDay.painLevel).toBe(1);
      expect(painDay.painArea).toBe('knee');

      const week8 = result.recentDetail.find((w) => w.weekNumber === 8)!;
      expect(week8).toBeDefined();
      expect(week8.days).toHaveLength(2);
    });

    it('includes tagged notes in daily detail', () => {
      const db = createTestDb();
      const currentWeek = 5;

      const log = insertLog(db, '2026-01-26', 4, { energy_level: 3 });
      insertDailyNote(log.id, 'injury', 'Baker cyst tender after run', db);
      insertDailyNote(log.id, 'sleep', 'Baby up twice', db);

      const result = buildTieredHistory(currentWeek, makeDeps(db));

      const week4 = result.recentDetail.find((w) => w.weekNumber === 4)!;
      expect(week4).toBeDefined();

      const day = week4.days.find((d) => d.date === '2026-01-26')!;
      expect(day.notes).toHaveLength(2);
      expect(day.notes[0].category).toBe('injury');
      expect(day.notes[0].text).toBe('Baker cyst tender after run');
      expect(day.notes[1].category).toBe('sleep');
    });

    it('handles after-midnight bedtimes (24h+ format)', () => {
      const db = createTestDb();
      const log = insertLog(db, '2026-02-23', 9, { vampire_bedtime: '25:30' }); // 01:30 AM

      const result = buildTieredHistory(10, makeDeps(db));
      const week9 = result.recentDetail.find((w) => w.weekNumber === 9)!;
      const day = week9.days.find((d) => d.date === '2026-02-23')!;

      expect(day.bedtime).toBe('01:30'); // converted from 25:30
    });

    it('recent detail only covers weeks 1 and 2 prior (not current week)', () => {
      const db = createTestDb();
      const currentWeek = 10;

      // Insert log for current week — should NOT appear in recentDetail
      insertLog(db, '2026-03-02', 10, { workout_completed: 1 });
      // Insert for week 9 and 8 — SHOULD appear
      insertLog(db, '2026-02-23', 9, { workout_completed: 1 });
      insertLog(db, '2026-02-16', 8, { workout_completed: 1 });

      const result = buildTieredHistory(currentWeek, makeDeps(db));
      const weekNumbers = result.recentDetail.map((w) => w.weekNumber);
      expect(weekNumbers).toContain(9);
      expect(weekNumbers).toContain(8);
      expect(weekNumbers).not.toContain(10);
    });
  });

  // ── Tier 2 ──────────────────────────────────────────────────────────────────

  describe('Tier 2 — weekly summaries (weeks 3-8)', () => {
    it('returns weekly summaries for weeks 3-8', () => {
      const db = createTestDb();
      const currentWeek = 12;

      // Insert some logs for weeks 4-9 (offset 3-8 from week 12)
      for (let w = 4; w <= 9; w++) {
        insertLog(db, `2026-01-${String(w * 2).padStart(2, '0')}`, w, {
          workout_completed: 1, core_work_done: 1, kitchen_cutoff_hit: 1,
        });
      }

      const result = buildTieredHistory(currentWeek, makeDeps(db));

      // weeks 3-8 back = weeks 4 through 9
      expect(result.weeklySummaries.length).toBeGreaterThanOrEqual(6);
      const weekNums = result.weeklySummaries.map((s) => s.weekNumber);
      expect(weekNums).toContain(9); // currentWeek - 3
      expect(weekNums).toContain(4); // currentWeek - 8

      // Should NOT contain weeks in Tier 1 range
      expect(weekNums).not.toContain(11); // currentWeek - 1
      expect(weekNums).not.toContain(10); // currentWeek - 2
    });

    it('computes compliance percentages correctly', () => {
      const db = createTestDb();
      const currentWeek = 5;

      // Week 2 — 3 days logged out of 7
      insertLog(db, '2025-12-29', 2, { workout_completed: 1, core_work_done: 1, kitchen_cutoff_hit: 1 });
      insertLog(db, '2025-12-30', 2, { workout_completed: 1, core_work_done: 1, kitchen_cutoff_hit: 0 });
      insertLog(db, '2025-12-31', 2, { workout_completed: 0, core_work_done: 1, kitchen_cutoff_hit: 1 });

      const result = buildTieredHistory(currentWeek, makeDeps(db));
      const week2 = result.weeklySummaries.find((s) => s.weekNumber === 2)!;
      expect(week2).toBeDefined();

      // 3 core / 7 total days = 43%
      expect(week2.coreCompliancePct).toBe(43);
      // 2 kitchen / 7 = 29%
      expect(week2.kitchenCutoffPct).toBe(29);
    });

    it('includes weight from weekly_metrics when available', () => {
      const db = createTestDb();
      const currentWeek = 5;
      insertLog(db, '2025-12-29', 2, {});

      const metrics = [makeMetric(2, { weightKg: 99.5 })];
      const result = buildTieredHistory(currentWeek, makeDeps(db, metrics));

      const week2 = result.weeklySummaries.find((s) => s.weekNumber === 2)!;
      expect(week2.weightKg).toBe(99.5);
    });

    it('computes week-over-week weight delta when previous week data exists', () => {
      const db = createTestDb();
      const currentWeek = 6;
      // week 3 = offset 3, week 2 = previous week for delta
      insertLog(db, '2026-01-12', 3, {});
      insertLog(db, '2026-01-05', 2, {});

      const metrics = [
        makeMetric(2, { weightKg: 100.0 }),
        makeMetric(3, { weightKg: 99.5 }),
      ];
      const result = buildTieredHistory(currentWeek, makeDepsFiltered(db, metrics));

      const week3 = result.weeklySummaries.find((s) => s.weekNumber === 3)!;
      expect(week3.weightKg).toBe(99.5);
      expect(week3.weightDeltaKg).toBe(-0.5);
    });

    it('sets weightDeltaKg to null when previous week has no weight data', () => {
      const db = createTestDb();
      const currentWeek = 6;
      insertLog(db, '2026-01-12', 3, {});

      // Only week 3 has weight, week 2 has no entry at all
      const metrics = [makeMetric(3, { weightKg: 99.5 })];
      const result = buildTieredHistory(currentWeek, makeDepsFiltered(db, metrics));

      const week3 = result.weeklySummaries.find((s) => s.weekNumber === 3)!;
      expect(week3.weightKg).toBe(99.5);
      expect(week3.weightDeltaKg).toBeNull();
    });

    it('sets weightDeltaKg to null when current week has no weight data', () => {
      const db = createTestDb();
      const currentWeek = 6;
      insertLog(db, '2026-01-12', 3, {});

      // Week 2 has weight but week 3 does not
      const metrics = [makeMetric(2, { weightKg: 100.0 }), makeMetric(3, { weightKg: null })];
      const result = buildTieredHistory(currentWeek, makeDepsFiltered(db, metrics));

      const week3 = result.weeklySummaries.find((s) => s.weekNumber === 3)!;
      expect(week3.weightKg).toBeNull();
      expect(week3.weightDeltaKg).toBeNull();
    });

    it('captures pain flags with body areas', () => {
      const db = createTestDb();
      const currentWeek = 5;

      insertLog(db, '2025-12-29', 2, { pain_level: 1, pain_area: 'knee' });
      insertLog(db, '2025-12-30', 2, { pain_level: 2, pain_area: 'lower back' });
      insertLog(db, '2025-12-31', 2, { pain_level: 0 }); // no pain

      const result = buildTieredHistory(currentWeek, makeDeps(db));
      const week2 = result.weeklySummaries.find((s) => s.weekNumber === 2)!;

      expect(week2.painFlags.count).toBe(2);
      expect(week2.painFlags.areas).toContain('knee');
      expect(week2.painFlags.areas).toContain('lower back');
    });

    it('includes key notes text', () => {
      const db = createTestDb();
      const currentWeek = 5;

      const log = insertLog(db, '2025-12-29', 2, {});
      insertDailyNote(log.id, 'training', 'Hit 5 pull-ups for the first time', db);

      const result = buildTieredHistory(currentWeek, makeDeps(db));
      const week2 = result.weeklySummaries.find((s) => s.weekNumber === 2)!;

      expect(week2.keyNotes.length).toBeGreaterThanOrEqual(1);
      expect(week2.keyNotes[0]).toContain('Hit 5 pull-ups');
    });
  });

  // ── Tier 3 ──────────────────────────────────────────────────────────────────

  describe('Tier 3 — trends (weeks 9+)', () => {
    it('returns trend data for weeks 9+', () => {
      const db = createTestDb();
      const currentWeek = 12;

      // weeks 1-3 are in the trends window (offset 9+ from week 12)
      const metrics = [
        makeMetric(1, { weightKg: 102.0 }),
        makeMetric(2, { weightKg: 101.2 }),
        makeMetric(3, { weightKg: 100.5 }),
      ];

      const ceilings: CeilingEntry[] = [
        { weekNumber: 1, date: '2026-01-05', exercise: 'Squat', weightKg: 80 },
        { weekNumber: 2, date: '2026-01-12', exercise: 'Squat', weightKg: 82.5 },
        { weekNumber: 3, date: '2026-01-19', exercise: 'Squat', weightKg: 85 },
      ];

      const result = buildTieredHistory(currentWeek, makeDeps(db, metrics, ceilings));

      // Weight curve should contain weeks up to week 3 (currentWeek - 9 = 3)
      expect(result.trends.weightCurve).toHaveLength(3);
      expect(result.trends.weightCurve[0]).toEqual({ weekNumber: 1, weightKg: 102.0 });
      expect(result.trends.weightCurve[2]).toEqual({ weekNumber: 3, weightKg: 100.5 });

      // Ceiling progression
      expect(result.trends.ceilingProgression).toHaveLength(1);
      expect(result.trends.ceilingProgression[0].exercise).toBe('Squat');
      expect(result.trends.ceilingProgression[0].history).toHaveLength(3);
    });

    it('detects weight threshold crossings as phase milestones', () => {
      const db = createTestDb();
      const currentWeek = 15;

      const metrics = [
        makeMetric(1, { weightKg: 102.0 }),
        makeMetric(2, { weightKg: 101.0 }),
        makeMetric(3, { weightKg: 99.8, checkInDate: '2026-01-19' }), // crossed 100kg
        makeMetric(4, { weightKg: 99.0 }),
        makeMetric(5, { weightKg: 98.5 }),
        makeMetric(6, { weightKg: 97.2, checkInDate: '2026-02-02' }), // crossed 97 (no — only 99 to 98.5 skips 99?)
      ];

      const result = buildTieredHistory(currentWeek, makeDeps(db, metrics));

      const milestones = result.trends.phaseMilestones;
      // Week 3 crossed below 100kg
      const below100 = milestones.find((m) => m.note.includes('100kg'));
      expect(below100).toBeDefined();
      expect(below100!.weekNumber).toBe(3);
    });

    it('detects baker cyst injury flags from weekly_metrics', () => {
      const db = createTestDb();
      const currentWeek = 12;

      const metrics = [
        makeMetric(1, { bakerCystPain: 2 }),
        makeMetric(2, { bakerCystPain: null }),
        makeMetric(3, { bakerCystPain: 0 }),
      ];

      const result = buildTieredHistory(currentWeek, makeDeps(db, metrics));

      const flags = result.trends.recurringInjuryFlags;
      expect(flags.length).toBe(1);
      expect(flags[0].weekNumber).toBe(1);
      expect(flags[0].area).toBe('knee/baker-cyst');
      expect(flags[0].level).toBe(2);
      expect(flags[0].source).toBe('baker-cyst');
    });

    it('detects recurring pain areas from daily logs (2+ weeks)', () => {
      const db = createTestDb();
      const currentWeek = 12;

      // Weeks 1-3 are in trend window (currentWeek - 9 = 3)
      const metrics = [makeMetric(1), makeMetric(2), makeMetric(3)];

      // Lower back pain in weeks 1 and 3 → recurring
      insertLog(db, '2026-01-05', 1, { pain_level: 2, pain_area: 'lower back' });
      insertLog(db, '2026-01-06', 1, { pain_level: 1, pain_area: 'shoulder' }); // only once
      insertLog(db, '2026-01-19', 3, { pain_level: 3, pain_area: 'lower back' });

      const result = buildTieredHistory(currentWeek, makeDeps(db, metrics));

      const flags = result.trends.recurringInjuryFlags;
      const lowerBack = flags.find((f) => f.area === 'lower back');
      expect(lowerBack).toBeDefined();
      expect(lowerBack!.source).toBe('daily-log');
      expect(lowerBack!.occurrenceCount).toBe(2);
      expect(lowerBack!.weekNumber).toBe(1); // first week it appeared
      expect(lowerBack!.level).toBe(3); // max level seen

      // Shoulder only appeared once — should NOT be in flags
      const shoulder = flags.find((f) => f.area === 'shoulder');
      expect(shoulder).toBeUndefined();
    });

    it('does not flag pain areas that only appear in 1 week', () => {
      const db = createTestDb();
      const currentWeek = 12;

      const metrics = [makeMetric(1), makeMetric(2), makeMetric(3)];

      // Knee pain in only 1 week
      insertLog(db, '2026-01-05', 1, { pain_level: 2, pain_area: 'knee' });
      insertLog(db, '2026-01-06', 1, { pain_level: 1, pain_area: 'knee' }); // same week — still only 1 week

      const result = buildTieredHistory(currentWeek, makeDeps(db, metrics));
      const flags = result.trends.recurringInjuryFlags;
      const knee = flags.find((f) => f.area === 'knee' && f.source === 'daily-log');
      expect(knee).toBeUndefined();
    });

    it('combines baker-cyst flags and daily-log recurring flags', () => {
      const db = createTestDb();
      const currentWeek = 12;

      const metrics = [
        makeMetric(1, { bakerCystPain: 2 }),
        makeMetric(2),
        makeMetric(3),
      ];

      // Shoulder pain in weeks 1 and 2 → recurring daily-log flag
      insertLog(db, '2026-01-05', 1, { pain_level: 1, pain_area: 'shoulder' });
      insertLog(db, '2026-01-12', 2, { pain_level: 2, pain_area: 'shoulder' });

      const result = buildTieredHistory(currentWeek, makeDeps(db, metrics));
      const flags = result.trends.recurringInjuryFlags;

      const bakerCyst = flags.find((f) => f.source === 'baker-cyst');
      const shoulder = flags.find((f) => f.area === 'shoulder');

      expect(bakerCyst).toBeDefined();
      expect(shoulder).toBeDefined();
      expect(shoulder!.source).toBe('daily-log');
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles weeks with no data gracefully', () => {
      const db = createTestDb();
      // No logs inserted at all

      const result = buildTieredHistory(10, makeDeps(db));

      expect(result.recentDetail).toHaveLength(2); // weeks 9 and 8 — both empty
      expect(result.recentDetail[0].days).toHaveLength(0);
      expect(result.recentDetail[1].days).toHaveLength(0);

      // weeklySummaries for weeks 2-7 — all with zero counts
      expect(result.weeklySummaries.length).toBeGreaterThan(0);
      for (const s of result.weeklySummaries) {
        expect(s.sessionsCompleted).toBe(0);
        expect(s.weightKg).toBeNull();
      }
    });

    it('handles currentWeek = 1 (no prior weeks)', () => {
      const db = createTestDb();

      const result = buildTieredHistory(1, makeDeps(db));

      // No weeks before week 1
      expect(result.recentDetail).toHaveLength(0);
      expect(result.weeklySummaries).toHaveLength(0);
      expect(result.trends.weightCurve).toHaveLength(0);
    });

    it('handles currentWeek = 2 (only 1 recent week, no summaries, no trends)', () => {
      const db = createTestDb();
      insertLog(db, '2026-01-05', 1, { workout_completed: 1 });

      const result = buildTieredHistory(2, makeDeps(db));

      expect(result.recentDetail).toHaveLength(1);
      expect(result.recentDetail[0].weekNumber).toBe(1);
      expect(result.weeklySummaries).toHaveLength(0); // no weeks 3-8 back exist
      expect(result.trends.weightCurve).toHaveLength(0); // no weeks 9+ back
    });

    it('handles currentWeek < 3 (no summaries needed)', () => {
      const db = createTestDb();

      const result = buildTieredHistory(2, makeDeps(db));
      expect(result.weeklySummaries).toHaveLength(0);
    });

    it('handles currentWeek < 9 (no trends needed)', () => {
      const db = createTestDb();
      const metrics = [makeMetric(1), makeMetric(2), makeMetric(3)];

      const result = buildTieredHistory(8, makeDeps(db, metrics));

      // currentWeek - 9 = -1, so no trends
      expect(result.trends.weightCurve).toHaveLength(0);
      expect(result.trends.ceilingProgression).toHaveLength(0);
    });
  });

  // ── Formatting ───────────────────────────────────────────────────────────────

  describe('format() — markdown output', () => {
    it('produces valid markdown with section headers', () => {
      const db = createTestDb();
      const currentWeek = 12;

      insertLog(db, '2026-02-23', 9, { workout_completed: 1, energy_level: 4 });
      insertLog(db, '2026-02-16', 8, { workout_completed: 1 });

      const metrics = [makeMetric(1, { weightKg: 102 }), makeMetric(2, { weightKg: 101 })];
      const ceilings: CeilingEntry[] = [
        { weekNumber: 1, date: '2026-01-05', exercise: 'Deadlift', weightKg: 100 },
      ];

      const result = buildTieredHistory(currentWeek, makeDeps(db, metrics, ceilings));
      const md = result.format();

      expect(md).toContain('## Coaching History');
      expect(md).toContain('### Recent Detail');
      expect(md).toContain('### Weekly Summaries');
      expect(md).toContain('### Long-Term Trends');
    });

    it('recent detail section contains day rows with expected data', () => {
      const db = createTestDb();
      const currentWeek = 5;

      insertLog(db, '2026-01-26', 4, {
        workout_completed: 1, core_work_done: 1, energy_level: 4,
        vampire_bedtime: '22:30', kitchen_cutoff_hit: 1,
      });

      const result = buildTieredHistory(currentWeek, makeDeps(db));
      const md = result.format();

      expect(md).toContain('2026-01-26');
      expect(md).toContain('22:30');
    });

    it('returns minimal markdown when no data exists', () => {
      const db = createTestDb();

      const result = buildTieredHistory(3, makeDeps(db));
      const md = result.format();

      expect(md).toContain('## Coaching History');
      expect(typeof md).toBe('string');
      expect(md.length).toBeGreaterThan(0);
    });

    it('weekly summaries section includes compliance percentages', () => {
      const db = createTestDb();
      const currentWeek = 6;

      // Week 3 (offset 3 from week 6)
      for (let i = 0; i < 4; i++) {
        insertLog(db, `2026-01-1${i}`, 3, { core_work_done: 1 });
      }

      const result = buildTieredHistory(currentWeek, makeDeps(db));
      const md = result.format();

      expect(md).toContain('Week 3');
      expect(md).toContain('%'); // compliance percentages present
    });

    it('weekly summary shows weight delta in markdown', () => {
      const db = createTestDb();
      const currentWeek = 6;
      insertLog(db, '2026-01-12', 3, {});
      insertLog(db, '2026-01-05', 2, {});

      const metrics = [
        makeMetric(2, { weightKg: 100.0 }),
        makeMetric(3, { weightKg: 99.5 }),
      ];
      const result = buildTieredHistory(currentWeek, makeDepsFiltered(db, metrics));
      const md = result.format();

      // Should show weight with delta like "99.5kg (-0.5kg)"
      expect(md).toContain('99.5kg');
      expect(md).toContain('-0.5kg');
    });

    it('weekly summary shows weight without delta when no previous week data', () => {
      const db = createTestDb();
      const currentWeek = 6;
      insertLog(db, '2026-01-12', 3, {});

      const metrics = [makeMetric(3, { weightKg: 99.5 })];
      const result = buildTieredHistory(currentWeek, makeDepsFiltered(db, metrics));
      const md = result.format();

      expect(md).toContain('99.5kg');
      // No delta parenthetical
      expect(md).not.toContain('(-');
    });

    it('recurring daily-log injury flags appear in trends markdown', () => {
      const db = createTestDb();
      const currentWeek = 12;

      const metrics = [makeMetric(1), makeMetric(2), makeMetric(3)];
      insertLog(db, '2026-01-05', 1, { pain_level: 2, pain_area: 'lower back' });
      insertLog(db, '2026-01-12', 2, { pain_level: 1, pain_area: 'lower back' });

      const result = buildTieredHistory(currentWeek, makeDeps(db, metrics));
      const md = result.format();

      expect(md).toContain('lower back');
      expect(md).toContain('recurring');
      expect(md).toContain('2 weeks');
    });

    it('trends section includes weight curve', () => {
      const db = createTestDb();
      const currentWeek = 12;

      const metrics = [
        makeMetric(1, { weightKg: 102.0 }),
        makeMetric(2, { weightKg: 101.0 }),
        makeMetric(3, { weightKg: 100.0 }),
      ];

      const result = buildTieredHistory(currentWeek, makeDeps(db, metrics));
      const md = result.format();

      expect(md).toContain('Weight Curve');
      expect(md).toContain('102kg');
      expect(md).toContain('100kg');
    });
  });
});
