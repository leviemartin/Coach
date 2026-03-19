'use client';

import { Box, Chip, Typography } from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import type { PhaseInfo } from './PhaseTimeline';
import { getTrainingWeek } from '@/lib/week';

interface PhaseDetailStripProps {
  phase: PhaseInfo;
  currentWeight: number | null;
  isCurrentPhase: boolean;
}

/** Parse "Jan–Mar 2026" → approximate start/end Dates.
 *  Returns null if parsing fails. */
function parseDateRange(dateRange: string): { start: Date; end: Date } | null {
  const MONTHS: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };

  // Match patterns like "Jan–Mar 2026" or "Jan - Mar 2026"
  const m = dateRange.match(/^(\w{3})\s*[–\-]\s*(\w{3})\s+(\d{4})$/);
  if (!m) return null;

  const [, startMonth, endMonth, yearStr] = m;
  const year = parseInt(yearStr);
  const startMonthIdx = MONTHS[startMonth];
  const endMonthIdx = MONTHS[endMonth];

  if (startMonthIdx === undefined || endMonthIdx === undefined) return null;

  const start = new Date(year, startMonthIdx, 1);
  // End = last day of end month
  const end = new Date(year, endMonthIdx + 1, 0);

  return { start, end };
}

/** Returns percentage (0–100) through the phase, clamped. */
function calcPhaseProgress(dateRange: string): number | null {
  const parsed = parseDateRange(dateRange);
  if (!parsed) return null;

  const now = new Date();
  const { start, end } = parsed;
  const total = end.getTime() - start.getTime();
  if (total <= 0) return null;

  const elapsed = now.getTime() - start.getTime();
  const pct = Math.round((elapsed / total) * 100);
  return Math.max(0, Math.min(100, pct));
}

export default function PhaseDetailStrip({ phase, currentWeight, isCurrentPhase }: PhaseDetailStripProps) {
  // Parse weight target number for delta
  let weightNum: number | null = null;
  if (phase.weightTarget) {
    const m = phase.weightTarget.match(/(\d+)/);
    if (m) weightNum = parseInt(m[1]);
  }

  const delta = isCurrentPhase && currentWeight && weightNum ? currentWeight - weightNum : null;

  const currentWeek = getTrainingWeek();
  const phaseProgress = isCurrentPhase ? calcPhaseProgress(phase.dateRange) : null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
        bgcolor: 'action.hover',
        borderRadius: 2,
        p: 1.5,
        mb: 1,
      }}
    >
      {/* Week number chip */}
      {isCurrentPhase && (
        <Chip
          label={`Week ${currentWeek}`}
          size="small"
          color="primary"
          variant="filled"
        />
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <CalendarTodayIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        <Typography variant="body2" color="text.secondary">
          {phase.dateRange}
        </Typography>
        {phaseProgress !== null && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
            ({phaseProgress}% through)
          </Typography>
        )}
      </Box>

      {phase.weightTarget && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <FitnessCenterIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography variant="body2" fontWeight={500}>
            {phase.weightTarget}
            {delta !== null && (
              <Typography
                component="span"
                variant="body2"
                sx={{
                  ml: 0.5,
                  color: delta <= 0 ? 'success.main' : delta <= 2 ? 'text.secondary' : 'warning.main',
                }}
              >
                (now {currentWeight}kg, {delta > 0 ? `${delta.toFixed(1)}kg to go` : 'on target'})
              </Typography>
            )}
          </Typography>
        </Box>
      )}

      {phase.focus.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
            Focus:
          </Typography>
          {phase.focus.map((item, i) => (
            <Chip
              key={i}
              label={item.length > 40 ? item.slice(0, 37) + '...' : item}
              size="small"
              variant="outlined"
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
