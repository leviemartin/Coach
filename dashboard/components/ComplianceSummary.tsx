'use client';

import { Box, Typography, LinearProgress, Chip } from '@mui/material';

interface ComplianceSummaryProps {
  vampirePct: number | null;
  rugDays: number | null;
  hydrationTracked: boolean;
  bedtimeCompliance: number | null;
}

function ComplianceBar({ label, value, max, unit = '%' }: { label: string; value: number; max: number; unit?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct >= 70 ? 'success' : pct >= 40 ? 'warning' : 'error';

  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" fontWeight={500}>{label}</Typography>
        <Typography variant="body2" fontWeight={600} color={`${color}.main`}>
          {unit === '%' ? `${Math.round(value)}%` : `${value}/${max}`}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        color={color}
        sx={{ height: 6 }}
      />
    </Box>
  );
}

export default function ComplianceSummary({
  vampirePct,
  rugDays,
  hydrationTracked,
  bedtimeCompliance,
}: ComplianceSummaryProps) {
  return (
    <Box>
      {vampirePct != null && (
        <ComplianceBar label="Vampire Protocol" value={vampirePct} max={100} />
      )}
      {bedtimeCompliance != null && (
        <ComplianceBar label="Bedtime < 23:00" value={bedtimeCompliance} max={7} unit="days" />
      )}
      {rugDays != null && (
        <ComplianceBar label="Rug Protocol" value={rugDays} max={7} unit="days" />
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
        <Typography variant="body2" fontWeight={500}>Hydration Tracking</Typography>
        <Chip
          label={hydrationTracked ? 'Yes' : 'No'}
          size="small"
          color={hydrationTracked ? 'success' : 'error'}
          variant="outlined"
        />
      </Box>
    </Box>
  );
}
