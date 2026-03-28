import { NextResponse } from 'next/server';
import { getPlanItems, getLatestWeekNumber, getSessionLogIdForPlanItem } from '@/lib/db';
import { getTrainingWeek } from '@/lib/week';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get('week');
  const latestWeek = getLatestWeekNumber();
  // Fall back to current training week if no data exists yet
  const weekNumber = week ? parseInt(week) : (latestWeek || getTrainingWeek());
  const items = getPlanItems(weekNumber);

  const enrichedItems = items.map(item => ({
    ...item,
    sessionLogId: item.status === 'completed' && item.id ? getSessionLogIdForPlanItem(item.id) : null,
  }));

  return NextResponse.json({ items: enrichedItems, weekNumber });
}
