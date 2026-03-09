'use client';

import React, { useState, useEffect } from 'react';
import {
  Stepper, Step, StepLabel, Button, Box, Typography, Card, CardContent,
  TextField, Slider, Switch, FormControlLabel, Select, MenuItem, FormControl,
  InputLabel, Alert, Chip, CircularProgress,
} from '@mui/material';
import type { CheckInFormData } from '@/lib/types';

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
  const [activeStep, setActiveStep] = useState(0);
  const [garminStatus, setGarminStatus] = useState<GarminStatus | null>(null);
  const [garminLoading, setGarminLoading] = useState(true);

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
    model: 'sonnet',
  });

  useEffect(() => {
    fetch('/api/garmin')
      .then((r) => r.json())
      .then(setGarminStatus)
      .catch(() => setGarminStatus(null))
      .finally(() => setGarminLoading(false));
  }, []);

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
            <CardContent>
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
                  {garminStatus.status !== 'fresh' && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      Run the Garmin connector in terminal to refresh: <code>cd ~/garmin-coach && python garmin_connector.py</code>
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
                <Alert severity="error">Could not read Garmin data file.</Alert>
              )}
            </CardContent>
          </Card>
        );

      case 1: // Hevy
        return (
          <Card>
            <CardContent>
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
            <CardContent>
              <Typography variant="h6" gutterBottom>Subjective Check-In</Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
                <Box>
                  <Typography gutterBottom>Baker&apos;s Cyst Pain: {formData.bakerCystPain}/10</Typography>
                  <Slider
                    value={formData.bakerCystPain}
                    onChange={(_, v) => update('bakerCystPain', v as number)}
                    min={0} max={10} step={1} marks
                    valueLabelDisplay="auto"
                  />
                </Box>

                <Box>
                  <Typography gutterBottom>Lower Back Fatigue: {formData.lowerBackFatigue}/10</Typography>
                  <Slider
                    value={formData.lowerBackFatigue}
                    onChange={(_, v) => update('lowerBackFatigue', v as number)}
                    min={0} max={10} step={1} marks
                    valueLabelDisplay="auto"
                  />
                </Box>

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="Sessions Completed"
                    type="number"
                    value={formData.sessionsCompleted}
                    onChange={(e) => update('sessionsCompleted', parseInt(e.target.value) || 0)}
                    sx={{ width: 160 }}
                  />
                  <TextField
                    label="Sessions Planned"
                    type="number"
                    value={formData.sessionsPlanned}
                    onChange={(e) => update('sessionsPlanned', parseInt(e.target.value) || 0)}
                    sx={{ width: 160 }}
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

                <Box>
                  <Typography gutterBottom>Bedtime Compliance (nights before 23:00): {formData.bedtimeCompliance}/7</Typography>
                  <Slider
                    value={formData.bedtimeCompliance}
                    onChange={(_, v) => update('bedtimeCompliance', v as number)}
                    min={0} max={7} step={1} marks
                    valueLabelDisplay="auto"
                  />
                </Box>

                <Box>
                  <Typography gutterBottom>Rug Protocol Days: {formData.rugProtocolDays}/7</Typography>
                  <Slider
                    value={formData.rugProtocolDays}
                    onChange={(_, v) => update('rugProtocolDays', v as number)}
                    min={0} max={7} step={1} marks
                    valueLabelDisplay="auto"
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
            </CardContent>
          </Card>
        );

      case 3: // Review & Submit
        return (
          <Card>
            <CardContent>
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

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Garmin: {garminStatus?.status === 'fresh' ? 'Fresh' : garminStatus?.status || 'Not loaded'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Hevy: {formData.hevyCsv.trim() ? `${formData.hevyCsv.split('\n').length} lines` : 'Skipped'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sessions: {formData.sessionsCompleted}/{formData.sessionsPlanned}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Bedtime: {formData.bedtimeCompliance}/7 | Rug: {formData.rugProtocolDays}/7 | Hydration: {formData.hydrationTracked ? 'Yes' : 'No'}
                </Typography>
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
        {STEPS.map((label) => (
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
