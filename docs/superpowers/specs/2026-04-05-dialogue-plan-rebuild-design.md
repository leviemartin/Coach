# Dialogue-Triggered Plan Rebuilds

**Date:** 2026-04-05
**Status:** Approved
**Problem:** The Head Coach dialogue says it updates the plan but the plan preview cards never change. The coach outputs prose descriptions of changes, but the structured plan in the DB is untouched.

## Solution

Give the dialogue coach a `request_plan_update` tool. When the coach agrees to modify the plan, it calls the tool with natural language instructions. The backend intercepts the tool call, runs the plan builder with those instructions, persists the result, and streams the updated plan to the frontend.

## Architecture

### New Tool: `request_plan_update`

```json
{
  "name": "request_plan_update",
  "description": "Call this when you have agreed to modify the training plan. Provide clear instructions describing what to change.",
  "input_schema": {
    "type": "object",
    "properties": {
      "instructions": {
        "type": "string",
        "description": "Natural language description of plan modifications"
      }
    },
    "required": ["instructions"]
  }
}
```

The coach calls this AFTER outputting its text explanation. The tool is defined in `lib/dialogue.ts` and passed to the Anthropic API's `tools` parameter.

### Dialogue API Route Changes (`app/api/checkin/dialogue/route.ts`)

Current flow: stream text chunks → send `dialogue_complete`.

New flow:
1. Stream text as `dialogue_chunk` events (unchanged)
2. When `tool_use` block detected for `request_plan_update`:
   a. Send `dialogue_complete` with text accumulated so far
   b. Send `plan_rebuilding` status event
   c. Extract `instructions` from tool input
   d. Run `runPlanBuilder(synthesisNotes, sharedContext, weekNumber, instructions)`
   e. Validate with `validatePlanRules`, retry once if violations found
   f. Persist: `deletePlanItems(weekNumber)` + `persistWeekPlan(result.data)`
   g. Fetch persisted items + exercises from DB (to get IDs)
   h. Send `plan_updated` event with `{ items, exercises, weekNumber }`
   i. Send tool result back to model: `{ type: "tool_result", content: "Plan updated successfully. N sessions persisted." }`
   j. Continue streaming — model may output confirmation text → more `dialogue_chunk` events → final `dialogue_complete`
3. If no tool call: existing behavior (stream text, send `dialogue_complete`)

### Dialogue Request Changes

The dialogue API needs additional fields to run the plan builder:

```typescript
interface DialogueRequest {
  message: string;
  conversationHistory: DialogueMessage[];
  specialistOutputs: AgentOutput[];
  sharedContext: string;       // Was always empty — now populated
  draftPlan: string;
  synthesisNotes: string;      // NEW: original synthesis text for plan builder
  weekNumber: number;          // NEW: plan week number
}
```

### Coach System Prompt Update (`lib/dialogue.ts`)

Replace rule #8:
```
8. **When the athlete requests a change to the plan**, describe what you're changing and why, then call the `request_plan_update` tool with clear instructions for the Plan Builder. Do NOT output workout tables or exercise lists — the Plan Builder handles structured output.
```

### Shared Context Flow

Currently `HeadCoachDialogue` sends `sharedContext: ''`. Fix:

1. In the checkin SSE handler (`results/page.tsx`), store shared context when `synthesis_done` event arrives — but the shared context isn't in that event. Instead:
2. The `synthesis_done` event already sends `fullText`. We add a new SSE event `context_ready` from the checkin API that sends a flag, and store the synthesis text in `sessionStorage` (already done).
3. Simpler approach: the dialogue API route reconstructs the shared context server-side using the same `buildSharedContext` function. It needs the Garmin data (read from file) and subjective data. Since subjective data is already captured in the synthesis and specialist outputs, the plan builder can work with `synthesisNotes` + `sharedContext` from the checkin.

**Decision:** Pass `synthesisNotes` (the full synthesis coach text) and `weekNumber` from the frontend. The dialogue API route reads Garmin data and ceilings server-side (same as the checkin route does). The `sharedContext` parameter in DialogueRequest is repurposed to carry the original shared context — the frontend stores it in sessionStorage during the checkin and passes it through.

### Frontend: Store Shared Context (`results/page.tsx`)

In the `synthesis_done` SSE handler, the shared context isn't available (it was built server-side). Two options:

1. Add shared context to the `synthesis_done` event payload
2. Have the dialogue API reconstruct it server-side

**Decision:** Option 2. The dialogue API reads Garmin data fresh via `readGarminData()` and calls `buildSharedContext()`. The frontend passes `synthesisNotes` (stored in sessionStorage as `checkin_synthesis`) and `weekNumber`. No need to shuttle the full context through the browser.

### Frontend: HeadCoachDialogue Changes

New SSE events to handle:
- `plan_rebuilding` — show loading state on plan preview
- `plan_updated` — update plan items and exercises, clear loading state

Props changes:
```typescript
interface HeadCoachDialogueProps {
  specialistOutputs: SpecialistOutput[];
  synthesis: string;
  weekNumber: number;
  onLockIn: () => void;
  onPlanUpdate?: (items: PlanItem[], exercises: Record<number, PlanExercise[]>, updatedSynthesis: string) => void;
  onPlanRebuilding?: () => void;  // NEW: signal loading state
}
```

The `onPlanUpdate` signature changes to include exercises (structured data from DB, not parsed from text).

### Frontend: Results Page Changes

- `handlePlanUpdate` receives items + exercises + synthesis, updates all three state vars
- New `handlePlanRebuilding` sets a loading state that PlanPreview can show
- Remove `parseScheduleTable` import and all text-parsing fallback logic from HeadCoachDialogue

### Multiple Rebuilds

Each `request_plan_update` tool call triggers a fresh rebuild. No limits. The coach naturally batches when the user gives multiple changes at once. Each rebuild replaces the previous plan in the DB.

## SSE Event Reference

| Event | Payload | When |
|-------|---------|------|
| `dialogue_chunk` | `{ text }` | Coach text streaming |
| `dialogue_complete` | `{ fullText }` | Coach text finished (before or after rebuild) |
| `plan_rebuilding` | `{}` | Plan builder starting |
| `plan_updated` | `{ items, exercises, weekNumber }` | Plan rebuilt and persisted |
| `error` | `{ message }` | Any error |

## Error Handling

- Plan builder fails: send `error` event with message, coach text still visible. Plan preview stays on previous version.
- Plan validation fails after retry: send `error` event. Previous plan unchanged.
- Coach doesn't call tool (just discusses without changing): no rebuild, existing behavior.

## Files Changed

| File | Change |
|------|--------|
| `lib/dialogue.ts` | Add tool definition, update system prompt rule #8, change streaming to handle tool_use |
| `app/api/checkin/dialogue/route.ts` | Add plan builder imports, handle tool_use block, send new SSE events |
| `app/checkin/results/page.tsx` | Pass synthesisNotes + weekNumber to dialogue, handle plan_rebuilding/plan_updated, store/pass shared context |
| `components/checkin/HeadCoachDialogue.tsx` | Handle new SSE events, remove parseScheduleTable fallback, update onPlanUpdate signature |
| `components/checkin/PlanPreview.tsx` | Add optional loading/updating overlay state |
