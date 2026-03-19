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

// ── Comma split respects parentheses ────────────────────────────────

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

// ── Real DB patterns: colon format with annotation text ────────────

describe('Real DB — colon format with annotation text (not ALLCAPS)', () => {
  test('"- Cable Woodchopper: 15kg x12/side" → exercise with weight and reps including /side', () => {
    // COLON_FORMAT_RE now captures optional /word suffix in reps group
    const blocks = parseWorkoutPlan('- Cable Woodchopper: 15kg x12/side');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Cable Woodchopper');
      expect(blocks[0].data.weight).toBe('15kg');
      expect(blocks[0].data.reps).toBe('12/side');
      expect(blocks[0].data.annotations).toEqual([]);
    }
  });

  test('"- Face Pulls: Light x20" → exercise (descriptive) — "Light" is not a kg weight', () => {
    // COLON_FORMAT_RE: needs \d+kg — "Light" is not numeric → no match
    // COLON_COMPOUND_RE / COLON_WEIGHT_QUALIFIER_RE: no match
    // COLON_SETSREPS_RE: needs \d+ x \d+ — "Light" is not a digit → no match
    // COLON_DESCRIPTIVE_RE: name = "Face Pulls", reps = "Light x20"
    const blocks = parseWorkoutPlan('- Face Pulls: Light x20');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Face Pulls');
      expect(blocks[0].data.reps).toBe('Light x20');
      // BUG: weight is not extracted ("Light" is a qualitative weight label)
      expect(blocks[0].data.weight).toBeUndefined();
    }
  });

  test('"- Negative pull-ups: 3-5 reps (3s descent)" → exercise (COLON_DESCRIPTIVE_RE)', () => {
    // COLON_FORMAT_RE: after ":", "3-5 reps (3s descent)" — no "kg" → no match
    // COLON_SETSREPS_RE: "3" x? no "x" between "3" and "-5" → no match
    // COLON_DESCRIPTIVE_RE: name = "Negative pull-ups", reps = "3-5 reps (3s descent)"
    const blocks = parseWorkoutPlan('- Negative pull-ups: 3-5 reps (3s descent)');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Negative pull-ups');
      expect(blocks[0].data.reps).toBe('3-5 reps (3s descent)');
    }
  });
});

// ── Real DB — protocol/equipment lines ─────────────────────────────

describe('Real DB — protocol/equipment lines', () => {
  test('"- Damper: 8" → exercise (descriptive) via COLON_DESCRIPTIVE_RE', () => {
    // Starts with "- ", has colon → COLON_DESCRIPTIVE_RE matches
    // name = "Damper", reps = "8"
    const blocks = parseWorkoutPlan('- Damper: 8');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Damper');
      expect(blocks[0].data.reps).toBe('8');
      // BUG: "Damper: 8" is an equipment setting, not an exercise. Parsed as exercise anyway.
    }
  });

  test('"- Target: >300W average" → exercise (descriptive) via COLON_DESCRIPTIVE_RE', () => {
    // Starts with "- ", has colon → COLON_DESCRIPTIVE_RE matches
    // name = "Target", reps = ">300W average"
    const blocks = parseWorkoutPlan('- Target: >300W average');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Target');
      expect(blocks[0].data.reps).toBe('>300W average');
      // BUG: "Target: >300W average" is a performance cue, not an exercise
    }
  });

  test('"- 8x [20s MAX EFFORT / 1:40 complete rest]" → should NOT parse as exercise 8x20', () => {
    // No colon → not any COLON_* regex
    // EXERCISE_RE: needs @ weight → no
    // EXERCISE_NO_WEIGHT_RE: "8x" tries to match (.+?) (\d+)x(\d+) — but the "[" prevents
    //   Actually: "- 8x [20s..." → trimmed = "- 8x [20s..." → stripped = "8x [20s..."
    //   But wait, line-level: stripped (no dash) = "8x [20s MAX EFFORT / 1:40 complete rest]"
    //   Passed to parseExerciseToken as the full line "- 8x [20s MAX EFFORT / 1:40 complete rest]"
    //   Actually smartSplit first, then parseExerciseToken on tokens
    //   Token: "- 8x [20s MAX EFFORT / 1:40 complete rest]"
    //   EXERCISE_NO_WEIGHT_RE on trimmed: (.+?) (\d+)x(\d+) — need space before \d+x\d+
    //   "- 8x [20s..." — no space before "8x", so "- " is (.+?), "8" is (\d+), then x, then "["?
    //   No, "[" is not \d+ → no match
    // DURATION_RE: starts with \d+min/sec — "- 8x" doesn't match
    // COLON_DESCRIPTIVE_RE: needs "- " + colon — there IS a colon in "1:40"
    //   Pattern: /^-\s+(.+?):\s+(.+)$/ — "- 8x [20s MAX EFFORT / 1" : " 40 complete rest]"
    //   name = "8x [20s MAX EFFORT / 1", reps = "40 complete rest]"
    //   This matches! So it becomes an exercise with a mangled name.
    const blocks = parseWorkoutPlan('- 8x [20s MAX EFFORT / 1:40 complete rest]');
    expect(blocks).toHaveLength(1);
    // The ":" in "1:40" does NOT trigger COLON_DESCRIPTIVE_RE because there is no space
    // after the colon (1:40 has digit immediately). Falls through to text.
    expect(blocks[0].type).toBe('text');
  });
});

