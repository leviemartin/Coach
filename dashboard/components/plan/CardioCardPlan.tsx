'use client';
import { Box, Typography } from '@mui/material';
import type { NormalizedCardio } from '@/lib/types';

interface CardioCardPlanProps { label: string; exercise: NormalizedCardio; }

export default function CardioCardPlan({ label, exercise }: CardioCardPlanProps) {
  const parts: string[] = [];
  if (exercise.prescribedRounds) parts.push(`${exercise.prescribedRounds} rounds`);
  if (exercise.prescribedDurationMin) parts.push(`${exercise.prescribedDurationMin} min`);
  if (exercise.intervalWorkSeconds != null) {
    parts.push(`${exercise.intervalWorkSeconds}s work`);
    if (exercise.intervalRestSeconds != null) parts.push(`${exercise.intervalRestSeconds}s rest`);
  }
  const rx = parts.join(' · ');

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, py: 0.75, px: 2.5 }}>
        <Typography sx={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: '0.6875rem', fontWeight: 700,
          color: '#a1a1aa', width: 24, flexShrink: 0,
        }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, flex: 1 }}>{exercise.name}</Typography>
        <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', color: '#52525b' }}>{rx}</Typography>
        {exercise.targetIntensity && (
          <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', fontWeight: 700, color: '#18181b' }}>
            {exercise.targetIntensity}
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
