import { getDb, getDailyLog, upsertDailyLog } from './db';
import { getTrainingWeek } from './week';
import { getWeekForDate, getDayName, getDayAbbrev } from './daily-log';
import type { ParsedExercise, PlanExercise, SessionSetState, SessionCardioState, ExerciseFeedback } from './types';
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

  // Check if a session already exists for this date+title OR same title in same week
  const existing = db.prepare(`
    SELECT id FROM session_logs WHERE date = ? AND session_title = ?
  `).get(date, sessionTitle) as { id: number } | undefined
    ?? db.prepare(`
    SELECT id FROM session_logs WHERE week_number = ? AND session_title = ?
  `).get(weekNumber, sessionTitle) as { id: number } | undefined;

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
     prescribed_weight_kg, prescribed_reps, prescribed_duration_s, completed, is_modified, exercise_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
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
          ex.type,
        );
      }
    }
  }

  return sessionId;
}

export function createSessionFromPlanExercises(
  date: string,
  sessionType: string,
  sessionTitle: string,
  planExercises: PlanExercise[],
  _db?: Database.Database,
): number {
  const db = _db ?? getDb();
  const weekNumber = getTrainingWeek();

  // Check if a session already exists for this date+title OR same title in same week
  const existing = db.prepare(`
    SELECT id FROM session_logs WHERE date = ? AND session_title = ?
  `).get(date, sessionTitle) as { id: number } | undefined
    ?? db.prepare(`
    SELECT id FROM session_logs WHERE week_number = ? AND session_title = ?
  `).get(weekNumber, sessionTitle) as { id: number } | undefined;

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
     prescribed_weight_kg, prescribed_reps, prescribed_duration_s, completed, is_modified,
     section, rest_seconds, coach_cue, plan_exercise_id, prescribed_reps_display, exercise_type, laterality)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCardio = db.prepare(`
    INSERT INTO session_cardio
    (session_log_id, exercise_name, cardio_type, prescribed_rounds,
     completed_rounds, prescribed_duration_min, target_intensity, completed,
     section, rest_seconds, coach_cue, plan_exercise_id,
     interval_work_seconds, interval_rest_seconds, exercise_order)
    VALUES (?, ?, ?, ?, 0, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const ex of planExercises) {
    if (ex.type === 'cardio_intervals' || ex.type === 'cardio_steady') {
      insertCardio.run(
        sessionId, ex.exerciseName,
        ex.type === 'cardio_intervals' ? 'intervals' : 'steady_state',
        ex.rounds,
        ex.durationSeconds ? ex.durationSeconds / 60 : null,
        ex.targetIntensity,
        ex.section, ex.restSeconds, ex.coachCue, ex.id ?? null,
        ex.intervalWorkSeconds, ex.intervalRestSeconds,
        ex.exerciseOrder,
      );
    } else {
      const numSets = ex.sets ?? 1;
      const repsNum = ex.reps != null ? parseInt(String(ex.reps), 10) : null;
      const repsDisplay = ex.reps != null ? String(ex.reps) : null;
      const supersetGroupInt = ex.supersetGroup
        ? ex.supersetGroup.charCodeAt(0) - 64 // A=1, B=2, C=3
        : null;

      for (let s = 1; s <= numSets; s++) {
        insertSet.run(
          sessionId, ex.exerciseName, ex.exerciseOrder, supersetGroupInt, s,
          ex.weightKg, isNaN(repsNum ?? NaN) ? null : repsNum,
          ex.durationSeconds,
          ex.section, ex.restSeconds, ex.coachCue, ex.id ?? null,
          repsDisplay, ex.type, ex.laterality ?? 'bilateral',
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
  const set = db.prepare('SELECT prescribed_weight_kg, prescribed_reps, prescribed_duration_s FROM session_sets WHERE id = ?').get(setId) as {
    prescribed_weight_kg: number | null;
    prescribed_reps: number | null;
    prescribed_duration_s: number | null;
  } | undefined;

  const isModified = set
    ? (actualWeightKg !== set.prescribed_weight_kg
      || actualReps !== set.prescribed_reps
      || (actualDurationS != null && actualDurationS !== set.prescribed_duration_s))
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
  roundData?: string | null,
  _db?: Database.Database,
): void {
  const db = _db ?? getDb();
  db.prepare(`
    UPDATE session_cardio SET completed_rounds = ?, completed = ?, actual_duration_min = ?, round_data = ? WHERE id = ?
  `).run(completedRounds, completed ? 1 : 0, actualDurationMin ?? null, roundData ?? null, cardioId);
}

export function getSessionSets(sessionId: number, _db?: Database.Database): SessionSetState[] {
  const db = _db ?? getDb();
  const rows = db.prepare(`
    SELECT id, exercise_name, exercise_order, superset_group, set_number,
           prescribed_weight_kg, prescribed_reps, prescribed_reps_display,
           actual_weight_kg, actual_reps,
           completed, is_modified, prescribed_duration_s, actual_duration_s,
           section, rest_seconds, coach_cue, plan_exercise_id, exercise_type, laterality
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
    section: r.section as string | null,
    restSeconds: r.rest_seconds as number | null,
    coachCue: r.coach_cue as string | null,
    planExerciseId: r.plan_exercise_id as number | null,
    prescribedRepsDisplay: r.prescribed_reps_display as string | null,
    exerciseType: (r.exercise_type as string | null) as import('./types').ExerciseType | null,
    laterality: (r.laterality as string | 'bilateral') as 'bilateral' | 'unilateral_each' | 'alternating',
  }));
}

