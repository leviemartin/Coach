import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type { PlanItem, WeeklyMetrics, CeilingEntry, SubTask, DexaScan, Race, RaceStatus } from './types';
import { normalizeWorkoutText } from './parse-schedule';
import { DB_PATH } from './constants';

// Schema version — bump this when adding tables or columns to force re-init on cached connections
const SCHEMA_VERSION = 7; // v7: added daily_notes table

// Use globalThis to persist across hot reloads in dev
const globalForDb = globalThis as unknown as { _coachDb?: Database.Database; _coachDbSchema?: number };

export function getDb(): Database.Database {
  if (!globalForDb._coachDb || globalForDb._coachDbSchema !== SCHEMA_VERSION) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!globalForDb._coachDb) {
      globalForDb._coachDb = new Database(DB_PATH);
      globalForDb._coachDb.pragma('journal_mode = WAL');
      globalForDb._coachDb.pragma('busy_timeout = 5000');
      globalForDb._coachDb.pragma('foreign_keys = ON');
    }
    initTablesOn(globalForDb._coachDb);
    globalForDb._coachDbSchema = SCHEMA_VERSION;
  }
  return globalForDb._coachDb;
}

export function initTablesOn(db: Database.Database) {
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

    CREATE TABLE IF NOT EXISTS dexa_scans (
      scan_number INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      phase TEXT NOT NULL,
      total_body_fat_pct REAL NOT NULL,
      total_lean_mass_kg REAL NOT NULL,
      fat_mass_kg REAL NOT NULL,
      bone_mineral_density_gcm2 REAL NOT NULL,
      bone_mass_kg REAL NOT NULL,
      weight_at_scan_kg REAL NOT NULL,
      trunk_fat_pct REAL,
      arms_fat_pct REAL,
      legs_fat_pct REAL,
      trunk_lean_kg REAL,
      arms_lean_kg REAL,
      legs_lean_kg REAL,
      garmin_body_fat_pct REAL,
      garmin_muscle_mass_kg REAL,
      garmin_weight_kg REAL,
      garmin_reading_date TEXT,
      calibration_body_fat_offset_pct REAL,
      calibration_lean_mass_offset_kg REAL,
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS races (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      location TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      notes TEXT DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_ceiling_history_exercise ON ceiling_history(exercise);
    CREATE INDEX IF NOT EXISTS idx_ceiling_history_week ON ceiling_history(week_number);
    CREATE INDEX IF NOT EXISTS idx_plan_items_week ON plan_items(week_number);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_logs (
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
    CREATE INDEX IF NOT EXISTS idx_daily_logs_week ON daily_logs(week_number);
    CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(date);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS session_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      week_number INTEGER NOT NULL,
      session_type TEXT NOT NULL,
      session_title TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      notes TEXT,
      compliance_pct INTEGER,
      UNIQUE(date, session_title)
    );

    CREATE TABLE IF NOT EXISTS session_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_log_id INTEGER NOT NULL REFERENCES session_logs(id),
      exercise_name TEXT NOT NULL,
      exercise_order INTEGER NOT NULL,
      superset_group INTEGER,
      set_number INTEGER NOT NULL,
      prescribed_weight_kg REAL,
      prescribed_reps INTEGER,
      actual_weight_kg REAL,
      actual_reps INTEGER,
      completed INTEGER DEFAULT 0,
      is_modified INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS session_cardio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_log_id INTEGER NOT NULL REFERENCES session_logs(id),
      exercise_name TEXT NOT NULL,
      cardio_type TEXT NOT NULL,
      prescribed_rounds INTEGER,
      completed_rounds INTEGER DEFAULT 0,
      prescribed_duration_min REAL,
      target_intensity TEXT,
      completed INTEGER DEFAULT 0
    );
  `);

  // Migration v6: add new daily_logs columns if they don't exist
  try {
    db.exec(`ALTER TABLE daily_logs ADD COLUMN energy_level INTEGER`);
  } catch {
    // Column already exists — ignore
  }
  try {
    db.exec(`ALTER TABLE daily_logs ADD COLUMN pain_level INTEGER`);
  } catch {
    // Column already exists — ignore
  }
  try {
    db.exec(`ALTER TABLE daily_logs ADD COLUMN pain_area TEXT`);
  } catch {
    // Column already exists — ignore
  }
  try {
    db.exec(`ALTER TABLE daily_logs ADD COLUMN sleep_disruption TEXT`);
  } catch {
    // Column already exists — ignore
  }
  try {
    db.exec(`ALTER TABLE daily_logs ADD COLUMN session_summary TEXT`);
  } catch {
    // Column already exists — ignore
  }
  try {
    db.exec(`ALTER TABLE daily_logs ADD COLUMN session_log_id INTEGER REFERENCES session_logs(id)`);
  } catch {
    // Column already exists — ignore
  }

  // Migration: add sub_tasks column if it doesn't exist
  try {
    db.exec(`ALTER TABLE plan_items ADD COLUMN sub_tasks TEXT DEFAULT '[]'`);
  } catch {
    // Column already exists — ignore
  }

  // Migration: add plan_satisfaction column if it doesn't exist
  try {
    db.exec(`ALTER TABLE weekly_metrics ADD COLUMN plan_satisfaction INTEGER`);
  } catch {
    // Column already exists — ignore
  }

  // Migration: add perceived_readiness column if it doesn't exist
  try {
    db.exec(`ALTER TABLE weekly_metrics ADD COLUMN perceived_readiness INTEGER`);
  } catch {
    // Column already exists — ignore
  }

  // Migration: normalize workout text in existing plan_items (v2 — handles label-prefix + period formats)
  try {
    const migrated = db.prepare(
      "SELECT value FROM settings WHERE key = 'workout_normalize_v2'"
    ).get();
    if (!migrated) {
      const rows = db.prepare('SELECT id, workout_plan, coach_cues FROM plan_items').all();
      const update = db.prepare(
        'UPDATE plan_items SET workout_plan = ?, coach_cues = ? WHERE id = ?'
      );
      db.transaction(() => {
        for (const row of rows as { id: number; workout_plan: string | null; coach_cues: string | null }[]) {
          update.run(
            normalizeWorkoutText(row.workout_plan || ''),
            normalizeWorkoutText(row.coach_cues || ''),
            row.id
          );
        }
        db.prepare(
          "INSERT INTO settings (key, value) VALUES ('workout_normalize_v2', ?)"
        ).run(new Date().toISOString());
      })();
    }
  } catch { /* non-fatal */ }

  // Migration: ensure dexa_scans table exists on DBs created before schema v2
  // CREATE TABLE IF NOT EXISTS never throws for "already exists" — a catch here means a real error
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS dexa_scans (
        scan_number INTEGER PRIMARY KEY,
        date TEXT NOT NULL,
        phase TEXT NOT NULL,
        total_body_fat_pct REAL NOT NULL,
        total_lean_mass_kg REAL NOT NULL,
        fat_mass_kg REAL NOT NULL,
        bone_mineral_density_gcm2 REAL NOT NULL,
        bone_mass_kg REAL NOT NULL,
        weight_at_scan_kg REAL NOT NULL,
        trunk_fat_pct REAL,
        arms_fat_pct REAL,
        legs_fat_pct REAL,
        trunk_lean_kg REAL,
        arms_lean_kg REAL,
        legs_lean_kg REAL,
        garmin_body_fat_pct REAL,
        garmin_muscle_mass_kg REAL,
        garmin_weight_kg REAL,
        garmin_reading_date TEXT,
        calibration_body_fat_offset_pct REAL,
        calibration_lean_mass_offset_kg REAL,
        notes TEXT DEFAULT ''
      )
    `);
  } catch (err) {
    console.error('[db] dexa_scans migration failed:', err);
  }

  // Migration: ensure races table exists on DBs created before schema v3
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS races (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        location TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'planned',
        notes TEXT DEFAULT ''
      )
    `);
  } catch (err) {
    console.error('[db] races migration failed:', err);
  }

  // Migration v3: re-normalize with fixed normalizeWorkoutText (trailing periods, superset labels, per-line period split)
  try {
    const migrated = db.prepare(
      "SELECT value FROM settings WHERE key = 'workout_normalize_v3'"
    ).get();
    if (!migrated) {
      const rows = db.prepare('SELECT id, workout_plan, coach_cues FROM plan_items').all();
      const update = db.prepare(
        'UPDATE plan_items SET workout_plan = ?, coach_cues = ? WHERE id = ?'
      );
      db.transaction(() => {
        for (const row of rows as { id: number; workout_plan: string | null; coach_cues: string | null }[]) {
          update.run(
            normalizeWorkoutText(row.workout_plan || ''),
            normalizeWorkoutText(row.coach_cues || ''),
            row.id
          );
        }
        db.prepare(
          "INSERT INTO settings (key, value) VALUES ('workout_normalize_v3', ?)"
        ).run(new Date().toISOString());
      })();
    }
  } catch { /* non-fatal */ }

  // daily_notes table (tagged notes attached to daily logs)
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      daily_log_id INTEGER NOT NULL REFERENCES daily_logs(id),
      category TEXT NOT NULL CHECK(category IN ('injury','sleep','training','life','other')),
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_daily_notes_log ON daily_notes(daily_log_id);
    CREATE INDEX IF NOT EXISTS idx_daily_notes_category ON daily_notes(category);
  `);

  // Migration notes_migration_v1: move existing non-null daily_logs.notes into daily_notes with category 'other'
  try {
    const migrated = db.prepare(
      "SELECT value FROM settings WHERE key = 'notes_migration_v1'"
    ).get();
    if (!migrated) {
      const rows = db.prepare(
        "SELECT id, notes, created_at FROM daily_logs WHERE notes IS NOT NULL AND notes != ''"
      ).all() as { id: number; notes: string; created_at: string }[];
      const insert = db.prepare(
        "INSERT INTO daily_notes (daily_log_id, category, text, created_at) VALUES (?, 'other', ?, ?)"
      );
      db.transaction(() => {
        for (const row of rows) {
          insert.run(row.id, row.notes, row.created_at);
        }
        db.prepare(
          "INSERT INTO settings (key, value) VALUES ('notes_migration_v1', ?)"
        ).run(new Date().toISOString());
      })();
    }
  } catch { /* non-fatal */ }
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
      baker_cyst_pain, pullup_count, perceived_readiness, plan_satisfaction, model_used
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    m.weekNumber, m.checkInDate, m.weightKg, m.bodyFatPct, m.muscleMassKg,
    m.avgSleepScore, m.avgTrainingReadiness, m.avgRhr, m.avgHrv,
    m.caloriesAvg, m.proteinAvg, m.hydrationTracked ? 1 : 0,
    m.vampireCompliancePct, m.rugProtocolDays, m.sessionsPlanned,
    m.sessionsCompleted, m.bakerCystPain, m.pullupCount, m.perceivedReadiness, m.planSatisfaction, m.modelUsed
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
    perceivedReadiness: r.perceived_readiness as number | null,
    planSatisfaction: r.plan_satisfaction as number | null,
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

