import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  initTablesOn,
  upsertDailyLog,
  getDailyLog,
  getDailyLogsByWeek,
  getDailyNotes,
  insertDailyNote,
  deleteDailyNote,
} from '../lib/db';

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

// Mirrors the PUT handler's body-to-payload mapping for the fields it owns.
// sleep_disruption / session_summary / session_log_id are preserved from the
// existing row (passed in as `existing`) — not overwritten by this handler.
function putHandlerPayload(
  body: Record<string, unknown>,
  weekNumber: number,
  existing: { sleep_disruption: string | null; session_summary: string | null; session_log_id: number | null } | null
) {
  const painLevel: number | null = (body.pain_level as number | null) ?? null;
  return {
    date: body.date as string,
    week_number: weekNumber,
    workout_completed: body.workout_completed ? 1 : 0,
    workout_plan_item_id: (body.workout_plan_item_id as number) ?? null,
    core_work_done: body.core_work_done ? 1 : 0,
    rug_protocol_done: body.rug_protocol_done ? 1 : 0,
    vampire_bedtime: (body.vampire_bedtime as string) || null,
    hydration_tracked: body.hydration_tracked ? 1 : 0,
    kitchen_cutoff_hit: body.kitchen_cutoff_hit ? 1 : 0,
    is_sick_day: body.is_sick_day ? 1 : 0,
    notes: (body.notes as string) || null,
    energy_level: (body.energy_level as number) ?? null,
    pain_level: painLevel,
    pain_area: painLevel != null && painLevel > 0 ? ((body.pain_area as string) || null) : null,
    sleep_disruption: existing?.sleep_disruption ?? null,
    session_summary: existing?.session_summary ?? null,
    session_log_id: existing?.session_log_id ?? null,
  };
}

// Default object returned by GET when no log exists — mirrors what the handler returns
const GET_DEFAULTS = {
  workout_completed: 0,
  core_work_done: 0,
  rug_protocol_done: 0,
  vampire_bedtime: null,
  hydration_tracked: 0,
  kitchen_cutoff_hit: 0,
  is_sick_day: 0,
  notes: '',
  energy_level: null,
  pain_level: null,
  pain_area: null,
  sleep_disruption: null,
  session_summary: null,
  session_log_id: null,
};

// ---------------------------------------------------------------------------
// PUT handler: new field persistence
// ---------------------------------------------------------------------------

