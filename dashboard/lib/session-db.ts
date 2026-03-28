import { getDb, getDailyLog, upsertDailyLog } from './db';
import { getTrainingWeek } from './week';
import { getWeekForDate, getDayName, getDayAbbrev } from './daily-log';
import type { ParsedExercise, SessionSetState, SessionCardioState, ExerciseFeedback } from './types';
import type Database from 'better-sqlite3';

export function createSession(
  date: string,
  sessionType: string,
  sessionTitle: string,
  exercises: ParsedExercise[],
  _db?: Database.Database,
): number {
  const db = _db ?? getDb();
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
     prescribed_weight_kg, prescribed_reps, prescribed_duration_s, completed, is_modified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
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
          ex.durationSeconds,
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
  actualDurationS?: number | null,
  _db?: Database.Database,
): void {
  const db = _db ?? getDb();
  const set = db.prepare('SELECT prescribed_weight_kg, prescribed_reps FROM session_sets WHERE id = ?').get(setId) as {
    prescribed_weight_kg: number | null;
    prescribed_reps: number | null;
  } | undefined;

  const isModified = set
    ? (actualWeightKg !== set.prescribed_weight_kg || actualReps !== set.prescribed_reps)
    : false;

  db.prepare(`
    UPDATE session_sets
    SET actual_weight_kg = ?, actual_reps = ?, completed = ?, is_modified = ?, actual_duration_s = ?
    WHERE id = ?
  `).run(actualWeightKg, actualReps, completed ? 1 : 0, isModified ? 1 : 0, actualDurationS ?? null, setId);
}

export function updateCardioRound(
  cardioId: number,
  completedRounds: number,
  completed: boolean,
  actualDurationMin?: number | null,
  _db?: Database.Database,
): void {
  const db = _db ?? getDb();
  db.prepare(`
    UPDATE session_cardio SET completed_rounds = ?, completed = ?, actual_duration_min = ? WHERE id = ?
  `).run(completedRounds, completed ? 1 : 0, actualDurationMin ?? null, cardioId);
}

export function getSessionSets(sessionId: number, _db?: Database.Database): SessionSetState[] {
  const db = _db ?? getDb();
  const rows = db.prepare(`
    SELECT id, exercise_name, exercise_order, superset_group, set_number,
           prescribed_weight_kg, prescribed_reps, actual_weight_kg, actual_reps,
           completed, is_modified, prescribed_duration_s, actual_duration_s
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
    prescribedDurationS: r.prescribed_duration_s as number | null,
    actualDurationS: r.actual_duration_s as number | null,
  }));
}

export function getSessionCardio(sessionId: number, _db?: Database.Database): SessionCardioState[] {
  const db = _db ?? getDb();
  const rows = db.prepare(`
    SELECT id, exercise_name, cardio_type, prescribed_rounds, completed_rounds,
           prescribed_duration_min, target_intensity, completed, actual_duration_min
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
    actualDurationMin: r.actual_duration_min as number | null,
  }));
}

