'use client';
import { Box, Typography } from '@mui/material';
import type { NormalizedExercise } from '@/lib/types';
import { supersetGroupLetter } from '@/lib/buildBlocks';
import { supersetColors } from '@/lib/design-tokens';
import { formatDuration } from '@/lib/format';
import ExerciseRowPlan from './ExerciseRowPlan';

interface SupersetBlockPlanProps {
  groupId: number;
  exercises: NormalizedExercise[];
  restSeconds: number | null;
}

export default function SupersetBlockPlan({ groupId, exercises, restSeconds }: SupersetBlockPlanProps) {
  const letter = supersetGroupLetter(groupId);
  const colors = supersetColors[letter] ?? supersetColors.A;
  const rounds = exercises[0]?.sets ?? 0;

  const metaParts: string[] = [];
  if (rounds > 0) metaParts.push(`${rounds} rounds`);
  if (restSeconds != null) metaParts.push(`${formatDuration(restSeconds)} rest`);

  return (
    <Box sx={{
      borderLeft: `3px solid ${colors.border}`, mx: 2, my: 0.5, py: 0.75, pl: 1.5, backgroundColor: colors.bg,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, px: 1 }}>
        <Typography sx={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: '0.5625rem', fontWeight: 700,
          color: colors.border, letterSpacing: '1.5px', textTransform: 'uppercase',
        }}>Superset {letter}</Typography>
        {metaParts.length > 0 && (
          <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.5625rem', color: '#a1a1aa' }}>
            · {metaParts.join(' · ')}
          </Typography>
        )}
      </Box>
      {exercises.map((ex, idx) => (
        <ExerciseRowPlan key={ex.name} label={`${letter}${idx + 1}`} exercise={ex} />
      ))}
    </Box>
  );
}
