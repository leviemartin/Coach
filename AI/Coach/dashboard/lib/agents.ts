import Anthropic from '@anthropic-ai/sdk';
import { readAgentPersona, readAthleteProfile, readTrainingHistory, readCeilings, readPeriodization, readDecisionsLog } from './state';
import { SPECIALIST_IDS, AGENT_LABELS, DEFAULT_MODEL, OPUS_MODEL } from './constants';
import type { GarminData, CheckInFormData, AgentOutput } from './types';
import { formatHevySummary, parseHevyCsv } from './parse-hevy';

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set. Add it to dashboard/.env.local');
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

function resolveModel(model: CheckInFormData['model'], isHeadCoach = false): string {
  if (model === 'opus') return OPUS_MODEL;
  if (model === 'mixed') return isHeadCoach ? OPUS_MODEL : DEFAULT_MODEL;
  return DEFAULT_MODEL;
}

export function buildSharedContext(
  garminData: GarminData | null,
  formData: CheckInFormData
): string {
  const profile = readAthleteProfile();
  const history = readTrainingHistory(4);
  const ceilings = readCeilings();
  const periodization = readPeriodization();
  const decisions = readDecisionsLog();

  const hevyExercises = parseHevyCsv(formData.hevyCsv);
  const hevySummary = formatHevySummary(hevyExercises.data);

  let context = `# Weekly Check-In Data\n\n`;

  context += `## Athlete Plan Feedback (PRIORITY — Read First)\n`;
  context += `- Plan satisfaction: ${formData.planSatisfaction}/5 (1=too light, 3=right, 5=too much)\n`;
  context += `- Feedback: ${formData.planFeedback || 'None provided'}\n`;
  context += `**Instruction:** The athlete's subjective experience of last week's plan is a primary input. If satisfaction ≤2 (too light), do not reduce volume further unless injury or combined readiness <35 demands it. If satisfaction ≥4 (too much), consider reducing. If combined readiness <35 triggered a deload and feedback says "too light," the deload is working as designed — maintain it. If the athlete consistently reports extreme values that contradict objective data, flag the discrepancy rather than blindly adjusting. Address this feedback explicitly in your assessment.\n\n`;

  context += `## Athlete Profile\n${profile}\n\n`;
  context += `## Current Phase & Periodization\n${periodization}\n\n`;
  context += `## Active Decisions & Gates\n${decisions}\n\n`;
  context += `## Current Working Ceilings\n\`\`\`json\n${JSON.stringify(ceilings, null, 2)}\n\`\`\`\n\n`;
  context += `## Training History (Last 4 Weeks)\n${history}\n\n`;

  if (garminData) {
    context += `## Garmin Data Export\n\`\`\`json\n${JSON.stringify(garminData, null, 2)}\n\`\`\`\n\n`;
  } else {
    context += `## Garmin Data\nNo Garmin data available this week.\n\n`;
  }

  // Compute Combined Readiness Score (60% subjective, 40% Garmin weekly avg)
  let combinedReadinessSection = `## Combined Readiness Score (USE THIS FOR WEEKLY PLANNING)\n`;
  const perceivedNormalized = (formData.perceivedReadiness / 5) * 100; // Scale 1-5 → 20-100
  let garminAvgReadiness: number | null = null;
  if (garminData?.performance_stats?.training_readiness?.daily) {
    const scores = garminData.performance_stats.training_readiness.daily
      .map((d: { score?: number }) => d.score)
      .filter((s): s is number => s != null);
    if (scores.length > 0) {
      garminAvgReadiness = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
    }
  }
  if (garminAvgReadiness !== null) {
    const combined = Math.round(perceivedNormalized * 0.6 + garminAvgReadiness * 0.4);
    combinedReadinessSection += `- Athlete perceived readiness: ${formData.perceivedReadiness}/5 (normalized: ${Math.round(perceivedNormalized)})\n`;
    combinedReadinessSection += `- Garmin weekly avg readiness: ${garminAvgReadiness} (from ${garminData!.performance_stats.training_readiness!.daily.length} days)\n`;
    combinedReadinessSection += `- **Combined score: ${combined}** (60% subjective + 40% Garmin)\n`;
    combinedReadinessSection += `**Decision matrix (use combined score, NOT single-day minimums):**\n`;
    combinedReadinessSection += `- >50: Train as programmed\n`;
    combinedReadinessSection += `- 35-50: Reduce volume 20%, maintain intensity (THIS IS THE DAD BASELINE — expected for a parent of 2 with baby #3 incoming)\n`;
    combinedReadinessSection += `- <35: Deload — Zone 2 flush + mobility only\n`;
    combinedReadinessSection += `- <20: Rest day. No negotiation.\n`;
    combinedReadinessSection += `**CRITICAL:** Use the WEEKLY AVERAGE for weekly plan design. Individual daily scores (including outlier lows) are for same-day session adjustments ONLY — they do not drive the entire week's programming.\n`;
  } else {
    combinedReadinessSection += `- Athlete perceived readiness: ${formData.perceivedReadiness}/5\n`;
    combinedReadinessSection += `- Garmin readiness: No data available\n`;
    combinedReadinessSection += `- Using perceived readiness only. Scale: 1-2 = deload, 3 = normal, 4-5 = push.\n`;
  }
  context += combinedReadinessSection + `\n`;

  context += `## Hevy Training Log\n${hevySummary}\n\n`;

  if (formData.hevyCsv.trim()) {
    context += `### Raw Hevy CSV\n\`\`\`csv\n${formData.hevyCsv}\n\`\`\`\n\n`;
  }

  context += `## Subjective Check-In\n`;
  context += `- Baker's Cyst pain: ${formData.bakerCystPain}/10\n`;
  context += `- Lower back fatigue: ${formData.lowerBackFatigue}/10\n`;
  context += `- Perceived readiness: ${formData.perceivedReadiness}/5 (1=wrecked, 3=normal, 5=peaked)\n`;
  context += `- Sessions completed: ${formData.sessionsCompleted} / ${formData.sessionsPlanned} planned\n`;
  context += `- Missed sessions: ${formData.missedSessions || 'None reported'}\n`;
  context += `- Strength wins: ${formData.strengthWins || 'None reported'}\n`;
  context += `- Struggles: ${formData.struggles || 'None reported'}\n`;
  context += `- Bedtime compliance (nights before 23:00): ${formData.bedtimeCompliance}/7\n`;
  context += `- Rug Protocol days: ${formData.rugProtocolDays}/7\n`;
  context += `- Hydration tracked: ${formData.hydrationTracked ? 'Yes' : 'No'}\n`;
  context += `- Upcoming conflicts: ${formData.upcomingConflicts || 'None'}\n`;
  context += `- Focus for next week: ${formData.focusNextWeek || 'Not specified'}\n`;
  context += `- Questions for coaches: ${formData.questionsForCoaches || 'None'}\n`;

  return context;
}

