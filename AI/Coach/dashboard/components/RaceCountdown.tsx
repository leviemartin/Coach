'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, Typography, LinearProgress, Box } from '@mui/material';

const RACE_ZANDVOORT = new Date('2026-05-09');
const RACE_MORZINE = new Date('2027-07-05');
const TRAINING_START = new Date('2026-01-05');

function daysUntil(target: Date): number {
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function progressPercent(start: Date, target: Date): number {
  const now = new Date();
  const total = target.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 1000) / 10));
}

export default function RaceCountdown() {
  // Defer date calculations to client to avoid SSR/hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const zandvoortDays = mounted ? daysUntil(RACE_ZANDVOORT) : 0;
  const morzineDays = mounted ? daysUntil(RACE_MORZINE) : 0;
  const morzineProgress = mounted ? progressPercent(TRAINING_START, RACE_MORZINE) : 0;

  return (
    <Card variant="outlined" sx={{ bgcolor: 'background.default' }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          RACE COUNTDOWN
        </Typography>

        {zandvoortDays > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" fontWeight={500}>
              Zandvoort Super
            </Typography>
            <Typography variant="h5" fontWeight={700} color="primary">
              {zandvoortDays}d
            </Typography>
          </Box>
        )}

        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" fontWeight={500}>
            Morzine Ultra
          </Typography>
          <Typography variant="h5" fontWeight={700} color="primary">
            {morzineDays}d
          </Typography>
          <LinearProgress
            variant="determinate"
            value={morzineProgress}
            sx={{ mt: 0.5, borderRadius: 4, height: 6 }}
          />
          <Typography variant="caption" color="text.secondary">
            {Math.round(morzineProgress)}% of journey
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
