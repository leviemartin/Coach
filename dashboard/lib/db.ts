import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type { PlanItem, WeeklyMetrics, CeilingEntry, SubTask, DexaScan, Race, RaceStatus } from './types';
import { normalizeWorkoutText } from './parse-schedule';
import { DB_PATH } from './constants';

// Schema version — bump this when adding tables or columns to force re-init on cached connections
const SCHEMA_VERSION = 10; // v10: added plan_exercises table and structured plan columns

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
      completed_at TEXT,
      sequence_notes TEXT,
      sequence_group TEXT,
      assigned_date TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','scheduled','completed','skipped'))
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS plan_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_item_id INTEGER NOT NULL REFERENCES plan_items(id) ON DELETE CASCADE,
      section TEXT NOT NULL CHECK(section IN ('warm_up','activation','main_work','accessory','finisher','cool_down')),
      exercise_order INTEGER NOT NULL,
      exercise_name TEXT NOT NULL,
      superset_group TEXT,
      type TEXT NOT NULL CHECK(type IN ('strength','carry','timed','cardio_intervals','cardio_steady','ruck','mobility')),
      sets INTEGER,
      reps TEXT,
      weight_kg REAL,
      duration_seconds INTEGER,
      rest_seconds INTEGER,
      tempo TEXT,
      laterality TEXT DEFAULT 'bilateral' CHECK(laterality IN ('bilateral','unilateral_each','alternating')),
      coach_cue TEXT,
      rounds INTEGER,
      target_intensity TEXT,
      interval_work_seconds INTEGER,
      interval_rest_seconds INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_plan_exercises_plan_item ON plan_exercises(plan_item_id);
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

  // Migration v8: add flexible scheduling columns to plan_items
  try { db.exec(`ALTER TABLE plan_items ADD COLUMN sequence_notes TEXT`); } catch {}
  try { db.exec(`ALTER TABLE plan_items ADD COLUMN sequence_group TEXT`); } catch {}
  try { db.exec(`ALTER TABLE plan_items ADD COLUMN assigned_date TEXT`); } catch {}
  try { db.exec(`ALTER TABLE plan_items ADD COLUMN status TEXT DEFAULT 'pending' CHECK(status IN ('pending','scheduled','completed','skipped'))`); } catch {}

  // Migration v8 backfill: populate status from completed boolean (run once)
  try {
    const statusMigrated = db.prepare("SELECT value FROM settings WHERE key = 'plan_status_backfill'").get();
    if (!statusMigrated) {
      db.exec("UPDATE plan_items SET status = 'completed' WHERE completed = 1");
      db.exec("UPDATE plan_items SET status = 'pending' WHERE completed = 0 OR completed IS NULL");
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('plan_status_backfill', '1')").run();
    }
  } catch { /* non-fatal */ }

  // Migration v9: add daily-log-derived columns to weekly_metrics
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN kitchen_cutoff_compliance INTEGER`); } catch {}
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN avg_energy REAL`); } catch {}
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN pain_days INTEGER`); } catch {}
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN sleep_disruption_count INTEGER`); } catch {}

  // Migration: weekly_metrics enrichment for coach data integration
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN avg_rpe REAL`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN hard_exercise_count INTEGER`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN week_reflection TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN next_week_conflicts TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN questions_for_coaches TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN sick_days INTEGER`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN pain_areas_summary TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE weekly_metrics ADD COLUMN sleep_disruption_breakdown TEXT`); } catch { /* exists */ }

  // Migration: session_exercise_feedback table
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_exercise_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_log_id INTEGER NOT NULL REFERENCES session_logs(id),
      exercise_name TEXT NOT NULL,
      exercise_order INTEGER NOT NULL,
      rpe INTEGER CHECK (rpe BETWEEN 1 AND 5),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(session_log_id, exercise_name)
    )
  `);

  // Migration: actual_duration_s on session_sets
  try {
    db.exec(`ALTER TABLE session_sets ADD COLUMN prescribed_duration_s INTEGER`);
  } catch {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE session_sets ADD COLUMN actual_duration_s INTEGER`);
  } catch {
    // Column already exists
  }

  // Migration: actual_duration_min on session_cardio
  try {
    db.exec(`ALTER TABLE session_cardio ADD COLUMN actual_duration_min REAL`);
  } catch {
    // Column already exists
  }

  // Migration v10: structured plan exercises
  try { db.exec(`ALTER TABLE plan_items ADD COLUMN synthesis_notes TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE plan_items ADD COLUMN estimated_duration_min INTEGER`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE plan_items ADD COLUMN has_structured_exercises INTEGER DEFAULT 0`); } catch { /* exists */ }

  try { db.exec(`ALTER TABLE session_sets ADD COLUMN section TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_sets ADD COLUMN rest_seconds INTEGER`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_sets ADD COLUMN coach_cue TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_sets ADD COLUMN plan_exercise_id INTEGER REFERENCES plan_exercises(id)`); } catch { /* exists */ }

  try { db.exec(`ALTER TABLE session_cardio ADD COLUMN section TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_cardio ADD COLUMN rest_seconds INTEGER`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_cardio ADD COLUMN coach_cue TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_cardio ADD COLUMN plan_exercise_id INTEGER REFERENCES plan_exercises(id)`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_cardio ADD COLUMN interval_work_seconds INTEGER`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_cardio ADD COLUMN interval_rest_seconds INTEGER`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_cardio ADD COLUMN exercise_order INTEGER`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE session_cardio ADD COLUMN round_data TEXT`); } catch { /* exists */ }

  // Migration v11: prescribed_reps_display stores raw reps string ("8-10", "AMRAP")
  try { db.exec(`ALTER TABLE session_sets ADD COLUMN prescribed_reps_display TEXT`); } catch { /* exists */ }

  // Migration v12: exercise_type stores the plan exercise type (strength, carry, timed, mobility)
  // so buildBlocksFromSets doesn't need fragile inference
  try { db.exec(`ALTER TABLE session_sets ADD COLUMN exercise_type TEXT`); } catch { /* exists */ }

  // Backfill exercise_type from plan_exercises for existing rows
  try {
    const needsBackfill = db.prepare(
      `SELECT COUNT(*) AS cnt FROM session_sets WHERE exercise_type IS NULL AND plan_exercise_id IS NOT NULL`
    ).get() as { cnt: number };
    if (needsBackfill.cnt > 0) {
      db.exec(`
        UPDATE session_sets
        SET exercise_type = (
          SELECT pe.type FROM plan_exercises pe WHERE pe.id = session_sets.plan_exercise_id
        )
        WHERE exercise_type IS NULL AND plan_exercise_id IS NOT NULL
      `);
      console.log(`[db] v12: backfilled exercise_type for ${needsBackfill.cnt} session_sets row(s)`);
    }
  } catch (err) {
    console.error('[db] v12 backfill failed:', err);
  }

  // Migration v13: laterality on session_sets (bilateral, unilateral_each, alternating)
  try { db.exec(`ALTER TABLE session_sets ADD COLUMN laterality TEXT DEFAULT 'bilateral'`); } catch { /* exists */ }

  // Backfill laterality from plan_exercises for existing rows
  try {
    const needsLateralityBackfill = db.prepare(
      `SELECT COUNT(*) AS cnt FROM session_sets WHERE (laterality IS NULL OR laterality = 'bilateral') AND plan_exercise_id IS NOT NULL`
    ).get() as { cnt: number };
    if (needsLateralityBackfill.cnt > 0) {
      db.exec(`
        UPDATE session_sets
        SET laterality = (
          SELECT pe.laterality FROM plan_exercises pe WHERE pe.id = session_sets.plan_exercise_id
        )
        WHERE plan_exercise_id IS NOT NULL AND (
          SELECT pe.laterality FROM plan_exercises pe WHERE pe.id = session_sets.plan_exercise_id
        ) != 'bilateral'
      `);
      console.log(`[db] v13: backfilled laterality for session_sets rows`);
    }
  } catch (err) {
    console.error('[db] v13 laterality backfill failed:', err);
  }

  // Migration: add notes column to session_exercise_feedback
  try { db.exec(`ALTER TABLE session_exercise_feedback ADD COLUMN notes TEXT`); } catch { /* exists */ }

  // Migration: add plan_exercise_id to session_exercise_feedback for robust linking
  try { db.exec(`ALTER TABLE session_exercise_feedback ADD COLUMN plan_exercise_id INTEGER`); } catch { /* exists */ }

  // One-time cleanup: delete duplicate session_logs rows where multiple sessions with the
  // same title exist in the same week (bug: session created on different day than original).
  // Keeps the row with the highest compliance_pct, deletes the lower-scoring duplicate(s).
  const migrated2 = db.prepare("SELECT value FROM settings WHERE key = 'dedup_sessions_v2'").get();
  if (!migrated2) {
    const dupes = db.prepare(`
      SELECT s1.id FROM session_logs s1
      WHERE EXISTS (
        SELECT 1 FROM session_logs s2
        WHERE s2.week_number = s1.week_number
          AND s2.session_title = s1.session_title
          AND s2.id != s1.id
          AND (
            COALESCE(s2.compliance_pct, 0) > COALESCE(s1.compliance_pct, 0)
            OR (COALESCE(s2.compliance_pct, 0) = COALESCE(s1.compliance_pct, 0) AND s2.id > s1.id)
          )
      )
    `).all() as Array<{ id: number }>;
    for (const o of dupes) {
      db.prepare('DELETE FROM session_exercise_feedback WHERE session_log_id = ?').run(o.id);
      db.prepare('DELETE FROM session_sets WHERE session_log_id = ?').run(o.id);
      db.prepare('DELETE FROM session_cardio WHERE session_log_id = ?').run(o.id);
      db.prepare('UPDATE daily_logs SET session_log_id = NULL, session_summary = NULL WHERE session_log_id = ?').run(o.id);
      db.prepare('DELETE FROM session_logs WHERE id = ?').run(o.id);
    }
    if (dupes.length > 0) {
      console.log(`[db] dedup_sessions_v2: cleaned up ${dupes.length} duplicate session(s)`);
    }
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('dedup_sessions_v2', ?)").run(new Date().toISOString());
  }

  // v4: Fix session dates using day name when assigned_date is NULL
  // v3 failed because plan_item.assigned_date was NULL — day is set via day name ("Tuesday"), not assigned_date.
  // This migration computes the correct date from the week start + day name offset.
  const migrated4 = db.prepare("SELECT value FROM settings WHERE key = 'fix_session_dates_v4'").get();
  if (!migrated4) {
    const EPOCH = new Date('2025-12-29T00:00:00Z').getTime(); // Monday, program start
    const DAY_OFFSETS: Record<string, number> = {
      Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6,
    };

    // Find sessions whose date doesn't match their plan_item's scheduled day
    // Match by week_number + focus (title), use day name to compute correct date
    const mismatched = db.prepare(`
      SELECT sl.id AS session_id, sl.date AS current_date, sl.week_number,
             pi.id AS plan_item_id, pi.day AS day_name
      FROM session_logs sl
      JOIN plan_items pi
        ON pi.week_number = sl.week_number
        AND pi.focus = sl.session_title
      WHERE pi.assigned_date IS NULL
        AND sl.completed_at IS NOT NULL
    `).all() as Array<{ session_id: number; current_date: string; week_number: number; plan_item_id: number; day_name: string }>;

    for (const m of mismatched) {
      const offset = DAY_OFFSETS[m.day_name];
      if (offset === undefined) continue;
      const weekStartMs = EPOCH + (m.week_number - 1) * 7 * 86400000;
      const correctDate = new Date(weekStartMs + offset * 86400000).toISOString().split('T')[0];

      if (correctDate === m.current_date) continue; // already correct

      console.log(`[db] v4: moving session ${m.session_id} from ${m.current_date} to ${correctDate}`);

      // 1. Update session_logs date
      db.prepare('UPDATE session_logs SET date = ? WHERE id = ?').run(correctDate, m.session_id);

      // 2. Link daily_log on correct date to this session + plan_item
      const correctLog = db.prepare('SELECT id FROM daily_logs WHERE date = ?').get(correctDate) as { id: number } | undefined;
      if (correctLog) {
        db.prepare(`
          UPDATE daily_logs SET session_log_id = ?, workout_plan_item_id = ?, workout_completed = 1
          WHERE date = ?
        `).run(m.session_id, m.plan_item_id, correctDate);
      }

      // 3. Mark plan_item as completed
      db.prepare("UPDATE plan_items SET status = 'completed', completed = 1, completed_at = ? WHERE id = ?")
        .run(new Date().toISOString(), m.plan_item_id);
    }

    // 4. Clean up stale uncompleted sessions (started but never finished)
    const stale = db.prepare(`
      SELECT id FROM session_logs WHERE completed_at IS NULL
    `).all() as Array<{ id: number }>;
    for (const s of stale) {
      db.prepare('DELETE FROM session_exercise_feedback WHERE session_log_id = ?').run(s.id);
      db.prepare('DELETE FROM session_sets WHERE session_log_id = ?').run(s.id);
      db.prepare('DELETE FROM session_cardio WHERE session_log_id = ?').run(s.id);
      db.prepare('UPDATE daily_logs SET session_log_id = NULL WHERE session_log_id = ?').run(s.id);
      db.prepare('DELETE FROM session_logs WHERE id = ?').run(s.id);
    }
    if (stale.length > 0) {
      console.log(`[db] v4: deleted ${stale.length} stale uncompleted session(s)`);
    }

    if (mismatched.length > 0) {
      console.log(`[db] fix_session_dates_v4: processed ${mismatched.length} session(s)`);
    }
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('fix_session_dates_v4', ?)").run(new Date().toISOString());
  }

  // One-time fix: session 71 (Zone 2 Base + Grip) was created with UTC date 2026-04-03
  // but actually started at 01:00 CEST on 2026-04-04. Move it to the correct date.
  const fixTz = db.prepare("SELECT value FROM settings WHERE key = 'fix_session_71_tz'").get();
  if (!fixTz) {
    const s71 = db.prepare('SELECT id FROM session_logs WHERE id = 71').get();
    if (s71) {
      db.transaction(() => {
        // 1. Move session 71 to correct date
        db.prepare("UPDATE session_logs SET date = '2026-04-04' WHERE id = 71").run();

        // 2. Fix April 3: link to session 69, clear stale Zone 2 summary so debug POST regenerates it
        db.prepare("UPDATE daily_logs SET session_log_id = 69, workout_completed = 1, session_summary = NULL WHERE date = '2026-04-03'").run();

        // 3. Write Zone 2 data to April 4 daily_log
        db.prepare(`
          UPDATE daily_logs SET workout_completed = 1, session_log_id = 71, workout_plan_item_id = 145
          WHERE date = '2026-04-04'
        `).run();

        // 4. Mark plan_item 145 as completed
        db.prepare("UPDATE plan_items SET status = 'completed', completed = 1, completed_at = ? WHERE id = 145")
          .run(new Date().toISOString());

        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('fix_session_71_tz', ?)").run(new Date().toISOString());
      })();
      console.log('[db] fix_session_71_tz: moved session 71 from 2026-04-03 to 2026-04-04');
    } else {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('fix_session_71_tz', 'skipped')").run();
    }
  }

  // Fix: clear stale Zone 2 summary from April 3 so debug POST regenerates from session 69
  const fixSummary = db.prepare("SELECT value FROM settings WHERE key = 'fix_session_69_summary'").get();
  if (!fixSummary) {
    db.prepare("UPDATE daily_logs SET session_summary = NULL WHERE date = '2026-04-03' AND session_log_id = 69").run();
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('fix_session_69_summary', ?)").run(new Date().toISOString());
    console.log('[db] fix_session_69_summary: cleared stale summary for April 3');
  }
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
      baker_cyst_pain, pullup_count, perceived_readiness, plan_satisfaction, model_used,
      kitchen_cutoff_compliance, avg_energy, pain_days, sleep_disruption_count,
      avg_rpe, hard_exercise_count, week_reflection, next_week_conflicts,
      questions_for_coaches, sick_days, pain_areas_summary, sleep_disruption_breakdown
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    m.weekNumber, m.checkInDate, m.weightKg, m.bodyFatPct, m.muscleMassKg,
    m.avgSleepScore, m.avgTrainingReadiness, m.avgRhr, m.avgHrv,
    m.caloriesAvg, m.proteinAvg, m.hydrationTracked ? 1 : 0,
    m.vampireCompliancePct, m.rugProtocolDays, m.sessionsPlanned,
    m.sessionsCompleted, m.bakerCystPain, m.pullupCount, m.perceivedReadiness, m.planSatisfaction, m.modelUsed,
    m.kitchenCutoffCompliance ?? null, m.avgEnergy ?? null, m.painDays ?? null, m.sleepDisruptionCount ?? null,
    m.avgRpe ?? null, m.hardExerciseCount ?? null, m.weekReflection ?? null, m.nextWeekConflicts ?? null,
    m.questionsForCoaches ?? null, m.sickDays ?? null, m.painAreasSummary ?? null, m.sleepDisruptionBreakdown ?? null
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
    bakerCystPain: (r.baker_cyst_pain as number | null) ?? null,
    pullupCount: r.pullup_count as number | null,
    perceivedReadiness: r.perceived_readiness as number | null,
    planSatisfaction: r.plan_satisfaction as number | null,
    modelUsed: r.model_used as string,
    kitchenCutoffCompliance: r.kitchen_cutoff_compliance as number | null,
    avgEnergy: r.avg_energy as number | null,
    painDays: r.pain_days as number | null,
    sleepDisruptionCount: r.sleep_disruption_count as number | null,
    avgRpe: r.avg_rpe as number | null,
    hardExerciseCount: r.hard_exercise_count as number | null,
    weekReflection: r.week_reflection as string | null,
    nextWeekConflicts: r.next_week_conflicts as string | null,
    questionsForCoaches: r.questions_for_coaches as string | null,
    sickDays: r.sick_days as number | null,
    painAreasSummary: r.pain_areas_summary as string | null,
    sleepDisruptionBreakdown: r.sleep_disruption_breakdown as string | null,
  };
}

// Plan Items
export function insertPlanItems(items: PlanItem[]): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO plan_items (
      week_number, day_order, day, session_type, focus,
      starting_weight, workout_plan, coach_cues, athlete_notes,
      completed, completed_at, sequence_notes, sequence_group, assigned_date, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: PlanItem[]) => {
    for (const item of items) {
      stmt.run(
        item.weekNumber, item.dayOrder, item.day, item.sessionType,
        item.focus, item.startingWeight, item.workoutPlan, item.coachCues,
        item.athleteNotes, (item.status === 'completed' || item.completed) ? 1 : 0, item.completedAt,
        item.sequenceNotes || null, item.sequenceGroup || null,
        item.assignedDate || null, item.status || 'pending'
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
    completed: (r.status as string) === 'completed' || !!(r.completed),
    completedAt: r.completed_at as string | null,
    subTasks,
    sequenceOrder: r.day_order as number,
    sequenceNotes: (r.sequence_notes as string) || null,
    sequenceGroup: (r.sequence_group as string) || null,
    assignedDate: (r.assigned_date as string) || null,
    status: ((r.status as string) ?? 'pending') as 'pending' | 'scheduled' | 'completed' | 'skipped',
    synthesisNotes: (r.synthesis_notes as string) || null,
    estimatedDurationMin: (r.estimated_duration_min as number) || null,
    hasStructuredExercises: !!(r.has_structured_exercises),
  };
}

export function getSessionLogIdForPlanItem(planItemId: number): number | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT sl.id FROM session_logs sl
    JOIN daily_logs dl ON dl.session_log_id = sl.id
    WHERE dl.workout_plan_item_id = ?
    LIMIT 1
  `).get(planItemId) as { id: number } | undefined;
  return row?.id ?? null;
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
    WHERE p.week_number = ?
      AND p.status NOT IN ('completed', 'skipped')
      AND LOWER(p.session_type) NOT IN ('rest', 'rest day', 'family', 'family day', 'family time')
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
