'use client';

import { Box, Button, Card, CardContent, Typography } from '@mui/material';
import type { SessionCardioState } from '@/lib/types';

interface CardioSteadyProps {
  exerciseName: string;
  cardio: SessionCardioState;
  coachCue: string | null;
  onUpdateCardio: (cardioId: number, completedRounds: number, completed: boolean) => void;
}

export default function CardioSteady({ exerciseName, cardio, coachCue, onUpdateCardio }: CardioSteadyProps) {
  const handleToggle = () => {
    if (cardio.completed) {
      onUpdateCardio(cardio.id!, 0, false);
    } else {
      onUpdateCardio(cardio.id!, 1, true);
    }
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: '12px' }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
          {exerciseName}
        </Typography>
        {coachCue && (
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            {coachCue}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: coachCue ? 0 : 2 }}>
          <Button
            variant={cardio.completed ? 'contained' : 'outlined'}
            onClick={handleToggle}
            sx={{
              minHeight: 48,
              minWidth: 140,
              borderRadius: '10px',
              fontWeight: 700,
              ...(cardio.completed && {
                backgroundColor: '#22c55e',
                '&:hover': { backgroundColor: '#16a34a' },
              }),
            }}
          >
            {cardio.completed ? 'Completed' : 'Mark Done'}
          </Button>
          {cardio.completed && (
            <Typography variant="body2" color="#22c55e" fontWeight={600}>
              Session logged
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
