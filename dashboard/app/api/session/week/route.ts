import { NextResponse } from 'next/server';
import { getWeekSessions } from '@/lib/session-db';
import { getTrainingWeek } from '@/lib/week';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekParam = searchParams.get('week');
  const weekNumber = weekParam ? parseInt(weekParam) : getTrainingWeek();

  const sessions = getWeekSessions(weekNumber);

  return NextResponse.json({ weekNumber, sessions });
}
