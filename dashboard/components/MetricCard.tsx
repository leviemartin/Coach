'use client';

import { Card, CardContent, Typography } from '@mui/material';
import { metricCardSx, typography } from '@/lib/design-tokens';

interface MetricCardProps {
  label: string;
  children: React.ReactNode;
}

export default function MetricCard({ label, children }: MetricCardProps) {
  return (
    <Card sx={metricCardSx}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography sx={typography.categoryLabel}>{label}</Typography>
        {children}
      </CardContent>
    </Card>
  );
}
