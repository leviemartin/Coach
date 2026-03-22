'use client';

import { Box, Typography, LinearProgress } from '@mui/material';

interface SessionProgressProps {
  completed: number;
  total: number;
}

export default function SessionProgress({ completed, total }: SessionProgressProps) {
  const pct = total > 0 ? Math.min((completed / total) * 100, 100) : 0;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        width: '100%',
      }}
    >
      <Box sx={{ flex: 1 }}>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 6,
            borderRadius: 3,
            backgroundColor: 'action.disabledBackground',
            '& .MuiLinearProgress-bar': {
              backgroundColor: '#22c55e',
              borderRadius: 3,
            },
          }}
        />
      </Box>
      <Typography
        variant="caption"
        fontWeight={700}
        color="text.secondary"
        sx={{ flexShrink: 0, minWidth: 32, textAlign: 'right' }}
      >
        {completed}/{total}
      </Typography>
    </Box>
  );
}
