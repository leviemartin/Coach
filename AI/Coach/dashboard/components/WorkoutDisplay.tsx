'use client';

import React from 'react';
import { Box, Typography, Chip } from '@mui/material';

// ── Types ──────────────────────────────────────────────────────────────

interface ParsedExercise {
  name: string;
  sets?: number;
  reps?: number | string;
  weight?: string;
  annotations: string[];  // e.g. "(PROGRESS)", "(DELOAD)"
  raw: string;
}

interface ParsedCardio {
  description: string;
  duration?: string;
  raw: string;
}

interface ParsedConditional {
  condition: string;
  body: string;
}

interface SupersetGroup {
  label: string;
  exercises: ParsedExercise[];
  groupNote?: string;  // e.g. "3 rounds, 90s rest"
}

type ParsedBlock =
  | { type: 'conditional'; data: ParsedConditional }
  | { type: 'exercise'; data: ParsedExercise }
  | { type: 'cardio'; data: ParsedCardio }
  | { type: 'superset'; data: SupersetGroup }
  | { type: 'section'; data: string }
  | { type: 'text'; data: string };

// ── Parsing ────────────────────────────────────────────────────────────

const EXERCISE_RE = /^(.+?)\s+(\d+)x(\d+(?:-\d+)?)\s*@\s*(\d+(?:\.\d+)?kg)(.*)$/;
const EXERCISE_NO_WEIGHT_RE = /^(.+?)\s+(\d+)x(\d+(?:-\d+)?)\s*(.*)$/;
const DURATION_RE = /^-?\s*(\d+(?:\.\d+)?\s*(?:min|sec|s|m|hr|hours?))\b/i;
const ANNOTATION_RE = /\(([A-Z]+)\)/g;
const SUPERSET_LABEL_RE = /^([A-F]\d)\s*[:.–-]\s*/;
const GROUP_NOTE_RE = /^\[(.+)\]$/;

