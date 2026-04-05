import { NextResponse } from 'next/server';
import { runPlanBuilder } from '@/lib/plan-builder';
import { validatePlanRules, formatViolationsForFix } from '@/lib/plan-validator';
import { persistWeekPlan, getPlanExercises } from '@/lib/plan-db';
import { deletePlanItems, getPlanItems } from '@/lib/db';
import { getPlanWeekNumber } from '@/lib/week';
import type { PlanExercise } from '@/lib/types';

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set.' }, { status: 500 });
  }

  let body: { synthesisNotes: string; changeInstructions: string; weekNumber?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { synthesisNotes, changeInstructions } = body;
  if (!synthesisNotes || !changeInstructions) {
    return NextResponse.json(
      { error: 'Required: synthesisNotes and changeInstructions' },
      { status: 400 },
    );
  }

  const weekNumber = body.weekNumber ?? getPlanWeekNumber();

  try {
    // Run plan builder with change instructions
    let planResult = await runPlanBuilder(synthesisNotes, '', weekNumber, changeInstructions);

    // Validate and retry once
    if (planResult.success) {
      const violations = validatePlanRules(planResult.data);
      if (violations.length > 0) {
        const fixInstructions = changeInstructions + '\n\nALSO FIX:\n' + formatViolationsForFix(violations);
        planResult = await runPlanBuilder(synthesisNotes, '', weekNumber, fixInstructions);
      }
    }

    if (!planResult.success) {
      return NextResponse.json({ error: planResult.error }, { status: 500 });
    }

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

    return NextResponse.json({ items, exercises, weekNumber });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Plan rebuild failed' },
      { status: 500 },
    );
  }
}
