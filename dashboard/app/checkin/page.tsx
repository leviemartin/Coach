'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import WeeklyReview from '@/components/checkin/WeeklyReview';
import { getTrainingWeek } from '@/lib/week';
import type { CheckInFormData } from '@/lib/types';

const STEPS = [
  'Weekly Review',
  'Subjective Inputs',
  'Triage',
  'Synthesis',
  'Dialogue',
];

const STEP_LABELS_SMALL = ['Review', 'Inputs', 'Triage', 'Coach', 'Chat'];

export default function CheckInPage() {
  const router = useRouter();
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const stepLabels = isSmall ? STEP_LABELS_SMALL : STEPS;

  const weekNumber = getTrainingWeek();
  const [activeStep, setActiveStep] = useState(0);
  const [annotation, setAnnotation] = useState('');

  // Step 1 data passed forward — annotation is the key output
  const handleNext = () => {
    // Steps 2–3: placeholders for C2/C3 — skip to results for now
    if (activeStep >= 2) {
      // Build minimal form data and hand off to results page (legacy path)
      const formData: Partial<CheckInFormData> = {
        hevyCsv: '',
        bakerCystPain: 0,
        lowerBackFatigue: 0,
        sessionsCompleted: 0,
        sessionsPlanned: 5,
        missedSessions: '',
        strengthWins: '',
        struggles: annotation,
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
      };
      sessionStorage.setItem('checkin_form_data', JSON.stringify(formData));
      router.push('/checkin/results');
      return;
    }
    setActiveStep((s) => s + 1);
  };

  const handleBack = () => setActiveStep((s) => Math.max(0, s - 1));

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto' }}>
      <Typography variant="h3" fontWeight={700} sx={{ mb: 4 }}>
        Sunday Check-In — Week {weekNumber}
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }} alternativeLabel>
        {stepLabels.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* ── Step content ─────────────────────────────────────────── */}
      {activeStep === 0 && (
        <WeeklyReview
          weekNumber={weekNumber}
          annotation={annotation}
          onAnnotationChange={setAnnotation}
        />
      )}

      {activeStep === 1 && (
        <Box
          sx={{
            border: '1px dashed #e2e8f0',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            color: 'text.secondary',
          }}
        >
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Step 2: Subjective Inputs
          </Typography>
          <Typography variant="body2">
            Coming in Task C2 — simplified check-in survey replacing the old form.
          </Typography>
        </Box>
      )}

      {activeStep === 2 && (
        <Box
          sx={{
            border: '1px dashed #e2e8f0',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            color: 'text.secondary',
          }}
        >
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Step 3: Triage Agent
          </Typography>
          <Typography variant="body2">
            Coming in Task C3 — AI-driven Q&amp;A to surface missing context.
          </Typography>
        </Box>
      )}

      {activeStep === 3 && (
        <Box
          sx={{
            border: '1px dashed #e2e8f0',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            color: 'text.secondary',
          }}
        >
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Step 4: Coach Synthesis
          </Typography>
          <Typography variant="body2">
            Coming in Task C4 — streaming coach analysis.
          </Typography>
        </Box>
      )}

      {activeStep === 4 && (
        <Box
          sx={{
            border: '1px dashed #e2e8f0',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            color: 'text.secondary',
          }}
        >
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Step 5: Head Coach Dialogue
          </Typography>
          <Typography variant="body2">
            Coming in Task C5 — conversational follow-up with the Head Coach.
          </Typography>
        </Box>
      )}

      {/* ── Navigation ───────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button
          variant="outlined"
          onClick={handleBack}
          disabled={activeStep === 0}
        >
          Back
        </Button>
        <Button
          variant="contained"
          onClick={handleNext}
          disableElevation
        >
          {activeStep === 4 ? 'Go to Coach' : 'Next'}
        </Button>
      </Box>
    </Box>
  );
}
