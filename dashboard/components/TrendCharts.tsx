'use client';

import React from 'react';
import { Card, CardContent, Typography, Grid, Box, FormControl, InputLabel, Select, MenuItem, Button, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { cardContentSx } from '@/lib/theme';
import { LineChart, BarChart, ScatterChart } from '@mui/x-charts';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import type { WeeklyMetrics, CeilingEntry, DexaScan } from '@/lib/types';
import { semanticColors } from '@/lib/design-tokens';

interface ComplianceTrendPoint {
  week_number: number;
  compliance_pct: number;
  days_logged: number;
}

interface TrendChartsProps {
  metrics: WeeklyMetrics[];
  ceilings: CeilingEntry[];
  dexaScans: DexaScan[];
  exercises: string[];
  selectedExercise: string;
  onExerciseChange: (exercise: string) => void;
  complianceTrend: ComplianceTrendPoint[];
}

const CHART_COLORS = {
  blue: semanticColors.body,
  green: semanticColors.recovery.good,
  purple: '#8b5cf6', // protocols
  orange: semanticColors.cardioIntervals,
  red: semanticColors.recovery.problem,
  teal: semanticColors.cardioSteady,
  pink: '#ec4899',
  amber: semanticColors.recovery.caution,
};

// MUI X-Charts needs numbers, not null. Replace null with 0.
function nn(val: number | null | undefined): number {
  return val ?? 0;
}

/** Longest run of consecutive `true` values */
function longestStreak(values: boolean[]): number {
  let max = 0;
  let cur = 0;
  for (const v of values) {
    cur = v ? cur + 1 : 0;
    if (cur > max) max = cur;
  }
  return max;
}

function EmptyState({ message }: { message: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 250 }}>
      <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
        {message}
      </Typography>
    </Box>
  );
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Week number → approximate month name (epoch = Mon Dec 29, 2025)
function weekToMonthName(weekNumber: number): string {
  const epochMs = new Date('2025-12-29').getTime();
  const weekStartMs = epochMs + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000;
  return MONTH_NAMES[new Date(weekStartMs).getMonth()];
}

