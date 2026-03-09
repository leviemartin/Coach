'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Typography, Box, Alert } from '@mui/material';
import TrainingPlanTable from '@/components/TrainingPlanTable';
import type { PlanItem } from '@/lib/types';

export default function PlanPage() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPlan = useCallback(async () => {
    try {
      const res = await fetch('/api/plan/complete?action=list');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

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