export async function runSpecialist(
  agentId: string,
  sharedContext: string,
  model: string
): Promise<AgentOutput> {
  const client = getClient();
  const persona = readAgentPersona(agentId);
  const label = AGENT_LABELS[agentId] || agentId;

  if (!persona) {
    return {
      agentId,
      label,
      content: '',
      model,
      error: `Persona file not found for agent: ${agentId}`,
    };
  }

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2000,
      system: persona,
      messages: [
        {
          role: 'user',
          content: `Analyze this weekly check-in data from your domain expertise. Provide your specialist assessment, flag any concerns, and make specific recommendations for next week's plan.\n\n${sharedContext}`,
        },
      ],
    });

    const content = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.type === 'text' ? b.text : '')
      .join('\n');

    return {
      agentId,
      label,
      content,
      model,
      tokensUsed: response.usage?.output_tokens,
    };
  } catch (error) {
    return {
      agentId,
      label,
      content: '',
      model,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run specialists sequentially to avoid rate limits on Claude Pro accounts.
 * Yields each result as it completes so the UI can show real-time progress.
 */
export async function* runSpecialistsSequentially(
  sharedContext: string,
  model: CheckInFormData['model']
): AsyncGenerator<AgentOutput> {
  getClient();
  const resolvedModel = resolveModel(model, false);

  for (const id of SPECIALIST_IDS) {
    yield await runSpecialist(id, sharedContext, resolvedModel);
  }
}

export function buildSynthesisPrompt(
  specialistOutputs: AgentOutput[],
  sharedContext: string
): string {
  let prompt = `# Head Coach Synthesis\n\n`;
  prompt += `You have received analyses from all 7 specialist agents. Review their assessments, resolve any conflicts using the priority hierarchy, and produce the unified weekly plan.\n\n`;

  for (const output of specialistOutputs) {
    prompt += `## ${output.label} Assessment\n`;
    if (output.error) {
      prompt += `**ERROR:** ${output.error} — This agent failed. Note the gap in analysis.\n\n`;
    } else {
      prompt += `${output.content}\n\n`;
    }
  }

  prompt += `## Original Check-In Data\n${sharedContext}\n\n`;

  prompt += `## Athlete Plan Feedback (Reminder)\n`;
  prompt += `- Satisfaction: ${specialistOutputs.length > 0 ? 'See shared context above' : 'N/A'}\n`;
  prompt += `When athlete feedback conflicts with specialist recommendations, apply the priority hierarchy. Athlete feedback ranks at #3 — above race-specific preparation but below recovery (#2) and injury prevention (#1). Show the debate.\n\n`;

  prompt += `## Required Output Format\n`;
  prompt += `1. Start with your synthesis — resolve conflicts between agents with transparency\n`;
  prompt += `2. Show the inter-agent debate where relevant (quote which agents disagree and why)\n`;
  prompt += `3. Address the athlete's plan feedback directly. If satisfaction was ≤2 or ≥4, explain what changes you're making in response and why. Never ignore this input.\n`;
  prompt += `4. End with the weekly schedule as a pipe-separated Markdown table:\n\n`;
  prompt += `| Done? | Day | Session Type | Focus | Est. Starting Weight (Hevy) | Detailed Workout Plan | Coach's Cues & Mobility | My Notes |\n`;
  prompt += `|-------|-----|-------------|-------|----------------------------|----------------------|------------------------|----------|\n\n`;
  prompt += `5. Include all 7 days. Mark rest days and Family Day.\n`;
  prompt += `6. End with your mandated closing phrase.\n`;

  return prompt;
}

export async function* streamHeadCoachSynthesis(
  specialistOutputs: AgentOutput[],
  sharedContext: string,
  model: CheckInFormData['model']
): AsyncGenerator<string> {
  const client = getClient();
  const persona = readAgentPersona('head_coach');
  const resolvedModel = resolveModel(model, true);
  const synthesisPrompt = buildSynthesisPrompt(specialistOutputs, sharedContext);

  const stream = client.messages.stream({
    model: resolvedModel,
    max_tokens: 4000,
    system: persona || undefined,
    messages: [
      {
        role: 'user',
        content: synthesisPrompt,
      },
    ],
  });

  // Use the SDK's text event handler via async iteration
  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      'delta' in event &&
      event.delta.type === 'text_delta' &&
      'text' in event.delta
    ) {
      yield event.delta.text;
    }
  }
}
