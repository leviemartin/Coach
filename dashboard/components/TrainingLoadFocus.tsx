'use client';

import { Typography, Box, Chip } from '@mui/material';
import MetricCard from './MetricCard';
import HrZoneBar from './HrZoneBar';
import { semanticColors } from '@/lib/design-tokens';
import type { LoadFocusData, HrZoneSummary } from '@/lib/types';

interface TrainingLoadFocusProps {
  loadFocus: LoadFocusData | null;
  hrZones: HrZoneSummary | null;
  enduranceScore: number | null;
}

function LoadBar({ label, value, min, max }: { label: string; value: number; min: number; max: number }) {
  const inRange = value >= min && value <= max;
  const isShort = value < min;
  const color = inRange ? semanticColors.recovery.good : isShort ? semanticColors.recovery.caution : semanticColors.recovery.problem;
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
        <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.6875rem', color: 'text.secondary' }}>{label}</Typography>
        <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.6875rem', color, fontWeight: 600 }}>
          {Math.round(value)} {isShort ? '(shortage)' : ''}
        </Typography>
      </Box>
      <Box sx={{ height: 6, bgcolor: 'action.disabledBackground' }}>
        <Box sx={{ height: 6, bgcolor: color, width: `${pct}%` }} />
      </Box>
    </Box>
  );
}

export default function TrainingLoadFocus({ loadFocus, hrZones, enduranceScore }: TrainingLoadFocusProps) {
  return (
    <MetricCard label="Training Load Focus">
      {loadFocus ? (
        <Box sx={{ mt: 1 }}>
          <LoadBar label="Low Aerobic" value={loadFocus.lowAerobic}
            min={loadFocus.lowAerobicTargetMin} max={loadFocus.lowAerobicTargetMax} />
          <LoadBar label="High Aerobic" value={loadFocus.highAerobic}
            min={loadFocus.highAerobicTargetMin} max={loadFocus.highAerobicTargetMax} />
          <LoadBar label="Anaerobic" value={loadFocus.anaerobic}
            min={loadFocus.anaerobicTargetMin} max={loadFocus.anaerobicTargetMax} />
        </Box>
      ) : (
        <Typography variant="body2" color="text.disabled" sx={{ mt: 1, fontStyle: 'italic' }}>
          No load data available
        </Typography>
      )}

      {hrZones && <HrZoneBar zones={hrZones} />}

      {enduranceScore != null && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
          <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.6875rem', color: 'text.secondary' }}>Endurance Score</Typography>
          <Chip label={enduranceScore} size="small" sx={{ fontWeight: 700 }} />
        </Box>
      )}
    </MetricCard>
  );
}
