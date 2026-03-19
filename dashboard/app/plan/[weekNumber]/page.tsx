'use client';

import React, { useEffect, useState } from 'react';
import { Typography, Box, Alert } from '@mui/material';
import { useParams } from 'next/navigation';
import TrainingPlanTable from '@/components/TrainingPlanTable';
import type { PlanItem } from '@/lib/types';

export default function HistoricalPlanPage() {
  const params = useParams();
  const weekNumber = Number(params.weekNumber);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/plan/complete?action=list&week=${weekNumber}`)
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [weekNumber]);

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
        Week {weekNumber} Training Plan
      </Typography>

      {!loading && items.length === 0 ? (
        <Alert severity="info">No plan found for week {weekNumber}.</Alert>
      ) : (
        <TrainingPlanTable items={items} readOnly />
      )}
    </Box>
  );
}
