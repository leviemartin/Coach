'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Typography, Card, CardContent, Grid, Box, Button, Chip, IconButton, Tooltip, Snackbar, Alert } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import PhaseTimeline from '@/components/PhaseTimeline';
import MacroOverview from '@/components/MacroOverview';
import { getTrainingWeek } from '@/lib/week';
import type { Race } from '@/lib/types';

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

interface GarminSummary {
  avgSleep: number | null;
  avgReadiness: number | null;
  weight: number | null;
  activityCount: number;
}

export default function DashboardHome() {
  const router = useRouter();
  const [summary, setSummary] = useState<GarminSummary | null>(null);
  const [periodization, setPeriodization] = useState<PeriodizationResponse | null>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const syncAbortRef = useRef<AbortController | null>(null);

  const isSunday = new Date().getDay() === 0;

  const refreshSummary = useCallback(() => {
    fetch('/api/garmin')
      .then((r) => r.json())
      .then((data) => setSummary(data.summary))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshSummary();
    fetch('/api/periodization').then(r => r.json()).then(setPeriodization).catch(() => {});
    fetch('/api/races').then(r => r.json()).then(d => setRaces(d.races || [])).catch(() => {});
  }, [refreshSummary]);

  useEffect(() => {
    return () => { syncAbortRef.current?.abort(); };
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    const controller = new AbortController();
    syncAbortRef.current = controller;
    try {
      const res = await fetch('/api/garmin/sync', { method: 'POST', signal: controller.signal });
      const data = await res.json();
      if (data.success) {
        refreshSummary();
        setSyncResult({ type: 'success', message: 'Garmin data synced' });
      } else {
        setSyncResult({ type: 'error', message: data.error || 'Sync failed' });
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setSyncResult({ type: 'error', message: 'Could not reach sync endpoint' });
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Typography variant="h4" fontWeight={700}>
          Dashboard
        </Typography>
        <Chip label={periodization ? `Phase ${periodization.currentPhase.number}: ${periodization.currentPhase.name}` : 'Phase 1: The Reconstruction'} color="primary" />
        <Chip label={`Week ${getTrainingWeek()}`} variant="outlined" />
        <Tooltip title={syncing ? 'Syncing...' : 'Sync Garmin data'}>
          <IconButton onClick={handleSync} disabled={syncing} size="small">
            <SyncIcon sx={{
              animation: syncing ? 'spin 1s linear infinite' : 'none',
              '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
            }} />
          </IconButton>
        </Tooltip>
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

      {periodization && <PhaseTimeline phases={periodization.phases} currentPhaseNumber={periodization.currentPhase.number} />}

      <MacroOverview periodization={periodization} races={races} currentWeight={summary?.weight ?? null} />

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

      <Snackbar
        open={syncResult !== null}
        autoHideDuration={4000}
        onClose={() => setSyncResult(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={syncResult?.type === 'success' ? 'success' : 'error'}
          onClose={() => setSyncResult(null)}
          variant="filled"
        >
          {syncResult?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
