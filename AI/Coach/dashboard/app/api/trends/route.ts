import { NextResponse } from 'next/server';
import { getWeeklyMetrics, getCeilingHistory, upsertWeeklyMetrics, insertCeilingHistory, getDexaScans, upsertDexaScan } from '@/lib/db';
import { getWeeklyLogFiles, readWeeklyLog, readCeilings, readDexaScans } from '@/lib/state';
import type { WeeklyMetrics, CeilingEntry } from '@/lib/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const exercise = searchParams.get('exercise') || undefined;

  const metrics = getWeeklyMetrics();
  const ceilings = getCeilingHistory(exercise);
  const dexaScans = getDexaScans();

  return NextResponse.json({ metrics, ceilings, dexaScans });
}

// POST: Rebuild SQLite from weekly_logs/ files
export async function POST() {
  const logs = getWeeklyLogFiles();
  let imported = 0;

  for (const log of logs) {
    const content = readWeeklyLog(log.filename);
    if (!content) continue;

    // Build minimal metrics from log metadata
    const metrics: WeeklyMetrics = {
      weekNumber: log.weekNumber,
      checkInDate: log.date,
      weightKg: null,
      bodyFatPct: null,
      muscleMassKg: null,
      avgSleepScore: null,
      avgTrainingReadiness: null,
      avgRhr: null,
      avgHrv: null,
      caloriesAvg: null,
      proteinAvg: null,
      hydrationTracked: false,
      vampireCompliancePct: null,
      rugProtocolDays: null,
      sessionsPlanned: null,
      sessionsCompleted: null,
      bakerCystPain: 0,
      pullupCount: null,
      perceivedReadiness: null,
      planSatisfaction: null,
      modelUsed: 'unknown',
    };

    upsertWeeklyMetrics(metrics);
    imported++;
  }

  // Also rebuild ceiling history from current_ceilings.json
  const ceilings = readCeilings();
  if (ceilings.week > 0) {
    const entries: CeilingEntry[] = Object.entries(ceilings.ceilings)
      .filter(([, v]) => typeof v === 'number')
      .map(([exercise, weight]) => ({
        weekNumber: ceilings.week,
        date: ceilings.last_updated,
        exercise,
        weightKg: weight as number,
      }));
    if (entries.length > 0) {
      insertCeilingHistory(entries);
    }
  }

  // Rebuild DEXA scans from JSON source of truth
  const dexaData = readDexaScans();
  for (const scan of dexaData.scans) {
    upsertDexaScan(scan);
  }

  return NextResponse.json({ success: true, imported });
}
