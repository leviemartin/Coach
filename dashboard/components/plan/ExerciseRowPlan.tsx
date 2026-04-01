'use client';
import { Box, Typography } from '@mui/material';
import type { NormalizedExercise } from '@/lib/types';
import { formatRx, formatWeight } from '@/lib/format';

interface ExerciseRowPlanProps { label: string; exercise: NormalizedExercise; }

export default function ExerciseRowPlan({ label, exercise }: ExerciseRowPlanProps) {
  const rx = formatRx(exercise.sets, exercise.prescribedRepsDisplay, exercise.prescribedDurationS, exercise.laterality);
  const weight = exercise.prescribedWeightKg != null ? formatWeight(exercise.prescribedWeightKg) : null;
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, py: 0.75, px: 2.5 }}>
        <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.6875rem', fontWeight: 700, color: '#a1a1aa', width: 24, flexShrink: 0 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, flex: 1 }}>{exercise.name}</Typography>
        <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', color: '#52525b' }}>{rx}</Typography>
        {weight && (
          <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', fontWeight: 700, color: '#18181b' }}>
            @ {weight}
          </Typography>
        )}
      </Box>
      {exercise.coachCue && (
        <Typography sx={{ fontSize: '0.6875rem', fontStyle: 'italic', color: '#b45309', px: 2.5, pl: 6.5, pb: 0.5 }}>
          {exercise.coachCue}
        </Typography>
      )}
    </Box>
  );
}