// ── Real DB — descriptive reps with qualifiers ─────────────────────

describe('Real DB — descriptive reps with qualifiers', () => {
  test('"- Burpees: 10 reps" → exercise, reps="10 reps"', () => {
    // COLON_FORMAT_RE: "10 reps" — no "kg" → no match
    // COLON_SETSREPS_RE: "10" as sets, then needs "x" — no "x" after "10" → no match
    // COLON_DESCRIPTIVE_RE: name = "Burpees", reps = "10 reps"
    const blocks = parseWorkoutPlan('- Burpees: 10 reps');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Burpees');
      expect(blocks[0].data.reps).toBe('10 reps');
    }
  });

  test('"- Med Ball Rotational Throws: 8/side" → exercise, reps="8/side"', () => {
    const blocks = parseWorkoutPlan('- Med Ball Rotational Throws: 8/side');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Med Ball Rotational Throws');
      expect(blocks[0].data.reps).toBe('8/side');
    }
  });

  test('"- Box Step-overs: 10/leg" → exercise, reps="10/leg"', () => {
    const blocks = parseWorkoutPlan('- Box Step-overs: 10/leg');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Box Step-overs');
      expect(blocks[0].data.reps).toBe('10/leg');
    }
  });

  test('"- Pallof Press: 10/side" → exercise, reps="10/side"', () => {
    const blocks = parseWorkoutPlan('- Pallof Press: 10/side');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Pallof Press');
      expect(blocks[0].data.reps).toBe('10/side');
    }
  });

  test('"- Russian Twists w/10kg: 20 total" → exercise, reps="20 total"', () => {
    // COLON_FORMAT_RE: "20 total" — no "kg" → no match
    // COLON_DESCRIPTIVE_RE: name = "Russian Twists w/10kg", reps = "20 total"
    const blocks = parseWorkoutPlan('- Russian Twists w/10kg: 20 total');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Russian Twists w/10kg');
      expect(blocks[0].data.reps).toBe('20 total');
      // BUG: weight is embedded in name ("w/10kg") but not extracted
      expect(blocks[0].data.weight).toBeUndefined();
    }
  });

  test('"- Band-assisted pull-ups: Max reps (aim 5-8)" → exercise, reps includes "Max reps"', () => {
    const blocks = parseWorkoutPlan('- Band-assisted pull-ups: Max reps (aim 5-8)');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Band-assisted pull-ups');
      expect(blocks[0].data.reps).toContain('Max reps');
      // Full reps field includes the parenthetical
      expect(blocks[0].data.reps).toBe('Max reps (aim 5-8)');
    }
  });

  test('"- Dead hang: Max time" → exercise, reps="Max time"', () => {
    const blocks = parseWorkoutPlan('- Dead hang: Max time');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Dead hang');
      expect(blocks[0].data.reps).toBe('Max time');
    }
  });

  test('"- Med Ball Slams: 10 reps" → exercise', () => {
    const blocks = parseWorkoutPlan('- Med Ball Slams: 10 reps');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Med Ball Slams');
      expect(blocks[0].data.reps).toBe('10 reps');
    }
  });

  // ── Layer 3: Display defense-in-depth ──────────────────────────────

  test('long single-line with labels → produces multiple blocks (not one text wall)', () => {
    const longLine = 'A) Goblet Squat: 30kg x10. B1) Hamstring Curl: 47.5kg x12. B2) Walking Lunges: 2x12kg DBs x10/leg. C1) Leg Press: 95kg x12. C2) Calf Press: 62.5kg x15';
    const blocks = parseWorkoutPlan(longLine);
    // Should NOT produce a single text block for >120 char input
    expect(blocks.length).toBeGreaterThan(1);
    // Should have multiple exercise or superset blocks (A) converts to A1: → superset)
    const exerciseCount = blocks.reduce((count, b) => {
      if (b.type === 'exercise') return count + 1;
      if (b.type === 'superset') return count + b.data.exercises.length;
      return count;
    }, 0);
    expect(exerciseCount).toBeGreaterThanOrEqual(3);
  });

  test('long single-line with periods → produces multiple blocks', () => {
    const longLine = 'Warm-up 5min bike Zone 2. Goblet Squat 30kg x10. Hamstring Curl 47.5kg x12. StairMaster 20min Zone 4. Calf Press 3x15 at 60kg';
    const blocks = parseWorkoutPlan(longLine);
    expect(blocks.length).toBeGreaterThan(1);
  });

  test('should never produce a single text block for >120 char input with multiple exercises', () => {
    const longLine = 'A) Goblet Squat: 30kg x10. B1) Hamstring Curl: 47.5kg x12. B2) Leg Press: 95kg x12. C1) Calf Press: 62.5kg x15. C2) Walking Lunges: 2x12kg DBs x10/leg';
    const blocks = parseWorkoutPlan(longLine);
    const textBlocks = blocks.filter((b) => b.type === 'text');
    // No single text block should contain the entire input
    for (const b of textBlocks) {
      if (typeof b.data === 'string') {
        expect(b.data.length).toBeLessThan(120);
      }
    }
  });

  test('"- Lateral Raises: 6kg x12" → exercise with weight', () => {
    const blocks = parseWorkoutPlan('- Lateral Raises: 6kg x12');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Lateral Raises');
      expect(blocks[0].data.weight).toBe('6kg');
      expect(blocks[0].data.reps).toBe('12');
    }
  });

  test('"- Band-assisted Pull-ups: Max reps" → exercise', () => {
    const blocks = parseWorkoutPlan('- Band-assisted Pull-ups: Max reps');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Band-assisted Pull-ups');
      expect(blocks[0].data.reps).toBe('Max reps');
    }
  });
});

