'use client';

import { Typography, Box } from '@mui/material';
import HeroCard from './HeroCard';
import { typography } from '@/lib/design-tokens';

interface RecoveryScoreProps {
  score: number | null;
  directive: string;
  color: string;
}

export default function RecoveryScore({ score, directive, color }: RecoveryScoreProps) {
  return (
    <HeroCard label="Recovery" accentColor={color}>
      <Box sx={{ textAlign: 'center', py: 1 }}>
        <Typography sx={{ ...typography.heroNumber, color, lineHeight: 1 }}>
          {score ?? '—'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {directive}
        </Typography>
      </Box>
    </HeroCard>
  );
}
