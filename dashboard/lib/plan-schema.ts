import { z } from 'zod';

// ── Exercise ─────────────────────────────────────────────────────────────

export const ExerciseTypeEnum = z.enum([
  'strength', 'carry', 'timed', 'cardio_intervals', 'cardio_steady', 'ruck', 'mobility',
]);

export const LateralityEnum = z.enum(['bilateral', 'unilateral_each', 'alternating']);

export const SectionEnum = z.enum([
  'warm_up', 'activation', 'main_work', 'accessory', 'finisher', 'cool_down',
]);

// Use z.coerce.number() for numeric fields — LLMs sometimes output "300" instead of 300
export const ExerciseItemSchema = z.object({
  order: z.coerce.number().int().min(0),
  exerciseName: z.string().min(1),
  supersetGroup: z.string().max(2).nullish(),
  type: ExerciseTypeEnum,
  sets: z.coerce.number().int().min(1).nullish(),
  reps: z.union([z.coerce.number().int().min(1), z.string().min(1), z.null(), z.undefined()]),
  weightKg: z.coerce.number().nullish(),
  durationSeconds: z.coerce.number().int().min(1).nullish(),
  restSeconds: z.coerce.number().int().min(0).nullish(),
  tempo: z.string().nullish(),
  laterality: LateralityEnum.default('bilateral'),
  coachCue: z.string().nullish(),
  rounds: z.coerce.number().int().min(1).nullish(),
  targetIntensity: z.string().nullish(),
  intervalWorkSeconds: z.coerce.number().int().min(1).nullish(),
  intervalRestSeconds: z.coerce.number().int().min(1).nullish(),
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
  dayOrder: z.coerce.number().int().min(1),
  suggestedDay: z.string().min(1),
  sessionType: SessionTypeEnum,
  focus: z.string().min(1),
  estimatedDurationMin: z.coerce.number().int().min(0),
  sections: z.array(ExerciseSectionSchema),
  sequenceOrder: z.coerce.number().int().min(1),
  sequenceGroup: z.string().nullish(),
  sequenceNotes: z.string().nullish(),
  coachNotes: z.string().nullish(),
});

// ── Sequencing ───────────────────────────────────────────────────────────

export const SequencingRuleSchema = z.object({
  sessionOrder: z.number().int().min(1),
  group: z.string().nullish(),
  note: z.string().nullish(),
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
    type: 'object',
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
};
