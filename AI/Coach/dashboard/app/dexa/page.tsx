'use client';

import React, { useEffect, useState } from 'react';
import {
  Typography, Box, Card, CardContent, Grid, TextField, Button,
  Alert, Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Divider, CircularProgress, IconButton, Tooltip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import type { DexaScan, DexaData } from '@/lib/types';

const EMPTY_FORM = {
  scanNumber: '' as string,
  date: '',
  phase: '',
  totalBodyFatPct: '',
  totalLeanMassKg: '',
  fatMassKg: '',
  boneMineralDensityGcm2: '',
  boneMassKg: '',
  weightAtScanKg: '',
  trunkFatPct: '',
  armsFatPct: '',
  legsFatPct: '',
  trunkLeanKg: '',
  armsLeanKg: '',
  legsLeanKg: '',
  notes: '',
};

export default function DexaPage() {
  const [data, setData] = useState<DexaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [driftWarning, setDriftWarning] = useState('');

  const fetchData = async () => {
    try {
      const res = await fetch('/api/dexa');
      if (!res.ok) throw new Error('Failed to load DEXA data');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load DEXA data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setDriftWarning('');
    setSaving(true);

    const scanNumber = parseInt(form.scanNumber);
    if (![1, 2, 3].includes(scanNumber)) {
      setError('Scan number must be 1, 2, or 3');
      setSaving(false);
      return;
    }

    // Client-side validation for required numeric fields
    const requiredNumeric = [
      { key: 'totalBodyFatPct', label: 'Total Body Fat %' },
      { key: 'totalLeanMassKg', label: 'Total Lean Mass' },
      { key: 'fatMassKg', label: 'Fat Mass' },
      { key: 'boneMineralDensityGcm2', label: 'Bone Mineral Density' },
      { key: 'boneMassKg', label: 'Bone Mass' },
      { key: 'weightAtScanKg', label: 'Weight at Scan' },
    ];
    for (const { key, label } of requiredNumeric) {
      const val = form[key as keyof typeof form];
      if (val === '' || isNaN(parseFloat(val.replace(',', '.')))) {
        setError(`${label} is required and must be a number`);
        setSaving(false);
        return;
      }
    }
    if (!form.date) {
      setError('Date is required');
      setSaving(false);
      return;
    }
    if (!form.phase.trim()) {
      setError('Phase is required');
      setSaving(false);
      return;
    }

    // Handle European comma-decimal format (e.g. "62,446" → 62.446)
    const parseLocaleNum = (v: string) => parseFloat(v.replace(',', '.'));
    const numOrNull = (v: string) => v === '' ? null : parseLocaleNum(v);
    const body = {
      scanNumber,
      date: form.date,
      phase: form.phase,
      totalBodyFatPct: parseLocaleNum(form.totalBodyFatPct),
      totalLeanMassKg: parseLocaleNum(form.totalLeanMassKg),
      fatMassKg: parseLocaleNum(form.fatMassKg),
      boneMineralDensityGcm2: parseLocaleNum(form.boneMineralDensityGcm2),
      boneMassKg: parseLocaleNum(form.boneMassKg),
      weightAtScanKg: parseLocaleNum(form.weightAtScanKg),
      trunkFatPct: numOrNull(form.trunkFatPct),
      armsFatPct: numOrNull(form.armsFatPct),
      legsFatPct: numOrNull(form.legsFatPct),
      trunkLeanKg: numOrNull(form.trunkLeanKg),
      armsLeanKg: numOrNull(form.armsLeanKg),
      legsLeanKg: numOrNull(form.legsLeanKg),
      notes: form.notes,
    };

    try {
      const res = await fetch('/api/dexa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'Failed to save');
        setSaving(false);
        return;
      }
      setSuccess(`Scan #${scanNumber} saved successfully.`);
      if (result.driftWarning) {
        setDriftWarning(result.driftWarning);
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const scans = data?.scans || [];
  const calibration = data?.latest_calibration;
  const nextScanNumber = scans.length < 3 ? (scans.length + 1) as 1 | 2 | 3 : null;

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        DEXA Scans
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Ground truth body composition. 3 scans planned: March 2026, November 2026, May 2027.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {driftWarning && <Alert severity="warning" sx={{ mb: 2 }}>{driftWarning}</Alert>}

      {/* Existing scans table */}
      {scans.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Scan History</Typography>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Phase</TableCell>
                    <TableCell>Weight</TableCell>
                    <TableCell>Body Fat %</TableCell>
                    <TableCell>Lean Mass</TableCell>
                    <TableCell>Fat Mass</TableCell>
                    <TableCell>BMD</TableCell>
                    <TableCell>Garmin BF%</TableCell>
                    <TableCell>BF Offset</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {scans.map((s: DexaScan) => (
                    <TableRow key={s.scanNumber}>
                      <TableCell>{s.scanNumber}</TableCell>
                      <TableCell>{s.date}</TableCell>
                      <TableCell>{s.phase}</TableCell>
                      <TableCell>{s.weightAtScanKg} kg</TableCell>
                      <TableCell>{s.totalBodyFatPct}%</TableCell>
                      <TableCell>{s.totalLeanMassKg} kg</TableCell>
                      <TableCell>{s.fatMassKg} kg</TableCell>
                      <TableCell>{s.boneMineralDensityGcm2} g/cm²</TableCell>
                      <TableCell>{s.garminBodyFatPct != null ? `${s.garminBodyFatPct}%` : '—'}</TableCell>
                      <TableCell>
                        {s.garminBodyFatPct != null
                          ? `${s.calibration.bodyFatOffsetPct > 0 ? '+' : ''}${s.calibration.bodyFatOffsetPct.toFixed(1)}%`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Edit scan">
                          <IconButton size="small" onClick={() => {
                            setForm({
                              scanNumber: String(s.scanNumber),
                              date: s.date,
                              phase: s.phase,
                              totalBodyFatPct: String(s.totalBodyFatPct),
                              totalLeanMassKg: String(s.totalLeanMassKg),
                              fatMassKg: String(s.fatMassKg),
                              boneMineralDensityGcm2: String(s.boneMineralDensityGcm2),
                              boneMassKg: String(s.boneMassKg),
                              weightAtScanKg: String(s.weightAtScanKg),
                              trunkFatPct: s.regional.trunkFatPct != null ? String(s.regional.trunkFatPct) : '',
                              armsFatPct: s.regional.armsFatPct != null ? String(s.regional.armsFatPct) : '',
                              legsFatPct: s.regional.legsFatPct != null ? String(s.regional.legsFatPct) : '',
                              trunkLeanKg: s.regional.trunkLeanKg != null ? String(s.regional.trunkLeanKg) : '',
                              armsLeanKg: s.regional.armsLeanKg != null ? String(s.regional.armsLeanKg) : '',
                              legsLeanKg: s.regional.legsLeanKg != null ? String(s.regional.legsLeanKg) : '',
                              notes: s.notes,
                            });
                            setShowForm(true);
                            setError('');
                            setSuccess('');
                            setDriftWarning('');
                          }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {calibration && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Latest Calibration: Garmin {calibration.bodyFatOffsetPct > 0 ? 'underreads' : 'overreads'} BF by {Math.abs(calibration.bodyFatOffsetPct).toFixed(1)}% | Lean mass delta: {calibration.leanMassOffsetKg > 0 ? '+' : ''}{calibration.leanMassOffsetKg.toFixed(1)} kg
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add scan form */}
      {!showForm && nextScanNumber && (
        <Button variant="contained" onClick={() => {
          setForm({ ...EMPTY_FORM, scanNumber: String(nextScanNumber) });
          setShowForm(true);
          setError('');
          setSuccess('');
          setDriftWarning('');
        }}>
          Add Scan #{nextScanNumber}
        </Button>
      )}

      {showForm && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Add DEXA Scan</Typography>

            <Grid container spacing={2}>
              {/* Core measurements */}
              <Grid size={12}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                  Core Measurements
                </Typography>
                <Divider />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField label="Scan #" value={form.scanNumber} onChange={handleChange('scanNumber')} fullWidth size="small" type="number" inputProps={{ min: 1, max: 3 }} />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField label="Date" value={form.date} onChange={handleChange('date')} fullWidth size="small" type="date" slotProps={{ inputLabel: { shrink: true } }} />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField label="Phase" value={form.phase} onChange={handleChange('phase')} fullWidth size="small" placeholder="e.g. Phase 1" />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField label="Weight at Scan (kg)" value={form.weightAtScanKg} onChange={handleChange('weightAtScanKg')} fullWidth size="small" type="number" inputProps={{ step: 0.1 }} />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField label="Total Body Fat %" value={form.totalBodyFatPct} onChange={handleChange('totalBodyFatPct')} fullWidth size="small" type="number" inputProps={{ step: 0.1 }} />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField label="Total Lean Mass (kg)" value={form.totalLeanMassKg} onChange={handleChange('totalLeanMassKg')} fullWidth size="small" type="number" inputProps={{ step: 0.1 }} />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField label="Fat Mass (kg)" value={form.fatMassKg} onChange={handleChange('fatMassKg')} fullWidth size="small" type="number" inputProps={{ step: 0.1 }} />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField label="Bone Mineral Density (g/cm²)" value={form.boneMineralDensityGcm2} onChange={handleChange('boneMineralDensityGcm2')} fullWidth size="small" type="number" inputProps={{ step: 0.001 }} />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField label="Bone Mass (kg)" value={form.boneMassKg} onChange={handleChange('boneMassKg')} fullWidth size="small" type="number" inputProps={{ step: 0.01 }} />
              </Grid>

              {/* Regional (optional) */}
              <Grid size={12}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
                  Regional Breakdown (optional — some regions may be mirrored due to scanner bed size)
                </Typography>
                <Divider />
              </Grid>
              <Grid size={{ xs: 6, md: 4 }}>
                <TextField label="Trunk Fat %" value={form.trunkFatPct} onChange={handleChange('trunkFatPct')} fullWidth size="small" type="number" inputProps={{ step: 0.1 }} />
              </Grid>
              <Grid size={{ xs: 6, md: 4 }}>
                <TextField label="Arms Fat %" value={form.armsFatPct} onChange={handleChange('armsFatPct')} fullWidth size="small" type="number" inputProps={{ step: 0.1 }} />
              </Grid>
              <Grid size={{ xs: 6, md: 4 }}>
                <TextField label="Legs Fat %" value={form.legsFatPct} onChange={handleChange('legsFatPct')} fullWidth size="small" type="number" inputProps={{ step: 0.1 }} />
              </Grid>
              <Grid size={{ xs: 6, md: 4 }}>
                <TextField label="Trunk Lean (kg)" value={form.trunkLeanKg} onChange={handleChange('trunkLeanKg')} fullWidth size="small" type="number" inputProps={{ step: 0.1 }} />
              </Grid>
              <Grid size={{ xs: 6, md: 4 }}>
                <TextField label="Arms Lean (kg)" value={form.armsLeanKg} onChange={handleChange('armsLeanKg')} fullWidth size="small" type="number" inputProps={{ step: 0.1 }} />
              </Grid>
              <Grid size={{ xs: 6, md: 4 }}>
                <TextField label="Legs Lean (kg)" value={form.legsLeanKg} onChange={handleChange('legsLeanKg')} fullWidth size="small" type="number" inputProps={{ step: 0.1 }} />
              </Grid>

              {/* Notes */}
              <Grid size={12}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
                  Notes
                </Typography>
                <Divider />
              </Grid>
              <Grid size={12}>
                <TextField label="Notes" value={form.notes} onChange={handleChange('notes')} fullWidth size="small" multiline rows={2} />
              </Grid>

              {/* Actions */}
              <Grid size={12}>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <Button variant="contained" onClick={handleSubmit} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Scan'}
                  </Button>
                  <Button variant="outlined" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>
                    Cancel
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Garmin pairing is auto-populated from the nearest body composition reading in the Garmin export.
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {scans.length === 0 && !showForm && (
        <Alert severity="info" sx={{ mt: 2 }}>
          No DEXA scans recorded yet. Add your first scan to establish ground truth body composition.
        </Alert>
      )}
    </Box>
  );
}
