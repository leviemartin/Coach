# Dialogue-Triggered Plan Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the Head Coach dialogue agrees to change the training plan, trigger a plan builder re-run and update the plan preview cards in real time.

**Architecture:** Add a `request_plan_update` tool to the dialogue coach. The dialogue API route detects tool_use, runs the plan builder with modification instructions, persists the result, and streams updated plan data to the frontend via SSE.

**Tech Stack:** Anthropic API (tool_use), Next.js API routes, SSE streaming, SQLite (better-sqlite3)

---

### Task 1: Add tool definition and update system prompt in dialogue.ts

**Files:**
- Modify: `dashboard/lib/dialogue.ts`

- [ ] **Step 1: Add the tool definition constant**

Add after the imports at the top of the file:

```typescript
// ── Plan Update Tool ────────────────────────────────────────────────────────

export const PLAN_UPDATE_TOOL = {
  name: 'request_plan_update',
  description: 'Call this when you have agreed to modify the training plan. Provide clear instructions describing what to change. Output your text explanation FIRST, then call this tool.',
  input_schema: {
    type: 'object' as const,
    properties: {
      instructions: {
        type: 'string',
        description: 'Natural language description of plan modifications for the Plan Builder',
      },
    },
    required: ['instructions'],
  },
};
```

- [ ] **Step 2: Update system prompt rule #8**

In `buildSystemPrompt()`, replace rule 8:

Old:
```
8. **When the athlete requests a change to the plan**, describe the change you're making and why. Be specific about which session and exercises are affected. The system will route your description to the Plan Builder to produce updated structured data. Do NOT output workout tables, exercise lists, or pipe-separated schedules.
```

New:
```
8. **When the athlete requests a change to the plan**, describe what you're changing and why, then call the \`request_plan_update\` tool with clear instructions for the Plan Builder. Be specific about which sessions and exercises to change. Do NOT output workout tables, exercise lists, or pipe-separated schedules — the Plan Builder handles structured output.
```

- [ ] **Step 3: Add `synthesisNotes` and `weekNumber` to DialogueRequest**

Update the `DialogueRequest` interface:

```typescript
export interface DialogueRequest {
  message: string;
  conversationHistory: DialogueMessage[];
  specialistOutputs: AgentOutput[];
  sharedContext: string;
  draftPlan: string;
  synthesisNotes: string;  // Original synthesis text for plan builder
  weekNumber: number;      // Plan week number
}
```

- [ ] **Step 4: Update streaming to use tool_use mode**

Replace the `streamDialogueResponse` function:

```typescript
export interface DialogueStreamEvent {
  type: 'text' | 'tool_use';
  text?: string;
  toolName?: string;
  toolInput?: { instructions: string };
}

export async function* streamDialogueResponse(
  request: DialogueRequest
): AsyncGenerator<DialogueStreamEvent> {
  const client = getClient();
  const systemPrompt = buildSystemPrompt();
  const messages = buildDialogueMessages(request);

  const stream = client.messages.stream({
    model: OPUS_MODEL,
    max_tokens: 4000,
    system: systemPrompt,
    messages,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [PLAN_UPDATE_TOOL as any],
  });

  let currentToolName = '';
  let toolInputJson = '';

  for await (const event of stream) {
    if (
      event.type === 'content_block_start' &&
      'content_block' in event &&
      event.content_block.type === 'tool_use'
    ) {
      currentToolName = event.content_block.name;
      toolInputJson = '';
    } else if (
      event.type === 'content_block_delta' &&
      'delta' in event
    ) {
      if (event.delta.type === 'text_delta' && 'text' in event.delta) {
        yield { type: 'text', text: event.delta.text };
      } else if (event.delta.type === 'input_json_delta' && 'partial_json' in event.delta) {
        toolInputJson += event.delta.partial_json;
      }
    } else if (
      event.type === 'content_block_stop' &&
      currentToolName === 'request_plan_update'
    ) {
      try {
        const parsed = JSON.parse(toolInputJson) as { instructions: string };
        yield { type: 'tool_use', toolName: currentToolName, toolInput: parsed };
      } catch {
        // Malformed tool input — skip
      }
      currentToolName = '';
      toolInputJson = '';
    }
  }
}
```

- [ ] **Step 5: Add a function to continue the conversation after tool result**

```typescript
export async function* streamDialogueAfterToolResult(
  request: DialogueRequest,
  toolUseId: string,
  toolResultContent: string,
): AsyncGenerator<DialogueStreamEvent> {
  const client = getClient();
  const systemPrompt = buildSystemPrompt();
  const messages = buildDialogueMessages(request);

  // Append the assistant's tool_use and the tool result
  // The last assistant message needs to include the tool_use block
  // We'll construct the full continuation messages
  messages.push({
    role: 'assistant',
    content: `[Plan has been updated]`,
  });
  messages.push({
    role: 'user',
    content: `The plan has been rebuilt and saved: ${toolResultContent}. Confirm the changes briefly.`,
  });

  const stream = client.messages.stream({
    model: OPUS_MODEL,
    max_tokens: 1000,
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
      yield { type: 'text', text: event.delta.text };
    }
  }
}
```

