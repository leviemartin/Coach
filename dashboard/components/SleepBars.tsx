'use client';

import { Typography, Box } from '@mui/material';
import HeroCard from './HeroCard';
import { getSemanticColor, semanticColors, typography } from '@/lib/design-tokens';
import { getSleepBarColor } from '@/lib/dashboard-data';

interface SleepBarsProps {
  avgSleep: number | null;
  dailyScores: Array<{ day: string; score: number | null }>;
  sleepDelta: number | null;
}

export default function SleepBars({ avgSleep, dailyScores, sleepDelta }: SleepBarsProps) {
  const accentColor = avgSleep != null
    ? getSemanticColor(avgSleep, 75, 60)
    : semanticColors.recovery.caution;

  const maxScore = 100;
  const barH = 55; // max bar height in SVG units

  return (
    <HeroCard label="Avg Sleep" accentColor={accentColor}>
      <Typography sx={{ ...typography.primaryMetric, color: accentColor, lineHeight: 1.1, mt: 0.5 }}>
        {avgSleep ?? '—'}
      </Typography>
      {sleepDelta != null && (
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }}>
          This week · <Box component="span" sx={{ color: sleepDelta >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
            {sleepDelta >= 0 ? '▲' : '▼'} {Math.abs(sleepDelta)} vs last week
          </Box>
        </Typography>
      )}

      <svg viewBox="0 0 340 90" style={{ width: '100%', marginTop: 8 }}>
        {/* Threshold lines */}
        <line x1="0" y1={barH - (75 / maxScore) * barH + 10} x2="340" y2={barH - (75 / maxScore) * barH + 10}
          stroke={semanticColors.recovery.good} strokeWidth="0.5" strokeDasharray="4,4" opacity="0.5" />
        <line x1="0" y1={barH - (60 / maxScore) * barH + 10} x2="340" y2={barH - (60 / maxScore) * barH + 10}
          stroke={semanticColors.recovery.caution} strokeWidth="0.5" strokeDasharray="4,4" opacity="0.5" />

        {/* Bars */}
        {dailyScores.map((d, i) => {
          const barWidth = 32;
          const gap = (340 - 7 * barWidth) / 8;
          const x = gap + i * (barWidth + gap);
          const h = d.score != null ? (d.score / maxScore) * barH : 5;
          const y = barH - h + 10;
          const color = d.score != null ? getSleepBarColor(d.score) : 'currentColor';
          const opacity = d.score != null ? 0.8 : 0.3;

          return (
            <g key={d.day}>
              <rect x={x} y={y} width={barWidth} height={h} rx={0} fill={color} opacity={opacity} />
              {d.score != null && (
                <text x={x + barWidth / 2} y={y + 12} fontSize="8" fill="white" textAnchor="middle"
                  fontWeight="600" fontFamily="'JetBrains Mono', monospace">
                  {d.score}
                </text>
              )}
              <text x={x + barWidth / 2} y={80} fontSize="8" fill="#64748b" textAnchor="middle"
                fontFamily="'JetBrains Mono', monospace">
                {d.day}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
        {[
          { color: semanticColors.recovery.good, label: '>75' },
          { color: semanticColors.recovery.caution, label: '60-75' },
          { color: semanticColors.recovery.problem, label: '<60' },
        ].map(({ color, label }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, bgcolor: color }} />
            <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8' }}>{label}</Typography>
          </Box>
        ))}
      </Box>
    </HeroCard>
  );
}
