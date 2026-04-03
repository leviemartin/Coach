'use client';

import { Box, Typography } from '@mui/material';
import { borders } from '@/lib/design-tokens';

interface DayProgressProps {
  checked: number;
  total: number;
  streak: { current: number; best: number };
}

export default function DayProgress({ checked, total, streak }: DayProgressProps) {
  return (
    <Box>
      {/* Pip bar */}
      <Box sx={{ display: 'flex', gap: '2px', mb: 1 }}>
        {Array.from({ length: total }, (_, i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              height: 6,
              bgcolor: i < checked ? '#22c55e' : borders.soft,
            }}
          />
        ))}
      </Box>

      {/* Stats row */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 800, fontSize: '1.25rem' }}>
            {checked}/{total}
          </Typography>
          <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.625rem', fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '2px' }}>
            protocols
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          {streak.current > 0 ? (
            <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', fontWeight: 700, color: '#f97316' }}>
              {streak.current}d streak
            </Typography>
          ) : (
            <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', color: '#71717a' }}>
              No streak
            </Typography>
          )}
          {streak.best > 0 && (
            <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.5625rem', fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '2px' }}>
              Best: {streak.best}d
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}