- [ ] **Step 6: Verify the file compiles**

Run: `cd dashboard && npx tsc --noEmit lib/dialogue.ts 2>&1 | head -20`

- [ ] **Step 7: Commit**

```bash
git add dashboard/lib/dialogue.ts
git commit -m "feat: add request_plan_update tool to dialogue coach"
```

---

### Task 2: Update dialogue API route to handle tool_use and trigger plan builder

**Files:**
- Modify: `dashboard/app/api/checkin/dialogue/route.ts`

- [ ] **Step 1: Add imports for plan builder and plan persistence**

Add to the top imports:

```typescript
import { streamDialogueAfterToolResult } from '@/lib/dialogue';
import type { DialogueStreamEvent } from '@/lib/dialogue';
import { runPlanBuilder } from '@/lib/plan-builder';
import { validatePlanRules, formatViolationsForFix } from '@/lib/plan-validator';
import { persistWeekPlan } from '@/lib/plan-db';
import { getPlanExercises } from '@/lib/plan-db';
import { deletePlanItems, getPlanItems } from '@/lib/db';
import { getPlanWeekNumber } from '@/lib/week';
import type { PlanItem, PlanExercise } from '@/lib/types';
```

- [ ] **Step 2: Update request validation to accept new fields**

In `isValidDialogueRequest`, add optional validation for the new fields:

```typescript
  // synthesisNotes and weekNumber are optional for backwards compat but needed for plan rebuilds
  if (b.synthesisNotes !== undefined && typeof b.synthesisNotes !== 'string') return false;
  if (b.weekNumber !== undefined && typeof b.weekNumber !== 'number') return false;
```

Add them to the `dialogueRequest` construction:

```typescript
  const dialogueRequest: DialogueRequest = {
    message: body.message,
    conversationHistory: body.conversationHistory as DialogueMessage[],
    specialistOutputs: body.specialistOutputs as AgentOutput[],
    sharedContext: body.sharedContext,
    draftPlan: body.draftPlan,
    synthesisNotes: (body as Record<string, unknown>).synthesisNotes as string ?? '',
    weekNumber: (body as Record<string, unknown>).weekNumber as number ?? getPlanWeekNumber(),
  };
```

- [ ] **Step 3: Replace the streaming loop to handle DialogueStreamEvent**

Replace the try block inside the stream's `start` function:

```typescript
      try {
        let fullText = '';

        for await (const event of streamDialogueResponse(dialogueRequest)) {
          if (event.type === 'text') {
            fullText += event.text;
            send('dialogue_chunk', { text: event.text });
          } else if (event.type === 'tool_use' && event.toolName === 'request_plan_update') {
            // 1. Send the text accumulated so far
            send('dialogue_complete', { fullText });

            // 2. Signal plan rebuild starting
            send('plan_rebuilding', {});

            // 3. Run plan builder with modification instructions
            const instructions = event.toolInput?.instructions ?? '';
            const weekNumber = dialogueRequest.weekNumber;
            const synthesisNotes = dialogueRequest.synthesisNotes;
            const sharedContext = dialogueRequest.sharedContext;

            let planResult = await runPlanBuilder(synthesisNotes, sharedContext, weekNumber, instructions);

            // Validate and retry once if needed
            if (planResult.success) {
              const violations = validatePlanRules(planResult.data);
              if (violations.length > 0) {
                const fixInstructions = instructions + '\n\nALSO FIX:\n' + formatViolationsForFix(violations);
                planResult = await runPlanBuilder(synthesisNotes, sharedContext, weekNumber, fixInstructions);
              }
            }

            if (planResult.success) {
              // 4. Persist
              deletePlanItems(weekNumber);
              persistWeekPlan(planResult.data);

              // 5. Fetch back from DB to get IDs
              const items = getPlanItems(weekNumber);
              const exercises: Record<number, PlanExercise[]> = {};
              for (const item of items) {
                if (item.id) {
                  exercises[item.id] = getPlanExercises(item.id);
                }
              }

              // 6. Send updated plan to frontend
              send('plan_updated', { items, exercises, weekNumber });

              // 7. Continue conversation — coach confirms
              let confirmText = '';
              const resultMsg = `Plan updated successfully. ${items.length} sessions persisted.`;
              for await (const contEvent of streamDialogueAfterToolResult(
                dialogueRequest, '', resultMsg
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

        // If no tool was called, send dialogue_complete with all text
        if (fullText && !fullText.endsWith('[already sent]')) {
          send('dialogue_complete', { fullText });
        }
      } catch (error) {
        send('error', {
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
```

