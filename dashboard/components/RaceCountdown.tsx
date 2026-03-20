'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, Typography, LinearProgress, Box } from '@mui/material';
import type { Race } from '@/lib/types';

const TRAINING_START = new Date('2025-12-29');

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
  const [mounted, setMounted] = useState(false);
  const [races, setRaces] = useState<Race[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch('/api/races')
      .then((r) => r.json())
      .then((data) => setRaces(data.races || []))
      .catch(() => setError(true));
  }, []);

  const upcomingRaces = mounted
    ? races.filter((r) => daysUntil(new Date(r.date)) > 0).sort((a, b) => a.date.localeCompare(b.date))
    : [];

  // Use the furthest-out race for progress bar
  const furthestRace = upcomingRaces.length > 0 ? upcomingRaces[upcomingRaces.length - 1] : null;
  const overallProgress = furthestRace ? progressPercent(TRAINING_START, new Date(furthestRace.date)) : 0;

  return (
    <Card variant="outlined" sx={{ bgcolor: 'background.paper' }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          RACE COUNTDOWN
        </Typography>

        {error ? (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Race data unavailable
          </Typography>
        ) : (<>
        {mounted && upcomingRaces.map((race) => {
          const days = daysUntil(new Date(race.date));
          const weeks = Math.floor(days / 7);
          const remainDays = days % 7;
          return (
            <Box key={race.id} sx={{ mt: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                {race.name}
              </Typography>
              <Typography variant="h5" fontWeight={700} color="primary">
                {weeks}w {remainDays}d
              </Typography>
            </Box>
          );
        })}

        {mounted && furthestRace && (
          <Box sx={{ mt: 1 }}>
            <LinearProgress
              variant="determinate"
              value={overallProgress}
              sx={{}}
            />
            <Typography variant="caption" color="text.secondary">
              {Math.round(overallProgress)}% of journey
            </Typography>
          </Box>
        )}

        {mounted && upcomingRaces.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            No upcoming races
          </Typography>
        )}
        </>)}
      </CardContent>
    </Card>
  );
}
