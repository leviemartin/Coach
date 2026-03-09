import { NextResponse } from 'next/server';
import { readWeeklyLogSynthesis } from '@/lib/state';
import { getLatestWeekNumber } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get('week');
  const weekNumber = week ? parseInt(week) : getLatestWeekNumber();
  const synthesis = readWeeklyLogSynthesis(weekNumber);
  return NextResponse.json({ synthesis, weekNumber });
}
