'use client';
import React from 'react';
import { Box, Typography } from '@mui/material';
import type { PlanExercise } from '@/lib/types';

interface ExerciseRowProps {
  exercise: PlanExercise;
  label: string; // "A1", "B2", "W1", etc.
}

function formatDetail(ex: PlanExercise): string {
  const parts: string[] = [];
  if (ex.sets && ex.reps) parts.push(`${ex.sets}x${ex.reps}`);
  else if (ex.sets && ex.durationSeconds) parts.push(`${ex.sets}x${ex.durationSeconds}s`);
  else if (ex.durationSeconds) {
    const min = ex.durationSeconds >= 60 ? `${Math.round(ex.durationSeconds / 60)} min` : `${ex.durationSeconds}s`;
    parts.push(min);
  }
  if (ex.weightKg != null) parts.push(`@ ${ex.weightKg}kg`);
  if (ex.targetIntensity) parts.push(`· ${ex.targetIntensity}`);
  if (ex.laterality === 'unilateral_each') parts.push('/side');
  if (ex.laterality === 'alternating') parts.push('alt');
  return parts.join(' ');
}

export default function ExerciseRow({ exercise, label }: ExerciseRowProps) {
  const detail = formatDetail(exercise);
  const weightMatch = detail.match(/(@ [\d.]+kg)/);

  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.25, pl: 1 }}>
      {label && (
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', minWidth: 24 }}>
          {label}
        </Typography>
      )}
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: '#0f172a' }}>
        {exercise.exerciseName}
      </Typography>
      <Typography component="span" sx={{ fontSize: '0.8125rem', color: '#475569' }}>
        {weightMatch ? (
          <>
            {detail.split(weightMatch[1])[0]}
            <Box component="span" sx={{ fontWeight: 700, color: '#0f172a' }}>{weightMatch[1]}</Box>
            {detail.split(weightMatch[1])[1]}
          </>
        ) : detail}
      </Typography>
      {exercise.coachCue && (
        <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', ml: 'auto' }}>
          {exercise.coachCue}
        </Typography>
      )}
    </Box>
  );
}