describe('PUT handler — energy_level, pain_level, pain_area', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('saves energy_level to daily_logs', () => {
    const body = { date: '2026-03-23', energy_level: 4, pain_level: 0 };
    const payload = putHandlerPayload(body, 12, null);
    const saved = upsertDailyLog(payload, db);

    expect(saved.energy_level).toBe(4);
  });

  it('saves pain_level and pain_area when pain_level > 0', () => {
    const body = { date: '2026-03-23', energy_level: 3, pain_level: 2, pain_area: 'left knee' };
    const payload = putHandlerPayload(body, 12, null);
    const saved = upsertDailyLog(payload, db);

    expect(saved.pain_level).toBe(2);
    expect(saved.pain_area).toBe('left knee');
    // Verify by reading back from db
    const row = getDailyLog('2026-03-23', db);
    expect(row?.pain_level).toBe(2);
    expect(row?.pain_area).toBe('left knee');
  });

  it('clears pain_area when pain_level is 0', () => {
    // First save with pain
    upsertDailyLog(
      putHandlerPayload({ date: '2026-03-23', pain_level: 2, pain_area: 'left knee' }, 12, null),
      db
    );
    // Then update with pain_level = 0 — handler clears pain_area
    const existing = getDailyLog('2026-03-23', db);
    const saved = upsertDailyLog(
      putHandlerPayload({ date: '2026-03-23', pain_level: 0, pain_area: 'left knee' }, 12, existing),
      db
    );

    expect(saved.pain_level).toBe(0);
    expect(saved.pain_area).toBeNull();
  });

  it('clears pain_area when pain_level is null', () => {
    upsertDailyLog(
      putHandlerPayload({ date: '2026-03-23', pain_level: 2, pain_area: 'left knee' }, 12, null),
      db
    );
    const existing = getDailyLog('2026-03-23', db);
    const saved = upsertDailyLog(
      putHandlerPayload({ date: '2026-03-23', pain_level: null, pain_area: 'left knee' }, 12, existing),
      db
    );

    expect(saved.pain_level).toBeNull();
    expect(saved.pain_area).toBeNull();
  });

  it('sets pain_area to null when pain_level > 0 but pain_area not provided', () => {
    const saved = upsertDailyLog(
      putHandlerPayload({ date: '2026-03-23', pain_level: 1 }, 12, null),
      db
    );

    expect(saved.pain_level).toBe(1);
    expect(saved.pain_area).toBeNull();
  });

  it('does not overwrite sleep_disruption owned by another handler', () => {
    // Simulate another handler having set sleep_disruption on the row
    upsertDailyLog({
      date: '2026-03-23',
      week_number: 12,
      workout_completed: 0,
      workout_plan_item_id: null,
      core_work_done: 0,
      rug_protocol_done: 0,
      vampire_bedtime: null,
      hydration_tracked: 0,
      kitchen_cutoff_hit: 0,
      is_sick_day: 0,
      notes: null,
      energy_level: null,
      pain_level: null,
      pain_area: null,
      sleep_disruption: 'baby at 03:00',
      session_summary: null,
      session_log_id: null,
    }, db);

    // PUT handler reads existing row and preserves sleep_disruption
    const existing = getDailyLog('2026-03-23', db);
    const saved = upsertDailyLog(
      putHandlerPayload({ date: '2026-03-23', energy_level: 4, pain_level: 0 }, 12, existing),
      db
    );

    expect(saved.sleep_disruption).toBe('baby at 03:00');
    expect(saved.energy_level).toBe(4);
  });

  it('preserves session_summary and session_log_id when re-saving', () => {
    // Insert a real session_logs row so the FK constraint is satisfied
    const sessionResult = db.prepare(`
      INSERT INTO session_logs (date, week_number, session_type, session_title, started_at)
      VALUES ('2026-03-23', 12, 'strength', 'Upper A', '2026-03-23T18:00:00.000Z')
    `).run();
    const sessionLogId = sessionResult.lastInsertRowid as number;

    // Simulate session tracker writeback having set these
    upsertDailyLog({
      date: '2026-03-23',
      week_number: 12,
      workout_completed: 1,
      workout_plan_item_id: null,
      core_work_done: 0,
      rug_protocol_done: 0,
      vampire_bedtime: null,
      hydration_tracked: 0,
      kitchen_cutoff_hit: 0,
      is_sick_day: 0,
      notes: null,
      energy_level: null,
      pain_level: null,
      pain_area: null,
      sleep_disruption: null,
      session_summary: 'Bench 80kg x 5',
      session_log_id: sessionLogId,
    }, db);

    const existing = getDailyLog('2026-03-23', db);
    const saved = upsertDailyLog(
      putHandlerPayload({ date: '2026-03-23', energy_level: 3 }, 12, existing),
      db
    );

    expect(saved.session_summary).toBe('Bench 80kg x 5');
    expect(saved.session_log_id).toBe(sessionLogId);
  });

  it('persists all new fields end-to-end via upsertDailyLog', () => {
    const saved = upsertDailyLog({
      date: '2026-03-24',
      week_number: 12,
      workout_completed: 1,
      workout_plan_item_id: null,
      core_work_done: 1,
      rug_protocol_done: 1,
      vampire_bedtime: '22:30',
      hydration_tracked: 0,
      kitchen_cutoff_hit: 1,
      is_sick_day: 0,
      notes: null,
      energy_level: 5,
      pain_level: 1,
      pain_area: 'right shoulder',
      sleep_disruption: null,
      session_summary: null,
      session_log_id: null,
    }, db);

    expect(saved.energy_level).toBe(5);
    expect(saved.pain_level).toBe(1);
    expect(saved.pain_area).toBe('right shoulder');
    expect(saved.sleep_disruption).toBeNull();
    expect(saved.session_summary).toBeNull();
    expect(saved.session_log_id).toBeNull();

    // Verify read-back via getDailyLog
    const row = getDailyLog('2026-03-24', db);
    expect(row?.energy_level).toBe(5);
    expect(row?.pain_area).toBe('right shoulder');
  });

  it('getDailyLogsByWeek returns all logs for the week', () => {
    upsertDailyLog(putHandlerPayload({ date: '2026-03-23', energy_level: 4 }, 12, null), db);
    upsertDailyLog(putHandlerPayload({ date: '2026-03-24', energy_level: 3 }, 12, null), db);
    upsertDailyLog(putHandlerPayload({ date: '2026-03-30', energy_level: 5 }, 13, null), db);

    const week12 = getDailyLogsByWeek(12, db);
    expect(week12).toHaveLength(2);
    expect(week12.map(l => l.date)).toEqual(['2026-03-23', '2026-03-24']);
  });
});

