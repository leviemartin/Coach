'use client';

import { Box, Typography } from '@mui/material';
import { borders } from '@/lib/design-tokens';

interface DayInfo {
  date: string;
  day: string;
  status: 'complete' | 'partial' | 'empty' | 'family';
}

interface WeekDotsProps {
  days: DayInfo[];
  currentDate: string;
  onDayClick: (date: string) => void;
}

const STATUS_COLORS: Record<DayInfo['status'], string> = {
  complete: '#f97316',
  partial: '#f59e0b',
  empty: '#d4d4d0',
  family: '#e4e4e0',
};

export default function WeekDots({ days, currentDate, onDayClick }: WeekDotsProps) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 1.5, sm: 2.5 }, py: 1.5 }}>
      {days.map((day) => {
        const isCurrent = day.date === currentDate;
        const isFamily = day.status === 'family';

        return (
          <Box
            key={day.date}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
              cursor: 'pointer',
            }}
            onClick={() => onDayClick(day.date)}
          >
            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: isCurrent ? 700 : 400,
                color: isCurrent ? 'text.primary' : 'text.secondary',
                fontSize: { xs: '0.6rem', sm: '0.7rem' },
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}
            >
              {day.day}
            </Typography>
            <Box
              sx={{
                width: { xs: 14, sm: 18 },
                height: { xs: 14, sm: 18 },
                borderRadius: 0,
                bgcolor: STATUS_COLORS[day.status],
                border: isCurrent ? `2px solid ${borders.hard}` : 'none',
                '&:hover': { opacity: 0.7 },
              }}
            />
          </Box>
        );
      })}
    </Box>
  );
}
