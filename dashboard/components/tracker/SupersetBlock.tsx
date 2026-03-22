'use client';

import { Box, Card, CardContent, Chip, Divider, Typography } from '@mui/material';
import type { SessionSetState } from '@/lib/types';
import StrengthExercise from './StrengthExercise';

interface SupersetExercise {
  name: string;
  sets: SessionSetState[];
}

interface SupersetBlockProps {
  groupName: string;
  exercises: SupersetExercise[];
  restSeconds: number | null;
  onUpdateSet: (setId: number, actualWeightKg: number | null, actualReps: number | null, completed: boolean) => void;
}

export default function SupersetBlock({ groupName, exercises, restSeconds, onUpdateSet }: SupersetBlockProps) {
  return (
    <Card variant="outlined" sx={{ borderRadius: '12px', borderColor: '#3b82f6' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Superset {groupName}
          </Typography>
          {restSeconds != null && (
            <Chip
              label={`${restSeconds}s rest`}
              size="small"
              sx={{ fontSize: '0.7rem', height: 20, backgroundColor: 'action.selected' }}
            />
          )}
        </Box>
        {exercises.map((ex, idx) => (
          <Box key={ex.name}>
            {idx > 0 && <Divider sx={{ my: 1.5 }} />}
            <StrengthExercise
              exerciseName={ex.name}
              sets={ex.sets}
              onUpdateSet={onUpdateSet}
            />
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}