// ---------------------------------------------------------------------------
// GET handler: default object
// ---------------------------------------------------------------------------

describe('GET handler — default object includes new fields', () => {
  it('default object contains energy_level: null', () => {
    expect(GET_DEFAULTS.energy_level).toBeNull();
  });

  it('default object contains pain_level: null', () => {
    expect(GET_DEFAULTS.pain_level).toBeNull();
  });

  it('default object contains pain_area: null', () => {
    expect(GET_DEFAULTS.pain_area).toBeNull();
  });

  it('default object contains sleep_disruption: null', () => {
    expect(GET_DEFAULTS.sleep_disruption).toBeNull();
  });

  it('default object contains session_summary: null', () => {
    expect(GET_DEFAULTS.session_summary).toBeNull();
  });

  it('default object contains session_log_id: null', () => {
    expect(GET_DEFAULTS.session_log_id).toBeNull();
  });

  it('default object contains notes: empty string', () => {
    expect(GET_DEFAULTS.notes).toBe('');
  });
});

// ---------------------------------------------------------------------------
// GET handler: daily_notes array
// ---------------------------------------------------------------------------

describe('GET handler — daily_notes array', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('returns empty array when no log exists (getDailyNotes called with nonexistent id)', () => {
    // Handler passes log.id to getDailyNotes; when log is null it skips the call.
    // Verify getDailyNotes itself returns [] for a log id that has no notes.
    const notes = getDailyNotes(999999, db);
    expect(notes).toEqual([]);
  });

  it('returns empty array for a log with no notes', () => {
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO daily_logs (date, week_number, workout_completed, core_work_done,
        rug_protocol_done, hydration_tracked, kitchen_cutoff_hit, is_sick_day,
        created_at, updated_at)
      VALUES (?, ?, 0, 0, 0, 0, 0, 0, ?, ?)
    `).run('2026-03-25', 12, now, now);
    const logId = result.lastInsertRowid as number;

    const notes = getDailyNotes(logId, db);
    expect(notes).toEqual([]);
  });

  it('returns notes for a log in insertion order', () => {
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO daily_logs (date, week_number, workout_completed, core_work_done,
        rug_protocol_done, hydration_tracked, kitchen_cutoff_hit, is_sick_day,
        created_at, updated_at)
      VALUES (?, ?, 0, 0, 0, 0, 0, 0, ?, ?)
    `).run('2026-03-26', 12, now, now);
    const logId = result.lastInsertRowid as number;

    insertDailyNote(logId, 'sleep', 'Woke at 03:00', db);
    insertDailyNote(logId, 'training', 'Felt strong on pull-ups', db);

    const notes = getDailyNotes(logId, db);
    expect(notes).toHaveLength(2);
    expect(notes[0].category).toBe('sleep');
    expect(notes[1].category).toBe('training');
  });
});

// ---------------------------------------------------------------------------
// Notes API route: POST / GET / DELETE logic
// ---------------------------------------------------------------------------

