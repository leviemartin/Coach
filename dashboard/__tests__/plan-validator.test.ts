import { describe, it, expect } from 'vitest';
import { validatePlanRules, type PlanViolation } from '../lib/plan-validator';
import type { WeekPlan, SessionPlan, ExerciseItem } from '../lib/plan-schema';

function makeExercise(overrides: Partial<ExerciseItem> = {}): ExerciseItem {
  return {
    order: 0, exerciseName: 'Test Exercise', supersetGroup: null,
    type: 'strength', sets: 3, reps: 8, weightKg: 50,
    durationSeconds: null, restSeconds: 90, tempo: null,
    laterality: 'bilateral', coachCue: null, rounds: null,
    targetIntensity: null, intervalWorkSeconds: null, intervalRestSeconds: null,
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionPlan> = {}): SessionPlan {
  return {
    dayOrder: 1, suggestedDay: 'Monday', sessionType: 'upper_pull',
    focus: 'Upper Pull', estimatedDurationMin: 55,
    sections: [{ section: 'main_work', exercises: [makeExercise()] }],
    sequenceOrder: 1, sequenceGroup: null, sequenceNotes: null, coachNotes: null,
    ...overrides,
  };
}

function makePlan(sessions: SessionPlan[]): WeekPlan {
  return {
    weekNumber: 14, phaseId: 'reconstruction',
    sessions, sequencingRules: [], synthesisNotes: 'Test.',
  };
}

describe('plan-validator', () => {
  it('passes a valid plan', () => {
    const plan = makePlan([
      makeSession({
        sessionType: 'upper_pull',
        sections: [{
          section: 'main_work',
          exercises: [
            makeExercise({ exerciseName: 'Pull-Up', supersetGroup: 'A', order: 0 }),
            makeExercise({ exerciseName: 'DB Curl', supersetGroup: 'A', order: 1 }),
            makeExercise({ exerciseName: 'Pallof Press', order: 2 }),
          ],
        }],
      }),
      makeSession({ dayOrder: 2, suggestedDay: 'Wednesday', sessionType: 'strength', sections: [{ section: 'main_work', exercises: [makeExercise({ exerciseName: 'Pallof Press' })] }] }),
      makeSession({ dayOrder: 3, suggestedDay: 'Friday', sessionType: 'upper_push', sections: [{ section: 'main_work', exercises: [makeExercise({ exerciseName: 'Pull-Up' }), makeExercise({ exerciseName: 'Pallof Press', order: 1 })] }] }),
      makeSession({ dayOrder: 4, suggestedDay: 'Sunday', sessionType: 'ruck', estimatedDurationMin: 90, sections: [{ section: 'main_work', exercises: [makeExercise({ exerciseName: 'Ruck Walk', type: 'ruck', weightKg: null })] }] }),
    ]);
    const violations = validatePlanRules(plan);
    expect(violations).toHaveLength(0);
  });

  it('detects machine-machine superset', () => {
    const plan = makePlan([makeSession({
      sections: [{
        section: 'main_work',
        exercises: [
          makeExercise({ exerciseName: 'Lat Pulldown', supersetGroup: 'A', order: 0 }),
          makeExercise({ exerciseName: 'Cable Row', supersetGroup: 'A', order: 1 }),
        ],
      }],
    })]);
    const violations = validatePlanRules(plan);
    expect(violations.some(v => v.rule === 'no_machine_machine_superset')).toBe(true);
  });

  it('detects missing pull-ups in upper body session', () => {
    const plan = makePlan([makeSession({
      sessionType: 'upper_pull',
      sections: [{
        section: 'main_work',
        exercises: [makeExercise({ exerciseName: 'Barbell Row' })],
      }],
    })]);
    const violations = validatePlanRules(plan);
    expect(violations.some(v => v.rule === 'pullups_in_upper')).toBe(true);
  });

  it('detects loaded exercise without weight', () => {
    const plan = makePlan([makeSession({
      sections: [{
        section: 'main_work',
        exercises: [makeExercise({ exerciseName: 'Barbell Row', weightKg: null })],
      }],
    })]);
    const violations = validatePlanRules(plan);
    expect(violations.some(v => v.rule === 'loaded_exercise_needs_weight')).toBe(true);
  });

  it('detects Sunday session with gym equipment', () => {
    const plan = makePlan([makeSession({
      suggestedDay: 'Sunday',
      sessionType: 'strength',
      sections: [{
        section: 'main_work',
        exercises: [makeExercise({ exerciseName: 'Lat Pulldown' })],
      }],
    })]);
    const violations = validatePlanRules(plan);
    expect(violations.some(v => v.rule === 'sunday_outdoor_only')).toBe(true);
  });

  it('detects Saturday training', () => {
    const plan = makePlan([makeSession({
      suggestedDay: 'Saturday',
      sessionType: 'strength',
    })]);
    const violations = validatePlanRules(plan);
    expect(violations.some(v => v.rule === 'saturday_family_day')).toBe(true);
  });
});
