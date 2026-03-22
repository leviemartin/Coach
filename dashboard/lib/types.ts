export interface GarminActivity {
  activity_id: number;
  type: string;
  sport?: string;
  name: string;
  date: string;
  start_time?: string;
  duration_sec: number;
  calories: number;
  avg_hr?: number;
  max_hr?: number;
  training_effect_aerobic?: number;
  training_effect_anaerobic?: number;
  hr_zones?: Array<{ zone_number: number; seconds_in_zone: number }>;
  zone_minutes?: Record<string, number>;
  total_sets?: number;
  total_reps?: number;
  total_volume_kg?: number;
  exercises_performed?: string[];
}

export interface GarminSleepDay {
  date: string;
  score: number;
  quality: string;
  duration_hours: number;
  bedtime?: string;
  wake_time?: string;
  spo2_avg?: number;
}

export interface GarminHealthDay {
  date: string;
  total_steps?: number;
  calories_total?: number;
  resting_heart_rate?: number;
  avg_stress_level?: number;
  body_battery_high?: number;
  body_battery_low?: number;
}

export interface GarminReadinessDay {
  date: string;
  score: number;
  level: string;
  sleep_score?: number;
  recovery_time?: number;
  hrv_status?: string;
  acute_load?: number;
  training_load_balance?: number;
}

export interface GarminBodyCompDay {
  date?: string;
  weight_kg?: number;
  body_fat_pct?: number;
  muscle_mass_kg?: number;
}

export interface GarminData {
  _meta: {
    generated_at: string;
    period_start_28d: string;
    period_start_7d: string;
    period_end: string;
    version: string;
  };
  activities: {
    this_week: GarminActivity[];
    summary?: Record<string, unknown>;
  };
  health_stats_7d: {
    daily: GarminHealthDay[];
    sleep?: { daily: GarminSleepDay[] };
    hydration?: {
      daily: Array<{ date: string; intake_ml: number; goal_ml: number }>;
      summary?: Record<string, unknown>;
    };
    body_composition?: {
      daily: GarminBodyCompDay[];
      summary?: Record<string, unknown>;
    };
  };
  performance_stats: {
    training_readiness?: { daily: GarminReadinessDay[] };
    hrv_4w?: Record<string, unknown>;
    training_effects_7d?: {
      aerobic: { min: number; max: number; avg: number; count: number };
      anaerobic: { min: number; max: number; avg: number; count: number };
    };
    training_status?: {
      load_focus?: Record<string, unknown>;
      acute_training_load?: { acwr_percent: number; acwr_status: string };
    };
  };
  nutrition_stats_7d?: Record<string, unknown>;
  weekly_averages_7d?: Record<string, unknown>;
  four_week_context?: Record<string, unknown>;
}

export interface GarminFreshness {
  timestamp: string;
  ageHours: number;
  status: 'fresh' | 'stale' | 'old';
  data: GarminData | null;
}

export interface SparklinePoint {
  date: string;
  value: number;
}

export interface ExtendedGarminSummary {
  // Current values (existing — superset of extractGarminSummary)
  weight: number | null;
  avgSleep: number | null;
  avgReadiness: number | null;
  avgRhr: number | null;
  bodyFat: number | null;
  muscleMass: number | null;
  activityCount: number;
  activities: GarminActivity[];  // Preserve existing field from extractGarminSummary

  // New metrics
  avgHrv: number | null;
  bodyBatteryHigh: number | null;
  avgStress: number | null;
  acwr: number | null;
  acwrStatus: string | null;
  avgAerobicTE: number | null;
  avgAnaerobicTE: number | null;
  caloriesAvg: number | null;
  proteinAvg: number | null;

  // Daily sparkline data (7 days)
  dailyWeight: SparklinePoint[];
  dailySleep: SparklinePoint[];
  dailyReadiness: SparklinePoint[];
  dailyRhr: SparklinePoint[];
  dailyHrv: SparklinePoint[];
  dailyBodyBattery: SparklinePoint[];
  dailyStress: SparklinePoint[];

