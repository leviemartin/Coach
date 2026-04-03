import { NextResponse } from 'next/server';
import { getPlanItems, getPlanItemById } from '@/lib/db';
import { getPlanExercises } from '@/lib/plan-db';
import { getTrainingWeek } from '@/lib/week';
import { parseWorkoutPlan } from '@/lib/workout-parser';
import { createSession, createSessionFromPlanExercises, getActiveSession, getExistingWeekSession, getSessionSets, getSessionCardio, updateSet, updateCardioRound, deleteSession, getExerciseFeedback } from '@/lib/session-db';
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

function resolveSessionType(planItem: PlanItem): string {
  // For structured plan items, session_type already contains the correct enum value
  if (planItem.hasStructuredExercises) {
    return planItem.sessionType;
  }
  return deriveSessionType(planItem.sessionType);
}

function buildSessionResponse(
  planItem: PlanItem,
  sessionId: number,
  sets: ReturnType<typeof getSessionSets>,
  cardio: ReturnType<typeof getSessionCardio>,
  resumed: boolean,
) {
  const sessionType = resolveSessionType(planItem);
  const exercises = planItem.workoutPlan
    ? parseWorkoutPlan(planItem.workoutPlan, sessionType)
    : [];

  const feedback = getExerciseFeedback(sessionId);

  return NextResponse.json({
    sessionId,
    sessionTitle: planItem.focus || planItem.sessionType,
    sessionType,
    exercises,
    sets,
    cardio,
    feedback,
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
    // Check assigned_date first (set by swap), then fall back to day name
    const todayName = DAY_NAMES[new Date().getDay()];
    const planItems = getPlanItems(weekNumber);
    targetItem = planItems.find(
      (item) => item.assignedDate === today,
    ) ?? planItems.find(
      (item) => !item.assignedDate && item.day.toLowerCase() === todayName.toLowerCase(),
    ) ?? null;
  }

  // --- Force reset if requested ---
  const forceReset = searchParams.get('reset') === 'true';

  // --- Check for an active (in-progress) session matching this workout ---
  const sessionTitle = targetItem
    ? (targetItem.focus || targetItem.sessionType)
    : '';
  const active = getActiveSession(today, sessionTitle);

  // Also check for ANY uncompleted session for today (catch stale mismatches)
  if (forceReset) {
    const anyActive = getActiveSession(today);
    if (anyActive) deleteSession(anyActive.id);
    if (active && active.id !== anyActive?.id) deleteSession(active.id);
  }

  if (active && !forceReset && targetItem) {
    const sets = getSessionSets(active.id);
    const cardio = getSessionCardio(active.id);

    // Validate: check if DB data aligns with what we'd expect from the plan.
    // For structured plans, compare against plan_exercises count.
    // For legacy plans, re-parse workout_plan text.
    let dbMatchesExpected = false;

    if (targetItem.hasStructuredExercises && targetItem.id) {
      const planExercises = getPlanExercises(targetItem.id);
      const expectedStrength = planExercises.filter(
        (e) => e.type !== 'cardio_intervals' && e.type !== 'cardio_steady',
      ).length;
      const expectedCardio = planExercises.filter(
        (e) => e.type === 'cardio_intervals' || e.type === 'cardio_steady',
      ).length;
      dbMatchesExpected =
        (expectedStrength === 0 || sets.length > 0) &&
        (expectedCardio === 0 || cardio.length > 0) &&
        !(expectedStrength > 2 && sets.length === 0);
    } else {
      const sessionType = resolveSessionType(targetItem);
      const exercises = targetItem.workoutPlan
        ? parseWorkoutPlan(targetItem.workoutPlan, sessionType)
        : [];
      const expectedStrength = exercises.filter(
        (e) => e.type !== 'cardio_intervals' && e.type !== 'cardio_steady',
      ).length;
      const expectedCardio = exercises.filter(
        (e) => e.type === 'cardio_intervals' || e.type === 'cardio_steady',
      ).length;
      dbMatchesExpected =
        (expectedStrength === 0 || sets.length > 0) &&
        (expectedCardio === 0 || cardio.length > 0) &&
        !(expectedStrength > 2 && sets.length === 0);
    }

    if (dbMatchesExpected) {
      return buildSessionResponse(targetItem, active.id, sets, cardio, true);
    }

    // Stale/mismatched session — delete and recreate below
    deleteSession(active.id);
  }

  // --- No plan item found ---
  const hasWorkout = targetItem && (targetItem.hasStructuredExercises || targetItem.workoutPlan);
  if (!targetItem || !hasWorkout) {
    return NextResponse.json(
      { sessionId: null, message: 'No workout planned' },
      { status: 404 },
    );
  }

  // --- Check if session already exists in this week (prevent duplicates across days) ---
  const existingWeekSession = getExistingWeekSession(
    weekNumber,
    targetItem.focus || targetItem.sessionType,
  );
  if (existingWeekSession) {
    // Session already exists for this title this week — return it instead of creating a duplicate
    const sets = getSessionSets(existingWeekSession.id);
    const cardio = getSessionCardio(existingWeekSession.id);
    return buildSessionResponse(targetItem, existingWeekSession.id, sets, cardio, true);
  }

  // --- Create a new session ---
  const sessionType = resolveSessionType(targetItem);

  // Log to today's date (the day the athlete actually does the workout)
  let sessionId: number;
  if (targetItem.hasStructuredExercises && targetItem.id) {
    // New path: use structured plan_exercises data directly
    const planExercises = getPlanExercises(targetItem.id);
    sessionId = createSessionFromPlanExercises(
      today,
      sessionType,
      targetItem.focus || targetItem.sessionType,
      planExercises,
    );
  } else {
    // Legacy path: parse workout_plan text
    const exercises = parseWorkoutPlan(targetItem.workoutPlan, sessionType);
    sessionId = createSession(
      today,
      sessionType,
      targetItem.focus || targetItem.sessionType,
      exercises,
    );
  }

  const sets = getSessionSets(sessionId);
  const cardio = getSessionCardio(sessionId);

  return buildSessionResponse(targetItem, sessionId, sets, cardio, false);
}

export async function POST(request: Request) {
  const body = await request.json();

  if (body.type === 'set') {
    updateSet(body.setId, body.actualWeightKg, body.actualReps, body.completed, body.actualDurationS);
    return NextResponse.json({ success: true });
  }

  if (body.type === 'cardio') {
    updateCardioRound(body.cardioId, body.completedRounds, body.completed, body.actualDurationMin);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid update type' }, { status: 400 });
}
