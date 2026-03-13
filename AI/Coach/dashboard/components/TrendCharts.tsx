'use client';

import React from 'react';
import { Card, CardContent, Typography, Grid, Box, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { LineChart, BarChart, ScatterChart } from '@mui/x-charts';
import type { WeeklyMetrics, CeilingEntry, DexaScan } from '@/lib/types';

interface TrendChartsProps {
  metrics: WeeklyMetrics[];
  ceilings: CeilingEntry[];
  dexaScans: DexaScan[];
  exercises: string[];
  selectedExercise: string;
  onExerciseChange: (exercise: string) => void;
}

// MUI X-Charts needs numbers, not null. Replace null with 0.
function nn(val: number | null | undefined): number {
  return val ?? 0;
}

export default function TrendCharts({
  metrics,
  ceilings,
  dexaScans,
  exercises,
  selectedExercise,
  onExerciseChange,
}: TrendChartsProps) {
  const weeks = metrics.map((m) => `W${m.weekNumber}`);

  if (!metrics.length) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" color="text.secondary">
            No trend data yet. Complete your first check-in to see trends.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Grid container spacing={3}>
      {/* Weight Progression */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Weight Progression</Typography>
            <LineChart
              xAxis={[{ data: weeks, scaleType: 'band' }]}
              series={[
                {
                  data: metrics.map((m) => nn(m.weightKg)),
                  label: 'Weight (kg)',
                  color: '#1565C0',
                },
              ]}
              height={250}
            />
            <Typography variant="caption" color="success.main" sx={{ display: 'block', textAlign: 'right' }}>
              Target: 89kg
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Sleep & Readiness */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Sleep & Readiness</Typography>
            <BarChart
              xAxis={[{ data: weeks, scaleType: 'band' }]}
              series={[
                {
                  data: metrics.map((m) => nn(m.avgSleepScore)),
                  label: 'Sleep Score',
                  color: '#7E57C2',
                },
                {
                  data: metrics.map((m) => nn(m.avgTrainingReadiness)),
                  label: 'Readiness',
                  color: '#26A69A',
                },
              ]}
              height={250}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Protocol Compliance */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Protocol Compliance</Typography>
            <BarChart
              xAxis={[{ data: weeks, scaleType: 'band' }]}
              series={[
                {
                  data: metrics.map((m) => nn(m.vampireCompliancePct)),
                  label: 'Vampire %',
                  color: '#5C6BC0',
                },
                {
                  data: metrics.map((m) => (nn(m.rugProtocolDays) / 7) * 100),
                  label: 'Rug %',
                  color: '#AB47BC',
                },
                {
                  data: metrics.map((m) => m.hydrationTracked ? 100 : 0),
                  label: 'Hydration',
                  color: '#29B6F6',
                },
              ]}
              height={250}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Strength Ceilings */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Typography variant="h6">Strength Ceilings</Typography>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Exercise</InputLabel>
                <Select
                  value={selectedExercise}
                  label="Exercise"
                  onChange={(e) => onExerciseChange(e.target.value)}
                >
                  {exercises.map((ex) => (
                    <MenuItem key={ex} value={ex}>{ex.replace(/_/g, ' ')}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            {ceilings.length > 0 ? (
              <LineChart
                xAxis={[{ data: ceilings.map((c) => `W${c.weekNumber}`), scaleType: 'band' }]}
                series={[
                  {
                    data: ceilings.map((c) => c.weightKg),
                    label: selectedExercise.replace(/_/g, ' '),
                    color: '#EF5350',
                  },
                ]}
                height={250}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">Select an exercise to view history.</Typography>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Pull-Up Progression */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Pull-Up Progression</Typography>
            {metrics.some((m) => m.pullupCount != null) ? (
              <LineChart
                xAxis={[{ data: weeks, scaleType: 'band' }]}
                series={[
                  {
                    data: metrics.map((m) => nn(m.pullupCount)),
                    label: 'Pull-Ups',
                    color: '#FF7043',
                  },
                ]}
                height={250}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">No pull-up data yet.</Typography>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Nutrition */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Nutrition</Typography>
            <BarChart
              xAxis={[{ data: weeks, scaleType: 'band' }]}
              series={[
                {
                  data: metrics.map((m) => nn(m.caloriesAvg)),
                  label: 'Avg Calories',
                  color: '#FFA726',
                },
                {
                  data: metrics.map((m) => nn(m.proteinAvg) * 10),
                  label: 'Protein (g x10)',
                  color: '#66BB6A',
                },
              ]}
              height={250}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Body Composition (DEXA + Garmin) */}
      {(dexaScans.length > 0 || metrics.some((m) => m.bodyFatPct != null)) && (
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Body Composition</Typography>
              {metrics.some((m) => m.bodyFatPct != null) ? (
                <>
                  <LineChart
                    xAxis={[{ data: weeks, scaleType: 'band' }]}
                    series={[
                      {
                        data: metrics.map((m) => nn(m.bodyFatPct) || null),
                        label: 'Garmin BF%',
                        color: '#FF7043',
                      },
                      ...(dexaScans.length > 0 && dexaScans.some((s) => s.garminBodyFatPct != null)
                        ? [{
                            data: metrics.map((m) => {
                              const latestDexa = dexaScans[dexaScans.length - 1];
                              const raw = nn(m.bodyFatPct);
                              return raw > 0 ? Math.round((raw + latestDexa.calibration.bodyFatOffsetPct) * 10) / 10 : null;
                            }),
                            label: 'DEXA-corrected BF%',
                            color: '#E91E63',
                          }]
                        : []),
                    ]}
                    height={200}
                  />
                  <LineChart
                    xAxis={[{ data: weeks, scaleType: 'band' }]}
                    series={[
                      {
                        data: metrics.map((m) => nn(m.muscleMassKg) || null),
                        label: 'Muscle Mass (kg)',
                        color: '#4CAF50',
                      },
                    ]}
                    height={150}
                  />
                  {dexaScans.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        DEXA ground truth:{' '}
                        {dexaScans.map((s) => `#${s.scanNumber} (${s.date}): ${s.totalBodyFatPct}% BF, ${s.totalLeanMassKg}kg lean`).join(' | ')}
                      </Typography>
                    </Box>
                  )}
                </>
              ) : dexaScans.length > 0 ? (
                <ScatterChart
                  xAxis={[{
                    data: dexaScans.map((_, i) => i + 1),
                    label: 'Scan #',
                    min: 0.5,
                    max: 3.5,
                  }]}
                  series={[
                    {
                      data: dexaScans.map((s, i) => ({ x: i + 1, y: s.totalBodyFatPct, id: `bf-${i}` })),
                      label: 'DEXA BF%',
                      color: '#E91E63',
                    },
                  ]}
                  height={250}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">No body composition data yet.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );
}
