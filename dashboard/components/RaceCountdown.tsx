'use client';

import { useState, useEffect } from 'react';
import { Typography, Box } from '@mui/material';
import type { Race } from '@/lib/types';
import { borders } from '@/lib/design-tokens';

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

  const furthestRace = upcomingRaces.length > 0 ? upcomingRaces[upcomingRaces.length - 1] : null;
  const overallProgress = furthestRace ? progressPercent(TRAINING_START, new Date(furthestRace.date)) : 0;

  return (
    <Box sx={{ border: `2px solid ${borders.hard}`, bgcolor: 'background.paper', p: 1.5 }}>
      <Typography sx={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '9px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '2px',
        color: 'text.secondary',
      }}>
        RACE COUNTDOWN
      </Typography>

      {error ? (
        <Typography sx={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '10px',
          color: 'text.secondary',
          mt: 1,
        }}>
          Race data unavailable
        </Typography>
      ) : (<>
      {mounted && upcomingRaces.map((race) => {
        const days = daysUntil(new Date(race.date));
        const weeks = Math.floor(days / 7);
        const remainDays = days % 7;
        return (
          <Box key={race.id} sx={{ mt: 1 }}>
            <Typography sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '11px',
              fontWeight: 500,
            }}>
              {race.name}
            </Typography>
            <Typography sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '-0.5px',
              color: 'text.primary',
              lineHeight: 1.2,
            }}>
              {weeks}w {remainDays}d
            </Typography>
          </Box>
        );
      })}

      {mounted && furthestRace && (
        <Box sx={{ mt: 1 }}>
          {/* Pip-style progress bar */}
          <Box sx={{ display: 'flex', gap: '2px', mb: 0.5 }}>
            {Array.from({ length: 10 }, (_, i) => {
              const filled = overallProgress >= (i + 1) * 10;
              const active = !filled && overallProgress >= i * 10;
              return (
                <Box
                  key={i}
                  sx={{
                    flex: 1,
                    height: 6,
                    bgcolor: filled ? '#22c55e' : active ? borders.hard : borders.soft,
                    ...(active && {
                      outline: `1px solid ${borders.hard}`,
                      outlineOffset: -1,
                    }),
                  }}
                />
              );
            })}
          </Box>
          <Typography sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '1px',
            color: 'text.secondary',
          }}>
            {Math.round(overallProgress)}% OF JOURNEY
          </Typography>
        </Box>
      )}

      {mounted && upcomingRaces.length === 0 && (
        <Typography sx={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '11px',
          color: 'text.secondary',
          mt: 1,
        }}>
          No upcoming races
        </Typography>
      )}
      </>)}
    </Box>
  );
}