export function getPlanItemById(id: number): PlanItem | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM plan_items WHERE id = ?').get(id);
  return row ? mapPlanRow(row) : null;
}

function mapPlanRow(row: unknown): PlanItem {
  const r = row as Record<string, unknown>;
  let subTasks: SubTask[] = [];
  try {
    const raw = r.sub_tasks as string | null;
    if (raw) subTasks = JSON.parse(raw);
  } catch {
    subTasks = [];
  }
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
    subTasks,
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

// DEXA Scans
export function upsertDexaScan(scan: DexaScan): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO dexa_scans (
      scan_number, date, phase,
      total_body_fat_pct, total_lean_mass_kg, fat_mass_kg,
      bone_mineral_density_gcm2, bone_mass_kg, weight_at_scan_kg,
      trunk_fat_pct, arms_fat_pct, legs_fat_pct,
      trunk_lean_kg, arms_lean_kg, legs_lean_kg,
      garmin_body_fat_pct, garmin_muscle_mass_kg, garmin_weight_kg, garmin_reading_date,
      calibration_body_fat_offset_pct, calibration_lean_mass_offset_kg,
      notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    scan.scanNumber, scan.date, scan.phase,
    scan.totalBodyFatPct, scan.totalLeanMassKg, scan.fatMassKg,
    scan.boneMineralDensityGcm2, scan.boneMassKg, scan.weightAtScanKg,
    scan.regional.trunkFatPct, scan.regional.armsFatPct, scan.regional.legsFatPct,
    scan.regional.trunkLeanKg, scan.regional.armsLeanKg, scan.regional.legsLeanKg,
    scan.garminBodyFatPct, scan.garminMuscleMassKg, scan.garminWeightKg, scan.garminReadingDate,
    scan.calibration.bodyFatOffsetPct, scan.calibration.leanMassOffsetKg,
    scan.notes
  );
}

