import type {
  SessionSetState,
  SessionCardioState,
  PlanExercise,
  ExerciseBlock,
  NormalizedExercise,
  NormalizedCardio,
  Section,
  ExerciseType,
} from './types';

// ── Section ordering ──────────────────────────────────────────────────────────

const SECTION_ORDER: Record<string, number> = {
  warm_up: 0,
  activation: 1,
  main_work: 2,
  accessory: 3,
  finisher: 4,
  cool_down: 5,
};

function sectionSortKey(section: string | null | undefined): number {
  return section ? (SECTION_ORDER[section] ?? 99) : 99;
}

// ── Superset letter ↔ integer conversion ──────────────────────────────────────

function supersetLetterToInt(letter: string | null): number | null {
  if (!letter) return null;
  const code = letter.charCodeAt(0);
  // Handle both uppercase A-Z and lowercase a-z
  if (code >= 65 && code <= 90) return code - 64; // A=1, B=2, ...
  if (code >= 97 && code <= 122) return code - 96; // a=1, b=2, ...
  return null;
}

export function supersetGroupLetter(groupId: number): string {
  return String.fromCharCode(64 + groupId);
}

// ── Dedup key ─────────────────────────────────────────────────────────────────

function dedupKey(
  name: string,
  section: string | null,
  planExerciseId: number | null,
): string {
  if (planExerciseId != null) return `pid:${planExerciseId}`;
  return `${name}::${section ?? 'none'}`;
}

// ── Block sort key (section → exerciseOrder) ──────────────────────────────────

function blockMinOrder(block: ExerciseBlock): number {
  if (block.kind === 'superset') return Math.min(...block.exercises.map(e => e.order));
  if (block.kind === 'cardio') return block.exercise.order;
  return block.exercise.order;
}

function sortBlocks(blocks: ExerciseBlock[]): ExerciseBlock[] {
  return blocks.sort((a, b) => {
    const sectionDiff = sectionSortKey(a.section) - sectionSortKey(b.section);
    if (sectionDiff !== 0) return sectionDiff;
    return blockMinOrder(a) - blockMinOrder(b);
  });
}

// ── Cardio type helpers ───────────────────────────────────────────────────────

function isCardioType(type: ExerciseType): boolean {
  return type === 'cardio_intervals' || type === 'cardio_steady' || type === 'ruck';
}

function toCardioSubtype(type: ExerciseType): 'intervals' | 'steady_state' {
  return type === 'cardio_intervals' ? 'intervals' : 'steady_state';
}

// ── buildBlocksFromSets ───────────────────────────────────────────────────────

export function buildBlocksFromSets(
  sets: SessionSetState[],
  cardio: SessionCardioState[],
): ExerciseBlock[] {
  const blocks: ExerciseBlock[] = [];

  // --- Process strength sets ---
  // Group by dedup key, collect all sets per exercise
  const exerciseMap = new Map<
    string,
    { sets: SessionSetState[]; section: string | null }
  >();

  for (const set of sets) {
    const key = dedupKey(set.exerciseName, set.section, set.planExerciseId);
    if (!exerciseMap.has(key)) {
      exerciseMap.set(key, { sets: [], section: set.section });
    }
    exerciseMap.get(key)!.sets.push(set);
  }

  // Build NormalizedExercise per unique exercise
  const normalizedExercises: Array<{ norm: NormalizedExercise; section: string | null }> = [];

  for (const [, { sets: exSets, section }] of exerciseMap) {
    const first = exSets[0];
    // Find first non-null/non-zero restSeconds from any set for this exercise
    const restSeconds = exSets.reduce<number | null>((found, s) => {
      if (found != null) return found;
      return s.restSeconds != null && s.restSeconds > 0 ? s.restSeconds : null;
    }, null) ?? exSets[0].restSeconds;

    // Use stored exercise type when available, fall back to inference for legacy rows
    let inferredType: ExerciseType = first.exerciseType ?? 'strength';
    if (!first.exerciseType) {
      if (first.prescribedReps == null && first.prescribedRepsDisplay === 'MAX TIME') {
        inferredType = 'timed';
      } else if (first.prescribedReps == null && first.prescribedDurationS != null) {
        inferredType = 'timed';
      } else if (first.prescribedReps == null && first.prescribedWeightKg == null && first.prescribedDurationS == null && first.prescribedRepsDisplay == null) {
        inferredType = 'timed';
      }
    }

    const norm: NormalizedExercise = {
      name: first.exerciseName,
      type: inferredType,
      order: first.exerciseOrder,
      supersetGroup: first.supersetGroup,
      sets: exSets.length,
      prescribedRepsDisplay: first.prescribedRepsDisplay,
      prescribedWeightKg: first.prescribedWeightKg,
      prescribedDurationS: first.prescribedDurationS,
      restSeconds,
      coachCue: first.coachCue,
      planExerciseId: first.planExerciseId,
      laterality: first.laterality ?? 'bilateral',
    };
    normalizedExercises.push({ norm, section });
  }

  // Group into superset blocks and singles
  // Key: supersetGroup + section (supersets don't cross sections)
  const supersetMap = new Map<
    string,
    { groupId: number; exercises: NormalizedExercise[]; section: string | null; restSeconds: number | null }
  >();

  for (const { norm, section } of normalizedExercises) {
    if (norm.supersetGroup != null) {
      const supersetKey = `ss:${norm.supersetGroup}::${section ?? 'none'}`;
      if (!supersetMap.has(supersetKey)) {
        supersetMap.set(supersetKey, {
          groupId: norm.supersetGroup,
          exercises: [],
          section,
          restSeconds: null,
        });
      }
      const entry = supersetMap.get(supersetKey)!;
      entry.exercises.push(norm);
      // Pick up any non-zero rest from any exercise in the group
      if (norm.restSeconds != null && norm.restSeconds > 0 && entry.restSeconds == null) {
        entry.restSeconds = norm.restSeconds;
      }
    } else {
      // Single exercise
      const section_ = (section as Section) ?? 'main_work';
      blocks.push({ kind: 'single', exercise: norm, section: section_ });
    }
  }

  // Add superset blocks
  for (const [, { groupId, exercises, section, restSeconds }] of supersetMap) {
    const sortedExercises = [...exercises].sort((a, b) => a.order - b.order);
    const section_ = (section as Section) ?? 'main_work';
    blocks.push({
      kind: 'superset',
      groupId,
      exercises: sortedExercises,
      section: section_,
      restSeconds,
    });
  }

  // --- Process cardio ---
  const seenCardio = new Set<string>();

  for (const c of cardio) {
    const key = dedupKey(c.exerciseName, c.section, c.planExerciseId);
    if (seenCardio.has(key)) continue;
    seenCardio.add(key);

    const normCardio: NormalizedCardio = {
      name: c.exerciseName,
      type: c.cardioType === 'intervals' ? 'cardio_intervals' : 'cardio_steady',
      order: c.exerciseOrder,
      cardioType: c.cardioType,
      prescribedRounds: c.prescribedRounds,
      prescribedDurationMin: c.prescribedDurationMin,
      targetIntensity: c.targetIntensity,
      intervalWorkSeconds: c.intervalWorkSeconds,
      intervalRestSeconds: c.intervalRestSeconds,
      restSeconds: c.restSeconds,
      coachCue: c.coachCue,
      planExerciseId: c.planExerciseId,
      section: (c.section as Section) ?? 'main_work',
    };
    blocks.push({ kind: 'cardio', exercise: normCardio, section: normCardio.section });
  }

  return sortBlocks(blocks);
}

