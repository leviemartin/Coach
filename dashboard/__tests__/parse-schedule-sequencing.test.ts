import { describe, it, expect } from 'vitest';
import { parseScheduleTable } from '../lib/parse-schedule';

const SCHEDULE_WITH_SEQUENCING = `
| Done? | Day | Session Type | Focus | Est. Starting Weight (Hevy) | Detailed Workout Plan | Coach's Cues & Mobility | My Notes |
|-------|-----|-------------|-------|----------------------------|----------------------|------------------------|----------|
| | Monday | Strength | Upper Push | 60kg | Bench 4x8 | Keep shoulders packed | |
| | Wednesday | Strength | Upper Pull & Grip | 50kg | Rows 4x8 | Full ROM | |
| | Thursday | Cardio | Rower Sprints + Zone 2 | — | 8x20s sprints | Damper 7-9 | |
| | Sunday | Ruck | Sunday Ruck | — | 90 min | Steady pace | |

## Sequencing Rules
- Session 1 (Upper Push) → Seq #1, Group: upper_compound
- Session 2 (Upper Pull) → Seq #2, Group: upper_compound, Note: "not within 24h of Upper Push"
- Session 3 (Rower Sprints) → Seq #3, Note: "48h before heavy legs"
- Session 4 (Sunday Ruck) → Seq #4
`;

const SCHEDULE_WITHOUT_SEQUENCING = `
| Done? | Day | Session Type | Focus | Est. Starting Weight (Hevy) | Detailed Workout Plan | Coach's Cues & Mobility | My Notes |
|-------|-----|-------------|-------|----------------------------|----------------------|------------------------|----------|
| | Monday | Strength | Upper Push | 60kg | Bench 4x8 | Keep shoulders packed | |
| | Wednesday | Strength | Upper Pull & Grip | 50kg | Rows 4x8 | Full ROM | |
`;

describe('parse-schedule sequencing metadata', () => {
  it('extracts sequenceOrder from Seq # field', () => {
    const items = parseScheduleTable(SCHEDULE_WITH_SEQUENCING, 13);
    expect(items[0].sequenceOrder).toBe(1);
    expect(items[1].sequenceOrder).toBe(2);
    expect(items[2].sequenceOrder).toBe(3);
    expect(items[3].sequenceOrder).toBe(4);
  });

  it('extracts sequenceGroup from Group: field', () => {
    const items = parseScheduleTable(SCHEDULE_WITH_SEQUENCING, 13);
    expect(items[0].sequenceGroup).toBe('upper_compound');
    expect(items[1].sequenceGroup).toBe('upper_compound');
  });

  it('extracts sequenceNotes from Note: field', () => {
    const items = parseScheduleTable(SCHEDULE_WITH_SEQUENCING, 13);
    expect(items[1].sequenceNotes).toBe('not within 24h of Upper Push');
    expect(items[2].sequenceNotes).toBe('48h before heavy legs');
  });

  it('leaves sequenceGroup/sequenceNotes undefined when not specified', () => {
    const items = parseScheduleTable(SCHEDULE_WITH_SEQUENCING, 13);
    expect(items[2].sequenceGroup).toBeUndefined(); // Rower has no group
    expect(items[3].sequenceNotes).toBeUndefined(); // Ruck has no note
  });

  it('handles schedule without sequencing section gracefully', () => {
    const items = parseScheduleTable(SCHEDULE_WITHOUT_SEQUENCING, 13);
    expect(items).toHaveLength(2);
    expect(items[0].sequenceGroup).toBeUndefined();
    expect(items[0].sequenceNotes).toBeUndefined();
  });

  it('matches sessions by focus text (case-insensitive substring)', () => {
    const items = parseScheduleTable(SCHEDULE_WITH_SEQUENCING, 13);
    // "Upper Pull" in rule matches "Upper Pull & Grip" in table
    expect(items[1].sequenceGroup).toBe('upper_compound');
  });

  it('handles schedule without sequencing section (split at boundary)', () => {
    const items = parseScheduleTable(SCHEDULE_WITH_SEQUENCING.split('## Sequencing')[0], 13);
    expect(items).toHaveLength(4);
    expect(items[0].sequenceGroup).toBeUndefined();
  });

  it('does not set sequenceNotes on sessions with no Note field', () => {
    const items = parseScheduleTable(SCHEDULE_WITH_SEQUENCING, 13);
    // Session 1 (Upper Push) has Group but no Note
    expect(items[0].sequenceNotes).toBeUndefined();
    // Session 4 (Sunday Ruck) has neither Group nor Note
    expect(items[3].sequenceGroup).toBeUndefined();
    expect(items[3].sequenceNotes).toBeUndefined();
  });

  it('correctly parses all 4 items from table', () => {
    const items = parseScheduleTable(SCHEDULE_WITH_SEQUENCING, 13);
    expect(items).toHaveLength(4);
    expect(items[0].day).toBe('Monday');
    expect(items[1].day).toBe('Wednesday');
    expect(items[2].day).toBe('Thursday');
    expect(items[3].day).toBe('Sunday');
  });

  it('preserves weekNumber on all items', () => {
    const items = parseScheduleTable(SCHEDULE_WITH_SEQUENCING, 13);
    for (const item of items) {
      expect(item.weekNumber).toBe(13);
    }
  });
});
