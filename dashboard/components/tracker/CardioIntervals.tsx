'use client';

import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import type { SessionCardioState } from '@/lib/types';

interface CardioIntervalsProps {
  exerciseName: string;
  cardio: SessionCardioState;
  coachCue: string | null;
  onUpdateCardio: (cardioId: number, completedRounds: number, completed: boolean) => void;
}

export default function CardioIntervals({ exerciseName, cardio, coachCue, onUpdateCardio }: CardioIntervalsProps) {
  const totalRounds = cardio.prescribedRounds ?? 0;
  const completed = cardio.completedRounds;

  const handleRoundToggle = (roundIndex: number) => {
    const isCurrentlyDone = roundIndex < completed;
    const newCompleted = isCurrentlyDone ? roundIndex : roundIndex + 1;
    const allDone = newCompleted >= totalRounds;
    onUpdateCardio(cardio.id!, newCompleted, allDone);
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
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {Array.from({ length: totalRounds }, (_, i) => (
            <Button
              key={i}
              variant={i < completed ? 'contained' : 'outlined'}
              size="small"
              onClick={() => handleRoundToggle(i)}
              sx={{
                minWidth: 44,
                height: 44,
                borderRadius: '8px',
                fontWeight: 700,
                ...(i < completed && {
                  backgroundColor: '#22c55e',
                  borderColor: '#22c55e',
                  '&:hover': { backgroundColor: '#16a34a' },
                }),
              }}
            >
              {i + 1}
            </Button>
          ))}
        </Stack>
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            {completed}/{totalRounds} rounds complete
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
