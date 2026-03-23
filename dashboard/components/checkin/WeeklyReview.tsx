'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  LinearProgress,
  TextField,
  Typography,
  Alert,
  Button,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import { cardContentSx } from '@/lib/theme';
import { semanticColors } from '@/lib/design-tokens';
import type { WeeklyReviewData } from '@/app/api/checkin/review/route';

// ── Category chip styles ──────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { bg: string; color: string }> = {
  injury:   { bg: '#ffedd5', color: '#c2410c' },
  sleep:    { bg: '#ede9fe', color: '#6d28d9' },
  training: { bg: '#dbeafe', color: '#1d4ed8' },
  life:     { bg: '#fef3c7', color: '#b45309' },
  other:    { bg: '#f1f5f9', color: '#64748b' },
};

const PAIN_LABELS = ['None', 'Mild', 'Moderate', 'Stop'];

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{
        fontSize: '0.6875rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color: '#94a3b8',
        mb: 1,
        display: 'block',
      }}
    >
      {children}
    </Typography>
  );
}

function ComplianceRow({
  label,
  done,
  total,
}: {
  label: string;
  done: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  const color =
    pct >= 70 ? semanticColors.recovery.good
    : pct >= 40 ? semanticColors.recovery.caution
    : semanticColors.recovery.problem;

  return (
    <Box sx={{ mb: 1.25 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" fontWeight={500}>{label}</Typography>
        <Typography variant="body2" fontWeight={700} sx={{ color }}>
          {done}/{total}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 5,
          borderRadius: 3,
          bgcolor: '#e2e8f0',
          '& .MuiLinearProgress-bar': { bgcolor: color },
        }}
      />
    </Box>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const H = 32;
  const W = 120;
  const pad = 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x},${y}`;
  });
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GarminBadge({
  status,
  ageHours,
  hasData,
  onSync,
  syncing,
}: {
  status: 'fresh' | 'stale' | 'old';
  ageHours: number;
  hasData: boolean;
  onSync: () => void;
  syncing: boolean;
}) {
  const color =
    !hasData ? semanticColors.recovery.problem
    : status === 'fresh' ? semanticColors.recovery.good
    : status === 'stale' ? semanticColors.recovery.caution
    : semanticColors.recovery.problem;

  const label =
    !hasData ? 'No data'
    : status === 'fresh' ? `Fresh (${Math.round(ageHours)}h ago)`
    : status === 'stale' ? `Stale (${Math.round(ageHours)}h ago)`
    : `Old (${Math.round(ageHours)}h ago)`;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: color,
          flexShrink: 0,
        }}
      />
      <Typography variant="body2" sx={{ color, fontWeight: 600 }}>
        {label}
      </Typography>
      <Button
        size="small"
        variant="outlined"
        startIcon={syncing ? <CircularProgress size={12} /> : <SyncIcon sx={{ fontSize: 14 }} />}
        onClick={onSync}
        disabled={syncing}
        sx={{ ml: 'auto', fontSize: '0.75rem', py: 0.25, px: 1 }}
      >
        {syncing ? 'Syncing...' : 'Sync'}
      </Button>
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface WeeklyReviewProps {
  weekNumber: number;
  annotation: string;
  onAnnotationChange: (value: string) => void;
}

export default function WeeklyReview({
  weekNumber,
  annotation,
  onAnnotationChange,
}: WeeklyReviewProps) {
  const [data, setData] = useState<WeeklyReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/checkin/review?week=${weekNumber}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: WeeklyReviewData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review data');
    } finally {
      setLoading(false);
    }
  }, [weekNumber]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/garmin/sync', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error ?? 'No data available'}
      </Alert>
    );
  }

  const { compliance, sessions, garmin } = data;
  const taggedNotes = compliance.tagged_notes;

  // Build day-indexed energy + pain arrays for sparklines (7 values, null-filled)
  const energyValues = compliance.energy_levels.map((e) => e.level);
  const painValues = compliance.pain_days.map((p) => p.level);

  // Group tagged notes by date
  const notesByDate: Record<string, typeof taggedNotes> = {};
  for (const note of taggedNotes) {
    if (!notesByDate[note.date]) notesByDate[note.date] = [];
    notesByDate[note.date].push(note);
  }

  const vampirePct =
    compliance.vampire.total > 0
      ? Math.round((compliance.vampire.compliant / compliance.vampire.total) * 100)
      : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* ── Sessions ─────────────────────────────────────────────────── */}
      <Box>
        <SectionHeader>Sessions This Week</SectionHeader>
        {sessions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No completed sessions logged this week.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {sessions.map((s) => {
              const complianceColor =
                s.compliancePct == null ? '#94a3b8'
                : s.compliancePct >= 80 ? semanticColors.recovery.good
                : s.compliancePct >= 50 ? semanticColors.recovery.caution
                : semanticColors.recovery.problem;
              return (
                <Card key={`${s.date}-${s.sessionTitle}`} variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ ...cardContentSx, py: '10px !important' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          {s.sessionTitle}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {s.date} &middot; {s.sessionType}
                        </Typography>
                      </Box>
                      {s.compliancePct != null && (
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          sx={{ color: complianceColor, flexShrink: 0 }}
                        >
                          {s.compliancePct}%
                        </Typography>
                      )}
                    </Box>
                    {(s.sets.length > 0 || s.cardio.length > 0) && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {s.sets.length > 0 && `${s.sets.filter((x) => x.completed).length}/${s.sets.length} sets`}
                        {s.sets.length > 0 && s.cardio.length > 0 && ' · '}
                        {s.cardio.length > 0 && `${s.cardio.filter((x) => x.completed).length}/${s.cardio.length} cardio blocks`}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
      </Box>

      {/* ── Compliance ────────────────────────────────────────────────── */}
      <Box>
        <SectionHeader>Protocol Compliance</SectionHeader>
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent sx={cardContentSx}>
            <ComplianceRow
              label="Workouts"
              done={compliance.workouts.completed}
              total={compliance.workouts.planned}
            />
            <ComplianceRow label="Core Work (3/wk target)" done={compliance.core.done} total={compliance.core.target} />
            <ComplianceRow label="Rug Protocol" done={compliance.rug_protocol.done} total={7} />
            <ComplianceRow label="Vampire Bedtime" done={compliance.vampire.compliant} total={7} />
            <ComplianceRow label="Kitchen Cutoff" done={compliance.kitchen_cutoff.hit} total={7} />
            <ComplianceRow label="Hydration Tracked" done={compliance.hydration.tracked} total={7} />

            {compliance.vampire.avg_bedtime && (
              <Typography variant="caption" color="text.secondary">
                Avg bedtime: {compliance.vampire.avg_bedtime}
                {vampirePct < 80 && (
                  <Box
                    component="span"
                    sx={{ color: semanticColors.recovery.problem, ml: 1, fontWeight: 600 }}
                  >
                    {vampirePct}% compliant — Vampire Protocol enforcement required
                  </Box>
                )}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* ── Energy & Pain sparklines ──────────────────────────────────── */}
      {(energyValues.length > 0 || painValues.length > 0) && (
        <Box>
          <SectionHeader>Energy & Pain (7-day)</SectionHeader>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={cardContentSx}>
              <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {energyValues.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      Energy (1-5)
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      {energyValues.length >= 2 ? (
                        <Sparkline values={energyValues} color={semanticColors.recovery.good} />
                      ) : (
                        <Typography variant="body2" fontWeight={700}>
                          {energyValues[0]}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.75 }}>
                      {compliance.energy_levels.map((e) => (
                        <Chip
                          key={e.date}
                          label={`${e.date.slice(5)} · ${e.level}`}
                          size="small"
                          sx={{ fontSize: '0.6875rem', height: 20 }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {painValues.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      Pain flags
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                      {compliance.pain_days.map((p) => (
                        <Box key={p.date} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {p.date.slice(5)}
                          </Typography>
                          <Chip
                            label={PAIN_LABELS[p.level] ?? p.level}
                            size="small"
                            sx={{
                              fontSize: '0.6875rem',
                              height: 20,
                              bgcolor: p.level >= 2 ? '#ffedd5' : '#f1f5f9',
                              color: p.level >= 2 ? '#c2410c' : '#64748b',
                            }}
                          />
                          {p.area && (
                            <Typography variant="caption" color="text.secondary">
                              {p.area}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ── Sleep disruptions ─────────────────────────────────────────── */}
      {compliance.sleep_disruptions.length > 0 && (
        <Box>
          <SectionHeader>Sleep Disruptions</SectionHeader>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={cardContentSx}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {compliance.sleep_disruptions.map((d) => (
                  <Box key={d.date} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
                      {d.date.slice(5)}
                    </Typography>
                    <Chip
                      label={d.type}
                      size="small"
                      sx={{
                        fontSize: '0.6875rem',
                        height: 20,
                        bgcolor: '#ede9fe',
                        color: '#6d28d9',
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ── Tagged notes ──────────────────────────────────────────────── */}
      {taggedNotes.length > 0 && (
        <Box>
          <SectionHeader>Notes This Week</SectionHeader>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={cardContentSx}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {Object.entries(notesByDate).map(([date, notes]) => (
                  <Box key={date}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {date.slice(5)}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                      {notes.map((note, idx) => {
                        const style = CATEGORY_STYLES[note.category] ?? CATEGORY_STYLES.other;
                        return (
                          <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                            <Chip
                              label={note.category}
                              size="small"
                              sx={{
                                bgcolor: style.bg,
                                color: style.color,
                                fontWeight: 600,
                                fontSize: '0.6875rem',
                                height: 20,
                                flexShrink: 0,
                              }}
                            />
                            <Typography variant="body2" sx={{ lineHeight: 1.5, mt: '1px' }}>
                              {note.text}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ── Garmin ────────────────────────────────────────────────────── */}
      <Box>
        <SectionHeader>Garmin Data</SectionHeader>
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent sx={cardContentSx}>
            <GarminBadge
              status={garmin.status}
              ageHours={garmin.ageHours}
              hasData={garmin.hasData}
              onSync={handleSync}
              syncing={syncing}
            />
            {syncError && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                {syncError}
              </Alert>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* ── Annotation ────────────────────────────────────────────────── */}
      <Box>
        <SectionHeader>Anything the logs don&apos;t capture?</SectionHeader>
        <TextField
          fullWidth
          multiline
          minRows={3}
          maxRows={8}
          placeholder="Travel, illness, unusual stress, equipment changes... Optional."
          value={annotation}
          onChange={(e) => onAnnotationChange(e.target.value)}
          variant="outlined"
          size="small"
        />
      </Box>
    </Box>
  );
}
