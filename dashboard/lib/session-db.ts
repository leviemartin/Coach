import { getDb } from './db';
import { getTrainingWeek } from './week';
import type { ParsedExercise, SessionSetState, SessionCardioState } from './types';

export function createSession(
  date: string,
  sessionType: string,
  sessionTitle: string,
  exercises: ParsedExercise[],
): number {
  const db = getDb();
  const weekNumber = getTrainingWeek();

  // Check if a session already exists for this date+title (avoid FK-breaking REPLACE)
  const existing = db.prepare(`
    SELECT id FROM session_logs WHERE date = ? AND session_title = ?
  `).get(date, sessionTitle) as { id: number } | undefined;

  let sessionId: number;
  if (existing) {
    sessionId = existing.id;
  } else {
    const insert = db.prepare(`
      INSERT INTO session_logs (date, week_number, session_type, session_title, started_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = insert.run(date, weekNumber, sessionType, sessionTitle, new Date().toISOString());
    sessionId = Number(result.lastInsertRowid);
  }

  db.prepare('DELETE FROM session_sets WHERE session_log_id = ?').run(sessionId);
  db.prepare('DELETE FROM session_cardio WHERE session_log_id = ?').run(sessionId);

  const insertSet = db.prepare(`
    INSERT INTO session_sets
    (session_log_id, exercise_name, exercise_order, superset_group, set_number,
     prescribed_weight_kg, prescribed_reps, completed, is_modified)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
  `);

  const insertCardio = db.prepare(`
    INSERT INTO session_cardio
    (session_log_id, exercise_name, cardio_type, prescribed_rounds,
     completed_rounds, prescribed_duration_min, target_intensity, completed)
    VALUES (?, ?, ?, ?, 0, ?, ?, 0)
  `);

  for (const ex of exercises) {
    if (ex.type === 'cardio_intervals' || ex.type === 'cardio_steady') {
      insertCardio.run(
        sessionId,
        ex.canonicalName,
        ex.type === 'cardio_intervals' ? 'intervals' : 'steady_state',
        ex.rounds,
        ex.durationSeconds ? ex.durationSeconds / 60 : null,
        ex.targetIntensity,
      );
    } else {
      for (let s = 1; s <= ex.sets; s++) {
        insertSet.run(
          sessionId,
          ex.canonicalName,
          ex.order,
          ex.supersetGroup,
          s,
          ex.weightKg,
          ex.reps,
        );
      }
    }
  }

  return sessionId;
}

export function updateSet(
  setId: number,
  actualWeightKg: number | null,
  actualReps: number | null,
  completed: boolean,
): void {
  const db = getDb();
  const set = db.prepare('SELECT prescribed_weight_kg, prescribed_reps FROM session_sets WHERE id = ?').get(setId) as {
    prescribed_weight_kg: number | null;
    prescribed_reps: number | null;
  } | undefined;

  const isModified = set
    ? (actualWeightKg !== set.prescribed_weight_kg || actualReps !== set.prescribed_reps)
    : false;

  db.prepare(`
    UPDATE session_sets
    SET actual_weight_kg = ?, actual_reps = ?, completed = ?, is_modified = ?
    WHERE id = ?
  `).run(actualWeightKg, actualReps, completed ? 1 : 0, isModified ? 1 : 0, setId);
}

export function updateCardioRound(cardioId: number, completedRounds: number, completed: boolean): void {
  const db = getDb();
  db.prepare(`
    UPDATE session_cardio SET completed_rounds = ?, completed = ? WHERE id = ?
  `).run(completedRounds, completed ? 1 : 0, cardioId);
}

export function getSessionSets(sessionId: number): SessionSetState[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, exercise_name, exercise_order, superset_group, set_number,
           prescribed_weight_kg, prescribed_reps, actual_weight_kg, actual_reps,
           completed, is_modified
    FROM session_sets WHERE session_log_id = ? ORDER BY exercise_order, set_number
  `).all(sessionId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: r.id as number,
    exerciseName: r.exercise_name as string,
    exerciseOrder: r.exercise_order as number,
    supersetGroup: r.superset_group as number | null,
    setNumber: r.set_number as number,
    prescribedWeightKg: r.prescribed_weight_kg as number | null,
    prescribedReps: r.prescribed_reps as number | null,
    actualWeightKg: r.actual_weight_kg as number | null,
    actualReps: r.actual_reps as number | null,
    completed: (r.completed as number) === 1,
    isModified: (r.is_modified as number) === 1,
  }));
}