// ── Real DB — section headers ──────────────────────────────────────

describe('Real DB — section headers', () => {
  test('"PM Gym:" → section', () => {
    // SECTION_RE: starts with PM → matches PM keyword
    const blocks = parseWorkoutPlan('PM Gym:');
    expect(blocks[0].type).toBe('section');
    expect(blocks[0].data).toBe('PM Gym');
  });

  test('"TRUE Rower Sprint Protocol:" → section (via fallback — multi-word line ending with ":")', () => {
    // SECTION_RE misses this (no keyword match), but SECTION_FALLBACK_RE catches it:
    // multi-word line ending with ":" → section header
    const blocks = parseWorkoutPlan('TRUE Rower Sprint Protocol:');
    expect(blocks[0].type).toBe('section');
    expect(blocks[0].data).toBe('TRUE Rower Sprint Protocol');
  });

  test('"Zone 4 StairMaster:" → section (via fallback — multi-word line ending with ":")', () => {
    // SECTION_RE misses this, but SECTION_FALLBACK_RE catches multi-word lines ending with ":"
    const blocks = parseWorkoutPlan('Zone 4 StairMaster:');
    expect(blocks[0].type).toBe('section');
    expect(blocks[0].data).toBe('Zone 4 StairMaster');
  });

  test('"Functional Circuit (3 rounds, 90s between):" → section (via fallback)', () => {
    // SECTION_RE misses this ("Functional" not a keyword), but SECTION_FALLBACK_RE catches it:
    // multi-word line with parens ending with ":"
    const blocks = parseWorkoutPlan('Functional Circuit (3 rounds, 90s between):');
    expect(blocks[0].type).toBe('section');
    expect(blocks[0].data).toBe('Functional Circuit (3 rounds, 90s between)');
  });

  test('"Investigation Set: DB Bench 22.5kg x max reps" → text (no section keyword, no leading dash)', () => {
    // "Investigation" is not in SECTION_RE keywords
    // Not INLINE_SECTION_RE (only AM/PM/Lunch/Evening/Morning)
    // parseExerciseToken: has colon but no leading dash → COLON_DESCRIPTIVE_RE won't match
    // COLON_FORMAT_RE: "DB Bench 22.5kg x max reps" — "max" is not \d+ → no match
    // Falls through to text
    const blocks = parseWorkoutPlan('Investigation Set: DB Bench 22.5kg x max reps');
    expect(blocks[0].type).toBe('text');
    if (blocks[0].type === 'text') {
      expect(blocks[0].data).toBe('Investigation Set: DB Bench 22.5kg x max reps');
    }
  });

  test('"Post-strength: 20min treadmill incline walk (10% grade, 4.5km/h)" → text (not a section keyword)', () => {
    // "Post-strength" is not a SECTION_RE keyword and not an INLINE_SECTION label
    // No leading dash → COLON_DESCRIPTIVE_RE won't match
    // parseExerciseToken processes it: EXERCISE_RE no, COLON_FORMAT_RE no,
    // DURATION_RE: starts with "Post-strength:" — no digit start → no match
    // → text
    const blocks = parseWorkoutPlan('Post-strength: 20min treadmill incline walk (10% grade, 4.5km/h)');
    expect(blocks[0].type).toBe('text');
    if (blocks[0].type === 'text') {
      expect(blocks[0].data).toBe('Post-strength: 20min treadmill incline walk (10% grade, 4.5km/h)');
    }
  });

  test('"Upper Plyo (3 sets, 90s rest):" → section (via fallback)', () => {
    // SECTION_RE misses this ("Upper" not a keyword), but SECTION_FALLBACK_RE catches it
    const blocks = parseWorkoutPlan('Upper Plyo (3 sets, 90s rest):');
    expect(blocks[0].type).toBe('section');
    expect(blocks[0].data).toBe('Upper Plyo (3 sets, 90s rest)');
  });
});

