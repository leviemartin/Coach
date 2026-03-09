'use client';

import { useEffect, useState } from 'react';
import { Typography, Box, Card, CardContent, Grid, CircularProgress } from '@mui/material';
import MarkdownRenderer from '@/components/MarkdownRenderer';

export default function ProfilePage() {
  const [profile, setProfile] = useState('');
  const [periodization, setPeriodization] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => {
        setProfile(data.profile || '');
        setPeriodization(data.periodization || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
        Athlete Profile
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Profile</Typography>
              <MarkdownRenderer content={profile || 'No athlete profile found.'} />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Periodization</Typography>
              <MarkdownRenderer content={periodization || 'No periodization plan found.'} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
