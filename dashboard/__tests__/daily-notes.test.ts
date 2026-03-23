import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initTablesOn, insertDailyNote, getDailyNotes, getWeekNotes, deleteDailyNote } from '../lib/db';

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initTablesOn(db);
  return db;
}

function insertTestDailyLog(db: Database.Database, date: string, weekNumber: number, notes: string | null = null): number {
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO daily_logs (
      date, week_number, workout_completed, core_work_done, rug_protocol_done,
      hydration_tracked, kitchen_cutoff_hit, is_sick_day, notes, created_at, updated_at
    ) VALUES (?, ?, 0, 0, 0, 0, 0, 0, ?, ?, ?)
  `).run(date, weekNumber, notes, now, now);
  return result.lastInsertRowid as number;
}

describe('daily_notes schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('table exists with expected columns', () => {
    const columns = db.pragma('table_info(daily_notes)') as { name: string }[];
    const names = columns.map(c => c.name);
    expect(names).toContain('id');
    expect(names).toContain('daily_log_id');
    expect(names).toContain('category');
    expect(names).toContain('text');
    expect(names).toContain('created_at');
  });

  it('has index on daily_log_id', () => {
    const indexes = db.pragma('index_list(daily_notes)') as { name: string }[];
    expect(indexes.some(i => i.name === 'idx_daily_notes_log')).toBe(true);
  });

  it('has index on category', () => {
    const indexes = db.pragma('index_list(daily_notes)') as { name: string }[];
    expect(indexes.some(i => i.name === 'idx_daily_notes_category')).toBe(true);
  });
});

describe('daily_notes CRUD', () => {
  let db: Database.Database;
  let dailyLogId: number;

  beforeEach(() => {
    db = createTestDb();
    dailyLogId = insertTestDailyLog(db, '2026-03-23', 12);
  });

  it('inserts a note and retrieves it by daily_log_id', () => {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO daily_notes (daily_log_id, category, text, created_at) VALUES (?, ?, ?, ?)"
    ).run(dailyLogId, 'sleep', 'Baby woke me at 03:00', now);

    const notes = db.prepare('SELECT * FROM daily_notes WHERE daily_log_id = ?').all(dailyLogId) as { category: string; text: string }[];
    expect(notes).toHaveLength(1);
    expect(notes[0].category).toBe('sleep');
    expect(notes[0].text).toBe('Baby woke me at 03:00');
  });

  it('inserts multiple notes with different categories', () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO daily_notes (daily_log_id, category, text, created_at) VALUES (?, ?, ?, ?)")
      .run(dailyLogId, 'injury', 'Left knee twinge on squats', now);
    db.prepare("INSERT INTO daily_notes (daily_log_id, category, text, created_at) VALUES (?, ?, ?, ?)")
      .run(dailyLogId, 'training', 'Hit 5 pull-ups for first time', now);
    db.prepare("INSERT INTO daily_notes (daily_log_id, category, text, created_at) VALUES (?, ?, ?, ?)")
      .run(dailyLogId, 'life', 'Kids sick, energy low', now);

    const notes = db.prepare('SELECT * FROM daily_notes WHERE daily_log_id = ?').all(dailyLogId) as { category: string }[];
    expect(notes).toHaveLength(3);
    const categories = notes.map(n => n.category);
    expect(categories).toContain('injury');
    expect(categories).toContain('training');
    expect(categories).toContain('life');
  });

  it('retrieves notes for a specific week via JOIN', () => {
    const now = new Date().toISOString();
    // Second log in the same week
    const dailyLogId2 = insertTestDailyLog(db, '2026-03-24', 12);
    // Log in a different week
    const otherWeekLogId = insertTestDailyLog(db, '2026-03-30', 13);

    db.prepare("INSERT INTO daily_notes (daily_log_id, category, text, created_at) VALUES (?, ?, ?, ?)")
      .run(dailyLogId, 'sleep', 'Note for week 12 day 1', now);
    db.prepare("INSERT INTO daily_notes (daily_log_id, category, text, created_at) VALUES (?, ?, ?, ?)")
      .run(dailyLogId2, 'training', 'Note for week 12 day 2', now);
    db.prepare("INSERT INTO daily_notes (daily_log_id, category, text, created_at) VALUES (?, ?, ?, ?)")
      .run(otherWeekLogId, 'other', 'Note for week 13', now);

    const weekNotes = db.prepare(`
      SELECT dn.*, dl.date
      FROM daily_notes dn
      JOIN daily_logs dl ON dn.daily_log_id = dl.id
      WHERE dl.week_number = ?
      ORDER BY dl.date ASC, dn.created_at ASC
    `).all(12) as { text: string; date: string }[];

    expect(weekNotes).toHaveLength(2);
    expect(weekNotes[0].date).toBe('2026-03-23');
    expect(weekNotes[1].date).toBe('2026-03-24');
    expect(weekNotes.map(n => n.text)).not.toContain('Note for week 13');
  });

  it('deletes a note by id', () => {
    const now = new Date().toISOString();
    const result = db.prepare(
      "INSERT INTO daily_notes (daily_log_id, category, text, created_at) VALUES (?, ?, ?, ?)"
    ).run(dailyLogId, 'other', 'To be deleted', now);
    const id = result.lastInsertRowid as number;

    db.prepare('DELETE FROM daily_notes WHERE id = ?').run(id);

    const notes = db.prepare('SELECT * FROM daily_notes WHERE id = ?').all(id);
    expect(notes).toHaveLength(0);
  });

  it('rejects invalid category via CHECK constraint', () => {
    const now = new Date().toISOString();
    expect(() => {
      db.prepare(
        "INSERT INTO daily_notes (daily_log_id, category, text, created_at) VALUES (?, ?, ?, ?)"
      ).run(dailyLogId, 'invalid_category', 'Some text', now);
    }).toThrow();
  });

  it('enforces foreign key constraint — rejects non-existent daily_log_id', () => {
    const now = new Date().toISOString();
    expect(() => {
      db.prepare(
        "INSERT INTO daily_notes (daily_log_id, category, text, created_at) VALUES (?, ?, ?, ?)"
      ).run(99999, 'other', 'Orphan note', now);
    }).toThrow();
  });
});

describe('notes_migration_v1', () => {
  it('moves existing non-null daily_logs.notes into daily_notes on initTablesOn', () => {
    // Create a DB, insert daily_logs rows with notes BEFORE init (simulate pre-migration state)
    const db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Bootstrap just the tables we need, without running our migration
    db.exec(`
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE plan_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_number INTEGER NOT NULL, day_order INTEGER NOT NULL,
        day TEXT NOT NULL, session_type TEXT NOT NULL, focus TEXT,
        starting_weight TEXT, workout_plan TEXT, coach_cues TEXT,
        athlete_notes TEXT DEFAULT '', completed INTEGER DEFAULT 0,
        completed_at TEXT, sub_tasks TEXT DEFAULT '[]'
      );
      CREATE TABLE session_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL, week_number INTEGER NOT NULL,
        session_type TEXT NOT NULL, session_title TEXT NOT NULL,
        started_at TEXT NOT NULL, completed_at TEXT, notes TEXT,
        compliance_pct INTEGER, UNIQUE(date, session_title)
      );
      CREATE TABLE daily_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        week_number INTEGER NOT NULL,
        workout_completed INTEGER DEFAULT 0,
        workout_plan_item_id INTEGER,
        core_work_done INTEGER DEFAULT 0,
        rug_protocol_done INTEGER DEFAULT 0,
        vampire_bedtime TEXT,
        hydration_tracked INTEGER DEFAULT 0,
        kitchen_cutoff_hit INTEGER DEFAULT 0,
        is_sick_day INTEGER DEFAULT 0,
        notes TEXT,
        energy_level INTEGER,
        pain_level INTEGER,
        pain_area TEXT,
        sleep_disruption TEXT,
        session_summary TEXT,
        session_log_id INTEGER REFERENCES session_logs(id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workout_plan_item_id) REFERENCES plan_items(id)
      );
    `);

    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO daily_logs (date, week_number, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).run('2026-03-01', 10, 'Original note text', now, now);
    db.prepare(
      "INSERT INTO daily_logs (date, week_number, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).run('2026-03-02', 10, null, now, now); // null note — should NOT be migrated

    // Now run initTablesOn — this should create daily_notes and run the migration
    initTablesOn(db);

    const migrated = db.prepare('SELECT * FROM daily_notes').all() as { category: string; text: string; daily_log_id: number }[];
    expect(migrated).toHaveLength(1);
    expect(migrated[0].category).toBe('other');
    expect(migrated[0].text).toBe('Original note text');

    // Migration key should be recorded in settings
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'notes_migration_v1'").get();
    expect(setting).not.toBeNull();
  });

  it('does not re-run migration if already applied', () => {
    const db = createTestDb();
    const logId = insertTestDailyLog(db, '2026-03-10', 11, 'Some note');

    // Manually mark migration as already done
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('notes_migration_v1', ?)")
      .run(new Date().toISOString());

    // Add a NEW note to daily_logs after migration supposedly ran
    db.prepare("UPDATE daily_logs SET notes = 'New note added after migration' WHERE id = ?").run(logId);

    // Re-run initTablesOn — should NOT migrate again
    initTablesOn(db);

    const notesCount = (db.prepare('SELECT COUNT(*) as cnt FROM daily_notes').get() as { cnt: number }).cnt;
    // Should be 0: the pre-existing note was already migrated, the new one should not be re-migrated
    expect(notesCount).toBe(0);
  });
});

describe('daily_notes CRUD functions', () => {
  let db: Database.Database;
  let dailyLogId: number;

  beforeEach(() => {
    db = createTestDb();
    dailyLogId = insertTestDailyLog(db, '2026-03-23', 12);
  });

  it('insertDailyNote creates and returns note', () => {
    const note = insertDailyNote(dailyLogId, 'training', 'Hit 5 pull-ups', db);
    expect(note.id).toBeGreaterThan(0);
    expect(note.daily_log_id).toBe(dailyLogId);
    expect(note.category).toBe('training');
    expect(note.text).toBe('Hit 5 pull-ups');
    expect(note.created_at).toBeTruthy();
  });

  it('getDailyNotes retrieves notes for a log in order', () => {
    insertDailyNote(dailyLogId, 'sleep', 'First note', db);
    insertDailyNote(dailyLogId, 'injury', 'Second note', db);

    const notes = getDailyNotes(dailyLogId, db);
    expect(notes).toHaveLength(2);
    expect(notes[0].category).toBe('sleep');
    expect(notes[0].text).toBe('First note');
    expect(notes[1].category).toBe('injury');
    expect(notes[1].text).toBe('Second note');
  });

  it('getDailyNotes returns empty array for log with no notes', () => {
    const notes = getDailyNotes(dailyLogId, db);
    expect(notes).toHaveLength(0);
  });

  it('getWeekNotes retrieves notes with date across multiple logs', () => {
    const dailyLogId2 = insertTestDailyLog(db, '2026-03-24', 12);
    const otherWeekLogId = insertTestDailyLog(db, '2026-03-30', 13);

    insertDailyNote(dailyLogId, 'sleep', 'Week 12 day 1 note', db);
    insertDailyNote(dailyLogId2, 'training', 'Week 12 day 2 note', db);
    insertDailyNote(otherWeekLogId, 'other', 'Week 13 note', db);

    const weekNotes = getWeekNotes(12, db);
    expect(weekNotes).toHaveLength(2);
    expect(weekNotes[0].date).toBe('2026-03-23');
    expect(weekNotes[0].text).toBe('Week 12 day 1 note');
    expect(weekNotes[1].date).toBe('2026-03-24');
    expect(weekNotes[1].text).toBe('Week 12 day 2 note');
    expect(weekNotes.map(n => n.text)).not.toContain('Week 13 note');
  });

  it('deleteDailyNote removes the note', () => {
    const note = insertDailyNote(dailyLogId, 'other', 'To be deleted', db);
    expect(getDailyNotes(dailyLogId, db)).toHaveLength(1);

    deleteDailyNote(note.id, db);
    expect(getDailyNotes(dailyLogId, db)).toHaveLength(0);
  });

  it('deleteDailyNote is a no-op for non-existent id', () => {
    insertDailyNote(dailyLogId, 'life', 'Survivor note', db);
    deleteDailyNote(99999, db);
    expect(getDailyNotes(dailyLogId, db)).toHaveLength(1);
  });
});
