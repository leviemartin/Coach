'use client';

import {
  Alert,
  Box,
  Card,
  CardContent,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import type { CheckinSubjectiveData } from '@/lib/types';
import type { ModelSuggestion } from '@/lib/model-suggestion';
import { cardContentSx } from '@/lib/theme';

interface ModelSelectorProps {
  value: CheckinSubjectiveData['model'];
  onChange: (value: CheckinSubjectiveData['model']) => void;
  suggestion?: ModelSuggestion;
}

const MODEL_OPTIONS: Array<{
  value: CheckinSubjectiveData['model'];
  label: string;
  description: string;
}> = [
  {
    value: 'mixed',
    label: 'Smart Mix',
    description:
      'Recommended for most weeks. Specialists use Sonnet for speed, Recovery and Head Coach use Opus for deeper reasoning.',
  },
  {
    value: 'opus',
    label: 'All Opus',
    description: 'Use when this week involves complex decisions needing maximum depth.',
  },
  {
    value: 'sonnet',
    label: 'All Sonnet',
    description: 'Use for routine maintenance weeks. Fastest results.',
  },
];

export default function ModelSelector({ value, onChange, suggestion }: ModelSelectorProps) {
  const showNudge =
    suggestion && suggestion.suggestion === 'opus' && suggestion.reasons.length > 0;
  const nudgeAcknowledged = showNudge && value === 'opus';

  return (
    <Card variant="outlined">
      <CardContent sx={cardContentSx}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          AI model
        </Typography>

        {showNudge && (
          <Alert
            severity={nudgeAcknowledged ? 'success' : 'warning'}
            sx={{ mb: 2, fontSize: '0.8125rem' }}
          >
            {nudgeAcknowledged ? (
              'Good choice. All Opus will give this week the depth it needs.'
            ) : (
              <>
                This week&apos;s data suggests a complex coaching conversation. Consider using{' '}
                <strong>All Opus</strong>.
                {suggestion.reasons.length > 0 && (
                  <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 2 }}>
                    {suggestion.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </Box>
                )}
              </>
            )}
          </Alert>
        )}

        <RadioGroup value={value} onChange={(e) => onChange(e.target.value as CheckinSubjectiveData['model'])}>
          {MODEL_OPTIONS.map(({ value: optValue, label, description }) => (
            <Box
              key={optValue}
              sx={{
                border: '1px solid',
                borderColor: value === optValue ? '#3b82f6' : '#e4e4e0',
                borderRadius: 0,
                px: 1.5,
                py: 1,
                mb: 1,
                cursor: 'pointer',
                bgcolor: value === optValue ? '#3b82f618' : 'transparent',
                transition: 'border-color 0.1s, background 0.1s',
                '&:last-child': { mb: 0 },
              }}
              onClick={() => onChange(optValue)}
            >
              <FormControlLabel
                value={optValue}
                control={<Radio size="small" />}
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {label}
                      {optValue === 'mixed' && (
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{
                            ml: 1,
                            px: 0.75,
                            py: 0.25,
                            bgcolor: '#22c55e18',
                            color: '#15803d',
                            borderRadius: 0,
                            fontWeight: 600,
                          }}
                        >
                          recommended
                        </Typography>
                      )}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {description}
                    </Typography>
                  </Box>
                }
                sx={{ m: 0, width: '100%' }}
              />
            </Box>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
