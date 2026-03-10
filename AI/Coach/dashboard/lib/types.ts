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

export interface Settings {
  model: string;
  [key: string]: string;
}
