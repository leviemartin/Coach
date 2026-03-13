'use client';

import React, { useEffect, useState } from 'react';
import { Typography, Box, Button, Alert, CircularProgress } from '@mui/material';
import TrendCharts from '@/components/TrendCharts';
import type { WeeklyMetrics, CeilingEntry, DexaScan } from '@/lib/types';

export default function TrendsPage() {
  const [metrics, setMetrics] = useState<WeeklyMetrics[]>([]);
  const [ceilings, setCeilings] = useState<CeilingEntry[]>([]);
  const [dexaScans, setDexaScans] = useState<DexaScan[]>([]);
  const [exercises, setExercises] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);

  const fetchTrends = async (exercise?: string) => {
    try {
      const url = exercise ? `/api/trends?exercise=${exercise}` : '/api/trends';
      const res = await fetch(url);
      const data = await res.json();
      setMetrics(data.metrics || []);
      setCeilings(data.ceilings || []);
      if (!exercise) {
        setDexaScans(data.dexaScans || []);
      }

      // Extract unique exercises from ceilings
      if (!exercise) {
        const uniqueExercises = Array.from(new Set((data.ceilings || []).map((c: CeilingEntry) => c.exercise))) as string[];
        setExercises(uniqueExercises);
        if (uniqueExercises.length > 0 && !selectedExercise) {
          setSelectedExercise(uniqueExercises[0]);
        }
      }
    } catch {
      // ignore
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
    } catch {
      // ignore
    } finally {
      setRebuilding(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
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

      {metrics.length === 0 ? (
        <Alert severity="info">
          No trend data yet. Complete your first check-in to start tracking.
        </Alert>
      ) : (
        <TrendCharts
          metrics={metrics}
          ceilings={ceilings}
          dexaScans={dexaScans}
          exercises={exercises}
          selectedExercise={selectedExercise}
          onExerciseChange={handleExerciseChange}
        />
      )}
    </Box>
  );
}
