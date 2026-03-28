'use client';

import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import { semanticColors } from '@/lib/design-tokens';
import type { SessionSetState } from '@/lib/types';
import StrengthExercise from './StrengthExercise';

interface SupersetExercise {
  name: string;
  sets: SessionSetState[];
  durationSeconds?: number | null;
  rpe?: number | null;
}

interface SupersetBlockProps {
  groupName: string;
  exercises: SupersetExercise[];
  restSeconds: number | null;
  onUpdateSet: (setId: number, actualWeightKg: number | null, actualReps: number | null, completed: boolean, actualDurationS?: number | null) => void;
  onRpeSelect?: (exerciseName: string, rpe: number) => void;
}

export default function SupersetBlock({ groupName, exercises, restSeconds, onUpdateSet, onRpeSelect }: SupersetBlockProps) {
  // Derive round count from first exercise's set count
  const rounds = exercises[0]?.sets.length ?? 0;

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: '12px',
        borderLeft: `4px solid ${semanticColors.protocols}`,
      }}
    >
      <CardContent>
        {/* Header: SUPERSET badge + round/rest info */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            label="SUPERSET"
            size="small"
            sx={{
              backgroundColor: `${semanticColors.protocols}18`,
              color: semanticColors.protocols,
              fontWeight: 700,
              fontSize: '0.6875rem',
              letterSpacing: '0.5px',
              height: 22,
            }}
          />
          {(rounds > 0 || restSeconds != null) && (
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              {rounds > 0 && `${rounds} rounds`}
              {rounds > 0 && restSeconds != null && ' · '}
              {restSeconds != null && `${restSeconds}s rest between rounds`}
            </Typography>
          )}
        </Box>

        {/* Exercises with "then immediately" divider */}
        {exercises.map((ex, idx) => (
          <Box key={ex.name}>
            {idx > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1.5 }}>
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.625rem' }}>
                  then immediately
                </Typography>
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
              </Box>
            )}
            <StrengthExercise
              exerciseName={ex.name}
              sets={ex.sets}
              durationSeconds={ex.durationSeconds}
              onUpdateSet={onUpdateSet}
              rpe={ex.rpe}
              onRpeSelect={onRpeSelect}
            />
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}