// ── Rest/recovery lines should NOT be cardio ───────────────────────

describe('Rest/recovery lines are NOT cardio', () => {
  test('"1min recovery" → text (not cardio)', () => {
    const blocks = parseWorkoutPlan('1min recovery');
    expect(blocks[0].type).toBe('text');
  });

  test('"2.5min recovery" → text (not cardio)', () => {
    const blocks = parseWorkoutPlan('2.5min recovery');
    expect(blocks[0].type).toBe('text');
  });

  test('"- 90s rest between sets" → text (not cardio)', () => {
    const blocks = parseWorkoutPlan('- 90s rest between sets');
    expect(blocks[0].type).toBe('text');
  });

  test('"20min StairMaster Zone 4" → cardio (unchanged)', () => {
    const blocks = parseWorkoutPlan('20min StairMaster Zone 4');
    expect(blocks[0].type).toBe('cardio');
  });

  test('"5min Zone 2 bike warm-up" → cardio (unchanged)', () => {
    const blocks = parseWorkoutPlan('5min Zone 2 bike warm-up');
    expect(blocks[0].type).toBe('cardio');
  });
});

// ── Superset grouping from B1:/B2: format ───────────────────────────

describe('Superset grouping from B1:/B2: format', () => {
  test('"B1: DB Bench 3x10 @22kg" + "B2: Pull-ups 3x5" → superset block', () => {
    const input = 'B1: DB Bench 3x10 @22kg\nB2: Pull-ups 3x5';
    const blocks = parseWorkoutPlan(input);
    const supersets = blocks.filter((b) => b.type === 'superset');
    expect(supersets.length).toBe(1);
    if (supersets[0].type === 'superset') {
      expect(supersets[0].data.label).toBe('Superset B');
      expect(supersets[0].data.exercises).toHaveLength(2);
    }
  });

  test('mixed labels: A standalone + B1/B2 superset', () => {
    const input = '- Goblet Squat: 30kg x10\nB1: Hamstring Curl: 47.5kg x12\nB2: Walking Lunges 3x10';
    const blocks = parseWorkoutPlan(input);
    const exercises = blocks.filter((b) => b.type === 'exercise');
    const supersets = blocks.filter((b) => b.type === 'superset');
    expect(exercises.length).toBeGreaterThanOrEqual(1);
    expect(supersets.length).toBe(1);
  });
});

