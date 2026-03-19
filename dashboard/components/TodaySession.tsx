'use client';

import { Typography, Box, Chip, Button, Skeleton } from '@mui/material';
import { useRouter } from 'next/navigation';
import type { PlanItem, SubTask } from '@/lib/types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface TodaySessionProps {
  items: PlanItem[] | null;
  onToggleSubTask?: (id: number, subTasks: SubTask[]) => void;
}

export default function TodaySession({ items, onToggleSubTask }: TodaySessionProps) {
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

  const allDone = todayItem.subTasks.length > 0 && todayItem.subTasks.every(st => st.completed);

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
        ...(allDone && { opacity: 0.6 }),
      }}
    >
      <Typography variant="body1" fontWeight={700}>
        Today
      </Typography>
      <Chip
        label={todayItem.sessionType}
        size="small"
        color={allDone ? 'success' : 'default'}
        variant={allDone ? 'outlined' : 'filled'}
      />
      {todayItem.focus && (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          {todayItem.focus}
        </Typography>
      )}

      {todayItem.subTasks.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
          {todayItem.subTasks.map((st) => (
            <Chip
              key={st.key}
              label={st.label}
              size="small"
              color={st.completed ? 'success' : 'default'}
              variant={st.completed ? 'filled' : 'outlined'}
              onClick={
                onToggleSubTask && todayItem.id != null
                  ? () => {
                      const updated = todayItem.subTasks.map(s =>
                        s.key === st.key ? { ...s, completed: !s.completed } : s
                      );
                      onToggleSubTask(todayItem.id!, updated);
                    }
                  : undefined
              }
              sx={{ cursor: onToggleSubTask ? 'pointer' : 'default' }}
            />
          ))}
        </Box>
      )}

      <Button size="small" variant="text" onClick={() => router.push('/plan')} sx={{ ml: todayItem.subTasks.length > 0 ? 0 : 'auto' }}>
        View Plan →
      </Button>
    </Box>
  );
}
