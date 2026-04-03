'use client';

import { Box, TextField, Typography } from '@mui/material';
import { semanticColors } from '@/lib/design-tokens';

const RPE_OPTIONS = [
  { value: 1, label: 'Too Easy' },
  { value: 2, label: 'Easy' },
  { value: 3, label: 'Right' },
  { value: 4, label: 'Hard' },
  { value: 5, label: 'Too Hard' },
] as const;

interface ExerciseRpeProps {
  selectedRpe: number | null;
  onSelect: (rpe: number) => void;
  notes?: string;
  onNotesChange?: (notes: string) => void;
}

export default function ExerciseRpe({ selectedRpe, onSelect, notes, onNotesChange }: ExerciseRpeProps) {
  return (
    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.75}>
        How did this feel?
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {RPE_OPTIONS.map((opt) => {
          const isSelected = selectedRpe === opt.value;
          const color =
            opt.value <= 2 ? semanticColors.recovery.good :
            opt.value === 3 ? semanticColors.body :
            semanticColors.recovery.problem;

          return (
            <Box
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              sx={{
                flex: 1,
                py: 0.75,
                borderRadius: 0,
                textAlign: 'center',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: isSelected ? color : 'divider',
                backgroundColor: isSelected ? `${color}18` : 'transparent',
                transition: 'all 0.15s ease',
                '&:hover': {
                  borderColor: color,
                  backgroundColor: `${color}0a`,
                },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '0.625rem',
                  color: isSelected ? color : 'text.secondary',
                  lineHeight: 1.2,
                }}
              >
                {opt.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
      {onNotesChange && (
        <TextField
          size="small"
          placeholder="Notes on this exercise (optional)"
          value={notes ?? ''}
          onChange={(e) => onNotesChange(e.target.value)}
          fullWidth
          multiline
          minRows={1}
          maxRows={3}
          sx={{
            mt: 1,
            '& .MuiOutlinedInput-root': { borderRadius: 0, fontSize: '0.8125rem' },
            '& .MuiOutlinedInput-input': { py: 0.75, px: 1 },
          }}
        />
      )}
    </Box>
  );
}
