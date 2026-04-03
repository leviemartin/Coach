'use client';

import { Box, Chip, Typography } from '@mui/material';

export interface WeekDay {
  date: string;
  dayName: string; // "Mon", "Tue", etc.
  sessionType: string | null; // "Strength", "Cardio", etc.
  sessionFocus: string | null; // "Upper Pull", "Zone 4", etc.
  status: 'done' | 'today' | 'pending' | 'family' | 'rest';
}

export interface WeekOverviewProps {
  days: WeekDay[];
  sessionsCompleted: number;
  sessionsPlanned: number;
  currentDate: string;
  onDayClick: (date: string) => void;
}

const STATUS_STYLES: Record<
  WeekDay['status'],
  { borderColor: string; bg: string; opacity?: number }
> = {
  done: { borderColor: '#22c55e', bg: '#22c55e18' },
  today: { borderColor: '#18181b', bg: '#fafaf7' },
  pending: { borderColor: '#e4e4e0', bg: '#fafaf7' },
  family: { borderColor: '#e4e4e0', bg: '#fafaf7', opacity: 0.4 },
  rest: { borderColor: '#e4e4e0', bg: '#fafaf7', opacity: 0.6 },
};

const STATUS_INDICATOR: Record<WeekDay['status'], string> = {
  done: '✓',
  today: '•',
  pending: '',
  family: '♥',
  rest: '–',
};

export default function WeekOverview({
  days,
  sessionsCompleted,
  sessionsPlanned,
  currentDate,
  onDayClick,
}: WeekOverviewProps) {
  return (
    <Box>
      {/* 7-column grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '6px',
          mb: 1.5,
        }}
      >
        {days.map((day) => {
          const styles = STATUS_STYLES[day.status];
          const isClickable = true; // all days are clickable, including family/rest
          const isActive = day.date === currentDate;

          return (
            <Box
              key={day.date}
              onClick={() => isClickable && onDayClick(day.date)}
              sx={{
                bgcolor: styles.bg,
                border: `1px solid ${styles.borderColor}`,
                borderRadius: 0,
                padding: '10px 6px',
                textAlign: 'center',
                opacity: styles.opacity ?? 1,
                cursor: isClickable ? 'pointer' : 'default',
                outline: isActive ? `2px solid ${styles.borderColor}` : 'none',
                outlineOffset: '1px',
                transition: 'opacity 0.15s, transform 0.1s',
                '&:hover': isClickable
                  ? { opacity: (styles.opacity ?? 1) * 0.85, transform: 'scale(1.03)' }
                  : {},
                minWidth: 0,
              }}
            >
              {/* Day name */}
              <Typography
                sx={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  color: 'text.secondary',
                  letterSpacing: '0.03em',
                  lineHeight: 1.2,
                }}
              >
                {day.dayName}
              </Typography>

              {/* Session focus (primary label) */}
              {day.sessionFocus && (
                <Typography
                  sx={{
                    fontSize: '0.55rem',
                    color: 'text.primary',
                    lineHeight: 1.3,
                    mt: 0.25,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={day.sessionFocus}
                >
                  {day.sessionFocus}
                </Typography>
              )}

              {/* Status indicator */}
              {STATUS_INDICATOR[day.status] && (
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    mt: 0.25,
                    color:
                      day.status === 'done'
                        ? '#22c55e'
                        : day.status === 'today'
                          ? '#18181b'
                          : day.status === 'family'
                            ? '#ec4899'
                            : 'text.disabled',
                    lineHeight: 1,
                  }}
                >
                  {STATUS_INDICATOR[day.status]}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Session count chip */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Chip
          label={`${sessionsCompleted}/${sessionsPlanned} sessions done`}
          size="small"
          variant="outlined"
          sx={{
            borderColor: sessionsCompleted >= sessionsPlanned ? '#22c55e' : '#e4e4e0',
            color: sessionsCompleted >= sessionsPlanned ? '#16a34a' : 'text.secondary',
            fontSize: '0.7rem',
          }}
        />
      </Box>
    </Box>
  );
}
