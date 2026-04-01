import { describe, it, expect } from 'vitest';
import { WeekPlanSchema, SessionPlanSchema, ExerciseItemSchema } from '../lib/plan-schema';

describe('plan-schema', () => {
  const validExercise = {
    order: 0,
    exerciseName: 'Barbell Row',
    supersetGroup: 'A',
    type: 'strength',
    sets: 3,
    reps: 8,
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
  };

  const validSession = {
    dayOrder: 1,
    suggestedDay: 'Monday',
    sessionType: 'upper_pull',
    focus: 'Upper Pull — Heavy Row + Pull-Up Progression',
    estimatedDurationMin: 55,
    sections: [
      {
        section: 'warm_up',
        exercises: [{ ...validExercise, order: 0, exerciseName: 'Bike', type: 'cardio_steady', supersetGroup: null, sets: 1, reps: null, weightKg: null, durationSeconds: 300, restSeconds: null, coachCue: null }],
      },
      {
        section: 'main_work',
        exercises: [validExercise],
      },
    ],
    sequenceOrder: 1,
    sequenceGroup: 'upper_compound',
    sequenceNotes: 'not within 24h of Upper Push',
    coachNotes: 'Grip focus today.',
  };

  const validWeekPlan = {
    weekNumber: 14,
    phaseId: 'reconstruction',
    sessions: [validSession],
    sequencingRules: [{ sessionOrder: 1, group: 'upper_compound', note: 'not within 24h of Upper Push' }],
    synthesisNotes: 'Recovery overrode Strength on Thursday — readiness was 32.',
  };

  it('validates a correct ExerciseItem', () => {
    const result = ExerciseItemSchema.safeParse(validExercise);
    expect(result.success).toBe(true);
  });

  it('rejects exercise with invalid type', () => {
    const result = ExerciseItemSchema.safeParse({ ...validExercise, type: 'swimming' });
    expect(result.success).toBe(false);
  });

  it('accepts string reps like "8-10" and "AMRAP"', () => {
    expect(ExerciseItemSchema.safeParse({ ...validExercise, reps: '8-10' }).success).toBe(true);
    expect(ExerciseItemSchema.safeParse({ ...validExercise, reps: 'AMRAP' }).success).toBe(true);
  });

  it('validates a correct SessionPlan', () => {
    const result = SessionPlanSchema.safeParse(validSession);
    expect(result.success).toBe(true);
  });

  it('rejects session with invalid section name', () => {
    const bad = { ...validSession, sections: [{ section: 'stretching', exercises: [] }] };
    const result = SessionPlanSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('validates a correct WeekPlan', () => {
    const result = WeekPlanSchema.safeParse(validWeekPlan);
    expect(result.success).toBe(true);
  });

  it('rejects week plan with no sessions', () => {
    const result = WeekPlanSchema.safeParse({ ...validWeekPlan, sessions: [] });
    expect(result.success).toBe(false);
  });
});
