'use client';

import { Typography, Box } from '@mui/material';
import type { HrZoneSummary } from '@/lib/types';

const ZONE_COLORS = ['#93c5fd', '#93c5fd', '#22c55e', '#f59e0b', '#ef4444'];
const ZONE_LABELS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];

interface HrZoneBarProps {
  zones: HrZoneSummary;
}

export default function HrZoneBar({ zones }: HrZoneBarProps) {
  const values = [zones.z1Minutes, zones.z2Minutes, zones.z3Minutes, zones.z4Minutes, zones.z5Minutes];
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <Box sx={{ mt: 1.5 }}>
      <Box sx={{ display: 'flex', height: 20, overflow: 'hidden' }}>
        {values.map((v, i) => {
          const pct = (v / total) * 100;
          if (pct < 1) return null;
          return (
            <Box key={i} sx={{ width: `${pct}%`, bgcolor: ZONE_COLORS[i] }} />
          );
        })}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        {values.map((v, i) => (
          <Typography key={i} sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.625rem', color: 'text.secondary' }}>
            {ZONE_LABELS[i]}: {v}m
          </Typography>
        ))}
      </Box>
    </Box>
  );
}
