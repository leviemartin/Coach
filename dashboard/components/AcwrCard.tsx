'use client';

import { Typography, Box, Chip } from '@mui/material';
import MetricCard from './MetricCard';
import { semanticColors, typography } from '@/lib/design-tokens';

interface AcwrCardProps {
  acwr: number | null;
  acwrStatus: string | null;
  bodyBatteryHigh: number | null;
}

export default function AcwrCard({ acwr, acwrStatus, bodyBatteryHigh }: AcwrCardProps) {
  const acwrColor = acwr == null ? '#94a3b8'
    : acwr >= 0.8 && acwr <= 1.3 ? semanticColors.recovery.good
    : acwr <= 1.5 ? semanticColors.recovery.caution
    : semanticColors.recovery.problem;

  const acwrLabel = acwr == null ? 'No data'
    : acwr >= 0.8 && acwr <= 1.3 ? 'OPTIMAL'
    : acwr <= 1.5 ? 'CAUTION'
    : 'HIGH';

  const bbColor = bodyBatteryHigh == null ? '#94a3b8'
    : bodyBatteryHigh >= 70 ? semanticColors.recovery.good
    : bodyBatteryHigh >= 50 ? semanticColors.recovery.caution
    : semanticColors.recovery.problem;

  return (
    <MetricCard label="Training Load">
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
        <Typography sx={typography.metricValue}>{acwr ?? '—'}</Typography>
        <Chip
          label={acwrLabel}
          size="small"
          sx={{ bgcolor: `${acwrColor}20`, color: acwrColor, fontWeight: 700, fontSize: '0.6875rem' }}
        />
      </Box>
      <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
        ACWR sweet spot (0.8–1.3)
      </Typography>

      {bodyBatteryHigh != null && (
        <Box sx={{ mt: 1.5 }}>
          <Typography sx={{ fontSize: '0.6875rem', color: '#64748b' }}>Body Battery High</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700 }}>{bodyBatteryHigh}</Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: bbColor, fontWeight: 600 }}>
              {bodyBatteryHigh >= 70 ? 'Green zone' : bodyBatteryHigh >= 50 ? 'Yellow zone' : 'Red zone'}
            </Typography>
          </Box>
        </Box>
      )}
    </MetricCard>
  );
}
