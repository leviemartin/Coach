import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initTablesOn, upsertDailyLog, getDailyLog } from '../lib/db';
import { getWeekForDate, getPreviousDate } from '../lib/daily-log';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initTablesOn(db);
  return db;
}

/** Default payload for a daily log — all fields at their zero/null values. */
function defaultLog(date: string, db: Database.Database) {
  return {
    date,
    week_number: getWeekForDate(date),
    workout_completed: 0 as const,
    workout_plan_item_id: null,
    core_work_done: 0 as const,
    rug_protocol_done: 0 as const,
    vampire_bedtime: null,
    hydration_tracked: 0 as const,
    kitchen_cutoff_hit: 0 as const,
    is_sick_day: 0 as const,
    notes: null,
    energy_level: null,
    pain_level: null,
    pain_area: null,
    sleep_disruption: null,
    session_summary: null,
    session_log_id: null,
  };
}

/**
 * Mirrors the PUT handler's sleep_disruption side-effect:
 * write sleep_disruption to the PREVIOUS day's record.
 */
function applySleepDisruption(
  currentDate: string,
  sleepDisruption: string | null,
  db: Database.Database,
) {
  const prevDate = getPreviousDate(currentDate);
  const prevWeek = getWeekForDate(prevDate);
  const existingPrev = getDailyLog(prevDate, db);

  upsertDailyLog(
    {
      date: prevDate,
      week_number: prevWeek,
      workout_completed: existingPrev?.workout_completed ?? 0,
      workout_plan_item_id: existingPrev?.workout_plan_item_id ?? null,
      core_work_done: existingPrev?.core_work_done ?? 0,
      rug_protocol_done: existingPrev?.rug_protocol_done ?? 0,
      vampire_bedtime: existingPrev?.vampire_bedtime ?? null,
      hydration_tracked: existingPrev?.hydration_tracked ?? 0,
      kitchen_cutoff_hit: existingPrev?.kitchen_cutoff_hit ?? 0,
      is_sick_day: existingPrev?.is_sick_day ?? 0,
      notes: existingPrev?.notes ?? null,
      energy_level: existingPrev?.energy_level ?? null,
      pain_level: existingPrev?.pain_level ?? null,
      pain_area: existingPrev?.pain_area ?? null,
      sleep_disruption: sleepDisruption || null,
      session_summary: existingPrev?.session_summary ?? null,
      session_log_id: existingPrev?.session_log_id ?? null,
    },
    db,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sleep disruption previous-day logic', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('writes sleep_disruption to previous date record', () => {
    // Create a log for March 24
    upsertDailyLog(defaultLog('2026-03-24', db), db);

    // PUT arrives for March 25 with sleep_disruption='kids'
    applySleepDisruption('2026-03-25', 'kids', db);

    const prev = getDailyLog('2026-03-24', db);
    expect(prev).not.toBeNull();
    expect(prev!.sleep_disruption).toBe('kids');
  });

  it('auto-creates previous day log if missing', () => {
    // No log exists for March 24 (better-sqlite3 returns undefined, not null)
    expect(getDailyLog('2026-03-24', db)).toBeFalsy();

    // PUT arrives for March 25 with sleep_disruption='stress'
    applySleepDisruption('2026-03-25', 'stress', db);

    const prev = getDailyLog('2026-03-24', db);
    expect(prev).not.toBeNull();
    expect(prev!.sleep_disruption).toBe('stress');
    // All other fields should be at their default values
    expect(prev!.workout_completed).toBe(0);
    expect(prev!.core_work_done).toBe(0);
    expect(prev!.energy_level).toBeNull();
    expect(prev!.notes).toBeNull();
  });

  it('Monday sleep disruption writes to Sunday (cross-week boundary)', () => {
    // 2026-03-23 is a Monday; previous day is 2026-03-22 (Sunday, different week)
    const monday = '2026-03-23';
    const sunday = '2026-03-22';

    applySleepDisruption(monday, 'pain', db);

    const prev = getDailyLog(sunday, db);
    expect(prev).not.toBeNull();
    expect(prev!.sleep_disruption).toBe('pain');
    expect(prev!.date).toBe(sunday);
  });

  it('does not write sleep_disruption to the current date', () => {
    // PUT arrives for March 25 with sleep_disruption='kids'
    applySleepDisruption('2026-03-25', 'kids', db);

    // March 25 itself should have no record (the handler doesn't write current date here)
    const current = getDailyLog('2026-03-25', db);
    expect(current).toBeFalsy();
  });

  it('preserves existing data on previous day when setting disruption', () => {
    // Create a log for March 24 with energy_level=3, core_work_done=1
    upsertDailyLog(
      { ...defaultLog('2026-03-24', db), energy_level: 3, core_work_done: 1 },
      db,
    );

    // PUT arrives for March 25 with sleep_disruption='stress'
    applySleepDisruption('2026-03-25', 'stress', db);

    const prev = getDailyLog('2026-03-24', db);
    expect(prev).not.toBeNull();
    expect(prev!.sleep_disruption).toBe('stress');
    // Existing fields must be preserved
    expect(prev!.energy_level).toBe(3);
    expect(prev!.core_work_done).toBe(1);
  });

  it('null sleep_disruption clears previous day value', () => {
    // Start with sleep_disruption already set on March 24
    upsertDailyLog(
      { ...defaultLog('2026-03-24', db), sleep_disruption: 'baby at 03:00' },
      db,
    );

    // PUT arrives for March 25 with sleep_disruption=null — should clear it
    applySleepDisruption('2026-03-25', null, db);

    const prev = getDailyLog('2026-03-24', db);
    expect(prev).not.toBeNull();
    expect(prev!.sleep_disruption).toBeNull();
  });

  it('multiple calls overwrite — last write wins', () => {
    applySleepDisruption('2026-03-25', 'baby', db);
    applySleepDisruption('2026-03-25', 'pain', db);

    const prev = getDailyLog('2026-03-24', db);
    expect(prev!.sleep_disruption).toBe('pain');
  });
});

// ---------------------------------------------------------------------------
// getPreviousDate utility
// ---------------------------------------------------------------------------

describe('getPreviousDate utility', () => {
  it('returns the day before a regular weekday', () => {
    expect(getPreviousDate('2026-03-25')).toBe('2026-03-24');
  });

  it('crosses week boundary (Monday -> Sunday)', () => {
    expect(getPreviousDate('2026-03-23')).toBe('2026-03-22');
  });

  it('crosses month boundary (April 1 -> March 31)', () => {
    expect(getPreviousDate('2026-04-01')).toBe('2026-03-31');
  });

  it('crosses year boundary (January 1 -> December 31)', () => {
    expect(getPreviousDate('2026-01-01')).toBe('2025-12-31');
  });
});
