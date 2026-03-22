import { describe, it, expect } from 'vitest';
import { createSession, getSessionSets, updateSet, completeSession } from '../lib/session-db';
import type { ParsedExercise } from '../lib/types';

describe('session-db', () => {
  const mockExercises: ParsedExercise[] = [
    {
      name: 'Pull-ups', canonicalName: 'Pull-Up', type: 'strength',
      order: 0, supersetGroup: null, sets: 3, reps: 5, weightKg: null,
      durationSeconds: null, restSeconds: null, rounds: null,
      targetIntensity: null, coachCue: null,
    },
    {
      name: 'DB Rows', canonicalName: 'DB Row', type: 'strength',
      order: 1, supersetGroup: null, sets: 3, reps: 10, weightKg: 22.5,
      durationSeconds: null, restSeconds: null, rounds: null,
      targetIntensity: null, coachCue: null,
    },
  ];

  it('creates a session with sets', () => {
    const id = createSession('2026-03-21', 'strength', 'Upper Body Test', mockExercises);
    expect(id).toBeGreaterThan(0);

    const sets = getSessionSets(id);
    expect(sets).toHaveLength(6);
    expect(sets[0].exerciseName).toBe('Pull-Up');
    expect(sets[0].prescribedReps).toBe(5);
    expect(sets[3].exerciseName).toBe('DB Row');
    expect(sets[3].prescribedWeightKg).toBe(22.5);
  });

  it('updates a set with actual values', () => {
    const id = createSession('2026-03-22', 'strength', 'Test 2', mockExercises);
    const sets = getSessionSets(id);

    updateSet(sets[3].id!, 20, 10, true);

    const updated = getSessionSets(id);
    expect(updated[3].actualWeightKg).toBe(20);
    expect(updated[3].isModified).toBe(true);
    expect(updated[3].completed).toBe(true);
  });

  it('completes a session and calculates compliance', () => {
    const id = createSession('2026-03-23', 'strength', 'Test 3', mockExercises);
    const sets = getSessionSets(id);

    for (let i = 0; i < 4; i++) {
      updateSet(sets[i].id!, sets[i].prescribedWeightKg, sets[i].prescribedReps, true);
    }

    const result = completeSession(id, 'Good session');
    expect(result.compliancePct).toBe(67);
  });
});
