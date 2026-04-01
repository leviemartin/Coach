'use client';

import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { semanticColors, typography } from '@/lib/design-tokens';
import type { SessionCardioState } from '@/lib/types';

interface CardioIntervalsProps {
  exerciseName: string;
  cardio: SessionCardioState;
  coachCue: string | null;
  onUpdateCardio: (cardioId: number, completedRounds: number, completed: boolean, actualDurationMin?: number | null) => void;
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
    <Card
      variant="outlined"
      sx={{
        borderRadius: '12px',
        borderLeft: `4px solid ${semanticColors.cardioIntervals}`,
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {/* Exercise name */}
        <Typography sx={{ ...typography.categoryLabel, color: semanticColors.cardioIntervals }}>
          {exerciseName}
        </Typography>

        {/* Protocol specs */}
        <Box sx={{ mt: 1, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {totalRounds > 0 && (
            <Box>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1 }}>{totalRounds}</Typography>
              <Typography variant="caption" color="text.secondary">rounds</Typography>
            </Box>
          )}
          {(cardio.intervalWorkSeconds != null || cardio.intervalRestSeconds != null) && (
            <Box sx={{
              px: 1.5, py: 0.5, borderRadius: '8px',
              bgcolor: `${semanticColors.cardioIntervals}14`,
              alignSelf: 'center',
            }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: semanticColors.cardioIntervals }}>
                {cardio.intervalWorkSeconds != null ? `${cardio.intervalWorkSeconds}s work` : ''}
                {cardio.intervalWorkSeconds != null && cardio.intervalRestSeconds != null ? ' / ' : ''}
                {cardio.intervalRestSeconds != null ? `${cardio.intervalRestSeconds}s rest` : ''}
              </Typography>
            </Box>
          )}
          {cardio.targetIntensity && (
            <Box sx={{
              px: 1.5, py: 0.5, borderRadius: '8px',
              bgcolor: `${semanticColors.cardioIntervals}14`,
              alignSelf: 'center',
            }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: semanticColors.cardioIntervals }}>
                {cardio.targetIntensity}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Coach cue with interval details */}
        {coachCue && (
          <Box sx={{
            mb: 2, p: 1.5, borderRadius: '8px',
            bgcolor: 'action.hover',
            borderLeft: `3px solid ${semanticColors.cardioIntervals}`,
          }}>
            {coachCue.split('\n').map((line, i) => (
              <Typography key={i} variant="body2" color="text.secondary" sx={{ mb: 0.25 }}>
                {line}
              </Typography>
            ))}
          </Box>
        )}

        {/* Round grid */}
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {Array.from({ length: totalRounds }, (_, i) => (
            <Button
              key={i}
              variant={i < completed ? 'contained' : 'outlined'}
              size="small"
              onClick={() => handleRoundToggle(i)}
              sx={{
                minWidth: 48,
                height: 48,
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.875rem',
                ...(i < completed
                  ? {
                      backgroundColor: semanticColors.recovery.good,
                      borderColor: semanticColors.recovery.good,
                      '&:hover': { backgroundColor: '#16a34a' },
                    }
                  : {
                      borderColor: semanticColors.cardioIntervals,
                      color: semanticColors.cardioIntervals,
                      '&:hover': { bgcolor: `${semanticColors.cardioIntervals}14` },
                    }),
              }}
            >
              {i + 1}
            </Button>
          ))}
        </Stack>

        <Typography variant="caption" color="text.secondary" display="block" mt={1.5}>
          {completed}/{totalRounds} rounds complete
        </Typography>
      </CardContent>
    </Card>
  );
}
