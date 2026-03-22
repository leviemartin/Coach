import { resolveExercise } from './exercise-registry';
import type { ParsedExercise, ExerciseType } from './types';

export function parseWorkoutPlan(
  text: string,
  sessionType: string,
): ParsedExercise[] {
  if (!text || !text.trim()) return [];

  if (sessionType === 'cardio_intervals' || sessionType === 'cardio_steady') {
    return parseCardioText(text, sessionType as 'cardio_intervals' | 'cardio_steady');
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const exercises: ParsedExercise[] = [];
  const supersetGroupMap = new Map<string, number>();
  let nextGroupId = 1;
  let order = 0;
  let inWarmup = false;
  let currentRest: number | null = null;

  for (const line of lines) {
    if (/^(warm-up|cool-down|finish)\s*:/i.test(line)) {
      inWarmup = true;
      continue;
    }
    if (/^[A-Z]\d:/i.test(line)) {
      inWarmup = false;
    }
    if (inWarmup && line.startsWith('-')) continue;

    const restMatch = line.match(/\[.*?(\d+)s?\s*rest.*?\]/i);
    if (restMatch) {
      currentRest = parseInt(restMatch[1]);
    }

    const labelMatch = line.match(/^([A-Z])(\d):\s*(.*)/i);
    if (labelMatch) {
      const letter = labelMatch[1].toUpperCase();
      const exerciseText = labelMatch[3];

      let supersetGroup: number | null = null;
      if (supersetGroupMap.has(letter)) {
        supersetGroup = supersetGroupMap.get(letter)!;
      } else {
        const hasPartner = lines.some((l) => {
          const m = l.match(/^([A-Z])\d:/i);
          return m && m[1].toUpperCase() === letter && l !== line;
        });
        if (hasPartner) {
          supersetGroup = nextGroupId++;
          supersetGroupMap.set(letter, supersetGroup);
        }
      }

      const parsed = parseExerciseText(exerciseText, order++, supersetGroup, currentRest);
      if (parsed) exercises.push(parsed);
      continue;
    }

    if (line.startsWith('-') && !inWarmup) {
      const exerciseText = line.replace(/^-\s*/, '');
      const parsed = parseExerciseText(exerciseText, order++, null, null);
      if (parsed) exercises.push(parsed);
    }
  }

  return exercises;
}

function parseExerciseText(
  text: string,
  order: number,
  supersetGroup: number | null,
  restSeconds: number | null,
): ParsedExercise | null {
  const clean = text.replace(/\[.*?\]/g, '').trim();
  if (!clean) return null;

  const setsRepsMatch = clean.match(/(\d+)\s*[×x]\s*(\d+)(s)?/i);
  const sets = setsRepsMatch ? parseInt(setsRepsMatch[1]) : 1;
  let reps: number | null = setsRepsMatch ? parseInt(setsRepsMatch[2]) : null;
  let durationSeconds: number | null = null;

  if (setsRepsMatch && setsRepsMatch[3] === 's') {
    durationSeconds = reps;
    reps = null;
  }

  const weightMatch = clean.match(/@\s*([\d.]+)\s*kg/i);
  const assistedMatch = clean.match(/assisted\s*-?\s*([\d.]+)\s*kg/i);
  let weightKg: number | null = weightMatch ? parseFloat(weightMatch[1]) : null;
  if (assistedMatch && !weightKg) {
    weightKg = -parseFloat(assistedMatch[1]);
  }

  let name = clean
    .replace(/\d+\s*[×x]\s*\d+s?/gi, '')
    .replace(/@\s*[\d.]+\s*kg/gi, '')
    .replace(/\(assisted\s*-?\s*[\d.]+\s*kg\)/gi, '')
    .replace(/\(.*?\)/g, '')
    .trim()
    .replace(/\s+/g, ' ');

  if (!name) return null;

  const resolved = resolveExercise(name);

  return {
    name,
    canonicalName: resolved.canonical,
    type: resolved.type,
    order,
    supersetGroup,
    sets,
    reps,
    weightKg,
    durationSeconds,
    restSeconds,
    rounds: null,
    targetIntensity: null,
    coachCue: null,
  };
}

function parseCardioText(
  text: string,
  type: 'cardio_intervals' | 'cardio_steady',
): ParsedExercise[] {
  const resolved = resolveExercise(text.split(':')[0]?.trim() || text.trim());

  if (type === 'cardio_intervals') {
    const roundsMatch = text.match(/(\d+)\s*rounds?/i);
    const workMatch = text.match(/(\d+)s\s*work/i);
    const restMatch = text.match(/([\d:]+)\s*rest/i);
    const intensityMatch = text.match(/(>[<>]?\d+W|HR\s*\d+-\d+)/i);

    let restSeconds: number | null = null;
    if (restMatch) {
      const restStr = restMatch[1];
      if (restStr.includes(':')) {
        const [min, sec] = restStr.split(':').map(Number);
        restSeconds = min * 60 + sec;
      } else {
        restSeconds = parseInt(restStr);
      }
    }

    return [{
      name: text.split(':')[0]?.trim() || text.trim(),
      canonicalName: resolved.canonical,
      type: 'cardio_intervals',
      order: 0,
      supersetGroup: null,
      sets: 1,
      reps: null,
      weightKg: null,
      durationSeconds: workMatch ? parseInt(workMatch[1]) : null,
      restSeconds,
      rounds: roundsMatch ? parseInt(roundsMatch[1]) : null,
      targetIntensity: intensityMatch ? intensityMatch[1] : null,
      coachCue: null,
    }];
  }

  const durationMatch = text.match(/(\d+)\s*min/i);
  const intensityMatch = text.match(/(HR\s*\d+-\d+|Zone\s*\d)/i);

  return [{
    name: text.split(':')[0]?.trim() || text.trim(),
    canonicalName: resolved.canonical,
    type: 'cardio_steady',
    order: 0,
    supersetGroup: null,
    sets: 1,
    reps: null,
    weightKg: null,
    durationSeconds: durationMatch ? parseInt(durationMatch[1]) * 60 : null,
    restSeconds: null,
    rounds: null,
    targetIntensity: intensityMatch ? intensityMatch[1] : null,
    coachCue: null,
  }];
}
