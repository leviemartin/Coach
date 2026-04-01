'use client';
import { Box, Typography } from '@mui/material';

interface WarmupCheckboxProps {
  exerciseName: string;
  detail: string;
  coachCue?: string | null;
  completed: boolean;
  onToggle?: () => void;
  interactive?: boolean;
}

export default function WarmupCheckbox({ exerciseName, detail, coachCue, completed, onToggle, interactive = false }: WarmupCheckboxProps) {
  return (
    <Box onClick={interactive ? onToggle : undefined}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, px: 2.5,
        borderBottom: '1px solid #e4e4e0', cursor: interactive ? 'pointer' : 'default',
        opacity: completed ? 0.5 : 1, '&:hover': interactive ? { backgroundColor: '#f0f0eb' } : {},
      }}>
      <Box sx={{
        width: 28, height: 28, border: '2px solid', borderColor: completed ? '#22c55e' : '#18181b',
        backgroundColor: completed ? '#22c55e' : 'transparent', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {completed && <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1 }}>✓</Typography>}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8125rem', fontWeight: 500,
          textDecoration: completed ? 'line-through' : 'none', color: completed ? '#a1a1aa' : '#18181b',
        }}>
          {exerciseName}
        </Typography>
        {coachCue && <Typography sx={{ fontSize: '0.75rem', fontStyle: 'italic', color: '#b45309', mt: 0.25 }}>{coachCue}</Typography>}
      </Box>
      <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.6875rem', color: '#71717a', flexShrink: 0 }}>
        {detail}
      </Typography>
    </Box>
  );
}
