'use client';

import { Box, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';

interface PhaseInfo {
  number: number;
  name: string;
  dateRange: string;
  isCurrent: boolean;
}

// Duration proportions in months
const PHASE_FLEX = [3, 3, 4, 4, 3, 1];

interface PhaseTimelineProps {
  phases: PhaseInfo[];
  currentPhaseNumber: number;
}

export default function PhaseTimeline({ phases, currentPhaseNumber }: PhaseTimelineProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{ display: 'flex', width: '100%', height: 48, mb: 3, borderRadius: 2, overflow: 'hidden' }}>
      {phases.map((phase, idx) => {
        const isPast = phase.number < currentPhaseNumber;
        const isCurrent = phase.number === currentPhaseNumber;
        const isFuture = phase.number > currentPhaseNumber;

        return (
          <Tooltip key={phase.number} title={`${phase.name} (${phase.dateRange})`} arrow>
            <Box
              sx={{
                flex: PHASE_FLEX[idx] || 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: isFuture
                  ? 'action.disabledBackground'
                  : 'primary.main',
                color: isFuture
                  ? 'text.disabled'
                  : 'primary.contrastText',
                borderLeft: idx > 0 ? '1px solid' : 'none',
                borderColor: 'background.paper',
                borderRadius: idx === 0 ? '8px 0 0 8px' : idx === phases.length - 1 ? '0 8px 8px 0' : 0,
                boxShadow: isCurrent ? `inset 0 0 0 2px ${theme.palette.warning.main}` : 'none',
                position: 'relative',
                cursor: 'default',
                transition: 'all 0.2s',
              }}
            >
              <Typography
                variant="caption"
                fontWeight={isCurrent ? 800 : 600}
                sx={{ whiteSpace: 'nowrap', fontSize: isMobile ? '0.65rem' : '0.75rem' }}
              >
                {isMobile ? `P${phase.number}` : `P${phase.number}: ${phase.name.split(' ').slice(0, 2).join(' ')}`}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}
