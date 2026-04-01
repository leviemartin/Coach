'use client';
import { Box, Typography } from '@mui/material';
import type { SessionSetState, ExerciseType } from '@/lib/types';
import { supersetGroupLetter } from '@/lib/buildBlocks';
import { supersetColors } from '@/lib/design-tokens';
import { formatDuration } from '@/lib/format';
import SetRowInput from './SetRowInput';
import ExerciseRpe from './ExerciseRpe';

interface SupersetExercise {
  name: string;
  type: ExerciseType;
  sets: SessionSetState[];
  prescribedDurationS: number | null;
  coachCue: string | null;
  rpe: number | null;
  notes: string;
}

interface SupersetBlockTrackerProps {
  groupId: number;
  exercises: SupersetExercise[];
  restSeconds: number | null;
  onUpdateSet: (setId: number, weight: number | null, reps: number | null, completed: boolean, duration?: number | null) => void;
  onRpeSelect?: (exerciseName: string, rpe: number) => void;
  onNotesChange?: (exerciseName: string, notes: string) => void;
}

export default function SupersetBlockTracker({ groupId, exercises, restSeconds, onUpdateSet, onRpeSelect, onNotesChange }: SupersetBlockTrackerProps) {
  const letter = supersetGroupLetter(groupId);
  const colors = supersetColors[letter] ?? supersetColors.A;
  const rounds = exercises[0]?.sets.length ?? 0;

  const metaParts: string[] = [];
  if (rounds > 0) metaParts.push(`${rounds} rounds`);
  if (restSeconds != null) metaParts.push(`${formatDuration(restSeconds)} rest`);

  return (
    <Box sx={{ borderTop: '2px solid #e4e4e0', borderLeft: `4px solid ${colors.border}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, pt: 1.5 }}>
        <Typography sx={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: '0.625rem', fontWeight: 700,
          color: colors.border, letterSpacing: '1.5px', textTransform: 'uppercase',
          backgroundColor: colors.bg, px: 1, py: 0.375, border: `1px solid ${colors.border}30`,
        }}>SS·{letter}</Typography>
        {metaParts.length > 0 && (
          <Typography sx={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: '0.6875rem', color: '#a1a1aa', letterSpacing: '0.5px',
          }}>{metaParts.join(' · ')}</Typography>
        )}
      </Box>

      {exercises.map((ex, idx) => (
        <Box key={ex.name}>
          {idx > 0 && (
            <Box sx={{
              textAlign: 'center', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.5625rem',
              color: '#a1a1aa', letterSpacing: '2px', textTransform: 'uppercase', py: 0.75,
              borderTop: '1px dashed #d4d4d0', borderBottom: '1px dashed #d4d4d0', mx: 2.5,
            }}>THEN IMMEDIATELY</Box>
          )}
          <Box sx={{ px: 2.5, py: 1.5 }}>
            <Typography sx={{
              fontFamily: '"Libre Franklin", sans-serif', fontSize: '1rem', fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.25,
            }}>{ex.name}</Typography>
            {ex.coachCue && (
              <Typography sx={{
                fontSize: '0.75rem', fontStyle: 'italic', color: '#b45309', mb: 1.5,
                pl: 1.25, borderLeft: '2px solid #b4530940',
              }}>{ex.coachCue}</Typography>
            )}
            {ex.sets.map((s) => (
              <SetRowInput key={s.id} set={s} exerciseType={ex.type}
                durationSecondsFromExercise={ex.prescribedDurationS} onComplete={onUpdateSet} />
            ))}
            {ex.sets.length > 0 && ex.sets.every(s => s.completed) && onRpeSelect && (
              <ExerciseRpe selectedRpe={ex.rpe} onSelect={(rpe) => onRpeSelect(ex.name, rpe)}
                notes={ex.notes}
                onNotesChange={onNotesChange ? (notes) => onNotesChange(ex.name, notes) : undefined} />
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
