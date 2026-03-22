import { NextResponse } from 'next/server';
import { getPlanItems } from '@/lib/db';
import { getTrainingWeek } from '@/lib/week';
import { parseWorkoutPlan } from '@/lib/workout-parser';
import { createSession, getActiveSession, getSessionSets, getSessionCardio, updateSet, updateCardioRound } from '@/lib/session-db';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function GET() {
  const today = new Date().toISOString().split('T')[0];
  const todayName = DAY_NAMES[new Date().getDay()];
  const weekNumber = getTrainingWeek();

  const active = getActiveSession(today);
  if (active) {
    const sets = getSessionSets(active.id);
    const cardio = getSessionCardio(active.id);
    return NextResponse.json({
      sessionId: active.id,
      sessionTitle: active.sessionTitle,
      sets,
      cardio,
      resumed: true,
    });
  }

  const planItems = getPlanItems(weekNumber);
  const todayItem = planItems.find(
    (item) => item.day.toLowerCase() === todayName.toLowerCase(),
  );

  if (!todayItem || !todayItem.workoutPlan) {
    return NextResponse.json({ sessionId: null, message: 'No workout planned for today' });
  }

  const sessionTypeLower = todayItem.sessionType.toLowerCase();
  let sessionType = 'strength';
  if (sessionTypeLower.includes('cardio') || sessionTypeLower.includes('aerobic')) {
    sessionType = sessionTypeLower.includes('interval') || sessionTypeLower.includes('anaerobic')
      ? 'cardio_intervals' : 'cardio_steady';
  } else if (sessionTypeLower.includes('ruck')) {
    sessionType = 'ruck';
  } else if (sessionTypeLower.includes('mobility') || sessionTypeLower.includes('recovery')) {
    sessionType = 'mobility';
  }

  const exercises = parseWorkoutPlan(todayItem.workoutPlan, sessionType);

  const sessionId = createSession(
    today,
    sessionType,
    todayItem.focus || todayItem.sessionType,
    exercises,
  );

  const sets = getSessionSets(sessionId);
  const cardio = getSessionCardio(sessionId);

  return NextResponse.json({
    sessionId,
    sessionTitle: todayItem.focus || todayItem.sessionType,
    sessionType,
    exercises,
    sets,
    cardio,
    coachCues: todayItem.coachCues || null,
    resumed: false,
  });
}

export async function POST(request: Request) {
  const body = await request.json();

  if (body.type === 'set') {
    updateSet(body.setId, body.actualWeightKg, body.actualReps, body.completed);
    return NextResponse.json({ success: true });
  }

  if (body.type === 'cardio') {
    updateCardioRound(body.cardioId, body.completedRounds, body.completed);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid update type' }, { status: 400 });
}
