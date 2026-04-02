'use client';

import React, { useEffect, useState } from 'react';
import {
  Typography, Box, Card, CardContent, Grid, TextField, Button,
  Alert, Divider, IconButton, Tooltip, Chip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageSkeleton from '@/components/PageSkeleton';
import type { DexaScan, DexaData } from '@/lib/types';
import { semanticColors } from '@/lib/design-tokens';

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

// ── Body composition stacked bar ────────────────────────────────────────────
function BodyCompBar({ scan }: { scan: DexaScan }) {
  const total = scan.weightAtScanKg;
  const fatPct = (scan.fatMassKg / total) * 100;
  const leanPct = (scan.totalLeanMassKg / total) * 100;
  const bonePct = (scan.boneMassKg / total) * 100;

  return (
    <Box sx={{ mt: 1.5 }}>
      <Box sx={{ display: 'flex', height: 18, overflow: 'hidden', width: '100%' }}>
        <Tooltip title={`Fat: ${scan.fatMassKg.toFixed(1)} kg (${fatPct.toFixed(1)}%)`}>
          <Box sx={{ width: `${fatPct}%`, bgcolor: semanticColors.recovery.problem, cursor: 'default' }} />
        </Tooltip>
        <Tooltip title={`Lean: ${scan.totalLeanMassKg.toFixed(1)} kg (${leanPct.toFixed(1)}%)`}>
          <Box sx={{ width: `${leanPct}%`, bgcolor: semanticColors.body, cursor: 'default' }} />
        </Tooltip>
        <Tooltip title={`Bone: ${scan.boneMassKg.toFixed(1)} kg (${bonePct.toFixed(1)}%)`}>
          <Box sx={{ width: `${bonePct}%`, bgcolor: '#9e9e9e', cursor: 'default' }} />
        </Tooltip>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mt: 0.75 }}>
        {[
          { label: 'Fat', color: semanticColors.recovery.problem },
          { label: 'Lean', color: semanticColors.body },
          { label: 'Bone', color: '#9e9e9e' },
        ].map(({ label, color }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
            <Typography variant="caption" color="text.secondary">{label}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Single metric display ────────────────────────────────────────────────────
function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant="body1" fontWeight={600}>{value}</Typography>
    </Box>
  );
}

// ── Delta indicator ──────────────────────────────────────────────────────────
function DeltaItem({
  label, delta, unit, lowerIsBetter = false,
}: {
  label: string;
  delta: number;
  unit: string;
  lowerIsBetter?: boolean;
}) {
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  const neutral = Math.abs(delta) < 0.05;
  const color = neutral ? 'text.secondary' : improved ? semanticColors.recovery.good : semanticColors.recovery.problem;
  const sign = delta > 0 ? '+' : '';
  const Icon = delta > 0 ? ArrowUpwardIcon : ArrowDownwardIcon;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box>
        <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          {!neutral && <Icon sx={{ fontSize: 14, color }} />}
          <Typography variant="body2" fontWeight={600} color={color}>
            {sign}{delta.toFixed(1)}{unit}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ── Individual scan card ─────────────────────────────────────────────────────
function ScanCard({ scan, onEdit }: { scan: DexaScan; onEdit: (s: DexaScan) => void }) {
  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
              <Typography variant="h6" fontWeight={700}>Scan #{scan.scanNumber}</Typography>
              <Chip label={scan.phase} size="small" variant="outlined" />
            </Box>
            <Typography variant="body2" color="text.secondary">{scan.date}</Typography>
          </Box>
          <Tooltip title="Edit scan">
            <IconButton size="small" onClick={() => onEdit(scan)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Body comp bar */}
        <BodyCompBar scan={scan} />

        <Divider sx={{ my: 1.5 }} />

        {/* Key metrics grid */}
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 6, sm: 4 }}>
            <MetricItem label="Weight" value={`${scan.weightAtScanKg} kg`} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <MetricItem label="Body Fat" value={`${scan.totalBodyFatPct}%`} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <MetricItem label="Lean Mass" value={`${scan.totalLeanMassKg} kg`} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <MetricItem label="Fat Mass" value={`${scan.fatMassKg} kg`} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <MetricItem label="Bone Mass" value={`${scan.boneMassKg} kg`} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <MetricItem label="BMD" value={`${scan.boneMineralDensityGcm2} g/cm²`} />
          </Grid>
        </Grid>

        {/* Garmin calibration footer */}
        {scan.garminBodyFatPct != null && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            Garmin BF% at scan: {scan.garminBodyFatPct}% — offset {scan.calibration.bodyFatOffsetPct > 0 ? '+' : ''}{scan.calibration.bodyFatOffsetPct.toFixed(1)}% | Lean delta: {scan.calibration.leanMassOffsetKg > 0 ? '+' : ''}{scan.calibration.leanMassOffsetKg.toFixed(1)} kg
          </Typography>
        )}

        {/* Notes */}
        {scan.notes && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
            {scan.notes}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

// ── Delta comparison card ────────────────────────────────────────────────────
function DeltaCard({ from, to }: { from: DexaScan; to: DexaScan }) {
  return (
    <Card sx={{ borderColor: 'primary.main', bgcolor: 'action.hover' }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Scan #{from.scanNumber} → #{to.scanNumber} Changes
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
          {from.date} to {to.date}
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <DeltaItem label="Weight" delta={to.weightAtScanKg - from.weightAtScanKg} unit=" kg" lowerIsBetter />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <DeltaItem label="Body Fat %" delta={to.totalBodyFatPct - from.totalBodyFatPct} unit="%" lowerIsBetter />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <DeltaItem label="Fat Mass" delta={to.fatMassKg - from.fatMassKg} unit=" kg" lowerIsBetter />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <DeltaItem label="Lean Mass" delta={to.totalLeanMassKg - from.totalLeanMassKg} unit=" kg" />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <DeltaItem label="Bone Mass" delta={to.boneMassKg - from.boneMassKg} unit=" kg" />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <DeltaItem label="BMD" delta={to.boneMineralDensityGcm2 - from.boneMineralDensityGcm2} unit=" g/cm²" />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
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

  const handleEdit = (s: DexaScan) => {
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

  const scans = data?.scans || [];
  const calibration = data?.latest_calibration;
  const nextScanNumber = scans.length < 3 ? (scans.length + 1) as 1 | 2 | 3 : null;

  return (
    <Box>
      <PageBreadcrumb items={[
        { label: 'Dashboard', href: '/' },
        { label: 'DEXA Scans' },
      ]} />

      <Typography variant="h3" fontWeight={700} sx={{ mb: 4 }}>
        DEXA Scans
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Ground truth body composition. 3 scans planned: March 2026, November 2026, May 2027.
      </Typography>

      {error && (
        <Alert
          severity="error"
          action={<Button onClick={() => { setError(''); fetchData(); }}>Retry</Button>}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}
      {loading && !error && <PageSkeleton variant="cards" />}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {driftWarning && <Alert severity="warning" sx={{ mb: 2 }}>{driftWarning}</Alert>}

      {/* Scan cards */}
      {scans.length > 0 && (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {scans.map((s: DexaScan) => (
              <Grid key={s.scanNumber} size={{ xs: 12, md: 6 }}>
                <ScanCard scan={s} onEdit={handleEdit} />
              </Grid>
            ))}
          </Grid>

          {/* Delta comparison — shown when 2+ scans exist */}
          {scans.length >= 2 && (
            <Box sx={{ mb: 2 }}>
              <DeltaCard from={scans[scans.length - 2]} to={scans[scans.length - 1]} />
            </Box>
          )}

          {/* Calibration footer */}
          {calibration && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
              Active Garmin calibration: BF {calibration.bodyFatOffsetPct > 0 ? 'underreads' : 'overreads'} by {Math.abs(calibration.bodyFatOffsetPct).toFixed(1)}% | Lean mass delta: {calibration.leanMassOffsetKg > 0 ? '+' : ''}{calibration.leanMassOffsetKg.toFixed(1)} kg
            </Typography>
          )}
        </>
      )}

      {/* Add scan button */}
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

      {/* Add / edit form — unchanged */}
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

      {scans.length === 0 && !showForm && !loading && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            No DEXA scans recorded yet. Add your first scan to establish ground truth body composition.
          </Typography>
          <Button variant="contained" onClick={() => {
            setForm({ ...EMPTY_FORM, scanNumber: '1' });
            setShowForm(true);
            setError('');
            setSuccess('');
            setDriftWarning('');
          }}>
            Add DEXA Scan
          </Button>
        </Box>
      )}
    </Box>
  );
}
