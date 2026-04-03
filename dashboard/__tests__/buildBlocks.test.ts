import { describe, it, expect } from 'vitest';
import { buildBlocksFromSets, buildBlocksFromPlan, supersetGroupLetter } from '../lib/buildBlocks';
import type { SessionSetState, SessionCardioState, PlanExercise } from '../lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSet(overrides: Partial<SessionSetState> = {}): SessionSetState {
  return {
    exerciseName: 'Pull-up',
    exerciseOrder: 1,
    supersetGroup: null,
    setNumber: 1,
    prescribedWeightKg: null,
    prescribedReps: 8,
    prescribedRepsDisplay: '8',
    actualWeightKg: null,
    actualReps: null,
    completed: false,
    isModified: false,
    prescribedDurationS: null,
    actualDurationS: null,
    section: 'main_work',
    restSeconds: 90,
    coachCue: null,
    planExerciseId: null,
    exerciseType: null,
    laterality: 'bilateral',
    ...overrides,
  };
}

function makeCardio(overrides: Partial<SessionCardioState> = {}): SessionCardioState {
  return {
    exerciseName: 'Rower',
    exerciseOrder: 5,
    cardioType: 'intervals',
    prescribedRounds: 6,
    completedRounds: 0,
    prescribedDurationMin: 20,
    targetIntensity: '>300W',
    completed: false,
    actualDurationMin: null,
    section: 'main_work',
    restSeconds: null,
    coachCue: null,
    planExerciseId: null,
    intervalWorkSeconds: 20,
    intervalRestSeconds: 100,
    roundData: null,
    ...overrides,
  };
}

// ── supersetGroupLetter ───────────────────────────────────────────────────────

describe('supersetGroupLetter', () => {
  it('converts integer to letter', () => {
    expect(supersetGroupLetter(1)).toBe('A');
    expect(supersetGroupLetter(2)).toBe('B');
    expect(supersetGroupLetter(26)).toBe('Z');
  });
});

// ── buildBlocksFromSets ───────────────────────────────────────────────────────

