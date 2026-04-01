'use client';
import { Box, Typography } from '@mui/material';
import { sectionColors } from '@/lib/design-tokens';
import type { Section } from '@/lib/types';

const SECTION_LABELS: Record<string, string> = {
  warm_up: 'WARM-UP', activation: 'ACTIVATION', main_work: 'MAIN WORK',
  accessory: 'ACCESSORY', finisher: 'FINISHER', cool_down: 'COOL-DOWN',
};

interface SectionDividerProps { section: Section; }

export default function SectionDivider({ section }: SectionDividerProps) {
  const color = sectionColors[section] ?? '#18181b';
  const label = SECTION_LABELS[section] ?? section.toUpperCase().replace('_', ' ');
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 1.25, pb: 0.75, px: 2.5, borderTop: '2px solid #18181b' }}>
      <Box sx={{ width: 12, height: 3, backgroundColor: color, flexShrink: 0 }} />
      <Typography sx={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: '0.625rem', fontWeight: 700,
        letterSpacing: '3px', textTransform: 'uppercase', color,
      }}>
        {label}
      </Typography>
    </Box>
  );
}
