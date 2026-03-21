// dashboard/app/api/dashboard/route.ts
import { NextResponse } from 'next/server';
import { readGarminData, extractExtendedSummary, extractLoadFocus, extractHrZones } from '@/lib/garmin';
import { getWeeklyMetrics } from '@/lib/db';
import { getTrainingWeek } from '@/lib/week';
import {
  calculateRecoveryScore,
  getRecoveryDirective,
  getRecoveryColor,
  buildSleepBars,
  buildPhaseTargets,
} from '@/lib/dashboard-data';
import type { DashboardPayload, WeightHistoryPoint } from '@/lib/types';

// Read periodization phases (same approach as /api/periodization)
import fs from 'fs';
import path from 'path';

function readPeriodizationPhases() {
  try {
    const filePath = path.join(process.cwd(), '..', 'state', 'periodization.md');
    const content = fs.readFileSync(filePath, 'utf-8');
    // Extract phase data from markdown — simplified parser
    const phases: Array<{
      number: number;
      name: string;
      dateRange: string;
      weightTarget: string;
      focus: string[];
      isCurrent: boolean;
    }> = [];

    const phaseRegex = /##\s*Phase\s+(\d+)[:\s]+(.*?)(?:\n|$)/g;
    let match;
    while ((match = phaseRegex.exec(content)) !== null) {
      phases.push({
        number: parseInt(match[1]),
        name: match[2].trim(),
        dateRange: '',
        weightTarget: '89kg',
        focus: [],
        isCurrent: false,
      });
    }
    return phases;
  } catch {
    return [];
  }
}

export async function GET() {
  const currentWeek = getTrainingWeek();
  const freshness = readGarminData();
  const garmin = freshness.data ? extractExtendedSummary(freshness.data) : null;
  const loadFocus = freshness.data ? extractLoadFocus(freshness.data) : null;
  const hrZones = freshness.data ? extractHrZones(freshness.data) : null;

  // Weight history from weekly_metrics
  const allMetrics = getWeeklyMetrics();
  const weightHistory: WeightHistoryPoint[] = allMetrics
    .filter((m) => m.weightKg != null)
    .map((m) => ({ weekNumber: m.weekNumber, avgWeightKg: m.weightKg! }));

  // Add current week from Garmin if not in metrics yet
  if (garmin?.weight && !weightHistory.find((w) => w.weekNumber === currentWeek)) {
    weightHistory.push({ weekNumber: currentWeek, avgWeightKg: garmin.weight });
  }

  // Recovery score — use latest perceived readiness from daily logs + Garmin
  // For now, use Garmin readiness only (perceived comes from daily log)
  const recoveryScore = calculateRecoveryScore(null, garmin?.avgReadiness ?? null);
  const recoveryDirective = getRecoveryDirective(recoveryScore);
  const recoveryColor = getRecoveryColor(recoveryScore);

  // Sleep bars
  const sleepBars = garmin?.dailySleep
    ? buildSleepBars(garmin.dailySleep.map((d) => ({ date: d.date, score: d.value })))
    : Array.from({ length: 7 }, (_, i) => ({
        day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
        score: null,
      }));

  // Weight from start (W1)
  const startWeight = weightHistory.length > 0
    ? weightHistory.reduce((min, w) => w.weekNumber < min.weekNumber ? w : min).avgWeightKg
    : null;
  const weightFromStart = garmin?.weight && startWeight
    ? Math.round((garmin.weight - startWeight) * 10) / 10
    : null;

  // Phase targets
  const phases = readPeriodizationPhases();
  const phaseTargets = buildPhaseTargets(phases);

  // HRV baseline from 4-week data
  const hrv4w = freshness.data?.performance_stats?.hrv_4w as Record<string, unknown> | undefined;
  const hrvDaily = (hrv4w?.daily as Array<Record<string, unknown>>) || [];
  const hrvValues = hrvDaily
    .map((d) => d.weekly_avg_hrv as number | undefined)
    .filter((v): v is number => v != null);
  const hrvBaseline = hrvValues.length > 0
    ? Math.round(hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length)
    : null;
  const hrvDelta = garmin?.avgHrv != null && hrvBaseline != null
    ? garmin.avgHrv - hrvBaseline
    : null;

  // Full 28-day HRV for sparkline
  const dailyHrv28d = hrvDaily
    .filter((d) => (d.weekly_avg_hrv as number | undefined) != null)
    .map((d) => ({ date: d.date as string, value: d.weekly_avg_hrv as number }));

  // Compliance from daily log week summary
  let compliancePct: number | null = null;
  let vampireDays = 0;
  let rugDays = 0;
  let hydrationDays = 0;
  try {
    const logRes = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/log/week-summary`,
      { cache: 'no-store' },
    );
    if (logRes.ok) {
      const logData = await logRes.json();
      vampireDays = logData.bedtime_compliant_days ?? 0;
      rugDays = logData.rug_days ?? 0;
      hydrationDays = logData.hydration_days ?? 0;
      const total = vampireDays + rugDays + hydrationDays;
      const max = 21; // 7 days × 3 protocols
      compliancePct = Math.round((total / max) * 100);
    }
  } catch {
    // Compliance data unavailable — continue without
  }

  // Morzine countdown
  const morzineDate = new Date('2027-07-05');
  const morzineDaysAway = Math.ceil((morzineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const payload: DashboardPayload = {
    recoveryScore,
    recoveryDirective,
    recoveryColor,
    weight: garmin?.weight ?? null,
    weightFromStart,
    weightHistory,
    phaseTargets,
    currentWeek,
    avgSleep: garmin?.avgSleep ?? null,
    dailySleepScores: sleepBars,
    sleepAvg7d: garmin?.avgSleep ?? null,
    compliancePct,
    vampireDays,
    rugDays,
    hydrationDays,
    todaySession: null, // Populated by client from /api/plan
    avgHrv: garmin?.avgHrv ?? null,
    hrvBaseline,
    hrvDelta,
    dailyHrv28d,
    loadFocus,
    enduranceScore: null, // Not yet available from Garmin connector
    hrZones,
    acwr: garmin?.acwr ?? null,
    acwrStatus: garmin?.acwrStatus ?? null,
    bodyBatteryHigh: garmin?.bodyBatteryHigh ?? null,
    currentPhaseNumber: 1, // Will be enriched by periodization
    morzineDaysAway,
  };

  return NextResponse.json(payload);
}
