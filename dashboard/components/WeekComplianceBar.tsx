'use client';

import { Box, Chip, Typography } from '@mui/material';
import { getComplianceColor } from '@/lib/daily-log';

interface MetricTally {
  label: string;
  current: number;
  target: number;
}

interface WeekComplianceBarProps {
  metrics: MetricTally[];
  overallPct: number;
}

export default function WeekComplianceBar({ metrics, overallPct }: WeekComplianceBarProps) {
  const pctColor =
    overallPct >= 80 ? 'success.main' : overallPct >= 50 ? 'warning.main' : 'error.main';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        borderTop: '1px solid',
        borderBottom: '1px solid',
        borderColor: 'divider',
        py: 1,
        px: 0.5,
      }}
    >
      {/* Per-metric chips */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {metrics.map((m) => (
          <Chip
            key={m.label}
            label={`${m.label} ${m.current}/${m.target}`}
            size="small"
            color={getComplianceColor(m.current, m.target)}
            variant="outlined"
          />
        ))}
      </Box>

      {/* Overall percentage */}
      <Typography
        variant="body1"
        fontWeight={700}
        sx={{ color: pctColor, flexShrink: 0 }}
      >
        {overallPct}%
      </Typography>
    </Box>
  );
}
