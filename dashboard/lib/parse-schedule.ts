import type { PlanItem } from './types';

/**
 * Normalize AI-generated workout text that contains HTML/markdown formatting.
 * Converts <br> tags, markdown bold, bullet chars into clean newline-separated text.
 */
export function normalizeWorkoutText(raw: string): string {
  let text = raw;

  // Step 1: Existing transforms
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  text = text.replace(/•/g, '-');

  // Step 2: Label-prefix splitting — "A) Exercise. B1) Exercise." → newlines
  // Insert newline before label prefixes that appear mid-string
  text = text.replace(/(?<=\S)\s+(?=[A-Z]\d?\)\s)/g, '\n');
  // Digit labels → superset format: "B1) Exercise" → "B1: Exercise"
  text = text.replace(/^([A-Z]\d)\)\s+/gm, '$1: ');
  // Single-letter labels → solo exercise: "A) Exercise" → "A1: Exercise"
  text = text.replace(/^([A-Z])\)\s+/gm, '$11: ');

  // Step 3: Period splitting — per-line, threshold 2+ segments
  {
    const lines = text.split('\n');
    const expanded: string[] = [];
    for (const line of lines) {
      const segments = line.split(/\.\s+(?=[A-Z])/);
      if (segments.length >= 2) {
        expanded.push(...segments.map(s => s.trim()).filter(Boolean));
      } else {
        expanded.push(line);
      }
    }
    text = expanded.join('\n');
  }

  // Step 4: "Warm-up:" / "Finish:" section headers mid-line → newline before
  // Only match when followed by colon (section header pattern) to avoid splitting "bike warm-up"
  text = text.replace(/(?<=\S)\s+(?=(?:Warm-up|Finish|Cool-down)\s*:)/gi, '\n');

  // Step 5: Collapse multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n');

  // Step 6: Strip trailing periods from exercise/instruction lines
  // Won't touch "47.5kg" (period followed by digit) or mid-sentence periods
  text = text.replace(/\.(\n|$)/g, '$1');

  return text.trim();
}

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
      workoutPlan: normalizeWorkoutText(cells[6] || ''),
      coachCues: normalizeWorkoutText(cells[7] || ''),
      athleteNotes: cells[8] || '',
      completed: false,
      completedAt: null,
      subTasks: [],
    });
  }

  return items;
}
