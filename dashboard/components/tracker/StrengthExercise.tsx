'use client';

import { useState } from 'react';
import { Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { semanticColors } from '@/lib/design-tokens';
import type { SessionSetState } from '@/lib/types';

interface StrengthExerciseProps {
  exerciseName: string;
  sets: SessionSetState[];
  durationSeconds?: number | null;
  isCurrent?: boolean;
  onUpdateSet: (setId: number, actualWeightKg: number | null, actualReps: number | null, completed: boolean) => void;
}

export default function StrengthExercise({ exerciseName, sets, durationSeconds, isCurrent = false, onUpdateSet }: StrengthExerciseProps) {
  // Track local edits before completing
  const [edits, setEdits] = useState<Record<number, { weight: string; reps: string }>>({});

  const getEdit = (set: SessionSetState) => {
    if (edits[set.id!]) return edits[set.id!];
    return {
      weight: set.actualWeightKg?.toString() ?? set.prescribedWeightKg?.toString() ?? '',
      reps: set.actualReps?.toString() ?? set.prescribedReps?.toString() ?? '',
    };
  };

  const updateEdit = (setId: number, field: 'weight' | 'reps', value: string) => {
    setEdits((prev) => ({
      ...prev,
      [setId]: { ...getEditById(setId), [field]: value },
    }));
  };

  const getEditById = (setId: number) => {
    const set = sets.find((s) => s.id === setId);
    if (!set) return { weight: '', reps: '' };
    return getEdit(set);
  };

  const handleComplete = (set: SessionSetState) => {
    const edit = getEdit(set);
    const weight = edit.weight ? parseFloat(edit.weight) : null;
    const reps = edit.reps ? parseInt(edit.reps) : null;
    onUpdateSet(set.id!, weight, reps, !set.completed);
  };

  const isModified = (set: SessionSetState) => {
    const edit = getEdit(set);
    const actualW = edit.weight ? parseFloat(edit.weight) : null;
    const actualR = edit.reps ? parseInt(edit.reps) : null;
    return actualW !== set.prescribedWeightKg || actualR !== set.prescribedReps;
  };

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: '12px',
        ...(isCurrent && { borderColor: semanticColors.body, borderWidth: 2 }),
      }}
    >
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} mb={2}>
          {exerciseName}
          {durationSeconds != null && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1, fontWeight: 400 }}>
              {durationSeconds}s each
            </Typography>
          )}
        </Typography>
        <Stack spacing={1}>
          {sets.map((set) => {
            const edit = getEdit(set);
            const modified = isModified(set);
            const hasWeight = set.prescribedWeightKg != null;
            const hasReps = set.prescribedReps != null;

            return (
              <Box
                key={set.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1.5,
                  borderRadius: '8px',
                  backgroundColor: set.completed
                    ? `${semanticColors.recovery.good}12`
                    : modified
                      ? `${semanticColors.recovery.caution}12`
                      : 'action.hover',
                }}
              >
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 44, fontWeight: 600 }}>
                  Set {set.setNumber}
                </Typography>

                {set.completed ? (
                  // Completed: read-only with green checkmark
                  <>
                    <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
                      {set.actualWeightKg != null && `${set.actualWeightKg}kg`}
                      {set.actualWeightKg != null && set.actualReps != null && ' × '}
                      {set.actualReps != null && `${set.actualReps} reps`}
                      {set.actualWeightKg == null && set.actualReps == null && durationSeconds != null && `${durationSeconds}s ✓`}
                      {set.actualWeightKg == null && set.actualReps == null && durationSeconds == null && '✓'}
                    </Typography>
                    <CheckCircleIcon sx={{ color: semanticColors.recovery.good, fontSize: 20 }} />
                  </>
                ) : (
                  // Active: editable fields — only show what's relevant
                  <>
                    {!hasWeight && !hasReps && durationSeconds != null && (
                      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                        {durationSeconds}s hold
                      </Typography>
                    )}
                    {hasWeight && (
                      <>
                        <TextField
                          size="small"
                          value={edit.weight}
                          onChange={(e) => updateEdit(set.id!, 'weight', e.target.value)}
                          placeholder={set.prescribedWeightKg?.toString() ?? '—'}
                          inputProps={{ inputMode: 'decimal', style: { textAlign: 'center', padding: '6px 8px' } }}
                          sx={{ width: 64, '& .MuiOutlinedInput-root': { borderRadius: '6px' } }}
                        />
                        <Typography variant="caption" color="text.secondary">kg</Typography>
                      </>
                    )}
                    {hasWeight && hasReps && (
                      <Typography variant="body2" color="text.secondary">×</Typography>
                    )}
                    {hasReps && (
                      <>
                        <TextField
                          size="small"
                          value={edit.reps}
                          onChange={(e) => updateEdit(set.id!, 'reps', e.target.value)}
                          placeholder={set.prescribedReps?.toString() ?? '—'}
                          inputProps={{ inputMode: 'numeric', style: { textAlign: 'center', padding: '6px 8px' } }}
                          sx={{ width: 52, '& .MuiOutlinedInput-root': { borderRadius: '6px' } }}
                        />
                        <Typography variant="caption" color="text.secondary">reps</Typography>
                      </>
                    )}
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleComplete(set)}
                      sx={{
                        ml: 'auto',
                        minWidth: 0,
                        px: 1.5,
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        textTransform: 'none',
                        backgroundColor: semanticColors.body,
                        '&:hover': { backgroundColor: '#2563eb' },
                      }}
                    >
                      {hasWeight || hasReps ? `Complete Set ${set.setNumber} ✓` : 'Done ✓'}
                    </Button>
                  </>
                )}
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
