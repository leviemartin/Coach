/**
 * Garmin data extraction — TypeScript port of garmin_connector.py
 *
 * All pure functions that transform raw Garmin API responses into
 * the structured JSON consumed by the coaching system.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Dict = Record<string, any>;
type ApiFn = (path: string) => Promise<any>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const STRENGTH_TYPES = new Set([
  'strength_training',
  'indoor_cardio',
  'fitness_equipment',
]);

export const CARDIO_TYPES = new Set([
  'running',
  'treadmill_running',
  'indoor_running',
  'trail_running',
  'cycling',
  'indoor_cycling',
  'walking',
  'hiking',
  'swimming',
  'open_water_swimming',
  'elliptical',
  'stair_climbing',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize Garmin responses — array → first item, dict → as-is, else {} */
export function ensureDict(data: unknown): Dict {
  if (Array.isArray(data)) {
    return data.length > 0 ? data[0] : {};
  }
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    return data as Dict;
  }
  return {};
}

/** Safe API call wrapper — returns null on failure */
async function safeCall(apiFn: ApiFn, path: string): Promise<any> {
  try {
    return await apiFn(path);
  } catch {
    return null;
  }
}

/** Strip null/undefined values from an object */
function stripNulls(obj: Dict): Dict {
  const result: Dict = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined) {
      result[k] = v;
    }
  }
  return result;
}

/** Format a date as YYYY-MM-DD */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Subtract days from a date (returns new Date) */
function subDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - n);
  return r;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** Classify a Garmin activity as 'strength', 'cardio', or 'other' */
export function classifyActivity(activity: Dict): string {
  const actType = (
    activity?.activityType?.typeKey ?? ''
  ).toLowerCase();
  if (STRENGTH_TYPES.has(actType) || actType.includes('strength')) {
    return 'strength';
  }
  if (CARDIO_TYPES.has(actType)) {
    return 'cardio';
  }
  return 'other';
}

// ---------------------------------------------------------------------------
// HR Zones
// ---------------------------------------------------------------------------

/** Convert HR zone seconds to {z1: mins, z2: mins, ...} */
export function hrZonesToMinutes(
  zones: Array<{ zone_number?: number; seconds_in_zone?: number }>,
): Dict {
  const result: Dict = {};
  for (const z of zones) {
    const zn = z.zone_number;
    const secs = z.seconds_in_zone ?? 0;
    if (zn !== null && zn !== undefined) {
      result[`z${zn}`] = Math.round((secs / 60) * 10) / 10;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

/** Compute min/max/avg/count for a numeric field across daily data */
export function computeTrends(data: Dict[], field: string): Dict {
  const values: number[] = [];
  for (const d of data) {
    const v = d[field];
    if (v !== null && v !== undefined) {
      values.push(v as number);
    }
  }
  if (values.length === 0) return { count: 0 };
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    min: Math.round(Math.min(...values) * 100) / 100,
    max: Math.round(Math.max(...values) * 100) / 100,
    avg: Math.round((sum / values.length) * 100) / 100,
    count: values.length,
  };
}

// ---------------------------------------------------------------------------
// Weekly Summary
// ---------------------------------------------------------------------------

/** Compute summary stats for a set of activities */
export function computeWeeklySummary(activities: Dict[]): Dict {
  const strength = activities.filter((a) => a.type === 'strength');
  const cardio = activities.filter((a) => a.type === 'cardio');

  const totalVolume = strength.reduce(
    (s, a) => s + (a.total_volume_kg ?? 0),
    0,
  );
  const totalSets = strength.reduce((s, a) => s + (a.total_sets ?? 0), 0);
  const totalReps = strength.reduce((s, a) => s + (a.total_reps ?? 0), 0);
  const totalDistance = cardio.reduce(
    (s, a) => s + (a.distance_m ?? 0),
    0,
  );
  const totalDuration = cardio.reduce(
    (s, a) => s + (a.duration_sec ?? 0),
    0,
  );
  const totalCalories = activities.reduce(
    (s, a) => s + (a.calories ?? 0),
    0,
  );

  return {
    total_activities: activities.length,
    strength_sessions: strength.length,
    cardio_sessions: cardio.length,
    total_strength_sets: totalSets,
    total_strength_reps: totalReps,
    total_strength_volume_kg: Math.round(totalVolume * 10) / 10,
    total_cardio_distance_km: Math.round((totalDistance / 1000) * 100) / 100,
    total_cardio_duration_min: Math.round((totalDuration / 60) * 10) / 10,
    total_activity_calories: totalCalories,
  };
}

// ---------------------------------------------------------------------------
// Zone Totals
// ---------------------------------------------------------------------------

/** Aggregate zone minutes across activities, output keys zone_N_minutes */
export function computeZoneTotals(activities: Dict[]): Dict {
  const totals: Dict = {};
  for (const act of activities) {
    const zm = act.zone_minutes ?? {};
    for (const [key, minutes] of Object.entries(zm)) {
      totals[key] = Math.round(((totals[key] ?? 0) + (minutes as number)) * 10) / 10;
    }
  }
  // Convert zN → zone_N_minutes, sorted
  const result: Dict = {};
  const sorted = Object.keys(totals).sort();
  for (const k of sorted) {
    const num = k.replace('z', '');
    result[`zone_${num}_minutes`] = totals[k];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/** Convert sleep entries: sec→hours, sort by date, strip nulls */
export function formatSleep(entries: Dict[]): Dict[] {
  const sorted = [...entries].sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? ''),
  );
  return sorted.map((d) => {
    const dur = d.sleep_duration_sec;
    const need = d.sleep_need_sec;
    const deep = d.deep_sleep_sec;
    const light = d.light_sleep_sec;
    const rem = d.rem_sleep_sec;
    const awake = d.awake_sec;

    const entry: Dict = {
      date: d.date,
      score: d.sleep_score,
      quality: d.sleep_quality,
      duration_hours: dur != null ? Math.round((dur / 3600) * 100) / 100 : null,
      sleep_need_hours: need != null ? Math.round((need / 3600) * 100) / 100 : null,
      deep_sleep_hours: deep != null ? Math.round((deep / 3600) * 100) / 100 : null,
      light_sleep_hours: light != null ? Math.round((light / 3600) * 100) / 100 : null,
      rem_sleep_hours: rem != null ? Math.round((rem / 3600) * 100) / 100 : null,
      awake_hours: awake != null ? Math.round((awake / 3600) * 100) / 100 : null,
      bedtime: d.bedtime,
      wake_time: d.wake_time,
      avg_spo2: d.avg_spo2,
      avg_respiration: d.avg_respiration,
    };
    return stripNulls(entry);
  });
}

/** Pick coach-relevant fields from daily stats, sorted by date */
export function formatStats(entries: Dict[]): Dict[] {
  const sorted = [...entries].sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? ''),
  );
  return sorted.map((d) =>
    stripNulls({
      date: d.date,
      total_steps: d.total_steps,
      calories_total: d.calories_total,
      calories_active: d.calories_active,
      resting_heart_rate: d.resting_heart_rate,
      max_heart_rate: d.max_heart_rate,
      avg_stress_level: d.avg_stress_level,
      body_battery_high: d.body_battery_high,
      body_battery_low: d.body_battery_low,
      moderate_intensity_min: d.moderate_intensity_min,
      vigorous_intensity_min: d.vigorous_intensity_min,
    }),
  );
}

