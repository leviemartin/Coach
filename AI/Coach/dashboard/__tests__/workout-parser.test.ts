/**
 * Tests for parseWorkoutPlan() in WorkoutDisplay.tsx
 *
 * Setup: npm install --save-dev vitest
 * Add to package.json scripts: "test": "vitest run"
 * Run: npx vitest run __tests__/workout-parser.test.ts
 */

import { describe, test, expect } from 'vitest';
import { parseWorkoutPlan } from '../components/WorkoutDisplay';

// ── Helpers ─────────────────────────────────────────────────────────

type BlockType = 'section' | 'exercise' | 'cardio' | 'text' | 'superset' | 'conditional';

function blockTypes(text: string): BlockType[] {
  return parseWorkoutPlan(text).map((b) => b.type);
}

function blockAt(text: string, index: number) {
  return parseWorkoutPlan(text)[index];
}

// ── Input 1: Monday (Lower Body) ───────────────────────────────────

const INPUT_1 = `AM: 3x2 negative pull-ups (5s descent)
Lunch/PM Gym:
5min Zone 2 bike warm-up
Superset A (3 rounds, 90s rest):
- Goblet Squat: 28kg x10
- Hamstring Curl: 45kg x12
Superset B (3 rounds, 90s rest):
- Leg Press: 90kg x12 (feet high)
- Walking Lunges: 2x10kg DBs x10/leg
Calf Press 3x15 @ 60kg
20min StairMaster Zone 4 intervals (3min on/1min off)`;

describe('Input 1 — Monday Lower Body', () => {
  const blocks = parseWorkoutPlan(INPUT_1);

  test('line 1: "AM: 3x2 negative pull-ups" → section "AM" + text/exercise for content', () => {
    expect(blocks[0].type).toBe('section');
    expect(blocks[0].data).toBe('AM');
    // The rest is parsed as text (unusual format "3x2 negative pull-ups (5s descent)")
    expect(blocks[1].type).toBe('text');
  });

  test('line 2: "Lunch/PM Gym:" → section', () => {
    expect(blocks[2].type).toBe('section');
    expect(blocks[2].data).toBe('Lunch/PM Gym');
  });

  test('line 3: "5min Zone 2 bike warm-up" → cardio', () => {
    expect(blocks[3].type).toBe('cardio');
    if (blocks[3].type === 'cardio') {
      expect(blocks[3].data.duration).toBe('5min');
    }
  });

  test('line 4: "Superset A (3 rounds, 90s rest):" → section', () => {
    expect(blocks[4].type).toBe('section');
    expect(blocks[4].data).toBe('Superset A (3 rounds, 90s rest)');
  });

  test('line 5: "- Goblet Squat: 28kg x10" → exercise', () => {
    expect(blocks[5].type).toBe('exercise');
    if (blocks[5].type === 'exercise') {
      expect(blocks[5].data.name).toBe('Goblet Squat');
      expect(blocks[5].data.weight).toBe('28kg');
      expect(blocks[5].data.reps).toBe('10');
    }
  });

  test('line 6: "- Hamstring Curl: 45kg x12" → exercise', () => {
    expect(blocks[6].type).toBe('exercise');
    if (blocks[6].type === 'exercise') {
      expect(blocks[6].data.name).toBe('Hamstring Curl');
      expect(blocks[6].data.weight).toBe('45kg');
      expect(blocks[6].data.reps).toBe('12');
    }
  });

  test('line 7: "Superset B (3 rounds, 90s rest):" → section', () => {
    expect(blocks[7].type).toBe('section');
    expect(blocks[7].data).toBe('Superset B (3 rounds, 90s rest)');
  });

  test('line 8: "- Leg Press: 90kg x12 (feet high)" → exercise (separate block)', () => {
    expect(blocks[8].type).toBe('exercise');
    if (blocks[8].type === 'exercise') {
      expect(blocks[8].data.name).toBe('Leg Press');
      expect(blocks[8].data.weight).toBe('90kg');
      expect(blocks[8].data.reps).toBe('12');
    }
  });

  test('line 9: "- Walking Lunges: 2x10kg DBs x10/leg" → exercise (separate block, NOT merged)', () => {
    expect(blocks[9].type).toBe('exercise');
    if (blocks[9].type === 'exercise') {
      expect(blocks[9].data.name).toBe('Walking Lunges');
      expect(blocks[9].data.weight).toContain('10kg');
      expect(blocks[9].data.reps).toBe('10/leg');
    }
  });

  test('CRITICAL: Leg Press and Walking Lunges are two SEPARATE blocks', () => {
    // Complaint #2: exercises must be distinguishable
    const legPressIdx = blocks.findIndex(
      (b) => b.type === 'exercise' && 'name' in b.data && (b.data as { name: string }).name === 'Leg Press'
    );
    const walkingLungesIdx = blocks.findIndex(
      (b) => b.type === 'exercise' && 'name' in b.data && (b.data as { name: string }).name === 'Walking Lunges'
    );
    expect(legPressIdx).toBeGreaterThan(-1);
    expect(walkingLungesIdx).toBeGreaterThan(-1);
    expect(walkingLungesIdx).not.toBe(legPressIdx);
  });

  test('line 10: "Calf Press 3x15 @ 60kg" → exercise', () => {
    expect(blocks[10].type).toBe('exercise');
    if (blocks[10].type === 'exercise') {
      expect(blocks[10].data.name).toBe('Calf Press');
      expect(blocks[10].data.sets).toBe(3);
      expect(blocks[10].data.reps).toBe('15');
      expect(blocks[10].data.weight).toBe('60kg');
    }
  });

  test('line 11: "20min StairMaster Zone 4 intervals" → cardio', () => {
    expect(blocks[11].type).toBe('cardio');
    if (blocks[11].type === 'cardio') {
      expect(blocks[11].data.duration).toBe('20min');
    }
  });

  test('total block count is 12', () => {
    expect(blocks).toHaveLength(12);
  });
});

