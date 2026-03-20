'use client';

import { Box, Typography } from '@mui/material';

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
  complete: 'success.main',
  partial: 'warning.main',
  empty: 'action.disabled',
  family: 'action.disabledBackground',
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
              cursor: isFamily ? 'default' : 'pointer',
            }}
            onClick={() => {
              if (!isFamily) onDayClick(day.date);
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: isCurrent ? 700 : 400,
                color: isCurrent ? 'text.primary' : 'text.secondary',
                fontSize: { xs: '0.65rem', sm: '0.75rem' },
              }}
            >
              {day.day}
            </Typography>
            <Box
              sx={{
                width: { xs: 14, sm: 18 },
                height: { xs: 14, sm: 18 },
                borderRadius: '50%',
                bgcolor: STATUS_COLORS[day.status],
                border: isCurrent ? 2 : 0,
                borderColor: 'primary.main',
                transition: 'transform 0.15s',
                '&:hover': isFamily ? {} : { transform: 'scale(1.2)' },
              }}
            />
          </Box>
        );
      })}
    </Box>
  );
}
