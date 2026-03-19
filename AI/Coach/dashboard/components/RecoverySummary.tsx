'use client';

import { Box, Typography, Chip, Grid } from '@mui/material';

interface RecoverySummaryProps {
  avgHrv: number | null;
  bodyBatteryHigh: number | null;
  avgStress: number | null;
  acwr: number | null;
  acwrStatus: string | null;
  avgAerobicTE: number | null;
  avgAnaerobicTE: number | null;
  avgRhr: number | null;
}

function MetricRow({ label, value, unit, chipColor }: {
  label: string;
  value: string;
  unit?: string;
  chipColor?: 'success' | 'warning' | 'error' | 'default';
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      {chipColor ? (
        <Chip label={`${value}${unit || ''}`} size="small" color={chipColor} variant="outlined" sx={{ fontWeight: 600 }} />
      ) : (
        <Typography variant="body2" fontWeight={600}>{value}{unit || ''}</Typography>
      )}
    </Box>
  );
}

export default function RecoverySummary({
  avgHrv, bodyBatteryHigh, avgStress, acwr, acwrStatus,
  avgAerobicTE, avgAnaerobicTE, avgRhr,
}: RecoverySummaryProps) {
  const acwrColor = acwr == null ? 'default'
    : acwr >= 0.8 && acwr <= 1.3 ? 'success'
    : acwr <= 1.5 ? 'warning'
    : 'error';

  const bbColor = bodyBatteryHigh == null ? 'default'
    : bodyBatteryHigh >= 70 ? 'success'
    : bodyBatteryHigh >= 50 ? 'warning'
    : 'error';

  const anaerobicColor = avgAnaerobicTE == null ? 'default'
    : avgAnaerobicTE >= 1.0 ? 'success'
    : avgAnaerobicTE >= 0.5 ? 'warning'
    : 'error';

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 6 }}>
        {avgHrv != null && <MetricRow label="Avg HRV" value={String(avgHrv)} unit=" ms" />}
        {avgRhr != null && <MetricRow label="Avg RHR" value={String(avgRhr)} unit=" bpm" />}
        {bodyBatteryHigh != null && <MetricRow label="Body Battery High" value={String(bodyBatteryHigh)} chipColor={bbColor} />}
        {avgStress != null && <MetricRow label="Avg Stress" value={String(avgStress)} />}
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        {acwr != null && <MetricRow label="ACWR" value={String(acwr)} chipColor={acwrColor} />}
        {avgAerobicTE != null && <MetricRow label="Avg Aerobic TE" value={String(avgAerobicTE)} />}
        {avgAnaerobicTE != null && <MetricRow label="Avg Anaerobic TE" value={String(avgAnaerobicTE)} chipColor={anaerobicColor} />}
      </Grid>
    </Grid>
  );
}
