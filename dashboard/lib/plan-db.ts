import { getDb } from './db';
import type { PlanExercise } from './types';
import type Database from 'better-sqlite3';

export function insertPlanExercises(exercises: PlanExercise[], _db?: Database.Database): void {
  const db = _db ?? getDb();
  const stmt = db.prepare(`
    INSERT INTO plan_exercises (
      plan_item_id, section, exercise_order, exercise_name, superset_group,
      type, sets, reps, weight_kg, duration_seconds, rest_seconds, tempo,
      laterality, coach_cue, rounds, target_intensity,
      interval_work_seconds, interval_rest_seconds
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction((rows: PlanExercise[]) => {
    for (const ex of rows) {
      stmt.run(
        ex.planItemId, ex.section, ex.exerciseOrder, ex.exerciseName, ex.supersetGroup,
        ex.type, ex.sets, ex.reps, ex.weightKg, ex.durationSeconds, ex.restSeconds, ex.tempo,
        ex.laterality, ex.coachCue, ex.rounds, ex.targetIntensity,
        ex.intervalWorkSeconds, ex.intervalRestSeconds,
      );
    }
  });
  insertAll(exercises);
}

export function getPlanExercises(planItemId: number, _db?: Database.Database): PlanExercise[] {
  const db = _db ?? getDb();
  const rows = db.prepare(
    'SELECT * FROM plan_exercises WHERE plan_item_id = ? ORDER BY exercise_order ASC'
  ).all(planItemId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: r.id as number,
    planItemId: r.plan_item_id as number,
    section: r.section as PlanExercise['section'],
    exerciseOrder: r.exercise_order as number,
    exerciseName: r.exercise_name as string,
    supersetGroup: r.superset_group as string | null,
    type: r.type as PlanExercise['type'],
    sets: r.sets as number | null,
    reps: r.reps as string | null,
    weightKg: r.weight_kg as number | null,
    durationSeconds: r.duration_seconds as number | null,
    restSeconds: r.rest_seconds as number | null,
    tempo: r.tempo as string | null,
    laterality: (r.laterality as PlanExercise['laterality']) ?? 'bilateral',
    coachCue: r.coach_cue as string | null,
    rounds: r.rounds as number | null,
    targetIntensity: r.target_intensity as string | null,
    intervalWorkSeconds: r.interval_work_seconds as number | null,
    intervalRestSeconds: r.interval_rest_seconds as number | null,
  }));
}

export function deletePlanExercises(planItemId: number, _db?: Database.Database): void {
  const db = _db ?? getDb();
  db.prepare('DELETE FROM plan_exercises WHERE plan_item_id = ?').run(planItemId);
}
