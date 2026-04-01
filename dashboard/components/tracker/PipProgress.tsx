'use client';
import { Box } from '@mui/material';

interface PipProgressProps { completed: number; total: number; currentIndex?: number; }

export default function PipProgress({ completed, total, currentIndex }: PipProgressProps) {
  return (
    <Box sx={{ display: 'flex', gap: '2px', px: 2.5, py: 1.75, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => {
        const isDone = i < completed;
        const isActive = currentIndex != null ? i === currentIndex : i === completed;
        return (
          <Box key={i} sx={{
            flex: 1, height: 6, backgroundColor: isDone ? '#22c55e' : '#e4e4e0',
            position: 'relative',
            ...(isActive && !isDone && {
              backgroundColor: '#18181b',
              '&::after': {
                content: '""', position: 'absolute', top: -2, left: 0, right: 0, bottom: -2,
                border: '1px solid #18181b',
              },
            }),
          }} />
        );
      })}
    </Box>
  );
}
