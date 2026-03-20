'use client';

import { Card, CardContent, Typography, Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { cardContentSx } from '@/lib/theme';
import { SparkLineChart } from '@mui/x-charts/SparkLineChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import StatusBadge from './StatusBadge';

interface SparklineCardProps {
  label: string;
  value: number | string | null;
  unit?: string;
  sparklineData?: number[];
  delta?: number | null;
  deltaLabel?: string;
  invertDelta?: boolean;
  target?: string;
  greenThreshold?: number;
  yellowThreshold?: number;
  invertBadge?: boolean;
  minHeight?: number;
}

function DeltaIndicator({ delta, invert = false, label }: { delta: number; invert?: boolean; label?: string }) {
  const isGood = invert ? delta < 0 : delta > 0;
  const isNeutral = delta === 0;
  const color = isNeutral ? 'text.secondary' : isGood ? 'success.main' : 'error.main';
  const Icon = delta > 0 ? TrendingUpIcon : delta < 0 ? TrendingDownIcon : TrendingFlatIcon;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Icon sx={{ fontSize: 16, color }} />
      <Typography variant="caption" sx={{ color, fontWeight: 600 }}>
        {delta > 0 ? '+' : ''}{delta}
      </Typography>
      {label && (
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      )}
    </Box>
  );
}

export default function SparklineCard({
  label,
  value,
  unit = '',
  sparklineData,
  delta,
  deltaLabel,
  invertDelta = false,
  target,
  greenThreshold,
  yellowThreshold,
  invertBadge,
  minHeight = 120,
}: SparklineCardProps) {
  const theme = useTheme();
  const displayValue = value != null ? `${value}${unit}` : '—';
  const hasSparkline = sparklineData && sparklineData.length >= 2;
  const numValue = typeof value === 'number' ? value : null;

  return (
    <Card sx={{ minHeight, display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ ...cardContentSx, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, letterSpacing: 0.3 }}>
          {label}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
          <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.1 }}>
            {displayValue}
          </Typography>
          {greenThreshold != null && yellowThreshold != null && numValue != null && (
            <StatusBadge
              value={numValue}
              greenThreshold={greenThreshold}
              yellowThreshold={yellowThreshold}
              invert={invertBadge}
              size="small"
            />
          )}
        </Box>

        {delta != null && (
          <DeltaIndicator delta={delta} invert={invertDelta} label={deltaLabel} />
        )}

        {hasSparkline && (
          <Box sx={{ mt: 'auto', pt: 1, mx: -1 }}>
            <SparkLineChart
              data={sparklineData}
              height={40}
              curve="natural"
              area
              color={theme.palette.secondary.main}
            />
          </Box>
        )}

        {target && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: hasSparkline ? 0 : 'auto' }}>
            {target}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
