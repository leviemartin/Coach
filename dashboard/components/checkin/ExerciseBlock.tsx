'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExerciseRow {
  label: string;      // e.g. "A1", "B2" — empty for warm-up/cool-down items
  name: string;
  detail: string;     // e.g. "3 x 12 @ 20kg", "5 min · Zone 2"
  hasWeight: boolean; // whether detail contains a weight to bold
  weightPart: string; // the bolded portion (e.g. "20kg")
  textBefore: string; // text before weight
  textAfter: string;  // text after weight
}

export interface ExerciseGroup {
  type: 'superset' | 'warmup' | 'cooldown' | 'cardio' | 'standalone';
  letter: string;     // "A", "B", "C", etc. — empty for warmup/cooldown/cardio
  label: string;      // display label, e.g. "Superset A", "Warm-up", "Cardio"
  roundInfo: string;  // e.g. "3 rounds, 90s rest" — empty if none
  exercises: ExerciseRow[];
  cardioText?: string; // raw text for cardio blocks
}

// ─── Superset color map ───────────────────────────────────────────────────────

const SUPERSET_COLORS: Record<string, { bg: string; text: string }> = {
  A: { bg: '#dbeafe', text: '#1d4ed8' },
  B: { bg: '#ede9fe', text: '#6d28d9' },
  C: { bg: '#ffedd5', text: '#c2410c' },
  D: { bg: '#fef3c7', text: '#b45309' },
};

function getSupersetColor(letter: string) {
  return SUPERSET_COLORS[letter.toUpperCase()] ?? { bg: '#f1f5f9', text: '#475569' };
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse weight from detail string. Returns parts for bold rendering.
 * e.g. "3 x 12 @ 20kg" → { hasWeight: true, textBefore: "3 x 12 @ ", weightPart: "20kg", textAfter: "" }
 */
function parseWeight(detail: string): Pick<ExerciseRow, 'hasWeight' | 'textBefore' | 'weightPart' | 'textAfter'> {
  const match = detail.match(/^(.*?@\s*)(\d+(?:\.\d+)?(?:kg|lbs?|lb))(.*)$/i);
  if (match) {
    return {
      hasWeight: true,
      textBefore: match[1],
      weightPart: match[2],
      textAfter: match[3],
    };
  }
  // Weight-first format: "28kg x10" or "28kg x10 x3"
  const weightFirstMatch = detail.match(/^(\d+(?:\.\d+)?(?:kg|lbs?|lb))\s*(.*)$/i);
  if (weightFirstMatch) {
    return {
      hasWeight: true,
      textBefore: '',
      weightPart: weightFirstMatch[1],
      textAfter: weightFirstMatch[2] ? ` ${weightFirstMatch[2]}` : '',
    };
  }
  return { hasWeight: false, textBefore: detail, weightPart: '', textAfter: '' };
}

/**
 * Parse a single exercise line like "A1: Goblet Squat: 28kg x10"
 * or "- 5min bike Zone 2"
 * Returns { label, name, detail }
 */
function parseExerciseLine(line: string): { label: string; name: string; detail: string } {
  const trimmed = line.replace(/^[-•]\s*/, '').trim();

  // Match superset label: "A1: Exercise Name: weight x reps" or "A1: Exercise Name x reps"
  const supersetMatch = trimmed.match(/^([A-Z]\d+):\s*(.+)$/i);
  if (supersetMatch) {
    const label = supersetMatch[1].toUpperCase();
    const rest = supersetMatch[2].trim();

    // Try to split name from detail — look for weight pattern or "xN" reps
    // Patterns: "Goblet Squat: 28kg x10" / "Goblet Squat 28kg x10" / "Goblet Squat x12" / "Squat: 3 x 5 @ 100kg"
    // Order matters: weight-containing patterns must fire before bare "x\d+" to avoid eating "3" into the name.
    const weightDetailMatch = rest.match(/^(.+?)[:\s]+(\d+(?:\.\d+)?(?:kg|lbs?|lb)\s+x\s*\d+.*)$/i)
      || rest.match(/^(.+?)\s+(\d+(?:\.\d+)?(?:kg|lbs?|lb)\s+x\s*\d+.*)$/i)
      || rest.match(/^(.+?)[:\s]+(\d+(?:\s*x\s*\d+).*)$/i)
      || rest.match(/^(.+?)\s+(x\s*\d+.*)$/i);

    if (weightDetailMatch) {
      return { label, name: weightDetailMatch[1].trim(), detail: weightDetailMatch[2].trim() };
    }

    // Fall back — whole rest is the name
    return { label, name: rest, detail: '' };
  }

  // No label — plain line (warm-up/cool-down items)
  // Try to extract detail: "5min bike Zone 2" → name: "Bike", detail: "5 min · Zone 2"
  // "Chest doorway stretch 3x30s" → name: ..., detail: "3 x 30s"
  const durationMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*min\s+(.+)$/i);
  if (durationMatch) {
    return { label: '', name: durationMatch[2].trim(), detail: `${durationMatch[1]} min` };
  }

  const repDetailMatch = trimmed.match(/^(.+?)\s+(\d+\s*x\s*\d+.*)$/i);
  if (repDetailMatch) {
    return { label: '', name: repDetailMatch[1].trim(), detail: repDetailMatch[2].trim() };
  }

  return { label: '', name: trimmed, detail: '' };
}

