'use client';

import { Box, Typography } from '@mui/material';
import type { StepIconProps } from '@mui/material/StepIcon';
import { borders } from '@/lib/design-tokens';

export default function BrutalistStepIcon({ active, completed, icon }: StepIconProps) {
  const isDone = completed || active;

  return (
    <Box
      sx={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: isDone ? borders.hard : 'transparent',
        border: `2px solid ${isDone ? borders.hard : borders.soft}`,
        borderRadius: 0,
      }}
    >
      <Typography
        sx={{
          fontFamily: '"JetBrains Mono", monospace',
          fontWeight: 700,
          fontSize: '0.75rem',
          color: isDone ? '#fafaf7' : '#71717a',
          lineHeight: 1,
        }}
      >
        {String(icon)}
      </Typography>
    </Box>
  );
}
