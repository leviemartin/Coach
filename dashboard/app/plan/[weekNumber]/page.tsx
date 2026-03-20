'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Typography, Box, Alert, Button } from '@mui/material';
import { useParams } from 'next/navigation';
import TrainingPlanTable from '@/components/TrainingPlanTable';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import type { PlanItem } from '@/lib/types';

export default function HistoricalPlanPage() {
  const params = useParams();
  const weekNumber = Number(params.weekNumber);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/plan?week=${weekNumber}`)
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .catch((err: Error) => setError(err.message || 'Failed to load plan'))
      .finally(() => setLoading(false));
  }, [weekNumber]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <Box>
      <PageBreadcrumb items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Training Plan', href: '/plan' },
        { label: `Week ${weekNumber}` },
      ]} />

      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
        Week {weekNumber} Training Plan
      </Typography>

      {error && (
        <Alert
          severity="error"
          action={<Button onClick={() => { setError(null); loadData(); }}>Retry</Button>}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}

      {!loading && items.length === 0 ? (
        <Alert severity="info">No plan found for week {weekNumber}.</Alert>
      ) : (
        <TrainingPlanTable items={items} />
      )}
    </Box>
  );
}
