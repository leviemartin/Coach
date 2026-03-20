'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Typography, Box, Button, Chip, IconButton, Tooltip,
  Snackbar, Alert, Grid,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import { useRouter } from 'next/navigation';
import PhaseTimeline from '@/components/PhaseTimeline';
import PhaseDetailStrip from '@/components/PhaseDetailStrip';
import SparklineCard from '@/components/SparklineCard';
import TodaySession from '@/components/TodaySession';
import DashboardSection from '@/components/DashboardSection';
import RecoverySummary from '@/components/RecoverySummary';
import PrioritiesList from '@/components/PrioritiesList';
import { getTrainingWeek } from '@/lib/week';
import type { PhaseInfo } from '@/components/PhaseTimeline';
import type { PlanItem, ExtendedGarminSummary } from '@/lib/types';

interface PeriodizationResponse {
  phases: PhaseInfo[];
  currentPhase: PhaseInfo;
  currentWeek: number;
  targets: { raceWeight: string; stretchWeight: string; protein: string; calories: string };
}

function getProteinForWeight(weight: number | null): string {
  if (!weight) return '180g';
  if (weight >= 95) return '180g';
  if (weight >= 92) return '190g';
  return '200g';
}

export default function DashboardHome() {
  const router = useRouter();
  const [summary, setSummary] = useState<ExtendedGarminSummary | null>(null);
  const [periodization, setPeriodization] = useState<PeriodizationResponse | null>(null);
  const [planItems, setPlanItems] = useState<PlanItem[] | null>(null);
  const [selectedPhase, setSelectedPhase] = useState(1);
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

  const loadPlan = useCallback(async () => {
    try {
      const res = await fetch('/api/plan');
      if (res.ok) {
        const data = await res.json();
        setPlanItems(data.items || []);
      } else {
        setPlanItems([]);
      }
    } catch {
      setPlanItems([]);
    }
  }, []);

  useEffect(() => {
    refreshSummary();
    loadPlan();
    fetch('/api/periodization').then(r => r.json()).then(setPeriodization).catch(() => {});
  }, [refreshSummary, loadPlan]);

  useEffect(() => {
    if (periodization) setSelectedPhase(periodization.currentPhase.number);
  }, [periodization]);

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

  const selectedPhaseData = periodization?.phases.find(p => p.number === selectedPhase);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <Typography variant="h3">Dashboard</Typography>
        <Chip label={`Week ${getTrainingWeek()}`} size="small" />
        <Tooltip title={syncing ? 'Syncing...' : 'Sync Garmin data'}>
          <IconButton onClick={handleSync} disabled={syncing} size="small">
            <SyncIcon sx={{
              animation: syncing ? 'spin 1s linear infinite' : 'none',
              '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
            }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Sunday reminder */}
      {isSunday && (
        <Box sx={{ mb: 4, p: 3, bgcolor: 'secondary.main', color: 'secondary.contrastText', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">It&apos;s Sunday. Time for your check-in.</Typography>
            <Button variant="contained" size="large" onClick={() => router.push('/checkin')}
              sx={{ bgcolor: 'white', color: 'secondary.main', '&:hover': { bgcolor: 'grey.100' } }}>
              Start Check-In
            </Button>
          </Box>
        </Box>
      )}

      {/* Phase Timeline */}
      {periodization && (
        <PhaseTimeline
          phases={periodization.phases}
          currentPhaseNumber={periodization.currentPhase.number}
          selectedPhase={selectedPhase}
          onPhaseSelect={setSelectedPhase}
        />
      )}
      {selectedPhaseData && (
        <PhaseDetailStrip
          phase={selectedPhaseData}
          currentWeight={summary?.weight ?? null}
          isCurrentPhase={selectedPhase === periodization?.currentPhase.number}
        />
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Program: 89kg race weight · {getProteinForWeight(summary?.weight ?? null)}/day · 2,350 kcal
      </Typography>

      {/* Today's Session — one-liner */}
      <TodaySession items={planItems} />

      {/* Sparkline Metric Cards — 3 per row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <SparklineCard
            label="Weight"
            value={summary?.weight ?? null}
            unit="kg"
            sparklineData={summary?.dailyWeight.map(d => d.value)}
            delta={summary?.weightDelta}
            invertDelta
            target="Target: 89kg"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <SparklineCard
            label="Avg Sleep"
            value={summary?.avgSleep ?? null}
            sparklineData={summary?.dailySleep.map(d => d.value)}
            greenThreshold={75}
            yellowThreshold={60}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <SparklineCard
            label="Avg Readiness"
            value={summary?.avgReadiness ?? null}
            sparklineData={summary?.dailyReadiness.map(d => d.value)}
            greenThreshold={50}
            yellowThreshold={30}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <SparklineCard
            label="HRV"
            value={summary?.avgHrv ?? null}
            unit=" ms"
            sparklineData={summary?.dailyHrv.map(d => d.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <SparklineCard
            label="Body Battery"
            value={summary?.bodyBatteryHigh ?? null}
            sparklineData={summary?.dailyBodyBattery.map(d => d.value)}
            greenThreshold={70}
            yellowThreshold={50}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <SparklineCard
            label="Activities"
            value={summary?.activityCount ?? null}
          />
        </Grid>
      </Grid>

      {/* Body & Recovery */}
      <DashboardSection
        title="Body & Recovery"
        icon={<MonitorHeartIcon />}
        summary={
          <Box sx={{ display: 'flex', gap: 1 }}>
            {summary?.acwr != null && (
              <Chip
                label={`ACWR ${summary.acwr}`}
                size="small"
                color={summary.acwr >= 0.8 && summary.acwr <= 1.3 ? 'success' : summary.acwr <= 1.5 ? 'warning' : 'error'}
              />
            )}
            {summary?.avgHrv != null && (
              <Chip label={`HRV ${summary.avgHrv}`} size="small" />
            )}
          </Box>
        }
      >
        <RecoverySummary
          avgHrv={summary?.avgHrv ?? null}
          bodyBatteryHigh={summary?.bodyBatteryHigh ?? null}
          avgStress={summary?.avgStress ?? null}
          acwr={summary?.acwr ?? null}
          acwrStatus={summary?.acwrStatus ?? null}
          avgAerobicTE={summary?.avgAerobicTE ?? null}
          avgAnaerobicTE={summary?.avgAnaerobicTE ?? null}
          avgRhr={summary?.avgRhr ?? null}
        />
      </DashboardSection>

      {/* Coaching Priorities */}
      <DashboardSection
        title="Coaching Priorities"
        icon={<PriorityHighIcon />}
        summary={<Chip label="#1 Sleep · #2 Pull-ups" size="small" />}
      >
        <PrioritiesList />
      </DashboardSection>

      <Snackbar open={syncResult !== null} autoHideDuration={4000} onClose={() => setSyncResult(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={syncResult?.type === 'success' ? 'success' : 'error'} onClose={() => setSyncResult(null)} variant="filled">
          {syncResult?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
