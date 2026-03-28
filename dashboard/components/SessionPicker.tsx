'use client';

import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Collapse,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useRouter } from 'next/navigation';
import { getComplianceColor } from '@/lib/compliance';

export interface UncompletedSession {
  id: number;
  day: string;
  session_type: string;
  focus: string;
  workout_plan?: string | null;
}

export interface PlannedSession {
  id?: number;
  session_type: string;
  focus: string;
  workout_plan?: string;
}

export interface SessionPickerProps {
  date: string;
  plannedSession: PlannedSession | null;
  uncompletedSessions: UncompletedSession[];
  workoutCompleted: number;
  sessionsCompleted: number;
  sessionsPlanned: number;
  isFamilyDay?: boolean;
  onUpdate: (completed: number, planItemId: number | null) => void;
}

export default function SessionPicker({
  date,
  plannedSession,
  uncompletedSessions,
  workoutCompleted,
  sessionsCompleted,
  sessionsPlanned,
  isFamilyDay = false,
  onUpdate,
}: SessionPickerProps) {
  const router = useRouter();

  // Default: show other sessions expanded if there's no planned session but others exist
  const [showOthers, setShowOthers] = useState(!plannedSession && uncompletedSessions.length > 0);

  // Which session is selected in the radio list (by id)
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const complianceColor = getComplianceColor(sessionsCompleted, sessionsPlanned);

  // Completion chip for the week
  const completionChip = sessionsPlanned > 0 ? (
    <Chip
      label={`${sessionsCompleted}/${sessionsPlanned}`}
      size="small"
      color={complianceColor}
      variant="outlined"
      sx={{ fontWeight: 600 }}
    />
  ) : null;

  // All sessions done this week
  if (sessionsPlanned > 0 && uncompletedSessions.length === 0 && !plannedSession) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon color="success" fontSize="small" />
            <Typography variant="body2" color="success.main" fontWeight={600}>
              All sessions done this week
            </Typography>
            {completionChip}
          </Box>
        </CardContent>
      </Card>
    );
  }

  // No plan at all (no planned session, no uncompleted sessions)
  if (!plannedSession && uncompletedSessions.length === 0) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={isFamilyDay ? 'Family Day' : 'No plan this week'}
              size="small"
              color={isFamilyDay ? 'secondary' : 'default'}
              variant="outlined"
            />
            {sessionsPlanned === 0 && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => router.push('/checkin')}
              >
                Run check-in →
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Determine which plan_item_id is active
  // If a radio selection exists, use that; otherwise use the planned session's id
  const activePlanItemId = selectedId ?? plannedSession?.id ?? null;

  const handleCompletionChange = (checked: boolean) => {
    onUpdate(checked ? 1 : 0, activePlanItemId);
  };

  const handleRadioChange = (id: number) => {
    setSelectedId(id);
    // If already checked, re-save with new plan item id
    if (workoutCompleted) {
      onUpdate(1, id);
    }
  };

  // The session to display at the top
  const activeSession: PlannedSession | UncompletedSession | null =
    selectedId != null
      ? uncompletedSessions.find((s) => s.id === selectedId) ?? plannedSession
      : plannedSession;

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography variant="subtitle2" color="text.secondary">
            {"Today's Session"}
          </Typography>
          {completionChip}
        </Box>

        {/* Active session display */}
        {activeSession && (
          <Box sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              <Chip label={activeSession.session_type} size="small" color="primary" />
              <Chip label={activeSession.focus} size="small" variant="outlined" />
            </Box>
            {activeSession.workout_plan && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {activeSession.workout_plan}
              </Typography>
            )}
          </Box>
        )}

        {/* Completion checkbox */}
        <FormControlLabel
          control={
            <Checkbox
              checked={!!workoutCompleted}
              onChange={(e) => handleCompletionChange(e.target.checked)}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">Session completed</Typography>
              {activeSession && (
                <Chip label={activeSession.focus} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
              )}
            </Box>
          }
        />

        {/* Collapsible other sessions */}
        {uncompletedSessions.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                cursor: 'pointer',
                color: 'text.secondary',
                userSelect: 'none',
              }}
              onClick={() => setShowOthers((v) => !v)}
            >
              <Typography variant="caption">
                {showOthers ? 'Hide other sessions' : 'Show other sessions'}
              </Typography>
              {showOthers ? (
                <ExpandLessIcon fontSize="small" />
              ) : (
                <ExpandMoreIcon fontSize="small" />
              )}
            </Box>

            <Collapse in={showOthers}>
              <RadioGroup
                value={selectedId?.toString() ?? ''}
                onChange={(e) => handleRadioChange(Number(e.target.value))}
                sx={{ mt: 1 }}
              >
                {uncompletedSessions.map((session) => (
                  <FormControlLabel
                    key={session.id}
                    value={session.id.toString()}
                    control={<Radio size="small" />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" fontWeight={500}>
                          {session.day}
                        </Typography>
                        <Chip label={session.session_type} size="small" color="primary" variant="outlined" />
                        <Typography variant="caption" color="text.secondary">
                          {session.focus}
                        </Typography>
                      </Box>
                    }
                    sx={{ alignItems: 'flex-start', mt: 0.5 }}
                  />
                ))}
              </RadioGroup>
            </Collapse>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
