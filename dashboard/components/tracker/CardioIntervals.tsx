'use client';

import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { semanticColors } from '@/lib/design-tokens';
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
        borderRadius: 0,
        borderLeft: '4px solid #18181b',
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {/* Exercise name */}
        <Typography sx={{
          fontFamily: '"Libre Franklin", sans-serif',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: semanticColors.cardioIntervals,
        }}>
          {exerciseName}
        </Typography>

        {/* Protocol specs */}
        <Box sx={{ mt: 1, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {totalRounds > 0 && (
            <Box>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1, fontFamily: '"JetBrains Mono", monospace' }}>{totalRounds}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>rounds</Typography>
            </Box>
          )}
          {(cardio.intervalWorkSeconds != null || cardio.intervalRestSeconds != null) && (
            <Box sx={{
              px: 1.5, py: 0.5, borderRadius: 0,
              bgcolor: `${semanticColors.cardioIntervals}14`,
              alignSelf: 'center',
            }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: semanticColors.cardioIntervals, fontFamily: '"JetBrains Mono", monospace' }}>
                {cardio.intervalWorkSeconds != null ? `${cardio.intervalWorkSeconds}s work` : ''}
                {cardio.intervalWorkSeconds != null && cardio.intervalRestSeconds != null ? ' / ' : ''}
                {cardio.intervalRestSeconds != null ? `${cardio.intervalRestSeconds}s rest` : ''}
              </Typography>
            </Box>
          )}
          {cardio.targetIntensity && (
            <Box sx={{
              px: 1.5, py: 0.5, borderRadius: 0,
              bgcolor: `${semanticColors.cardioIntervals}14`,
              alignSelf: 'center',
            }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: semanticColors.cardioIntervals, fontFamily: '"JetBrains Mono", monospace' }}>
                {cardio.targetIntensity}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Coach cue */}
        {coachCue && (
          <Box sx={{
            mb: 2, p: 1.5, borderRadius: 0,
            borderLeft: '2px solid #b4530940',
          }}>
            {coachCue.split('\n').map((line, i) => (
              <Typography key={i} variant="body2" color="text.secondary" sx={{ mb: 0.25, color: '#b45309', fontStyle: 'italic' }}>
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
                borderRadius: 0,
                fontWeight: 700,
                fontSize: '0.875rem',
                fontFamily: '"JetBrains Mono", monospace',
                ...(i < completed
                  ? {
                      backgroundColor: '#22c55e',
                      borderColor: '#22c55e',
                      color: '#fafaf7',
                      '&:hover': { backgroundColor: '#16a34a' },
                    }
                  : {
                      backgroundColor: 'transparent',
                      borderColor: '#18181b',
                      color: '#18181b',
                      '&:hover': { bgcolor: '#18181b14' },
                    }),
              }}
            >
              {i + 1}
            </Button>
          ))}
        </Stack>

        <Typography variant="caption" color="text.secondary" display="block" mt={1.5} sx={{ fontFamily: '"JetBrains Mono", monospace' }}>
          {completed}/{totalRounds} rounds complete
        </Typography>
      </CardContent>
    </Card>
  );
}
