'use client';

import { Card, CardContent, Typography, Grid, Box, Chip } from '@mui/material';
import type { Race, RaceStatus } from '@/lib/types';

interface PhaseInfo {
  number: number;
  name: string;
  dateRange: string;
  isCurrent: boolean;
  weightTarget: string;
  focus: string[];
}

interface PeriodizationResponse {
  phases: PhaseInfo[];
  currentPhase: PhaseInfo;
  currentWeek: number;
  targets: {
    raceWeight: string;
    stretchWeight: string;
    protein: string;
    calories: string;
  };
}

const STATUS_COLORS: Record<RaceStatus, 'success' | 'warning' | 'default' | 'info'> = {
  registered: 'success',
  planned: 'warning',
  tentative: 'default',
  completed: 'info',
};

function getProteinForWeight(weight: number | null): string {
  if (!weight) return '180g';
  if (weight >= 95) return '180g';
  if (weight >= 92) return '190g';
  return '200g';
}

interface MacroOverviewProps {
  periodization: PeriodizationResponse | null;
  races: Race[];
  currentWeight: number | null;
}

export default function MacroOverview({ periodization, races, currentWeight }: MacroOverviewProps) {
  const today = new Date();
  const upcomingRaces = races
    .filter((r) => new Date(r.date) > today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const phase = periodization?.currentPhase;
  const targets = periodization?.targets;

  // Parse weight target number for delta calculation
  let phaseWeightNum: number | null = null;
  if (phase?.weightTarget) {
    const m = phase.weightTarget.match(/(\d+)/);
    if (m) phaseWeightNum = parseInt(m[1]);
  }

  const weightDelta = currentWeight && phaseWeightNum ? currentWeight - phaseWeightNum : null;

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {/* Card 1: Race Countdowns */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              RACE COUNTDOWNS
            </Typography>
            {upcomingRaces.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                No upcoming races
              </Typography>
            )}
            {upcomingRaces.map((race) => {
              const diff = new Date(race.date).getTime() - today.getTime();
              const totalDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
              const weeks = Math.floor(totalDays / 7);
              const days = totalDays % 7;
              return (
                <Box key={race.id} sx={{ mt: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
                      {race.name}
                    </Typography>
                    <Chip label={race.status} color={STATUS_COLORS[race.status]} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
                  </Box>
                  <Typography variant="h5" fontWeight={700} color="primary">
                    {weeks}w {days}d
                  </Typography>
                </Box>
              );
            })}
          </CardContent>
        </Card>
      </Grid>

      {/* Card 2: Phase Targets */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              PHASE TARGETS
            </Typography>
            {phase && (
              <Box sx={{ mt: 1 }}>
                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Phase weight</Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {phase.weightTarget || '—'}
                    {currentWeight && weightDelta !== null && (
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{ ml: 1, color: weightDelta <= 0 ? 'success.main' : weightDelta <= 2 ? 'text.secondary' : 'warning.main' }}
                      >
                        (now {currentWeight}kg, {weightDelta > 0 ? `${weightDelta.toFixed(1)}kg to go` : 'on target'})
                      </Typography>
                    )}
                  </Typography>
                </Box>
                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Race weight</Typography>
                  <Typography variant="body1" fontWeight={600}>{targets?.raceWeight || '89kg'}</Typography>
                </Box>
                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Protein</Typography>
                  <Typography variant="body1" fontWeight={600}>{getProteinForWeight(currentWeight)}/day</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Calories</Typography>
                  <Typography variant="body1" fontWeight={600}>{targets?.calories || '2,350 kcal'}</Typography>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Card 3: Phase Focus */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              {phase ? `PHASE ${phase.number} FOCUS` : 'PHASE FOCUS'}
            </Typography>
            {phase && phase.focus.length > 0 ? (
              <Box sx={{ mt: 1 }}>
                {phase.focus.map((item, i) => (
                  <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>
                    — {item}
                  </Typography>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                No focus items available
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