/**
 * Parse workout plan text into structured ExerciseGroup[]
 */
export function parseWorkoutPlan(text: string): ExerciseGroup[] {
  if (!text.trim()) return [];

  const groups: ExerciseGroup[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let currentLetter = '';
  let currentGroup: ExerciseGroup | null = null;
  let currentSection: 'warmup' | 'cooldown' | 'cardio' | 'exercises' | null = null;

  const flushGroup = () => {
    if (currentGroup && (currentGroup.exercises.length > 0 || currentGroup.cardioText)) {
      groups.push(currentGroup);
      currentGroup = null;
    }
  };

  for (const line of lines) {
    // ── Section headers ────────────────────────────────────────────────────────
    if (/^warm[\s-]?up\s*:/i.test(line)) {
      flushGroup();
      currentSection = 'warmup';
      currentLetter = '';
      currentGroup = { type: 'warmup', letter: '', label: 'Warm-up', roundInfo: '', exercises: [] };
      continue;
    }
    if (/^cool[\s-]?down\s*:/i.test(line)) {
      flushGroup();
      currentSection = 'cooldown';
      currentLetter = '';
      currentGroup = { type: 'cooldown', letter: '', label: 'Cool-down', roundInfo: '', exercises: [] };
      continue;
    }
    if (/^(?:cardio|finisher|conditioning)\s*:/i.test(line)) {
      flushGroup();
      currentSection = 'cardio';
      currentLetter = '';
      currentGroup = { type: 'cardio', letter: '', label: 'Cardio', roundInfo: '', exercises: [], cardioText: '' };
      continue;
    }

    // ── Round/rest info: lines like "[3 rounds, 90s rest]" ────────────────────
    const roundMatch = line.match(/^\[(.+?)\]$/);
    if (roundMatch && currentGroup) {
      currentGroup.roundInfo = roundMatch[1].trim();
      continue;
    }

    // ── Superset exercise lines: "A1: ..." ────────────────────────────────────
    const supersetLineMatch = line.match(/^([A-Z])(\d+):\s*/i);
    if (supersetLineMatch) {
      const letter = supersetLineMatch[1].toUpperCase();
      currentSection = 'exercises';

      // New superset group (different letter)
      if (letter !== currentLetter) {
        flushGroup();
        currentLetter = letter;
        const isSingle = false; // We'll determine this at flush time — assume superset for now
        currentGroup = {
          type: 'superset',
          letter,
          label: `Superset ${letter}`,
          roundInfo: '',
          exercises: [],
        };
      }

      const { label, name, detail } = parseExerciseLine(line);
      const weightInfo = parseWeight(detail);

      currentGroup!.exercises.push({ label, name, detail, ...weightInfo });
      continue;
    }

    // ── Plain lines (warm-up/-down items, cardio structure) ───────────────────
    if (currentSection === 'cardio' && currentGroup) {
      currentGroup.cardioText = (currentGroup.cardioText || '') + (currentGroup.cardioText ? '\n' : '') + line;
      continue;
    }

    if ((currentSection === 'warmup' || currentSection === 'cooldown') && currentGroup) {
      const { label, name, detail } = parseExerciseLine(line);
      const weightInfo = parseWeight(detail);
      currentGroup.exercises.push({ label, name, detail, ...weightInfo });
      continue;
    }

    // ── Unmatched lines after exercises might be standalone items ─────────────
    if (currentSection === 'exercises' && currentGroup) {
      if (line.startsWith('-')) {
        const { label, name, detail } = parseExerciseLine(line);
        const weightInfo = parseWeight(detail);
        currentGroup.exercises.push({ label, name, detail, ...weightInfo });
      } else {
        // Fallback: treat as plain text exercise entry
        currentGroup.exercises.push({ label: '', name: line, detail: '', hasWeight: false, textBefore: line, weightPart: '', textAfter: '' });
      }
    }
  }

  flushGroup();

  // Post-process: single-exercise "supersets" become standalone type
  for (const group of groups) {
    if (group.type === 'superset' && group.exercises.length === 1) {
      group.type = 'standalone';
      group.label = 'Exercise';
    }
  }

  return groups;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ExerciseBlockProps {
  group: ExerciseGroup;
}

export default function ExerciseBlock({ group }: ExerciseBlockProps) {
  const isWarmCool = group.type === 'warmup' || group.type === 'cooldown';
  const isCardio = group.type === 'cardio';

  const borderColor = isCardio ? '#14b8a6' : '#e2e8f0';
  const bgColor = isWarmCool ? '#fafbfc' : '#ffffff';

  return (
    <Box>
      {/* Superset header row with label + round info */}
      {(group.type === 'superset' || group.type === 'standalone') && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, mt: 1.5 }}>
          <Typography sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: '#64748b',
          }}>
            {group.label}
          </Typography>
          {group.roundInfo && (
            <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 400 }}>
              — {group.roundInfo}
            </Typography>
          )}
        </Box>
      )}

      {/* Cardio header */}
      {isCardio && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, mt: 1.5 }}>
          <Typography sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: '#64748b',
          }}>
            Cardio
          </Typography>
        </Box>
      )}

      {/* Exercise card */}
      <Box sx={{
        bgcolor: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '8px',
        px: 2,
        py: 1.5,
        mb: 0.5,
      }}>
        {/* Cardio block */}
        {isCardio && (
          <Box>
            {group.exercises.length > 0 && group.exercises.map((ex, idx) => (
              <ExerciseRowItem key={idx} exercise={ex} />
            ))}
            {group.cardioText && (
              <Typography sx={{
                fontSize: '0.75rem',
                color: '#64748b',
                lineHeight: 1.8,
                mt: group.exercises.length > 0 ? 0.5 : 0,
                pt: group.exercises.length > 0 ? 0.5 : 0,
                borderTop: group.exercises.length > 0 ? '1px solid #f1f5f9' : 'none',
                whiteSpace: 'pre-line',
              }}>
                {group.cardioText}
              </Typography>
            )}
          </Box>
        )}

        {/* Normal exercises */}
        {!isCardio && group.exercises.map((ex, idx) => (
          <ExerciseRowItem key={idx} exercise={ex} />
        ))}
      </Box>
    </Box>
  );
}

// ─── Exercise row ─────────────────────────────────────────────────────────────

function ExerciseRowItem({ exercise }: { exercise: ExerciseRow }) {
  const colors = exercise.label ? getSupersetColor(exercise.label[0]) : null;

  return (
    <Box sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      py: 0.5,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Superset label badge */}
        {exercise.label && colors && (
          <Box sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: '4px',
            bgcolor: colors.bg,
            color: colors.text,
            fontSize: '0.6875rem',
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {exercise.label}
          </Box>
        )}
        <Typography sx={{ fontSize: '0.8125rem', color: '#0f172a' }}>
          {exercise.name}
        </Typography>
      </Box>

      {/* Detail with optional bold weight */}
      {exercise.detail && (
        <Typography component="span" sx={{ fontSize: '0.75rem', color: '#64748b', flexShrink: 0, ml: 1 }}>
          {exercise.hasWeight ? (
            <>
              {exercise.textBefore}
              <Box component="strong" sx={{ color: '#0f172a' }}>{exercise.weightPart}</Box>
              {exercise.textAfter}
            </>
          ) : (
            exercise.detail
          )}
        </Typography>
      )}
    </Box>
  );
}
