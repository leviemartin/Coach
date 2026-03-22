// dashboard/app/api/dashboard/route.ts
import { NextResponse } from 'next/server';
import { readGarminData, extractExtendedSummary, extractLoadFocus, extractHrZones } from '@/lib/garmin';
import { getWeeklyMetrics } from '@/lib/db';
import { getTrainingWeek } from '@/lib/week';
import { computeWeekSummary } from '@/lib/daily-log';
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
    const phases: Array<{
      number: number;
      name: string;
      dateRange: string;
      weightTarget: string;
      focus: string[];
      isCurrent: boolean;
    }> = [];

    // Split by phase headers
    const phaseBlocks = content.split(/### Phase \d+/);
    const phaseHeaders = [...content.matchAll(/### Phase (\d+)[:\s]+(.*?)(?:\n|$)/g)];

    for (let i = 0; i < phaseHeaders.length; i++) {
      const header = phaseHeaders[i];
      const block = phaseBlocks[i + 1] || '';
      const num = parseInt(header[1]);
      const name = header[2].trim();

      // Extract weight target — find line with "Weight Target" or "Race Weight", then grab first number+kg
      const wtLine = block.split('\n').find(l => /weight target|race weight/i.test(l)) || '';
      const wtMatch = wtLine.match(/([\d]+(?:[.-]\d+)?)\s*kg/i);
      const weightTarget = wtMatch ? `${wtMatch[1]}kg` : '89kg';

      // Extract date range from phase name (e.g., "(Jan - Mar 2026)")
      const dateMatch = name.match(/\(([^)]+)\)/);
      const dateRange = dateMatch ? dateMatch[1] : '';

      const isCurrent = block.includes('CURRENT') || name.includes('CURRENT');

      phases.push({ number: num, name, dateRange, weightTarget, focus: [], isCurrent });
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

  // Compliance from daily log week summary (direct DB call, no internal fetch)
  let compliancePct: number | null = null;
  let vampireDays = 0;
  let rugDays = 0;
  let hydrationDays = 0;
  try {
    const weekSummary = computeWeekSummary(currentWeek);
    vampireDays = weekSummary.vampire.compliant ?? 0;
    rugDays = weekSummary.rug_protocol.done ?? 0;
    hydrationDays = weekSummary.hydration.tracked ?? 0;
    const total = vampireDays + rugDays + hydrationDays;
    const max = 21; // 7 days × 3 protocols
    compliancePct = Math.round((total / max) * 100);
  } catch {
    // Compliance data unavailable — continue without
  }

  // Sleep delta: current avg vs last week's metric
  const lastWeekMetrics = allMetrics.find((m) => m.weekNumber === currentWeek - 1);
  const sleepDelta = garmin?.avgSleep != null && lastWeekMetrics?.avgSleepScore != null
    ? Math.round((garmin.avgSleep - lastWeekMetrics.avgSleepScore) * 10) / 10
    : null;

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
    sleepDelta,
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
