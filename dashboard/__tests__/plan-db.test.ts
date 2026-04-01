import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../lib/db';
import {
  insertPlanExercises,
  getPlanExercises,
  deletePlanExercises,
} from '../lib/plan-db';
import type { PlanExercise } from '../lib/types';

describe('plan-db', () => {
  let planItemId: number;

  beforeEach(() => {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO plan_items (week_number, day_order, day, session_type, focus, has_structured_exercises)
      VALUES (14, 1, 'Monday', 'upper_pull', 'Upper Pull — Heavy Row', 1)
    `).run();
    planItemId = Number(result.lastInsertRowid);
  });

  const makeExercises = (parentId: number): PlanExercise[] => [
    {
      planItemId: parentId,
      section: 'warm_up',
      exerciseOrder: 0,
      exerciseName: 'Bike',
      supersetGroup: null,
      type: 'cardio_steady',
      sets: 1,
      reps: null,
      weightKg: null,
      durationSeconds: 300,
      restSeconds: null,
      tempo: null,
      laterality: 'bilateral',
      coachCue: null,
      rounds: null,
      targetIntensity: 'Zone 2',
      intervalWorkSeconds: null,
      intervalRestSeconds: null,
    },
    {
      planItemId: parentId,
      section: 'main_work',
      exerciseOrder: 1,
      exerciseName: 'Barbell Row',
      supersetGroup: 'A',
      type: 'strength',
      sets: 3,
      reps: '8',
      weightKg: 60,
      durationSeconds: null,
      restSeconds: 90,
      tempo: null,
      laterality: 'bilateral',
      coachCue: 'Chest to bar',
      rounds: null,
      targetIntensity: null,
      intervalWorkSeconds: null,
      intervalRestSeconds: null,
    },
    {
      planItemId: parentId,
      section: 'main_work',
      exerciseOrder: 2,
      exerciseName: 'Face Pull',
      supersetGroup: 'A',
      type: 'strength',
      sets: 3,
      reps: '15',
      weightKg: 12.5,
      durationSeconds: null,
      restSeconds: 90,
      tempo: null,
      laterality: 'bilateral',
      coachCue: null,
      rounds: null,
      targetIntensity: null,
      intervalWorkSeconds: null,
      intervalRestSeconds: null,
    },
  ];

  it('inserts and retrieves plan exercises', () => {
    const exercises = makeExercises(planItemId);
    insertPlanExercises(exercises);

    const result = getPlanExercises(planItemId);
    expect(result).toHaveLength(3);
    expect(result[0].exerciseName).toBe('Bike');
    expect(result[0].section).toBe('warm_up');
    expect(result[1].exerciseName).toBe('Barbell Row');
    expect(result[1].supersetGroup).toBe('A');
    expect(result[1].weightKg).toBe(60);
    expect(result[1].coachCue).toBe('Chest to bar');
    expect(result[2].supersetGroup).toBe('A');
  });

  it('deletes plan exercises for a plan item', () => {
    insertPlanExercises(makeExercises(planItemId));
    expect(getPlanExercises(planItemId)).toHaveLength(3);

    deletePlanExercises(planItemId);
    expect(getPlanExercises(planItemId)).toHaveLength(0);
  });

  it('cascades delete when plan_item is deleted', () => {
    insertPlanExercises(makeExercises(planItemId));
    const db = getDb();
    db.prepare('DELETE FROM plan_items WHERE id = ?').run(planItemId);
    expect(getPlanExercises(planItemId)).toHaveLength(0);
  });
});
