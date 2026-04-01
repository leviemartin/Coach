import { NextResponse } from 'next/server';
import { upsertExerciseFeedback, getExerciseFeedback } from '@/lib/session-db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionLogId = searchParams.get('sessionLogId');

  if (!sessionLogId) {
    return NextResponse.json({ error: 'sessionLogId required' }, { status: 400 });
  }

  const feedback = getExerciseFeedback(parseInt(sessionLogId));
  return NextResponse.json({ feedback });
}

export async function POST(request: Request) {
  const { sessionLogId, exerciseName, exerciseOrder, rpe, notes, planExerciseId } = await request.json();

  if (!sessionLogId || !exerciseName || rpe == null) {
    return NextResponse.json({ error: 'sessionLogId, exerciseName, and rpe required' }, { status: 400 });
  }

  if (rpe < 1 || rpe > 5) {
    return NextResponse.json({ error: 'rpe must be between 1 and 5' }, { status: 400 });
  }

  upsertExerciseFeedback(sessionLogId, exerciseName, exerciseOrder ?? 0, rpe, notes ?? null, planExerciseId ?? null);
  return NextResponse.json({ success: true });
}