Wait — the issue with the above is that `dialogue_complete` would be sent twice when there's no tool call. Let me fix the logic:

Replace the entire try block:

```typescript
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
            const weekNumber = dialogueRequest.weekNumber;

            let planResult = await runPlanBuilder(
              dialogueRequest.synthesisNotes,
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
                  dialogueRequest.synthesisNotes,
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
                dialogueRequest, '', resultMsg
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
      }
```

- [ ] **Step 4: Verify compilation**

Run: `cd dashboard && npx tsc --noEmit 2>&1 | grep 'dialogue/route' | head -10`

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/api/checkin/dialogue/route.ts
git commit -m "feat: dialogue route handles plan rebuild via tool_use"
```

---

### Task 3: Update HeadCoachDialogue to handle plan_rebuilding and plan_updated events

**Files:**
- Modify: `dashboard/components/checkin/HeadCoachDialogue.tsx`

- [ ] **Step 1: Update props interface**

```typescript
interface HeadCoachDialogueProps {
  specialistOutputs: SpecialistOutput[];
  synthesis: string;
  weekNumber: number;
  onLockIn: () => void;
  onPlanUpdate?: (items: PlanItem[], exercises: Record<number, PlanExercise[]>) => void;
  onPlanRebuilding?: () => void;
}
```

Add the `PlanExercise` import at top:

```typescript
import type { PlanItem, PlanExercise } from '@/lib/types';
```

- [ ] **Step 2: Update the request body to include synthesisNotes and weekNumber**

In `sendMessage`, update the fetch body:

```typescript
        body: JSON.stringify({
          message: trimmed,
          conversationHistory: messages,
          specialistOutputs: specialistOutputs.map((s) => ({
            agentId: s.agentId,
            label: s.label,
            content: s.content,
            model: '',
            error: s.error ?? undefined,
          })),
          sharedContext: '',
          draftPlan: currentDraftPlan,
          synthesisNotes: synthesis,
          weekNumber,
        }),
```

- [ ] **Step 3: Handle new SSE events in the event loop**

Add cases to the switch statement inside the SSE parsing loop:

```typescript
                case 'plan_rebuilding':
                  if (onPlanRebuilding) onPlanRebuilding();
                  break;
                case 'plan_updated': {
                  if (onPlanUpdate) {
                    onPlanUpdate(data.items, data.exercises ?? {});
                  }
                  break;
                }
```

- [ ] **Step 4: Remove parseScheduleTable fallback logic**

Remove the import:
```typescript
// DELETE: import { parseScheduleTable } from '@/lib/parse-schedule';
```

Remove the plan detection in the `dialogue_complete` handler and the fallback path. The `dialogue_complete` handler should just commit the text:

```typescript
                case 'dialogue_complete': {
                  const coachText: string = data.fullText;
                  setMessages((prev) => [
                    ...prev,
                    { role: 'assistant', content: coachText },
                  ]);
                  setStreamingText('');
                  setStreaming(false);
                  break;
                }
```

Also remove the parseScheduleTable fallback at the end of the stream reading (the "If stream ended without dialogue_complete" block). Replace with:

```typescript
      // If stream ended without dialogue_complete, commit whatever we have
      if (fullCoachText) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: fullCoachText },
        ]);
        setStreamingText('');
        setStreaming(false);
      }
```

- [ ] **Step 5: Update the component signature to destructure new props**

```typescript
export default function HeadCoachDialogue({
  specialistOutputs,
  synthesis,
  weekNumber,
  onLockIn,
  onPlanUpdate,
  onPlanRebuilding,
}: HeadCoachDialogueProps) {
```

Update the `useCallback` dependency array to include `synthesis`:

```typescript
  }, [input, streaming, messages, specialistOutputs, currentDraftPlan, weekNumber, onPlanUpdate, onPlanRebuilding, synthesis]);
```

- [ ] **Step 6: Verify compilation**

Run: `cd dashboard && npx tsc --noEmit 2>&1 | grep 'HeadCoachDialogue' | head -10`

- [ ] **Step 7: Commit**

```bash
git add dashboard/components/checkin/HeadCoachDialogue.tsx
git commit -m "feat: HeadCoachDialogue handles plan_rebuilding and plan_updated SSE events"
```

---

### Task 4: Update results page to wire up plan rebuilding state and new props

**Files:**
- Modify: `dashboard/app/checkin/results/page.tsx`

- [ ] **Step 1: Add planRebuilding state**

```typescript
  const [planRebuilding, setPlanRebuilding] = useState(false);