export function getDexaScans(): DexaScan[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM dexa_scans ORDER BY scan_number ASC').all();
  return rows.map(mapDexaRow);
}

function mapDexaRow(row: unknown): DexaScan {
  const r = row as Record<string, unknown>;
  return {
    scanNumber: r.scan_number as 1 | 2 | 3,
    date: r.date as string,
    phase: r.phase as string,
    totalBodyFatPct: r.total_body_fat_pct as number,
    totalLeanMassKg: r.total_lean_mass_kg as number,
    fatMassKg: r.fat_mass_kg as number,
    boneMineralDensityGcm2: r.bone_mineral_density_gcm2 as number,
    boneMassKg: r.bone_mass_kg as number,
    weightAtScanKg: r.weight_at_scan_kg as number,
    regional: {
      trunkFatPct: r.trunk_fat_pct as number | null,
      armsFatPct: r.arms_fat_pct as number | null,
      legsFatPct: r.legs_fat_pct as number | null,
      trunkLeanKg: r.trunk_lean_kg as number | null,
      armsLeanKg: r.arms_lean_kg as number | null,
      legsLeanKg: r.legs_lean_kg as number | null,
    },
    garminBodyFatPct: r.garmin_body_fat_pct as number | null,
    garminMuscleMassKg: r.garmin_muscle_mass_kg as number | null,
    garminWeightKg: r.garmin_weight_kg as number | null,
    garminReadingDate: r.garmin_reading_date as string | null,
    calibration: {
      bodyFatOffsetPct: (r.calibration_body_fat_offset_pct as number | null) ?? 0,
      leanMassOffsetKg: (r.calibration_lean_mass_offset_kg as number | null) ?? 0,
    },
    notes: (r.notes as string) || '',
  };
}

