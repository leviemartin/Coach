import { NextResponse } from 'next/server';
import { getDb, getPlanItems } from '@/lib/db';
import { checkSequencingConstraints } from '@/lib/sequencing';

// POST /api/plan/swap
// Body: { planItemId: number, targetDate: string }
// Updates assigned_date, returns warning if sequencing violated
export async function POST(request: Request) {
  const body = await request.json();
  const { planItemId, targetDate } = body;

  if (!planItemId || !targetDate) {
    return NextResponse.json({ error: 'planItemId and targetDate required' }, { status: 400 });
  }

  const db = getDb();

  // Get the plan item to find its week
  const item = db.prepare('SELECT * FROM plan_items WHERE id = ?').get(planItemId) as { week_number: number } | undefined;
  if (!item) {
    return NextResponse.json({ error: 'Plan item not found' }, { status: 404 });
  }

  // Get all items for the week to check constraints
  const weekItems = getPlanItems(item.week_number);

  // Check sequencing constraints
  const result = checkSequencingConstraints(weekItems, planItemId, targetDate);

  // Update assigned_date
  db.prepare('UPDATE plan_items SET assigned_date = ? WHERE id = ?').run(targetDate, planItemId);

  return NextResponse.json({
    success: true,
    warning: result.warning || null,
  });
}
