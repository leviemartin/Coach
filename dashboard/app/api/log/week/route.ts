import { NextResponse } from 'next/server';
import { getDailyLogsByWeek } from '@/lib/db';
import { getDayName } from '@/lib/daily-log';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get('week');

  if (!week || isNaN(Number(week))) {
    return NextResponse.json({ error: 'Invalid week parameter' }, { status: 400 });
  }

  const weekNumber = parseInt(week);
  const logs = getDailyLogsByWeek(weekNumber);
  const logsWithDay = logs.map(log => ({
    ...log,
    day: getDayName(log.date),
  }));

  return NextResponse.json({ week_number: weekNumber, logs: logsWithDay });
}