// Section header keywords — line must end with ":" and start with one of these
const SECTION_RE = /^((?:Superset|Circuit|Warm[- ]?up|Cool[- ]?down|AM|PM|Lunch|Finisher|Core|Conditioning|Grip|Block|Round|Part|Phase|Main|Accessory|Giant\s+Set|Tri[- ]?Set)[\w\s/'-]*(?:\([^)]+\))?)\s*:$/i;

// Fallback section header: any multi-word line ending with ":" (with optional parens)
// that isn't a simple "Name: value" exercise line. Catches "Zone 4 StairMaster:",
// "TRUE Rower Sprint Protocol:", "Pull-Up Circuit (3 rounds, 2min rest):", etc.
const SECTION_FALLBACK_RE = /^([\w][\w\s/'-]+(?:\([^)]+\))?)\s*:$/;

// Inline section: "AM: 3x2 negative pull-ups" — short label followed by content on same line
const INLINE_SECTION_RE = /^(AM|PM|Lunch(?:\/PM)?\s*(?:Gym)?|Evening|Morning)\s*:\s+(.+)$/i;

// Colon format: "- Exercise: 28kg x10" or "Exercise: 45kg x12" or "Exercise: 15kg x12/side"
const COLON_FORMAT_RE = /^-?\s*(.+?):\s*(\d+(?:\.\d+)?kg)\s*x\s*(\d+(?:-\d+)?(?:\/\w+)?)\s*(.*)$/;

// Colon format with weight+qualifier: "- Farmer's Walk: 24kg/hand x 30m"
const COLON_WEIGHT_QUALIFIER_RE = /^-?\s*(.+?):\s*(\d+(?:\.\d+)?kg\/\w+)\s+x\s+(.+)$/;

// Colon format with compound weight: "- Walking Lunges: 2x10kg DBs x10/leg"
const COLON_COMPOUND_RE = /^-?\s*(.+?):\s*(\d+x\d+(?:\.\d+)?kg\s*\w*)\s+x\s*(\d+\S*)\s*(.*)$/;

// Colon format with sets first: "- Exercise: 3x10 @ 28kg" or "- Exercise: 3x10"
// After matching, we validate that the reps are not followed by a time unit (s/sec/min)
// or preceded by "kg" to reject false positives like "5x 20s" or "2x10kg"
const COLON_SETSREPS_RE = /^-?\s*(.+?):\s*(\d+)\s*x\s*(\d+(?:-\d+)?)\s*(?:@\s*(\d+(?:\.\d+)?kg))?\s*(.*)$/;

// Colon format descriptive: "- Dead Hang: max hold" — exercise name + free-text description
const COLON_DESCRIPTIVE_RE = /^-\s+(.+?):\s+(.+)$/;

/**
 * Defensive sanitization: strip HTML/markdown formatting artifacts that may
 * exist in old database records inserted before normalizeWorkoutText existed.
 */
function sanitizeWorkoutText(raw: string): string {
  let text = raw;
  // Convert HTML line breaks to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  // Strip markdown bold markers
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  // Replace bullet characters with dashes
  text = text.replace(/•/g, '-');
  // Collapse multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  // Strip trailing periods from exercise/instruction lines
  text = text.replace(/\.(\n|$)/g, '$1');
  return text.trim();
}

function extractAnnotations(text: string): { clean: string; annotations: string[] } {
  const annotations: string[] = [];
  const clean = text.replace(ANNOTATION_RE, (_, a) => {
    annotations.push(a);
    return '';
  }).trim();
  return { clean, annotations };
}

/** Reject ambiguous "or" syntax in exercise names (case-insensitive) */
const AMBIGUOUS_OR_RE = /\sor\s/i;

function parseExerciseToken(token: string): ParsedBlock | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  // Try sets x reps @ weight: "Calf Press 3x15 @ 60kg"
  const matchFull = trimmed.match(EXERCISE_RE);
  if (matchFull && !AMBIGUOUS_OR_RE.test(matchFull[1])) {
    const { annotations } = extractAnnotations(matchFull[5]);
    return {
      type: 'exercise',
      data: {
        name: matchFull[1].trim(),
        sets: parseInt(matchFull[2]),
        reps: matchFull[3],
        weight: matchFull[4],
        annotations,
        raw: trimmed,
      },
    };
  }

  // Try sets x reps without weight: "Push-ups 3x10"
  const matchNoWeight = trimmed.match(EXERCISE_NO_WEIGHT_RE);
  if (matchNoWeight) {
    // Reject if reps are followed by time units (e.g. "5x 20s") or "kg" (e.g. "2x10kg")
    const rest = matchNoWeight[4];
    if (/^(?:s|sec|min|m|kg)\b/i.test(rest)) {
      // Fall through — this is a protocol/weight spec, not a SxR exercise
    } else if (AMBIGUOUS_OR_RE.test(matchNoWeight[1])) {
      // Fall through — ambiguous "or" syntax (e.g. "DB Bench or 20kg+pauses")
    } else {
      const { annotations } = extractAnnotations(rest);
      return {
        type: 'exercise',
        data: {
          name: matchNoWeight[1].trim(),
          sets: parseInt(matchNoWeight[2]),
          reps: matchNoWeight[3],
          annotations,
          raw: trimmed,
        },
      };
    }
  }

  // Try colon format: "- Exercise: 28kg x10"
  const colonMatch = trimmed.match(COLON_FORMAT_RE);
  if (colonMatch && !AMBIGUOUS_OR_RE.test(colonMatch[1])) {
    const { annotations } = extractAnnotations(colonMatch[4]);
    return {
      type: 'exercise',
      data: {
        name: colonMatch[1].trim(),
        weight: colonMatch[2],
        reps: colonMatch[3],
        annotations,
        raw: trimmed,
      },
    };
  }

  // Try colon format with compound weight: "- Walking Lunges: 2x10kg DBs x10/leg"
  const compoundMatch = trimmed.match(COLON_COMPOUND_RE);
  if (compoundMatch && !AMBIGUOUS_OR_RE.test(compoundMatch[1])) {
    const { annotations } = extractAnnotations(compoundMatch[4]);
    return {
      type: 'exercise',
      data: {
        name: compoundMatch[1].trim(),
        weight: compoundMatch[2].trim(),
        reps: compoundMatch[3],
        annotations,
        raw: trimmed,
      },
    };
  }

  // Try colon format with weight+qualifier: "- Farmer's Walk: 24kg/hand x 30m"
  const qualifierMatch = trimmed.match(COLON_WEIGHT_QUALIFIER_RE);
  if (qualifierMatch && !AMBIGUOUS_OR_RE.test(qualifierMatch[1])) {
    return {
      type: 'exercise',
      data: {
        name: qualifierMatch[1].trim(),
        weight: qualifierMatch[2],
        reps: qualifierMatch[3].trim(),
        annotations: [],
        raw: trimmed,
      },
    };
  }

  // Try colon format with sets: "- Exercise: 3x10 @ 28kg"
  const colonSetsMatch = trimmed.match(COLON_SETSREPS_RE);
  if (colonSetsMatch) {
    // Reject if the rest starts with "kg" (means NxNkg is a weight, not sets x reps)
    const rest = colonSetsMatch[5];
    if (/^kg\b/i.test(rest)) {
      // Fall through — "2x10kg" is a weight spec, not 2 sets of 10 reps
    } else if (/^(?:s|sec|min|m)\b/i.test(rest)) {
      // Fall through — "5x 20s" is a protocol/time spec, not sets x reps
    } else if (AMBIGUOUS_OR_RE.test(colonSetsMatch[1])) {
      // Fall through — ambiguous "or" syntax (e.g. "DB Bench or 20kg+pauses: 3x10")
    } else {
      const { annotations } = extractAnnotations(rest);
      return {
        type: 'exercise',
        data: {
          name: colonSetsMatch[1].trim(),
          sets: parseInt(colonSetsMatch[2]),
          reps: colonSetsMatch[3],
          weight: colonSetsMatch[4] || undefined,
          annotations,
          raw: trimmed,
        },
      };
    }
  }

  // Try cardio / duration-based: "20min StairMaster Zone 4 intervals"
  const durationMatch = trimmed.match(DURATION_RE);
  if (durationMatch) {
    // Guard: rest/recovery instructions are NOT cardio
    const lower = trimmed.toLowerCase();
    const isRest = /\b(?:rest|recovery)\b/.test(lower);
    const isCardioActivity = /\b(?:zone|interval|stairmaster|rower|bike|treadmill|walk|run|swim)\b/i.test(lower);
    if (isRest && !isCardioActivity) {
      return { type: 'text', data: trimmed };
    }
    return {
      type: 'cardio',
      data: {
        description: trimmed,
        duration: durationMatch[1],
        raw: trimmed,
      },
    };
  }

  // Try colon descriptive exercise: "- Dead Hang: max hold"
  // Must start with dash to distinguish from random colon text
  const descriptiveMatch = trimmed.match(COLON_DESCRIPTIVE_RE);
  if (descriptiveMatch && !AMBIGUOUS_OR_RE.test(descriptiveMatch[1])) {
    return {
      type: 'exercise',
      data: {
        name: descriptiveMatch[1].trim(),
        reps: descriptiveMatch[2].trim(),
        annotations: [],
        raw: trimmed,
      },
    };
  }

  // Plain text fallback
  return { type: 'text', data: trimmed };
}

/**
 * Split on comma or " + " but NOT inside parentheses.
 * "Grip Circuit (3 rounds, 2min rest)" stays intact.
 */
function smartSplit(text: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);

    if (depth === 0) {
      // Check for comma split
      if (ch === ',') {
        tokens.push(current.trim());
        current = '';
        // Skip optional whitespace after comma
        while (i + 1 < text.length && text[i + 1] === ' ') i++;
        continue;
      }
      // Check for " + " split
      if (ch === ' ' && text.slice(i, i + 3) === ' + ') {
        tokens.push(current.trim());
        current = '';
        i += 2; // skip " + "
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens.filter(Boolean);
}

export function parseWorkoutPlan(text: string): ParsedBlock[] {
  if (!text || !text.trim()) return [];

  // Defensive sanitization — strips <br>, **bold**, • from old DB records
  const sanitized = sanitizeWorkoutText(text);

  const blocks: ParsedBlock[] = [];
  // Split on line breaks first, then on comma/plus within lines
  const rawLines = sanitized.split(/\n/).map((l) => l.trim()).filter(Boolean);

  // Layer 3: Display defense — expand any remaining long single-line blocks
  const lines: string[] = [];
  for (const line of rawLines) {
    if (line.length > 120) {
      // Try label-prefix split: "A) ... B1) ... C2) ..."
      const labelSplit = line.split(/(?=\s[A-Z]\d?\)\s)/);
      if (labelSplit.length >= 3) {
        for (const seg of labelSplit) {
          const t = seg.trim().replace(/^([A-Z])(\d?)\)\s+/, (_, letter, digit) => digit ? `${letter}${digit}: ` : `${letter}1: `);
          if (t) lines.push(t);
        }
        continue;
      }
      // Try colon-format label split: "B1: ... C1: ... C2: ..."
      const colonLabelSplit = line.split(/(?=\s[A-Z]\d\s*:\s)/);
      if (colonLabelSplit.length >= 3) {
        for (const seg of colonLabelSplit) {
          if (seg.trim()) lines.push(seg.trim());
        }
        continue;
      }
      // Try period split: "Exercise. Exercise. ..."
      const periodSplit = line.split(/\.\s+(?=[A-Z])/);
      if (periodSplit.length >= 3) {
        for (const seg of periodSplit) {
          if (seg.trim()) lines.push(seg.trim());
        }
        continue;
      }
    }
    lines.push(line);
  }

  for (const line of lines) {
    // Strip leading dash for line-level checks (but keep original for token parsing)
    const stripped = line.replace(/^-\s*/, '').trim();

    // Check for group note: "[3 rounds, 90s rest]"
    const groupNoteMatch = stripped.match(GROUP_NOTE_RE);
    if (groupNoteMatch) {
      blocks.push({ type: 'text', data: `[${groupNoteMatch[1]}]` });
      continue;
    }

    // Check for section header: "Superset A (3 rounds, 90s rest):" or "AM:" etc.
    const sectionMatch = stripped.match(SECTION_RE);
    if (sectionMatch) {
      blocks.push({ type: 'section', data: sectionMatch[1].trim() });
      continue;
    }

    // Fallback section header: multi-word line ending with ":" that doesn't match keywords
    // e.g. "Zone 4 StairMaster:", "TRUE Rower Sprint Protocol:", "Pull-Up Circuit (3 rounds):"
    const sectionFallback = stripped.match(SECTION_FALLBACK_RE);
    if (sectionFallback && /\s/.test(sectionFallback[1].trim())) {
      blocks.push({ type: 'section', data: sectionFallback[1].trim() });
      continue;
    }

    // Check for inline section: "AM: 3x2 negative pull-ups (5s descent)"
    // Emits a section header, then parses the rest as a separate line
    const inlineMatch = line.match(INLINE_SECTION_RE);
    if (inlineMatch) {
      blocks.push({ type: 'section', data: inlineMatch[1].trim() });
      const rest = inlineMatch[2].trim();
      if (rest) {
        const parsed = parseExerciseToken(rest);
        if (parsed) blocks.push(parsed);
      }
      continue;
    }

    // Check for conditional
    if (/^IF\s+/i.test(line)) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const condition = line.slice(0, colonIdx).trim();
        const body = line.slice(colonIdx + 1).trim();
        blocks.push({ type: 'conditional', data: { condition, body } });

        // Parse the body part for exercises
        const bodyTokens = smartSplit(body);
        for (const token of bodyTokens) {
          const parsed = parseExerciseToken(token);
          if (parsed) blocks.push(parsed);
        }
        continue;
      }
      // No colon — treat the whole line as conditional
      blocks.push({ type: 'conditional', data: { condition: line, body: '' } });
      continue;
    }

    // Split on comma or " + " for multiple exercises on one line,
    // but NOT commas inside parentheses
    const tokens = smartSplit(line);

    // Check for superset patterns (A1/A2, B1/B2)
    const supersetMap = new Map<string, ParsedExercise[]>();
    const nonSuperset: string[] = [];

    for (const token of tokens) {
      const ssMatch = token.match(SUPERSET_LABEL_RE);
      if (ssMatch) {
        const groupLetter = ssMatch[1][0]; // "A", "B", "C"
        let exerciseText = token.replace(SUPERSET_LABEL_RE, '').trim();
        // Prepend "- " so COLON_DESCRIPTIVE_RE can match (it requires leading dash)
        if (exerciseText && !exerciseText.startsWith('-')) {
          exerciseText = '- ' + exerciseText;
        }
        const parsed = parseExerciseToken(exerciseText);
        if (parsed && parsed.type === 'exercise') {
          const group = supersetMap.get(groupLetter) ?? [];
          if (!supersetMap.has(groupLetter)) supersetMap.set(groupLetter, group);
          group.push(parsed.data);
        } else {
          nonSuperset.push(token);
        }
      } else {
        nonSuperset.push(token);
      }
    }

    // Emit superset groups
    for (const [letter, exercises] of supersetMap) {
      blocks.push({
        type: 'superset',
        data: { label: `Superset ${letter}`, exercises },
      });
    }

    // Emit non-superset tokens
    for (const token of nonSuperset) {
      const parsed = parseExerciseToken(token);
      if (parsed) blocks.push(parsed);
    }
  }

  // Post-process: merge consecutive superset blocks with the same letter,
  // and attach group notes to preceding supersets
  const merged: ParsedBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // Attach group notes to preceding superset
    if (block.type === 'text' && typeof block.data === 'string') {
      const noteMatch = (block.data as string).match(/^\[(.+)\]$/);
      if (noteMatch) {
        const prev = merged[merged.length - 1];
        if (prev && prev.type === 'superset') {
          prev.data.groupNote = noteMatch[1];
          continue;
        }
      }
    }

    if (block.type === 'superset') {
      const letter = block.data.label; // e.g. "Superset B"
      // Check if previous merged block is the same superset group
      const prev = merged[merged.length - 1];
      if (prev && prev.type === 'superset' && prev.data.label === letter) {
        prev.data.exercises.push(...block.data.exercises);
        continue;
      }
    }
    merged.push(block);
  }

  return merged;
}

