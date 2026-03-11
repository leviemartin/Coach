import { describe, it, expect } from 'vitest';
import { normalizeWorkoutText } from '../lib/parse-schedule';

// ─── Real AI Output Patterns ─────────────────────────────────────────────────

const MONDAY_WORKOUT = [
  '**AM:** 3x2 negative pull-ups (5s descent)',
  '**Lunch/PM Gym:**',
  '5min Zone 2 bike warm-up',
  '**Superset A (3 rounds, 90s rest):**',
  '• Goblet Squat: 28kg x10',
  '• Hamstring Curl: 45kg x12',
  '**Superset B (3 rounds, 90s rest):**',
  '• Leg Press: 90kg x12 (feet high)',
  '• Walking Lunges: 2x10kg DBs x10/leg',
  'Calf Press 3x15 @ 60kg',
  '20min StairMaster Zone 4 intervals (3min on/1min off)',
].join('<br>');

const WEDNESDAY_WORKOUT = [
  '**AM:** 3x2 negative pull-ups (5s descent)',
  '**Lunch/PM Gym:**',
  '5min Zone 2 rower warm-up',
  '**Superset A (3 rounds, 90s rest):**',
  '• Chest Press Machine: 50kg x10',
  '• Lat Pulldown: 50kg x10',
  '**Superset B (3 rounds, 90s rest):**',
  '• Seated Row: 55kg x12',
  '• DB Shoulder Press: 16kg x10',
  '**Grip Circuit (3 rounds, 2min rest):**',
  '• Dead Hang: max hold',
  "• Farmer's Walk: 24kg/hand x 30m",
  'Rower Sprint Protocol: 5x 20s @ >300W / 1:40 rest',
].join('<br>');

