'use client';
import React from 'react';
import { Typography } from '@mui/material';

const SECTION_LABELS: Record<string, string> = {
  warm_up: 'WARM-UP',
  activation: 'ACTIVATION',
  main_work: 'MAIN WORK',
  accessory: 'ACCESSORY',
  finisher: 'FINISHER',
  cool_down: 'COOL-DOWN',
};

export default function SectionHeader({ section }: { section: string }) {
  return (
    <Typography sx={{
      fontSize: '0.6875rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '1.5px',
      color: '#64748b',
      mt: 2,
      mb: 0.75,
    }}>
      {SECTION_LABELS[section] ?? section.toUpperCase()}
    </Typography>
  );
}
