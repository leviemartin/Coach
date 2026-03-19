'use client';

import { Chip, Box } from '@mui/material';

interface WeekSelectorProps {
  weeks: Array<{ weekNumber: number; date: string }>;
  selected: number | null;
  onSelect: (weekNumber: number) => void;
}

export default function WeekSelector({ weeks, selected, onSelect }: WeekSelectorProps) {
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
      {weeks.map((w) => (
        <Chip
          key={w.weekNumber}
          label={`Week ${w.weekNumber}`}
          variant={selected === w.weekNumber ? 'filled' : 'outlined'}
          color={selected === w.weekNumber ? 'primary' : 'default'}
          onClick={() => onSelect(w.weekNumber)}
        />
      ))}
    </Box>
  );
}
