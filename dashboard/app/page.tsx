'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography, Box, Button, Chip, IconButton, Tooltip,
  Alert, Grid,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import { useRouter } from 'next/navigation';
import PhaseTimeline from '@/components/PhaseTimeline';
import PhaseDetailStrip from '@/components/PhaseDetailStrip';
import RecoveryScore from '@/components/RecoveryScore';
import WeightJourney from '@/components/WeightJourney';
import SleepBars from '@/components/SleepBars';
import ComplianceRing from '@/components/ComplianceRing';
import TodayAction from '@/components/TodayAction';
import GarminSyncModal from '@/components/GarminSyncModal';
import HrvTrend from '@/components/HrvTrend';
import TrainingLoadFocus from '@/components/TrainingLoadFocus';
import AcwrCard from '@/components/AcwrCard';
import { getTrainingWeek } from '@/lib/week';
import { typography, borders } from '@/lib/design-tokens';
import type { PhaseInfo } from '@/components/PhaseTimeline';
import type { PlanItem, DashboardPayload } from '@/lib/types';

interface PeriodizationResponse {
  phases: PhaseInfo[];
  currentPhase: PhaseInfo;
  currentWeek: number;
  targets: { raceWeight: string; stretchWeight: string; protein: string; calories: string };
}

export default function DashboardHome() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [periodization, setPeriodization] = useState<PeriodizationResponse | null>(null);
  const [planItems, setPlanItems] = useState<PlanItem[] | null>(null);
  const [selectedPhase, setSelectedPhase] = useState(1);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSunday = new Date().getDay() === 0;

  const refreshSummary = useCallback(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((data) => setDashboard(data))
      .catch((err: Error) => setError(err.message || 'Failed to load dashboard data'));
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
    fetch('/api/periodization').then(r => r.json()).then(setPeriodization).catch((err: Error) => setError(err.message || 'Failed to load periodization'));
  }, [refreshSummary, loadPlan]);

  useEffect(() => {
    if (periodization) setSelectedPhase(periodization.currentPhase.number);
  }, [periodization]);

  const selectedPhaseData = periodization?.phases.find(p => p.number === selectedPhase);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <Typography variant="h3">Dashboard</Typography>
        <Chip
          label={`Week ${getTrainingWeek()}`}
          size="small"
          sx={{ border: `1px solid ${borders.hard}`, bgcolor: 'transparent' }}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={() => router.push('/log')}
          sx={{ ml: 'auto', borderWidth: 2, '&:hover': { borderWidth: 2 } }}
        >
          Today&apos;s Log
        </Button>
        <Tooltip title="Sync Garmin data">
          <IconButton
            onClick={() => setSyncModalOpen(true)}
            size="small"
            sx={{ borderRadius: 0, border: `2px solid ${borders.hard}`, width: 36, height: 36 }}
          >
            <SyncIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Sunday reminder */}
      {isSunday && (
        <Box sx={{ mb: 4, p: 3, bgcolor: borders.hard, color: '#fafaf7', border: `3px solid ${borders.hard}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Typography sx={{
              fontFamily: '"Libre Franklin", sans-serif',
              fontWeight: 900,
              fontSize: '1rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              It&apos;s Sunday. Time for your check-in.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => router.push('/checkin')}
              sx={{ bgcolor: '#fafaf7', color: borders.hard, '&:hover': { bgcolor: '#e4e4e0' } }}
            >
              Start Check-In
            </Button>
          </Box>
        </Box>
      )}

      {error && (
        <Alert
          severity="error"
          action={<Button onClick={() => { setError(null); refreshSummary(); loadPlan(); }}>Retry</Button>}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}

      {/* THE GLANCE */}
      <Typography sx={{ ...typography.categoryLabel, mb: 1 }}>THE GLANCE</Typography>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <RecoveryScore
            score={dashboard?.recoveryScore ?? null}
            directive={dashboard?.recoveryDirective ?? 'Loading...'}
            color={dashboard?.recoveryColor ?? 'grey'}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <WeightJourney
            currentWeight={dashboard?.weight ?? null}
            weightFromStart={dashboard?.weightFromStart ?? null}
            weightHistory={dashboard?.weightHistory ?? []}
            phaseTargets={dashboard?.phaseTargets ?? []}
            currentWeek={dashboard?.currentWeek ?? getTrainingWeek()}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SleepBars
            avgSleep={dashboard?.avgSleep ?? null}
            dailyScores={dashboard?.dailySleepScores ?? []}
            sleepDelta={dashboard?.sleepDelta ?? null}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <ComplianceRing
            compliancePct={dashboard?.compliancePct ?? null}
            vampireDays={dashboard?.vampireDays ?? 0}
            rugDays={dashboard?.rugDays ?? 0}
            hydrationDays={dashboard?.hydrationDays ?? 0}
          />
        </Grid>
      </Grid>

      {/* TODAY'S SESSION */}
      <Box sx={{ mb: 3 }}>
        <TodayAction items={planItems} />
      </Box>

      {/* BODY & PERFORMANCE */}
      <Typography sx={{ ...typography.categoryLabel, mb: 1 }}>BODY &amp; PERFORMANCE</Typography>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <HrvTrend
            avgHrv={dashboard?.avgHrv ?? null}
            hrvBaseline={dashboard?.hrvBaseline ?? null}
            hrvDelta={dashboard?.hrvDelta ?? null}
            dailyHrv28d={dashboard?.dailyHrv28d ?? []}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TrainingLoadFocus
            loadFocus={dashboard?.loadFocus ?? null}
            hrZones={dashboard?.hrZones ?? null}
            enduranceScore={dashboard?.enduranceScore ?? null}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <AcwrCard
            acwr={dashboard?.acwr ?? null}
            acwrStatus={dashboard?.acwrStatus ?? null}
            bodyBatteryHigh={dashboard?.bodyBatteryHigh ?? null}
          />
        </Grid>
      </Grid>

      {/* PROGRAM TIMELINE */}
      <Typography sx={{ ...typography.categoryLabel, mb: 1 }}>PROGRAM TIMELINE</Typography>
      <Box sx={{ mb: 3 }}>
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
            currentWeight={dashboard?.weight ?? null}
            isCurrentPhase={selectedPhase === periodization?.currentPhase.number}
          />
        )}
      </Box>

      <GarminSyncModal open={syncModalOpen} onClose={() => setSyncModalOpen(false)} />
    </Box>
  );
}
