'use client';

import { useEffect, useState } from 'react';
import { Typography, Box, Card, CardContent, List, ListItemButton, ListItemText, Chip, Stack } from '@mui/material';
import Link from 'next/link';

interface LogEntry {
  filename: string;
  weekNumber: number;
  date: string;
}

export default function ArchivePage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    fetch('/api/archive')
      .then((r) => r.json())
      .then((data) => setLogs(data.logs || []))
      .catch(() => {});
  }, []);

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
        Archive
      </Typography>

      {logs.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary">
              No weekly logs yet. Complete your first check-in to create one.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <List disablePadding>
            {logs.map((log) => (
              <ListItemButton
                key={log.filename}
                component={Link}
                href={`/archive/${log.weekNumber}`}
                divider
              >
                <ListItemText
                  primary={`Week ${log.weekNumber}`}
                  secondary={log.date}
                />
                <Stack direction="row" spacing={1}>
                  <Chip label={log.date} size="small" variant="outlined" />
                </Stack>
              </ListItemButton>
            ))}
          </List>
        </Card>
      )}
    </Box>
  );
}
