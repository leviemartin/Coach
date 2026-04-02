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
import SubjectiveInputs from '@/components/checkin/SubjectiveInputs';
import TriageQA from '@/components/checkin/TriageQA';
import { getTrainingWeek } from '@/lib/week';
import type { CheckinSubjectiveData } from '@/lib/types';
import type { TriageAnswer } from '@/lib/triage-agent';
import type { WeeklyReviewData } from '@/app/api/checkin/review/route';

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
  const [reviewData, setReviewData] = useState<WeeklyReviewData | null>(null);
  // Triage answers stored here; will be passed to C4 synthesis step — not yet wired to legacy bridge
  const [triageAnswers, setTriageAnswers] = useState<TriageAnswer[]>([]);
  const [subjectiveData, setSubjectiveData] = useState<CheckinSubjectiveData>({
    perceivedReadiness: 0,
    planSatisfaction: 0,
    weekReflection: '',
    nextWeekConflicts: '',
    questionsForCoaches: '',
    model: 'mixed',
  });

  // Step 1 data passed forward — annotation is the key output
  const handleNext = () => {
    // Step 3 (Triage) advances via TriageQA's onComplete — not this button
    if (activeStep === 2) return;

    if (activeStep >= 3) {
      // New-format payload for the structured checkin API
      const payload = {
        subjectiveData,
        triageClarifications: triageAnswers,
        annotation,
      };
      sessionStorage.setItem('checkin_form_data', JSON.stringify(payload));
      router.push('/checkin/results');
      return;
    }
    setActiveStep((s) => s + 1);
  };

  const handleTriageComplete = (answers: TriageAnswer[]) => {
    setTriageAnswers(answers);
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
          onDataLoad={setReviewData}
        />
      )}

      {activeStep === 1 && (
        <SubjectiveInputs
          data={subjectiveData}
          onChange={setSubjectiveData}
          modelSuggestion={reviewData?.modelSuggestion}
        />
      )}

      {activeStep === 2 && (
        <TriageQA
          reviewData={reviewData}
          subjectiveData={subjectiveData}
          onComplete={handleTriageComplete}
        />
      )}

      {activeStep === 3 && (
        <Box
          sx={{
            border: '1px dashed #e4e4e0',
            borderRadius: 0,
            p: 4,
            textAlign: 'center',
            color: 'text.secondary',
          }}
        >
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Step 4: Coach Synthesis
          </Typography>
          <Typography variant="body2">
            Press Next to start the coaching analysis. Your 7 specialist coaches will analyze your week, then the Head Coach will synthesize their findings.
          </Typography>
        </Box>
      )}

      {activeStep === 4 && (
        <Box
          sx={{
            border: '1px dashed #e4e4e0',
            borderRadius: 0,
            p: 4,
            textAlign: 'center',
            color: 'text.secondary',
          }}
        >
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Step 5: Head Coach Dialogue
          </Typography>
          <Typography variant="body2">
            Coming in Phase D — conversational follow-up with the Head Coach.
          </Typography>
        </Box>
      )}

      {/* ── Navigation ───────────────────────────────────────────── */}
      {/* Step 3 (Triage) manages its own navigation — hide default Next button */}
      {activeStep !== 2 && (
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
      )}
    </Box>
  );
}
