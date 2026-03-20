'use client';

import React, { useEffect, useState } from 'react';
import {
  Typography, Box, Card, CardContent, Grid, TextField, Button,
  Alert, IconButton, Tooltip, Chip, MenuItem, Select, FormControl, InputLabel,
  LinearProgress, Accordion, AccordionSummary, AccordionDetails,
  type SelectChangeEvent,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import type { Race, RaceStatus } from '@/lib/types';

const STATUS_COLORS: Record<RaceStatus, 'success' | 'warning' | 'default' | 'info'> = {
  registered: 'success',
  planned: 'warning',
  tentative: 'default',
  completed: 'info',
};

const STATUS_BORDER: Record<RaceStatus, string> = {
  registered: '#4caf50',
  planned: '#ff9800',
  tentative: '#9e9e9e',
  completed: '#2196f3',
};

const EMPTY_FORM = {
  id: '',
  name: '',
  date: '',
  location: '',
  type: '',
  status: 'planned' as RaceStatus,
  notes: '',
};

// Program epoch: Monday Dec 29, 2025
const PROGRAM_EPOCH = new Date('2025-12-29').getTime();

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatCountdown(days: number): string {
  if (days === 0) return 'Today';
  if (days < 0) return 'Past';
  const weeks = Math.floor(days / 7);
  const rem = days % 7;
  if (weeks === 0) return `${rem}d`;
  if (rem === 0) return `${weeks}w`;
  return `${weeks}w ${rem}d`;
}

/** Percent of training journey elapsed toward a future race date */
function journeyProgress(dateStr: string): number {
  const raceTs = new Date(dateStr).getTime();
  const now = Date.now();
  const total = raceTs - PROGRAM_EPOCH;
  const elapsed = now - PROGRAM_EPOCH;
  if (total <= 0) return 100;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

interface RaceCardProps {
  race: Race;
  confirmDelete: string | null;
  onEdit: (race: Race) => void;
  onDelete: (id: string) => void;
  onConfirmDelete: (id: string | null) => void;
}

function RaceCard({ race, confirmDelete, onEdit, onDelete, onConfirmDelete }: RaceCardProps) {
  const days = daysUntil(race.date);
  const isPast = days <= 0;
  const progress = isPast ? 100 : journeyProgress(race.date);
  const borderColor = STATUS_BORDER[race.status];

  return (
    <Card
      sx={{
        borderLeft: `4px solid ${borderColor}`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* Header row: name + status chip */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            {race.name}
          </Typography>
          <Chip
            label={race.status}
            color={STATUS_COLORS[race.status]}
            size="small"
            sx={{ flexShrink: 0, mt: 0.25 }}
          />
        </Box>

        {/* Countdown */}
        <Box>
          <Typography
            variant="h3"
            fontWeight={800}
            color={isPast ? 'text.disabled' : 'text.primary'}
            sx={{ lineHeight: 1, letterSpacing: '-0.5px' }}
          >
            {formatCountdown(days)}
          </Typography>
          {!isPast && (
            <Box sx={{ mt: 1 }}>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 4,
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': { borderRadius: 2 },
                }}
              />
              <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25, display: 'block' }}>
                {Math.round(progress)}% of training journey elapsed
              </Typography>
            </Box>
          )}
        </Box>

        {/* Meta */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
          {race.date && (
            <Typography variant="body2" color="text.secondary">
              {race.date}
            </Typography>
          )}
          {race.location && (
            <Typography variant="body2" color="text.secondary">
              · {race.location}
            </Typography>
          )}
          {race.type && (
            <Typography variant="body2" color="text.secondary">
              · {race.type}
            </Typography>
          )}
        </Box>

        {/* Notes */}
        {race.notes && (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 'auto', pt: 0.5 }}>
            {race.notes}
          </Typography>
        )}

        {/* Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => onEdit(race)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {confirmDelete === race.id ? (
            <>
              <Button size="small" color="error" onClick={() => onDelete(race.id)}>Confirm</Button>
              <Button size="small" onClick={() => onConfirmDelete(null)}>Cancel</Button>
            </>
          ) : (
            <Tooltip title="Delete">
              <IconButton size="small" onClick={() => onConfirmDelete(race.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

export default function RacesPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchRaces = async () => {
    try {
      const res = await fetch('/api/races');
      if (!res.ok) throw new Error('Failed to load races');
      const json = await res.json();
      setRaces(json.races || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load races');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRaces(); }, []);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleStatusChange = (e: SelectChangeEvent) => {
    setForm((prev) => ({ ...prev, status: e.target.value as RaceStatus }));
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      if (editingId) {
        const res = await fetch(`/api/races/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const result = await res.json();
        if (!res.ok) { setError(result.error || 'Failed to update'); setSaving(false); return; }
        setSuccess(`"${result.race.name}" updated.`);
      } else {
        const res = await fetch('/api/races', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const result = await res.json();
        if (!res.ok) { setError(result.error || 'Failed to save'); setSaving(false); return; }
        setSuccess(`"${result.race.name}" added.`);
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      await fetchRaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (race: Race) => {
    setForm({
      id: race.id,
      name: race.name,
      date: race.date,
      location: race.location,
      type: race.type,
      status: race.status,
      notes: race.notes,
    });
    setEditingId(race.id);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/races/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setSuccess('Race deleted.');
      setConfirmDelete(null);
      await fetchRaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (loading) return null;

  const upcomingRaces = races.filter((r) => daysUntil(r.date) > 0);
  const pastRaces = races.filter((r) => daysUntil(r.date) <= 0);

  const cardProps = { confirmDelete, onEdit: handleEdit, onDelete: handleDelete, onConfirmDelete: setConfirmDelete };

  return (
    <Box>
      <PageBreadcrumb items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Races' },
      ]} />

      <Typography variant="h3" fontWeight={700} sx={{ mb: 4 }}>Races</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage race calendar. Dashboard countdowns and coaching context update automatically.
      </Typography>

      {error && (
        <Alert
          severity="error"
          action={<Button onClick={() => { setError(''); fetchRaces(); }}>Retry</Button>}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Upcoming races */}
      {upcomingRaces.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {upcomingRaces.map((race) => (
            <Grid key={race.id} size={{ xs: 12, md: 6 }}>
              <RaceCard race={race} {...cardProps} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Past races — collapsible */}
      {pastRaces.length > 0 && (
        <Accordion disableGutters sx={{ mb: 3, '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>Past Races ({pastRaces.length})</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Grid container spacing={2}>
              {pastRaces.map((race) => (
                <Grid key={race.id} size={{ xs: 12, md: 6 }}>
                  <RaceCard race={race} {...cardProps} />
                </Grid>
              ))}
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Add button */}
      {!showForm && (
        <Button variant="contained" onClick={() => {
          setForm(EMPTY_FORM);
          setEditingId(null);
          setShowForm(true);
          setError('');
          setSuccess('');
        }}>
          Add Race
        </Button>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {editingId ? 'Edit Race' : 'Add Race'}
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField label="Name" value={form.name} onChange={handleChange('name')} fullWidth size="small" placeholder="e.g. Spartan Zandvoort Super" />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField label="Date" value={form.date} onChange={handleChange('date')} fullWidth size="small" type="date" slotProps={{ inputLabel: { shrink: true } }} />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField label="Location" value={form.location} onChange={handleChange('location')} fullWidth size="small" placeholder="e.g. Zandvoort, Netherlands" />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField label="Type" value={form.type} onChange={handleChange('type')} fullWidth size="small" placeholder="e.g. Spartan Super" />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select value={form.status} label="Status" onChange={handleStatusChange}>
                    <MenuItem value="registered">Registered</MenuItem>
                    <MenuItem value="planned">Planned</MenuItem>
                    <MenuItem value="tentative">Tentative</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField label="Notes" value={form.notes} onChange={handleChange('notes')} fullWidth size="small" multiline rows={2} />
              </Grid>
              <Grid size={12}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button variant="contained" onClick={handleSubmit} disabled={saving}>
                    {saving ? 'Saving...' : editingId ? 'Update Race' : 'Add Race'}
                  </Button>
                  <Button variant="outlined" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setEditingId(null); }}>
                    Cancel
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {races.length === 0 && !showForm && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            No races in the calendar. Add your first race to start tracking countdowns.
          </Typography>
          <Button variant="contained" onClick={() => {
            setForm(EMPTY_FORM);
            setEditingId(null);
            setShowForm(true);
            setError('');
            setSuccess('');
          }}>
            Add Race
          </Button>
        </Box>
      )}
    </Box>
  );
}
