import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  let body: { weekNumber: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { weekNumber } = body;
  if (!weekNumber) {
    return NextResponse.json({ error: 'Required: weekNumber' }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare(
    "UPDATE plan_items SET status = 'scheduled' WHERE week_number = ? AND status = 'pending'"
  ).run(weekNumber);

  return NextResponse.json({ ok: true, weekNumber, updated: result.changes });
}
