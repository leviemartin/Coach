import type { PlanItem } from './types';

/**
 * Parses pipe-separated schedule table from Head Coach output.
 *
 * Expected format:
 * | Done? | Day | Session Type | Focus | Est. Starting Weight (Hevy) | Detailed Workout Plan | Coach's Cues & Mobility | My Notes |
 *
 * IMPORTANT: Split on '|' but keep positional indexing (don't filter empty strings)
 * because the Done? column is typically empty, which would shift all indices.
 */
export function parseScheduleTable(markdown: string, weekNumber: number): PlanItem[] {
  const lines = markdown.split('\n');
  const items: PlanItem[] = [];

  let inTable = false;
  let headerPassed = false;
  let dayOrder = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      if (inTable && headerPassed) break; // End of table
      continue;
    }

    // Check if this is the header row
    if (!inTable) {
      if (trimmed.toLowerCase().includes('day') && trimmed.toLowerCase().includes('session')) {
        inTable = true;
        continue;
      }
      continue;
    }

    // Skip separator row (|---|---|...)
    if (trimmed.match(/^\|[\s-|]+\|$/)) {
      headerPassed = true;
      continue;
    }

    if (!headerPassed) continue;

    // Parse data row — split on '|' and use positional indexing
    // "| | Monday | Strength | ..." splits to ['', '', ' Monday ', ' Strength ', ...]
    // Index 0 is always empty (before first |), index 1 is Done?, index 2 is Day, etc.
    const cells = trimmed.split('|').map((c) => c.trim());

    // Need at least the pipe structure: || Day | Session | ...
    if (cells.length < 4) continue;

    // cells[0] = '' (before first pipe)
    // cells[1] = Done? (usually empty)
    // cells[2] = Day
    // cells[3] = Session Type
    // cells[4] = Focus
    // cells[5] = Starting Weight
    // cells[6] = Workout Plan
    // cells[7] = Coach's Cues
    // cells[8] = Notes

    const day = cells[2] || '';
    if (!day) continue; // Skip rows with no day

    dayOrder++;
    items.push({
      weekNumber,
      dayOrder,
      day,
      sessionType: cells[3] || '',
      focus: cells[4] || '',
      startingWeight: cells[5] || '',
      workoutPlan: cells[6] || '',
      coachCues: cells[7] || '',
      athleteNotes: cells[8] || '',
      completed: false,
      completedAt: null,
      subTasks: [],
    });
  }

  return items;
}
