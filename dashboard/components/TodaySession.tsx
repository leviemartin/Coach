'use client';

import { Typography, Box, Chip, Button, Skeleton } from '@mui/material';
import { useRouter } from 'next/navigation';
import type { PlanItem } from '@/lib/types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface TodaySessionProps {
  items: PlanItem[] | null;
}

export default function TodaySession({ items }: TodaySessionProps) {
  const router = useRouter();
  const todayName = DAY_NAMES[new Date().getDay()];

  if (items === null) {
    return (
      <Box sx={{ mb: 4 }}>
        <Skeleton variant="text" width={300} height={28} />
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="body1" color="text.secondary">No plan this week.</Typography>
        <Button size="small" onClick={() => router.push('/checkin')}>Run Check-In</Button>
      </Box>
    );
  }

  const todayItem = items.find(
    (item) => item.day.toLowerCase() === todayName.toLowerCase()
  );

  if (!todayItem) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        mb: 4,
        py: 2,
        borderBottom: 1,
        borderColor: 'divider',
        flexWrap: 'wrap',
      }}
    >
      <Typography variant="body1" fontWeight={700}>
        Today
      </Typography>
      <Chip
        label={todayItem.sessionType}
        size="small"
        variant="filled"
      />
      {todayItem.focus && (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          {todayItem.focus}
        </Typography>
      )}

      <Button size="small" variant="text" onClick={() => router.push('/plan')} sx={{ ml: 'auto' }}>
        View Plan →
      </Button>
    </Box>
  );
}
