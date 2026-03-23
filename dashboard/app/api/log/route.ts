import { NextResponse } from 'next/server';
import { getDailyLog, upsertDailyLog, getPlanItems, getAllDailyLogs, getUncompletedSessionsForWeek, getDailyNotes } from '@/lib/db';
import { getWeekForDate, getDayName, getDayAbbrev, findPlanItemForDate, computeStreak } from '@/lib/daily-log';

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

  const uncompletedSessions = getUncompletedSessionsForWeek(weekNumber);

  const allLogs = getAllDailyLogs();
  const datesWithSessions = allLogs
    .filter(l => {
      const dn = getDayName(l.date);
      const da = getDayAbbrev(l.date);
      const items = getPlanItems(l.week_number);
      return items.some((item: { day: string }) =>
        item.day === dn || item.day.startsWith(da)
      );
    })
    .map(l => l.date);

  const streak = computeStreak(allLogs, date, datesWithSessions);

  const dailyNotes = log ? getDailyNotes(log.id) : [];

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
      energy_level: null,
      pain_level: null,
      pain_area: null,
      sleep_disruption: null,
      session_summary: null,
      session_log_id: null,
    },
    daily_notes: dailyNotes,
    planned_session: plannedSession,
    uncompleted_sessions: uncompletedSessions,
    streak,
  });
}

export async function PUT(request: Request) {
  const body = await request.json();

  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ error: 'Invalid date (YYYY-MM-DD)' }, { status: 400 });
  }

  const weekNumber = getWeekForDate(body.date);
  const planItemId = body.workout_plan_item_id != null
    ? body.workout_plan_item_id
    : (findPlanItemForDate(body.date)?.id || null);

  const energyLevel: number | null = body.energy_level ?? null;
  if (energyLevel !== null) {
    if (!Number.isInteger(energyLevel) || energyLevel < 1 || energyLevel > 5) {
      return NextResponse.json({ error: 'energy_level must be an integer between 1 and 5' }, { status: 400 });
    }
  }

  const painLevel: number | null = body.pain_level ?? null;
  if (painLevel !== null) {
    if (!Number.isInteger(painLevel) || painLevel < 0 || painLevel > 3) {
      return NextResponse.json({ error: 'pain_level must be an integer between 0 and 3 (0=none, 1=mild, 2=moderate, 3=stop)' }, { status: 400 });
    }
  }

  // Preserve fields that are set by other handlers (sleep disruption = Task A4,
  // session_summary / session_log_id = Task A9 session tracker writeback)
  const existing = getDailyLog(body.date);

  const saved = upsertDailyLog({
    date: body.date,
    week_number: weekNumber,
    workout_completed: body.workout_completed ? 1 : 0,
    workout_plan_item_id: planItemId,
    core_work_done: body.core_work_done ? 1 : 0,
    rug_protocol_done: body.rug_protocol_done ? 1 : 0,
    vampire_bedtime: body.vampire_bedtime || null,
    hydration_tracked: body.hydration_tracked ? 1 : 0,
    kitchen_cutoff_hit: body.kitchen_cutoff_hit ? 1 : 0,
    is_sick_day: body.is_sick_day ? 1 : 0,
    notes: body.notes || null,
    energy_level: energyLevel,
    pain_level: painLevel,
    pain_area: painLevel != null && painLevel > 0 ? (body.pain_area || null) : null,
    // Preserve fields owned by other handlers — do not overwrite
    sleep_disruption: existing?.sleep_disruption ?? null,
    session_summary: existing?.session_summary ?? null,
    session_log_id: existing?.session_log_id ?? null,
  });

  return NextResponse.json({ log: saved });
}
