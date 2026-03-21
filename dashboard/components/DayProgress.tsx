'use client';

import { Box, Typography } from '@mui/material';

interface DayProgressProps {
  checked: number;
  total: number;
  streak: { current: number; best: number };
}

export default function DayProgress({ checked, total, streak }: DayProgressProps) {
  const size = 80;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? checked / total : 0;
  const offset = circumference * (1 - pct);
  const isComplete = pct >= 1;
  const arcColor = isComplete ? '#22c55e' : '#3b82f6';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {/* Progress ring */}
      <Box sx={{ flexShrink: 0, position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ display: 'block' }}>
          {isComplete && (
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
          )}
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arcColor}
            strokeWidth={strokeWidth}
            opacity={0.12}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arcColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            filter={isComplete ? 'url(#glow)' : undefined}
            style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.4s ease' }}
          />
          {/* Center text */}
          <text
            x="50%"
            y="50%"
            dominantBaseline="central"
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fill="currentColor"
          >
            {checked}/{total}
          </text>
        </svg>
      </Box>

      {/* Streak info */}
      <Box>
        {streak.current > 0 ? (
          <Typography
            variant="body2"
            fontWeight={700}
            sx={{ color: '#f97316', lineHeight: 1.3 }}
          >
            {streak.current} day streak
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.3 }}>
            No active streak
          </Typography>
        )}
        {streak.best > 0 && (
          <Typography variant="caption" color="text.secondary">
            Best: {streak.best} days
          </Typography>
        )}
      </Box>
    </Box>
  );
}
