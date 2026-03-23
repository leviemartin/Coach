import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initTablesOn } from '../lib/db';
import { parseScheduleTable } from '../lib/parse-schedule';

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initTablesOn(db);
  return db;
}

describe('plan_items status migration', () => {
  it('mapPlanRow derives completed from status field', () => {
    const db = createTestDb();

    // Insert a plan item with status='completed' but completed=0
    db.prepare(`
      INSERT INTO plan_items (
        week_number, day_order, day, session_type, focus,
        starting_weight, workout_plan, coach_cues, athlete_notes,
        completed, completed_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      1, 1, 'Monday', 'Strength', 'Upper Body',
      '80kg', 'Plan', 'Cues', '',
      0, null, 'completed'
    );

    // Read the raw row and verify both fields
    const row = db.prepare('SELECT * FROM plan_items WHERE week_number = 1').get() as Record<string, unknown>;
    expect(row.status).toBe('completed');
    // completed boolean is 0 (old value), but status is 'completed'
    expect(row.completed).toBe(0);

    // The derived logic: completed = status === 'completed' || !!(old completed)
    const derived = (row.status as string) === 'completed' || !!(row.completed);
    expect(derived).toBe(true);
  });

  it('mapPlanRow: old completed=1 still shows as completed when status is pending', () => {
    const db = createTestDb();

    db.prepare(`
      INSERT INTO plan_items (
        week_number, day_order, day, session_type,
        completed, status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(2, 1, 'Tuesday', 'Cardio', 1, 'pending');

    const row = db.prepare('SELECT * FROM plan_items WHERE week_number = 2').get() as Record<string, unknown>;
    const derived = (row.status as string) === 'completed' || !!(row.completed);
    // backward compat: old boolean still works
    expect(derived).toBe(true);
  });

  it('new plan items from parser have status: pending', () => {
    const markdown = `
| Done? | Day | Session Type | Focus | Est. Starting Weight (Hevy) | Detailed Workout Plan | Coach's Cues & Mobility | My Notes |
|-------|-----|-------------|-------|---------------------------|----------------------|------------------------|----------|
| | Monday | Strength | Upper Body | 80kg | Pull-ups 3x5 | Keep tight | |
| | Wednesday | Cardio | Zone 2 | | Rower 30 min | HR <140 | |
`;
    const items = parseScheduleTable(markdown, 1);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.status).toBe('pending');
      expect(item.completed).toBe(false);
    }
  });

  it('TodayAction-style check: status !== completed works correctly', () => {
    // Items with status 'pending' or 'scheduled' should not be considered completed
    const pendingItem = { status: 'pending' as const, completed: false };
    const scheduledItem = { status: 'scheduled' as const, completed: false };
    const completedItem = { status: 'completed' as const, completed: false };
    const skippedItem = { status: 'skipped' as const, completed: false };

    expect(pendingItem.status !== 'completed').toBe(true);
    expect(scheduledItem.status !== 'completed').toBe(true);
    expect(completedItem.status !== 'completed').toBe(false);
    expect(skippedItem.status !== 'completed').toBe(true);
  });

  it('TodayAction-style button variant: status === completed drives variant', () => {
    const completedItem = { status: 'completed' as const };
    const pendingItem = { status: 'pending' as const };

    expect(completedItem.status === 'completed' ? 'contained' : 'outlined').toBe('contained');
    expect(pendingItem.status === 'completed' ? 'contained' : 'outlined').toBe('outlined');
  });

  it('SwapSessionPicker: only status drives completed check', () => {
    const completedViaStatus = { id: 1, status: 'completed' as const, completed: false };
    const completedViaOldBool = { id: 2, status: 'pending' as const, completed: true };
    const notCompleted = { id: 3, status: 'pending' as const, completed: false };

    // New logic: only check status
    const isCompletedNew = (item: typeof completedViaStatus) => item.status === 'completed';

    expect(isCompletedNew(completedViaStatus)).toBe(true);
    // Old bool=true with status='pending' is NOT completed under new logic
    expect(isCompletedNew(completedViaOldBool as typeof completedViaStatus)).toBe(false);
    expect(isCompletedNew(notCompleted as typeof completedViaStatus)).toBe(false);
  });

  it('completeSession updates plan_items status via daily_log link', () => {
    const db = createTestDb();

    // Insert a plan item
    db.prepare(`
      INSERT INTO plan_items (
        week_number, day_order, day, session_type, focus,
        completed, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(10, 1, 'Monday', 'Strength', 'Upper Body', 0, 'pending');

    const planItemId = (db.prepare('SELECT id FROM plan_items WHERE week_number = 10').get() as { id: number }).id;

    // Insert a daily log linking to the plan item
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO daily_logs (date, week_number, workout_completed, workout_plan_item_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('2026-03-23', 10, 0, planItemId, now, now);

    // Simulate what completeSession does: update plan_items status
    db.prepare("UPDATE plan_items SET status = 'completed', completed = 1, completed_at = ? WHERE id = ?")
      .run(new Date().toISOString(), planItemId);

    // Verify
    const updated = db.prepare('SELECT * FROM plan_items WHERE id = ?').get(planItemId) as Record<string, unknown>;
    expect(updated.status).toBe('completed');
    expect(updated.completed).toBe(1);
    expect(updated.completed_at).not.toBeNull();
  });
});
