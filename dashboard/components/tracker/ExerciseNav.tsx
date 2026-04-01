'use client';
import { Box, Typography } from '@mui/material';
import type { Section } from '@/lib/types';

const SECTION_LABELS: Record<string, string> = {
  warm_up: 'WARM-UP', activation: 'ACTIVATION', main_work: 'MAIN WORK',
  accessory: 'ACCESSORY', finisher: 'FINISHER', cool_down: 'COOL-DOWN',
};

interface NavItem {
  name: string;
  section: Section;
  completed: boolean;
  current: boolean;
  setsCompleted: number;
  setsTotal: number;
}

interface ExerciseNavProps { items: NavItem[]; onSelect: (index: number) => void; }

export default function ExerciseNav({ items, onSelect }: ExerciseNavProps) {
  let prevSection: string | null = null;
  return (
    <Box sx={{ borderTop: '3px solid #18181b' }}>
      {items.map((item, idx) => {
        const showSectionHeader = item.section !== prevSection;
        prevSection = item.section;
        return (
          <Box key={idx}>
            {showSectionHeader && (
              <Box sx={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: '0.5625rem', fontWeight: 700,
                letterSpacing: '2px', textTransform: 'uppercase', color: '#a1a1aa',
                px: 2.5, pt: 1.25, pb: 0.5, borderTop: idx > 0 ? '1px solid #e4e4e0' : 'none',
              }}>
                {SECTION_LABELS[item.section] ?? item.section}
              </Box>
            )}
            <Box onClick={() => onSelect(idx)} sx={{
              display: 'flex', alignItems: 'center', gap: 1.25, px: 2.5, py: 1.25,
              borderBottom: '1px solid #f0f0eb', fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.75rem', cursor: 'pointer',
              borderLeft: item.current && !item.completed ? '3px solid #18181b' : '3px solid transparent',
              fontWeight: item.current && !item.completed ? 700 : 400,
              color: item.completed ? '#a1a1aa' : '#18181b',
              textDecoration: item.completed ? 'line-through' : 'none',
              '&:hover': { backgroundColor: '#f0f0eb' },
            }}>
              <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name}
              </Box>
              <Typography sx={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: '0.625rem',
                color: item.completed ? '#22c55e' : item.current ? '#3b82f6' : '#a1a1aa',
                fontWeight: item.current ? 700 : 400, flexShrink: 0,
              }}>
                {item.completed ? '✓' : `${item.setsCompleted}/${item.setsTotal}`}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
