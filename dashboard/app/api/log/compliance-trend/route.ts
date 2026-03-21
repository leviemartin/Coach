import { NextResponse } from 'next/server';
import { getComplianceTrend, getWeekForDate } from '@/lib/daily-log';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weeksParam = searchParams.get('weeks');
  const weeks = weeksParam ? parseInt(weeksParam, 10) : 12;

  if (isNaN(weeks) || weeks < 1 || weeks > 52) {
    return NextResponse.json({ error: 'weeks must be 1-52' }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const currentWeek = getWeekForDate(today);
  const trend = getComplianceTrend(currentWeek, weeks);

  return NextResponse.json({ trend });
}
