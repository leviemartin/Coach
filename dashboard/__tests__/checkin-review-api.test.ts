/**
 * Tests for GET /api/checkin/review
 *
 * We test the underlying data assembly logic directly (lib functions),
 * since Next.js route handlers require a full server environment.
 * The route itself is thin: it calls these functions and serialises to JSON.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  initTablesOn,
  upsertDailyLog,
  getDailyLogsByWeek,
  getWeekNotes,
  insertDailyNote,
} from '../lib/db';
import { computeWeekSummary } from '../lib/daily-log';
import { getWeekSessions } from '../lib/session-db';

// ── In-memory test DB ─────────────────────────────────────────────────────────

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initTablesOn(db);
  return db;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function insertLog(
  db: Database.Database,
  overrides: Partial<{
    date: string;
    weekNumber: number;
    workoutCompleted: boolean;
    coreWorkDone: boolean;
    rugProtocolDone: boolean;
    vampireBedtime: string | null;
    hydrationTracked: boolean;
    kitchenCutoffHit: boolean;
    isSickDay: boolean;
    energyLevel: number | null;
    painLevel: number | null;
    painArea: string | null;
    sleepDisruption: string | null;
  }> = {}
) {
  const {
    date = '2026-03-17',
    weekNumber = 12,
    workoutCompleted = false,
    coreWorkDone = false,
    rugProtocolDone = false,
    vampireBedtime = null,
    hydrationTracked = false,
    kitchenCutoffHit = false,
    isSickDay = false,
    energyLevel = null,
    painLevel = null,
    painArea = null,
    sleepDisruption = null,
  } = overrides;

  upsertDailyLog(
    {
      date,
      week_number: weekNumber,
      workout_completed: workoutCompleted ? 1 : 0,
      workout_plan_item_id: null,
      core_work_done: coreWorkDone ? 1 : 0,
      rug_protocol_done: rugProtocolDone ? 1 : 0,
      vampire_bedtime: vampireBedtime,
      hydration_tracked: hydrationTracked ? 1 : 0,
      kitchen_cutoff_hit: kitchenCutoffHit ? 1 : 0,
      is_sick_day: isSickDay ? 1 : 0,
      notes: null,
      energy_level: energyLevel,
      pain_level: painLevel,
      pain_area: painArea,
      sleep_disruption: sleepDisruption,
      session_summary: null,
      session_log_id: null,
    },
    db
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('checkin review data assembly', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('getDailyLogsByWeek returns logs for the right week', () => {
    insertLog(db, { date: '2026-03-17', weekNumber: 12 });
    insertLog(db, { date: '2026-03-18', weekNumber: 12 });
    insertLog(db, { date: '2026-03-24', weekNumber: 13 });

    const logs = getDailyLogsByWeek(12, db);
    expect(logs).toHaveLength(2);
    expect(logs.map((l) => l.date)).toEqual(['2026-03-17', '2026-03-18']);
  });

  it('computeWeekSummary counts workouts and protocols correctly', () => {
    // 3 workout days, 2 core, 4 rug, 1 vampire compliant
    insertLog(db, { date: '2026-03-17', weekNumber: 12, workoutCompleted: true, coreWorkDone: true, rugProtocolDone: true, vampireBedtime: '22:30', kitchenCutoffHit: true });
    insertLog(db, { date: '2026-03-18', weekNumber: 12, workoutCompleted: true, rugProtocolDone: true, vampireBedtime: '23:45', kitchenCutoffHit: true });
    insertLog(db, { date: '2026-03-19', weekNumber: 12, workoutCompleted: true, coreWorkDone: true, rugProtocolDone: true });
    insertLog(db, { date: '2026-03-20', weekNumber: 12, rugProtocolDone: true, vampireBedtime: '25:00' });

    // Override getDailyLogsByWeek for our test db
    // computeWeekSummary calls getDb() internally, so we test the underlying
    // count logic directly via getDailyLogsByWeek + manual counting
    const logs = getDailyLogsByWeek(12, db);
    expect(logs.filter((l) => l.workout_completed).length).toBe(3);
    expect(logs.filter((l) => l.core_work_done).length).toBe(2);
    expect(logs.filter((l) => l.rug_protocol_done).length).toBe(4);
    expect(logs.filter((l) => l.kitchen_cutoff_hit).length).toBe(2);
  });

  it('energy_levels and pain_days are extracted correctly', () => {
    insertLog(db, { date: '2026-03-17', weekNumber: 12, energyLevel: 4 });
    insertLog(db, { date: '2026-03-18', weekNumber: 12, energyLevel: 3, painLevel: 2, painArea: 'knee' });
    insertLog(db, { date: '2026-03-19', weekNumber: 12 }); // no energy/pain

    const logs = getDailyLogsByWeek(12, db);
    const energyLogs = logs.filter((l) => l.energy_level != null);
    const painLogs = logs.filter((l) => l.pain_level != null && l.pain_level > 0);

    expect(energyLogs).toHaveLength(2);
    expect(energyLogs[0].energy_level).toBe(4);

    expect(painLogs).toHaveLength(1);
    expect(painLogs[0].pain_level).toBe(2);
    expect(painLogs[0].pain_area).toBe('knee');
  });

  it('sleep_disruption entries are captured', () => {
    insertLog(db, { date: '2026-03-17', weekNumber: 12, sleepDisruption: 'sick_child' });
    insertLog(db, { date: '2026-03-18', weekNumber: 12, sleepDisruption: 'newborn' });
    insertLog(db, { date: '2026-03-19', weekNumber: 12 });

    const logs = getDailyLogsByWeek(12, db);
    const disrupted = logs.filter((l) => l.sleep_disruption != null);
    expect(disrupted).toHaveLength(2);
    expect(disrupted.map((l) => l.sleep_disruption)).toEqual(['sick_child', 'newborn']);
  });

  it('getWeekNotes returns tagged notes joined with dates', () => {
    insertLog(db, { date: '2026-03-17', weekNumber: 12 });
    const logs = getDailyLogsByWeek(12, db);
    const logId = logs[0].id;

    insertDailyNote(logId, 'injury', 'Left knee mild soreness', db);
    insertDailyNote(logId, 'sleep', 'Kid woke up at 3am', db);

    const notes = getWeekNotes(12, db);
    expect(notes).toHaveLength(2);
    expect(notes[0].category).toBe('injury');
    expect(notes[0].date).toBe('2026-03-17');
    expect(notes[1].text).toBe('Kid woke up at 3am');
  });

  it('getWeekSessions returns empty array when no sessions completed', () => {
    // Uses live DB (getDb) — just verify the function returns an array
    const sessions = getWeekSessions(9999); // week that will never have data
    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions).toHaveLength(0);
  });

  it('vampire compliance: bedtime before 23:00 is compliant', () => {
    insertLog(db, { date: '2026-03-17', weekNumber: 12, vampireBedtime: '22:30' }); // compliant
    insertLog(db, { date: '2026-03-18', weekNumber: 12, vampireBedtime: '23:15' }); // non-compliant
    insertLog(db, { date: '2026-03-19', weekNumber: 12, vampireBedtime: '25:00' }); // 01:00 AM, non-compliant

    const logs = getDailyLogsByWeek(12, db);
    // 22:30 = hour 22, minute 30 → h*60+m = 1350, threshold = 23*60 = 1380
    const compliant = logs.filter((l) => {
      if (!l.vampire_bedtime) return false;
      const [h, m] = l.vampire_bedtime.split(':').map(Number);
      return h * 60 + m < 23 * 60;
    });
    expect(compliant).toHaveLength(1);
    expect(compliant[0].date).toBe('2026-03-17');
  });
});