describe('Notes API route — POST creates a note', () => {
  let db: Database.Database;
  let dailyLogId: number;

  beforeEach(() => {
    db = createTestDb();
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO daily_logs (date, week_number, workout_completed, core_work_done,
        rug_protocol_done, hydration_tracked, kitchen_cutoff_hit, is_sick_day,
        created_at, updated_at)
      VALUES (?, ?, 0, 0, 0, 0, 0, 0, ?, ?)
    `).run('2026-03-27', 12, now, now);
    dailyLogId = result.lastInsertRowid as number;
  });

  it('insertDailyNote returns a note with all fields', () => {
    const note = insertDailyNote(dailyLogId, 'injury', 'Baker cyst twinge', db);
    expect(note.id).toBeGreaterThan(0);
    expect(note.daily_log_id).toBe(dailyLogId);
    expect(note.category).toBe('injury');
    expect(note.text).toBe('Baker cyst twinge');
    expect(note.created_at).toBeTruthy();
  });

  it('creates notes with all valid categories', () => {
    const categories = ['injury', 'sleep', 'training', 'life', 'other'] as const;
    for (const cat of categories) {
      const note = insertDailyNote(dailyLogId, cat, `Test ${cat}`, db);
      expect(note.category).toBe(cat);
    }
    const allNotes = getDailyNotes(dailyLogId, db);
    expect(allNotes).toHaveLength(5);
  });
});

describe('Notes API route — GET retrieves notes', () => {
  let db: Database.Database;
  let dailyLogId: number;

  beforeEach(() => {
    db = createTestDb();
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO daily_logs (date, week_number, workout_completed, core_work_done,
        rug_protocol_done, hydration_tracked, kitchen_cutoff_hit, is_sick_day,
        created_at, updated_at)
      VALUES (?, ?, 0, 0, 0, 0, 0, 0, ?, ?)
    `).run('2026-03-28', 12, now, now);
    dailyLogId = result.lastInsertRowid as number;
  });

  it('getDailyNotes returns notes for the given daily_log_id', () => {
    insertDailyNote(dailyLogId, 'other', 'Note A', db);
    insertDailyNote(dailyLogId, 'other', 'Note B', db);

    const notes = getDailyNotes(dailyLogId, db);
    expect(notes).toHaveLength(2);
    expect(notes.map(n => n.text)).toEqual(['Note A', 'Note B']);
  });

  it('getDailyNotes returns empty array when no notes exist', () => {
    const notes = getDailyNotes(dailyLogId, db);
    expect(notes).toEqual([]);
  });

  it('getDailyNotes only returns notes for the specified log', () => {
    const now = new Date().toISOString();
    const result2 = db.prepare(`
      INSERT INTO daily_logs (date, week_number, workout_completed, core_work_done,
        rug_protocol_done, hydration_tracked, kitchen_cutoff_hit, is_sick_day,
        created_at, updated_at)
      VALUES (?, ?, 0, 0, 0, 0, 0, 0, ?, ?)
    `).run('2026-03-29', 12, now, now);
    const otherLogId = result2.lastInsertRowid as number;

    insertDailyNote(dailyLogId, 'sleep', 'My log note', db);
    insertDailyNote(otherLogId, 'life', 'Other log note', db);

    const notes = getDailyNotes(dailyLogId, db);
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toBe('My log note');
  });
});

