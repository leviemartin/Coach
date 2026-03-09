import fs from 'fs';
import { GARMIN_DATA_PATH } from './constants';
import type { GarminData, GarminFreshness } from './types';

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
