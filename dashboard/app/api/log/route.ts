import { NextResponse } from 'next/server';
import { getDailyLog, upsertDailyLog, getPlanItems } from '@/lib/db';
import { getWeekForDate, getDayName, getDayAbbrev, findPlanItemForDate } from '@/lib/daily-log';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date parameter (YYYY-MM-DD)' }, { status: 400 });
  }

  const log = getDailyLog(date);
  const weekNumber = getWeekForDate(date);
  const dayName = getDayName(date);
  const planItems = getPlanItems(weekNumber);
  const dayAbbrev = getDayAbbrev(date);
  const plannedSession = planItems.find((item: { day: string }) =>
    item.day === dayName || item.day.startsWith(dayAbbrev)
  ) || null;

  return NextResponse.json({
    log: log || {
      date,
      week_number: weekNumber,
      workout_completed: 0,
      core_work_done: 0,
      rug_protocol_done: 0,
      vampire_bedtime: null,
      hydration_tracked: 0,
      kitchen_cutoff_hit: 0,
      is_sick_day: 0,
      notes: '',
    },
    planned_session: plannedSession,
  });
}

export async function PUT(request: Request) {
  const body = await request.json();

  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ error: 'Invalid date (YYYY-MM-DD)' }, { status: 400 });
  }

  const weekNumber = getWeekForDate(body.date);
  const planItem = findPlanItemForDate(body.date);

  const saved = upsertDailyLog({
    date: body.date,
    week_number: weekNumber,
    workout_completed: body.workout_completed ? 1 : 0,
    workout_plan_item_id: planItem?.id || null,
    core_work_done: body.core_work_done ? 1 : 0,
    rug_protocol_done: body.rug_protocol_done ? 1 : 0,
    vampire_bedtime: body.vampire_bedtime || null,
    hydration_tracked: body.hydration_tracked ? 1 : 0,
    kitchen_cutoff_hit: body.kitchen_cutoff_hit ? 1 : 0,
    is_sick_day: body.is_sick_day ? 1 : 0,
    notes: body.notes || null,
  });

  return NextResponse.json({ log: saved });
}