export function getSessionCardio(sessionId: number, _db?: Database.Database): SessionCardioState[] {
  const db = _db ?? getDb();
  const rows = db.prepare(`
    SELECT id, exercise_name, cardio_type, prescribed_rounds, completed_rounds,
           prescribed_duration_min, target_intensity, completed, actual_duration_min,
           section, rest_seconds, coach_cue, plan_exercise_id,
           interval_work_seconds, interval_rest_seconds,
           COALESCE(exercise_order, id) AS exercise_order, round_data
    FROM session_cardio WHERE session_log_id = ? ORDER BY COALESCE(exercise_order, id), id
  `).all(sessionId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: r.id as number,
    exerciseName: r.exercise_name as string,
    exerciseOrder: r.exercise_order as number,
    cardioType: r.cardio_type as 'intervals' | 'steady_state',
    prescribedRounds: r.prescribed_rounds as number | null,
    completedRounds: r.completed_rounds as number,
    prescribedDurationMin: r.prescribed_duration_min as number | null,
    targetIntensity: r.target_intensity as string | null,
    completed: (r.completed as number) === 1,
    actualDurationMin: r.actual_duration_min as number | null,
    section: r.section as string | null,
    restSeconds: r.rest_seconds as number | null,
    coachCue: r.coach_cue as string | null,
    planExerciseId: r.plan_exercise_id as number | null,
    intervalWorkSeconds: r.interval_work_seconds as number | null,
    intervalRestSeconds: r.interval_rest_seconds as number | null,
    roundData: r.round_data as string | null,
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

    // Session counts as completed workout if compliance >= 50%
    const workoutCompleted = compliancePct >= 50 ? 1 : 0;

    const existingLog = getDailyLog(sessionRow.date, db);
    if (existingLog) {
      db.prepare(`
        UPDATE daily_logs SET workout_completed = ?, session_summary = ?, session_log_id = ? WHERE date = ?
      `).run(workoutCompleted, summaryText, sessionId, sessionRow.date);
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
        workout_completed: workoutCompleted,
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
  notes?: string | null,
  planExerciseId?: number | null,
  _db?: Database.Database,
): void {
  const db = _db ?? getDb();
  db.prepare(`
    INSERT INTO session_exercise_feedback (session_log_id, exercise_name, exercise_order, rpe, notes, plan_exercise_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(session_log_id, exercise_name) DO UPDATE SET rpe = ?, notes = ?, plan_exercise_id = COALESCE(?, plan_exercise_id), created_at = datetime('now')
  `).run(sessionLogId, exerciseName, exerciseOrder, rpe, notes ?? null, planExerciseId ?? null, rpe, notes ?? null, planExerciseId ?? null);
}

export function getExerciseFeedback(sessionLogId: number, _db?: Database.Database): ExerciseFeedback[] {
  const db = _db ?? getDb();
  const rows = db.prepare(`
    SELECT id, session_log_id, exercise_name, exercise_order, rpe, notes, plan_exercise_id, created_at
    FROM session_exercise_feedback WHERE session_log_id = ? ORDER BY exercise_order
  `).all(sessionLogId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: r.id as number,
    sessionLogId: r.session_log_id as number,
    exerciseName: r.exercise_name as string,
    exerciseOrder: r.exercise_order as number,
    rpe: r.rpe as number,
    notes: r.notes as string | null,
    planExerciseId: r.plan_exercise_id as number | null,
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

export function getExistingWeekSession(
  weekNumber: number,
  sessionTitle: string,
  _db?: Database.Database,
): { id: number; date: string; completed: boolean } | null {
  const db = _db ?? getDb();
  const row = db.prepare(`
    SELECT id, date, completed_at FROM session_logs
    WHERE week_number = ? AND session_title = ?
    ORDER BY completed_at DESC NULLS FIRST LIMIT 1
  `).get(weekNumber, sessionTitle) as { id: number; date: string; completed_at: string | null } | undefined;
  return row ? { id: row.id, date: row.date, completed: !!row.completed_at } : null;
}

export function getWeekSessionIds(weekNumber: number, _db?: Database.Database): number[] {
  const db = _db ?? getDb();
  const rows = db.prepare(`
    SELECT id FROM session_logs WHERE week_number = ? AND completed_at IS NOT NULL ORDER BY date
  `).all(weekNumber) as Array<{ id: number }>;
  return rows.map((r) => r.id);
}

export function getWeekSessions(weekNumber: number): Array<{
  sessionLogId: number;
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
    sessionLogId: s.id as number,
    date: s.date as string,
    sessionTitle: s.session_title as string,
    sessionType: s.session_type as string,
    compliancePct: s.compliance_pct as number | null,
    sets: getSessionSets(s.id as number),
    cardio: getSessionCardio(s.id as number),
  }));
}

export function getCompletedSession(sessionLogId: number, _db?: Database.Database): {
  sessionLogId: number;
  date: string;
  weekNumber: number;
  sessionType: string;
  sessionTitle: string;
  notes: string | null;
  compliancePct: number | null;
  sets: SessionSetState[];
  cardio: SessionCardioState[];
  feedback: ExerciseFeedback[];
} | null {
  const db = _db ?? getDb();
  const row = db.prepare(`
    SELECT id, date, week_number, session_type, session_title, notes, compliance_pct
    FROM session_logs WHERE id = ? AND completed_at IS NOT NULL
  `).get(sessionLogId) as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    sessionLogId: row.id as number,
    date: row.date as string,
    weekNumber: row.week_number as number,
    sessionType: row.session_type as string,
    sessionTitle: row.session_title as string,
    notes: row.notes as string | null,
    compliancePct: row.compliance_pct as number | null,
    sets: getSessionSets(sessionLogId, db),
    cardio: getSessionCardio(sessionLogId, db),
    feedback: getExerciseFeedback(sessionLogId, db),
  };
}

