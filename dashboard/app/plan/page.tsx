'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Box,
  Alert,
  Card,
  CardHeader,
  CardContent,
  Chip,
  Collapse,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrainingPlanTable from '@/components/TrainingPlanTable';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import type { PlanItem, SubTask } from '@/lib/types';
import { PROGRAM_EPOCH } from '@/lib/week';

export default function PlanPage() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [synthesis, setSynthesis] = useState('');
  const [weekNumber, setWeekNumber] = useState<number | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPlan = useCallback(async () => {
    try {
      const res = await fetch('/api/plan/complete?action=list');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setWeekNumber(data.weekNumber ?? null);
      }
    } catch {
      // ignore
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
    } catch {
      // ignore
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

  const handleUpdateSubTasks = async (id: number, subTasks: SubTask[]) => {
    const allCompleted = subTasks.length > 0 && subTasks.every((st) => st.completed);

    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              subTasks,
              completed: allCompleted,
              completedAt: allCompleted ? new Date().toISOString() : null,
            }
          : item
      )
    );

    await fetch('/api/plan/complete', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, subTasks }),
    });
  };

  const handleUpdateNotes = async (id: number, notes: string) => {
    await fetch('/api/plan/complete', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, athleteNotes: notes }),
    });
  };

  // Compute Mon–Sun date range for the current week number
  const weekDateRange = weekNumber != null ? (() => {
    const MS_PER_DAY = 86_400_000;
    const epochLocal = new Date(PROGRAM_EPOCH.getFullYear(), PROGRAM_EPOCH.getMonth(), PROGRAM_EPOCH.getDate());
    const monday = new Date(epochLocal.getTime() + (weekNumber - 1) * 7 * MS_PER_DAY);
    const sunday = new Date(monday.getTime() + 6 * MS_PER_DAY);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(monday)}–${fmt(sunday)}`;
  })() : null;

  // Completion percentage
  const completionPct = items.length > 0
    ? Math.round((items.filter((i) => i.completed).length / items.length) * 100)
    : null;

  return (
    <Box>
      {/* Breadcrumb */}
      <Link href="/" style={{ textDecoration: 'none' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, '&:hover': { color: 'text.primary' } }}>
          ← Dashboard
        </Typography>
      </Link>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h3" fontWeight={700}>
            Week {weekNumber ?? '?'}{weekDateRange ? ` · ${weekDateRange}` : ''}
          </Typography>
          {completionPct != null && (
            <Chip
              label={`${completionPct}%`}
              size="small"
              color={completionPct === 100 ? 'success' : completionPct >= 50 ? 'primary' : 'default'}
              sx={{ fontWeight: 600 }}
            />
          )}
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
        <TrainingPlanTable
          items={items}
          onUpdateSubTasks={handleUpdateSubTasks}
          onUpdateNotes={handleUpdateNotes}
        />
      )}
    </Box>
  );
}
