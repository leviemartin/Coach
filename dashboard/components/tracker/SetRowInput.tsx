'use client';
import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import type { SessionSetState, ExerciseType } from '@/lib/types';
import { formatDuration } from '@/lib/format';
import DurationInput from './DurationInput';

interface SetRowInputProps {
  set: SessionSetState;
  exerciseType: ExerciseType;
  durationSecondsFromExercise?: number | null;
  onComplete: (setId: number, weight: number | null, reps: number | null, completed: boolean, duration?: number | null) => void;
}

export default function SetRowInput({ set, exerciseType, durationSecondsFromExercise, onComplete }: SetRowInputProps) {
  const [weight, setWeight] = useState(set.actualWeightKg?.toString() ?? set.prescribedWeightKg?.toString() ?? '');
  const [reps, setReps] = useState(set.actualReps?.toString() ?? set.prescribedReps?.toString() ?? '');
  const [duration, setDuration] = useState(set.actualDurationS?.toString() ?? set.prescribedDurationS?.toString() ?? durationSecondsFromExercise?.toString() ?? '');

  const showWeight = exerciseType === 'strength' || exerciseType === 'carry';
  const showReps = exerciseType === 'strength';
  const showDuration = exerciseType === 'timed' || exerciseType === 'carry' || exerciseType === 'mobility';
  const isBW = set.prescribedWeightKg == null || set.prescribedWeightKg === 0;

  const handleDone = () => {
    const w = weight ? parseFloat(weight) : null;
    const r = reps ? parseInt(reps) : null;
    const d = duration ? parseInt(duration) : null;
    onComplete(set.id!, w, r, !set.completed, showDuration ? d : undefined);
  };

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid #ebebeb',
      fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8125rem',
    }}>
      <Typography sx={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', fontWeight: 700,
        color: '#a1a1aa', width: 20,
      }}>
        {String(set.setNumber).padStart(2, '0')}
      </Typography>

      {set.completed ? (
        <Box onClick={handleDone} sx={{ display: 'flex', alignItems: 'center', flex: 1, cursor: 'pointer', gap: 1 }}>
          <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8125rem', fontWeight: 600, flex: 1 }}>
            {showWeight && !isBW && set.actualWeightKg != null && `${set.actualWeightKg}kg`}
            {showWeight && isBW && 'BW'}
            {showWeight && showReps && ' × '}
            {showReps && set.actualReps != null && `${set.actualReps}`}
            {showDuration && set.actualDurationS != null && `${formatDuration(set.actualDurationS)}`}
          </Typography>
          <Box component="button" sx={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: '0.6875rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '1px', px: 1.75, py: 0.875,
            border: 'none', backgroundColor: '#22c55e', color: '#fff', cursor: 'pointer',
          }}>✓ SET</Box>
        </Box>
      ) : (
        <>
          {showWeight && !isBW && (
            <>
              <Box component="input" value={weight}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWeight(e.target.value)}
                placeholder={set.prescribedWeightKg?.toString() ?? '—'} inputMode="decimal"
                sx={{
                  width: 54, backgroundColor: '#fff', border: '2px solid #d4d4d0', padding: '7px 6px',
                  fontFamily: '"JetBrains Mono", monospace', fontSize: '0.875rem', fontWeight: 500,
                  textAlign: 'center', outline: 'none', '&:focus': { borderColor: '#18181b' },
                }}
              />
              <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.625rem', fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', width: 24 }}>kg</Typography>
            </>
          )}
          {showWeight && isBW && (
            <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', fontWeight: 700, color: '#a1a1aa', width: 78 }}>BW</Typography>
          )}
          {showWeight && showReps && (
            <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, color: '#d4d4d0' }}>×</Typography>
          )}
          {showReps && (
            <>
              <Box component="input" value={reps}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReps(e.target.value)}
                placeholder={set.prescribedRepsDisplay ?? set.prescribedReps?.toString() ?? '—'} inputMode="numeric"
                sx={{
                  width: 54, backgroundColor: '#fff', border: '2px solid #d4d4d0', padding: '7px 6px',
                  fontFamily: '"JetBrains Mono", monospace', fontSize: '0.875rem', fontWeight: 500,
                  textAlign: 'center', outline: 'none', '&:focus': { borderColor: '#18181b' },
                }}
              />
              <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.625rem', fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', width: 28 }}>reps</Typography>
            </>
          )}
          {showDuration && (
            <DurationInput value={duration}
              placeholder={set.prescribedDurationS != null ? set.prescribedDurationS.toString() : '—'}
              onChange={setDuration}
            />
          )}
          <Box component="button" onClick={handleDone} sx={{
            marginLeft: 'auto', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.6875rem',
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', px: 1.75, py: 0.875,
            border: 'none', backgroundColor: '#18181b', color: '#fafaf7', cursor: 'pointer',
            '&:hover': { backgroundColor: '#27272a' },
          }}>✓ SET</Box>
        </>
      )}
    </Box>
  );
}
