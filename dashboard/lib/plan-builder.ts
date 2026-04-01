import { getClient } from './agents';
import { readCeilings, readPeriodization } from './state';
import { OPUS_MODEL } from './constants';
import { WeekPlanSchema, WEEK_PLAN_TOOL } from './plan-schema';
import type { WeekPlan } from './plan-schema';

// ── Prompt Builder ───────────────────────────────────────────────────────

export function buildPlanBuilderPrompt(
  synthesisNotes: string,
  sharedContext: string,
  ceilingsJson: string,
  periodization: string,
  weekNumber: number,
  fixInstructions?: string,
): string {
  let prompt = `# Plan Builder — Week ${weekNumber}\n\n`;
  prompt += `You are the Plan Builder. Your ONLY job is to produce a structured weekly training plan by calling the save_week_plan tool. Do NOT output any text — only call the tool.\n\n`;

  prompt += `## Synthesis Decisions\n${synthesisNotes}\n\n`;
  prompt += `## Athlete Context\n${sharedContext}\n\n`;
  prompt += `## Current Ceilings (starting weights)\n${ceilingsJson}\n\n`;
  prompt += `## Periodization\n${periodization}\n\n`;

  prompt += `## Rules\n`;
  prompt += `- Every loaded exercise MUST have a weightKg value\n`;
  prompt += `- exerciseName must be a standard gym exercise name\n`;
  prompt += `- Supersets: same supersetGroup letter (A, B, C). Standalone exercises: supersetGroup = null\n`;
  prompt += `- Never superset two machines. Pair machine + portable/bodyweight.\n`;
  prompt += `- Pull-up bar is in the free weight area, NOT near cable machines. Never superset pull-ups with cable exercises.\n`;
  prompt += `- Session duration 50-60 min (main work only, excluding warm_up and cool_down)\n`;
  prompt += `- Minimum session length 40 min total\n`;
  prompt += `- Sunday = outdoor ruck with dog. No gym equipment.\n`;
  prompt += `- Saturday = family day. No training. Use sessionType "family_day".\n`;
  prompt += `- Pull-ups in every upper body session\n`;
  prompt += `- Core stability 3x/week minimum\n`;
  prompt += `- Each exercise appears ONCE per session\n`;
  prompt += `- Warm-up section: 5-10 min general + activation\n`;
  prompt += `- Cool-down section: 3-5 min light movement\n\n`;

  if (fixInstructions) {
    prompt += `## FIXES REQUIRED\nThe Validator found these violations in your previous output. Fix them:\n${fixInstructions}\n\n`;
  }

  prompt += `Call the save_week_plan tool now with the complete weekly plan.`;

  return prompt;
}

// ── Extraction + Validation ──────────────────────────────────────────────

export function extractWeekPlanFromResponse(
  toolInput: unknown,
): { success: true; data: WeekPlan } | { success: false; error: string } {
  const result = WeekPlanSchema.safeParse(toolInput);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.issues.map(
    (i) => `${i.path.join('.')}: ${i.message}`
  ).join('\n');
  return { success: false, error: errors };
}

// ── API Call ─────────────────────────────────────────────────────────────

export async function runPlanBuilder(
  synthesisNotes: string,
  sharedContext: string,
  weekNumber: number,
  fixInstructions?: string,
): Promise<{ success: true; data: WeekPlan } | { success: false; error: string }> {
  const client = getClient();
  const ceilings = readCeilings();
  const periodization = readPeriodization();

  const prompt = buildPlanBuilderPrompt(
    synthesisNotes,
    sharedContext,
    JSON.stringify(ceilings.ceilings, null, 2),
    periodization,
    weekNumber,
    fixInstructions,
  );

  const response = await client.messages.create({
    model: OPUS_MODEL,
    max_tokens: 8000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [WEEK_PLAN_TOOL as any],
    tool_choice: { type: 'tool', name: 'save_week_plan' },
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract tool_use block
  const toolBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    return { success: false, error: 'Plan Builder did not call the save_week_plan tool.' };
  }

  return extractWeekPlanFromResponse(toolBlock.input);
}
