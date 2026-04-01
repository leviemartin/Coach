import { readAgentPersona } from './state';
import { getClient } from './agents';
import { OPUS_MODEL } from './constants';
import type { AgentOutput } from './types';

function buildSynthesisSystemPrompt(): string {
  const persona = readAgentPersona('head_coach');
  const instructions = `
# Synthesis Mode

You are producing a TRIMMED DECISION LOG. Not an essay. Not a full plan.

## Output Rules
1. Lead with the 2-3 most important decisions this week and WHY
2. Show inter-agent conflicts only where they changed the plan
3. Address athlete plan feedback directly if satisfaction was ≤2 or ≥4
4. Do NOT output any schedule, table, or workout details — the Plan Builder handles that
5. Keep total output under 500 words
6. End with your mandated closing phrase

## Format
- Use bullet points for decisions
- Quote which specialist drove each decision
- State what changed from last week and why
`;
  return (persona ? persona + '\n\n' : '') + instructions;
}

export function buildSynthesisUserPrompt(
  specialistOutputs: AgentOutput[],
  sharedContext: string,
): string {
  let prompt = `# Specialist Assessments\n\n`;
  for (const output of specialistOutputs) {
    prompt += `## ${output.label}\n`;
    prompt += output.error ? `**ERROR:** ${output.error}\n\n` : `${output.content}\n\n`;
  }
  prompt += `## Athlete Check-In Data\n${sharedContext}\n\n`;
  prompt += `Produce your trimmed decision log now.`;
  return prompt;
}

export async function* streamSynthesis(
  specialistOutputs: AgentOutput[],
  sharedContext: string,
): AsyncGenerator<string> {
  const client = getClient();
  const systemPrompt = buildSynthesisSystemPrompt();
  const userPrompt = buildSynthesisUserPrompt(specialistOutputs, sharedContext);

  const stream = client.messages.stream({
    model: OPUS_MODEL,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

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
