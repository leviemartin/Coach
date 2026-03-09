'use client';

import React from 'react';
import { Box, Typography, Chip, Alert } from '@mui/material';
import TimerIcon from '@mui/icons-material/Timer';

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
}

type ParsedBlock =
  | { type: 'conditional'; data: ParsedConditional }
  | { type: 'exercise'; data: ParsedExercise }
  | { type: 'cardio'; data: ParsedCardio }
  | { type: 'superset'; data: SupersetGroup }
  | { type: 'text'; data: string };

// ── Parsing ────────────────────────────────────────────────────────────

const EXERCISE_RE = /^(.+?)\s+(\d+)x(\d+(?:-\d+)?)\s*@\s*(\d+(?:\.\d+)?kg)(.*)$/;
const EXERCISE_NO_WEIGHT_RE = /^(.+?)\s+(\d+)x(\d+(?:-\d+)?)\s*(.*)$/;
const DURATION_RE = /^(\d+\s*(?:min|sec|s|m|hr|hours?))\b/i;
const ANNOTATION_RE = /\(([A-Z]+)\)/g;
const SUPERSET_LABEL_RE = /^([A-C]\d)\s*[:.–-]\s*/;

function extractAnnotations(text: string): { clean: string; annotations: string[] } {
  const annotations: string[] = [];
  const clean = text.replace(ANNOTATION_RE, (_, a) => {
    annotations.push(a);
    return '';
  }).trim();
  return { clean, annotations };
}

function parseExerciseToken(token: string): ParsedBlock | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  // Try sets x reps @ weight
  const matchFull = trimmed.match(EXERCISE_RE);
  if (matchFull) {
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

  // Try sets x reps without weight
  const matchNoWeight = trimmed.match(EXERCISE_NO_WEIGHT_RE);
  if (matchNoWeight) {
    const { annotations } = extractAnnotations(matchNoWeight[4]);
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

  // Try cardio / duration-based
  const durationMatch = trimmed.match(DURATION_RE);
  if (durationMatch) {
    return {
      type: 'cardio',
      data: {
        description: trimmed,
        duration: durationMatch[1],
        raw: trimmed,
      },
    };
  }

  // Plain text fallback
  return { type: 'text', data: trimmed };
}

export function parseWorkoutPlan(text: string): ParsedBlock[] {
  if (!text || !text.trim()) return [];

  const blocks: ParsedBlock[] = [];
  // Split on line breaks first, then on comma/plus within lines
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Check for conditional
    if (/^IF\s+/i.test(line)) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const condition = line.slice(0, colonIdx).trim();
        const body = line.slice(colonIdx + 1).trim();
        blocks.push({ type: 'conditional', data: { condition, body } });

        // Parse the body part for exercises
        const bodyTokens = body.split(/,\s*|\s\+\s/).map((t) => t.trim()).filter(Boolean);
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

    // Split on comma or " + " for multiple exercises on one line
    const tokens = line.split(/,\s*|\s\+\s/).map((t) => t.trim()).filter(Boolean);

    // Check for superset patterns (A1/A2, B1/B2)
    const supersetMap = new Map<string, ParsedExercise[]>();
    const nonSuperset: string[] = [];

    for (const token of tokens) {
      const ssMatch = token.match(SUPERSET_LABEL_RE);
      if (ssMatch) {
        const groupLetter = ssMatch[1][0]; // "A", "B", "C"
        const exerciseText = token.replace(SUPERSET_LABEL_RE, '').trim();
        const parsed = parseExerciseToken(exerciseText);
        if (parsed && parsed.type === 'exercise') {
          if (!supersetMap.has(groupLetter)) supersetMap.set(groupLetter, []);
          supersetMap.get(groupLetter)!.push(parsed.data as ParsedExercise);
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

  return blocks;
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
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.3 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }}>
        {ex.name}
      </Typography>
      {ex.sets != null && ex.reps != null && (
        <Chip
          label={`${ex.sets}×${ex.reps}`}
          size="small"
          variant="outlined"
          sx={{ fontSize: '0.7rem', height: 22, fontWeight: 600 }}
        />
      )}
      {ex.weight && (
        <Chip
          label={ex.weight}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ fontSize: '0.7rem', height: 22, fontWeight: 600 }}
        />
      )}
      {ex.annotations.map((a) => (
        <AnnotationBadge key={a} text={a} />
      ))}
    </Box>
  );
}

function CardioRow({ data }: { data: ParsedCardio }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.3 }}>
      {data.duration && (
        <Chip
          icon={<TimerIcon sx={{ fontSize: 14 }} />}
          label={data.duration}
          size="small"
          color="info"
          variant="outlined"
          sx={{ fontSize: '0.7rem', height: 22, fontWeight: 600 }}
        />
      )}
      <Typography variant="body2">
        {data.duration ? data.description.replace(data.duration, '').trim() : data.description}
      </Typography>
    </Box>
  );
}

function SupersetBlock({ data }: { data: SupersetGroup }) {
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
      {data.exercises.map((ex, i) => (
        <ExerciseRow key={i} ex={ex} />
      ))}
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, ...(dimmed && { opacity: 0.7 }) }}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'conditional':
            return (
              <Alert
                key={i}
                severity="info"
                variant="outlined"
                sx={{ py: 0, px: 1.5, my: 0.5, '& .MuiAlert-message': { py: 0.5 } }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {block.data.condition}
                </Typography>
              </Alert>
            );
          case 'exercise':
            return <ExerciseRow key={i} ex={block.data} />;
          case 'cardio':
            return <CardioRow key={i} data={block.data} />;
          case 'superset':
            return <SupersetBlock key={i} data={block.data} />;
          case 'text':
            return (
              <Typography key={i} variant="body2" sx={{ py: 0.3 }}>
                {block.data}
              </Typography>
            );
          default:
            return null;
        }
      })}
    </Box>
  );
}
