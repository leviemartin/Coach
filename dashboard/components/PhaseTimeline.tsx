'use client';

import { Box, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';

export interface PhaseInfo {
  number: number;
  name: string;
  dateRange: string;
  isCurrent: boolean;
  weightTarget: string;
  focus: string[];
}

// Duration proportions in months
const PHASE_FLEX = [3, 3, 4, 4, 3, 1];

interface PhaseTimelineProps {
  phases: PhaseInfo[];
  currentPhaseNumber: number;
  selectedPhase: number;
  onPhaseSelect: (n: number) => void;
}

export default function PhaseTimeline({ phases, currentPhaseNumber, selectedPhase, onPhaseSelect }: PhaseTimelineProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{ display: 'flex', width: '100%', height: 44, mb: 1, overflow: 'hidden', border: `2px solid ${theme.palette.divider}` }}>
      {phases.map((phase, idx) => {
        const isPast = phase.number < currentPhaseNumber;
        const isCurrent = phase.number === currentPhaseNumber;
        const isFuture = phase.number > currentPhaseNumber;
        const isSelected = phase.number === selectedPhase;

        return (
          <Tooltip key={phase.number} title={`${phase.name} (${phase.dateRange})`} arrow>
            <Box
              onClick={() => onPhaseSelect(phase.number)}
              sx={{
                flex: PHASE_FLEX[idx] || 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: isFuture
                  ? 'action.disabledBackground'
                  : isCurrent
                    ? 'secondary.main'
                    : (theme) => theme.palette.mode === 'dark' ? 'rgba(96,165,250,0.25)' : 'rgba(59,130,246,0.15)',
                color: isFuture
                  ? 'text.disabled'
                  : isCurrent
                    ? 'secondary.contrastText'
                    : 'secondary.main',
                borderLeft: idx > 0 ? '1px solid' : 'none',
                borderColor: 'background.default',
                borderBottom: isSelected ? `3px solid ${theme.palette.text.primary}` : '3px solid transparent',
                position: 'relative',
                cursor: 'pointer',
                transition: 'all 0.2s',
                px: 1,
                '&:hover': { opacity: 0.85 },
              }}
            >
              <Typography
                variant="caption"
                fontWeight={isCurrent ? 700 : 600}
                sx={{
                  whiteSpace: 'nowrap',
                  fontSize: isMobile ? '0.65rem' : '0.75rem',
                }}
              >
                {isMobile ? `P${phase.number}` : `P${phase.number}: ${phase.name}`}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}
