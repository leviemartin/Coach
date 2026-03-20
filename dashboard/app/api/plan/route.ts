import { NextResponse } from 'next/server';
import { getPlanItems, getLatestWeekNumber } from '@/lib/db';
import { getTrainingWeek } from '@/lib/week';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get('week');
  const latestWeek = getLatestWeekNumber();
  // Fall back to current training week if no data exists yet
  const weekNumber = week ? parseInt(week) : (latestWeek || getTrainingWeek());
  const items = getPlanItems(weekNumber);
  return NextResponse.json({ items, weekNumber });
}