  // Deltas (vs previous period when available)
  weightDelta: number | null;
  sleepDelta: number | null;
  readinessDelta: number | null;
}

export interface CheckInFormData {
  // Hevy
  hevyCsv: string;
  // Subjective
  bakerCystPain: number;
  lowerBackFatigue: number;
  sessionsCompleted: number;
  sessionsPlanned: number;
  missedSessions: string;
  strengthWins: string;
  struggles: string;
  bedtimeCompliance: number;
  rugProtocolDays: number;
  hydrationTracked: boolean;
  upcomingConflicts: string;
  focusNextWeek: string;
  questionsForCoaches: string;
  perceivedReadiness: number; // 1-5 scale (1=wrecked, 3=normal, 5=peaked)
  planSatisfaction: number;  // 1-5 scale (1=too light, 3=right, 5=too much)
  planFeedback: string;
  // Model
  model: 'sonnet' | 'opus' | 'mixed';
}

export interface AgentOutput {
  agentId: string;
  label: string;
  content: string;
  model: string;
  tokensUsed?: number;
  error?: string;
}

export interface SubTask {
  key: string;
  label: string;
  completed: boolean;
}

export interface PlanItem {
  id?: number;
  weekNumber: number;
  dayOrder: number;
  day: string;
  sessionType: string;
  focus: string;
  startingWeight: string;
  workoutPlan: string;
  coachCues: string;
  athleteNotes: string;
  completed: boolean;
  completedAt: string | null;
  subTasks: SubTask[];
}

export interface WeeklyMetrics {
  weekNumber: number;
  checkInDate: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  avgSleepScore: number | null;
  avgTrainingReadiness: number | null;
  avgRhr: number | null;
  avgHrv: number | null;
  caloriesAvg: number | null;
  proteinAvg: number | null;
  hydrationTracked: boolean;
  vampireCompliancePct: number | null;
  rugProtocolDays: number | null;
  sessionsPlanned: number | null;
  sessionsCompleted: number | null;
  bakerCystPain: number;
  pullupCount: number | null;
  perceivedReadiness: number | null;
  planSatisfaction: number | null;
  modelUsed: string;
}

export interface CeilingEntry {
  id?: number;
  weekNumber: number;
  date: string;
  exercise: string;
  weightKg: number;
}

export interface CeilingsData {
  last_updated: string;
  week: number;
  ceilings: Record<string, number | string>;
  progression_history: Array<{
    date: string;
    exercise: string;
    old_value: number;
    new_value: number;
  }>;
}

export interface DexaScanRegional {
  trunkFatPct: number | null;
  armsFatPct: number | null;
  legsFatPct: number | null;
  trunkLeanKg: number | null;
  armsLeanKg: number | null;
  legsLeanKg: number | null;
}

export interface DexaScanCalibration {
  bodyFatOffsetPct: number; // DEXA BF% - Garmin BF% (positive = Garmin underreads)
  leanMassOffsetKg: number; // DEXA lean mass - Garmin muscle mass
}

export interface DexaScan {
  scanNumber: 1 | 2 | 3;
  date: string;
  phase: string;
  // Core measurements
  totalBodyFatPct: number;
  totalLeanMassKg: number;
  fatMassKg: number;
  boneMineralDensityGcm2: number;
  boneMassKg: number;
  weightAtScanKg: number;
  // Regional (nullable — scanner bed frame limitation)
  regional: DexaScanRegional;
  // Garmin nearest reading (auto-populated)
  garminBodyFatPct: number | null;
  garminMuscleMassKg: number | null;
  garminWeightKg: number | null;
  garminReadingDate: string | null;
  // Calculated
  calibration: DexaScanCalibration;
  // Free text
  notes: string;
}

export interface DexaData {
  scans: DexaScan[];
  latest_calibration: DexaScanCalibration | null;
}

export type RaceStatus = 'registered' | 'planned' | 'tentative' | 'completed';

export interface Race {
  id: string;
  name: string;
  date: string;
  location: string;
  type: string;
  status: RaceStatus;
  notes: string;
}

