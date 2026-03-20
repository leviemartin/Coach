import { NextResponse } from 'next/server';
import { getPlanItems, getLatestWeekNumber } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get('week');
  const weekNumber = week ? parseInt(week) : getLatestWeekNumber();
  const items = getPlanItems(weekNumber);
  return NextResponse.json({ items, weekNumber });
}
