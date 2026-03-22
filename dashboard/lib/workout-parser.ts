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
  let inCardioSection = false;
  let cardioSectionName = '';
  let cardioSectionLines: string[] = [];
  let currentRest: number | null = null;

  // Helper: flush collected cardio section lines into a single exercise
  function flushCardioSection() {
    if (cardioSectionLines.length === 0) return;
    const description = cardioSectionLines.join('\n');
    const durationMatch = description.match(/(\d+)\s*min/i);
    const totalDuration = durationMatch ? parseInt(durationMatch[1]) * 60 : null;
    const roundCount = cardioSectionLines.filter(l => /z[3-5]|zone\s*[3-5]|interval/i.test(l)).length;

    const resolved = resolveExercise(cardioSectionName);
    exercises.push({
      name: cardioSectionName,
      canonicalName: resolved.canonical,
      type: roundCount > 1 ? 'cardio_intervals' : 'cardio_steady',
      order: order++,
      supersetGroup: null,
      sets: 1,
      reps: null,
      weightKg: null,
      durationSeconds: totalDuration,
      restSeconds: null,
      rounds: roundCount > 1 ? roundCount : null,
      targetIntensity: null,
      coachCue: description,
    });
    cardioSectionLines = [];
    cardioSectionName = '';
  }

  for (const line of lines) {
    // Section headers: Warm-up:, Cool-down:, Finisher:
    if (/^(warm-up|cool-down|finisher?)\s*:/i.test(line)) {
      flushCardioSection();
      inWarmup = true;
      inCardioSection = false;
      continue;
    }

    // Generic section header: any line ending with ":" that's NOT a label (A1:)
    // Catches: "Cardio:", "StairMaster Pyramid:", "Anaerobic:", "Treadmill Protocol:", etc.
    if (/^[^-\[].+:$/i.test(line) && !/^[A-Z]{1,3}\d+:/i.test(line)) {
      flushCardioSection();
      const headerName = line.replace(/:$/, '').trim();
      // Determine if this is a cardio section or a label section (like "Core Circuit:")
      const isCardioHeader = /stair|cardio|rower|treadmill|anaerobic|aerobic|pyramid|zone/i.test(headerName);
      if (isCardioHeader) {
        inCardioSection = true;
        cardioSectionName = headerName;
        inWarmup = false;
      }
      // Non-cardio headers (like "Core Circuit:") are just labels — continue parsing
      continue;
    }

    // Labeled exercises (A1:, B2:, W1:, CD1:, etc.) exit cardio/warmup mode
    if (/^[A-Z]{1,3}\d+:/i.test(line)) {
      flushCardioSection();
      inWarmup = false;
      inCardioSection = false;
    }

    // Collect cardio section lines
    if (inCardioSection) {
      if (line.startsWith('-')) {
        cardioSectionLines.push(line.replace(/^-\s*/, ''));
      } else if (!line.startsWith('[')) {
        cardioSectionLines.push(line);
      }
      continue;
    }

    if (inWarmup && line.startsWith('-')) continue;

    // Rest annotations: [3 rounds, 90s rest]
    const restMatch = line.match(/\[.*?(\d+)s?\s*rest.*?\]/i);
    if (restMatch) {
      currentRest = parseInt(restMatch[1]);
    }

    // Parse labeled exercises — supports A1:, B1:, W1:, CD1:, etc.
    const labelMatch = line.match(/^([A-Z]{1,3})(\d+):\s*(.*)/i);
    if (labelMatch) {
      const letter = labelMatch[1].toUpperCase();
      const exerciseText = labelMatch[3];

      let supersetGroup: number | null = null;
      if (supersetGroupMap.has(letter)) {
        supersetGroup = supersetGroupMap.get(letter)!;
      } else {
        const hasPartner = lines.some((l) => {
          const m = l.match(/^([A-Z]{1,3})\d+:/i);
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

    // Unlabeled dash-prefixed lines (not in warm-up or cardio section)
    if (line.startsWith('-') && !inWarmup) {
      const exerciseText = line.replace(/^-\s*/, '');
      const parsed = parseExerciseText(exerciseText, order++, null, null);
      if (parsed) exercises.push(parsed);
    }
  }

  // Flush any remaining cardio section
  flushCardioSection();

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
