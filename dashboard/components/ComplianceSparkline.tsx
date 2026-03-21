'use client';

import { Box, Typography } from '@mui/material';
import { SparkLineChart } from '@mui/x-charts/SparkLineChart';
import { useRouter } from 'next/navigation';

interface TrendPoint {
  week_number: number;
  compliance_pct: number;
  days_logged: number;
}

interface ComplianceSparklineProps {
  trend: TrendPoint[];
  currentWeek: number;
}

export default function ComplianceSparkline({ trend, currentWeek }: ComplianceSparklineProps) {
  const router = useRouter();

  if (trend.length === 0) return null;

  const chartData = trend.map((p) =>
    p.week_number === currentWeek && p.days_logged === 0 ? 0 : p.compliance_pct
  );

  return (
    <Box
      onClick={() => router.push('/trends')}
      sx={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 0.5 }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={500}>
          Weekly Compliance
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
          (tap for full view)
        </Typography>
      </Box>

      {/* Chart + labels */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <SparkLineChart
          data={chartData}
          width={120}
          height={40}
          curve="natural"
          area
        />

        {/* Week labels */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {trend.map((p) => {
            const isCurrent = p.week_number === currentWeek;
            const label = isCurrent && p.days_logged === 0
              ? `W${p.week_number}: --`
              : `W${p.week_number}: ${p.compliance_pct}%`;
            return (
              <Typography
                key={p.week_number}
                variant="caption"
                sx={{
                  color: isCurrent ? 'text.primary' : 'text.secondary',
                  fontWeight: isCurrent ? 700 : 400,
                  fontSize: '0.65rem',
                  lineHeight: 1.3,
                }}
              >
                {label}
              </Typography>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