/** Strip goals from daily nutrition, keep only consumed data */
export function formatNutrition(entries: Dict[]): Dict[] {
  const keepKeys = new Set([
    'date',
    'calories_consumed',
    'protein_g',
    'carbs_g',
    'fat_g',
    'fiber_g',
    'meals',
  ]);
  const sorted = [...entries].sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? ''),
  );
  const result: Dict[] = [];
  for (const d of sorted) {
    const entry: Dict = {};
    for (const [k, v] of Object.entries(d)) {
      if (keepKeys.has(k) && v !== null && v !== undefined) {
        entry[k] = v;
      }
    }
    // Skip entries with only date
    if (Object.keys(entry).length > 1) {
      result.push(entry);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Weekly Averages
// ---------------------------------------------------------------------------

/** Compute pre-computed 7-day averages for coaches */
export function computeWeeklyAverages(
  dailyStats: Dict[],
  dailySleep: Dict[],
  dailyReadiness: Dict[],
  dailyHrv: Dict[],
  dailyNutrition: Dict[],
): Dict {
  function avg(data: Dict[], field: string): number | null {
    const vals = data
      .map((d) => d[field])
      .filter((v) => v !== null && v !== undefined) as number[];
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  }

  // Bedtime compliance
  let nightsBefore2300 = 0;
  let nightsTracked = 0;
  for (const d of dailySleep) {
    const bt = d.bedtime;
    if (bt) {
      nightsTracked++;
      try {
        const hourPart = typeof bt === 'string' && bt.includes('T')
          ? bt.split('T')[1]
          : bt;
        const hour = parseInt(hourPart.split(':')[0], 10);
        // Hours 0-5 are post-midnight (late night), not early evening
        // Only 6-22 counts as "before 23:00" compliant
        if (hour >= 6 && hour < 23) {
          nightsBefore2300++;
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  // Sleep duration/deep averages need sec→hours conversion
  const sleepDurHours = dailySleep
    .filter((d) => d.sleep_duration_sec != null)
    .map((d) => ({ v: Math.round((d.sleep_duration_sec / 3600) * 100) / 100 }));
  const deepSleepHours = dailySleep
    .filter((d) => d.deep_sleep_sec != null)
    .map((d) => ({ v: Math.round((d.deep_sleep_sec / 3600) * 100) / 100 }));

  return {
    avg_sleep_score: avg(dailySleep, 'sleep_score'),
    avg_sleep_duration_hours: avg(sleepDurHours, 'v'),
    avg_deep_sleep_hours: avg(deepSleepHours, 'v'),
    avg_readiness: avg(dailyReadiness, 'score'),
    avg_rhr: avg(dailyStats, 'resting_heart_rate'),
    avg_stress: avg(dailyStats, 'avg_stress_level'),
    avg_body_battery_high: avg(dailyStats, 'body_battery_high'),
    avg_hrv_weekly: avg(dailyHrv, 'weekly_avg_hrv'),
    avg_calories_consumed: avg(dailyNutrition, 'calories_consumed'),
    avg_protein_g: avg(dailyNutrition, 'protein_g'),
    avg_carbs_g: avg(dailyNutrition, 'carbs_g'),
    avg_fat_g: avg(dailyNutrition, 'fat_g'),
    nights_before_2300: nightsBefore2300,
    nights_tracked: nightsTracked,
  };
}

// ---------------------------------------------------------------------------
// Extraction Functions (raw API response → clean objects)
// ---------------------------------------------------------------------------

/** Extract daily summary stats from raw Garmin stats response */
export function extractDailyStats(raw: unknown, dateStr: string): Dict {
  if (!raw) return {};
  const stats = ensureDict(raw);
  return {
    date: dateStr,
    total_steps: stats.totalSteps,
    total_distance_m: stats.totalDistanceMeters,
    calories_total: stats.totalKilocalories,
    calories_active: stats.activeKilocalories,
    calories_bmr: stats.bmrKilocalories,
    calories_consumed: stats.consumedCalories,
    moderate_intensity_min: stats.moderateIntensityMinutes,
    vigorous_intensity_min: stats.vigorousIntensityMinutes,
    floors_climbed: stats.floorsAscended,
    min_heart_rate: stats.minHeartRate,
    max_heart_rate: stats.maxHeartRate,
    resting_heart_rate: stats.restingHeartRate,
    avg_stress_level: stats.averageStressLevel,
    max_stress_level: stats.maxStressLevel,
    body_battery_high: stats.bodyBatteryHighestValue,
    body_battery_low: stats.bodyBatteryLowestValue,
  };
}

/** Extract sleep data — handles both epoch ms and ISO string bedtimes */
export function extractSleep(raw: unknown, dateStr: string): Dict {
  if (!raw) return {};
  const sleep = ensureDict(raw);
  const daily = sleep.dailySleepDTO ?? {};

  let bedtime: string | null = null;
  let wakeTime: string | null = null;

  const sleepStart = daily.sleepStartTimestampLocal ?? daily.sleepStart;
  const sleepEnd = daily.sleepEndTimestampLocal ?? daily.sleepEnd;

  if (sleepStart) {
    if (typeof sleepStart === 'number') {
      bedtime = new Date(sleepStart).toTimeString().slice(0, 5);
    } else if (typeof sleepStart === 'string' && sleepStart.includes('T')) {
      bedtime = sleepStart.split('T')[1].slice(0, 5);
    }
  }
  if (sleepEnd) {
    if (typeof sleepEnd === 'number') {
      wakeTime = new Date(sleepEnd).toTimeString().slice(0, 5);
    } else if (typeof sleepEnd === 'string' && sleepEnd.includes('T')) {
      wakeTime = sleepEnd.split('T')[1].slice(0, 5);
    }
  }

  const sleepNeed = daily.sleepNeedSeconds ??
    (typeof daily.sleepNeed === 'number' ? daily.sleepNeed : null);

  return {
    date: dateStr,
    sleep_score: daily.sleepScores?.overall?.value ?? null,
    sleep_quality: daily.sleepScores?.overall?.qualifierKey ?? null,
    sleep_duration_sec: daily.sleepTimeSeconds ?? null,
    sleep_need_sec: sleepNeed,
    deep_sleep_sec: daily.deepSleepSeconds ?? null,
    light_sleep_sec: daily.lightSleepSeconds ?? null,
    rem_sleep_sec: daily.remSleepSeconds ?? null,
    awake_sec: daily.awakeSleepSeconds ?? null,
    bedtime,
    wake_time: wakeTime,
    avg_spo2: daily.averageSpO2Value ?? null,
    avg_respiration: daily.averageRespirationValue ?? null,
  };
}

/** Extract HRV data */
export function extractHrv(raw: unknown, dateStr: string): Dict {
  if (!raw) return {};
  const hrv = ensureDict(raw);
  const summary = hrv.hrvSummary ?? {};
  return {
    date: dateStr,
    weekly_avg_hrv: summary.weeklyAvg ?? null,
    last_night_avg_hrv: summary.lastNightAvg ?? null,
    last_night_5min_high: summary.lastNight5MinHigh ?? null,
    baseline_balanced_low: summary.baseline?.balancedLow ?? null,
    baseline_balanced_upper: summary.baseline?.balancedUpper ?? null,
    status: summary.status ?? null,
  };
}

/** Extract training readiness with all component factors */
export function extractTrainingReadiness(raw: unknown, dateStr: string): Dict {
  if (!raw) return {};
  const tr = ensureDict(raw);
  return {
    date: dateStr,
    score: tr.score ?? null,
    level: tr.level ?? null,
    feedback: tr.feedbackShort ?? null,
    sleep_score_pct: tr.sleepScoreFactorPercent ?? null,
    sleep_score_feedback: tr.sleepScoreFactorFeedback ?? null,
    recovery_time_pct: tr.recoveryTimeFactorPercent ?? null,
    recovery_time_feedback: tr.recoveryTimeFactorFeedback ?? null,
    recovery_time_hours: tr.recoveryTime ?? null,
    training_load_pct: tr.acwrFactorPercent ?? null,
    training_load_feedback: tr.acwrFactorFeedback ?? null,
    acute_load: tr.acuteLoad ?? null,
    hrv_pct: tr.hrvFactorPercent ?? null,
    hrv_feedback: tr.hrvFactorFeedback ?? null,
    hrv_weekly_avg: tr.hrvWeeklyAverage ?? null,
    stress_history_pct: tr.stressHistoryFactorPercent ?? null,
    stress_history_feedback: tr.stressHistoryFactorFeedback ?? null,
    sleep_history_pct: tr.sleepHistoryFactorPercent ?? null,
    sleep_history_feedback: tr.sleepHistoryFactorFeedback ?? null,
  };
}

/** Extract body composition — parses dateWeightList, g→kg */
export function extractBodyComposition(raw: unknown): Dict[] {
  if (!raw || typeof raw !== 'object') return [];
  const data = raw as Dict;
  const entries: Dict[] = [];
  for (const entry of data.dateWeightList ?? []) {
    const e: Dict = {
      date: entry.calendarDate,
      weight_kg: entry.weight ? Math.round((entry.weight / 1000) * 100) / 100 : null,
      bmi: entry.bmi ?? null,
      body_fat_pct: entry.bodyFat ?? null,
      body_water_pct: entry.bodyWater ?? null,
      muscle_mass_kg: entry.muscleMass
        ? Math.round((entry.muscleMass / 1000) * 100) / 100
        : null,
      bone_mass_kg: entry.boneMass
        ? Math.round((entry.boneMass / 1000) * 100) / 100
        : null,
    };
    entries.push(stripNulls(e));
  }
  return entries;
}

/** Extract hydration data */
export function extractHydration(raw: unknown, dateStr: string): Dict {
  if (!raw) return {};
  const h = ensureDict(raw);
  return stripNulls({
    date: dateStr,
    intake_ml: h.valueInML ?? null,
    goal_ml: h.goalInML ?? null,
  });
}

/** Extract nutrition from food logs, meals, and settings endpoints */
export function extractNutrition(
  foodLogs: unknown,
  mealsResp: unknown,
  settings: unknown,
  statsResult: unknown,
  dateStr: string,
): Dict {
  const nutrition: Dict = { date: dateStr };

  // 1) food/logs: PRIMARY source for daily totals
  if (foodLogs && typeof foodLogs === 'object') {
    const fl = foodLogs as Dict;
    const content = fl.dailyNutritionContent ?? {};
    if (content && Object.keys(content).length > 0) {
      nutrition.calories_consumed = Math.round((content.calories ?? 0) * 10) / 10;
      nutrition.protein_g = Math.round((content.protein ?? 0) * 10) / 10;
      nutrition.carbs_g = Math.round((content.carbs ?? 0) * 10) / 10;
      nutrition.fat_g = Math.round((content.fat ?? 0) * 10) / 10;
      if (content.fiber) {
        nutrition.fiber_g = Math.round(content.fiber * 10) / 10;
      }
    }

    const goals = fl.dailyNutritionGoals ?? {};
    if (goals && Object.keys(goals).length > 0) {
      nutrition.calorie_goal = goals.calories;
      nutrition.goal_protein_g = goals.protein;
      nutrition.goal_carbs_g = goals.carbs;
      nutrition.goal_fat_g = goals.fat;
    }
  }

  // 2) meals: per-meal breakdown
  if (mealsResp && typeof mealsResp === 'object') {
    const mr = mealsResp as Dict;
    const mealsList = mr.meals;
    if (Array.isArray(mealsList) && mealsList.length > 0) {
      const parsedMeals: Dict[] = [];
      for (const meal of mealsList) {
        if (!meal || typeof meal !== 'object') continue;
        const mealInfo: Dict = {
          name: meal.mealName,
          start_time: meal.startTime,
          end_time: meal.endTime,
        };

        const mealGoals = meal.goals ?? {};
        if (mealGoals && Object.keys(mealGoals).length > 0) {
          mealInfo.goal_calories = mealGoals.calories;
          mealInfo.goal_protein_g = mealGoals.protein;
          mealInfo.goal_carbs_g = mealGoals.carbs;
          mealInfo.goal_fat_g = mealGoals.fat;
        }

        const mealContent = meal.nutritionContent ?? meal.content ?? {};
        if (mealContent && Object.keys(mealContent).length > 0) {
          mealInfo.calories = Math.round((mealContent.calories ?? 0) * 10) / 10;
          mealInfo.protein_g = Math.round((mealContent.protein ?? 0) * 10) / 10;
          mealInfo.carbs_g = Math.round((mealContent.carbs ?? 0) * 10) / 10;
          mealInfo.fat_g = Math.round((mealContent.fat ?? 0) * 10) / 10;
        }

        const foodItems = meal.foodItems ?? meal.items ?? [];
        if (Array.isArray(foodItems) && foodItems.length > 0) {
          mealInfo.food_items = foodItems
            .filter((item: any) => item && typeof item === 'object')
            .map((item: any) => ({
              name: item.foodName ?? item.name,
              calories: item.calories,
              protein_g: item.protein,
              carbs_g: item.carbs,
              fat_g: item.fat,
              serving: item.servingSize ?? item.amount,
            }));
        }

        parsedMeals.push(stripNulls(mealInfo));
      }

      if (parsedMeals.length > 0) {
        nutrition.meals = parsedMeals;
      }

      // If food/logs didn't provide totals, sum from meals
      if (!nutrition.calories_consumed && parsedMeals.length > 0) {
        const totalCal = parsedMeals.reduce(
          (s, m) => s + (m.calories ?? 0),
          0,
        );
        if (totalCal > 0) {
          nutrition.calories_consumed = Math.round(totalCal * 10) / 10;
          nutrition.protein_g = Math.round(
            parsedMeals.reduce((s, m) => s + (m.protein_g ?? 0), 0) * 10,
          ) / 10;
          nutrition.carbs_g = Math.round(
            parsedMeals.reduce((s, m) => s + (m.carbs_g ?? 0), 0) * 10,
          ) / 10;
          nutrition.fat_g = Math.round(
            parsedMeals.reduce((s, m) => s + (m.fat_g ?? 0), 0) * 10,
          ) / 10;
        }
      }
    }
  }

  // 3) settings: fallback for goals
  if (!nutrition.calorie_goal && settings && typeof settings === 'object') {
    const s = settings as Dict;
    nutrition.calorie_goal = s.calorieGoal;
    const macroGoals = s.macroGoals ?? {};
    if (macroGoals && Object.keys(macroGoals).length > 0) {
      nutrition.goal_protein_g = macroGoals.protein;
      nutrition.goal_carbs_g = macroGoals.carbs;
      nutrition.goal_fat_g = macroGoals.fat;
    }
    if (s.targetWeightGoal) {
      nutrition.weight_goal_kg = Math.round((s.targetWeightGoal / 1000) * 10) / 10;
    }
    if (s.startingWeight) {
      nutrition.starting_weight_kg = Math.round((s.startingWeight / 1000) * 10) / 10;
    }
    if (s.targetDate) nutrition.weight_goal_date = s.targetDate;
    if (s.weightChangeType) nutrition.weight_change_type = s.weightChangeType.toLowerCase();
  }

  // 4) Fallback: consumed calories from daily stats
  if (!nutrition.calories_consumed && statsResult) {
    const stats = ensureDict(statsResult);
    if (stats.consumedCalories) {
      nutrition.calories_consumed = stats.consumedCalories;
    }
  }

  return stripNulls(nutrition);
}

/** Extract HR time-in-zone data for an activity */
export function extractHrZones(raw: unknown): Array<Dict> {
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .filter((z: any) => z && typeof z === 'object' && z.secsInZone)
    .map((z: any) => ({
      zone_number: z.zoneNumber,
      seconds_in_zone: z.secsInZone,
    }));
}

/** Extract strength training summary */
export function extractStrengthDetails(
  activity: Dict,
  setsData: unknown,
  hrZones: Dict[],
): Dict {
  let totalSets = 0;
  let totalReps = 0;
  let totalVolumeKg = 0;
  const exerciseNames: string[] = [];

  if (setsData && typeof setsData === 'object') {
    const sd = setsData as Dict;
    if (sd.exerciseSets) {
      let currentExercise: string | null = null;
      for (const s of sd.exerciseSets) {
        if (s.setType === 'ACTIVE') {
          totalSets++;
          const reps = s.repetitionCount ?? 0;
          totalReps += reps;
          const weight = s.weight
            ? Math.round((s.weight / 1000) * 100) / 100
            : 0;
          totalVolumeKg += reps * weight;
        }
        if (s.exercises?.length) {
          const name = s.exercises[0].exerciseName ?? s.exercises[0].category;
          if (name && name !== currentExercise) {
            exerciseNames.push(name);
            currentExercise = name;
          }
        }
      }
    }
  }

  const zoneMinutes = hrZonesToMinutes(hrZones);

  return stripNulls({
    activity_id: activity.activityId,
    type: 'strength',
    name: activity.activityName ?? 'Strength Training',
    date: (activity.startTimeLocal ?? '').slice(0, 10),
    start_time: activity.startTimeLocal,
    duration_sec: activity.duration,
    calories: activity.calories,
    avg_hr: activity.averageHR,
    max_hr: activity.maxHR,
    training_effect_aerobic: activity.aerobicTrainingEffect,
    training_effect_anaerobic: activity.anaerobicTrainingEffect,
    total_sets: totalSets,
    total_reps: totalReps,
    total_volume_kg: Math.round(totalVolumeKg * 10) / 10,
    exercises_performed: exerciseNames.length > 0 ? exerciseNames : undefined,
    hr_zones: hrZones.length > 0 ? hrZones : undefined,
    zone_minutes: Object.keys(zoneMinutes).length > 0 ? zoneMinutes : undefined,
  });
}

/** Extract cardio activity summary */
export function extractCardioDetails(activity: Dict, hrZones: Dict[]): Dict {
  const actType = (activity.activityType?.typeKey ?? '').toLowerCase();
  const zoneMinutes = hrZonesToMinutes(hrZones);
  const avgSpeed = activity.averageSpeed;

  return stripNulls({
    activity_id: activity.activityId,
    type: 'cardio',
    sport: actType,
    name: activity.activityName ?? actType,
    date: (activity.startTimeLocal ?? '').slice(0, 10),
    start_time: activity.startTimeLocal,
    duration_sec: activity.duration,
    distance_m: activity.distance,
    calories: activity.calories,
    avg_hr: activity.averageHR,
    max_hr: activity.maxHR,
    avg_speed_mps: avgSpeed,
    avg_pace_min_km:
      avgSpeed && avgSpeed > 0
        ? Math.round((1000 / avgSpeed / 60) * 100) / 100
        : undefined,
    elevation_gain_m: activity.elevationGain,
    avg_cadence: activity.averageRunningCadenceInStepsPerMinute,
    training_effect_aerobic: activity.aerobicTrainingEffect,
    training_effect_anaerobic: activity.anaerobicTrainingEffect,
    vo2max: activity.vO2MaxValue,
    hr_zones: hrZones.length > 0 ? hrZones : undefined,
    zone_minutes: Object.keys(zoneMinutes).length > 0 ? zoneMinutes : undefined,
  });
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Build the full structured data export.
 *
 * @param apiFn - generic API function: (path: string) => Promise<any>
 * @param numDays - number of days to fetch (default 28)
 */
export async function buildExport(
  apiFn: ApiFn,
  numDays = 28,
): Promise<Dict> {
  const today = new Date();
  const start28d = subDays(today, numDays);
  const start7d = subDays(today, 7);

  const todayStr = isoDate(today);
  const start28dStr = isoDate(start28d);
  const start7dStr = isoDate(start7d);

  // --- Activities (full 28-day window) ---
  const activitiesRaw = await safeCall(
    apiFn,
    `/activitylist-service/activities/search/activities?startDate=${start28dStr}&endDate=${todayStr}`,
  );
  const rawActivities: Dict[] = Array.isArray(activitiesRaw)
    ? activitiesRaw
    : [];

  // Process each activity with detail calls
  const allActivities: Dict[] = [];
  for (const act of rawActivities) {
    const category = classifyActivity(act);
    const actId = act.activityId;

    if (category === 'strength') {
      const [setsData, hrZonesRaw] = await Promise.all([
        safeCall(apiFn, `/activity-service/activity/${actId}/exerciseSets`),
        safeCall(apiFn, `/activity-service/activity/${actId}/hrTimeInZones`),
      ]);
      const hrZones = extractHrZones(hrZonesRaw);
      allActivities.push(extractStrengthDetails(act, setsData, hrZones));
    } else if (category === 'cardio') {
      const hrZonesRaw = await safeCall(
        apiFn,
        `/activity-service/activity/${actId}/hrTimeInZones`,
      );
      const hrZones = extractHrZones(hrZonesRaw);
      allActivities.push(extractCardioDetails(act, hrZones));
    } else {
      const actType = (act.activityType?.typeKey ?? '').toLowerCase();
      allActivities.push(
        stripNulls({
          activity_id: actId,
          type: 'other',
          sport: actType,
          name: act.activityName ?? 'Unknown',
          date: (act.startTimeLocal ?? '').slice(0, 10),
          duration_sec: act.duration,
          calories: act.calories,
          avg_hr: act.averageHR,
          training_effect_aerobic: act.aerobicTrainingEffect,
          training_effect_anaerobic: act.anaerobicTrainingEffect,
        }),
      );
    }
  }

  // Sort by date
  allActivities.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const activities7d = allActivities.filter(
    (a) => (a.date ?? '') >= start7dStr,
  );

  // --- Daily data (28-day loop) ---
  const dailyStats: Dict[] = [];
  const dailySleep: Dict[] = [];
  const dailyHrv: Dict[] = [];
  const dailyReadiness: Dict[] = [];
  const dailyNutrition: Dict[] = [];
  const dailyHydration: Dict[] = [];

  for (let i = 0; i < numDays; i++) {
    const date = subDays(today, i);
    const dateStr = isoDate(date);

    // Run per-day calls in parallel
    const [statsRaw, sleepRaw, hrvRaw, readinessRaw, hydrationRaw, foodLogsRaw, mealsRaw] =
      await Promise.all([
        safeCall(apiFn, `/usersummary-service/stats/${dateStr}`),
        safeCall(apiFn, `/wellness-service/wellness/dailySleepData/${dateStr}`),
        safeCall(apiFn, `/hrv-service/hrv/${dateStr}`),
        safeCall(apiFn, `/metrics-service/metrics/trainingreadiness/${dateStr}`),
        safeCall(apiFn, `/usersummary-service/usersummary/hydration/daily/${dateStr}`),
        safeCall(apiFn, `/nutrition-service/food/logs/${dateStr}`),
        safeCall(apiFn, `/nutrition-service/meals/${dateStr}`),
      ]);

    // Settings only if food logs didn't have goals
    let settingsRaw = null;
    const fl = foodLogsRaw as Dict | null;
    if (!fl?.dailyNutritionGoals || Object.keys(fl.dailyNutritionGoals).length === 0) {
      settingsRaw = await safeCall(
        apiFn,
        `/nutrition-service/settings/${dateStr}`,
      );
    }

    const statsEntry = extractDailyStats(statsRaw, dateStr);
    const sleepEntry = extractSleep(sleepRaw, dateStr);
    const hrvEntry = extractHrv(hrvRaw, dateStr);
    const readinessEntry = extractTrainingReadiness(readinessRaw, dateStr);
    const hydrationEntry = extractHydration(hydrationRaw, dateStr);
    const nutritionEntry = extractNutrition(
      foodLogsRaw,
      mealsRaw,
      settingsRaw,
      statsRaw,
      dateStr,
    );

    if (Object.keys(statsEntry).length > 1) dailyStats.push(statsEntry);
    if (Object.keys(sleepEntry).length > 1) dailySleep.push(sleepEntry);
    if (Object.keys(hrvEntry).length > 1) dailyHrv.push(hrvEntry);
    if (Object.keys(readinessEntry).length > 1) dailyReadiness.push(readinessEntry);
    if (Object.keys(hydrationEntry).length > 1) dailyHydration.push(hydrationEntry);
    if (Object.keys(nutritionEntry).length > 1) dailyNutrition.push(nutritionEntry);
  }

  // --- Body composition (range query) ---
  const bodyCompRaw = await safeCall(
    apiFn,
    `/weight-service/weight/dateRange?startDay=${start28dStr}&endDay=${todayStr}`,
  );
  const bodyComp = extractBodyComposition(bodyCompRaw);

  // --- Split into 7-day and 28-day windows ---
  function splitWindow(data: Dict[]): [Dict[], Dict[]] {
    const recent = data.filter((d) => (d.date ?? '') >= start7dStr);
    return [recent, data];
  }

  const [stats7d, stats28d] = splitWindow(dailyStats);
  const [sleep7d, sleep28d] = splitWindow(dailySleep);
  const [hrv7d, hrv28d] = splitWindow(dailyHrv);
  const [readiness7d, readiness28d] = splitWindow(dailyReadiness);
  const [nutrition7d, nutrition28d] = splitWindow(dailyNutrition);
  const [hydration7d] = splitWindow(dailyHydration);
  const [body7d, body28d] = splitWindow(bodyComp);

  // --- Nutrition goals from first available entry ---
  let nutritionGoals: Dict = {};
  for (const n of nutrition7d) {
    if (n.calorie_goal) {
      nutritionGoals = stripNulls({
        calorie_goal: n.calorie_goal,
        goal_protein_g: n.goal_protein_g,
        goal_carbs_g: n.goal_carbs_g,
        goal_fat_g: n.goal_fat_g,
        weight_goal_kg: n.weight_goal_kg,
        starting_weight_kg: n.starting_weight_kg,
        weight_goal_date: n.weight_goal_date,
        weight_change_type: n.weight_change_type,
      });
      break;
    }
  }

  // --- Training status / load focus ---
  let trainingStatusData: Dict = {};

  let ts = await safeCall(
    apiFn,
    '/training-status-service/trainingStatus/aggregated',
  );
  if (ts) {
    ts = ensureDict(ts);
  } else {
    ts = await safeCall(
      apiFn,
      '/training-status-service/trainingStatus/latest',
    );
    if (ts) ts = ensureDict(ts);
  }

  if (ts && typeof ts === 'object') {
    // Load Focus
    const loadBalance = ts.mostRecentTrainingLoadBalance ?? {};
    const loadMap = loadBalance.metricsTrainingLoadBalanceDTOMap ?? {};
    for (const deviceId of Object.keys(loadMap)) {
      const lb = loadMap[deviceId];
      if (lb && typeof lb === 'object') {
        trainingStatusData.load_focus = {
          description: lb.trainingBalanceFeedbackPhrase,
          anaerobic: Math.round((lb.monthlyLoadAnaerobic ?? 0) * 10) / 10,
          anaerobic_target_min: lb.monthlyLoadAnaerobicTargetMin,
          anaerobic_target_max: lb.monthlyLoadAnaerobicTargetMax,
          high_aerobic: Math.round((lb.monthlyLoadAerobicHigh ?? 0) * 10) / 10,
          high_aerobic_target_min: lb.monthlyLoadAerobicHighTargetMin,
          high_aerobic_target_max: lb.monthlyLoadAerobicHighTargetMax,
          low_aerobic: Math.round((lb.monthlyLoadAerobicLow ?? 0) * 10) / 10,
          low_aerobic_target_min: lb.monthlyLoadAerobicLowTargetMin,
          low_aerobic_target_max: lb.monthlyLoadAerobicLowTargetMax,
        };
        break;
      }
    }

    // Training Status
    const statusData = ts.mostRecentTrainingStatus ?? {};
    const latestData = statusData.latestTrainingStatusData ?? {};
    for (const deviceId of Object.keys(latestData)) {
      const sd = latestData[deviceId];
      if (sd && typeof sd === 'object') {
        trainingStatusData.status_feedback = sd.trainingStatusFeedbackPhrase;
        trainingStatusData.training_paused = sd.trainingPaused;
        const acute = sd.acuteTrainingLoadDTO ?? {};
        if (acute && Object.keys(acute).length > 0) {
          trainingStatusData.acute_training_load = stripNulls({
            daily_acute: acute.dailyTrainingLoadAcute,
            acwr_percent: acute.acwrPercent,
            acwr_status: acute.acwrStatus,
            chronic_min: acute.minTrainingLoadChronic,
            chronic_max: acute.maxTrainingLoadChronic,
          });
        }
        break;
      }
    }

    // VO2 Max
    const vo2 = ts.mostRecentVO2Max ?? {};
    if (vo2.generic) trainingStatusData.vo2_max_running = vo2.generic;
    if (vo2.cycling) trainingStatusData.vo2_max_cycling = vo2.cycling;
  }

  // --- Build export ---
  const exportData: Dict = {
    _meta: {
      generated_at: new Date().toISOString(),
      period_start_28d: start28dStr,
      period_start_7d: start7dStr,
      period_end: todayStr,
      version: '2.1.0',
      note: 'Upload this file to Claude for your weekly coaching check-in.',
    },

    activities: {
      this_week: activities7d,
      summary: {
        ...computeWeeklySummary(activities7d),
        hr_zone_totals: computeZoneTotals(activities7d),
      },
    },

    health_stats_7d: {
      daily: formatStats(stats7d),
      summary: {
        resting_heart_rate: computeTrends(stats7d, 'resting_heart_rate'),
        avg_stress_level: computeTrends(stats7d, 'avg_stress_level'),
        body_battery_high: computeTrends(stats7d, 'body_battery_high'),
        body_battery_low: computeTrends(stats7d, 'body_battery_low'),
        total_steps: computeTrends(stats7d, 'total_steps'),
        calories_total: computeTrends(stats7d, 'calories_total'),
        calories_active: computeTrends(stats7d, 'calories_active'),
      },
      sleep: {
        daily: formatSleep(sleep7d),
        summary: {
          score: computeTrends(sleep7d, 'sleep_score'),
          duration_hours: computeTrends(
            sleep7d
              .filter((d) => d.sleep_duration_sec != null)
              .map((d) => ({
                v: Math.round((d.sleep_duration_sec / 3600) * 100) / 100,
              })),
            'v',
          ),
          deep_sleep_hours: computeTrends(
            sleep7d
              .filter((d) => d.deep_sleep_sec != null)
              .map((d) => ({
                v: Math.round((d.deep_sleep_sec / 3600) * 100) / 100,
              })),
            'v',
          ),
        },
      },
      hydration: {
        daily: [...hydration7d].sort((a, b) =>
          (a.date ?? '').localeCompare(b.date ?? ''),
        ),
        summary: {
          intake_ml: computeTrends(hydration7d, 'intake_ml'),
        },
      },
      body_composition: {
        daily: [...body7d].sort((a, b) =>
          (a.date ?? '').localeCompare(b.date ?? ''),
        ),
        summary: {
          weight_kg: computeTrends(body7d, 'weight_kg'),
          body_fat_pct: computeTrends(body7d, 'body_fat_pct'),
          muscle_mass_kg: computeTrends(body7d, 'muscle_mass_kg'),
        },
      },
    },

    performance_stats: {
      training_readiness: {
        daily: [...readiness7d].sort((a, b) =>
          (a.date ?? '').localeCompare(b.date ?? ''),
        ),
        summary: {
          score: computeTrends(readiness7d, 'score'),
          sleep_pct: computeTrends(readiness7d, 'sleep_score_pct'),
          recovery_time_pct: computeTrends(readiness7d, 'recovery_time_pct'),
          training_load_pct: computeTrends(readiness7d, 'training_load_pct'),
          hrv_pct: computeTrends(readiness7d, 'hrv_pct'),
          stress_history_pct: computeTrends(
            readiness7d,
            'stress_history_pct',
          ),
          sleep_history_pct: computeTrends(readiness7d, 'sleep_history_pct'),
          acute_load: computeTrends(readiness7d, 'acute_load'),
        },
      },
      hrv_4w: {
        daily: [...hrv28d].sort((a, b) =>
          (a.date ?? '').localeCompare(b.date ?? ''),
        ),
        summary: {
          weekly_avg: computeTrends(hrv28d, 'weekly_avg_hrv'),
          last_night_avg: computeTrends(hrv28d, 'last_night_avg_hrv'),
        },
        latest_status: hrv7d[0]?.status ?? hrv28d[0]?.status ?? null,
        baseline_low: hrv7d[0]?.baseline_balanced_low ?? null,
        baseline_upper: hrv7d[0]?.baseline_balanced_upper ?? null,
      },
      training_effects_7d: {
        aerobic: computeTrends(activities7d, 'training_effect_aerobic'),
        anaerobic: computeTrends(activities7d, 'training_effect_anaerobic'),
      },
      training_status: trainingStatusData,
    },

    nutrition_stats_7d: {
      daily: formatNutrition(nutrition7d),
      summary: {
        calories_consumed: computeTrends(nutrition7d, 'calories_consumed'),
        protein_g: computeTrends(nutrition7d, 'protein_g'),
        carbs_g: computeTrends(nutrition7d, 'carbs_g'),
        fat_g: computeTrends(nutrition7d, 'fat_g'),
      },
      goals: nutritionGoals,
    },

    four_week_context: {
      weekly_breakdowns: [] as Dict[],
      body_composition_trend: [...body28d].sort((a, b) =>
        (a.date ?? '').localeCompare(b.date ?? ''),
      ),
      trends_28d: {
        weight_kg: computeTrends(body28d, 'weight_kg'),
        body_fat_pct: computeTrends(body28d, 'body_fat_pct'),
        resting_hr: computeTrends(stats28d, 'resting_heart_rate'),
        sleep_score: computeTrends(sleep28d, 'sleep_score'),
        training_readiness: computeTrends(readiness28d, 'score'),
        calories_consumed: computeTrends(nutrition28d, 'calories_consumed'),
      },
    },
  };

  // --- Pre-computed weekly averages ---
  exportData.weekly_averages_7d = computeWeeklyAverages(
    stats7d,
    sleep7d,
    readiness7d,
    hrv7d,
    nutrition7d,
  );

  // --- Weekly breakdowns (week 1 = most recent) ---
  for (let weekNum = 0; weekNum < 4; weekNum++) {
    const weekEnd = subDays(today, weekNum * 7);
    const weekStart = subDays(weekEnd, 6);
    const weekStartStr = isoDate(weekStart);
    const weekEndStr = isoDate(weekEnd);

    const weekActivities = allActivities.filter(
      (a) => (a.date ?? '') >= weekStartStr && (a.date ?? '') <= weekEndStr,
    );
    const weekStats = stats28d.filter(
      (d) => (d.date ?? '') >= weekStartStr && (d.date ?? '') <= weekEndStr,
    );
    const weekSleep = sleep28d.filter(
      (d) => (d.date ?? '') >= weekStartStr && (d.date ?? '') <= weekEndStr,
    );
    const weekNutrition = nutrition28d.filter(
      (d) => (d.date ?? '') >= weekStartStr && (d.date ?? '') <= weekEndStr,
    );

    exportData.four_week_context.weekly_breakdowns.push({
      week: weekNum + 1,
      label:
        weekNum === 0
          ? `Week ${weekNum + 1} (most recent)`
          : `Week ${weekNum + 1}`,
      period: `${weekStartStr} to ${weekEndStr}`,
      activity_summary: computeWeeklySummary(weekActivities),
      avg_resting_hr:
        computeTrends(weekStats, 'resting_heart_rate').avg ?? null,
      avg_sleep_score: computeTrends(weekSleep, 'sleep_score').avg ?? null,
      avg_stress:
        computeTrends(weekStats, 'avg_stress_level').avg ?? null,
      avg_body_battery_high:
        computeTrends(weekStats, 'body_battery_high').avg ?? null,
      avg_calories_consumed:
        computeTrends(weekNutrition, 'calories_consumed').avg ?? null,
      avg_protein_g:
        computeTrends(weekNutrition, 'protein_g').avg ?? null,
    });
  }

  return exportData;
}
