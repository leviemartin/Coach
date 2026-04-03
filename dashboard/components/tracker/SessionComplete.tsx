'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

interface WeightChange {
  exercise: string;
  set: number;
  from: number | null;
  to: number | null;
}

interface SessionCompleteProps {
  compliancePct: number | null;
  weightChanges: WeightChange[];
  ceilingCheck: string | null;
  setsCompleted: number;
  exercisesCompleted: number;
  onClose: (notes: string) => void;
  onUndo?: () => void;
}

export default function SessionComplete({
  compliancePct,
  weightChanges,
  ceilingCheck,
  setsCompleted,
  exercisesCompleted,
  onClose,
  onUndo,
}: SessionCompleteProps) {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const notesRequired = compliancePct != null && compliancePct < 100;

  const handleSubmit = () => {
    if (notesRequired && !notes.trim()) return;
    setIsSubmitting(true);
    setShowUndoToast(true);
    undoTimerRef.current = setTimeout(() => {
      setShowUndoToast(false);
      onClose(notes);
    }, 10000);
  };

  const handleUndo = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setShowUndoToast(false);
    setIsSubmitting(false);
    onUndo?.();
  };

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', px: 2, py: 3 }}>
      {/* Header */}
      <Stack alignItems="center" spacing={1.5} mb={3}>
        <CheckCircleIcon sx={{ color: notesRequired ? '#f59e0b' : '#22c55e', fontSize: 64 }} />
        <Typography variant="h5" fontWeight={800} textAlign="center">
          {notesRequired ? 'Session Ended Early' : 'Session Complete'}
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {notesRequired ? 'Log what you did and why you stopped.' : 'Good work. Log it and move on.'}
        </Typography>
      </Stack>

      {/* Stats grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1.5,
          mb: 2.5,
        }}
      >
        <StatCard label="Exercises" value={String(exercisesCompleted)} />
        <StatCard label="Sets Done" value={String(setsCompleted)} />
        <StatCard
          label="Compliance"
          value={compliancePct != null ? `${Math.round(compliancePct)}%` : '—'}
          valueColor={
            compliancePct == null
              ? undefined
              : compliancePct >= 90
                ? '#22c55e'
                : compliancePct >= 70
                  ? '#f59e0b'
                  : '#ef4444'
          }
        />
      </Box>

      {/* Weight adjustments */}
      {weightChanges.length > 0 && (
        <Card
          variant="outlined"
          sx={{ borderRadius: '12px', borderColor: '#f59e0b', mb: 2 }}
        >
          <CardContent sx={{ pb: '12px !important' }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
              <TrendingUpIcon sx={{ color: '#f59e0b', fontSize: 18 }} />
              <Typography variant="subtitle2" fontWeight={700}>
                Weight Adjustments
              </Typography>
            </Stack>
            <Stack spacing={0.75}>
              {weightChanges.map((wc, idx) => (
                <Stack
                  key={idx}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography variant="body2" color="text.secondary" noWrap sx={{ flex: 1 }}>
                    {wc.exercise} · set {wc.set}
                  </Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ ml: 1, flexShrink: 0 }}>
                    {wc.from != null ? `${wc.from}kg` : '—'}
                    {' → '}
                    {wc.to != null ? `${wc.to}kg` : '—'}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Ceiling check */}
      {ceilingCheck && (
        <Card
          variant="outlined"
          sx={{ borderRadius: '12px', borderColor: '#22c55e', mb: 2 }}
        >
          <CardContent sx={{ pb: '12px !important' }}>
            <Stack direction="row" alignItems="flex-start" spacing={1}>
              <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 18, mt: '2px', flexShrink: 0 }} />
              <Box>
                <Typography variant="subtitle2" fontWeight={700} mb={0.5}>
                  Ceiling Update
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {ceilingCheck}
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Session notes */}
      <TextField
        label={notesRequired ? 'Why was the session cut short? (required)' : 'Add Session Notes'}
        multiline
        minRows={3}
        fullWidth
        required={notesRequired}
        error={notesRequired && notes.trim() === ''}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={notesRequired ? 'Explain what happened — time, energy, pain, etc.' : 'How did it feel? Anything to flag for the coach?'}
        sx={{
          mb: 2.5,
          '& .MuiOutlinedInput-root': {
            borderRadius: '12px',
          },
        }}
      />

      {/* CTA */}
      <Button
        variant="contained"
        fullWidth
        disabled={isSubmitting || (notesRequired && !notes.trim())}
        onClick={handleSubmit}
        sx={{
          minHeight: 52,
          borderRadius: '10px',
          fontWeight: 700,
          fontSize: '1rem',
          backgroundColor: isSubmitting ? '#94a3b8' : '#22c55e',
          '&:hover': { backgroundColor: isSubmitting ? '#94a3b8' : '#16a34a' },
        }}
      >
        {isSubmitting ? 'Logging session...' : 'Done — Log & Close'}
      </Button>

      <Snackbar
        open={showUndoToast}
        autoHideDuration={10000}
        onClose={() => {}}
        message="Session logged."
        action={
          <Button color="inherit" size="small" onClick={handleUndo} sx={{ fontWeight: 700 }}>
            Undo
          </Button>
        }
        sx={{
          '& .MuiSnackbarContent-root': {
            borderRadius: '10px',
            fontWeight: 600,
          },
        }}
      />
    </Box>
  );
}

function StatCard({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: '12px', textAlign: 'center' }}
    >
      <CardContent sx={{ py: 1.5, px: 1, pb: '12px !important' }}>
        <Typography
          variant="h5"
          fontWeight={800}
          color={valueColor ?? 'text.primary'}
          lineHeight={1.1}
        >
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" mt={0.25}>
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}
