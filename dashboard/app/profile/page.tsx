'use client';

import { useEffect, useState } from 'react';
import {
  Typography, Box, Card, CardContent, Grid, CircularProgress,
  Accordion, AccordionSummary, AccordionDetails, Link as MuiLink,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Link from 'next/link';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import type { ExtendedGarminSummary } from '@/lib/types';
import type { Race } from '@/lib/types';

interface PhaseInfo {
  number: number;
  name: string;
  dateRange: string;
  isCurrent: boolean;
  weightTarget: string;
  focus: string[];
}

interface PeriodizationResponse {
  phases: PhaseInfo[];
  currentPhase: PhaseInfo;
  currentWeek: number;
  targets: {
    raceWeight: string;
    stretchWeight: string;
    protein: string;
    calories: string;
  };
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <Card
      sx={{
        height: '100%',
        borderLeft: accent ? '4px solid' : undefined,
        borderLeftColor: accent ? 'primary.main' : undefined,
      }}
    >
      <CardContent sx={{ py: 2, px: 2.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5, lineHeight: 1.2 }}>
          {value}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
            {sub}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState('');
  const [periodization, setPeriodization] = useState('');
  const [loading, setLoading] = useState(true);
  const [garminSummary, setGarminSummary] = useState<ExtendedGarminSummary | null>(null);
  const [periodizationData, setPeriodizationData] = useState<PeriodizationResponse | null>(null);
  const [nextRace, setNextRace] = useState<Race | null>(null);

  useEffect(() => {
    const profileFetch = fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => {
        setProfile(data.profile || '');
        setPeriodization(data.periodization || '');
      })
      .catch(() => {});

    const garminFetch = fetch('/api/garmin')
      .then((r) => r.json())
      .then((data) => setGarminSummary(data.summary || null))
      .catch(() => {});

    const periodizationFetch = fetch('/api/periodization')
      .then((r) => r.json())
      .then((data: PeriodizationResponse) => setPeriodizationData(data))
      .catch(() => {});

    const racesFetch = fetch('/api/races')
      .then((r) => r.json())
      .then((data: { races: Race[] }) => {
        const today = new Date().toISOString().split('T')[0];
        const upcoming = (data.races || [])
          .filter((r) => r.date >= today && r.status !== 'completed')
          .sort((a, b) => a.date.localeCompare(b.date));
        setNextRace(upcoming[0] || null);
      })
      .catch(() => {});

    Promise.all([profileFetch, garminFetch, periodizationFetch, racesFetch]).finally(() =>
      setLoading(false)
    );
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const currentPhase = periodizationData?.currentPhase;
  const currentWeight = garminSummary?.weight;
  const raceCountdown = nextRace ? daysUntil(nextRace.date) : null;

  return (
    <Box>
      {/* Breadcrumb */}
      <Box sx={{ mb: 2 }}>
        <MuiLink component={Link} href="/" underline="hover" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
          ← Dashboard
        </MuiLink>
      </Box>

      <Typography variant="h3" fontWeight={700} sx={{ mb: 4 }}>
        Athlete Profile
      </Typography>

      {/* Quick-glance stat cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            label="Current Phase"
            value={currentPhase ? `Phase ${currentPhase.number}` : '—'}
            sub={currentPhase?.name}
            accent
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            label="Current Weight"
            value={currentWeight ? `${currentWeight.toFixed(1)} kg` : '—'}
            sub="Latest Garmin reading"
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            label="Race Weight Target"
            value="89 kg"
            sub="Stretch: 87 kg"
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            label="Next Race"
            value={raceCountdown !== null ? `${raceCountdown}d` : '—'}
            sub={nextRace ? nextRace.name : 'No upcoming races'}
          />
        </Grid>
      </Grid>

      {/* Phase badge */}
      {currentPhase && (
        <Box sx={{ mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip label={`Week ${periodizationData?.currentWeek}`} size="small" color="primary" />
          <Chip label={currentPhase.dateRange} size="small" variant="outlined" />
          {currentPhase.focus.slice(0, 3).map((f, i) => (
            <Chip key={i} label={f} size="small" variant="outlined" sx={{ color: 'text.secondary' }} />
          ))}
        </Box>
      )}

      {/* Collapsible markdown sections */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
        <Accordion defaultExpanded disableGutters elevation={1} sx={{ borderRadius: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6" fontWeight={600}>
              Athlete Profile
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <MarkdownRenderer content={profile || 'No athlete profile found.'} />
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded disableGutters elevation={1} sx={{ borderRadius: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6" fontWeight={600}>
              Periodization Plan
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <MarkdownRenderer content={periodization || 'No periodization plan found.'} />
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Navigation links */}
      <Box
        sx={{
          display: 'flex',
          gap: 3,
          flexWrap: 'wrap',
          pt: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <MuiLink component={Link} href="/trends" underline="hover" color="primary" fontWeight={500}>
          View Trends →
        </MuiLink>
        <MuiLink component={Link} href="/dexa" underline="hover" color="primary" fontWeight={500}>
          View DEXA Scans →
        </MuiLink>
        <MuiLink component={Link} href="/races" underline="hover" color="primary" fontWeight={500}>
          View Races →
        </MuiLink>
      </Box>
    </Box>
  );
}
