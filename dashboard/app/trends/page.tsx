'use client';

import React, { useEffect, useState } from 'react';
import { Typography, Box, Button, Alert } from '@mui/material';
import TrendCharts from '@/components/TrendCharts';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageSkeleton from '@/components/PageSkeleton';
import type { WeeklyMetrics, CeilingEntry, DexaScan } from '@/lib/types';

export default function TrendsPage() {
  const [metrics, setMetrics] = useState<WeeklyMetrics[]>([]);
  const [ceilings, setCeilings] = useState<CeilingEntry[]>([]);
  const [dexaScans, setDexaScans] = useState<DexaScan[]>([]);
  const [exercises, setExercises] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [complianceTrend, setComplianceTrend] = useState<Array<{ week_number: number; compliance_pct: number; days_logged: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = async (exercise?: string) => {
    try {
      const url = exercise ? `/api/trends?exercise=${exercise}` : '/api/trends';
      const [res, complianceRes] = await Promise.all([
        fetch(url),
        exercise ? Promise.resolve(null) : fetch('/api/log/compliance-trend?weeks=52'),
      ]);
      const data = await res.json();
      setMetrics(data.metrics || []);
      setCeilings(data.ceilings || []);
      if (!exercise) {
        setDexaScans(data.dexaScans || []);
      }

      if (!exercise && complianceRes) {
        const complianceData = await complianceRes.json();
        setComplianceTrend(complianceData.trend || []);
      }

      // Extract unique exercises from ceilings
      if (!exercise) {
        const uniqueExercises = Array.from(new Set((data.ceilings || []).map((c: CeilingEntry) => c.exercise))) as string[];
        setExercises(uniqueExercises);
        if (uniqueExercises.length > 0 && !selectedExercise) {
          setSelectedExercise(uniqueExercises[0]);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load trend data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, []);

  const handleExerciseChange = (exercise: string) => {
    setSelectedExercise(exercise);
    fetchTrends(exercise);
  };

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      await fetch('/api/trends', { method: 'POST' });
      await fetchTrends(selectedExercise);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to rebuild trends');
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <Box>
      <PageBreadcrumb items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Trends' },
      ]} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <Typography variant="h3" fontWeight={700}>
          Trends
        </Typography>
        <Button
          variant="outlined"
          onClick={handleRebuild}
          disabled={rebuilding}
        >
          {rebuilding ? 'Rebuilding...' : 'Rebuild from Logs'}
        </Button>
      </Box>

      {error && (
        <Alert
          severity="error"
          action={<Button onClick={() => { setError(null); fetchTrends(); }}>Retry</Button>}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}

      {loading && !error && <PageSkeleton variant="charts" />}

      {!loading && metrics.length === 0 ? (
        <Alert severity="info">
          No trend data yet. Complete your first check-in to start tracking.
        </Alert>
      ) : !loading ? (
        <TrendCharts
          metrics={metrics}
          ceilings={ceilings}
          dexaScans={dexaScans}
          exercises={exercises}
          selectedExercise={selectedExercise}
          onExerciseChange={handleExerciseChange}
          complianceTrend={complianceTrend}
        />
      ) : null}
    </Box>
  );
}
