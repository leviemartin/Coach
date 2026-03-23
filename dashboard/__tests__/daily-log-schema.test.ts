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

describe('daily_logs schema v6', () => {
  let db: Database.Database;
  let columns: { name: string }[];

  beforeAll(() => {
    db = createTestDb();
    columns = db.pragma('table_info(daily_logs)') as { name: string }[];
  });

  it('has energy_level column', () => {
    expect(columns.some(c => c.name === 'energy_level')).toBe(true);
  });

  it('has pain_level column', () => {
    expect(columns.some(c => c.name === 'pain_level')).toBe(true);
  });

  it('has pain_area column', () => {
    expect(columns.some(c => c.name === 'pain_area')).toBe(true);
  });

  it('has sleep_disruption column', () => {
    expect(columns.some(c => c.name === 'sleep_disruption')).toBe(true);
  });

  it('has session_summary column', () => {
    expect(columns.some(c => c.name === 'session_summary')).toBe(true);
  });

  it('has session_log_id column', () => {
    expect(columns.some(c => c.name === 'session_log_id')).toBe(true);
  });
});

describe('upsertDailyLog round-trip for v6 fields', () => {
  let db: Database.Database;
  const testDate = '2026-01-15';

  beforeAll(() => {
    db = createTestDb();
  });

  it('persists all 6 new fields on INSERT', () => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO daily_logs (
        date, week_number, workout_completed, workout_plan_item_id,
        core_work_done, rug_protocol_done, vampire_bedtime,
        hydration_tracked, kitchen_cutoff_hit, is_sick_day,
        notes, energy_level, pain_level, pain_area,
        sleep_disruption, session_summary, session_log_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      testDate, 3, 1, null,
      1, 1, '22:45',
      1, 1, 0,
      'test insert', 4, 2, 'left knee',
      'baby at 03:00', 'Upper body A — felt strong', null,
      now, now
    );

    const row = db.prepare('SELECT * FROM daily_logs WHERE date = ?').get(testDate) as Record<string, unknown> | null;
    expect(row).not.toBeNull();
    expect(row!.energy_level).toBe(4);
    expect(row!.pain_level).toBe(2);
    expect(row!.pain_area).toBe('left knee');
    expect(row!.sleep_disruption).toBe('baby at 03:00');
    expect(row!.session_summary).toBe('Upper body A — felt strong');
    expect(row!.session_log_id).toBeNull();
  });

  it('persists all 6 new fields on UPDATE', () => {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE daily_logs SET
        energy_level = ?, pain_level = ?, pain_area = ?,
        sleep_disruption = ?, session_summary = ?,
        updated_at = ?
      WHERE date = ?
    `).run(3, 0, null, null, 'Updated summary', now, testDate);

    const row = db.prepare('SELECT * FROM daily_logs WHERE date = ?').get(testDate) as Record<string, unknown> | null;
    expect(row).not.toBeNull();
    expect(row!.energy_level).toBe(3);
    expect(row!.pain_level).toBe(0);
    expect(row!.pain_area).toBeNull();
    expect(row!.sleep_disruption).toBeNull();
    expect(row!.session_summary).toBe('Updated summary');
  });
});