export interface RacesData {
  races: Race[];
}

export interface Settings {
  model: string;
  [key: string]: string;
}

// --- Dashboard Redesign Types ---

export interface WeightHistoryPoint {
  weekNumber: number;
  avgWeightKg: number;
}

export interface PhaseTarget {
  phaseNumber: number;
  name: string;
  targetWeightKg: number;
}

export interface LoadFocusData {
  lowAerobic: number;
  lowAerobicTargetMin: number;
  lowAerobicTargetMax: number;
  highAerobic: number;
  highAerobicTargetMin: number;
  highAerobicTargetMax: number;
  anaerobic: number;
  anaerobicTargetMin: number;
  anaerobicTargetMax: number;
  description: string | null;
}

export interface HrZoneSummary {
  z1Minutes: number;
  z2Minutes: number;
  z3Minutes: number;
  z4Minutes: number;
  z5Minutes: number;
}

export interface DashboardPayload {
  // Tier 1
  recoveryScore: number | null;
  recoveryDirective: string;
  recoveryColor: string;
  weight: number | null;
  weightFromStart: number | null; // delta from W1
  weightHistory: WeightHistoryPoint[];
  phaseTargets: PhaseTarget[];
  currentWeek: number;
  avgSleep: number | null;
  dailySleepScores: Array<{ day: string; score: number | null }>;
  sleepAvg7d: number | null;
  compliancePct: number | null;
  vampireDays: number;
  rugDays: number;
  hydrationDays: number;

  // Tier 2
  todaySession: {
    title: string;
    sessionType: string;
    exercises: string[];
    badges: string[];
  } | null;

  // Tier 3
  avgHrv: number | null;
  hrvBaseline: number | null;
  hrvDelta: number | null;
  dailyHrv28d: SparklinePoint[];
  loadFocus: LoadFocusData | null;
  enduranceScore: number | null;
  hrZones: HrZoneSummary | null;
  acwr: number | null;
  acwrStatus: string | null;
  bodyBatteryHigh: number | null;

  // Timeline
  currentPhaseNumber: number;
  morzineDaysAway: number;
}

// --- Workout Tracker Types ---

export type ExerciseType = 'strength' | 'carry' | 'timed' | 'cardio_intervals' | 'cardio_steady' | 'ruck';

export interface ParsedExercise {
  name: string;
  canonicalName: string;
  type: ExerciseType;
  order: number;
  supersetGroup: number | null; // null = standalone, number = grouped
  sets: number;
  reps: number | null;          // null for timed exercises
  weightKg: number | null;      // null for bodyweight
  durationSeconds: number | null; // for timed holds, cardio
  restSeconds: number | null;
  rounds: number | null;        // for cardio intervals
  targetIntensity: string | null; // '>300W', 'HR 120-135'
  coachCue: string | null;
}

export interface SessionSetState {
  id?: number;                    // DB id, undefined before persistence
  exerciseName: string;
  exerciseOrder: number;
  supersetGroup: number | null;
  setNumber: number;
  prescribedWeightKg: number | null;
  prescribedReps: number | null;
  actualWeightKg: number | null;
  actualReps: number | null;
  completed: boolean;
  isModified: boolean;
}

export interface SessionCardioState {
  id?: number;                    // DB id, undefined before persistence
  exerciseName: string;
  cardioType: 'intervals' | 'steady_state';
  prescribedRounds: number | null;
  completedRounds: number;
  prescribedDurationMin: number | null;
  targetIntensity: string | null;
  completed: boolean;
}

export interface SessionState {
  id: number | null;           // null until persisted
  date: string;
  weekNumber: number;
  sessionType: string;
  sessionTitle: string;
  exercises: ParsedExercise[];
  sets: SessionSetState[];
  cardio: SessionCardioState[];
  startedAt: string | null;
  completedAt: string | null;
  notes: string;
}

export interface RegistryExercise {
  canonical: string;
  aliases: string[];
  type: ExerciseType;
  tracks_weight: boolean;
}