/** Generate a human-readable session summary from sets and cardio data. */
export function generateSessionSummary(
  sessionTitle: string,
  compliancePct: number,
  sets: SessionSetState[],
  cardio: SessionCardioState[],
  weightChanges: Array<{ exercise: string; set: number; from: number | null; to: number | null }>,
  feedback?: ExerciseFeedback[],
): string {
  const lines: string[] = [];

  lines.push(`${sessionTitle} (${compliancePct}% compliance)`);

  // Group sets by exercise name
  const exerciseMap = new Map<string, SessionSetState[]>();
  for (const s of sets) {
    const group = exerciseMap.get(s.exerciseName) ?? [];
    group.push(s);
    exerciseMap.set(s.exerciseName, group);
  }

  const rpeLabels = ['', 'Too Easy', 'Easy', 'Right', 'Hard', 'Too Hard'];

  for (const [name, exSets] of exerciseMap) {
    const totalSets = exSets.length;
    const completedSets = exSets.filter((s) => s.completed).length;
    const firstCompleted = exSets.find((s) => s.completed);
    const prescribed = exSets[0];

    if (completedSets === 0) {
      lines.push(`- ${name}: 0/${totalSets} sets done`);
    } else if (completedSets < totalSets) {
      lines.push(`- ${name}: ${completedSets}/${totalSets} sets done`);
    } else {
      // All sets completed — show representative set
      const reps = firstCompleted?.actualReps ?? prescribed.prescribedReps;
      const weight = firstCompleted?.actualWeightKg ?? prescribed.prescribedWeightKg;
      const weightStr = weight != null ? ` @ ${weight}kg` : '';
      const repsStr = reps != null ? `${totalSets}x${reps}` : `${totalSets} sets`;

      // Check if weight was changed vs prescribed
      const prescribedWeight = prescribed.prescribedWeightKg;
      const actualWeight = firstCompleted?.actualWeightKg ?? null;
      const weightNote =
        actualWeight != null && prescribedWeight != null && actualWeight !== prescribedWeight
          ? ` (prescribed ${prescribedWeight}kg)`
          : '';

      lines.push(`- ${name}: ${repsStr}${weightStr} ✓${weightNote}`);
    }

    // RPE and duration annotations (for any exercise with at least one completed set)
    if (completedSets > 0) {
      const rpe = feedback?.find((f) => f.exerciseName === name);
      if (rpe) {
        lines.push(`  RPE: ${rpe.rpe}/5 (${rpeLabels[rpe.rpe]})`);
      }

      const timedSets = exSets.filter((s) => s.prescribedDurationS != null && s.actualDurationS != null && s.actualDurationS !== s.prescribedDurationS);
      if (timedSets.length > 0) {
        const first = timedSets[0];
        lines.push(`  Duration: ${first.prescribedDurationS}s → ${first.actualDurationS}s`);
      }
    }
  }

  // Cardio exercises
  for (const c of cardio) {
    if (c.completed) {
      lines.push(`- ${c.exerciseName}: ${c.completedRounds}/${c.prescribedRounds ?? '?'} rounds ✓`);
    } else {
      lines.push(`- ${c.exerciseName}: ${c.completedRounds}/${c.prescribedRounds ?? '?'} rounds done`);
    }
    // Duration change for cardio
    if (c.actualDurationMin != null && c.prescribedDurationMin != null && c.actualDurationMin !== c.prescribedDurationMin) {
      lines.push(`  Duration: ${c.prescribedDurationMin}min → ${c.actualDurationMin}min`);
    }
    // RPE for cardio
    const cardioRpe = feedback?.find((f) => f.exerciseName === c.exerciseName);
    if (cardioRpe) {
      lines.push(`  RPE: ${cardioRpe.rpe}/5 (${rpeLabels[cardioRpe.rpe]})`);
    }
  }

  // Weight changes section
  if (weightChanges.length > 0) {
    // Deduplicate by exercise name, keep only distinct changes
    const seen = new Set<string>();
    const changeLines: string[] = [];
    for (const wc of weightChanges) {
      const key = `${wc.exercise}:${wc.from}->${wc.to}`;
      if (!seen.has(key)) {
        seen.add(key);
        const direction = (wc.to ?? 0) > (wc.from ?? 0) ? '+' : '';
        const delta = wc.to != null && wc.from != null ? `${direction}${+(wc.to - wc.from).toFixed(2)}kg` : 'changed';
        changeLines.push(`${wc.exercise} ${delta}`);
      }
    }
    if (changeLines.length > 0) {
      lines.push(`Weight changes: ${changeLines.join(', ')}`);
    }
  }

  return lines.join('\n');
}