// ── Expert review edge cases ────────────────────────────────────────

describe('Expert review — rest/recovery edge cases', () => {
  test('"5min recovery walk" → cardio (has both "recovery" AND "walk")', () => {
    const blocks = parseWorkoutPlan('5min recovery walk');
    expect(blocks[0].type).toBe('cardio');
    if (blocks[0].type === 'cardio') {
      expect(blocks[0].data.duration).toBe('5min');
    }
  });

  test('"2.5min recovery" → text with correct decimal handling', () => {
    const blocks = parseWorkoutPlan('2.5min recovery');
    expect(blocks[0].type).toBe('text');
  });
});

describe('Expert review — superset edge cases', () => {
  test('single B1 with no B2 → produces superset with 1 exercise', () => {
    const blocks = parseWorkoutPlan('B1: DB Bench 3x10 @22kg');
    const supersets = blocks.filter((b) => b.type === 'superset');
    expect(supersets.length).toBe(1);
    if (supersets[0].type === 'superset') {
      expect(supersets[0].data.exercises).toHaveLength(1);
    }
  });

  test('B1/B2 with intervening text → two separate superset blocks (not merged)', () => {
    const input = 'B1: DB Bench 3x10 @22kg\nSome coaching note\nB2: Pull-ups 3x5';
    const blocks = parseWorkoutPlan(input);
    const supersets = blocks.filter((b) => b.type === 'superset');
    expect(supersets.length).toBe(2);
  });

  test('"B1: Dead Hang: max hold" → superset exercise (descriptive colon format)', () => {
    const blocks = parseWorkoutPlan('B1: Dead Hang: max hold\nB2: Pull-ups 3x5');
    const supersets = blocks.filter((b) => b.type === 'superset');
    expect(supersets.length).toBe(1);
    if (supersets[0].type === 'superset') {
      expect(supersets[0].data.exercises).toHaveLength(2);
      expect(supersets[0].data.exercises[0].name).toBe('Dead Hang');
    }
  });

  test('F1/F2 labels (boundary of A-F range) → produces superset', () => {
    const blocks = parseWorkoutPlan('F1: Squat 3x10\nF2: Bench 3x8');
    const supersets = blocks.filter((b) => b.type === 'superset');
    expect(supersets.length).toBe(1);
  });

  test('G1/G2 labels (outside A-F range) → NOT a superset', () => {
    const blocks = parseWorkoutPlan('G1: Squat 3x10\nG2: Bench 3x8');
    const supersets = blocks.filter((b) => b.type === 'superset');
    expect(supersets.length).toBe(0);
  });
});

describe('Expert review — trailing period + parse interaction', () => {
  test('"- Goblet Squat: 28kg x10." → still parses as exercise after period strip', () => {
    const blocks = parseWorkoutPlan('- Goblet Squat: 28kg x10.');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Goblet Squat');
      expect(blocks[0].data.reps).toBe('10');
    }
  });
});

describe('Expert review — decimal duration capture', () => {
  test('"2.5min Zone 4 StairMaster" → cardio with duration "2.5min"', () => {
    const blocks = parseWorkoutPlan('2.5min Zone 4 StairMaster');
    expect(blocks[0].type).toBe('cardio');
    if (blocks[0].type === 'cardio') {
      expect(blocks[0].data.duration).toBe('2.5min');
    }
  });
});

// ── Real DB — compound/cardio/text lines ───────────────────────────

