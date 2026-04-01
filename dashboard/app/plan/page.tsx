'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Alert,
  Button,
  Card,
  CardHeader,
  CardContent,
  Collapse,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlanDayCard from '@/components/plan/PlanDayCard';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import type { PlanItem, PlanExercise } from '@/lib/types';
import { PROGRAM_EPOCH } from '@/lib/week';

export default function PlanPage() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [exercises, setExercises] = useState<Record<number, PlanExercise[]>>({});
  const [loading, setLoading] = useState(true);
  const [synthesis, setSynthesis] = useState('');
  const [weekNumber, setWeekNumber] = useState<number | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    try {
      const res = await fetch('/api/plan');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setExercises(data.exercises || {});
        setWeekNumber(data.weekNumber ?? null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load training plan');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBriefing = useCallback(async () => {
    try {
      const res = await fetch('/api/plan/briefing');
      if (res.ok) {
        const data = await res.json();
        setSynthesis(data.synthesis || '');
        if (data.weekNumber) setWeekNumber(data.weekNumber);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load briefing');
    }
  }, []);

  useEffect(() => {
    loadPlan();
    loadBriefing();
  }, [loadPlan, loadBriefing]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadPlan(), loadBriefing()]);
    setRefreshing(false);
  }, [loadPlan, loadBriefing]);

  // Compute Mon–Sun date range for the current week number
  const weekDateRange = weekNumber != null ? (() => {
    const MS_PER_DAY = 86_400_000;
    const epochLocal = new Date(PROGRAM_EPOCH.getFullYear(), PROGRAM_EPOCH.getMonth(), PROGRAM_EPOCH.getDate());
    const monday = new Date(epochLocal.getTime() + (weekNumber - 1) * 7 * MS_PER_DAY);
    const sunday = new Date(monday.getTime() + 6 * MS_PER_DAY);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(monday)}–${fmt(sunday)}`;
  })() : null;

  return (
    <Box>
      <PageBreadcrumb items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Training Plan' },
      ]} />

      {error && (
        <Alert
          severity="error"
          action={<Button onClick={() => { setError(null); loadPlan(); loadBriefing(); }}>Retry</Button>}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h3" fontWeight={700}>
            Week {weekNumber ?? '?'}{weekDateRange ? ` · ${weekDateRange}` : ''}
          </Typography>
        </Box>
        <Tooltip title="Reload plan data">
          <IconButton onClick={handleRefresh} disabled={refreshing} size="small">
            <RefreshIcon sx={{
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
              '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
            }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: -2, mb: 3 }}>
        Full plan also available in Daily Log → Week Overview.
      </Typography>

      {synthesis && (
        <Card sx={{ mb: 3 }}>
          <CardHeader
            title={`Coach Briefing — Week ${weekNumber ?? '?'}`}
            titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
            action={
              <IconButton
                onClick={() => setBriefingOpen((prev) => !prev)}
                aria-label={briefingOpen ? 'Collapse briefing' : 'Expand briefing'}
                sx={{
                  transform: briefingOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              >
                <ExpandMoreIcon />
              </IconButton>
            }
            sx={{ cursor: 'pointer' }}
            onClick={() => setBriefingOpen((prev) => !prev)}
          />
          <Collapse in={briefingOpen} timeout="auto" unmountOnExit>
            <CardContent sx={{ pt: 0 }}>
              <MarkdownRenderer content={synthesis} />
            </CardContent>
          </Collapse>
        </Card>
      )}

      {!loading && items.length === 0 ? (
        <Alert severity="info">
          No training plan for the current week. Run a check-in to generate one.
        </Alert>
      ) : (
        items.map((item) => (
          <PlanDayCard
            key={item.id ?? item.dayOrder}
            item={item}
            exercises={exercises[item.id!] ?? []}
            status={item.status === 'completed' ? 'completed' : item.status === 'skipped' ? 'skipped' : 'published'}
            defaultExpanded={false}
            onStartSession={() => {
              window.location.href = `/session?planItemId=${item.id}`;
            }}
          />
        ))
      )}
    </Box>
  );
}
