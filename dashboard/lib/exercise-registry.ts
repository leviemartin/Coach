import fs from 'fs';
import path from 'path';
import type { RegistryExercise, ExerciseType } from './types';

const REGISTRY_PATH = path.join(process.cwd(), '..', 'state', 'exercise_registry.json');

let cachedRegistry: RegistryExercise[] | null = null;

function loadRegistry(): RegistryExercise[] {
  if (cachedRegistry) return cachedRegistry;
  try {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
    const data = JSON.parse(raw);
    cachedRegistry = data.exercises || [];
    return cachedRegistry!;
  } catch {
    return [];
  }
}

/**
 * Match an exercise name string to its canonical form and type.
 * Uses case-insensitive matching against canonical names and aliases.
 * Returns the canonical name and type, or the original name with 'strength' default.
 */
export function resolveExercise(name: string): { canonical: string; type: ExerciseType } {
  const registry = loadRegistry();
  const lower = name.toLowerCase().trim();

  for (const entry of registry) {
    if (entry.canonical.toLowerCase() === lower) {
      return { canonical: entry.canonical, type: entry.type };
    }
    for (const alias of entry.aliases) {
      if (alias.toLowerCase() === lower) {
        return { canonical: entry.canonical, type: entry.type };
      }
    }
  }

  // Fuzzy: check if the name contains a canonical name
  for (const entry of registry) {
    if (lower.includes(entry.canonical.toLowerCase()) ||
        entry.canonical.toLowerCase().includes(lower)) {
      return { canonical: entry.canonical, type: entry.type };
    }
  }

  return { canonical: name.trim(), type: 'strength' };
}

/** Check if an exercise tracks weight */
export function exerciseTracksWeight(canonicalName: string): boolean {
  const registry = loadRegistry();
  const entry = registry.find((e) => e.canonical === canonicalName);
  return entry?.tracks_weight ?? true;
}
