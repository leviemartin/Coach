import { NextResponse } from 'next/server';
import { getPlanItems, getLatestWeekNumber, getSessionLogIdForPlanItem, deletePlanItems, insertPlanItems } from '@/lib/db';
import { getTrainingWeek } from '@/lib/week';
import type { PlanItem } from '@/lib/types';

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

export async function PUT(request: Request) {
  let body: { weekNumber: number; items: PlanItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { weekNumber, items } = body;
  if (!weekNumber || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: 'Required: weekNumber (number) and items (non-empty array)' },
      { status: 400 },
    );
  }

  deletePlanItems(weekNumber);
  insertPlanItems(items);

  return NextResponse.json({ ok: true, weekNumber, itemCount: items.length });
}
