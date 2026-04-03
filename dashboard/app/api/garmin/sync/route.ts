import { NextResponse } from 'next/server';
import { GARMIN_DATA_PATH } from '@/lib/constants';
import fs from 'fs';

interface SyncStatus {
  last_synced: string | null;
  freshness: 'green' | 'amber' | 'red';
  hours_ago: number | null;
  auto_sync_schedule: string;
}

export async function GET(): Promise<NextResponse<SyncStatus>> {
  let lastSynced: string | null = null;
  let hoursAgo: number | null = null;
  let freshness: SyncStatus['freshness'] = 'red';

  try {
    const raw = fs.readFileSync(GARMIN_DATA_PATH, 'utf-8');
    const data = JSON.parse(raw);
    const generatedAt = data._meta?.generated_at;
    if (generatedAt) {
      lastSynced = generatedAt;
      const ageMs = Date.now() - new Date(generatedAt).getTime();
      hoursAgo = Math.round((ageMs / (1000 * 60 * 60)) * 10) / 10;
      if (hoursAgo < 4) freshness = 'green';
      else if (hoursAgo < 12) freshness = 'amber';
      else freshness = 'red';
    }
  } catch {
    // No data file or invalid JSON — leave defaults
  }

  return NextResponse.json({
    last_synced: lastSynced,
    freshness,
    hours_ago: hoursAgo,
    auto_sync_schedule: 'Sunday 19:30',
  });
}