// Races
export function upsertRace(race: Race): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO races (id, name, date, location, type, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(race.id, race.name, race.date, race.location, race.type, race.status, race.notes);
}

export function getRaces(): Race[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM races ORDER BY date ASC').all();
  return rows.map((row: unknown) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      name: r.name as string,
      date: r.date as string,
      location: r.location as string,
      type: r.type as string,
      status: r.status as RaceStatus,
      notes: (r.notes as string) || '',
    };
  });
}

export function deleteRace(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM races WHERE id = ?').run(id);
}

// Daily Logs
export interface DailyLog {
  id: number;
  date: string;
  week_number: number;
  workout_completed: number;
  workout_plan_item_id: number | null;
  core_work_done: number;
  rug_protocol_done: number;
  vampire_bedtime: string | null;
  hydration_tracked: number;
  kitchen_cutoff_hit: number;
  is_sick_day: number;
  notes: string | null;
  energy_level: number | null;
  pain_level: number | null;
  pain_area: string | null;
  sleep_disruption: string | null;
  session_summary: string | null;
  session_log_id: number | null;
  created_at: string;
  updated_at: string;
}

export function getDailyLog(date: string, _db = getDb()): DailyLog | null {
  return _db.prepare('SELECT * FROM daily_logs WHERE date = ?').get(date) as DailyLog | null;
}

export function getDailyLogsByWeek(weekNumber: number, _db = getDb()): DailyLog[] {
  return _db.prepare('SELECT * FROM daily_logs WHERE week_number = ? ORDER BY date').all(weekNumber) as DailyLog[];
}

export function getAllDailyLogs(): DailyLog[] {
  const db = getDb();
  return db.prepare('SELECT * FROM daily_logs ORDER BY date').all() as DailyLog[];
}

export interface UncompletedSession {
  id: number;
  day: string;
  session_type: string;
  focus: string;
  workout_plan: string | null;
}

