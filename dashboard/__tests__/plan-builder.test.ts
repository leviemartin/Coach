import { describe, it, expect } from 'vitest';
import { buildPlanBuilderPrompt, extractWeekPlanFromResponse } from '../lib/plan-builder';

describe('plan-builder', () => {
  it('builds a prompt that includes synthesis notes', () => {
    const prompt = buildPlanBuilderPrompt(
      'Recovery overrode Strength on Thursday.',
      'shared context here',
      '{"Barbell Row": 60}',
      'Phase 1: Reconstruction',
      14,
    );
    expect(prompt).toContain('Recovery overrode Strength on Thursday');
    expect(prompt).toContain('shared context here');
    expect(prompt).toContain('Barbell Row');
    expect(prompt).toContain('Week 14');
  });

  it('extracts and validates a WeekPlan from a mock tool_use response', () => {
    const mockToolInput = {
      weekNumber: 14,
      phaseId: 'reconstruction',
      sessions: [{
        dayOrder: 1,
        suggestedDay: 'Monday',
        sessionType: 'upper_pull',
        focus: 'Upper Pull',
        estimatedDurationMin: 55,
        sections: [{
          section: 'main_work',
          exercises: [{
            order: 0,
            exerciseName: 'Barbell Row',
            supersetGroup: null,
            type: 'strength',
            sets: 3,
            reps: 8,
            weightKg: 60,
            durationSeconds: null,
            restSeconds: 90,
            tempo: null,
            laterality: 'bilateral',
            coachCue: null,
            rounds: null,
            targetIntensity: null,
            intervalWorkSeconds: null,
            intervalRestSeconds: null,
          }],
        }],
        sequenceOrder: 1,
        sequenceGroup: null,
        sequenceNotes: null,
        coachNotes: null,
      }],
      sequencingRules: [],
      synthesisNotes: 'Test notes.',
    };

    const result = extractWeekPlanFromResponse(mockToolInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sessions).toHaveLength(1);
      expect(result.data.sessions[0].sections[0].exercises[0].exerciseName).toBe('Barbell Row');
    }
  });

  it('rejects invalid tool_use response', () => {
    const result = extractWeekPlanFromResponse({ weekNumber: 14 });
    expect(result.success).toBe(false);
  });
});