describe('Real DB — compound/cardio/text lines', () => {
  test('"- 5min warm-up Zone 2" → cardio with duration (DURATION_RE handles leading dash)', () => {
    // DURATION_RE now includes optional -?\s* prefix to handle dashed lines
    const blocks = parseWorkoutPlan('- 5min warm-up Zone 2');
    expect(blocks[0].type).toBe('cardio');
    if (blocks[0].type === 'cardio') {
      expect(blocks[0].data.duration).toBe('5min');
    }
  });

  test('"5min warm-up Zone 2" (without dash) → cardio', () => {
    const blocks = parseWorkoutPlan('5min warm-up Zone 2');
    expect(blocks[0].type).toBe('cardio');
    if (blocks[0].type === 'cardio') {
      expect(blocks[0].data.duration).toBe('5min');
    }
  });

  test('"- 5min cool-down" → cardio (DURATION_RE handles leading dash)', () => {
    const blocks = parseWorkoutPlan('- 5min cool-down');
    expect(blocks[0].type).toBe('cardio');
    if (blocks[0].type === 'cardio') {
      expect(blocks[0].data.duration).toBe('5min');
    }
  });

  test('"5min cool-down" (without dash) → cardio', () => {
    const blocks = parseWorkoutPlan('5min cool-down');
    expect(blocks[0].type).toBe('cardio');
    if (blocks[0].type === 'cardio') {
      expect(blocks[0].data.duration).toBe('5min');
    }
  });
});

// ── "or" syntax defense ─────────────────────────────────────────────

describe('"or" syntax defense — ambiguous conditionals fall to text', () => {
  test('"- DB Bench or 20kg+pauses: 3x10" → NOT parsed as exercise', () => {
    const blocks = parseWorkoutPlan('- DB Bench or 20kg+pauses: 3x10');
    const exercises = blocks.filter((b) => b.type === 'exercise');
    expect(exercises).toHaveLength(0);
    // Should fall through to text
    const textBlocks = blocks.filter((b) => b.type === 'text');
    expect(textBlocks.length).toBeGreaterThanOrEqual(1);
  });

  test('"- DB Bench: 22kg x10" → still parses as exercise (no regression)', () => {
    const blocks = parseWorkoutPlan('- DB Bench: 22kg x10');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('DB Bench');
      expect(blocks[0].data.weight).toBe('22kg');
      expect(blocks[0].data.reps).toBe('10');
    }
  });

  test('"- Lateral Raises or DB Flyes: 6kg x12" → NOT parsed as exercise', () => {
    const blocks = parseWorkoutPlan('- Lateral Raises or DB Flyes: 6kg x12');
    const exercises = blocks.filter((b) => b.type === 'exercise');
    expect(exercises).toHaveLength(0);
  });

  test('"Push-ups or Bench 3x10" → NOT parsed as exercise (no-weight format)', () => {
    const blocks = parseWorkoutPlan('Push-ups or Bench 3x10');
    const exercises = blocks.filter((b) => b.type === 'exercise');
    expect(exercises).toHaveLength(0);
  });

  test('"- DB Bench Or 20kg: 3x10" → NOT parsed (case-insensitive "Or")', () => {
    const blocks = parseWorkoutPlan('- DB Bench Or 20kg: 3x10');
    const exercises = blocks.filter((b) => b.type === 'exercise');
    expect(exercises).toHaveLength(0);
  });

  test('"Push-ups OR Bench 3x10 @ 50kg" → NOT parsed (uppercase "OR")', () => {
    const blocks = parseWorkoutPlan('Push-ups OR Bench 3x10 @ 50kg');
    const exercises = blocks.filter((b) => b.type === 'exercise');
    expect(exercises).toHaveLength(0);
  });

  test('"- Floor Press: 40kg x10" → still parses (name contains "or" substring, not word)', () => {
    const blocks = parseWorkoutPlan('- Floor Press: 40kg x10');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Floor Press');
      expect(blocks[0].data.weight).toBe('40kg');
    }
  });

  test('"- Core Rotation: 15kg x12/side" → still parses (name contains "or" substring)', () => {
    const blocks = parseWorkoutPlan('- Core Rotation: 15kg x12/side');
    expect(blocks[0].type).toBe('exercise');
    if (blocks[0].type === 'exercise') {
      expect(blocks[0].data.name).toBe('Core Rotation');
      expect(blocks[0].data.weight).toBe('15kg');
    }
  });
});

