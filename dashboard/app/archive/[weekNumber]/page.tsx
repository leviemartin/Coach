'use client';

import { useEffect, useState, useCallback } from 'react';
import { Typography, Box, Card, CardContent, CircularProgress, Alert, Button } from '@mui/material';
import { useParams } from 'next/navigation';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import PageBreadcrumb from '@/components/PageBreadcrumb';

export default function ArchivedWeekPage() {
  const params = useParams();
  const weekNumber = params.weekNumber as string;
  const [content, setContent] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/archive?week=${weekNumber}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((data) => {
        setContent(data.content);
        setDate(data.date);
      })
      .catch((err: Error) => {
        setError(err.message || 'Failed to load archive');
        setContent(null);
      })
      .finally(() => setLoading(false));
  }, [weekNumber]);

  useEffect(() => { loadData(); }, [loadData]);

  const breadcrumb = (
    <PageBreadcrumb items={[
      { label: 'Dashboard', href: '/' },
      { label: 'Archive', href: '/archive' },
      { label: `Week ${weekNumber}` },
    ]} />
  );

  if (loading) {
    return <Box>{breadcrumb}<Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box></Box>;
  }

  return (
    <Box>
      {breadcrumb}

      <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
        Week {weekNumber}
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

      {content === null && !error ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary">
              No log found for week {weekNumber}.
            </Typography>
          </CardContent>
        </Card>
      ) : content !== null ? (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {date}
          </Typography>
          <Card>
            <CardContent>
              <MarkdownRenderer content={content} />
            </CardContent>
          </Card>
        </>
      ) : null}
    </Box>
  );
}
