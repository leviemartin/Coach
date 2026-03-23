import { describe, test, expect } from 'vitest';
import { parseWorkoutPlan } from '../components/checkin/ExerciseBlock';

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupTypes(text: string) {
  return parseWorkoutPlan(text).map(g => g.type);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('parseWorkoutPlan', () => {
  test('empty input returns empty array', () => {
    expect(parseWorkoutPlan('')).toEqual([]);
    expect(parseWorkoutPlan('   \n  \n  ')).toEqual([]);
  });

  test('standard superset — colon-separated weight', () => {
    const text = `A1: DB Bench Press: 20kg x12\nA2: Face Pulls: 15kg x15\n[3 rounds, 90s rest]`;
    const groups = parseWorkoutPlan(text);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.type).toBe('superset');
    expect(g.letter).toBe('A');
    expect(g.exercises).toHaveLength(2);
    expect(g.roundInfo).toBe('3 rounds, 90s rest');

    const ex1 = g.exercises[0];
    expect(ex1.label).toBe('A1');
    expect(ex1.name).toBe('DB Bench Press');
    expect(ex1.detail).toBe('20kg x12');

    const ex2 = g.exercises[1];
    expect(ex2.label).toBe('A2');
    expect(ex2.name).toBe('Face Pulls');
    expect(ex2.detail).toBe('15kg x15');
  });

  test('weight-first format — no colon before weight', () => {
    const text = `A1: Goblet Squat 28kg x10`;
    const groups = parseWorkoutPlan(text);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    // Single-exercise superset becomes standalone
    expect(g.type).toBe('standalone');
    const ex = g.exercises[0];
    expect(ex.label).toBe('A1');
    expect(ex.name).toBe('Goblet Squat');
    expect(ex.detail).toBe('28kg x10');
  });

  test('weight-first format — parseWeight bolds the weight', () => {
    const text = `A1: Goblet Squat 28kg x10\nA2: Hip Thrust 60kg x12\n[3 rounds]`;
    const groups = parseWorkoutPlan(text);
    expect(groups).toHaveLength(1);
    const ex1 = groups[0].exercises[0];
    expect(ex1.hasWeight).toBe(true);
    expect(ex1.weightPart).toBe('28kg');
    expect(ex1.textBefore).toBe('');
    expect(ex1.textAfter).toContain('x10');
  });

  test('warm-up section with dash-prefix lines', () => {
    const text = `Warm-up:\n- 5min bike Zone 2\n- Hip circles 2x10`;
    const groups = parseWorkoutPlan(text);
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('warmup');
    expect(groups[0].label).toBe('Warm-up');
    expect(groups[0].exercises).toHaveLength(2);
  });

  test('cool-down section', () => {
    const text = `Cool-down:\n- Chest doorway stretch 3x30s\n- Hip flexor stretch 2x45s`;
    const groups = parseWorkoutPlan(text);
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('cooldown');
    expect(groups[0].label).toBe('Cool-down');
    expect(groups[0].exercises).toHaveLength(2);
  });

  test('cardio/finisher section', () => {
    const text = `Cardio:\n20min Zone 2 treadmill\n5min cooldown walk`;
    const groups = parseWorkoutPlan(text);
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('cardio');
    expect(groups[0].cardioText).toContain('20min Zone 2 treadmill');
  });

  test('finisher keyword triggers cardio section', () => {
    const text = `Finisher:\n3 rounds: 15 KB swings, 10 push-ups`;
    const groups = parseWorkoutPlan(text);
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('cardio');
  });

  test('single-exercise superset becomes standalone', () => {
    const text = `A1: Pull-ups x5`;
    const groups = parseWorkoutPlan(text);
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('standalone');
    expect(groups[0].label).toBe('Exercise');
  });

  test('multi-letter supersets stay as superset type', () => {
    const text = `A1: DB Bench Press: 20kg x12\nA2: Face Pulls: 15kg x15`;
    const groups = parseWorkoutPlan(text);
    expect(groups[0].type).toBe('superset');
  });

  test('round info in brackets is captured', () => {
    const text = `B1: Romanian Deadlift: 40kg x10\nB2: Leg Curl: 30kg x12\n[4 rounds, 120s rest]`;
    const groups = parseWorkoutPlan(text);
    expect(groups[0].roundInfo).toBe('4 rounds, 120s rest');
  });

  test('multiple superset groups are separated correctly', () => {
    const text = [
      'A1: DB Bench Press: 20kg x12',
      'A2: Face Pulls: 15kg x15',
      '[3 rounds, 90s rest]',
      'B1: Romanian Deadlift: 40kg x10',
      'B2: Leg Curl: 30kg x12',
      '[3 rounds, 90s rest]',
    ].join('\n');
    const groups = parseWorkoutPlan(text);
    expect(groups).toHaveLength(2);
    expect(groups[0].letter).toBe('A');
    expect(groups[1].letter).toBe('B');
  });

  test('full session — warm-up + supersets + cardio + cool-down', () => {
    const text = [
      'Warm-up:',
      '- 5min bike Zone 2',
      'A1: DB Bench Press: 20kg x12',
      'A2: Face Pulls: 15kg x15',
      '[3 rounds, 90s rest]',
      'Cardio:',
      '15min Zone 2 rower',
      'Cool-down:',
      '- Hip flexor stretch 2x45s',
    ].join('\n');
    const types = groupTypes(text);
    expect(types).toEqual(['warmup', 'superset', 'cardio', 'cooldown']);
  });

  test('@-format weight is still parsed correctly', () => {
    const text = `A1: Squat: 3 x 5 @ 100kg`;
    const groups = parseWorkoutPlan(text);
    const ex = groups[0].exercises[0];
    expect(ex.hasWeight).toBe(true);
    expect(ex.weightPart).toBe('100kg');
    expect(ex.textBefore).toBe('3 x 5 @ ');
  });
});
