import { NextResponse } from 'next/server';
import { readGarminData, extractExtendedSummary } from '@/lib/garmin';

export async function GET() {
  const freshness = readGarminData();
  const summary = freshness.data ? extractExtendedSummary(freshness.data) : null;

  return NextResponse.json({
    timestamp: freshness.timestamp,
    ageHours: Math.round(freshness.ageHours * 10) / 10,
    status: freshness.status,
    summary,
  });
}
