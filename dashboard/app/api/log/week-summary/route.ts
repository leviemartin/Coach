import { NextResponse } from 'next/server';
import { computeWeekSummary } from '@/lib/daily-log';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get('week');

  if (!week || isNaN(Number(week))) {
    return NextResponse.json({ error: 'Invalid week parameter' }, { status: 400 });
  }

  const summary = computeWeekSummary(parseInt(week));
  return NextResponse.json(summary);
}