```

- [ ] **Step 2: Update handlePlanUpdate to accept exercises**

```typescript
  const handlePlanUpdate = (items: PlanItem[], exercises: Record<number, PlanExercise[]>) => {
    setPlanItems(items);
    setPlanExercises(exercises);
    setPlanModifiedByDialogue(true);
    setPlanRebuilding(false);
  };
```

- [ ] **Step 3: Add handlePlanRebuilding**

```typescript
  const handlePlanRebuilding = () => {
    setPlanRebuilding(true);
  };
```

- [ ] **Step 4: Update handleLockIn — no need to PUT plan since it's already persisted**

Remove the `planModifiedByDialogue` PUT block. The dialogue route now persists the plan directly. `handleLockIn` just locks:

```typescript
  const handleLockIn = async () => {
    const wk = weekNumber ?? getPlanWeekNumber();

    try {
      await fetch('/api/plan/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekNumber: wk }),
      });
    } catch {
      // Non-fatal
    }

    router.push('/log');
  };
```

Remove the `planModifiedByDialogue` state variable (no longer needed).

- [ ] **Step 5: Pass new props to HeadCoachDialogue**

```typescript
      <HeadCoachDialogue
        specialistOutputs={specialists}
        synthesis={currentSynthesis || synthesis}
        weekNumber={weekNumber}
        onLockIn={handleLockIn}
        onPlanUpdate={handlePlanUpdate}
        onPlanRebuilding={handlePlanRebuilding}
      />
```

- [ ] **Step 6: Pass planRebuilding to PlanPreview**

```typescript
      <PlanPreview
        items={planItems}
        exercises={planExercises}
        weekNumber={weekNumber}
        onLockIn={handleLockIn}
        onDiscuss={handleDiscuss}
        loading={planRebuilding}
      />
```

- [ ] **Step 7: Verify compilation**

Run: `cd dashboard && npx tsc --noEmit 2>&1 | grep 'results/page' | head -10`

- [ ] **Step 8: Commit**

```bash
git add dashboard/app/checkin/results/page.tsx
git commit -m "feat: results page wires plan rebuilding state to dialogue and preview"
```

---

### Task 5: Add loading overlay to PlanPreview

**Files:**
- Modify: `dashboard/components/checkin/PlanPreview.tsx`

- [ ] **Step 1: Add `loading` prop**

```typescript
interface PlanPreviewProps {
  items: PlanItem[];
  exercises: Record<number, PlanExercise[]>;
  weekNumber: number;
  onLockIn: () => void;
  onDiscuss?: () => void;
  loading?: boolean;
}
```

Update the destructure:

```typescript
export default function PlanPreview({ items, exercises, weekNumber, onLockIn, onDiscuss, loading }: PlanPreviewProps) {
```

- [ ] **Step 2: Add loading overlay above the day cards**

After the header row and before the day cards `<Box>`, add:

```typescript
      {loading && (
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
          py: 3,
          my: 2,
          border: '3px solid #e4e4e0',
          bgcolor: '#fafaf7',
        }}>
          <CircularProgress size={18} sx={{ color: '#18181b' }} />
          <Typography variant="body2" sx={{ color: '#71717a', fontWeight: 600 }}>
            Rebuilding plan...
          </Typography>
        </Box>
      )}
```

Add `CircularProgress` to the MUI imports:

```typescript
import { Box, Typography, Chip, Button, Divider, CircularProgress } from '@mui/material';
```

- [ ] **Step 3: Dim the day cards when loading**

Wrap the day cards Box with opacity:

```typescript
      <Box sx={{ opacity: loading ? 0.4 : 1, transition: 'opacity 0.3s' }}>
        {items.map((item) => (
          <PlanDayCard ... />
        ))}
      </Box>
```

- [ ] **Step 4: Disable action buttons when loading**

Add `disabled={loading}` to both the Discuss and Lock In buttons.

- [ ] **Step 5: Verify compilation**

Run: `cd dashboard && npx tsc --noEmit 2>&1 | grep 'PlanPreview' | head -10`

- [ ] **Step 6: Commit**

```bash
git add dashboard/components/checkin/PlanPreview.tsx
git commit -m "feat: PlanPreview shows loading overlay during plan rebuild"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Full TypeScript check**

Run: `cd dashboard && npx tsc --noEmit 2>&1 | grep -v '__tests__' | head -20`
Expected: No errors in production code.

- [ ] **Step 2: Build check**

Run: `cd dashboard && npx next build 2>&1 | tail -10`
Expected: Build succeeds, `/api/checkin/dialogue` route listed.

- [ ] **Step 3: Commit any remaining fixes and push**

```bash
git push
```
