'use client';

import { Typography, Box } from '@mui/material';
import HeroCard from './HeroCard';
import { cardAccents, semanticColors, typography } from '@/lib/design-tokens';
import type { WeightHistoryPoint } from '@/lib/types';

interface WeightJourneyProps {
  currentWeight: number | null;
  weightFromStart: number | null;
  weightHistory: WeightHistoryPoint[];
  phaseTargets: Array<{ phaseNumber: number; name: string; targetWeightKg: number }>;
  currentWeek: number;
}

export default function WeightJourney({
  currentWeight,
  weightFromStart,
  weightHistory,
  phaseTargets,
  currentWeek,
}: WeightJourneyProps) {
  const hasHistory = weightHistory.length >= 2;

  // SVG dimensions
  const width = 340;
  const height = 120;
  const padTop = 10;
  const padBottom = 20;
  const padLeft = 24;
  const padRight = 10;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // Derive current phase target from currentWeek
  const phaseBoundariesLookup = [1, 14, 27, 45, 58, 71, 79];
  const currentPhaseIdx = phaseBoundariesLookup.findIndex((b, i) =>
    currentWeek >= b && currentWeek < (phaseBoundariesLookup[i + 1] ?? 999));
  const currentPhaseTarget = phaseTargets[currentPhaseIdx]?.targetWeightKg ?? 89;

  // Y-axis range: from max weight to lowest target, with some padding
  const allWeights = weightHistory.map((w) => w.avgWeightKg);
  const targetWeights = phaseTargets.map((p) => p.targetWeightKg);
  const yMax = Math.max(...allWeights, ...targetWeights, 102) + 1;
  const yMin = Math.min(...targetWeights, 89) - 1;

  const toX = (week: number) => padLeft + ((week - 1) / Math.max(currentWeek, 78)) * chartW;
  const toY = (kg: number) => padTop + ((yMax - kg) / (yMax - yMin)) * chartH;

  // Build actual weight polyline
  const weightPoints = weightHistory
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map((w) => `${toX(w.weekNumber)},${toY(w.avgWeightKg)}`)
    .join(' ');

  // Build area fill polygon (weight line + baseline)
  const areaPoints = weightPoints
    + ` ${toX(weightHistory[weightHistory.length - 1]?.weekNumber ?? 1)},${toY(yMin)}`
    + ` ${toX(weightHistory[0]?.weekNumber ?? 1)},${toY(yMin)}`;

  // Phase target dashed line: stepped through phases
  // Approximate phase boundaries: P1=W1-13, P2=W14-26, P3=W27-44, P4=W45-57, P5=W58-70, P6=W71-78
  const phaseBoundaries = [1, 14, 27, 45, 58, 71, 79];
  const targetPoints = phaseTargets
    .flatMap((p, i) => {
      const startW = phaseBoundaries[i] || 1;
      const endW = phaseBoundaries[i + 1] || 79;
      return [
        `${toX(startW)},${toY(p.targetWeightKg)}`,
        `${toX(endW)},${toY(p.targetWeightKg)}`,
      ];
    })
    .join(' ');

  // Delta display
  const deltaText = weightFromStart != null
    ? `${weightFromStart > 0 ? '▲' : '▼'} ${Math.abs(weightFromStart)}kg from start`
    : null;
  const deltaColor = weightFromStart != null && weightFromStart <= 0
    ? semanticColors.recovery.good
    : semanticColors.recovery.problem;

  return (
    <HeroCard label="Weight" accentColor={cardAccents.body}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
        <Typography sx={{ ...typography.primaryMetric, lineHeight: 1.1 }}>
          {currentWeight ?? '—'}
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', color: 'currentColor', fontWeight: 600 }}>
          kg
        </Typography>
      </Box>
      {deltaText && (
        <Typography sx={{ fontSize: '0.75rem', color: deltaColor, fontWeight: 600, mt: 0.25 }}>
          {deltaText}
        </Typography>
      )}

      {hasHistory && (
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', marginTop: 8 }}>
          <defs>
            <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={semanticColors.body} />
              <stop offset="100%" stopColor={semanticColors.body} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Phase target dashed line */}
          {targetPoints && (
            <polyline
              points={targetPoints}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeDasharray="6,4"
              opacity="0.7"
            />
          )}

          {/* Area fill */}
          <polygon points={areaPoints} fill="url(#weightFill)" opacity="0.15" />

          {/* Actual weight line */}
          <polyline
            points={weightPoints}
            fill="none"
            stroke={semanticColors.body}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Current position dot */}
          {weightHistory.length > 0 && (
            <circle
              cx={toX(weightHistory[weightHistory.length - 1].weekNumber)}
              cy={toY(weightHistory[weightHistory.length - 1].avgWeightKg)}
              r="4"
              fill={semanticColors.body}
              stroke="white"
              strokeWidth="2"
            />
          )}

          {/* Start label */}
          <text x={padLeft} y={padTop - 2} fontSize="8" fill="currentColor" opacity="0.5" fontFamily="'JetBrains Mono', monospace">
            {Math.round(allWeights[0] ?? 102)}kg
          </text>

          {/* Current phase target label */}
          <text x={width - padRight} y={toY(currentPhaseTarget) - 4} fontSize="8" fill="currentColor" opacity="0.5" textAnchor="end" fontFamily="'JetBrains Mono', monospace">
            {currentPhaseTarget}kg target
          </text>

          {/* Week label */}
          <text
            x={toX(currentWeek)}
            y={toY(weightHistory[weightHistory.length - 1]?.avgWeightKg ?? 99) + 14}
            fontSize="8"
            fill={semanticColors.body}
            textAnchor="middle"
            fontWeight="600"
            fontFamily="'JetBrains Mono', monospace"
          >
            W{currentWeek}
          </text>
        </svg>
      )}

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 16, height: 2, bgcolor: semanticColors.body }} />
          <Typography sx={{ fontSize: '0.625rem', color: 'currentColor' }}>Actual</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 16, height: 0, borderTop: '2px dashed #94a3b8' }} />
          <Typography sx={{ fontSize: '0.625rem', color: 'currentColor' }}>Phase target</Typography>
        </Box>
      </Box>
    </HeroCard>
  );
}
