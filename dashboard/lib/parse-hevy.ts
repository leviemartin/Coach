import Papa from 'papaparse';

export interface HevyExercise {
  date: string;
  exercise: string;
  sets: number;
  reps: string;
  weight: string;
  notes: string;
}

export function parseHevyCsv(csv: string): { data: HevyExercise[]; errors: string[] } {
  if (!csv.trim()) return { data: [], errors: [] };

  const result = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim().toLowerCase(),
  });

  const errors: string[] = result.errors.map(
    (e: Papa.ParseError) => `Row ${e.row}: ${e.message}`
  );

  const data: HevyExercise[] = [];

  for (const row of result.data as Record<string, string>[]) {
    // Hevy CSV typically has: title, start_time, exercise_title, set_order, weight_kg, reps, ...
    data.push({
      date: row['start_time'] || row['date'] || '',
      exercise: row['exercise_title'] || row['exercise'] || row['title'] || '',
      sets: parseInt(row['set_order'] || row['sets'] || '1'),
      reps: row['reps'] || '',
      weight: row['weight_kg'] || row['weight'] || '',
      notes: row['notes'] || '',
    });
  }

  return { data, errors };
}

export function formatHevySummary(exercises: HevyExercise[]): string {
  if (!exercises.length) return 'No Hevy data provided.';

  // Group by exercise
  const grouped: Record<string, HevyExercise[]> = {};
  for (const ex of exercises) {
    const key = ex.exercise || 'Unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ex);
  }

  let summary = '### Hevy Training Log\n\n';
  for (const [exercise, sets] of Object.entries(grouped)) {
    const maxWeight = Math.max(...sets.map((s) => parseFloat(s.weight) || 0));
    const totalSets = sets.length;
    summary += `- **${exercise}**: ${totalSets} sets, max ${maxWeight}kg\n`;
  }

  return summary;
}
