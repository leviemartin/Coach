import { readAgentPersona } from './state';
import { getClient } from './agents';
import { OPUS_MODEL } from './constants';
import type { AgentOutput } from './types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DialogueMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DialogueRequest {
  message: string;
  conversationHistory: DialogueMessage[];
  specialistOutputs: AgentOutput[];
  sharedContext: string;
  draftPlan: string;
}

// ── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const persona = readAgentPersona('head_coach');

  const dialogueInstructions = `
# Dialogue Mode

You are now in **open conversation** with the athlete. The synthesis is complete and the draft plan has been presented. The athlete may:

- Ask "why" about any decision in the plan
- Request specific changes to sessions, exercises, or scheduling
- Challenge your reasoning or a specialist's recommendation
- Ask about trade-offs between competing priorities
- Negotiate adjustments within the bounds of injury prevention and recovery rules

## Rules for Dialogue Mode

1. **Maintain your strict, analytical, no-nonsense tone.** You are the Head Coach. Be direct.
2. **Reference specialist assessments** when explaining decisions. Quote which agent drove a recommendation.
3. **Show the trade-off** when the athlete requests a change that conflicts with a specialist recommendation. Explain what they gain and what they risk.
4. **Respect the priority hierarchy.** Injury prevention and recovery override athlete preference. Say so clearly if a request violates these.
5. **Make changes when justified.** If the athlete provides new information or a valid argument, update the plan. State what changed and why.
6. **When the athlete says "lock it in", "locked in", "let's go", or similar confirmation phrases**, respond with the mandated phrase: "Locked in." followed by "Time to work." or "Go get it done."
7. **Keep responses focused.** Answer what was asked. Do not re-generate the entire plan unless explicitly requested.
8. **If updating the schedule**, output only the changed rows in the pipe-separated table format, not the full table — unless the athlete asks for the full table.
`;

  return (persona ? persona + '\n\n' : '') + dialogueInstructions;
}

// ── Message Builder ──────────────────────────────────────────────────────────

export function buildDialogueMessages(
  request: DialogueRequest
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // First user message: full context (specialist outputs + shared context + draft plan)
  let contextMessage = `# Check-In Context\n\n`;

  contextMessage += `## Specialist Assessments\n\n`;
  for (const output of request.specialistOutputs) {
    contextMessage += `### ${output.label}\n`;
    if (output.error) {
      contextMessage += `**ERROR:** ${output.error}\n\n`;
    } else {
      contextMessage += `${output.content}\n\n`;
    }
  }

  contextMessage += `## Original Check-In Data\n${request.sharedContext}\n\n`;
  contextMessage += `## Draft Plan\n${request.draftPlan}\n\n`;
  contextMessage += `The athlete has reviewed the plan above and wants to discuss it. Answer their questions and make adjustments as needed.`;

  messages.push({ role: 'user', content: contextMessage });

  // First assistant message: the draft plan (so the model "remembers" what it produced)
  messages.push({ role: 'assistant', content: request.draftPlan });

  // Append conversation history
  for (const msg of request.conversationHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // Append the new message
  messages.push({ role: 'user', content: request.message });

  return messages;
}

// ── Streaming Response ───────────────────────────────────────────────────────

export async function* streamDialogueResponse(
  request: DialogueRequest
): AsyncGenerator<string> {
  const client = getClient();
  const systemPrompt = buildSystemPrompt();
  const messages = buildDialogueMessages(request);

  const stream = client.messages.stream({
    model: OPUS_MODEL,
    max_tokens: 4000,
    system: systemPrompt,
    messages,
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