// ── Input 2: Wednesday (Upper Body) ────────────────────────────────

const INPUT_2 = `AM: 3x2 negative pull-ups (5s descent)
Lunch/PM Gym:
5min Zone 2 rower warm-up
Superset A (3 rounds, 90s rest):
- Chest Press Machine: 50kg x10
- Lat Pulldown: 50kg x10
Superset B (3 rounds, 90s rest):
- Seated Row: 55kg x12
- DB Shoulder Press: 16kg x10
Grip Circuit (3 rounds, 2min rest):
- Dead Hang: max hold
- Farmer's Walk: 24kg/hand x 30m
Rower Sprint Protocol: 5x 20s @ >300W / 1:40 rest`;

describe('Input 2 — Wednesday Upper Body', () => {
  const blocks = parseWorkoutPlan(INPUT_2);

  test('line 1: "AM:" → section', () => {
    expect(blocks[0].type).toBe('section');
    expect(blocks[0].data).toBe('AM');
  });

  test('line 1 content: pull-ups → text (unusual format)', () => {
    expect(blocks[1].type).toBe('text');
  });

  test('line 2: "Lunch/PM Gym:" → section', () => {
    expect(blocks[2].type).toBe('section');
  });

  test('line 3: "5min Zone 2 rower warm-up" → cardio', () => {
    expect(blocks[3].type).toBe('cardio');
  });

  test('line 4: "Superset A (3 rounds, 90s rest):" → section', () => {
    expect(blocks[4].type).toBe('section');
    expect(blocks[4].data).toContain('Superset A');
  });

  test('line 5: "- Chest Press Machine: 50kg x10" → exercise', () => {
    expect(blocks[5].type).toBe('exercise');
    if (blocks[5].type === 'exercise') {
      expect(blocks[5].data.name).toBe('Chest Press Machine');
      expect(blocks[5].data.weight).toBe('50kg');
    }
  });

  test('line 6: "- Lat Pulldown: 50kg x10" → exercise', () => {
    expect(blocks[6].type).toBe('exercise');
    if (blocks[6].type === 'exercise') {
      expect(blocks[6].data.name).toBe('Lat Pulldown');
    }
  });

  test('line 7: "Superset B (3 rounds, 90s rest):" → section', () => {
    expect(blocks[7].type).toBe('section');
    expect(blocks[7].data).toContain('Superset B');
  });

  test('line 8-9: Seated Row + DB Shoulder Press → two exercises', () => {
    expect(blocks[8].type).toBe('exercise');
    expect(blocks[9].type).toBe('exercise');
    if (blocks[8].type === 'exercise' && blocks[9].type === 'exercise') {
      expect(blocks[8].data.name).toBe('Seated Row');
      expect(blocks[9].data.name).toBe('DB Shoulder Press');
    }
  });

  test('line 10: "Grip Circuit (3 rounds, 2min rest):" → section (NOT split by comma)', () => {
    expect(blocks[10].type).toBe('section');
    if (blocks[10].type === 'section') {
      expect(blocks[10].data).toContain('Grip Circuit');
      expect(blocks[10].data).toContain('3 rounds');
    }
  });

  test('line 11: "- Dead Hang: max hold" → exercise (descriptive)', () => {
    expect(blocks[11].type).toBe('exercise');
    if (blocks[11].type === 'exercise') {
      expect(blocks[11].data.name).toBe('Dead Hang');
      expect(blocks[11].data.reps).toBe('max hold');
    }
  });

  test('line 12: "- Farmer\'s Walk: 24kg/hand x 30m" → exercise', () => {
    expect(blocks[12].type).toBe('exercise');
    if (blocks[12].type === 'exercise') {
      expect(blocks[12].data.name).toBe("Farmer's Walk");
      expect(blocks[12].data.weight).toBe('24kg/hand');
      expect(blocks[12].data.reps).toBe('30m');
    }
  });

  test('line 13: "Rower Sprint Protocol: 5x 20s @ >300W / 1:40 rest" → text (complex protocol)', () => {
    expect(blocks[13].type).toBe('text');
  });

  test('total block count is 14', () => {
    expect(blocks).toHaveLength(14);
  });
});

