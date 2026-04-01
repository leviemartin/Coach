// dashboard/scripts/migrate-week-14.ts
// Run with: cd dashboard && npx tsx scripts/migrate-week-14.ts

import { getDb } from '../lib/db';
import { runPlanBuilder } from '../lib/plan-builder';
import { validatePlanRules, formatViolationsForFix } from '../lib/plan-validator';
import { persistWeekPlan } from '../lib/plan-db';
import { getTrainingWeek } from '../lib/week';

async function main() {
  const db = getDb();
  const weekNumber = getTrainingWeek();

  console.log(`Migrating Week ${weekNumber} to structured format...`);

  // Step 1: Read existing plan items
  const existingItems = db.prepare(
    'SELECT * FROM plan_items WHERE week_number = ? ORDER BY day_order'
  ).all(weekNumber) as Array<Record<string, unknown>>;

  if (existingItems.length === 0) {
    console.log('No plan items found for this week.');
    return;
  }

  console.log(`Found ${existingItems.length} plan items.`);

  // Step 2: Build context from existing plan text
  const planSummary = existingItems.map((item) => {
    return `${item.day}: ${item.session_type} — ${item.focus}\nWorkout: ${item.workout_plan}\nCues: ${item.coach_cues}`;
  }).join('\n\n');

  const synthesisNotes = 'Migration from text-based plan. Preserve all exercises, weights, and structure from the existing plan.';

  // Step 3: Run Plan Builder
  console.log('Running Plan Builder...');
  let result = await runPlanBuilder(
    `${synthesisNotes}\n\n## Existing Plan to Restructure\n${planSummary}`,
    'Migration context — restructure existing plan into JSON format.',
    weekNumber,
  );

  // Step 4: Validate and retry
  if (result.success) {
    const violations = validatePlanRules(result.data);
    if (violations.length > 0) {
      console.log(`Validator found ${violations.length} violations. Retrying...`);
      const fixInstructions = formatViolationsForFix(violations);
      result = await runPlanBuilder(
        `${synthesisNotes}\n\n## Existing Plan to Restructure\n${planSummary}`,
        'Migration context.',
        weekNumber,
        fixInstructions,
      );
    }
  }

  if (!result.success) {
    console.error('Plan Builder failed:', result.error);
    process.exit(1);
  }

  // Step 5: Delete old plan items and persist new structured data
  console.log('Persisting structured plan...');
  db.prepare('DELETE FROM plan_items WHERE week_number = ?').run(weekNumber);
  const { planItemIds } = persistWeekPlan(result.data);
  console.log(`Created ${planItemIds.length} structured plan items.`);

  // Step 6: Clean session data for this week
  console.log('Cleaning session data for re-entry...');
  const sessionRows = db.prepare(
    'SELECT id FROM session_logs WHERE week_number = ?'
  ).all(weekNumber) as Array<{ id: number }>;

  for (const row of sessionRows) {
    db.prepare('DELETE FROM session_exercise_feedback WHERE session_log_id = ?').run(row.id);
    db.prepare('DELETE FROM session_sets WHERE session_log_id = ?').run(row.id);
    db.prepare('DELETE FROM session_cardio WHERE session_log_id = ?').run(row.id);
  }
  db.prepare('DELETE FROM session_logs WHERE week_number = ?').run(weekNumber);
  console.log(`Cleaned ${sessionRows.length} sessions.`);

  console.log('Migration complete. Re-enter completed sessions through the session page.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
