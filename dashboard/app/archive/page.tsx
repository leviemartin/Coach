'use client';

import { useEffect, useState, useCallback } from 'react';
import { Typography, Box, Card, CardActionArea, CardContent, Chip, Stack, Alert, Button } from '@mui/material';
import Link from 'next/link';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import type { WeeklyMetrics } from '@/lib/types';

interface LogEntry {
  filename: string;
  weekNumber: number;
  date: string;
}

function SleepChip({ score }: { score: number }) {
  const color = score >= 75 ? 'success' : score >= 60 ? 'warning' : 'error';
  return (
    <Chip
      label={`Sleep ${score}`}
      size="small"
      color={color}
      variant="filled"
    />
  );
}

export default function ArchivePage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metricsMap, setMetricsMap] = useState<Map<number, WeeklyMetrics>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setError(null);
    fetch('/api/archive')
      .then((r) => r.json())
      .then((data) => setLogs(data.logs || []))
      .catch((err: Error) => setError(err.message || 'Failed to load archive'));

    fetch('/api/trends')
      .then((r) => r.json())
      .then((data) => {
        const map = new Map<number, WeeklyMetrics>();
        for (const m of (data.metrics || []) as WeeklyMetrics[]) {
          map.set(m.weekNumber, m);
        }
        setMetricsMap(map);
      })
      .catch((err: Error) => setError(err.message || 'Failed to load trends'));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <Box>
      <PageBreadcrumb items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Archive' },
      ]} />

      <Typography variant="h3" fontWeight={700} sx={{ mb: 4 }}>
        Archive
      </Typography>

      {error && (
        <Alert
          severity="error"
          action={<Button onClick={() => { setError(null); loadData(); }}>Retry</Button>}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}

      {logs.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary">
              No weekly logs yet. Complete your first check-in to create one.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {logs.map((log) => {
            const m = metricsMap.get(log.weekNumber);
            return (
              <Card key={log.filename}>
                <CardActionArea component={Link} href={`/archive/${log.weekNumber}`}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                      <Box>
                        <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
                          Week {log.weekNumber}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {log.date}
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {m?.weightKg != null && (
                          <Chip
                            label={`${m.weightKg.toFixed(1)} kg`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {m?.avgSleepScore != null && (
                          <SleepChip score={Math.round(m.avgSleepScore)} />
                        )}
                        {m?.sessionsCompleted != null && m?.sessionsPlanned != null && (
                          <Chip
                            label={`${m.sessionsCompleted}/${m.sessionsPlanned} sessions`}
                            size="small"
                            variant="outlined"
                            color={m.sessionsCompleted >= m.sessionsPlanned ? 'success' : 'default'}
                          />
                        )}
                      </Stack>
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
