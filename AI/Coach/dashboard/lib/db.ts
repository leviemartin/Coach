import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type { PlanItem, WeeklyMetrics, CeilingEntry } from './types';

const DB_PATH = path.join(process.cwd(), 'data', 'trends.db');

// Use globalThis to persist across hot reloads in dev
const globalForDb = globalThis as unknown as { _coachDb?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb._coachDb) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    globalForDb._coachDb = new Database(DB_PATH);
    globalForDb._coachDb.pragma('journal_mode = WAL');
    globalForDb._coachDb.pragma('busy_timeout = 5000');
    globalForDb._coachDb.pragma('foreign_keys = ON');
    initTables(globalForDb._coachDb);
  }
  return globalForDb._coachDb;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS weekly_metrics (
      week_number INTEGER PRIMARY KEY,
      check_in_date TEXT NOT NULL,
      weight_kg REAL,
      body_fat_pct REAL,
      muscle_mass_kg REAL,
      avg_sleep_score REAL,
      avg_training_readiness REAL,
      avg_rhr REAL,
      avg_hrv REAL,
      calories_avg REAL,
      protein_avg REAL,
      hydration_tracked INTEGER DEFAULT 0,
      vampire_compliance_pct REAL,
      rug_protocol_days INTEGER,
      sessions_planned INTEGER,
      sessions_completed INTEGER,
      baker_cyst_pain INTEGER DEFAULT 0,
      pullup_count INTEGER,
      model_used TEXT DEFAULT 'sonnet'
    );

    CREATE TABLE IF NOT EXISTS ceiling_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_number INTEGER NOT NULL,
      date TEXT NOT NULL,
      exercise TEXT NOT NULL,
      weight_kg REAL NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ceiling_history_exercise ON ceiling_history(exercise);
    CREATE INDEX IF NOT EXISTS idx_ceiling_history_week ON ceiling_history(week_number);
    CREATE INDEX IF NOT EXISTS idx_plan_items_week ON plan_items(week_number);
  `);
}

// Settings
export function getSetting(key: string, defaultValue: string = ''): string {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? defaultValue;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

// Weekly Metrics
export function upsertWeeklyMetrics(m: WeeklyMetrics): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO weekly_metrics (
      week_number, check_in_date, weight_kg, body_fat_pct, muscle_mass_kg,
      avg_sleep_score, avg_training_readiness, avg_rhr, avg_hrv,
      calories_avg, protein_avg, hydration_tracked, vampire_compliance_pct,
      rug_protocol_days, sessions_planned, sessions_completed,
      baker_cyst_pain, pullup_count, model_used
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    m.weekNumber, m.checkInDate, m.weightKg, m.bodyFatPct, m.muscleMassKg,
    m.avgSleepScore, m.avgTrainingReadiness, m.avgRhr, m.avgHrv,
    m.caloriesAvg, m.proteinAvg, m.hydrationTracked ? 1 : 0,
    m.vampireCompliancePct, m.rugProtocolDays, m.sessionsPlanned,
    m.sessionsCompleted, m.bakerCystPain, m.pullupCount, m.modelUsed
  );
}

export function getWeeklyMetrics(weekNumber?: number): WeeklyMetrics[] {
  const db = getDb();
  if (weekNumber !== undefined) {
    const row = db.prepare('SELECT * FROM weekly_metrics WHERE week_number = ?').get(weekNumber);
    return row ? [mapMetricsRow(row)] : [];
  }
  const rows = db.prepare('SELECT * FROM weekly_metrics ORDER BY week_number ASC').all();
  return rows.map(mapMetricsRow);
}

export function getLatestWeekNumber(): number {
  const db = getDb();
  const row = db.prepare('SELECT MAX(week_number) as max_week FROM weekly_metrics').get() as { max_week: number | null };
  return row?.max_week ?? 0;
}

function mapMetricsRow(row: unknown): WeeklyMetrics {
  const r = row as Record<string, unknown>;
  return {
    weekNumber: r.week_number as number,
    checkInDate: r.check_in_date as string,
    weightKg: r.weight_kg as number | null,
    bodyFatPct: r.body_fat_pct as number | null,
    muscleMassKg: r.muscle_mass_kg as number | null,
    avgSleepScore: r.avg_sleep_score as number | null,
    avgTrainingReadiness: r.avg_training_readiness as number | null,
    avgRhr: r.avg_rhr as number | null,
    avgHrv: r.avg_hrv as number | null,
    caloriesAvg: r.calories_avg as number | null,
    proteinAvg: r.protein_avg as number | null,
    hydrationTracked: !!(r.hydration_tracked),
    vampireCompliancePct: r.vampire_compliance_pct as number | null,
    rugProtocolDays: r.rug_protocol_days as number | null,
    sessionsPlanned: r.sessions_planned as number | null,
    sessionsCompleted: r.sessions_completed as number | null,
    bakerCystPain: (r.baker_cyst_pain as number) ?? 0,
    pullupCount: r.pullup_count as number | null,
    modelUsed: r.model_used as string,
  };
}

// Plan Items
export function insertPlanItems(items: PlanItem[]): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO plan_items (
      week_number, day_order, day, session_type, focus,
      starting_weight, workout_plan, coach_cues, athlete_notes,
      completed, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: PlanItem[]) => {
    for (const item of items) {
      stmt.run(
        item.weekNumber, item.dayOrder, item.day, item.sessionType,
        item.focus, item.startingWeight, item.workoutPlan, item.coachCues,
        item.athleteNotes, item.completed ? 1 : 0, item.completedAt
      );
    }
  });

  insertMany(items);
}

export function getPlanItems(weekNumber: number): PlanItem[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM plan_items WHERE week_number = ? ORDER BY day_order ASC'
  ).all(weekNumber);
  return rows.map(mapPlanRow);
}

export function togglePlanItemComplete(id: number, completed: boolean): void {
  const db = getDb();
  db.prepare(
    'UPDATE plan_items SET completed = ?, completed_at = ? WHERE id = ?'
  ).run(completed ? 1 : 0, completed ? new Date().toISOString() : null, id);
}

export function updatePlanItemNotes(id: number, notes: string): void {
  const db = getDb();
  db.prepare('UPDATE plan_items SET athlete_notes = ? WHERE id = ?').run(notes, id);
}

function mapPlanRow(row: unknown): PlanItem {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as number,
    weekNumber: r.week_number as number,
    dayOrder: r.day_order as number,
    day: r.day as string,
    sessionType: r.session_type as string,
    focus: (r.focus as string) || '',
    startingWeight: (r.starting_weight as string) || '',
    workoutPlan: (r.workout_plan as string) || '',
    coachCues: (r.coach_cues as string) || '',
    athleteNotes: (r.athlete_notes as string) || '',
    completed: !!(r.completed),
    completedAt: r.completed_at as string | null,
  };
}

// Ceiling History
export function insertCeilingHistory(entries: CeilingEntry[]): void {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO ceiling_history (week_number, date, exercise, weight_kg) VALUES (?, ?, ?, ?)'
  );
  const insertMany = db.transaction((entries: CeilingEntry[]) => {
    for (const e of entries) {
      stmt.run(e.weekNumber, e.date, e.exercise, e.weightKg);
    }
  });
  insertMany(entries);
}

export function getCeilingHistory(exercise?: string): CeilingEntry[] {
  const db = getDb();
  let rows;
  if (exercise) {
    rows = db.prepare(
      'SELECT * FROM ceiling_history WHERE exercise = ? ORDER BY week_number ASC'
    ).all(exercise);
  } else {
    rows = db.prepare('SELECT * FROM ceiling_history ORDER BY week_number ASC').all();
  }
  return rows.map((r: unknown) => {
    const row = r as Record<string, unknown>;
    return {
      id: row.id as number,
      weekNumber: row.week_number as number,
      date: row.date as string,
      exercise: row.exercise as string,
      weightKg: row.weight_kg as number,
    };
  });
}

// Delete plan items for a week (for re-import)
export function deletePlanItems(weekNumber: number): void {
  const db = getDb();
  db.prepare('DELETE FROM plan_items WHERE week_number = ?').run(weekNumber);
}
