import { z } from 'zod';

// ── Exercise ─────────────────────────────────────────────────────────────

export const ExerciseTypeEnum = z.enum([
  'strength', 'carry', 'timed', 'cardio_intervals', 'cardio_steady', 'ruck', 'mobility',
]);

export const LateralityEnum = z.enum(['bilateral', 'unilateral_each', 'alternating']);

export const SectionEnum = z.enum([
  'warm_up', 'activation', 'main_work', 'accessory', 'finisher', 'cool_down',
]);

export const ExerciseItemSchema = z.object({
  order: z.number().int().min(0),
  exerciseName: z.string().min(1),
  supersetGroup: z.string().max(2).nullable(),
  type: ExerciseTypeEnum,
  sets: z.number().int().min(1).nullable(),
  reps: z.union([z.number().int().min(1), z.string().min(1), z.null()]),
  weightKg: z.number().nullable(),
  durationSeconds: z.number().int().min(1).nullable(),
  restSeconds: z.number().int().min(0).nullable(),
  tempo: z.string().regex(/^[\dX]{4}$/).nullable(),
  laterality: LateralityEnum,
  coachCue: z.string().nullable(),
  rounds: z.number().int().min(1).nullable(),
  targetIntensity: z.string().nullable(),
  intervalWorkSeconds: z.number().int().min(1).nullable(),
  intervalRestSeconds: z.number().int().min(1).nullable(),
});

// ── Section ──────────────────────────────────────────────────────────────

export const ExerciseSectionSchema = z.object({
  section: SectionEnum,
  exercises: z.array(ExerciseItemSchema),
});

// ── Session ──────────────────────────────────────────────────────────────

export const SessionTypeEnum = z.enum([
  'upper_push', 'upper_pull', 'lower_push', 'lower_pull', 'full_body',
  'strength', 'hypertrophy', 'power', 'conditioning',
  'steady_state_cardio', 'interval_cardio', 'threshold_cardio',
  'recovery', 'active_recovery', 'mobility',
  'sport_specific', 'hybrid', 'deload', 'testing', 'movement_prep',
  'ruck', 'rest', 'family_day',
]);

export const SessionPlanSchema = z.object({
  dayOrder: z.number().int().min(1),
  suggestedDay: z.string().min(1),
  sessionType: SessionTypeEnum,
  focus: z.string().min(1),
  estimatedDurationMin: z.number().int().min(0),
  sections: z.array(ExerciseSectionSchema).min(1),
  sequenceOrder: z.number().int().min(1),
  sequenceGroup: z.string().nullable(),
  sequenceNotes: z.string().nullable(),
  coachNotes: z.string().nullable(),
});

// ── Sequencing ───────────────────────────────────────────────────────────

export const SequencingRuleSchema = z.object({
  sessionOrder: z.number().int().min(1),
  group: z.string().nullable(),
  note: z.string().nullable(),
});

// ── Week Plan ────────────────────────────────────────────────────────────

export const WeekPlanSchema = z.object({
  weekNumber: z.number().int().min(1),
  phaseId: z.string().min(1),
  sessions: z.array(SessionPlanSchema).min(1),
  sequencingRules: z.array(SequencingRuleSchema),
  synthesisNotes: z.string(),
});

// ── Inferred types ───────────────────────────────────────────────────────

export type ExerciseItem = z.infer<typeof ExerciseItemSchema>;
export type ExerciseSection = z.infer<typeof ExerciseSectionSchema>;
export type SessionPlan = z.infer<typeof SessionPlanSchema>;
export type SequencingRule = z.infer<typeof SequencingRuleSchema>;
export type WeekPlan = z.infer<typeof WeekPlanSchema>;

// ── Tool definition for Anthropic API ────────────────────────────────────

export const WEEK_PLAN_TOOL = {
  name: 'save_week_plan',
  description: 'Save the structured weekly training plan. Call this tool with the complete plan for the week.',
  input_schema: {
    type: 'object' as const,
    required: ['weekNumber', 'phaseId', 'sessions', 'sequencingRules', 'synthesisNotes'],
    properties: {
      weekNumber: { type: 'integer', description: 'Training week number from program epoch' },
      phaseId: { type: 'string', description: 'Current periodization phase ID' },
      sessions: {
        type: 'array',
        description: 'Array of session plans for the week (training days only, not rest/family)',
        items: {
          type: 'object',
          required: ['dayOrder', 'suggestedDay', 'sessionType', 'focus', 'estimatedDurationMin', 'sections', 'sequenceOrder'],
          properties: {
            dayOrder: { type: 'integer' },
            suggestedDay: { type: 'string' },
            sessionType: { type: 'string', enum: SessionTypeEnum.options },
            focus: { type: 'string' },
            estimatedDurationMin: { type: 'integer' },
            sections: {
              type: 'array',
              items: {
                type: 'object',
                required: ['section', 'exercises'],
                properties: {
                  section: { type: 'string', enum: SectionEnum.options },
                  exercises: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['order', 'exerciseName', 'type', 'laterality'],
                      properties: {
                        order: { type: 'integer' },
                        exerciseName: { type: 'string' },
                        supersetGroup: { type: ['string', 'null'] },
                        type: { type: 'string', enum: ExerciseTypeEnum.options },
                        sets: { type: ['integer', 'null'] },
                        reps: { oneOf: [{ type: 'integer' }, { type: 'string' }, { type: 'null' }] },
                        weightKg: { type: ['number', 'null'] },
                        durationSeconds: { type: ['integer', 'null'] },
                        restSeconds: { type: ['integer', 'null'] },
                        tempo: { type: ['string', 'null'] },
                        laterality: { type: 'string', enum: LateralityEnum.options },
                        coachCue: { type: ['string', 'null'] },
                        rounds: { type: ['integer', 'null'] },
                        targetIntensity: { type: ['string', 'null'] },
                        intervalWorkSeconds: { type: ['integer', 'null'] },
                        intervalRestSeconds: { type: ['integer', 'null'] },
                      },
                    },
                  },
                },
              },
            },
            sequenceOrder: { type: 'integer' },
            sequenceGroup: { type: ['string', 'null'] },
            sequenceNotes: { type: ['string', 'null'] },
            coachNotes: { type: ['string', 'null'] },
          },
        },
      },
      sequencingRules: {
        type: 'array',
        items: {
          type: 'object',
          required: ['sessionOrder'],
          properties: {
            sessionOrder: { type: 'integer' },
            group: { type: ['string', 'null'] },
            note: { type: ['string', 'null'] },
          },
        },
      },
      synthesisNotes: { type: 'string' },
    },
  },
} as const;
