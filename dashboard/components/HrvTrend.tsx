'use client';

import { Typography, Box } from '@mui/material';
import MetricCard from './MetricCard';
import { semanticColors, typography } from '@/lib/design-tokens';
import type { SparklinePoint } from '@/lib/types';

interface HrvTrendProps {
  avgHrv: number | null;
  hrvBaseline: number | null;
  hrvDelta: number | null;
  dailyHrv28d: SparklinePoint[];
}

export default function HrvTrend({ avgHrv, hrvBaseline, hrvDelta, dailyHrv28d }: HrvTrendProps) {
  const hasData = dailyHrv28d.length >= 2;
  const values = dailyHrv28d.map((d) => d.value);
  const yMin = Math.min(...values, (hrvBaseline ?? 30) - 10) - 2;
  const yMax = Math.max(...values, (hrvBaseline ?? 50) + 10) + 2;

  const w = 300;
  const h = 80;
  const toX = (i: number) => 5 + (i / Math.max(dailyHrv28d.length - 1, 1)) * (w - 10);
  const toY = (v: number) => 5 + ((yMax - v) / (yMax - yMin)) * (h - 20);

  const linePoints = dailyHrv28d.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ');

  const bandTop = hrvBaseline != null ? toY(hrvBaseline + 5) : 0;
  const bandBottom = hrvBaseline != null ? toY(hrvBaseline - 5) : h;

  const deltaColor = hrvDelta != null && hrvDelta >= 0
    ? semanticColors.recovery.good
    : semanticColors.recovery.problem;

  return (
    <MetricCard label="HRV">
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mt: 0.5 }}>
        <Typography sx={{ ...typography.metricValue }}>{avgHrv ?? '—'}</Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>ms</Typography>
        {hrvDelta != null && (
          <Typography sx={{ fontSize: '0.75rem', color: deltaColor, fontWeight: 600, ml: 0.5 }}>
            {hrvDelta >= 0 ? '↑' : '↓'} {Math.abs(hrvDelta)}ms vs baseline
          </Typography>
        )}
      </Box>

      {hasData && (
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', marginTop: 8 }}>
          {hrvBaseline != null && (
            <rect x="0" y={bandTop} width={w} height={bandBottom - bandTop}
              fill={semanticColors.body} opacity="0.08" />
          )}
          <polyline points={linePoints} fill="none" stroke={semanticColors.body}
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {dailyHrv28d.length > 0 && (
            <circle
              cx={toX(dailyHrv28d.length - 1)}
              cy={toY(dailyHrv28d[dailyHrv28d.length - 1].value)}
              r="3.5" fill={semanticColors.body} stroke="white" strokeWidth="1.5"
            />
          )}
        </svg>
      )}
    </MetricCard>
  );
}