// ── buildBlocksFromPlan ───────────────────────────────────────────────────────

export function buildBlocksFromPlan(exercises: PlanExercise[]): ExerciseBlock[] {
  const blocks: ExerciseBlock[] = [];

  // Separate cardio from strength/timed/carry/mobility
  const cardioExercises = exercises.filter(e => isCardioType(e.type));
  const strengthExercises = exercises.filter(e => !isCardioType(e.type));

  // --- Process cardio exercises ---
  for (const ex of cardioExercises) {
    const normCardio: NormalizedCardio = {
      name: ex.exerciseName,
      type: ex.type as 'cardio_intervals' | 'cardio_steady' | 'ruck',
      order: ex.exerciseOrder,
      cardioType: toCardioSubtype(ex.type),
      prescribedRounds: ex.rounds,
      prescribedDurationMin: ex.durationSeconds != null ? Math.round(ex.durationSeconds / 60) : null,
      targetIntensity: ex.targetIntensity,
      intervalWorkSeconds: ex.intervalWorkSeconds,
      intervalRestSeconds: ex.intervalRestSeconds,
      restSeconds: ex.restSeconds,
      coachCue: ex.coachCue,
      planExerciseId: ex.id ?? null,
      section: ex.section,
    };
    blocks.push({ kind: 'cardio', exercise: normCardio, section: ex.section });
  }

  // --- Process strength/timed/carry/mobility exercises ---
  // Group supersets by (supersetGroup letter + section)
  const supersetMap = new Map<
    string,
    { groupId: number; exercises: NormalizedExercise[]; section: Section; restSeconds: number | null }
  >();
  const singles: Array<{ norm: NormalizedExercise; section: Section }> = [];

  for (const ex of strengthExercises) {
    const norm: NormalizedExercise = {
      name: ex.exerciseName,
      type: ex.type,
      order: ex.exerciseOrder,
      supersetGroup: supersetLetterToInt(ex.supersetGroup),
      sets: ex.sets ?? 1,
      prescribedRepsDisplay: ex.reps,
      prescribedWeightKg: ex.weightKg,
      prescribedDurationS: ex.durationSeconds,
      restSeconds: ex.restSeconds,
      coachCue: ex.coachCue,
      planExerciseId: ex.id ?? null,
      laterality: ex.laterality ?? 'bilateral',
    };

    if (ex.supersetGroup != null) {
      const groupId = supersetLetterToInt(ex.supersetGroup) ?? 0;
      const supersetKey = `ss:${ex.supersetGroup}::${ex.section}`;
      if (!supersetMap.has(supersetKey)) {
        supersetMap.set(supersetKey, {
          groupId,
          exercises: [],
          section: ex.section,
          restSeconds: null,
        });
      }
      const entry = supersetMap.get(supersetKey)!;
      entry.exercises.push(norm);
      if (ex.restSeconds != null && ex.restSeconds > 0 && entry.restSeconds == null) {
        entry.restSeconds = ex.restSeconds;
      }
    } else {
      singles.push({ norm, section: ex.section });
    }
  }

  // Add single blocks
  for (const { norm, section } of singles) {
    blocks.push({ kind: 'single', exercise: norm, section });
  }

  // Add superset blocks
  for (const [, { groupId, exercises, section, restSeconds }] of supersetMap) {
    const sortedExercises = [...exercises].sort((a, b) => a.order - b.order);
    blocks.push({ kind: 'superset', groupId, exercises: sortedExercises, section, restSeconds });
  }

  return sortBlocks(blocks);
}
