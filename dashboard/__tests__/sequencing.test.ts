import { describe, it, expect } from 'vitest';
import { checkSequencingConstraints } from '../lib/sequencing';
import type { PlanItem } from '../lib/types';

function makePlanItem(overrides: Partial<PlanItem>): PlanItem {
  return {
    weekNumber: 13,
    dayOrder: 1,
    day: 'Monday',
    sessionType: 'Strength',
    focus: 'Upper Push',
    startingWeight: '',
    workoutPlan: '',
    coachCues: '',
    athleteNotes: '',
    completed: false,
    completedAt: null,
    subTasks: [],
    status: 'pending',
    ...overrides,
  };
}

describe('sequencing constraints', () => {
  it('warns when same sequence_group sessions are on adjacent days', () => {
    const items: PlanItem[] = [
      makePlanItem({ id: 1, day: 'Monday', assignedDate: '2026-03-23', sequenceGroup: 'upper_compound', focus: 'Upper Push' }),
      makePlanItem({ id: 2, day: 'Tuesday', assignedDate: '2026-03-24', sequenceGroup: 'upper_compound', focus: 'Upper Pull' }),
    ];
    const result = checkSequencingConstraints(items, 2, '2026-03-24');
    expect(result.allowed).toBe(true);
    expect(result.warning).toBeTruthy();
    expect(result.warning).toContain('upper_compound');
  });

  it('allows sessions with a rest day between them', () => {
    const items: PlanItem[] = [
      makePlanItem({ id: 1, day: 'Monday', assignedDate: '2026-03-23', sequenceGroup: 'upper_compound' }),
      makePlanItem({ id: 2, day: 'Wednesday', assignedDate: '2026-03-25', sequenceGroup: 'upper_compound' }),
    ];
    const result = checkSequencingConstraints(items, 2, '2026-03-25');
    expect(result.allowed).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it('returns no warning when constraints are met', () => {
    const items: PlanItem[] = [
      makePlanItem({ id: 1, day: 'Monday', assignedDate: '2026-03-23', sequenceGroup: 'lower' }),
      makePlanItem({ id: 2, day: 'Wednesday', assignedDate: '2026-03-25', sequenceGroup: 'upper_compound' }),
    ];
    const result = checkSequencingConstraints(items, 2, '2026-03-25');
    expect(result.allowed).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it('never blocks — always returns allowed: true', () => {
    const items: PlanItem[] = [
      makePlanItem({ id: 1, day: 'Monday', assignedDate: '2026-03-23', sequenceGroup: 'upper_compound' }),
      makePlanItem({ id: 2, day: 'Tuesday', assignedDate: '2026-03-24', sequenceGroup: 'upper_compound' }),
    ];
    const result = checkSequencingConstraints(items, 2, '2026-03-24');
    expect(result.allowed).toBe(true); // never blocks
  });

  it('sessions with no sequence_group never conflict', () => {
    const items: PlanItem[] = [
      makePlanItem({ id: 1, day: 'Monday', assignedDate: '2026-03-23' }),
      makePlanItem({ id: 2, day: 'Tuesday', assignedDate: '2026-03-24' }),
    ];
    const result = checkSequencingConstraints(items, 2, '2026-03-24');
    expect(result.allowed).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it('includes sequence_notes in warning when available', () => {
    const items: PlanItem[] = [
      makePlanItem({ id: 1, day: 'Monday', assignedDate: '2026-03-23', sequenceGroup: 'upper_compound', sequenceNotes: 'not within 24h of Upper Push' }),
      makePlanItem({ id: 2, day: 'Tuesday', assignedDate: '2026-03-24', sequenceGroup: 'upper_compound', sequenceNotes: 'needs 48h after heavy compounds' }),
    ];
    const result = checkSequencingConstraints(items, 2, '2026-03-24');
    expect(result.warning).toContain('Coach recommends');
  });
});
