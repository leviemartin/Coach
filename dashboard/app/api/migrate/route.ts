import { NextResponse } from 'next/server';
import { getDb, deletePlanItems } from '@/lib/db';
import { runPlanBuilder } from '@/lib/plan-builder';
import { validatePlanRules, formatViolationsForFix } from '@/lib/plan-validator';
import { persistWeekPlan } from '@/lib/plan-db';
import { getTrainingWeek } from '@/lib/week';

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });
  }

  const db = getDb();
  const weekNumber = getTrainingWeek();
  const log: string[] = [];

  try {
    // Step 1: Read existing plan items
    const existingItems = db.prepare(
      'SELECT * FROM plan_items WHERE week_number = ? ORDER BY day_order'
    ).all(weekNumber) as Array<Record<string, unknown>>;

    if (existingItems.length === 0) {
      return NextResponse.json({ error: 'No plan items found for this week', weekNumber });
    }

    // Check if already migrated
    const alreadyStructured = existingItems.some((item) => item.has_structured_exercises === 1);
    if (alreadyStructured) {
      return NextResponse.json({
        message: 'Week already has structured exercises. No migration needed.',
        weekNumber,
        itemCount: existingItems.length,
      });
    }

    log.push(`Found ${existingItems.length} plan items for week ${weekNumber}`);

    // Step 2: Build context from existing plan text
    const planSummary = existingItems.map((item) => {
      return `${item.day}: ${item.session_type} — ${item.focus}\nWorkout: ${item.workout_plan}\nCues: ${item.coach_cues}`;
    }).join('\n\n');

    const synthesisNotes = 'Migration from text-based plan. Preserve all exercises, weights, and structure from the existing plan exactly as specified.';

    // Step 3: Run Plan Builder
    log.push('Running Plan Builder...');
    let result = await runPlanBuilder(
      `${synthesisNotes}\n\n## Existing Plan to Restructure\n${planSummary}`,
      'Migration context — restructure existing plan into JSON format. Preserve every exercise, weight, set, and rep exactly.',
      weekNumber,
    );

    // Step 4: Validate and retry
    let violations: import('@/lib/plan-validator').PlanViolation[] = [];
    if (result.success) {
      violations = validatePlanRules(result.data);
      if (violations.length > 0) {
        log.push(`Validator found ${violations.length} violations. Retrying...`);
        const fixInstructions = formatViolationsForFix(violations);
        result = await runPlanBuilder(
          `${synthesisNotes}\n\n## Existing Plan to Restructure\n${planSummary}`,
          'Migration context.',
          weekNumber,
          fixInstructions,
        );
        if (result.success) {
          violations = validatePlanRules(result.data);
        }
      }
    }

    if (!result.success) {
      return NextResponse.json({
        error: 'Plan Builder failed',
        details: result.error,
        log,
      }, { status: 500 });
    }

    // Step 5: Clear FK references, delete old plan items, persist new structured data
    log.push('Persisting structured plan...');

    // Null out daily_logs FK references to old plan_items before deletion
    const oldItemIds = existingItems.map(i => i.id as number);
    for (const oldId of oldItemIds) {
      db.prepare('UPDATE daily_logs SET workout_plan_item_id = NULL WHERE workout_plan_item_id = ?').run(oldId);
    }

    deletePlanItems(weekNumber);
    const { planItemIds } = persistWeekPlan(result.data);
    log.push(`Created ${planItemIds.length} structured plan items`);

    // Step 6: Clean session data for this week
    const sessionRows = db.prepare(
      'SELECT id FROM session_logs WHERE week_number = ?'
    ).all(weekNumber) as Array<{ id: number }>;

    for (const row of sessionRows) {
      db.prepare('DELETE FROM session_exercise_feedback WHERE session_log_id = ?').run(row.id);
      db.prepare('DELETE FROM session_sets WHERE session_log_id = ?').run(row.id);
      db.prepare('DELETE FROM session_cardio WHERE session_log_id = ?').run(row.id);
    }
    db.prepare('DELETE FROM session_logs WHERE week_number = ?').run(weekNumber);
    log.push(`Cleaned ${sessionRows.length} sessions`);

    return NextResponse.json({
      success: true,
      weekNumber,
      planItemCount: planItemIds.length,
      sessionsCleared: sessionRows.length,
      remainingViolations: violations.length,
      log,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unknown error',
      log,
    }, { status: 500 });
  }
}
