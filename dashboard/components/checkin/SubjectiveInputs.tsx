'use client';

import { Box, Card, CardContent, TextField, Typography } from '@mui/material';
import type { CheckinSubjectiveData } from '@/lib/types';
import type { ModelSuggestion } from '@/lib/model-suggestion';
import { cardContentSx } from '@/lib/theme';
import ModelSelector from './ModelSelector';

interface SubjectiveInputsProps {
  data: CheckinSubjectiveData;
  onChange: (data: CheckinSubjectiveData) => void;
  modelSuggestion?: ModelSuggestion;
}

const buttonBase = {
  width: 44,
  height: 40,
  borderRadius: '4px',
  border: '1px solid #e2e8f0',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.875rem',
  fontWeight: 600,
  userSelect: 'none' as const,
  transition: 'background 0.1s, border-color 0.1s',
  bgcolor: '#fff',
  color: '#374151',
  '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' },
};

const selectedBlue = {
  bgcolor: '#dbeafe',
  borderColor: '#3b82f6',
  color: '#1d4ed8',
};

const READINESS_LABELS: Record<number, string> = {
  1: 'Wrecked',
  2: 'Low',
  3: 'Normal',
  4: 'Good',
  5: 'Peaked',
};

const SATISFACTION_LABELS: Record<number, string> = {
  1: 'Too light',
  2: 'Bit easy',
  3: 'Just right',
  4: 'Challenging',
  5: 'Too much',
};

function TapButtons({
  value,
  onChange,
  tooltips,
}: {
  value: number;
  onChange: (v: number) => void;
  tooltips: Record<number, string>;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 0.75 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const isSelected = value === n;
        return (
          <Box
            key={n}
            component="button"
            onClick={() => onChange(n)}
            title={tooltips[n]}
            sx={{
              ...buttonBase,
              ...(isSelected ? selectedBlue : {}),
            }}
          >
            {n}
          </Box>
        );
      })}
    </Box>
  );
}

export default function SubjectiveInputs({ data, onChange, modelSuggestion }: SubjectiveInputsProps) {
  const set = <K extends keyof CheckinSubjectiveData>(key: K, value: CheckinSubjectiveData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* ── Readiness + Satisfaction ───────────────────────────── */}
      <Card variant="outlined">
        <CardContent sx={cardContentSx}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Weekly snapshot
          </Typography>

          {/* Perceived Readiness */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ minWidth: 140 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#374151' }}>
                Perceived Readiness
              </Typography>
              {data.perceivedReadiness > 0 && (
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                  {READINESS_LABELS[data.perceivedReadiness]}
                </Typography>
              )}
            </Box>
            <TapButtons
              value={data.perceivedReadiness}
              onChange={(v) => set('perceivedReadiness', v)}
              tooltips={READINESS_LABELS}
            />
          </Box>

          {/* Plan Satisfaction */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ minWidth: 140 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#374151' }}>
                Plan Satisfaction
              </Typography>
              {data.planSatisfaction > 0 && (
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                  {SATISFACTION_LABELS[data.planSatisfaction]}
                </Typography>
              )}
            </Box>
            <TapButtons
              value={data.planSatisfaction}
              onChange={(v) => set('planSatisfaction', v)}
              tooltips={SATISFACTION_LABELS}
            />
          </Box>
        </CardContent>
      </Card>

      {/* ── Free Text ──────────────────────────────────────────── */}
      <Card variant="outlined">
        <CardContent sx={cardContentSx}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Reflection
          </Typography>

          <TextField
            label="Week reflection"
            placeholder="What stood out this week — wins, struggles, anything the coach should know?"
            multiline
            minRows={3}
            fullWidth
            value={data.weekReflection}
            onChange={(e) => set('weekReflection', e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Next week conflicts"
            placeholder="Travel, late nights, illness, family events..."
            multiline
            minRows={2}
            fullWidth
            value={data.nextWeekConflicts}
            onChange={(e) => set('nextWeekConflicts', e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Questions for coaches"
            placeholder="Anything you want the coaching team to address in the brief?"
            multiline
            minRows={2}
            fullWidth
            value={data.questionsForCoaches}
            onChange={(e) => set('questionsForCoaches', e.target.value)}
          />
        </CardContent>
      </Card>

      {/* ── Model Selection ─────────────────────────────────────── */}
      <ModelSelector
        value={data.model}
        onChange={(v) => set('model', v)}
        suggestion={modelSuggestion}
      />
    </Box>
  );
}
