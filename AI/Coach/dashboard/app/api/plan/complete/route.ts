import { NextResponse } from 'next/server';
import { togglePlanItemComplete, updatePlanItemNotes, getPlanItems, getLatestWeekNumber } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get('week');
  const weekNumber = week ? parseInt(week) : getLatestWeekNumber();
  const items = getPlanItems(weekNumber);
  return NextResponse.json({ items, weekNumber });
}

export async function PATCH(request: Request) {
  const body = await request.json();

  if (body.id === undefined) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  if (body.completed !== undefined) {
    togglePlanItemComplete(body.id, body.completed);
  }

  if (body.athleteNotes !== undefined) {
    updatePlanItemNotes(body.id, body.athleteNotes);
  }

  return NextResponse.json({ success: true });
}