// ── Critical Check #1: No raw formatting in output ─────────────────

describe('Critical Check #1 — No raw formatting artifacts', () => {
  test('HTML <br> tags are stripped', () => {
    const blocks = parseWorkoutPlan('Bench Press 3x10 @ 50kg<br>Rows 3x10 @ 40kg');
    // Should be 2 separate blocks, not one block with <br>
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const block of blocks) {
      const text = JSON.stringify(block.data);
      expect(text).not.toContain('<br');
    }
  });

  test('Markdown ** bold markers are stripped', () => {
    const blocks = parseWorkoutPlan('**Bench Press** 3x10 @ 50kg');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).not.toContain('**');
    }
  });

  test('Bullet • characters become dashes', () => {
    const blocks = parseWorkoutPlan('• Dead Hang: max hold');
    // After sanitization, • becomes -, then "- Dead Hang: max hold" should parse
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Dead Hang');
    }
  });
});

// ── Critical Check #2: Exercises are separate blocks ───────────────

describe('Critical Check #2 — Each exercise is a distinct block', () => {
  test('two exercises on separate lines produce two blocks', () => {
    const input = '- Goblet Squat: 28kg x10\n- Hamstring Curl: 45kg x12';
    const blocks = parseWorkoutPlan(input);
    const exercises = blocks.filter((b) => b.type === 'exercise');
    expect(exercises).toHaveLength(2);
  });

  test('Leg Press and Walking Lunges on separate lines are separate blocks', () => {
    const input = '- Leg Press: 90kg x12 (feet high)\n- Walking Lunges: 2x10kg DBs x10/leg';
    const blocks = parseWorkoutPlan(input);
    const exercises = blocks.filter((b) => b.type === 'exercise');
    expect(exercises).toHaveLength(2);
    if (exercises[0].type === 'exercise' && exercises[1].type === 'exercise') {
      expect(exercises[0].data.name).toBe('Leg Press');
      expect(exercises[1].data.name).toBe('Walking Lunges');
    }
  });
});

// ── Critical Check #3: Superset sections are visual headers ────────

