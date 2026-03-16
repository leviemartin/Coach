'use client';

import React, { useEffect, useState } from 'react';
import {
  Typography, Box, Card, CardContent, Grid, TextField, Button,
  Alert, Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  IconButton, Tooltip, Chip, MenuItem, Select, FormControl, InputLabel,
  type SelectChangeEvent,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { Race, RaceStatus } from '@/lib/types';

const STATUS_COLORS: Record<RaceStatus, 'success' | 'warning' | 'default' | 'info'> = {
  registered: 'success',
  planned: 'warning',
  tentative: 'default',
  completed: 'info',
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

  const daysUntil = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (loading) return null;

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>Races</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage race calendar. Dashboard countdowns and coaching context update automatically.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {races.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Race Calendar</Typography>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Countdown</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {races.map((race) => {
                    const days = daysUntil(race.date);
                    return (
                      <TableRow key={race.id}>
                        <TableCell sx={{ fontWeight: 600 }}>{race.name}</TableCell>
                        <TableCell>{race.date}</TableCell>
                        <TableCell>{race.location}</TableCell>
                        <TableCell>{race.type}</TableCell>
                        <TableCell>
                          <Chip label={race.status} color={STATUS_COLORS[race.status]} size="small" />
                        </TableCell>
                        <TableCell>
                          {days > 0 ? `${Math.floor(days / 7)}w ${days % 7}d` : days === 0 ? 'Today' : 'Past'}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {race.notes}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => handleEdit(race)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {confirmDelete === race.id ? (
                              <>
                                <Button size="small" color="error" onClick={() => handleDelete(race.id)}>Confirm</Button>
                                <Button size="small" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                              </>
                            ) : (
                              <Tooltip title="Delete">
                                <IconButton size="small" onClick={() => setConfirmDelete(race.id)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

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
        <Alert severity="info" sx={{ mt: 2 }}>
          No races in the calendar. Add your first race to start tracking countdowns.
        </Alert>
      )}
    </Box>
  );
}