// ── Rendering ──────────────────────────────────────────────────────────

function AnnotationBadge({ text }: { text: string }) {
  const colorMap: Record<string, 'warning' | 'info' | 'success' | 'error'> = {
    PROGRESS: 'success',
    DELOAD: 'info',
    NEW: 'warning',
    DROP: 'error',
  };
  return (
    <Chip
      label={text}
      size="small"
      color={colorMap[text] ?? 'default'}
      variant="outlined"
      sx={{ fontSize: '0.65rem', height: 20, fontWeight: 700 }}
    />
  );
}

function ExerciseRow({ ex }: { ex: ParsedExercise }) {
  // Combine sets/reps/weight into one inline string: "3×10 @ 26kg"
  const setsRepsWeight = [
    ex.sets != null && ex.reps != null
      ? `${ex.sets}×${ex.reps}`
      : ex.reps != null
        ? (ex.weight ? `×${ex.reps}` : String(ex.reps))
        : null,
    ex.weight ? `@ ${ex.weight}` : null,
  ].filter(Boolean).join(' ');

  return (
    <Box
      sx={{
        borderLeft: '3px solid',
        borderColor: 'divider',
        pl: 1.5,
        py: 0.5,
        my: 0.25,
        display: 'flex',
        alignItems: 'baseline',
        gap: 1,
        flexWrap: 'wrap',
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {ex.name}
      </Typography>
      {setsRepsWeight && (
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          {setsRepsWeight}
        </Typography>
      )}
      {ex.annotations.map((a, i) => (
        <AnnotationBadge key={`${a}-${i}`} text={a} />
      ))}
    </Box>
  );
}

function CardioRow({ data }: { data: ParsedCardio }) {
  const restOfDescription = data.duration
    ? data.description.replace(data.duration, '').trim()
    : data.description;

  return (
    <Box
      sx={{
        borderLeft: '3px solid',
        borderColor: 'info.light',
        pl: 1.5,
        py: 0.5,
        my: 0.25,
        display: 'flex',
        alignItems: 'baseline',
        gap: 0.5,
        flexWrap: 'wrap',
      }}
    >
      {data.duration && (
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {data.duration}
        </Typography>
      )}
      <Typography variant="body2">
        {restOfDescription}
      </Typography>
    </Box>
  );
}

function SupersetBlock({ data }: { data: SupersetGroup }) {
  const isSolo = data.exercises.length === 1;

  // Solo exercises: render without outer border wrapper (ExerciseRow has its own border)
  if (isSolo) {
    return (
      <Box sx={{ my: 0.5 }}>
        <ExerciseRow ex={data.exercises[0]} />
        {data.groupNote && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem', mt: 0.25, pl: 1.5, display: 'block' }}>
            {data.groupNote}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        borderLeft: '3px solid',
        borderColor: 'primary.main',
        pl: 1.5,
        my: 0.5,
      }}
    >
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, color: 'primary.main', textTransform: 'uppercase', fontSize: '0.65rem' }}
      >
        {data.label}
      </Typography>
      {data.exercises.map((ex) => (
        <ExerciseRow key={ex.raw} ex={ex} />
      ))}
      {data.groupNote && (
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem', mt: 0.25, display: 'block' }}>
          {data.groupNote}
        </Typography>
      )}
    </Box>
  );
}

