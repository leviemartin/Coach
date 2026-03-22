import { describe, it, expect } from 'vitest';
import { parseWorkoutPlan } from '../lib/workout-parser';

describe('parseWorkoutPlan', () => {
  it('parses standalone exercises with weight and reps', () => {
    const text = `A1: Pull-ups 5×3 (assisted -20kg)
B1: Dead Hang 3×30s
C1: DB Rows 3×10 @22.5kg`;
    const result = parseWorkoutPlan(text, 'strength');
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Pull-ups');
    expect(result[0].sets).toBe(5);
    expect(result[0].reps).toBe(3);
    expect(result[0].supersetGroup).toBeNull();
    expect(result[1].name).toBe('Dead Hang');
    expect(result[1].durationSeconds).toBe(30);
    expect(result[2].weightKg).toBe(22.5);
  });

  it('parses supersets (same letter, different number)', () => {
    const text = `A1: Lat Pulldown 3×10 @50kg [3 rounds, 90s rest]
A2: Face Pulls 3×15 @15kg`;
    const result = parseWorkoutPlan(text, 'strength');
    expect(result).toHaveLength(2);
    expect(result[0].supersetGroup).toBe(1);
    expect(result[1].supersetGroup).toBe(1);
    expect(result[0].restSeconds).toBe(90);
  });

  it('parses multiple superset groups', () => {
    const text = `A1: Lat Pulldown 3×10 @50kg
A2: Face Pulls 3×15 @15kg
B1: DB Rows 3×10 @22.5kg
B2: Push-ups 3×12`;
    const result = parseWorkoutPlan(text, 'strength');
    expect(result[0].supersetGroup).toBe(1);
    expect(result[1].supersetGroup).toBe(1);
    expect(result[2].supersetGroup).toBe(2);
    expect(result[3].supersetGroup).toBe(2);
  });

  it('parses cardio intervals', () => {
    const text = `Rower Sprints: 8 rounds, 20s work / 1:40 rest, >300W target. Damper 7-9`;
    const result = parseWorkoutPlan(text, 'cardio_intervals');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('cardio_intervals');
    expect(result[0].rounds).toBe(8);
    expect(result[0].durationSeconds).toBe(20);
    expect(result[0].targetIntensity).toBe('>300W');
  });

  it('parses steady state cardio', () => {
    const text = `Zone 2 Rower: 20 min, HR 120-135`;
    const result = parseWorkoutPlan(text, 'cardio_steady');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('cardio_steady');
    expect(result[0].durationSeconds).toBe(1200);
  });

  it('handles mixed format with warm-up sections', () => {
    const text = `Warm-up:
- 5 min rower easy
- Band pull-aparts 2×15

A1: Lat Pulldown 3×10 @50kg
A2: Face Pulls 3×15 @15kg
B1: DB Rows 3×10 @22.5kg`;
    const result = parseWorkoutPlan(text, 'strength');
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.find(e => e.name.includes('Lat Pulldown'))).toBeTruthy();
  });
});