export default function TrendCharts({
  metrics,
  ceilings,
  dexaScans,
  exercises,
  selectedExercise,
  onExerciseChange,
  complianceTrend,
}: TrendChartsProps) {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const isSm = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const chartHeight = isXs ? 200 : isSm ? 250 : 300;
  const [complianceView, setComplianceView] = React.useState<'weekly' | 'monthly'>('weekly');

  const weeks = metrics.map((m) => `W${m.weekNumber}`);

  if (!metrics.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">No trend data yet.</Typography>
        <Button variant="contained" href="/checkin" sx={{ mt: 2 }}>Start Check-In</Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* ── Body Composition ── */}
      <Typography variant="h6" sx={{ mb: 2 }}>Body Composition</Typography>
      <Grid container spacing={3}>
        {/* Weight Progression */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={cardContentSx}>
              <Typography variant="h6" gutterBottom>Weight Progression</Typography>
              <Box sx={{ position: 'relative' }}>
                <LineChart
                  xAxis={[{ data: weeks, scaleType: 'band' }]}
                  yAxis={[{ min: 85, max: Math.max(105, ...metrics.map((m) => nn(m.weightKg))) }]}
                  series={[
                    {
                      data: metrics.map((m) => nn(m.weightKg)),
                      label: 'Weight (kg)',
                      color: CHART_COLORS.blue,
                    },
                  ]}
                  height={chartHeight}
                />
                {/* 89kg reference line overlay — positioned over the chart area */}
                {(() => {
                  // Compute approximate Y offset for 89kg within yAxis [85, ~105]
                  const yMin = 85;
                  const yMax = Math.max(105, ...metrics.map((m) => nn(m.weightKg)));
                  const chartPaddingTop = 10; // px approximate MUI X-Charts top margin
                  const chartPaddingBottom = 30; // px approximate for x-axis labels
                  const innerHeight = chartHeight - chartPaddingTop - chartPaddingBottom;
                  const pct = 1 - (89 - yMin) / (yMax - yMin);
                  const topPx = chartPaddingTop + pct * innerHeight;
                  return (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: `${topPx}px`,
                        left: 0,
                        right: 0,
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        px: 1,
                      }}
                    >
                      <Box sx={{ flex: 1, borderTop: `2px dashed ${CHART_COLORS.green}`, opacity: 0.8 }} />
                      <Typography
                        variant="caption"
                        sx={{ ml: 0.5, color: CHART_COLORS.green, fontWeight: 700, whiteSpace: 'nowrap' }}
                      >
                        89kg target
                      </Typography>
                    </Box>
                  );
                })()}
              </Box>
              {/* Start weight annotation */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Start: <strong>102kg</strong> (W1)
                </Typography>
                <Typography variant="caption" color="success.main">
                  Target: 89kg {metrics[metrics.length - 1]?.weightKg != null ? `· Now: ${metrics[metrics.length - 1].weightKg}kg` : ''}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Body Composition (DEXA + Garmin) */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={cardContentSx}>
              <Typography variant="h6" gutterBottom>Body Composition</Typography>
              {metrics.some((m) => m.bodyFatPct != null) ? (
                <>
                  <LineChart
                    xAxis={[{ data: weeks, scaleType: 'band' }]}
                    series={[
                      {
                        data: metrics.map((m) => nn(m.bodyFatPct) || null),
                        label: 'Garmin BF%',
                        color: CHART_COLORS.orange,
                      },
                      ...(dexaScans.length > 0 && dexaScans.some((s) => s.garminBodyFatPct != null)
                        ? [{
                            data: metrics.map((m) => {
                              const latestDexa = dexaScans[dexaScans.length - 1];
                              const raw = nn(m.bodyFatPct);
                              return raw > 0 ? Math.round((raw + latestDexa.calibration.bodyFatOffsetPct) * 10) / 10 : null;
                            }),
                            label: 'DEXA-corrected BF%',
                            color: CHART_COLORS.pink,
                          }]
                        : []),
                    ]}
                    height={isXs ? 160 : 200}
                  />
                  <LineChart
                    xAxis={[{ data: weeks, scaleType: 'band' }]}
                    series={[
                      {
                        data: metrics.map((m) => nn(m.muscleMassKg) || null),
                        label: 'Muscle Mass (kg)',
                        color: CHART_COLORS.green,
                      },
                    ]}
                    height={isXs ? 120 : 150}
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
                      color: CHART_COLORS.pink,
                    },
                  ]}
                  height={chartHeight}
                />
              ) : (
                <EmptyState message="Book your DEXA scan to unlock body composition tracking." />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Performance & Recovery ── */}
      <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>Performance &amp; Recovery</Typography>
      <Grid container spacing={3}>
        {/* Sleep & Readiness */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={cardContentSx}>
              <Typography variant="h6" gutterBottom>Sleep &amp; Readiness</Typography>
              <BarChart
                xAxis={[{ data: weeks, scaleType: 'band' }]}
                series={[
                  {
                    data: metrics.map((m) => nn(m.avgSleepScore)),
                    label: 'Sleep Score',
                    color: CHART_COLORS.purple,
                  },
                  {
                    data: metrics.map((m) => nn(m.avgTrainingReadiness)),
                    label: 'Readiness',
                    color: CHART_COLORS.teal,
                  },
                ]}
                height={chartHeight}
              />
              {/* Bedtime consistency section */}
              <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" gutterBottom sx={{ color: 'text.secondary' }}>
                  Bedtime Consistency (vs. 23:00 target)
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: semanticColors.recovery.good, flexShrink: 0 }} />
                  <Typography variant="caption" color="text.secondary">Before 23:00</Typography>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: semanticColors.recovery.caution, flexShrink: 0, ml: 1 }} />
                  <Typography variant="caption" color="text.secondary">23:00–01:00</Typography>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: semanticColors.recovery.problem, flexShrink: 0, ml: 1 }} />
                  <Typography variant="caption" color="text.secondary">After 01:00</Typography>
                </Box>
                <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                  Bedtime consistency data will appear after Garmin sync integration.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Pull-Up Progression */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={cardContentSx}>
              <Typography variant="h6" gutterBottom>Pull-Up Progression</Typography>
              {metrics.some((m) => m.pullupCount != null) ? (
                <LineChart
                  xAxis={[{ data: weeks, scaleType: 'band' }]}
                  series={[
                    {
                      data: metrics.map((m) => nn(m.pullupCount)),
                      label: 'Pull-Ups',
                      color: CHART_COLORS.orange,
                    },
                  ]}
                  height={chartHeight}
                />
              ) : (
                <EmptyState message="Complete a check-in to start tracking pull-up progress." />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Training Load ── */}
      <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>Training Load</Typography>
      <Grid container spacing={3}>
        {/* Strength Ceilings */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={cardContentSx}>
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
                      color: CHART_COLORS.red,
                    },
                  ]}
                  height={chartHeight}
                />
              ) : (
                <EmptyState message="Select an exercise above — data appears after your first ceiling update." />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Training Load Focus */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={cardContentSx}>
              <Typography variant="h6" gutterBottom>Training Load Focus</Typography>
              <EmptyState message="Training Load Focus data will appear after your first check-in with Garmin data." />
            </CardContent>
          </Card>
        </Grid>

        {/* Endurance Score */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={cardContentSx}>
              <Typography variant="h6" gutterBottom>Endurance Score</Typography>
              <EmptyState message="Endurance Score trend will appear after your first check-in with Garmin data." />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Protocol Compliance ── */}
      <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>Protocol Compliance</Typography>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={cardContentSx}>
              <Typography variant="h6" gutterBottom>Protocol Compliance</Typography>
              <BarChart
                xAxis={[{ data: weeks, scaleType: 'band' }]}
                series={[
                  {
                    data: metrics.map((m) => nn(m.vampireCompliancePct)),
                    label: 'Vampire %',
                    color: CHART_COLORS.blue,
                  },
                  {
                    data: metrics.map((m) => (nn(m.rugProtocolDays) / 7) * 100),
                    label: 'Rug %',
                    color: CHART_COLORS.purple,
                  },
                  {
                    data: metrics.map((m) => m.hydrationTracked ? 100 : 0),
                    label: 'Hydration',
                    color: CHART_COLORS.teal,
                  },
                ]}
                height={chartHeight}
              />
              {/* Compliance streaks */}
              {(() => {
                const vampireStreak = longestStreak(metrics.map((m) => nn(m.vampireCompliancePct) > 0));
                const rugStreak = longestStreak(metrics.map((m) => nn(m.rugProtocolDays) > 0));
                const hydrationStreak = longestStreak(metrics.map((m) => m.hydrationTracked === true));

                const streaks = [
                  { label: 'Vampire', streak: vampireStreak, color: CHART_COLORS.blue },
                  { label: 'Rug', streak: rugStreak, color: CHART_COLORS.purple },
                  { label: 'Hydration', streak: hydrationStreak, color: CHART_COLORS.teal },
                ];

                return (
                  <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ width: '100%', mb: 0.5 }}>
                      Longest streak (consecutive weeks with &gt;0 compliance):
                    </Typography>
                    {streaks.map(({ label, streak, color }) => (
                      <Box
                        key={label}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 1.5,
                          py: 0.5,
                          borderRadius: '999px',
                          bgcolor: `${color}22`,
                          border: `1px solid ${color}66`,
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 700, color }}>
                          {streak}w
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {label}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                );
              })()}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Nutrition ── */}
      <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>Nutrition</Typography>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={cardContentSx}>
              <Typography variant="h6" gutterBottom>Nutrition</Typography>
              <BarChart
                xAxis={[{ data: weeks, scaleType: 'band' }]}
                series={[
                  {
                    data: metrics.map((m) => nn(m.caloriesAvg)),
                    label: 'Avg Calories',
                    color: CHART_COLORS.amber,
                  },
                  {
                    data: metrics.map((m) => nn(m.proteinAvg) * 10),
                    label: 'Protein (g x10)',
                    color: CHART_COLORS.green,
                  },
                ]}
                height={chartHeight}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Weekly Compliance ── */}
      <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>Weekly Compliance</Typography>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={cardContentSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h6">Check-In Compliance</Typography>
                <ToggleButtonGroup
                  value={complianceView}
                  exclusive
                  size="small"
                  onChange={(_e, val) => { if (val) setComplianceView(val); }}
                >
                  <ToggleButton value="weekly">Weekly</ToggleButton>
                  <ToggleButton value="monthly">Monthly</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              {complianceTrend.length > 0 ? (() => {
                if (complianceView === 'weekly') {
                  return (
                    <LineChart
                      xAxis={[{ data: complianceTrend.map((p) => `W${p.week_number}`), scaleType: 'band' }]}
                      yAxis={[{ min: 0, max: 100 }]}
                      series={[
                        {
                          data: complianceTrend.map((p) => p.compliance_pct),
                          label: 'Compliance %',
                          color: CHART_COLORS.teal,
                        },
                      ]}
                      height={chartHeight}
                    />
                  );
                }
                // Monthly view: group by month name, average compliance_pct
                const byMonth: Record<string, number[]> = {};
                const monthOrder: string[] = [];
                complianceTrend.forEach((p) => {
                  const m = weekToMonthName(p.week_number);
                  if (!byMonth[m]) { byMonth[m] = []; monthOrder.push(m); }
                  byMonth[m].push(p.compliance_pct);
                });
                // Deduplicate monthOrder while preserving order
                const uniqueMonths = Array.from(new Set(monthOrder));
                const monthlyAvg = uniqueMonths.map((m) => {
                  const vals = byMonth[m];
                  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
                });
                return (
                  <LineChart
                    xAxis={[{ data: uniqueMonths, scaleType: 'band' }]}
                    yAxis={[{ min: 0, max: 100 }]}
                    series={[
                      {
                        data: monthlyAvg,
                        label: 'Avg Compliance %',
                        color: CHART_COLORS.teal,
                      },
                    ]}
                    height={chartHeight}
                  />
                );
              })() : (
                <EmptyState message="Complete check-ins to track compliance over time." />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