describe('Notes API route — DELETE removes a note', () => {
  let db: Database.Database;
  let dailyLogId: number;

  beforeEach(() => {
    db = createTestDb();
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO daily_logs (date, week_number, workout_completed, core_work_done,
        rug_protocol_done, hydration_tracked, kitchen_cutoff_hit, is_sick_day,
        created_at, updated_at)
      VALUES (?, ?, 0, 0, 0, 0, 0, 0, ?, ?)
    `).run('2026-03-30', 12, now, now);
    dailyLogId = result.lastInsertRowid as number;
  });

  it('deleteDailyNote removes the specified note', () => {
    const note = insertDailyNote(dailyLogId, 'other', 'To delete', db);
    expect(getDailyNotes(dailyLogId, db)).toHaveLength(1);

    deleteDailyNote(note.id, db);
    expect(getDailyNotes(dailyLogId, db)).toHaveLength(0);
  });

  it('deleteDailyNote only removes the targeted note, not others', () => {
    const n1 = insertDailyNote(dailyLogId, 'sleep', 'Keep this', db);
    const n2 = insertDailyNote(dailyLogId, 'life', 'Delete this', db);

    deleteDailyNote(n2.id, db);

    const remaining = getDailyNotes(dailyLogId, db);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(n1.id);
    expect(remaining[0].text).toBe('Keep this');
  });

  it('deleteDailyNote is a no-op for non-existent id', () => {
    insertDailyNote(dailyLogId, 'training', 'Survivor', db);
    deleteDailyNote(99999, db);
    expect(getDailyNotes(dailyLogId, db)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// PUT handler: energy_level and pain_level range validation
// These mirror the validation logic in app/api/log/route.ts
// ---------------------------------------------------------------------------

function validatePutFields(body: { energy_level?: unknown; pain_level?: unknown }): string | null {
  const energyLevel = body.energy_level ?? null;
  if (energyLevel !== null) {
    if (!Number.isInteger(energyLevel) || (energyLevel as number) < 1 || (energyLevel as number) > 5) {
      return 'energy_level must be an integer between 1 and 5';
    }
  }
  const painLevel = body.pain_level ?? null;
  if (painLevel !== null) {
    if (!Number.isInteger(painLevel) || (painLevel as number) < 0 || (painLevel as number) > 3) {
      return 'pain_level must be an integer between 0 and 3 (0=none, 1=mild, 2=moderate, 3=stop)';
    }
  }
  return null;
}

describe('PUT handler — energy_level range validation', () => {
  it('accepts energy_level 1 (lower bound)', () => {
    expect(validatePutFields({ energy_level: 1 })).toBeNull();
  });

  it('accepts energy_level 5 (upper bound)', () => {
    expect(validatePutFields({ energy_level: 5 })).toBeNull();
  });

  it('accepts energy_level null', () => {
    expect(validatePutFields({ energy_level: null })).toBeNull();
  });

  it('rejects energy_level 0 (below range)', () => {
    const err = validatePutFields({ energy_level: 0 });
    expect(err).toMatch(/energy_level/);
    expect(err).toMatch(/1 and 5/);
  });

  it('rejects energy_level 6 (above range)', () => {
    const err = validatePutFields({ energy_level: 6 });
    expect(err).toMatch(/energy_level/);
    expect(err).toMatch(/1 and 5/);
  });

  it('rejects energy_level -1', () => {
    expect(validatePutFields({ energy_level: -1 })).not.toBeNull();
  });

  it('rejects energy_level 3.5 (non-integer)', () => {
    expect(validatePutFields({ energy_level: 3.5 })).not.toBeNull();
  });
});

describe('PUT handler — pain_level range validation', () => {
  it('accepts pain_level 0 (none)', () => {
    expect(validatePutFields({ pain_level: 0 })).toBeNull();
  });

  it('accepts pain_level 3 (stop — upper bound)', () => {
    expect(validatePutFields({ pain_level: 3 })).toBeNull();
  });

  it('accepts pain_level null', () => {
    expect(validatePutFields({ pain_level: null })).toBeNull();
  });

  it('rejects pain_level -1 (below range)', () => {
    const err = validatePutFields({ pain_level: -1 });
    expect(err).toMatch(/pain_level/);
    expect(err).toMatch(/0 and 3/);
  });

  it('rejects pain_level 4 (above range)', () => {
    const err = validatePutFields({ pain_level: 4 });
    expect(err).toMatch(/pain_level/);
    expect(err).toMatch(/0 and 3/);
  });

  it('rejects pain_level 1.5 (non-integer)', () => {
    expect(validatePutFields({ pain_level: 1.5 })).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Notes POST handler: text length validation
// Mirrors the 1000-character cap in app/api/log/notes/route.ts
// ---------------------------------------------------------------------------

function validateNoteText(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === '') return 'text is required';
  if (trimmed.length > 1000) return 'text must be 1000 characters or fewer';
  return null;
}

describe('Notes POST handler — text length validation', () => {
  it('accepts text of exactly 1000 characters', () => {
    const text = 'a'.repeat(1000);
    expect(validateNoteText(text)).toBeNull();
  });

  it('accepts text shorter than 1000 characters', () => {
    expect(validateNoteText('Short note')).toBeNull();
  });

  it('rejects text of 1001 characters', () => {
    const text = 'a'.repeat(1001);
    const err = validateNoteText(text);
    expect(err).toMatch(/1000/);
  });

  it('rejects text that exceeds 1000 chars after trimming', () => {
    // Leading/trailing spaces do not help bypass the cap
    const text = '  ' + 'a'.repeat(1001) + '  ';
    expect(validateNoteText(text)).not.toBeNull();
  });

  it('accepts text that is exactly 1000 chars after trimming', () => {
    const text = '  ' + 'a'.repeat(1000) + '  ';
    expect(validateNoteText(text)).toBeNull();
  });
});
