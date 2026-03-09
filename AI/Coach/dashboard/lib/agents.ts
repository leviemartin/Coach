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

  context += `## Hevy Training Log\n${hevySummary}\n\n`;

  if (formData.hevyCsv.trim()) {
    context += `### Raw Hevy CSV\n\`\`\`csv\n${formData.hevyCsv}\n\`\`\`\n\n`;
  }

  context += `## Subjective Check-In\n`;
  context += `- Baker's Cyst pain: ${formData.bakerCystPain}/10\n`;
  context += `- Lower back fatigue: ${formData.lowerBackFatigue}/10\n`;
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

export async function runAllSpecialists(
  sharedContext: string,
  model: CheckInFormData['model']
): Promise<AgentOutput[]> {
  // Validate API key before firing 7 parallel calls
  getClient();

  const resolvedModel = resolveModel(model, false);

  const promises = SPECIALIST_IDS.map((id) =>
    runSpecialist(id, sharedContext, resolvedModel)
  );

  const results = await Promise.allSettled(promises);

  return results.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    return {
      agentId: SPECIALIST_IDS[index],
      label: AGENT_LABELS[SPECIALIST_IDS[index]],
      content: '',
      model: resolvedModel,
      error: result.reason?.message || 'Promise rejected',
    };
  });
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

  prompt += `## Required Output Format\n`;
  prompt += `1. Start with your synthesis — resolve conflicts between agents with transparency\n`;
  prompt += `2. Show the inter-agent debate where relevant (quote which agents disagree and why)\n`;
  prompt += `3. End with the weekly schedule as a pipe-separated Markdown table:\n\n`;
  prompt += `| Done? | Day | Session Type | Focus | Est. Starting Weight (Hevy) | Detailed Workout Plan | Coach's Cues & Mobility | My Notes |\n`;
  prompt += `|-------|-----|-------------|-------|----------------------------|----------------------|------------------------|----------|\n\n`;
  prompt += `Include all 7 days. Mark rest days and Family Day.\n`;
  prompt += `End with your mandated closing phrase.\n`;

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
