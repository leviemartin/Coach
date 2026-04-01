import { NextResponse } from 'next/server';
import { readWeeklyLogSynthesis } from '@/lib/state';
import { parseScheduleTable } from '@/lib/parse-schedule';
import { deletePlanItems, insertPlanItems, getLatestWeekNumber, getPlanItems } from '@/lib/db';

export async function POST(request: Request) {
  let weekNumber: number;

  try {
    const body = await request.json().catch(() => ({}));
    weekNumber = body.weekNumber ?? getLatestWeekNumber();
  } catch {
    weekNumber = getLatestWeekNumber();
  }

  if (!weekNumber) {
    return NextResponse.json({ error: 'No week number found' }, { status: 400 });
  }

  // Check if week already has structured plan data
  const existingItems = getPlanItems(weekNumber);
  const hasStructured = existingItems.some(item => item.hasStructuredExercises);
  if (hasStructured) {
    return NextResponse.json({
      success: true,
      weekNumber,
      itemCount: existingItems.length,
      items: existingItems.map((p) => ({ day: p.day, focus: p.focus })),
      message: 'Week already has structured plan data. No reimport needed.',
    });
  }

  // Legacy fallback: re-parse synthesis text
  const synthesis = readWeeklyLogSynthesis(weekNumber);
  if (!synthesis) {
    return NextResponse.json(
      { error: `No Head Coach Synthesis found for week ${weekNumber}` },
      { status: 404 }
    );
  }

  const planItems = parseScheduleTable(synthesis, weekNumber);
  if (planItems.length === 0) {
    return NextResponse.json(
      { error: `No schedule table found in week ${weekNumber} synthesis` },
      { status: 404 }
    );
  }

  deletePlanItems(weekNumber);
  insertPlanItems(planItems);

  return NextResponse.json({
    success: true,
    weekNumber,
    itemCount: planItems.length,
    items: planItems.map((p) => ({ day: p.day, focus: p.focus })),
  });
}
