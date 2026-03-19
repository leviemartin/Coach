import fs from 'fs';
import { GARMIN_DATA_PATH } from './constants';
import type { GarminData, GarminFreshness, ExtendedGarminSummary } from './types';

export function readGarminData(): GarminFreshness {
  try {
    const stat = fs.statSync(GARMIN_DATA_PATH);
    const raw = fs.readFileSync(GARMIN_DATA_PATH, 'utf-8');
    const data: GarminData = JSON.parse(raw);

    const generatedAt = data._meta?.generated_at || stat.mtime.toISOString();
    const ageMs = Date.now() - new Date(generatedAt).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    let status: GarminFreshness['status'];
    if (ageHours < 24) {
      status = 'fresh';
    } else if (ageHours < 48) {
      status = 'stale';
    } else {
      status = 'old';
    }

    return { timestamp: generatedAt, ageHours, status, data };
  } catch {
    return {
      timestamp: '',
      ageHours: Infinity,
      status: 'old',
      data: null,
    };
  }
}

export function extractGarminSummary(data: GarminData) {
  const health = data.health_stats_7d;
  const perf = data.performance_stats;

  // Average sleep score
  const sleepDays = health?.sleep?.daily || [];
  const avgSleep = sleepDays.length
    ? sleepDays.reduce((sum, d) => sum + (d.score || 0), 0) / sleepDays.length
    : null;

  // Average readiness
  const readinessDays = perf?.training_readiness?.daily || [];
  const avgReadiness = readinessDays.length
    ? readinessDays.reduce((sum, d) => sum + (d.score || 0), 0) / readinessDays.length
    : null;

  // Average RHR — correct field name: resting_heart_rate
  const healthDays = health?.daily || [];
  const rhrDays = healthDays.filter((d) => d.resting_heart_rate != null);
  const avgRhr = rhrDays.length
    ? rhrDays.reduce((sum, d) => sum + (d.resting_heart_rate || 0), 0) / rhrDays.length
    : null;

  // Body composition — nested under daily[] array with correct field names
  const bodyCompDays = health?.body_composition?.daily || [];
  const latestBodyComp = bodyCompDays.length ? bodyCompDays[bodyCompDays.length - 1] : null;
  const weight = latestBodyComp?.weight_kg ?? null;
  const bodyFat = latestBodyComp?.body_fat_pct ?? null;
  const muscleMass = latestBodyComp?.muscle_mass_kg ?? null;

  // Activities
  const activities = data.activities?.this_week || [];

  return {
    avgSleep: avgSleep != null ? Math.round(avgSleep * 10) / 10 : null,
    avgReadiness: avgReadiness != null ? Math.round(avgReadiness * 10) / 10 : null,
    avgRhr: avgRhr != null ? Math.round(avgRhr * 10) / 10 : null,
    weight,
    bodyFat,
    muscleMass,
    activityCount: activities.length,
    activities,
  };
}

export function extractExtendedSummary(data: GarminData): ExtendedGarminSummary {
  const health = data.health_stats_7d;
  const perf = data.performance_stats;
  const basic = extractGarminSummary(data);

  const sleepDays = health?.sleep?.daily || [];
  const dailySleep = sleepDays
    .filter(d => d.score != null)
    .map(d => ({ date: d.date, value: d.score }));

  const readinessDays = perf?.training_readiness?.daily || [];
  const dailyReadiness = readinessDays
    .filter(d => d.score != null)
    .map(d => ({ date: d.date, value: d.score }));

  const healthDays = health?.daily || [];
  const dailyRhr = healthDays
    .filter(d => d.resting_heart_rate != null)
    .map(d => ({ date: d.date, value: d.resting_heart_rate! }));

  const dailyBodyBattery = healthDays
    .filter(d => d.body_battery_high != null)
    .map(d => ({ date: d.date, value: d.body_battery_high! }));

  const dailyStress = healthDays
    .filter(d => d.avg_stress_level != null)
    .map(d => ({ date: d.date, value: d.avg_stress_level! }));

  const bodyCompDays = health?.body_composition?.daily || [];
  const dailyWeight = bodyCompDays
    .filter(d => d.weight_kg != null)
    .map(d => ({ date: d.date || '', value: d.weight_kg! }));

  const hrv4w = perf?.hrv_4w as Record<string, unknown> | undefined;
  const hrvDaily = (hrv4w?.daily as Array<{ date: string; value: number }>) || [];
  const dailyHrv = hrvDaily
    .slice(-7)
    .filter(d => d.value != null)
    .map(d => ({ date: d.date, value: d.value }));
  const avgHrv = dailyHrv.length
    ? Math.round(dailyHrv.reduce((s, d) => s + d.value, 0) / dailyHrv.length)
    : null;

  const bbDays = healthDays.filter(d => d.body_battery_high != null);
  const bodyBatteryHigh = bbDays.length
    ? Math.round(bbDays.reduce((s, d) => s + d.body_battery_high!, 0) / bbDays.length)
    : null;

  const stressDays = healthDays.filter(d => d.avg_stress_level != null);
  const avgStress = stressDays.length
    ? Math.round(stressDays.reduce((s, d) => s + d.avg_stress_level!, 0) / stressDays.length)
    : null;

  const trainingStatus = perf?.training_status;
  const acwr = trainingStatus?.acute_training_load?.acwr_percent
    ? Math.round(trainingStatus.acute_training_load.acwr_percent * 100) / 100
    : null;
  const acwrStatus = trainingStatus?.acute_training_load?.acwr_status || null;

  const te = perf?.training_effects_7d;
  const avgAerobicTE = te?.aerobic?.avg ?? null;
  const avgAnaerobicTE = te?.anaerobic?.avg ?? null;

  const weightDelta = dailyWeight.length >= 2
    ? Math.round((dailyWeight[dailyWeight.length - 1].value - dailyWeight[0].value) * 10) / 10
    : null;

  return {
    ...basic,
    avgHrv,
    bodyBatteryHigh,
    avgStress,
    acwr,
    acwrStatus,
    avgAerobicTE,
    avgAnaerobicTE,
    dailyWeight,
    dailySleep,
    dailyReadiness,
    dailyRhr,
    dailyHrv,
    dailyBodyBattery,
    dailyStress,
    weightDelta,
    sleepDelta: null,
    readinessDelta: null,
  };
}
