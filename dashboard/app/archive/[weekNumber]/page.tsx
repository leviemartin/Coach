'use client';

import { useEffect, useState } from 'react';
import { Typography, Box, Card, CardContent, CircularProgress } from '@mui/material';
import { useParams } from 'next/navigation';
import MarkdownRenderer from '@/components/MarkdownRenderer';

export default function ArchivedWeekPage() {
  const params = useParams();
  const weekNumber = params.weekNumber as string;
  const [content, setContent] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/archive?week=${weekNumber}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((data) => {
        setContent(data.content);
        setDate(data.date);
      })
      .catch(() => setContent(null))
      .finally(() => setLoading(false));
  }, [weekNumber]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  }

  if (content === null) {
    return (
      <Box>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
          Week {weekNumber}
        </Typography>
        <Card>
          <CardContent>
            <Typography color="text.secondary">
              No log found for week {weekNumber}.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
        Week {weekNumber}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {date}
      </Typography>

      <Card>
        <CardContent>
          <MarkdownRenderer content={content} />
        </CardContent>
      </Card>
    </Box>
  );
}
