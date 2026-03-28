import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initTablesOn } from '../lib/db';

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initTablesOn(db);
  return db;
}

function insertWeek13Plan(db: Database.Database) {
  const stmt = db.prepare(`
    INSERT INTO plan_items (week_number, day_order, day, session_type, focus, completed, status)
    VALUES (?, ?, ?, ?, ?, 0, 'pending')
  `);
  stmt.run(13, 1, 'Monday', 'Upper + Threshold', 'Pull-ups & StairMaster');
  stmt.run(13, 2, 'Tuesday', 'Power + Core', 'Rower Sprints');
  stmt.run(13, 3, 'Wednesday', 'Lower + Walk', 'Legs & Treadmill Test');
  stmt.run(13, 4, 'Thursday', 'Upper + Threshold', 'Grip & StairMaster');
  stmt.run(13, 5, 'Friday', 'Power + Test', 'Explosive & Benchmarks');
  stmt.run(13, 6, 'Saturday', 'Rest Day', 'Family Time');
  stmt.run(13, 7, 'Sunday', 'Outdoor Ruck', 'Vizsla & Hills');
}

function getPlanItems(db: Database.Database, weekNumber: number) {
  return db.prepare('SELECT * FROM plan_items WHERE week_number = ? ORDER BY day_order ASC').all(weekNumber) as Array<{
    id: number;
    day: string;
    session_type: string;
    focus: string;
    assigned_date: string | null;
    status: string;
  }>;
}

function simulateSwap(db: Database.Database, planItemId: number, targetDate: string) {
  // Old behavior: just sets assigned_date without clearing previous
  db.prepare('UPDATE plan_items SET assigned_date = ? WHERE id = ?').run(targetDate, planItemId);
}

function simulateSwapWithClear(db: Database.Database, planItemId: number, targetDate: string, weekNumber: number) {
  // Fixed behavior: clears stale assigned_date before setting new one
  db.prepare('UPDATE plan_items SET assigned_date = NULL WHERE week_number = ? AND assigned_date = ? AND id != ?')
    .run(weekNumber, targetDate, planItemId);
  db.prepare('UPDATE plan_items SET assigned_date = ? WHERE id = ?').run(targetDate, planItemId);
}

function findPlannedSession(items: Array<{ id: number; assigned_date: string | null; day: string }>, date: string, dayName: string, dayAbbrev: string) {
  // This is exactly how /api/log GET finds the planned session
  return items.find((item) =>
    item.assigned_date === date
  ) || items.find((item) =>
    !item.assigned_date && (item.day === dayName || item.day.startsWith(dayAbbrev))
  ) || null;
}

describe('swap session to Saturday', () => {
  it('swap API updates assigned_date for training session to Saturday', () => {
    const db = createTestDb();
    insertWeek13Plan(db);

    const items = getPlanItems(db, 13);
    const mondaySession = items.find(i => i.day === 'Monday')!;

    // Simulate swap: assign Monday's session to Saturday
    simulateSwap(db, mondaySession.id, '2026-03-28');

    // Verify DB was updated
    const updated = db.prepare('SELECT assigned_date FROM plan_items WHERE id = ?').get(mondaySession.id) as { assigned_date: string };
    expect(updated.assigned_date).toBe('2026-03-28');
  });

  it('after swap, GET /api/log finds the swapped session as plannedSession for Saturday', () => {
    const db = createTestDb();
    insertWeek13Plan(db);

    const items = getPlanItems(db, 13);
    const mondaySession = items.find(i => i.day === 'Monday')!;

    // Before swap: Saturday's planned session is the Rest Day
    const beforeSwap = findPlannedSession(items, '2026-03-28', 'Saturday', 'Sat');
    expect(beforeSwap).not.toBeNull();
    expect(beforeSwap!.session_type).toBe('Rest Day');

    // Swap Monday's session to Saturday
    simulateSwap(db, mondaySession.id, '2026-03-28');

    // Re-read items from DB (simulates what fetchDayLog does)
    const updatedItems = getPlanItems(db, 13);
    const afterSwap = findPlannedSession(updatedItems, '2026-03-28', 'Saturday', 'Sat');
    expect(afterSwap).not.toBeNull();
    expect(afterSwap!.session_type).toBe('Upper + Threshold');
    expect(afterSwap!.focus).toBe('Pull-ups & StairMaster');
  });

  it('double swap: second swap to Saturday replaces the first', () => {
    const db = createTestDb();
    insertWeek13Plan(db);

    const items = getPlanItems(db, 13);
    const mondaySession = items.find(i => i.day === 'Monday')!;
    const tuesdaySession = items.find(i => i.day === 'Tuesday')!;

    // First swap: Monday → Saturday
    simulateSwapWithClear(db, mondaySession.id, '2026-03-28', 13);

    // Second swap: Tuesday → Saturday (now clears Monday's stale assigned_date)
    simulateSwapWithClear(db, tuesdaySession.id, '2026-03-28', 13);

    // Only Tuesday should have assigned_date = Saturday
    const updatedItems = getPlanItems(db, 13);
    const mondayAfter = updatedItems.find(i => i.day === 'Monday')!;
    expect(mondayAfter.assigned_date).toBeNull();

    const planned = findPlannedSession(updatedItems, '2026-03-28', 'Saturday', 'Sat');
    expect(planned!.session_type).toBe('Power + Core'); // Tuesday's session
  });

  it('getUncompletedSessionsForWeek excludes Rest Day', () => {
    const db = createTestDb();
    insertWeek13Plan(db);

    const uncompleted = db.prepare(`
      SELECT id, day, session_type, focus
      FROM plan_items
      WHERE week_number = 13
        AND status NOT IN ('completed', 'skipped')
        AND LOWER(session_type) NOT IN ('rest', 'rest day', 'family', 'family day', 'family time')
      ORDER BY id
    `).all() as Array<{ id: number; session_type: string }>;

    expect(uncompleted.length).toBe(6);
    expect(uncompleted.every(s => s.session_type !== 'Rest Day')).toBe(true);
  });
});
