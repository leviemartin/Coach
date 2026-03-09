import path from 'path';

// Root of the Coach project (parent of dashboard/)
export const COACH_ROOT = path.resolve(process.cwd(), '..');

// State files
export const STATE_DIR = path.join(COACH_ROOT, 'state');
export const ATHLETE_PROFILE_PATH = path.join(STATE_DIR, 'athlete_profile.md');
export const TRAINING_HISTORY_PATH = path.join(STATE_DIR, 'training_history.md');
export const CURRENT_CEILINGS_PATH = path.join(STATE_DIR, 'current_ceilings.json');
export const PERIODIZATION_PATH = path.join(STATE_DIR, 'periodization.md');
export const DECISIONS_LOG_PATH = path.join(STATE_DIR, 'decisions_log.md');
export const WEEKLY_LOGS_DIR = path.join(STATE_DIR, 'weekly_logs');

// Coach persona files
export const COACHES_DIR = path.join(COACH_ROOT, 'coaches');

// Garmin data
export const GARMIN_DATA_PATH = '/Users/martinlevie/garmin-coach/garmin_coach_data.json';

// Agent IDs mapped to their persona files
export const AGENT_FILES: Record<string, string> = {
  'head_coach': '00_head_coach.md',
  'strength': '01_strength_hypertrophy.md',
  'endurance': '02_endurance_energy.md',
  'ocr': '03_ocr_functional.md',
  'nutrition': '04_nutrition_body_comp.md',
  'recovery': '05_recovery_sleep.md',
  'mobility': '06_mobility_injury.md',
  'mental': '07_mental_performance.md',
};

export const SPECIALIST_IDS = [
  'strength', 'endurance', 'ocr', 'nutrition', 'recovery', 'mobility', 'mental'
] as const;

export const AGENT_LABELS: Record<string, string> = {
  'head_coach': 'Head Coach',
  'strength': 'Strength & Hypertrophy',
  'endurance': 'Endurance & Energy Systems',
  'ocr': 'OCR & Functional Movement',
  'nutrition': 'Nutrition & Body Comp',
  'recovery': 'Recovery & Sleep',
  'mobility': 'Mobility & Injury Prevention',
  'mental': 'Mental Performance & Habits',
};

export const AGENT_COLORS: Record<string, string> = {
  'head_coach': '#1565C0',
  'strength': '#C62828',
  'endurance': '#2E7D32',
  'ocr': '#E65100',
  'nutrition': '#6A1B9A',
  'recovery': '#00838F',
  'mobility': '#4E342E',
  'mental': '#283593',
};

// Thresholds
export const THRESHOLDS = {
  sleep: { green: 75, yellow: 60 },
  readiness: { green: 50, yellow: 30 },
  bodyBattery: { green: 70, yellow: 50 },
  acwr: { green: [0.8, 1.3], yellow: [1.3, 1.5] },
  anaerobicTE: { green: 1.0, yellow: 0.5 },
  bedtime: { green: '23:00', yellow: '01:00' },
  muscleMass: { green: 37, yellow: 36 },
} as const;

// Race dates
export const RACE_ZANDVOORT = new Date('2026-05-09');
export const RACE_MORZINE = new Date('2027-07-05');

// Default model
export const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
export const OPUS_MODEL = 'claude-opus-4-20250514';