export function getUncompletedSessionsForWeek(weekNumber: number): UncompletedSession[] {
  const db = getDb();
  return db.prepare(`
    SELECT p.id, p.day, p.session_type, p.focus, p.workout_plan
    FROM plan_items p
    LEFT JOIN daily_logs d ON d.workout_plan_item_id = p.id AND d.workout_completed = 1
    WHERE p.week_number = ? AND d.id IS NULL
    ORDER BY p.id
  `).all(weekNumber) as UncompletedSession[];
}

// Daily Notes
export interface DailyNote {
  id: number;
  daily_log_id: number;
  category: 'injury' | 'sleep' | 'training' | 'life' | 'other';
  text: string;
  created_at: string;
}

export function insertDailyNote(dailyLogId: number, category: DailyNote['category'], text: string, _db = getDb()): DailyNote {
  const now = new Date().toISOString();
  const result = _db.prepare(
    'INSERT INTO daily_notes (daily_log_id, category, text, created_at) VALUES (?, ?, ?, ?)'
  ).run(dailyLogId, category, text, now);
  return _db.prepare('SELECT * FROM daily_notes WHERE id = ?').get(result.lastInsertRowid) as DailyNote;
}

export function getDailyNotes(dailyLogId: number, _db = getDb()): DailyNote[] {
  return _db.prepare(
    'SELECT * FROM daily_notes WHERE daily_log_id = ? ORDER BY created_at ASC'
  ).all(dailyLogId) as DailyNote[];
}

export function getWeekNotes(weekNumber: number, _db = getDb()): (DailyNote & { date: string })[] {
  return _db.prepare(`
    SELECT dn.*, dl.date
    FROM daily_notes dn
    JOIN daily_logs dl ON dn.daily_log_id = dl.id
    WHERE dl.week_number = ?
    ORDER BY dl.date ASC, dn.created_at ASC
  `).all(weekNumber) as (DailyNote & { date: string })[];
}

export function deleteDailyNote(id: number, _db = getDb()): void {
  _db.prepare('DELETE FROM daily_notes WHERE id = ?').run(id);
}

export function upsertDailyLog(log: Omit<DailyLog, 'id' | 'created_at' | 'updated_at'>, _db = getDb()): DailyLog {
  const now = new Date().toISOString();
  const existing = getDailyLog(log.date, _db);

  if (existing) {
    _db.prepare(`
      UPDATE daily_logs SET
        week_number = ?, workout_completed = ?, workout_plan_item_id = ?,
        core_work_done = ?, rug_protocol_done = ?, vampire_bedtime = ?,
        hydration_tracked = ?, kitchen_cutoff_hit = ?, is_sick_day = ?,
        notes = ?, energy_level = ?, pain_level = ?, pain_area = ?,
        sleep_disruption = ?, session_summary = ?, session_log_id = ?,
        updated_at = ?
      WHERE date = ?
    `).run(
      log.week_number, log.workout_completed, log.workout_plan_item_id,
      log.core_work_done, log.rug_protocol_done, log.vampire_bedtime,
      log.hydration_tracked, log.kitchen_cutoff_hit, log.is_sick_day,
      log.notes, log.energy_level, log.pain_level, log.pain_area,
      log.sleep_disruption, log.session_summary, log.session_log_id,
      now, log.date
    );
  } else {
    _db.prepare(`
      INSERT INTO daily_logs (
        date, week_number, workout_completed, workout_plan_item_id,
        core_work_done, rug_protocol_done, vampire_bedtime,
        hydration_tracked, kitchen_cutoff_hit, is_sick_day,
        notes, energy_level, pain_level, pain_area,
        sleep_disruption, session_summary, session_log_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      log.date, log.week_number, log.workout_completed, log.workout_plan_item_id,
      log.core_work_done, log.rug_protocol_done, log.vampire_bedtime,
      log.hydration_tracked, log.kitchen_cutoff_hit, log.is_sick_day,
      log.notes, log.energy_level, log.pain_level, log.pain_area,
      log.sleep_disruption, log.session_summary, log.session_log_id,
      now, now
    );
  }

  return getDailyLog(log.date, _db)!;
}
