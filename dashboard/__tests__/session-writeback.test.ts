import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initTablesOn, getDailyLog } from '../lib/db';
import {
  createSession,
  completeSession,
  updateSet,
  updateCardioRound,
  getSessionSets,
  generateSessionSummary,
} from '../lib/session-db';
import type { ParsedExercise } from '../lib/types';

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

const strengthExercises: ParsedExercise[] = [
  {
    name: 'Bench Press', canonicalName: 'Bench Press', type: 'strength',
    order: 0, supersetGroup: null, sets: 3, reps: 8, weightKg: 80,
    durationSeconds: null, restSeconds: null, rounds: null,
    targetIntensity: null, coachCue: null,
  },
  {
    name: 'Incline DB Press', canonicalName: 'Incline DB Press', type: 'strength',
    order: 1, supersetGroup: null, sets: 3, reps: 10, weightKg: 20,
    durationSeconds: null, restSeconds: null, rounds: null,
    targetIntensity: null, coachCue: null,
  },
];

const cardioExercise: ParsedExercise = {
  name: 'StairMaster', canonicalName: 'StairMaster', type: 'cardio_intervals',
  order: 2, supersetGroup: null, sets: 0, reps: 0, weightKg: null,
  durationSeconds: null, restSeconds: null, rounds: 4,
  targetIntensity: 'level 8', coachCue: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('session writeback to daily log', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('writes session_summary text to daily_logs on complete', () => {
    // Pre-create a daily_log for the date
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO daily_logs (date, week_number, workout_completed, core_work_done,
        rug_protocol_done, hydration_tracked, kitchen_cutoff_hit, is_sick_day,
        created_at, updated_at)
      VALUES ('2026-03-24', 12, 0, 0, 0, 0, 0, 0, ?, ?)
    `).run(now, now);

    const sessionId = createSession('2026-03-24', 'strength', 'Upper Push', strengthExercises, db);
    const sets = getSessionSets(sessionId, db);

    // Complete all sets
    for (const s of sets) {
      updateSet(s.id!, s.prescribedWeightKg, s.prescribedReps, true, db);
    }

    completeSession(sessionId, 'Felt strong', db);

    const log = getDailyLog('2026-03-24', db);
    expect(log).not.toBeNull();
    expect(log!.session_summary).not.toBeNull();
    expect(log!.session_summary).toContain('Upper Push');
    expect(log!.session_summary).toContain('100% compliance');
  });

  it('sets session_log_id on daily_logs', () => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO daily_logs (date, week_number, workout_completed, core_work_done,
        rug_protocol_done, hydration_tracked, kitchen_cutoff_hit, is_sick_day,
        created_at, updated_at)
      VALUES ('2026-03-25', 12, 0, 0, 0, 0, 0, 0, ?, ?)
    `).run(now, now);

    const sessionId = createSession('2026-03-25', 'strength', 'Lower A', strengthExercises, db);
    completeSession(sessionId, '', db);

    const log = getDailyLog('2026-03-25', db);
    expect(log!.session_log_id).toBe(sessionId);
  });

  it('generates readable summary text', () => {
    const sessionId = createSession('2026-03-26', 'strength', 'Upper Push', strengthExercises, db);
    const sets = getSessionSets(sessionId, db);

    // Complete all Bench Press sets at prescribed weight
    for (const s of sets.filter(s => s.exerciseName === 'Bench Press')) {
      updateSet(s.id!, s.prescribedWeightKg, s.prescribedReps, true, db);
    }
    // Complete Incline DB Press sets with a weight increase (20 -> 22.5)
    for (const s of sets.filter(s => s.exerciseName === 'Incline DB Press')) {
      updateSet(s.id!, 22.5, s.prescribedReps, true, db);
    }

    const result = completeSession(sessionId, '', db);

    const log = getDailyLog('2026-03-26', db);
    const summary = log!.session_summary!;

    // Should contain title + compliance
    expect(summary).toContain('Upper Push');
    expect(summary).toContain('100% compliance');

    // Bench Press: all sets at 80kg, no weight change note
    expect(summary).toContain('Bench Press: 3x8 @ 80kg ✓');

    // Incline DB Press: bumped to 22.5kg, should note prescribed
    expect(summary).toContain('Incline DB Press');
    expect(summary).toContain('22.5kg');
    expect(summary).toContain('prescribed 20kg');

    // Weight changes line
    expect(summary).toContain('Weight changes:');
    expect(summary).toContain('Incline DB Press');

    expect(result.compliancePct).toBe(100);
  });

  it('auto-creates daily_log if none exists for session date', () => {
    // No pre-existing daily_log for this date
    const existing = getDailyLog('2026-04-01', db);
    expect(existing).toBeFalsy();

    const sessionId = createSession('2026-04-01', 'strength', 'Full Body', strengthExercises, db);
    completeSession(sessionId, '', db);

    const log = getDailyLog('2026-04-01', db);
    expect(log).not.toBeNull();
    expect(log!.workout_completed).toBe(1);
    expect(log!.session_log_id).toBe(sessionId);
    expect(log!.session_summary).not.toBeNull();
    expect(log!.session_summary).toContain('Full Body');
  });

  it('handles two sessions on same day — second overwrites', () => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO daily_logs (date, week_number, workout_completed, core_work_done,
        rug_protocol_done, hydration_tracked, kitchen_cutoff_hit, is_sick_day,
        created_at, updated_at)
      VALUES ('2026-04-02', 12, 0, 0, 0, 0, 0, 0, ?, ?)
    `).run(now, now);

    // First session
    const session1 = createSession('2026-04-02', 'strength', 'Morning Session', strengthExercises, db);
    completeSession(session1, 'First session', db);

    const afterFirst = getDailyLog('2026-04-02', db);
    expect(afterFirst!.session_log_id).toBe(session1);
    expect(afterFirst!.session_summary).toContain('Morning Session');

    // Second session same day — different title required due to UNIQUE(date, session_title)
    const session2 = createSession('2026-04-02', 'cardio', 'Evening Cardio', [cardioExercise], db);

    // Complete the cardio round
    const rows = db.prepare('SELECT id FROM session_cardio WHERE session_log_id = ?').all(session2) as { id: number }[];
    for (const r of rows) {
      updateCardioRound(r.id, 4, true, db);
    }

    completeSession(session2, 'Evening session', db);

    const afterSecond = getDailyLog('2026-04-02', db);
    // Second session's data overwrites
    expect(afterSecond!.session_log_id).toBe(session2);
    expect(afterSecond!.session_summary).toContain('Evening Cardio');
    expect(afterSecond!.workout_completed).toBe(1);
  });
});

describe('generateSessionSummary', () => {
  it('formats a simple strength session with all sets complete', () => {
    const sets = [
      { id: 1, sessionLogId: 1, exerciseName: 'Pull-Up', exerciseOrder: 0, supersetGroup: null,
        setNumber: 1, prescribedReps: 5, prescribedWeightKg: null,
        actualReps: 5, actualWeightKg: null, completed: true, isModified: false },
      { id: 2, sessionLogId: 1, exerciseName: 'Pull-Up', exerciseOrder: 0, supersetGroup: null,
        setNumber: 2, prescribedReps: 5, prescribedWeightKg: null,
        actualReps: 5, actualWeightKg: null, completed: true, isModified: false },
      { id: 3, sessionLogId: 1, exerciseName: 'Pull-Up', exerciseOrder: 0, supersetGroup: null,
        setNumber: 3, prescribedReps: 5, prescribedWeightKg: null,
        actualReps: 5, actualWeightKg: null, completed: true, isModified: false },
    ];

    const summary = generateSessionSummary('Pull Day', 100, sets, [], []);
    expect(summary).toContain('Pull Day (100% compliance)');
    expect(summary).toContain('Pull-Up: 3x5 ✓');
  });

  it('shows partial completion for incomplete sets', () => {
    const sets = [
      { id: 1, sessionLogId: 1, exerciseName: 'Cable Fly', exerciseOrder: 0, supersetGroup: null,
        setNumber: 1, prescribedReps: 12, prescribedWeightKg: 15,
        actualReps: 12, actualWeightKg: 15, completed: true, isModified: false },
      { id: 2, sessionLogId: 1, exerciseName: 'Cable Fly', exerciseOrder: 0, supersetGroup: null,
        setNumber: 2, prescribedReps: 12, prescribedWeightKg: 15,
        actualReps: 12, actualWeightKg: 15, completed: true, isModified: false },
      { id: 3, sessionLogId: 1, exerciseName: 'Cable Fly', exerciseOrder: 0, supersetGroup: null,
        setNumber: 3, prescribedReps: 12, prescribedWeightKg: 15,
        actualReps: null, actualWeightKg: null, completed: false, isModified: false },
    ];

    const summary = generateSessionSummary('Upper Push', 67, sets, [], []);
    expect(summary).toContain('Cable Fly: 2/3 sets done');
  });

  it('shows cardio rounds done vs prescribed', () => {
    const cardio = [
      { id: 1, sessionLogId: 1, exerciseName: 'StairMaster', cardioType: 'intervals' as const,
        prescribedRounds: 4, completedRounds: 3, prescribedDurationMin: null,
        targetIntensity: 'level 8', completed: false },
    ];

    const summary = generateSessionSummary('Cardio Day', 75, [], cardio, []);
    expect(summary).toContain('StairMaster: 3/4 rounds done');
  });

  it('includes weight changes section', () => {
    const sets = [
      { id: 1, sessionLogId: 1, exerciseName: 'Incline DB Press', exerciseOrder: 0, supersetGroup: null,
        setNumber: 1, prescribedReps: 10, prescribedWeightKg: 20,
        actualReps: 10, actualWeightKg: 22.5, completed: true, isModified: true },
    ];
    const weightChanges = [{ exercise: 'Incline DB Press', set: 1, from: 20, to: 22.5 }];

    const summary = generateSessionSummary('Upper Push', 100, sets, [], weightChanges);
    expect(summary).toContain('Weight changes:');
    expect(summary).toContain('Incline DB Press +2.5kg');
  });
});
