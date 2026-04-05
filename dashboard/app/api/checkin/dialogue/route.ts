import { NextResponse } from 'next/server';
import { streamDialogueResponse } from '@/lib/dialogue';
import type { DialogueRequest, DialogueMessage } from '@/lib/dialogue';
import type { AgentOutput } from '@/lib/types';

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
      { status: 400 },
    );
  }

  const dialogueRequest: DialogueRequest = {
    message: body.message,
    conversationHistory: body.conversationHistory as DialogueMessage[],
    specialistOutputs: body.specialistOutputs as AgentOutput[],
    sharedContext: body.sharedContext,
    draftPlan: body.draftPlan,
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

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      try {
        let fullText = '';
        for await (const chunk of streamDialogueResponse(dialogueRequest)) {
          fullText += chunk;
          send('dialogue_chunk', { text: chunk });
        }

        send('dialogue_complete', { fullText });
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
