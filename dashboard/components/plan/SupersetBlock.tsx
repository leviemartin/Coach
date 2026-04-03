'use client';
import React from 'react';
import { Box, Typography } from '@mui/material';
import type { PlanExercise } from '@/lib/types';
import ExerciseRow from './ExerciseRow';

const SUPERSET_COLORS: Record<string, { bg: string; border: string }> = {
  A: { bg: '#eff6ff', border: '#bfdbfe' },
  B: { bg: '#f5f3ff', border: '#ddd6fe' },
  C: { bg: '#fff7ed', border: '#fed7aa' },
  D: { bg: '#fefce8', border: '#fde68a' },
};

interface SupersetBlockProps {
  groupLetter: string;
  exercises: PlanExercise[];
}

export default function SupersetBlock({ groupLetter, exercises }: SupersetBlockProps) {
  const colors = SUPERSET_COLORS[groupLetter] ?? { bg: '#f8fafc', border: '#e2e8f0' };
  const firstEx = exercises[0];
  const restInfo = firstEx?.restSeconds ? `${firstEx.restSeconds}s rest` : '';
  const setsInfo = firstEx?.sets ? `${firstEx.sets} rounds` : '';
  const roundLabel = [setsInfo, restInfo].filter(Boolean).join(' · ');

  return (
    <Box sx={{
      border: `1px solid ${colors.border}`,
      borderRadius: 0,
      bgcolor: colors.bg,
      px: 1.5,
      py: 1,
      my: 0.5,
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b' }}>
          Superset {groupLetter}
        </Typography>
        {roundLabel && (
          <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
            {roundLabel}
          </Typography>
        )}
      </Box>
      {exercises.map((ex, i) => (
        <ExerciseRow
          key={ex.id ?? i}
          exercise={ex}
          label={`${groupLetter}${i + 1}`}
        />
      ))}
    </Box>
  );
}
