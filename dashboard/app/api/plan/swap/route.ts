import { NextResponse } from 'next/server';
import { getDb, getPlanItems, getPlanItemById } from '@/lib/db';
import { checkSequencingConstraints } from '@/lib/sequencing';

// POST /api/plan/swap
// Body: { planItemId: number, targetDate: string }
// Updates assigned_date, returns warning if sequencing violated
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { planItemId, targetDate } = body;

    if (!planItemId || !targetDate) {
      return NextResponse.json({ error: 'planItemId and targetDate required' }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return NextResponse.json({ error: 'targetDate must be YYYY-MM-DD format' }, { status: 400 });
    }

    const item = getPlanItemById(planItemId);
    if (!item) {
      return NextResponse.json({ error: 'Plan item not found' }, { status: 404 });
    }

    const weekItems = getPlanItems(item.weekNumber);
    const result = checkSequencingConstraints(weekItems, planItemId, targetDate);

    const db = getDb();
    db.prepare('UPDATE plan_items SET assigned_date = ? WHERE id = ?').run(targetDate, planItemId);

    return NextResponse.json({
      success: true,
      warning: result.warning || null,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to swap session' }, { status: 500 });
  }
}
