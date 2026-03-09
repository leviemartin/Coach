'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Box,
  Alert,
  Card,
  CardHeader,
  CardContent,
  Collapse,
  IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TrainingPlanTable from '@/components/TrainingPlanTable';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import type { PlanItem } from '@/lib/types';

export default function PlanPage() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [synthesis, setSynthesis] = useState('');
  const [weekNumber, setWeekNumber] = useState<number | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);

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

  const handleToggle = async (id: number, completed: boolean) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed, completedAt: completed ? new Date().toISOString() : null } : item
      )
    );

    await fetch('/api/plan/complete', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, completed }),
    });
  };

  const handleUpdateNotes = async (id: number, notes: string) => {
    await fetch('/api/plan/complete', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, athleteNotes: notes }),
    });
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
        Training Plan
      </Typography>

      {synthesis && (
        <Card variant="outlined" sx={{ mb: 3 }}>
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
          onToggleComplete={handleToggle}
          onUpdateNotes={handleUpdateNotes}
        />
      )}
    </Box>
  );
}
