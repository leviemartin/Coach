'use client';

import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import type { SessionSetState } from '@/lib/types';

interface StrengthExerciseProps {
  exerciseName: string;
  sets: SessionSetState[];
  onUpdateSet: (setId: number, actualWeightKg: number | null, actualReps: number | null, completed: boolean) => void;
}

export default function StrengthExercise({ exerciseName, sets, onUpdateSet }: StrengthExerciseProps) {
  return (
    <Card variant="outlined" sx={{ borderRadius: '12px' }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} mb={2}>
          {exerciseName}
        </Typography>
        <Stack spacing={1}>
          {sets.map((set) => (
            <Box
              key={set.setId}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                borderRadius: '8px',
                backgroundColor: set.completed ? 'action.selected' : 'action.hover',
                opacity: set.completed ? 0.7 : 1,
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 48 }}>
                Set {set.setNumber}
              </Typography>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {set.targetWeightKg != null ? `${set.targetWeightKg}kg` : '—'}
                {' × '}
                {set.targetReps != null ? set.targetReps : '—'}
              </Typography>
              <Button
                size="small"
                variant={set.completed ? 'contained' : 'outlined'}
                onClick={() =>
                  onUpdateSet(
                    set.setId,
                    set.actualWeightKg ?? set.targetWeightKg,
                    set.actualReps ?? set.targetReps,
                    !set.completed,
                  )
                }
                sx={{
                  minWidth: 72,
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  ...(set.completed && {
                    backgroundColor: '#22c55e',
                    '&:hover': { backgroundColor: '#16a34a' },
                  }),
                }}
              >
                {set.completed ? 'Done' : 'Log'}
              </Button>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
