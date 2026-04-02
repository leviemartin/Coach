'use client';

import { Typography, Box, Button, Chip, Skeleton } from '@mui/material';
import { useRouter } from 'next/navigation';
import { typography, borders, statusColors } from '@/lib/design-tokens';
import type { PlanItem } from '@/lib/types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface TodayActionProps {
  items: PlanItem[] | null;
}

export default function TodayAction({ items }: TodayActionProps) {
  const router = useRouter();
  const todayName = DAY_NAMES[new Date().getDay()];

  if (items === null) {
    return <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 0, mb: 3 }} />;
  }

  const todayItem = items.find(
    (item) => item.day.toLowerCase() === todayName.toLowerCase(),
  );

  if (!todayItem) {
    return (
      <Box sx={{
        bgcolor: 'background.paper', border: `3px solid ${borders.hard}`, p: 2.5, mb: 3,
      }}>
        <Typography sx={typography.categoryLabel}>Today — {todayName}</Typography>
        <Typography sx={{ ...typography.sectionTitle, mt: 0.5 }}>
          {items.length === 0 ? 'No plan this week' : 'Rest Day'}
        </Typography>
        {items.length === 0 && (
          <Button size="small" variant="outlined" onClick={() => router.push('/checkin')} sx={{ mt: 1, borderWidth: 2 }}>
            Run Check-In
          </Button>
        )}
      </Box>
    );
  }

  // Parse exercises from workout plan text (one per line, bullet or numbered)
  const exercises = (todayItem.workoutPlan || '')
    .split('\n')
    .map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter((l) => l.length > 0)
    .slice(0, 6); // Max 6 shown

  // Session type → badge color (uses design token patterns)
  const badgeColors: Record<string, { bg: string; text: string; border: string }> = {
    strength: { bg: '#3b82f618', text: '#2563eb', border: '#3b82f640' },
    upper: { bg: '#3b82f618', text: '#2563eb', border: '#3b82f640' },
    lower: { bg: '#3b82f618', text: '#2563eb', border: '#3b82f640' },
    functional: { bg: '#f59e0b18', text: '#d97706', border: '#f59e0b40' },
    ocr: { bg: '#f59e0b18', text: '#d97706', border: '#f59e0b40' },
    cardio: { bg: '#ea580c18', text: '#ea580c', border: '#ea580c40' },
    aerobic: { bg: '#ea580c18', text: '#ea580c', border: '#ea580c40' },
    ruck: { bg: '#22c55e18', text: '#16a34a', border: '#22c55e40' },
    recovery: { bg: '#0d948818', text: '#0d9488', border: '#0d948840' },
  };

  const sessionWords = todayItem.sessionType.toLowerCase().split(/[\s+&]/);
  const badges = sessionWords
    .map((w) => badgeColors[w])
    .filter((b): b is { bg: string; text: string; border: string } => b != null);
  if (badges.length === 0) badges.push({ bg: '#a1a1aa18', text: '#71717a', border: '#a1a1aa40' });

  return (
    <Box sx={{
      bgcolor: 'background.paper', border: `3px solid ${borders.hard}`, p: 2.5, mb: 3,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box>
          <Typography sx={typography.categoryLabel}>Today — {todayName}</Typography>
          <Typography sx={{ ...typography.sectionTitle, mt: 0.25 }}>
            {todayItem.focus || todayItem.sessionType}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {sessionWords.filter((w) => badgeColors[w]).map((w, i) => (
            <Chip
              key={i}
              label={w.charAt(0).toUpperCase() + w.slice(1)}
              size="small"
              sx={{
                bgcolor: badges[i]?.bg || '#a1a1aa18',
                color: badges[i]?.text || '#71717a',
                border: `1px solid ${badges[i]?.border || '#a1a1aa40'}`,
              }}
            />
          ))}
        </Box>
      </Box>

      {exercises.length > 0 && (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
          gap: 0.5,
          fontSize: '0.8125rem',
          color: 'text.secondary',
        }}>
          {exercises.map((ex, i) => (
            <Typography key={i} variant="body2" color="text.secondary">
              • {ex}
            </Typography>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        {todayItem.status !== 'completed' && (
          <Button variant="contained" onClick={() => router.push(
            todayItem.id != null ? `/session?planItemId=${todayItem.id}` : '/session'
          )}>
            Start Session &rarr;
          </Button>
        )}
        <Button variant={todayItem.status === 'completed' ? 'contained' : 'outlined'} onClick={() => router.push('/plan')}>
          View Full Plan
        </Button>
      </Box>
    </Box>
  );
}