function SectionHeader({ text }: { text: string }) {
  return (
    <Box
      sx={{
        mt: 1.5,
        mb: 0.5,
        pt: 0.75,
        borderTop: '1px solid',
        borderTopColor: 'divider',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: 'text.secondary',
          display: 'block',
          fontSize: '0.7rem',
        }}
      >
        {text}
      </Typography>
    </Box>
  );
}

interface WorkoutDisplayProps {
  content: string;
  dimmed?: boolean;
}

export default function WorkoutDisplay({ content, dimmed }: WorkoutDisplayProps) {
  const blocks = parseWorkoutPlan(content);

  if (blocks.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {content}
      </Typography>
    );
  }

  // Group blocks into sections: exercises following a superset section header
  // get visually grouped inside the superset container
  const rendered: React.ReactNode[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (block.type === 'section') {
      const headerText = block.data as string;
      const isSuperset = /superset|circuit/i.test(headerText);

      // Collect all non-section blocks that follow this section header
      const sectionChildren: React.ReactNode[] = [];
      let j = i + 1;
      while (j < blocks.length && blocks[j].type !== 'section') {
        const child = blocks[j];
        switch (child.type) {
          case 'exercise':
            sectionChildren.push(<ExerciseRow key={j} ex={child.data as ParsedExercise} />);
            break;
          case 'cardio':
            sectionChildren.push(<CardioRow key={j} data={child.data as ParsedCardio} />);
            break;
          case 'superset':
            sectionChildren.push(<SupersetBlock key={j} data={child.data as SupersetGroup} />);
            break;
          case 'conditional':
            sectionChildren.push(
              <Box key={j} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.3 }}>
                <Chip label="CONDITION" size="small" color="info" sx={{ fontSize: '0.6rem', height: 18, fontWeight: 700 }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{(child.data as ParsedConditional).condition}</Typography>
              </Box>
            );
            break;
          case 'text':
            sectionChildren.push(
              <Typography key={j} variant="body2" sx={{ py: 0.3 }}>{child.data as string}</Typography>
            );
            break;
        }
        j++;
      }

      if (isSuperset && sectionChildren.length > 0) {
        // Wrap header + children in a single superset container with one left border
        rendered.push(
          <Box
            key={i}
            sx={{
              borderLeft: '3px solid',
              borderColor: 'primary.main',
              pl: 1.5,
              mt: 1.5,
              mb: 0.5,
              pt: 0.75,
              borderTop: '1px solid',
              borderTopColor: 'divider',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: 'primary.main',
                display: 'block',
                fontSize: '0.7rem',
                mb: 0.5,
              }}
            >
              {headerText}
            </Typography>
            {sectionChildren}
          </Box>
        );
      } else {
        rendered.push(
          <Box key={i}>
            <SectionHeader text={headerText} />
            {sectionChildren}
          </Box>
        );
      }
      i = j;
      continue;
    }

    // Non-section blocks at top level
    switch (block.type) {
      case 'conditional':
        rendered.push(
          <Box key={i} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.3 }}>
            <Chip label="CONDITION" size="small" color="info" sx={{ fontSize: '0.6rem', height: 18, fontWeight: 700 }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{(block.data as ParsedConditional).condition}</Typography>
          </Box>
        );
        break;
      case 'exercise':
        rendered.push(<ExerciseRow key={i} ex={block.data as ParsedExercise} />);
        break;
      case 'cardio':
        rendered.push(<CardioRow key={i} data={block.data as ParsedCardio} />);
        break;
      case 'superset':
        rendered.push(<SupersetBlock key={i} data={block.data as SupersetGroup} />);
        break;
      case 'text':
        rendered.push(
          <Typography key={i} variant="body2" sx={{ py: 0.3 }}>{block.data as string}</Typography>
        );
        break;
    }
    i++;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, ...(dimmed && { opacity: 0.7 }) }}>
      {rendered}
    </Box>
  );
}