describe('Real DB — compound/cardio/text lines', () => {
  test('"Total: 40 minutes" (no leading dash) → text', () => {
    const blocks = parseWorkoutPlan('Total: 40 minutes');
    expect(blocks[0].type).toBe('text');
    if (blocks[0].type === 'text') {
      expect(blocks[0].data).toBe('Total: 40 minutes');
    }
  });
});

// ── Standard gym notation (letter-number labels) ─────────────────────

describe('Standard gym notation (letter-number labels)', () => {
  test('parses solo exercise C1: as single-member superset', () => {
    const blocks = parseWorkoutPlan('C1: Cable Row: 50kg x12');
    const supersets = blocks.filter((b) => b.type === 'superset');
    expect(supersets.length).toBe(1);
    if (supersets[0].type === 'superset') {
      expect(supersets[0].data.exercises).toHaveLength(1);
      expect(supersets[0].data.label).toBe('Superset C');
      expect(supersets[0].data.exercises[0].name).toBe('Cable Row');
      expect(supersets[0].data.exercises[0].weight).toBe('50kg');
    }
  });

  test('groups B1/B2 exercises under same superset', () => {
    const input = 'B1: Lat Pulldown: 45kg x12\nB2: Band Pull-aparts: x20';
    const blocks = parseWorkoutPlan(input);
    const supersets = blocks.filter((b) => b.type === 'superset');
    expect(supersets.length).toBe(1);
    if (supersets[0].type === 'superset') {
      expect(supersets[0].data.exercises).toHaveLength(2);
      expect(supersets[0].data.label).toBe('Superset B');
    }
  });

  test('attaches [3 rounds, 90s rest] as group note to preceding superset', () => {
    const input = 'B1: Lat Pulldown: 45kg x12\nB2: Band Pull-aparts: x20\n[3 rounds, 90s rest]';
    const blocks = parseWorkoutPlan(input);
    const supersets = blocks.filter((b) => b.type === 'superset');
    expect(supersets.length).toBe(1);
    if (supersets[0].type === 'superset') {
      expect(supersets[0].data.groupNote).toBe('3 rounds, 90s rest');
    }
  });

  test('renders group note as text when no preceding superset', () => {
    const blocks = parseWorkoutPlan('[3 rounds, 90s rest]');
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe('text');
    if (blocks[0].type === 'text') {
      expect(blocks[0].data).toBe('[3 rounds, 90s rest]');
    }
  });

  test('full new-format workout parses all blocks correctly', () => {
    const input = `Warm-up:
- 5min row easy

A1: Band-Assisted Pull-ups: Max reps (aim 5-8)
A2: Dead Hang: 30s
[3 rounds, 90s rest]

B1: Lat Pulldown: 45kg x12
B2: Band Pull-aparts: x20
[3 rounds, 90s rest]

C1: Cable Row: 50kg x12
[3 sets, 90s rest]`;

    const blocks = parseWorkoutPlan(input);

    // Should have: section (Warm-up), cardio (5min row), supersets A, B, C
    const sections = blocks.filter((b) => b.type === 'section');
    expect(sections.length).toBe(1);

    const supersets = blocks.filter((b) => b.type === 'superset');
    expect(supersets.length).toBe(3);

    // A superset has 2 exercises
    if (supersets[0].type === 'superset') {
      expect(supersets[0].data.exercises).toHaveLength(2);
      expect(supersets[0].data.groupNote).toBe('3 rounds, 90s rest');
    }

    // B superset has 2 exercises
    if (supersets[1].type === 'superset') {
      expect(supersets[1].data.exercises).toHaveLength(2);
      expect(supersets[1].data.groupNote).toBe('3 rounds, 90s rest');
    }

    // C superset has 1 exercise (solo)
    if (supersets[2].type === 'superset') {
      expect(supersets[2].data.exercises).toHaveLength(1);
      expect(supersets[2].data.groupNote).toBe('3 sets, 90s rest');
    }
  });
});

describe('Backward compatibility — old section-header format', () => {
  test('still parses "Superset A (3 rounds, 90s rest):" as section header', () => {
    const blocks = parseWorkoutPlan('Superset A (3 rounds, 90s rest):');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('section');
    expect(blocks[0].data).toBe('Superset A (3 rounds, 90s rest)');
  });
});