export function getSessionCardio(sessionId: number): SessionCardioState[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, exercise_name, cardio_type, prescribed_rounds, completed_rounds,
           prescribed_duration_min, target_intensity, completed
    FROM session_cardio WHERE session_log_id = ? ORDER BY id
  `).all(sessionId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: r.id as number,
    exerciseName: r.exercise_name as string,
    cardioType: r.cardio_type as 'intervals' | 'steady_state',
    prescribedRounds: r.prescribed_rounds as number | null,
    completedRounds: r.completed_rounds as number,
    prescribedDurationMin: r.prescribed_duration_min as number | null,
    targetIntensity: r.target_intensity as string | null,
    completed: (r.completed as number) === 1,
  }));
}

export function completeSession(sessionId: number, notes: string): {
  compliancePct: number;
  weightChanges: Array<{ exercise: string; set: number; from: number | null; to: number | null }>;
} {
  const db = getDb();
  const sets = getSessionSets(sessionId);
  const cardio = getSessionCardio(sessionId);

  const totalSets = sets.length;
  const completedSets = sets.filter((s) => s.completed).length;
  const totalCardio = cardio.length;
  const completedCardio = cardio.filter((c) => c.completed).length;
  const total = totalSets + totalCardio;
  const done = completedSets + completedCardio;
  const compliancePct = total > 0 ? Math.round((done / total) * 100) : 0;

  const weightChanges = sets
    .filter((s) => s.isModified && s.actualWeightKg !== s.prescribedWeightKg)
    .map((s) => ({
      exercise: s.exerciseName,
      set: s.setNumber,
      from: s.prescribedWeightKg,
      to: s.actualWeightKg,
    }));

  db.prepare(`
    UPDATE session_logs SET completed_at = ?, notes = ?, compliance_pct = ? WHERE id = ?
  `).run(new Date().toISOString(), notes, compliancePct, sessionId);

  const session = db.prepare('SELECT date FROM session_logs WHERE id = ?').get(sessionId) as { date: string } | undefined;
  if (session) {
    db.prepare(`
      UPDATE daily_logs SET workout_completed = 1 WHERE date = ?
    `).run(session.date);
  }

  return { compliancePct, weightChanges };
}

export function getActiveSession(date: string, sessionTitle?: string): { id: number; sessionTitle: string } | null {
  const db = getDb();
  let row: { id: number; session_title: string } | undefined;

  if (sessionTitle) {
    row = db.prepare(`
      SELECT id, session_title FROM session_logs
      WHERE date = ? AND session_title = ? AND completed_at IS NULL
      ORDER BY started_at DESC LIMIT 1
    `).get(date, sessionTitle) as typeof row;
  } else {
    row = db.prepare(`
      SELECT id, session_title FROM session_logs
      WHERE date = ? AND completed_at IS NULL
      ORDER BY started_at DESC LIMIT 1
    `).get(date) as typeof row;
  }

  return row ? { id: row.id, sessionTitle: row.session_title } : null;
}

export function getWeekSessions(weekNumber: number): Array<{
  date: string;
  sessionTitle: string;
  sessionType: string;
  compliancePct: number | null;
  sets: SessionSetState[];
  cardio: SessionCardioState[];
}> {
  const db = getDb();
  const sessions = db.prepare(`
    SELECT id, date, session_title, session_type, compliance_pct
    FROM session_logs WHERE week_number = ? AND completed_at IS NOT NULL
    ORDER BY date
  `).all(weekNumber) as Array<Record<string, unknown>>;

  return sessions.map((s) => ({
    date: s.date as string,
    sessionTitle: s.session_title as string,
    sessionType: s.session_type as string,
    compliancePct: s.compliance_pct as number | null,
    sets: getSessionSets(s.id as number),
    cardio: getSessionCardio(s.id as number),
  }));
}
