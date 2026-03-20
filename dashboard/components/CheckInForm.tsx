'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Stepper, Step, StepLabel, Button, Box, Typography, Card, CardContent,
  TextField, Slider, Switch, FormControlLabel, Select, MenuItem, FormControl,
  InputLabel, Alert, Chip, CircularProgress, LinearProgress,
} from '@mui/material';
import { cardContentSx } from '@/lib/theme';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import type { CheckInFormData } from '@/lib/types';
import { getTrainingWeek } from '@/lib/week';

const STEPS = ['Garmin Data', 'Hevy Training Log', 'Subjective Check-In', 'Review & Submit'];

interface GarminStatus {
  timestamp: string;
  ageHours: number;
  status: 'fresh' | 'stale' | 'old';
  summary: {
    avgSleep: number | null;
    avgReadiness: number | null;
    avgRhr: number | null;
    weight: number | null;
    activityCount: number;
  } | null;
}

interface CheckInFormProps {
  onSubmit: (data: CheckInFormData) => void;
  loading?: boolean;
}

export default function CheckInForm({ onSubmit, loading = false }: CheckInFormProps) {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const stepLabels = isSmall
    ? ['Garmin', 'Hevy', 'Survey', 'Review']
    : STEPS;

  const [activeStep, setActiveStep] = useState(0);
  const [garminStatus, setGarminStatus] = useState<GarminStatus | null>(null);
  const [garminLoading, setGarminLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [syncElapsed, setSyncElapsed] = useState(0);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [formData, setFormData] = useState<CheckInFormData>({
    hevyCsv: '',
    bakerCystPain: 0,
    lowerBackFatigue: 0,
    sessionsCompleted: 0,
    sessionsPlanned: 5,
    missedSessions: '',
    strengthWins: '',
    struggles: '',
    bedtimeCompliance: 0,
    rugProtocolDays: 0,
    hydrationTracked: false,
    upcomingConflicts: '',
    focusNextWeek: '',
    questionsForCoaches: '',
    perceivedReadiness: 3,
    planSatisfaction: 3,
    planFeedback: '',
    model: 'sonnet',
  });

  const [prefilledFromLogs, setPrefilledFromLogs] = useState(false);
  const syncAbortRef = useRef<AbortController | null>(null);

  const refreshGarminStatus = useCallback(() => {
    setGarminLoading(true);
    return fetch('/api/garmin')
      .then((r) => r.json())
      .then(setGarminStatus)
      .catch(() => setGarminStatus(null))
      .finally(() => setGarminLoading(false));
  }, []);

  useEffect(() => {
    refreshGarminStatus();
  }, [refreshGarminStatus]);

  useEffect(() => {
    const currentWeek = getTrainingWeek(new Date());
    fetch(`/api/log/week-summary?week=${currentWeek}`)
      .then(res => res.json())
      .then(summary => {
        if (summary.days_logged > 0) {
          setFormData(prev => ({
            ...prev,
            sessionsCompleted: summary.workouts.completed,
            rugProtocolDays: summary.rug_protocol.done,
            bedtimeCompliance: summary.vampire.compliant,
            hydrationTracked: summary.hydration.tracked > 0,
          }));
          setPrefilledFromLogs(true);
        }
      })
      .catch(() => {}); // Silent fail — form works without pre-fill
  }, []);

  useEffect(() => {
    return () => {
      syncAbortRef.current?.abort();
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
    };
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncSuccess(false);
    setSyncElapsed(0);
    const controller = new AbortController();
    syncAbortRef.current = controller;
    syncTimerRef.current = setInterval(() => {
      setSyncElapsed((prev) => prev + 1);
    }, 1000);
    try {
      const res = await fetch('/api/garmin/sync', { method: 'POST', signal: controller.signal });
      const data = await res.json();
      if (data.success) {
        setSyncSuccess(true);
        await refreshGarminStatus();
      } else {
        setSyncError(data.error || 'Sync failed');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setSyncError('Network error — could not reach sync endpoint');
      }
    } finally {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      setSyncing(false);
    }
  };

  const update = <K extends keyof CheckInFormData>(key: K, value: CheckInFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleNext = () => setActiveStep((prev) => prev + 1);
  const handleBack = () => setActiveStep((prev) => prev - 1);

  const handleSubmit = () => {
    onSubmit(formData);
  };

  const renderStep = () => {
    switch (activeStep) {
      case 0: // Garmin Data
        return (
          <Card>
            <CardContent sx={cardContentSx}>
              <Typography variant="h6" gutterBottom>Garmin Data Status</Typography>
              {garminLoading ? (
                <CircularProgress size={24} />
              ) : garminStatus ? (
                <>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
                    <Chip
                      label={garminStatus.status === 'fresh' ? 'Fresh' : garminStatus.status === 'stale' ? 'Stale' : 'Old'}
                      color={garminStatus.status === 'fresh' ? 'success' : garminStatus.status === 'stale' ? 'warning' : 'error'}
                    />
                    <Typography variant="body2" color="text.secondary">
                      Last updated: {new Date(garminStatus.timestamp).toLocaleString()} ({Math.round(garminStatus.ageHours)}h ago)
                    </Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Button
                      variant={garminStatus.status !== 'fresh' ? 'contained' : 'outlined'}
                      onClick={handleSync}
                      disabled={syncing}
                      startIcon={syncing ? <CircularProgress size={18} color="inherit" /> : null}
                    >
                      {syncing ? `Syncing Garmin data... (${syncElapsed}s elapsed)` : 'Sync Garmin Data'}
                    </Button>
                    {syncing && (
                      <Box aria-live="polite">
                        <LinearProgress aria-label="Syncing Garmin data" sx={{ mt: 1, borderRadius: 1 }} />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          Syncing Garmin data... ({syncElapsed}s elapsed)
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  {syncSuccess && (
                    <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSyncSuccess(false)}>
                      Garmin data synced successfully.
                    </Alert>
                  )}
                  {syncError && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSyncError(null)}>
                      {syncError}
                    </Alert>
                  )}
                  {garminStatus.summary && (
                    <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {garminStatus.summary.weight && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Weight</Typography>
                          <Typography variant="h6">{garminStatus.summary.weight}kg</Typography>
                        </Box>
                      )}
                      {garminStatus.summary.avgSleep && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Avg Sleep Score</Typography>
                          <Typography variant="h6">{garminStatus.summary.avgSleep}</Typography>
                        </Box>
                      )}
                      {garminStatus.summary.avgReadiness && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Avg Readiness</Typography>
                          <Typography variant="h6">{garminStatus.summary.avgReadiness}</Typography>
                        </Box>
                      )}
                      {garminStatus.summary.avgRhr && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Avg RHR</Typography>
                          <Typography variant="h6">{garminStatus.summary.avgRhr} bpm</Typography>
                        </Box>
                      )}
                      <Box>
                        <Typography variant="caption" color="text.secondary">Activities</Typography>
                        <Typography variant="h6">{garminStatus.summary.activityCount}</Typography>
                      </Box>
                    </Box>
                  )}
                </>
              ) : (
                <>
                  <Alert severity="error" sx={{ mb: 2 }}>Could not read Garmin data file.</Alert>
                  <Button
                    variant="contained"
                    onClick={handleSync}
                    disabled={syncing}
                    startIcon={syncing ? <CircularProgress size={18} color="inherit" /> : null}
                  >
                    {syncing ? 'Syncing Garmin... (~20s)' : 'Sync Garmin Data'}
                  </Button>
                  {syncError && (
                    <Alert severity="error" sx={{ mt: 2 }} onClose={() => setSyncError(null)}>
                      {syncError}
                    </Alert>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );

      case 1: // Hevy
        return (
          <Card>
            <CardContent sx={cardContentSx}>
              <Typography variant="h6" gutterBottom>Hevy Training Log</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Export your Hevy data as CSV and paste below. Optional — skip if no gym data this week.
              </Typography>
              <TextField
                multiline
                rows={12}
                fullWidth
                placeholder="Paste Hevy CSV here..."
                value={formData.hevyCsv}
                onChange={(e) => update('hevyCsv', e.target.value)}
                sx={{ fontFamily: 'monospace' }}
              />
            </CardContent>
          </Card>
        );

      case 2: // Subjective
        return (
          <Card>
            <CardContent sx={cardContentSx}>
              <Typography variant="h6" gutterBottom>Subjective Check-In</Typography>

              {prefilledFromLogs && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Pre-filled from daily logs. You can adjust values before submitting.
                </Alert>
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>

                {/* Pain & Injury */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 2 }}>
                    Pain &amp; Injury
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Box>
                      <Typography gutterBottom sx={{ mb: 1 }}>Baker&apos;s Cyst Pain: {formData.bakerCystPain}/10</Typography>
                      <Slider
                        value={formData.bakerCystPain}
                        onChange={(_, v) => update('bakerCystPain', v as number)}
                        min={0} max={10} step={1} marks
                        valueLabelDisplay="auto"
                        sx={{ '& .MuiSlider-thumb': { height: 28, width: 28 } }}
                      />
                    </Box>
                    <Box>
                      <Typography gutterBottom sx={{ mb: 1 }}>Lower Back Fatigue: {formData.lowerBackFatigue}/10</Typography>
                      <Slider
                        value={formData.lowerBackFatigue}
                        onChange={(_, v) => update('lowerBackFatigue', v as number)}
                        min={0} max={10} step={1} marks
                        valueLabelDisplay="auto"
                        sx={{ '& .MuiSlider-thumb': { height: 28, width: 28 } }}
                      />
                    </Box>
                  </Box>
                </Box>

                {/* How Do You Feel? */}
                <Box sx={{ borderTop: '2px solid', borderColor: 'divider', pt: 3 }}>
                  <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 1 }}>
                    How Do You Feel?
                  </Typography>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    How Do You Actually Feel?
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Garmin readiness is one signal. Your body is another. This gets combined with Garmin data (60% you / 40% Garmin) to set training intensity.
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography gutterBottom sx={{ mb: 1 }}>
                      Perceived readiness: {formData.perceivedReadiness}/5
                      {formData.perceivedReadiness === 1 ? ' — Wrecked' : formData.perceivedReadiness === 2 ? ' — Tired but can move' : formData.perceivedReadiness === 3 ? ' — Normal' : formData.perceivedReadiness === 4 ? ' — Feeling strong' : ' — Peaked'}
                    </Typography>
                    <Slider
                      aria-label="Perceived readiness, 1 is wrecked, 5 is peaked"
                      value={formData.perceivedReadiness}
                      onChange={(_, v) => update('perceivedReadiness', v as number)}
                      min={1} max={5} step={1} marks={[
                        { value: 1, label: 'Wrecked' },
                        { value: 2, label: 'Tired' },
                        { value: 3, label: 'Normal' },
                        { value: 4, label: 'Strong' },
                        { value: 5, label: 'Peaked' },
                      ]}
                      valueLabelDisplay="auto"
                      sx={{ '& .MuiSlider-thumb': { height: 28, width: 28 } }}
                    />
                  </Box>
                </Box>

                {/* Training Completion */}
                <Box sx={{ borderTop: '2px solid', borderColor: 'divider', pt: 3 }}>
                  <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 2 }}>
                    Training Completion
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <TextField
                        label="Sessions Completed"
                        type="number"
                        value={formData.sessionsCompleted}
                        onChange={(e) => update('sessionsCompleted', parseInt(e.target.value) || 0)}
                        sx={{ width: 160 }}
                        slotProps={{ htmlInput: { min: 0, max: 7 } }}
                      />
                      <TextField
                        label="Sessions Planned"
                        type="number"
                        value={formData.sessionsPlanned}
                        onChange={(e) => update('sessionsPlanned', parseInt(e.target.value) || 0)}
                        sx={{ width: 160 }}
                        slotProps={{ htmlInput: { min: 0, max: 7 } }}
                      />
                    </Box>
                    <TextField
                      label="Missed Sessions (what and why)"
                      multiline rows={2} fullWidth
                      value={formData.missedSessions}
                      onChange={(e) => update('missedSessions', e.target.value)}
                    />
                    <TextField
                      label="Strength Wins"
                      multiline rows={2} fullWidth
                      value={formData.strengthWins}
                      onChange={(e) => update('strengthWins', e.target.value)}
                    />
                    <TextField
                      label="Struggles"
                      multiline rows={2} fullWidth
                      value={formData.struggles}
                      onChange={(e) => update('struggles', e.target.value)}
                    />
                  </Box>
                </Box>

                {/* Protocol Compliance */}
                <Box sx={{ borderTop: '2px solid', borderColor: 'divider', pt: 3 }}>
                  <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 2 }}>
                    Protocol Compliance
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Box>
                      <Typography gutterBottom sx={{ mb: 1 }}>Bedtime Compliance (nights before 23:00): {formData.bedtimeCompliance}/7</Typography>
                      <Slider
                        value={formData.bedtimeCompliance}
                        onChange={(_, v) => update('bedtimeCompliance', v as number)}
                        min={0} max={7} step={1} marks
                        valueLabelDisplay="auto"
                        sx={{ '& .MuiSlider-thumb': { height: 28, width: 28 } }}
                      />
                    </Box>
                    <Box>
                      <Typography gutterBottom sx={{ mb: 1 }}>Rug Protocol Days: {formData.rugProtocolDays}/7</Typography>
                      <Slider
                        value={formData.rugProtocolDays}
                        onChange={(_, v) => update('rugProtocolDays', v as number)}
                        min={0} max={7} step={1} marks
                        valueLabelDisplay="auto"
                        sx={{ '& .MuiSlider-thumb': { height: 28, width: 28 } }}
                      />
                    </Box>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.hydrationTracked}
                          onChange={(e) => update('hydrationTracked', e.target.checked)}
                        />
                      }
                      label="Hydration tracked this week?"
                    />
                  </Box>
                </Box>

                {/* Last Week's Plan */}
                <Box sx={{ borderTop: '2px solid', borderColor: 'divider', pt: 3 }}>
                  <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 1 }}>
                    Last Week&apos;s Plan
                  </Typography>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Last Week&apos;s Plan — Your Verdict
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography gutterBottom sx={{ mb: 1 }}>
                      Plan satisfaction: {formData.planSatisfaction}/5
                      {formData.planSatisfaction <= 2 ? ' — Too light' : formData.planSatisfaction >= 4 ? ' — Too much' : ' — About right'}
                    </Typography>
                    <Slider
                      aria-label="Plan satisfaction, 1 is too light, 5 is too much"
                      value={formData.planSatisfaction}
                      onChange={(_, v) => update('planSatisfaction', v as number)}
                      min={1} max={5} step={1} marks={[
                        { value: 1, label: 'Too light' },
                        { value: 3, label: 'About right' },
                        { value: 5, label: 'Too much' },
                      ]}
                      valueLabelDisplay="auto"
                      sx={{ '& .MuiSlider-thumb': { height: 28, width: 28 } }}
                    />
                  </Box>
                  <TextField
                    label="Plan Feedback"
                    multiline rows={3} fullWidth
                    placeholder="How was last week's plan? Think about: volume (too much/little?), intensity, exercise selection, session length, anything you'd change. Be specific — the coaches read this first."
                    value={formData.planFeedback}
                    onChange={(e) => update('planFeedback', e.target.value)}
                    slotProps={{ htmlInput: { maxLength: 1000 } }}
                    sx={{ mt: 2 }}
                  />
                </Box>

                {/* Next Week */}
                <Box sx={{ borderTop: '2px solid', borderColor: 'divider', pt: 3 }}>
                  <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 2 }}>
                    Next Week
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <TextField
                      label="Upcoming Conflicts Next Week"
                      multiline rows={2} fullWidth
                      value={formData.upcomingConflicts}
                      onChange={(e) => update('upcomingConflicts', e.target.value)}
                    />
                    <TextField
                      label="Focus for Next Week"
                      multiline rows={2} fullWidth
                      value={formData.focusNextWeek}
                      onChange={(e) => update('focusNextWeek', e.target.value)}
                    />
                    <TextField
                      label="Questions for the Coaches"
                      multiline rows={2} fullWidth
                      value={formData.questionsForCoaches}
                      onChange={(e) => update('questionsForCoaches', e.target.value)}
                    />
                  </Box>
                </Box>

              </Box>
            </CardContent>
          </Card>
        );

      case 3: // Review & Submit
        return (
          <Card>
            <CardContent sx={cardContentSx}>
              <Typography variant="h6" gutterBottom>Review & Submit</Typography>

              <FormControl sx={{ mb: 3, minWidth: 280 }}>
                <InputLabel>Model</InputLabel>
                <Select
                  value={formData.model}
                  label="Model"
                  onChange={(e) => update('model', e.target.value as CheckInFormData['model'])}
                >
                  <MenuItem value="sonnet">Sonnet (fast, ~$0.20)</MenuItem>
                  <MenuItem value="opus">Opus (deep, ~$1.50)</MenuItem>
                  <MenuItem value="mixed">Mixed (Sonnet specialists + Opus synthesis, ~$0.60)</MenuItem>
                </Select>
              </FormControl>

              <Box sx={{ mb: 3 }}>
                {/* Data sources */}
                <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 1 }}>
                  Data Sources
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
                  {[
                    { label: 'Garmin', value: garminStatus?.status === 'fresh' ? 'Fresh' : garminStatus?.status || 'Not loaded' },
                    { label: 'Hevy', value: formData.hevyCsv.trim() ? `${formData.hevyCsv.split('\n').length} lines` : 'Skipped' },
                  ].map(({ label, value }) => (
                    <Box key={label} sx={{ bgcolor: 'action.hover', borderRadius: 1, px: 1.5, py: 1 }}>
                      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                      <Typography variant="body2" fontWeight={500}>{value}</Typography>
                    </Box>
                  ))}
                </Box>

                {/* Training */}
                <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 1 }}>
                  Training
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, mb: 2 }}>
                  {[
                    { label: 'Sessions', value: `${formData.sessionsCompleted}/${formData.sessionsPlanned}` },
                    { label: 'Readiness', value: `${formData.perceivedReadiness}/5` },
                    { label: 'Plan Satisfaction', value: `${formData.planSatisfaction}/5` },
                  ].map(({ label, value }) => (
                    <Box key={label} sx={{ bgcolor: 'action.hover', borderRadius: 1, px: 1.5, py: 1 }}>
                      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                      <Typography variant="body2" fontWeight={500}>{value}</Typography>
                    </Box>
                  ))}
                </Box>

                {/* Protocol Compliance */}
                <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 1 }}>
                  Protocol Compliance
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, mb: 2 }}>
                  {[
                    { label: 'Bedtime', value: `${formData.bedtimeCompliance}/7` },
                    { label: 'Rug Protocol', value: `${formData.rugProtocolDays}/7` },
                    { label: 'Hydration', value: formData.hydrationTracked ? 'Tracked' : 'Not tracked' },
                  ].map(({ label, value }) => (
                    <Box key={label} sx={{ bgcolor: 'action.hover', borderRadius: 1, px: 1.5, py: 1 }}>
                      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                      <Typography variant="body2" fontWeight={500}>{value}</Typography>
                    </Box>
                  ))}
                </Box>

                {/* Pain */}
                <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 1 }}>
                  Pain &amp; Injury
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
                  {[
                    { label: "Baker's Cyst", value: `${formData.bakerCystPain}/10` },
                    { label: 'Lower Back', value: `${formData.lowerBackFatigue}/10` },
                  ].map(({ label, value }) => (
                    <Box key={label} sx={{ bgcolor: 'action.hover', borderRadius: 1, px: 1.5, py: 1 }}>
                      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                      <Typography variant="body2" fontWeight={500}>{value}</Typography>
                    </Box>
                  ))}
                </Box>

                {/* Plan feedback preview */}
                {formData.planFeedback && (
                  <>
                    <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 1 }}>
                      Plan Feedback
                    </Typography>
                    <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, px: 1.5, py: 1, mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        &ldquo;{formData.planFeedback.slice(0, 120)}{formData.planFeedback.length > 120 ? '...' : ''}&rdquo;
                      </Typography>
                    </Box>
                  </>
                )}
              </Box>

              <Button
                variant="contained"
                size="large"
                onClick={handleSubmit}
                disabled={loading}
                sx={{ mt: 1 }}
              >
                {loading ? 'Running Check-In...' : 'Submit Check-In'}
              </Button>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <Box>
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {stepLabels.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {renderStep()}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
          variant="outlined"
        >
          Back
        </Button>
        {activeStep < STEPS.length - 1 && (
          <Button onClick={handleNext} variant="contained">
            Next
          </Button>
        )}
      </Box>
    </Box>
  );
}
