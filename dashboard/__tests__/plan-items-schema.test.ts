import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import { initTablesOn } from '../lib/db';

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initTablesOn(db);
  return db;
}

describe('plan_items schema — flexible scheduling columns', () => {
  let db: Database.Database;
  let columns: { name: string; dflt_value: string | null }[];

  beforeAll(() => {
    db = createTestDb();
    columns = db.pragma('table_info(plan_items)') as { name: string; dflt_value: string | null }[];
  });

  it('has sequence_notes column', () => {
    expect(columns.some(c => c.name === 'sequence_notes')).toBe(true);
  });

  it('has sequence_group column', () => {
    expect(columns.some(c => c.name === 'sequence_group')).toBe(true);
  });

  it('has assigned_date column', () => {
    expect(columns.some(c => c.name === 'assigned_date')).toBe(true);
  });

  it('has status column with default pending', () => {
    const statusCol = columns.find(c => c.name === 'status');
    expect(statusCol).toBeDefined();
    expect(statusCol!.dflt_value).toBe("'pending'");
  });
});

describe('plan_items schema — mapPlanRow new fields', () => {
  let db: Database.Database;

  beforeAll(() => {
    db = createTestDb();
  });

  it('inserts and reads back new flexible scheduling fields', () => {
    db.prepare(`
      INSERT INTO plan_items (
        week_number, day_order, day, session_type, focus,
        starting_weight, workout_plan, coach_cues, athlete_notes,
        completed, completed_at, sequence_notes, sequence_group, assigned_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      99, 1, 'Monday', 'Strength', 'Upper Body',
      '80kg', 'Plan text', 'Cues', '',
      0, null, 'Do after rest day', 'upper-block', '2026-03-25', 'scheduled'
    );

    const row = db.prepare(
      'SELECT * FROM plan_items WHERE week_number = 99'
    ).get() as Record<string, unknown> | null;

    expect(row).not.toBeNull();
    expect(row!.sequence_notes).toBe('Do after rest day');
    expect(row!.sequence_group).toBe('upper-block');
    expect(row!.assigned_date).toBe('2026-03-25');
    expect(row!.status).toBe('scheduled');
  });

  it('status defaults to pending when not provided', () => {
    db.prepare(`
      INSERT INTO plan_items (
        week_number, day_order, day, session_type,
        completed
      ) VALUES (?, ?, ?, ?, ?)
    `).run(100, 1, 'Tuesday', 'Cardio', 0);

    const row = db.prepare(
      'SELECT * FROM plan_items WHERE week_number = 100'
    ).get() as Record<string, unknown> | null;

    expect(row).not.toBeNull();
    expect(row!.status).toBe('pending');
    expect(row!.sequence_notes).toBeNull();
    expect(row!.sequence_group).toBeNull();
    expect(row!.assigned_date).toBeNull();
  });
});

describe('plan_items — status backfill migration', () => {
  it('sets status=completed for completed=1 rows', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    // Simulate an old DB: create plan_items without status column, insert rows
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS plan_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_number INTEGER NOT NULL,
        day_order INTEGER NOT NULL,
        day TEXT NOT NULL,
        session_type TEXT NOT NULL,
        focus TEXT,
        starting_weight TEXT,
        workout_plan TEXT,
        coach_cues TEXT,
        athlete_notes TEXT DEFAULT '',
        completed INTEGER DEFAULT 0,
        completed_at TEXT
      );
    `);
    db.prepare(
      'INSERT INTO plan_items (week_number, day_order, day, session_type, completed) VALUES (?, ?, ?, ?, ?)'
    ).run(1, 1, 'Mon', 'Strength', 1);
    db.prepare(
      'INSERT INTO plan_items (week_number, day_order, day, session_type, completed) VALUES (?, ?, ?, ?, ?)'
    ).run(1, 2, 'Tue', 'Cardio', 0);

    // Now run initTablesOn — it should add columns and backfill
    initTablesOn(db);

    const rows = db.prepare('SELECT * FROM plan_items ORDER BY day_order ASC').all() as Record<string, unknown>[];
    expect(rows[0].status).toBe('completed');
    expect(rows[1].status).toBe('pending');
  });
});
