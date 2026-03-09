'use client';

import React, { useEffect, useState } from 'react';
import { Typography, Card, CardContent, Grid, Box, Button, Chip, LinearProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';

interface GarminSummary {
  avgSleep: number | null;
  avgReadiness: number | null;
  weight: number | null;
  activityCount: number;
}

export default function DashboardHome() {
  const router = useRouter();
  const [summary, setSummary] = useState<GarminSummary | null>(null);

  const isSunday = new Date().getDay() === 0;

  useEffect(() => {
    fetch('/api/garmin')
      .then((r) => r.json())
      .then((data) => setSummary(data.summary))
      .catch(() => {});
  }, []);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          Dashboard
        </Typography>
        <Chip label="Phase 1: The Reconstruction" color="primary" />
        <Chip label="Week 10" variant="outlined" />
      </Box>

      {isSunday && (
        <Card sx={{ mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              It&apos;s Sunday. Time for your check-in.
            </Typography>
            <Button
              variant="contained"
              color="inherit"
              size="large"
              onClick={() => router.push('/checkin')}
              sx={{ color: 'primary.main', bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
            >
              Start Check-In
            </Button>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Weight</Typography>
              <Typography variant="h4" fontWeight={700}>
                {summary?.weight ? `${summary.weight}kg` : '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">Target: 89kg</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Avg Sleep Score</Typography>
              <Typography variant="h4" fontWeight={700}>
                {summary?.avgSleep ?? '—'}
              </Typography>
              <StatusBadge
                value={summary?.avgSleep ?? null}
                greenThreshold={75}
                yellowThreshold={60}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Avg Readiness</Typography>
              <Typography variant="h4" fontWeight={700}>
                {summary?.avgReadiness ?? '—'}
              </Typography>
              <StatusBadge
                value={summary?.avgReadiness ?? null}
                greenThreshold={50}
                yellowThreshold={30}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Activities This Week</Typography>
              <Typography variant="h4" fontWeight={700}>
                {summary?.activityCount ?? '—'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>This Week&apos;s Plan</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Run a check-in to generate this week&apos;s training plan.
                </Typography>
                <Button variant="outlined" onClick={() => router.push('/checkin')}>
                  Run Check-In
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