export function completeSession(sessionId: number, notes: string, _db?: Database.Database): {
  compliancePct: number;
  weightChanges: Array<{ exercise: string; set: number; from: number | null; to: number | null }>;
} {
  const db = _db ?? getDb();
  const sets = getSessionSets(sessionId, db);
  const cardio = getSessionCardio(sessionId, db);

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

  const sessionRow = db.prepare('SELECT date, session_title FROM session_logs WHERE id = ?').get(sessionId) as {
    date: string;
    session_title: string;
  } | undefined;

  if (sessionRow) {
    const feedback = getExerciseFeedback(sessionId, db);
    const summaryText = generateSessionSummary(
      sessionRow.session_title,
      compliancePct,
      sets,
      cardio,
      weightChanges,
      feedback,
    );

    const existingLog = getDailyLog(sessionRow.date, db);
    if (existingLog) {
      db.prepare(`
        UPDATE daily_logs SET workout_completed = 1, session_summary = ?, session_log_id = ? WHERE date = ?
      `).run(summaryText, sessionId, sessionRow.date);
    } else {
      // Find the plan item for this date using the same DB handle (important for tests)
      const weekNum = getWeekForDate(sessionRow.date);
      const dayName = getDayName(sessionRow.date);
      const dayAbbrev = getDayAbbrev(sessionRow.date);
      const planRow = db.prepare(
        `SELECT id FROM plan_items WHERE week_number = ? AND assigned_date = ?`
      ).get(weekNum, sessionRow.date) as { id: number } | undefined
        ?? db.prepare(
          `SELECT id FROM plan_items WHERE week_number = ? AND assigned_date IS NULL AND (day = ? OR day LIKE ? || '%')`
        ).get(weekNum, dayName, dayAbbrev) as { id: number } | undefined;

      upsertDailyLog({
        date: sessionRow.date,
        week_number: weekNum,
        workout_completed: 1,
        workout_plan_item_id: planRow?.id ?? null,
        core_work_done: 0,
        rug_protocol_done: 0,
        vampire_bedtime: null,
        hydration_tracked: 0,
        kitchen_cutoff_hit: 0,
        is_sick_day: 0,
        notes: null,
        energy_level: null,
        pain_level: null,
        pain_area: null,
        sleep_disruption: null,
        session_summary: summaryText,
        session_log_id: sessionId,
      }, db);
    }

    // Update plan_items status to 'completed' if linked via daily_log
    const latestLog = getDailyLog(sessionRow.date, db);
    if (latestLog?.workout_plan_item_id) {
      db.prepare("UPDATE plan_items SET status = 'completed', completed = 1, completed_at = ? WHERE id = ?")
        .run(new Date().toISOString(), latestLog.workout_plan_item_id);
    }
  }

  return { compliancePct, weightChanges };
}

export function deleteSession(sessionId: number): void {
  const db = getDb();
  db.prepare('DELETE FROM session_exercise_feedback WHERE session_log_id = ?').run(sessionId);
  db.prepare('DELETE FROM session_sets WHERE session_log_id = ?').run(sessionId);
  db.prepare('DELETE FROM session_cardio WHERE session_log_id = ?').run(sessionId);
  db.prepare('DELETE FROM session_logs WHERE id = ?').run(sessionId);
}

export function upsertExerciseFeedback(
  sessionLogId: number,
  exerciseName: string,
  exerciseOrder: number,
  rpe: number,
  _db?: Database.Database,
): void {
  const db = _db ?? getDb();
  db.prepare(`
    INSERT INTO session_exercise_feedback (session_log_id, exercise_name, exercise_order, rpe, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(session_log_id, exercise_name) DO UPDATE SET rpe = ?, created_at = datetime('now')
  `).run(sessionLogId, exerciseName, exerciseOrder, rpe, rpe);
}

export function getExerciseFeedback(sessionLogId: number, _db?: Database.Database): ExerciseFeedback[] {
  const db = _db ?? getDb();
  const rows = db.prepare(`
    SELECT id, session_log_id, exercise_name, exercise_order, rpe, created_at
    FROM session_exercise_feedback WHERE session_log_id = ? ORDER BY exercise_order
  `).all(sessionLogId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: r.id as number,
    sessionLogId: r.session_log_id as number,
    exerciseName: r.exercise_name as string,
    exerciseOrder: r.exercise_order as number,
    rpe: r.rpe as number,
    createdAt: r.created_at as string,
  }));
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

export function getWeekSessionIds(weekNumber: number, _db?: Database.Database): number[] {
  const db = _db ?? getDb();
  const rows = db.prepare(`
    SELECT id FROM session_logs WHERE week_number = ? AND completed_at IS NOT NULL ORDER BY date
  `).all(weekNumber) as Array<{ id: number }>;
  return rows.map((r) => r.id);
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