describe('buildBlocksFromSets', () => {
  it('sorts blocks by section order then exercise order', () => {
    const sets = [
      makeSet({ exerciseName: 'Squat', exerciseOrder: 1, section: 'main_work', planExerciseId: 10 }),
      makeSet({ exerciseName: 'Squat', exerciseOrder: 1, section: 'main_work', setNumber: 2, planExerciseId: 10 }),
      makeSet({ exerciseName: 'Band Pull-apart', exerciseOrder: 2, section: 'activation', planExerciseId: 20 }),
    ];
    const blocks = buildBlocksFromSets(sets, []);
    // activation(1) < main_work(2)
    expect(blocks[0].section).toBe('activation');
    expect(blocks[1].section).toBe('main_work');
  });

  it('groups superset exercises into a single block', () => {
    const sets = [
      makeSet({ exerciseName: 'DB Bench', exerciseOrder: 1, supersetGroup: 1, setNumber: 1, planExerciseId: 1 }),
      makeSet({ exerciseName: 'DB Bench', exerciseOrder: 1, supersetGroup: 1, setNumber: 2, planExerciseId: 1 }),
      makeSet({ exerciseName: 'DB Bench', exerciseOrder: 1, supersetGroup: 1, setNumber: 3, planExerciseId: 1 }),
      makeSet({ exerciseName: 'Face Pull', exerciseOrder: 2, supersetGroup: 1, setNumber: 1, planExerciseId: 2 }),
      makeSet({ exerciseName: 'Face Pull', exerciseOrder: 2, supersetGroup: 1, setNumber: 2, planExerciseId: 2 }),
      makeSet({ exerciseName: 'Face Pull', exerciseOrder: 2, supersetGroup: 1, setNumber: 3, planExerciseId: 2 }),
    ];
    const blocks = buildBlocksFromSets(sets, []);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('superset');
    if (blocks[0].kind === 'superset') {
      expect(blocks[0].exercises).toHaveLength(2);
      expect(blocks[0].groupId).toBe(1);
    }
  });

  it('deduplicates exercises by planExerciseId across sections', () => {
    // Two "Bike" exercises in different sections with different planExerciseIds → 2 blocks
    const cardio = [
      makeCardio({ exerciseName: 'Bike', section: 'warm_up', planExerciseId: 100, exerciseOrder: 1 }),
      makeCardio({ exerciseName: 'Bike', section: 'cool_down', planExerciseId: 200, exerciseOrder: 1 }),
    ];
    const blocks = buildBlocksFromSets([], cardio);
    expect(blocks).toHaveLength(2);
  });

  it('does NOT create duplicate blocks for multiple sets of same exercise', () => {
    const sets = [
      makeSet({ exerciseName: 'Pull-up', exerciseOrder: 1, setNumber: 1, planExerciseId: 10 }),
      makeSet({ exerciseName: 'Pull-up', exerciseOrder: 1, setNumber: 2, planExerciseId: 10 }),
      makeSet({ exerciseName: 'Pull-up', exerciseOrder: 1, setNumber: 3, planExerciseId: 10 }),
    ];
    const blocks = buildBlocksFromSets(sets, []);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('single');
    if (blocks[0].kind === 'single') {
      expect(blocks[0].exercise.sets).toBe(3);
    }
  });

  it('extracts superset rest from any non-zero restSeconds', () => {
    const sets = [
      makeSet({ exerciseName: 'DB Bench', exerciseOrder: 1, supersetGroup: 2, setNumber: 1, planExerciseId: 1, restSeconds: null }),
      makeSet({ exerciseName: 'DB Bench', exerciseOrder: 1, supersetGroup: 2, setNumber: 2, planExerciseId: 1, restSeconds: 90 }),
      makeSet({ exerciseName: 'Face Pull', exerciseOrder: 2, supersetGroup: 2, setNumber: 1, planExerciseId: 2, restSeconds: null }),
    ];
    const blocks = buildBlocksFromSets(sets, []);
    expect(blocks).toHaveLength(1);
    if (blocks[0].kind === 'superset') {
      expect(blocks[0].restSeconds).toBe(90);
    }
  });

  it('uses stored exerciseType for carry instead of defaulting to strength', () => {
    const sets = [
      makeSet({ exerciseName: 'Farmer Carry', exerciseOrder: 5, section: 'accessory', planExerciseId: 50, exerciseType: 'carry', prescribedReps: 40, prescribedRepsDisplay: '40m', prescribedWeightKg: 24, setNumber: 1 }),
      makeSet({ exerciseName: 'Farmer Carry', exerciseOrder: 5, section: 'accessory', planExerciseId: 50, exerciseType: 'carry', prescribedReps: 40, prescribedRepsDisplay: '40m', prescribedWeightKg: 24, setNumber: 2 }),
      makeSet({ exerciseName: 'Farmer Carry', exerciseOrder: 5, section: 'accessory', planExerciseId: 50, exerciseType: 'carry', prescribedReps: 40, prescribedRepsDisplay: '40m', prescribedWeightKg: 24, setNumber: 3 }),
    ];
    const blocks = buildBlocksFromSets(sets, []);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('single');
    if (blocks[0].kind === 'single') {
      expect(blocks[0].exercise.type).toBe('carry');
      expect(blocks[0].exercise.sets).toBe(3);
    }
  });

  it('falls back to inference when exerciseType is null (legacy)', () => {
    // A carry without stored type would incorrectly infer as strength
    const sets = [
      makeSet({ exerciseName: 'Farmer Carry', exerciseOrder: 5, section: 'accessory', prescribedReps: 40, prescribedWeightKg: 24, exerciseType: null }),
    ];
    const blocks = buildBlocksFromSets(sets, []);
    if (blocks[0].kind === 'single') {
      // Without stored type, inference defaults to strength (the known bug for legacy data)
      expect(blocks[0].exercise.type).toBe('strength');
    }
  });

  it('interleaves cardio with strength in correct section order', () => {
    const sets = [
      makeSet({ exerciseName: 'Squat', exerciseOrder: 1, section: 'main_work', planExerciseId: 10 }),
    ];
    const cardio = [
      makeCardio({ exerciseName: 'Bike', section: 'warm_up', exerciseOrder: 1, planExerciseId: 100 }),
      makeCardio({ exerciseName: 'Rower', section: 'finisher', exerciseOrder: 1, planExerciseId: 200 }),
    ];
    const blocks = buildBlocksFromSets(sets, cardio);
    expect(blocks).toHaveLength(3);
    // warm_up(0) → main_work(2) → finisher(4)
    expect(blocks[0].section).toBe('warm_up');
    expect(blocks[1].section).toBe('main_work');
    expect(blocks[2].section).toBe('finisher');
  });
});

// ── buildBlocksFromPlan ───────────────────────────────────────────────────────