const COACH_CUES = [
  '**Squat depth:** stop at parallel, watch knee tracking',
  "**Leg Press:** feet HIGH on sled — Baker's Cyst protocol",
  '• StairMaster: Levels 8-12 for Zone 4',
  '**Rug Protocol:** GOWOD hip opener + hamstring flow',
].join('<br>');

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('normalizeWorkoutText', () => {
  // ── Basic transformations ──────────────────────────────────────────────

  it('converts <br> tags to newlines', () => {
    const result = normalizeWorkoutText('line one<br>line two<br>line three');
    expect(result).toBe('line one\nline two\nline three');
    expect(result).not.toContain('<br>');
  });

  it('converts <br/> (self-closing) to newlines', () => {
    const result = normalizeWorkoutText('line one<br/>line two');
    expect(result).toBe('line one\nline two');
    expect(result).not.toContain('<br/>');
  });

  it('converts <br /> (self-closing with space) to newlines', () => {
    const result = normalizeWorkoutText('line one<br />line two');
    expect(result).toBe('line one\nline two');
    expect(result).not.toContain('<br />');
  });

  it('converts <BR> (uppercase) to newlines', () => {
    const result = normalizeWorkoutText('line one<BR>line two');
    expect(result).toBe('line one\nline two');
    expect(result).not.toContain('<BR>');
  });

  it('converts <BR/> and <BR /> (uppercase variants) to newlines', () => {
    const result = normalizeWorkoutText('a<BR/>b<BR />c');
    expect(result).toBe('a\nb\nc');
  });

  it('strips markdown bold markers', () => {
    const result = normalizeWorkoutText('**AM:** pull-ups');
    expect(result).toBe('AM: pull-ups');
    expect(result).not.toContain('**');
  });

  it('replaces bullet characters with dashes', () => {
    const result = normalizeWorkoutText('• Goblet Squat: 28kg x10');
    expect(result).toBe('- Goblet Squat: 28kg x10');
    expect(result).not.toContain('•');
  });

  it('collapses 3+ consecutive newlines to double newline', () => {
    const result = normalizeWorkoutText('a\n\n\n\nb');
    expect(result).toBe('a\n\nb');
  });

  it('preserves exactly two consecutive newlines', () => {
    const result = normalizeWorkoutText('a\n\nb');
    expect(result).toBe('a\n\nb');
  });

  it('trims leading and trailing whitespace', () => {
    const result = normalizeWorkoutText('  hello world  ');
    expect(result).toBe('hello world');
  });

  // ── Empty and passthrough ──────────────────────────────────────────────

  it('handles empty string', () => {
    const result = normalizeWorkoutText('');
    expect(result).toBe('');
  });

  it('passes through already-clean text unchanged', () => {
    const clean = 'Calf Press 3x15 @ 60kg';
    expect(normalizeWorkoutText(clean)).toBe(clean);
  });

  it('passes through text with single asterisks (not bold)', () => {
    const text = '30*2 reps at 50kg';
    expect(normalizeWorkoutText(text)).toBe('30*2 reps at 50kg');
  });

  // ── Nested / tricky bold patterns ──────────────────────────────────────

  it('handles nested bold markers', () => {
    const result = normalizeWorkoutText('**text with **inner** bold**');
    // First match: **text with ** -> "text with "
    // Remaining scan finds **bold** -> "bold"
    // "inner" survives unmodified
    expect(result).not.toContain('**');
    expect(result).toContain('text with');
    expect(result).toContain('inner');
    expect(result).toContain('bold');
  });

  it('handles multiple bold sections on one line', () => {
    const result = normalizeWorkoutText(
      '**Superset A** (3 rounds): **Squat** 80kg'
    );
    expect(result).toBe('Superset A (3 rounds): Squat 80kg');
  });

  // ── Real-world Pattern 1: Monday workout ───────────────────────────────

  describe('Pattern 1 — Monday workout', () => {
    let result: string;

    it('produces clean output with no HTML or markdown artifacts', () => {
      result = normalizeWorkoutText(MONDAY_WORKOUT);
      expect(result).not.toContain('<br>');
      expect(result).not.toContain('<br/>');
      expect(result).not.toContain('**');
      expect(result).not.toContain('•');
    });

    it('converts bullets to dashes', () => {
      result = normalizeWorkoutText(MONDAY_WORKOUT);
      expect(result).toContain('- Goblet Squat: 28kg x10');
      expect(result).toContain('- Hamstring Curl: 45kg x12');
      expect(result).toContain('- Leg Press: 90kg x12 (feet high)');
      expect(result).toContain('- Walking Lunges: 2x10kg DBs x10/leg');
    });

    it('strips bold from section headers', () => {
      result = normalizeWorkoutText(MONDAY_WORKOUT);
      expect(result).toContain('AM: 3x2 negative pull-ups (5s descent)');
      expect(result).toContain('Lunch/PM Gym:');
      expect(result).toContain('Superset A (3 rounds, 90s rest):');
      expect(result).toContain('Superset B (3 rounds, 90s rest):');
    });

    it('separates lines with newlines', () => {
      result = normalizeWorkoutText(MONDAY_WORKOUT);
      const lines = result.split('\n');
      expect(lines.length).toBe(11);
      expect(lines[0]).toBe('AM: 3x2 negative pull-ups (5s descent)');
      expect(lines[lines.length - 1]).toBe(
        '20min StairMaster Zone 4 intervals (3min on/1min off)'
      );
    });
  });

  // ── Real-world Pattern 2: Wednesday workout ────────────────────────────

  describe('Pattern 2 — Wednesday workout', () => {
    let result: string;

    it('produces clean output with no HTML or markdown artifacts', () => {
      result = normalizeWorkoutText(WEDNESDAY_WORKOUT);
      expect(result).not.toContain('<br>');
      expect(result).not.toContain('**');
      expect(result).not.toContain('•');
    });

    it('preserves grip circuit section', () => {
      result = normalizeWorkoutText(WEDNESDAY_WORKOUT);
      expect(result).toContain('Grip Circuit (3 rounds, 2min rest):');
      expect(result).toContain('- Dead Hang: max hold');
      expect(result).toContain("- Farmer's Walk: 24kg/hand x 30m");
    });

    it('preserves rower sprint protocol', () => {
      result = normalizeWorkoutText(WEDNESDAY_WORKOUT);
      expect(result).toContain(
        'Rower Sprint Protocol: 5x 20s @ >300W / 1:40 rest'
      );
    });

    it('has correct line count', () => {
      result = normalizeWorkoutText(WEDNESDAY_WORKOUT);
      const lines = result.split('\n');
      expect(lines.length).toBe(13);
    });
  });

  // ── Real-world Pattern 3: Coach cues ───────────────────────────────────

  describe('Pattern 3 — Coach cues', () => {
    it('produces clean output', () => {
      const result = normalizeWorkoutText(COACH_CUES);
      expect(result).not.toContain('<br>');
      expect(result).not.toContain('**');
      expect(result).not.toContain('•');
    });

    it('strips bold from cue labels but preserves content', () => {
      const result = normalizeWorkoutText(COACH_CUES);
      expect(result).toContain(
        'Squat depth: stop at parallel, watch knee tracking'
      );
      expect(result).toContain(
        "Leg Press: feet HIGH on sled — Baker's Cyst protocol"
      );
      expect(result).toContain('- StairMaster: Levels 8-12 for Zone 4');
      expect(result).toContain(
        'Rug Protocol: GOWOD hip opener + hamstring flow'
      );
    });

    it('has correct line count', () => {
      const result = normalizeWorkoutText(COACH_CUES);
      expect(result.split('\n').length).toBe(4);
    });
  });

  // ── Week 10 Patterns (label-prefix + period-separated) ────────────────

  describe('Week 10 — label-prefix format', () => {
    const WEEK10_MONDAY = 'A) Goblet Squat: 30kg x10. B1) Hamstring Curl: 47.5kg x12. B2) Walking Lunges: 2x12kg DBs x10/leg. C1) Leg Press: 95kg x12. C2) Calf Press: 62.5kg x15';

    it('splits label-prefix period-separated text into separate lines', () => {
      const result = normalizeWorkoutText(WEEK10_MONDAY);
      const lines = result.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(5);
    });

    it('converts label prefixes: all labels to colon format', () => {
      const result = normalizeWorkoutText(WEEK10_MONDAY);
      expect(result).not.toMatch(/[A-Z]\d?\)/);
      expect(result).toContain('A1: Goblet Squat');
      expect(result).toContain('B1: Hamstring Curl');
      expect(result).toContain('B2: Walking Lunges');
      expect(result).toContain('C1: Leg Press');
      expect(result).toContain('C2: Calf Press');
    });

    it('does not contain period-separated wall of text', () => {
      const result = normalizeWorkoutText(WEEK10_MONDAY);
      // No line should be >120 chars (the original is ~180+)
      for (const line of result.split('\n')) {
        expect(line.length).toBeLessThan(120);
      }
    });
  });

  describe('Week 10 — period-separated without labels', () => {
    const PERIOD_TEXT = 'Warm-up 5min bike Zone 2. Goblet Squat 30kg x10. Hamstring Curl 47.5kg x12. StairMaster 20min Zone 4';

    it('splits period-separated sentences into lines', () => {
      const result = normalizeWorkoutText(PERIOD_TEXT);
      const lines = result.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Mixed format — some newlines + some periods', () => {
    const MIXED = 'Warm-up:\n- 5min bike Zone 2\nGoblet Squat 30kg x10. Hamstring Curl 47.5kg x12';

    it('period-splits per-line even when other lines have newlines', () => {
      const result = normalizeWorkoutText(MIXED);
      // Per-line period split: the third line has 2 segments → split
      expect(result).toContain('Goblet Squat 30kg x10');
      expect(result).toContain('Hamstring Curl 47.5kg x12');
      expect(result).not.toContain('Goblet Squat 30kg x10. Hamstring Curl');
    });
  });

  describe('Already clean newline content', () => {
    const CLEAN = 'Warm-up:\n- 5min bike Zone 2\nSuperset A (3 rounds, 90s rest):\n- Goblet Squat: 28kg x10\n- Hamstring Curl: 45kg x12';

    it('passes through unchanged', () => {
      const result = normalizeWorkoutText(CLEAN);
      expect(result).toBe(CLEAN);
    });
  });

  // ── Trailing periods ─────────────────────────────────────────────────

  describe('Trailing periods', () => {
    it('strips trailing period from "20 steps."', () => {
      expect(normalizeWorkoutText('20 steps.')).toBe('20 steps');
    });

    it('strips trailing period from "Normal food intake."', () => {
      expect(normalizeWorkoutText('Normal food intake.')).toBe('Normal food intake');
    });

    it('does not strip period followed by digit ("47.5kg")', () => {
      expect(normalizeWorkoutText('Squat 47.5kg')).toBe('Squat 47.5kg');
    });

    it('strips trailing period on each line', () => {
      const result = normalizeWorkoutText('Line one.\nLine two.');
      expect(result).toBe('Line one\nLine two');
    });
  });

  // ── Superset label preservation ─────────────────────────────────────

  describe('Superset label preservation', () => {
    it('converts "B1) DB Bench 3x10" to "B1: DB Bench 3x10"', () => {
      expect(normalizeWorkoutText('B1) DB Bench 3x10')).toBe('B1: DB Bench 3x10');
    });

    it('converts "A) Med ball throws 3x6" to "A1: Med ball throws 3x6"', () => {
      expect(normalizeWorkoutText('A) Med ball throws 3x6')).toBe('A1: Med ball throws 3x6');
    });

    it('converts all labels to colon format', () => {
      const input = 'A) Goblet Squat: 30kg x10\nB1) Hamstring Curl: 47.5kg x12\nB2) Walking Lunges: 2x12kg DBs x10/leg';
      const result = normalizeWorkoutText(input);
      expect(result).toContain('A1: Goblet Squat');
      expect(result).toContain('B1: Hamstring Curl');
      expect(result).toContain('B2: Walking Lunges');
    });
  });

  // ── Expert review edge cases ──────────────────────────────────────────

  describe('Expert review — period-split edge cases', () => {
    it('strips trailing period from "47.5kg." correctly', () => {
      expect(normalizeWorkoutText('Hamstring Curl: 47.5kg.')).toBe('Hamstring Curl: 47.5kg');
    });

    it('handles double period "Squat 3x10.. Bench 3x8" without empty lines', () => {
      const result = normalizeWorkoutText('Squat 3x10.. Bench 3x8');
      const lines = result.split('\n');
      for (const line of lines) {
        expect(line.trim()).not.toBe('');
      }
    });

    it('period-split then trailing period strip pipeline: "Squat 3x10. Bench 3x8."', () => {
      const result = normalizeWorkoutText('Squat 3x10. Bench 3x8.');
      expect(result).toContain('Squat 3x10');
      expect(result).toContain('Bench 3x8');
      expect(result).not.toMatch(/\.$/m);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('handles consecutive <br> tags (collapsed newlines)', () => {
      const result = normalizeWorkoutText('a<br><br><br><br>b');
      expect(result).toBe('a\n\nb');
    });

    it('handles mixed <br> variants in one string', () => {
      const result = normalizeWorkoutText('a<br>b<BR>c<br/>d<br />e');
      expect(result).toBe('a\nb\nc\nd\ne');
    });

    it('handles bold markers with no content between them', () => {
      const result = normalizeWorkoutText('before **** after');
      expect(result).toBe('before  after');
    });

    it('handles whitespace-only input', () => {
      const result = normalizeWorkoutText('   ');
      expect(result).toBe('');
    });

    it('handles input that is only <br> tags', () => {
      const result = normalizeWorkoutText('<br><br><br>');
      expect(result).toBe('');
    });

    it('does not strip single asterisks used for multiplication', () => {
      const result = normalizeWorkoutText('Do 5*3 sets of squats');
      expect(result).toBe('Do 5*3 sets of squats');
    });

    it('handles all transformations combined', () => {
      const input =
        '**Header:**<br>• Item 1<BR/>• Item 2<br /><br><br>**Footer**';
      const result = normalizeWorkoutText(input);
      expect(result).not.toContain('<br');
      expect(result).not.toContain('<BR');
      expect(result).not.toContain('**');
      expect(result).not.toContain('•');
      expect(result).toContain('Header:');
      expect(result).toContain('- Item 1');
      expect(result).toContain('- Item 2');
      expect(result).toContain('Footer');
    });
  });
});
