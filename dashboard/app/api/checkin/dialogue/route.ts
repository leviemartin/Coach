import { NextResponse } from 'next/server';
import { streamDialogueResponse } from '@/lib/dialogue';
import { streamDialogueAfterToolResult } from '@/lib/dialogue';
import type { DialogueRequest, DialogueMessage, DialogueStreamEvent } from '@/lib/dialogue';
import { runPlanBuilder } from '@/lib/plan-builder';
import { validatePlanRules, formatViolationsForFix } from '@/lib/plan-validator';
import { persistWeekPlan, getPlanExercises } from '@/lib/plan-db';
import { deletePlanItems, getPlanItems } from '@/lib/db';
import { getPlanWeekNumber } from '@/lib/week';
import type { AgentOutput, PlanExercise } from '@/lib/types';

function isValidDialogueRequest(body: unknown): body is DialogueRequest {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;

  if (typeof b.message !== 'string' || b.message.trim().length === 0) return false;
  if (!Array.isArray(b.conversationHistory)) return false;
  if (!Array.isArray(b.specialistOutputs)) return false;
  for (const out of b.specialistOutputs as unknown[]) {
    if (typeof out !== 'object' || out === null) return false;
    const o = out as Record<string, unknown>;
    if (typeof o.label !== 'string') return false;
    if (typeof o.content !== 'string' && typeof o.error !== 'string') return false;
  }
  if (typeof b.sharedContext !== 'string') return false;
  if (typeof b.draftPlan !== 'string') return false;
  if (b.synthesisNotes !== undefined && typeof b.synthesisNotes !== 'string') return false;
  if (b.weekNumber !== undefined && typeof b.weekNumber !== 'number') return false;

  // Validate conversation history entries
  for (const msg of b.conversationHistory as unknown[]) {
    if (typeof msg !== 'object' || msg === null) return false;
    const m = msg as Record<string, unknown>;
    if (m.role !== 'user' && m.role !== 'assistant') return false;
    if (typeof m.content !== 'string') return false;
  }

  return true;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not set.' },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isValidDialogueRequest(body)) {
    return NextResponse.json(
      { error: 'Invalid request. Required: message (non-empty string), conversationHistory, specialistOutputs, sharedContext, draftPlan.' },
      { status: 400 }
    );
  }

  const dialogueRequest: DialogueRequest = {
    message: body.message,
    conversationHistory: body.conversationHistory as DialogueMessage[],
    specialistOutputs: body.specialistOutputs as AgentOutput[],
    sharedContext: body.sharedContext,
    draftPlan: body.draftPlan,
    synthesisNotes: (body.synthesisNotes as string | undefined) ?? '',
    weekNumber: (body.weekNumber as number | undefined) ?? getPlanWeekNumber(),
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Controller may be closed if client disconnected
        }
      }

      // Heartbeat every 30s to prevent proxy idle timeout
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      try {
        let fullText = '';
        let toolWasCalled = false;

        for await (const event of streamDialogueResponse(dialogueRequest)) {
          if (event.type === 'text') {
            fullText += event.text;
            send('dialogue_chunk', { text: event.text });
          } else if (event.type === 'tool_use' && event.toolName === 'request_plan_update') {
            toolWasCalled = true;

            // Send the coach's explanation text
            send('dialogue_complete', { fullText });

            // Signal plan rebuild
            send('plan_rebuilding', {});

            // Run plan builder
            const instructions = event.toolInput?.instructions ?? '';
            const weekNumber = dialogueRequest.weekNumber ?? getPlanWeekNumber();

            let planResult = await runPlanBuilder(
              dialogueRequest.synthesisNotes ?? '',
              dialogueRequest.sharedContext,
              weekNumber,
              instructions,
            );

            // Validate and retry once
            if (planResult.success) {
              const violations = validatePlanRules(planResult.data);
              if (violations.length > 0) {
                const fixInstructions = instructions + '\n\nALSO FIX:\n' + formatViolationsForFix(violations);
                planResult = await runPlanBuilder(
                  dialogueRequest.synthesisNotes ?? '',
                  dialogueRequest.sharedContext,
                  weekNumber,
                  fixInstructions,
                );
              }
            }

            if (planResult.success) {
              // Persist
              deletePlanItems(weekNumber);
              persistWeekPlan(planResult.data);

              // Fetch from DB with IDs
              const items = getPlanItems(weekNumber);
              const exercises: Record<number, PlanExercise[]> = {};
              for (const item of items) {
                if (item.id) {
                  exercises[item.id] = getPlanExercises(item.id);
                }
              }

              send('plan_updated', { items, exercises, weekNumber });

              // Coach confirms
              let confirmText = '';
              const resultMsg = `Plan updated: ${items.length} sessions saved.`;
              for await (const contEvent of streamDialogueAfterToolResult(
                dialogueRequest, resultMsg
              )) {
                if (contEvent.type === 'text') {
                  confirmText += contEvent.text;
                  send('dialogue_chunk', { text: contEvent.text });
                }
              }
              if (confirmText) {
                send('dialogue_complete', { fullText: confirmText });
              }
            } else {
              send('error', { message: `Plan rebuild failed: ${planResult.error}` });
            }
          }
        }

        // No tool call — send dialogue_complete normally
        if (!toolWasCalled) {
          send('dialogue_complete', { fullText });
        }
      } catch (error) {
        send('error', {
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
