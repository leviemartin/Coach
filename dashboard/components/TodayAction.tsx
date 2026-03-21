'use client';

import { Typography, Box, Button, Chip, Skeleton } from '@mui/material';
import { useRouter } from 'next/navigation';
import { typography } from '@/lib/design-tokens';
import type { PlanItem } from '@/lib/types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface TodayActionProps {
  items: PlanItem[] | null;
}

export default function TodayAction({ items }: TodayActionProps) {
  const router = useRouter();
  const todayName = DAY_NAMES[new Date().getDay()];

  if (items === null) {
    return <Skeleton variant="rounded" height={140} sx={{ borderRadius: '12px', mb: 3 }} />;
  }

  const todayItem = items.find(
    (item) => item.day.toLowerCase() === todayName.toLowerCase(),
  );

  if (!todayItem) {
    return (
      <Box sx={{
        bgcolor: 'background.paper', borderRadius: '12px', p: 2.5,
        border: 1, borderColor: 'divider', mb: 3,
      }}>
        <Typography sx={typography.categoryLabel}>Today — {todayName}</Typography>
        <Typography variant="body1" fontWeight={700} sx={{ mt: 0.5 }}>
          {items.length === 0 ? 'No plan this week' : 'Rest Day'}
        </Typography>
        {items.length === 0 && (
          <Button size="small" onClick={() => router.push('/checkin')} sx={{ mt: 1 }}>
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

  // Session type → badge color
  const badgeColors: Record<string, { bg: string; text: string }> = {
    strength: { bg: '#dbeafe', text: '#1d4ed8' },
    upper: { bg: '#dbeafe', text: '#1d4ed8' },
    lower: { bg: '#dbeafe', text: '#1d4ed8' },
    functional: { bg: '#fef3c7', text: '#92400e' },
    ocr: { bg: '#fef3c7', text: '#92400e' },
    cardio: { bg: '#ccfbf1', text: '#0f766e' },
    aerobic: { bg: '#ccfbf1', text: '#0f766e' },
    ruck: { bg: '#dcfce7', text: '#166534' },
    recovery: { bg: '#f0f9ff', text: '#0369a1' },
  };

  const sessionWords = todayItem.sessionType.toLowerCase().split(/[\s+&]/);
  const badges = sessionWords
    .map((w) => badgeColors[w])
    .filter((b): b is { bg: string; text: string } => b != null);
  if (badges.length === 0) badges.push({ bg: '#f1f5f9', text: '#475569' });

  return (
    <Box sx={{
      bgcolor: 'background.paper', borderRadius: '12px', p: 2.5,
      border: 1, borderColor: 'divider', mb: 3,
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
                bgcolor: badges[i]?.bg || '#f1f5f9',
                color: badges[i]?.text || '#475569',
                fontWeight: 600,
                fontSize: '0.75rem',
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
        <Button variant="contained" onClick={() => router.push('/plan')}>
          View Full Plan
        </Button>
      </Box>
    </Box>
  );
}