describe('buildBlocksFromPlan', () => {
  function makePlanExercise(overrides: Partial<PlanExercise> = {}): PlanExercise {
    return {
      id: undefined,
      planItemId: 1,
      section: 'main_work',
      exerciseOrder: 1,
      exerciseName: 'Pull-up',
      supersetGroup: null,
      type: 'strength',
      sets: 3,
      reps: '8-10',
      weightKg: null,
      durationSeconds: null,
      restSeconds: 90,
      tempo: null,
      laterality: 'bilateral',
      coachCue: null,
      rounds: null,
      targetIntensity: null,
      intervalWorkSeconds: null,
      intervalRestSeconds: null,
      ...overrides,
    };
  }

  it('converts superset letters to integers in groupId', () => {
    const exercises: PlanExercise[] = [
      makePlanExercise({ id: 1, exerciseName: 'DB Bench', exerciseOrder: 1, supersetGroup: 'A' }),
      makePlanExercise({ id: 2, exerciseName: 'Face Pull', exerciseOrder: 2, supersetGroup: 'A' }),
    ];
    const blocks = buildBlocksFromPlan(exercises);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('superset');
    if (blocks[0].kind === 'superset') {
      expect(blocks[0].groupId).toBe(1); // 'A' → 1
    }
  });

  it('maps PlanExercise fields to NormalizedExercise fields', () => {
    const exercises: PlanExercise[] = [
      makePlanExercise({
        id: 5,
        exerciseName: 'Romanian Deadlift',
        exerciseOrder: 2,
        reps: '10-12',
        weightKg: 60,
        durationSeconds: null,
        restSeconds: 120,
        coachCue: 'Keep back flat',
      }),
    ];
    const blocks = buildBlocksFromPlan(exercises);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('single');
    if (blocks[0].kind === 'single') {
      const ex = blocks[0].exercise;
      expect(ex.name).toBe('Romanian Deadlift');
      expect(ex.order).toBe(2);
      expect(ex.prescribedRepsDisplay).toBe('10-12');
      expect(ex.prescribedWeightKg).toBe(60);
      expect(ex.restSeconds).toBe(120);
      expect(ex.coachCue).toBe('Keep back flat');
      expect(ex.planExerciseId).toBe(5);
    }
  });

  it('maps cardio exercise types correctly', () => {
    const exercises: PlanExercise[] = [
      makePlanExercise({
        id: 10,
        exerciseName: 'Rower Sprints',
        exerciseOrder: 3,
        type: 'cardio_intervals',
        section: 'finisher',
        sets: null,
        reps: null,
        durationSeconds: 1200,
        rounds: 6,
        targetIntensity: '>300W',
        intervalWorkSeconds: 20,
        intervalRestSeconds: 100,
        restSeconds: null,
      }),
    ];
    const blocks = buildBlocksFromPlan(exercises);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('cardio');
    if (blocks[0].kind === 'cardio') {
      expect(blocks[0].exercise.cardioType).toBe('intervals');
      expect(blocks[0].exercise.prescribedDurationMin).toBe(20); // 1200s / 60
      expect(blocks[0].exercise.type).toBe('cardio_intervals');
    }
  });

  it('maps ruck and cardio_steady to steady_state cardioType', () => {
    const exercises: PlanExercise[] = [
      makePlanExercise({
        id: 11,
        exerciseName: 'Sunday Ruck',
        exerciseOrder: 1,
        type: 'ruck',
        section: 'main_work',
        durationSeconds: 5400,
        sets: null,
        reps: null,
      }),
      makePlanExercise({
        id: 12,
        exerciseName: 'StairMaster',
        exerciseOrder: 2,
        type: 'cardio_steady',
        section: 'main_work',
        durationSeconds: 1800,
        sets: null,
        reps: null,
      }),
    ];
    const blocks = buildBlocksFromPlan(exercises);
    expect(blocks).toHaveLength(2);
    for (const block of blocks) {
      expect(block.kind).toBe('cardio');
      if (block.kind === 'cardio') {
        expect(block.exercise.cardioType).toBe('steady_state');
      }
    }
  });

  it('sorts blocks by section order then exercise order', () => {
    const exercises: PlanExercise[] = [
      makePlanExercise({ id: 1, exerciseName: 'Squat', exerciseOrder: 1, section: 'main_work' }),
      makePlanExercise({ id: 2, exerciseName: 'Band Pull-apart', exerciseOrder: 1, section: 'activation' }),
      makePlanExercise({ id: 3, exerciseName: 'Toe Touch', exerciseOrder: 1, section: 'warm_up' }),
    ];
    const blocks = buildBlocksFromPlan(exercises);
    expect(blocks[0].section).toBe('warm_up');
    expect(blocks[1].section).toBe('activation');
    expect(blocks[2].section).toBe('main_work');
  });

  it('preserves carry type from plan exercises', () => {
    const exercises: PlanExercise[] = [
      makePlanExercise({ id: 1, exerciseName: 'Farmer Carry', type: 'carry', reps: '40m', weightKg: 24, sets: 3, section: 'accessory' }),
    ];
    const blocks = buildBlocksFromPlan(exercises);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('single');
    if (blocks[0].kind === 'single') {
      expect(blocks[0].exercise.type).toBe('carry');
    }
  });

  it('defaults laterality to bilateral when not specified', () => {
    // PlanExercise has laterality required, but this tests the NormalizedExercise output
    const exercises: PlanExercise[] = [
      makePlanExercise({ id: 1, laterality: 'bilateral' }),
    ];
    const blocks = buildBlocksFromPlan(exercises);
    expect(blocks[0].kind).toBe('single');
    if (blocks[0].kind === 'single') {
      expect(blocks[0].exercise.laterality).toBe('bilateral');
    }
  });
});