describe('Critical Check #3 — Superset distinction as section headers', () => {
  test('Superset A with parenthesized instructions is a section block', () => {
    const blocks = parseWorkoutPlan('Superset A (3 rounds, 90s rest):');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('section');
    expect(blocks[0].data).toBe('Superset A (3 rounds, 90s rest)');
  });

  test('Exercises after superset header are individual blocks, not grouped', () => {
    const input = `Superset A (3 rounds, 90s rest):
- Goblet Squat: 28kg x10
- Hamstring Curl: 45kg x12`;
    const blocks = parseWorkoutPlan(input);
    expect(blocks[0].type).toBe('section');
    expect(blocks[1].type).toBe('exercise');
    expect(blocks[2].type).toBe('exercise');
  });

  test('Grip Circuit is also a section header', () => {
    const blocks = parseWorkoutPlan('Grip Circuit (3 rounds, 2min rest):');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('section');
  });
});

// ── Known problem area: comma split inside parentheses ─────────────

describe('Comma split respects parentheses', () => {
  test('"Grip Circuit (3 rounds, 2min rest):" is NOT split on internal comma', () => {
    const input = 'Grip Circuit (3 rounds, 2min rest):\n- Dead Hang: max hold';
    const blocks = parseWorkoutPlan(input);
    expect(blocks[0].type).toBe('section');
    // Should NOT have a stray "2min rest)" text block
    const stray = blocks.find(
      (b) => b.type === 'text' && typeof b.data === 'string' && b.data.includes('2min rest')
    );
    expect(stray).toBeUndefined();
  });
});

// ── Edge cases: known problem patterns ─────────────────────────────

describe('Edge cases — known problematic patterns', () => {
  test('"AM:" alone (no content) is a section', () => {
    const blocks = parseWorkoutPlan('AM:');
    expect(blocks[0].type).toBe('section');
    expect(blocks[0].data).toBe('AM');
  });

  test('"AM: content" splits into section + parsed content', () => {
    const blocks = parseWorkoutPlan('AM: 3x2 negative pull-ups (5s descent)');
    expect(blocks[0].type).toBe('section');
    expect(blocks[0].data).toBe('AM');
    expect(blocks.length).toBe(2);
  });

  test('"Rower Sprint Protocol:" does not false-positive as exercise', () => {
    const blocks = parseWorkoutPlan('Rower Sprint Protocol: 5x 20s @ >300W / 1:40 rest');
    // Should NOT parse as exercise with name "Rower Sprint Protocol" sets=5 reps=20
    const ex = blocks.find(
      (b) => b.type === 'exercise' && 'name' in b.data && (b.data as { name: string }).name === 'Rower Sprint Protocol'
    );
    expect(ex).toBeUndefined();
  });

  test('"- Farmer\'s Walk: 24kg/hand x 30m" → exercise with qualified weight', () => {
    const blocks = parseWorkoutPlan("- Farmer's Walk: 24kg/hand x 30m");
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe("Farmer's Walk");
      expect(blocks[0].data.weight).toBe('24kg/hand');
    }
  });

  test('"- Dead Hang: max hold" → exercise (descriptive, not just text)', () => {
    const blocks = parseWorkoutPlan('- Dead Hang: max hold');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Dead Hang');
      expect(blocks[0].data.reps).toBe('max hold');
    }
  });

  test('"- Walking Lunges: 2x10kg DBs x10/leg" → exercise (not parsed as 2 sets of 10)', () => {
    const blocks = parseWorkoutPlan('- Walking Lunges: 2x10kg DBs x10/leg');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Walking Lunges');
      // Weight should contain "10kg", NOT be undefined with sets=2 reps=10
      expect(blocks[0].data.weight).toContain('10kg');
      expect(blocks[0].data.reps).toBe('10/leg');
      // Must NOT have sets=2 (that would mean misparse of "2x10kg" as "2 sets of 10")
      expect(blocks[0].data.sets).toBeUndefined();
    }
  });

  test('"Calf Press 3x15 @ 60kg" → exercise with full details', () => {
    const blocks = parseWorkoutPlan('Calf Press 3x15 @ 60kg');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Calf Press');
      expect(blocks[0].data.sets).toBe(3);
      expect(blocks[0].data.reps).toBe('15');
      expect(blocks[0].data.weight).toBe('60kg');
    }
  });

  test('"Lunch/PM Gym:" → section (slash in label)', () => {
    const blocks = parseWorkoutPlan('Lunch/PM Gym:');
    expect(blocks[0].type).toBe('section');
    expect(blocks[0].data).toBe('Lunch/PM Gym');
  });
});
