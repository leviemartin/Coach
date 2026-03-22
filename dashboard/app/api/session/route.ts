import { NextResponse } from 'next/server';
import { getPlanItems, getPlanItemById } from '@/lib/db';
import { getTrainingWeek } from '@/lib/week';
import { parseWorkoutPlan } from '@/lib/workout-parser';
import { createSession, getActiveSession, getSessionSets, getSessionCardio, updateSet, updateCardioRound, deleteSession } from '@/lib/session-db';
import type { PlanItem } from '@/lib/types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function deriveSessionType(sessionTypeStr: string): string {
  const lower = sessionTypeStr.toLowerCase();
  // Ruck/walking = steady state endurance (single "Mark Done" button)
  if (lower.includes('ruck') || lower.includes('walk')) return 'cardio_steady';
  if (lower.includes('cardio')) {
    return lower.includes('interval') || lower.includes('anaerobic')
      ? 'cardio_intervals' : 'cardio_steady';
  }
  if (lower.includes('mobility') || lower.includes('recovery')) return 'mobility';
  return 'strength';
}

function buildSessionResponse(
  planItem: PlanItem,
  sessionId: number,
  sets: ReturnType<typeof getSessionSets>,
  cardio: ReturnType<typeof getSessionCardio>,
  resumed: boolean,
) {
  const sessionType = deriveSessionType(planItem.sessionType);
  const exercises = planItem.workoutPlan
    ? parseWorkoutPlan(planItem.workoutPlan, sessionType)
    : [];

  return NextResponse.json({
    sessionId,
    sessionTitle: planItem.focus || planItem.sessionType,
    sessionType,
    exercises,
    sets,
    cardio,
    coachCues: planItem.coachCues || null,
    workoutDescription: planItem.workoutPlan || null,
    resumed,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const planItemIdParam = searchParams.get('planItemId');

  const today = new Date().toISOString().split('T')[0];
  const weekNumber = getTrainingWeek();

  // --- Resolve the target plan item ---
  let targetItem: PlanItem | null = null;

  if (planItemIdParam) {
    // Specific plan item requested (from training plan "Start Session" link)
    const id = parseInt(planItemIdParam);
    if (!isNaN(id)) {
      targetItem = getPlanItemById(id);
    }
    if (!targetItem) {
      return NextResponse.json(
        { sessionId: null, message: 'Plan item not found' },
        { status: 404 },
      );
    }
  } else {
    // Default: find today's workout
    const todayName = DAY_NAMES[new Date().getDay()];
    const planItems = getPlanItems(weekNumber);
    targetItem = planItems.find(
      (item) => item.day.toLowerCase() === todayName.toLowerCase(),
    ) ?? null;
  }

  // --- Check for an active (in-progress) session matching this workout ---
  const sessionTitle = targetItem
    ? (targetItem.focus || targetItem.sessionType)
    : '';
  const active = getActiveSession(today, sessionTitle);
  if (active && targetItem) {
    const sets = getSessionSets(active.id);
    const cardio = getSessionCardio(active.id);

    // Validate: re-parse exercises and check if DB data aligns.
    // If the session was created with wrong type (e.g., cardio_steady for a strength
    // workout), the DB will have wrong entries. Detect and recreate.
    const sessionType = deriveSessionType(targetItem.sessionType);
    const exercises = targetItem.workoutPlan
      ? parseWorkoutPlan(targetItem.workoutPlan, sessionType)
      : [];
    const expectedStrength = exercises.filter(
      (e) => e.type !== 'cardio_intervals' && e.type !== 'cardio_steady',
    ).length;
    const expectedCardio = exercises.filter(
      (e) => e.type === 'cardio_intervals' || e.type === 'cardio_steady',
    ).length;

    const dbMatchesExpected =
      (expectedStrength === 0 || sets.length > 0) &&
      (expectedCardio === 0 || cardio.length > 0) &&
      // Also catch: if we expect many strength exercises but DB only has cardio
      !(expectedStrength > 2 && sets.length === 0);

    if (dbMatchesExpected) {
      return buildSessionResponse(targetItem, active.id, sets, cardio, true);
    }

    // Stale/mismatched session — delete and recreate below
    deleteSession(active.id);
  }

  // --- No plan item found ---
  if (!targetItem || !targetItem.workoutPlan) {
    return NextResponse.json(
      { sessionId: null, message: 'No workout planned' },
      { status: 404 },
    );
  }

  // --- Create a new session ---
  const sessionType = deriveSessionType(targetItem.sessionType);
  const exercises = parseWorkoutPlan(targetItem.workoutPlan, sessionType);

  // Log to today's date (the day the athlete actually does the workout)
  const sessionId = createSession(
    today,
    sessionType,
    targetItem.focus || targetItem.sessionType,
    exercises,
  );

  const sets = getSessionSets(sessionId);
  const cardio = getSessionCardio(sessionId);

  return buildSessionResponse(targetItem, sessionId, sets, cardio, false);
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
