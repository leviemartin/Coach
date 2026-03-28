import { NextResponse } from 'next/server';
import { getTrainingWeek } from '@/lib/week';
import {
  getCompletedSession,
  batchUpdateSets,
  batchUpdateCardio,
  upsertExerciseFeedback,
  regenerateSessionSummary,
} from '@/lib/session-db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionLogId = searchParams.get('sessionLogId');

  if (!sessionLogId) {
    return NextResponse.json({ error: 'sessionLogId required' }, { status: 400 });
  }

  const session = getCompletedSession(parseInt(sessionLogId));
  if (!session) {
    return NextResponse.json({ error: 'Completed session not found' }, { status: 404 });
  }

  const currentWeek = getTrainingWeek();
  if (session.weekNumber !== currentWeek) {
    return NextResponse.json({ error: 'Can only edit current week sessions' }, { status: 403 });
  }

  return NextResponse.json({
    sessionLogId: session.sessionLogId,
    sessionTitle: session.sessionTitle,
    sessionType: session.sessionType,
    date: session.date,
    notes: session.notes,
    sets: session.sets,
    cardio: session.cardio,
    feedback: session.feedback,
  });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { sessionLogId, sets, cardio, feedback, notes } = body;

  if (!sessionLogId) {
    return NextResponse.json({ error: 'sessionLogId required' }, { status: 400 });
  }

  const session = getCompletedSession(sessionLogId);
  if (!session) {
    return NextResponse.json({ error: 'Completed session not found' }, { status: 404 });
  }

  const currentWeek = getTrainingWeek();
  if (session.weekNumber !== currentWeek) {
    return NextResponse.json({ error: 'Can only edit current week sessions' }, { status: 403 });
  }

  if (sets && Array.isArray(sets)) {
    batchUpdateSets(sets);
  }

  if (cardio && Array.isArray(cardio)) {
    batchUpdateCardio(cardio);
  }

  if (feedback && Array.isArray(feedback)) {
    for (const f of feedback) {
      if (f.exerciseName && f.rpe >= 1 && f.rpe <= 5) {
        upsertExerciseFeedback(sessionLogId, f.exerciseName, f.exerciseOrder ?? 0, f.rpe);
      }
    }
  }

  regenerateSessionSummary(sessionLogId, notes ?? session.notes ?? '');

  return NextResponse.json({ success: true });
}
