'use client';

import { useState } from 'react';
import { Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { semanticColors } from '@/lib/design-tokens';
import type { SessionCardioState } from '@/lib/types';

interface CardioSteadyProps {
  exerciseName: string;
  cardio: SessionCardioState;
  coachCue: string | null;
  workoutDescription?: string | null;
  onUpdateCardio: (cardioId: number, completedRounds: number, completed: boolean, actualDurationMin?: number | null) => void;
}

export default function CardioSteady({
  exerciseName,
  cardio,
  coachCue,
  workoutDescription,
  onUpdateCardio,
}: CardioSteadyProps) {
  const [editDuration, setEditDuration] = useState(
    cardio.actualDurationMin?.toString() ?? cardio.prescribedDurationMin?.toString() ?? ''
  );

  const handleToggle = () => {
    const dur = editDuration ? parseFloat(editDuration) : null;
    if (cardio.completed) {
      onUpdateCardio(cardio.id!, 0, false, dur);
    } else {
      onUpdateCardio(cardio.id!, 1, true, dur);
    }
  };

  const durationMin = cardio.prescribedDurationMin;
  const intensity = cardio.targetIntensity;

  // Format minutes for display: ≥60 shows as h/m breakdown, <60 shows as plain number
  const displayDurationMin = (minutes: number): string => {
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${minutes}`;
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
          color: semanticColors.cardioSteady,
        }}>
          {exerciseName}
        </Typography>

        {/* Duration target — large number per spec */}
        {durationMin != null && (
          <Box sx={{ mt: 1, mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              {cardio.completed ? (
                <Typography sx={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1, fontFamily: '"JetBrains Mono", monospace' }}>
                  {editDuration || displayDurationMin(durationMin)}
                </Typography>
              ) : (
                <TextField
                  size="small"
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  placeholder={durationMin.toString()}
                  inputProps={{ inputMode: 'decimal', style: { textAlign: 'center', padding: '8px 12px', fontSize: '2rem', fontWeight: 800, fontFamily: '"JetBrains Mono", monospace' } }}
                  sx={{ width: 100, '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
                />
              )}
              {(cardio.completed ? parseFloat(editDuration || '0') : durationMin) < 60 && (
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 600, color: 'text.secondary', fontFamily: '"JetBrains Mono", monospace' }}>
                  min
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {/* Intensity / HR zone guidance */}
        {intensity && (
          <Box sx={{
            mb: 1.5, px: 1.5, py: 0.75, borderRadius: 0,
            bgcolor: `${semanticColors.cardioSteady}14`,
            display: 'inline-block',
          }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: semanticColors.cardioSteady, fontFamily: '"JetBrains Mono", monospace' }}>
              {intensity}
            </Typography>
          </Box>
        )}

        {/* Workout details from plan */}
        {workoutDescription && (
          <Box sx={{ mb: 2, fontSize: '0.875rem', color: 'text.secondary' }}>
            {workoutDescription.split('\n').map((line, i) => {
              const trimmed = line.trim();
              if (!trimmed) return null;
              // Skip the first line if it matches the exercise name (already shown above)
              if (i === 0 && trimmed.includes(exerciseName)) return null;
              return (
                <Typography key={i} variant="body2" color="text.secondary" sx={{ mb: 0.25 }}>
                  {trimmed}
                </Typography>
              );
            })}
          </Box>
        )}

        {/* Coach cue */}
        {coachCue && (
          <Box sx={{
            mb: 2, p: 1.5, borderRadius: 0,
            borderLeft: '2px solid #b4530940',
          }}>
            <Typography variant="caption" fontWeight={700} display="block" mb={0.25} sx={{ color: '#b45309', fontFamily: '"Libre Franklin", sans-serif' }}>
              Coach Cue
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: '#b45309', fontStyle: 'italic' }}>
              {coachCue}
            </Typography>
          </Box>
        )}

        {/* Mark Complete button */}
        <Button
          variant={cardio.completed ? 'contained' : 'outlined'}
          fullWidth
          onClick={handleToggle}
          sx={{
            minHeight: 52,
            borderRadius: 0,
            fontWeight: 700,
            fontSize: '1rem',
            fontFamily: '"JetBrains Mono", monospace',
            ...(cardio.completed
              ? {
                  backgroundColor: '#22c55e',
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
          {cardio.completed ? 'Completed ✓' : 'Mark Complete ✓'}
        </Button>
      </CardContent>
    </Card>
  );
}