export function batchUpdateSets(
  updates: Array<{ id: number; actualWeightKg: number | null; actualReps: number | null; actualDurationS: number | null }>,
  _db?: Database.Database,
): void {
  const db = _db ?? getDb();
  const stmt = db.prepare(`
    UPDATE session_sets
    SET actual_weight_kg = ?, actual_reps = ?, actual_duration_s = ?,
        is_modified = CASE WHEN (? != prescribed_weight_kg OR ? != prescribed_reps) THEN 1 ELSE 0 END
    WHERE id = ?
  `);
  const updateAll = db.transaction((rows: typeof updates) => {
    for (const r of rows) {
      stmt.run(r.actualWeightKg, r.actualReps, r.actualDurationS, r.actualWeightKg, r.actualReps, r.id);
    }
  });
  updateAll(updates);
}

export function batchUpdateCardio(
  updates: Array<{ id: number; completedRounds: number; actualDurationMin: number | null }>,
  _db?: Database.Database,
): void {
  const db = _db ?? getDb();
  const stmt = db.prepare(`
    UPDATE session_cardio SET completed_rounds = ?, actual_duration_min = ? WHERE id = ?
  `);
  const updateAll = db.transaction((rows: typeof updates) => {
    for (const r of rows) {
      stmt.run(r.completedRounds, r.actualDurationMin, r.id);
    }
  });
  updateAll(updates);
}

export function regenerateSessionSummary(sessionLogId: number, notes: string, _db?: Database.Database): void {
  const db = _db ?? getDb();
  const sets = getSessionSets(sessionLogId, db);
  const cardio = getSessionCardio(sessionLogId, db);
  const feedback = getExerciseFeedback(sessionLogId, db);

  const totalSets = sets.length;
  const completedSets = sets.filter((s) => s.completed).length;
  const totalCardio = cardio.length;
  const completedCardio = cardio.filter((c) => c.completed).length;
  const total = totalSets + totalCardio;
  const done = completedSets + completedCardio;
  const compliancePct = total > 0 ? Math.round((done / total) * 100) : 0;

  const weightChanges = sets
    .filter((s) => s.isModified && s.actualWeightKg !== s.prescribedWeightKg)
    .map((s) => ({ exercise: s.exerciseName, set: s.setNumber, from: s.prescribedWeightKg, to: s.actualWeightKg }));

  db.prepare(`UPDATE session_logs SET notes = ?, compliance_pct = ? WHERE id = ?`)
    .run(notes, compliancePct, sessionLogId);

  const sessionRow = db.prepare('SELECT session_title, date FROM session_logs WHERE id = ?')
    .get(sessionLogId) as { session_title: string; date: string } | undefined;

  if (sessionRow) {
    const summaryText = generateSessionSummary(
      sessionRow.session_title,
      compliancePct,
      sets,
      cardio,
      weightChanges,
      feedback,
    );
    db.prepare(`UPDATE daily_logs SET session_summary = ? WHERE session_log_id = ?`)
      .run(summaryText, sessionLogId);
  }
}
