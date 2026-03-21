'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControlLabel,
  Switch,
  Typography,
} from '@mui/material';
import BedtimeCard from './BedtimeCard';
import NotesCard from './NotesCard';

interface LogData {
  workout_completed: number;
  core_work_done: number;
  rug_protocol_done: number;
  vampire_bedtime: string | null;
  hydration_tracked: number;
  kitchen_cutoff_hit: number;
  is_sick_day: number;
  notes: string | null;
}

interface PlannedSession {
  session_type: string;
  focus: string;
  workout_plan?: string;
}

interface DailyLogProps {
  date: string;
  log: LogData;
  plannedSession: PlannedSession | null;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

export default function DailyLog({ date, log, plannedSession, onSave }: DailyLogProps) {
  const [formData, setFormData] = useState<LogData>(log);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset form when date/log changes
  useEffect(() => {
    setFormData(log);
    setSaveStatus('idle');
  }, [date, log]);

  const triggerSave = useCallback(
    (data: LogData) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);

      debounceRef.current = setTimeout(async () => {
        setSaveStatus('saving');
        // BedtimeCard already returns values in 24h+ storage format — no conversion needed
        const payload: Record<string, unknown> = { ...data };

        try {
          await onSave(payload);
          setSaveStatus('saved');
          fadeRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
        } catch {
          // Retry once after 2s
          setTimeout(async () => {
            try {
              await onSave(payload);
              setSaveStatus('saved');
              fadeRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
            } catch {
              setSaveStatus('failed');
            }
          }, 2000);
        }
      }, 500);
    },
    [onSave],
  );

  const update = (patch: Partial<LogData>) => {
    const next = { ...formData, ...patch };
    setFormData(next);
    triggerSave(next);
  };

  const isSick = !!formData.is_sick_day;

  // Determine day type for planned session area
  const dateObj = new Date(date + 'T12:00:00');
  const dayIndex = dateObj.getDay(); // 0=Sun, 6=Sat
  const isSaturday = dayIndex === 6;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header with save status */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', minHeight: 24 }}>
        {saveStatus === 'saving' && (
          <Typography variant="caption" color="text.secondary">
            Saving...
          </Typography>
        )}
        {saveStatus === 'saved' && (
          <Typography variant="caption" color="success.main">
            Saved
          </Typography>
        )}
        {saveStatus === 'failed' && (
          <Typography variant="caption" color="error.main" fontWeight={600}>
            Save failed
          </Typography>
        )}
      </Box>

      {/* Sick Day Toggle */}
      <Card variant="outlined">
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <FormControlLabel
            control={
              <Switch
                checked={isSick}
                onChange={(e) => update({ is_sick_day: e.target.checked ? 1 : 0 })}
                color="error"
              />
            }
            label={
              <Typography fontWeight={600} color={isSick ? 'error.main' : 'text.primary'}>
                Sick Day
              </Typography>
            }
          />
        </CardContent>
      </Card>

      {/* Today's Session */}
      {!isSick && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {"Today's Session"}
            </Typography>
            {plannedSession ? (
              <Box>
                <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                  <Chip label={plannedSession.session_type} size="small" color="primary" />
                  <Chip label={plannedSession.focus} size="small" variant="outlined" />
                </Box>
                {plannedSession.workout_plan && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {plannedSession.workout_plan}
                  </Typography>
                )}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!formData.workout_completed}
                      onChange={(e) => update({ workout_completed: e.target.checked ? 1 : 0 })}
                    />
                  }
                  label="Session completed"
                />
              </Box>
            ) : (
              <Chip
                label={isSaturday ? 'Family Day' : 'Rest Day'}
                size="small"
                color={isSaturday ? 'secondary' : 'default'}
                variant="outlined"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Daily Checklist */}
      {!isSick && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Daily Checklist
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!formData.core_work_done}
                    onChange={(e) => update({ core_work_done: e.target.checked ? 1 : 0 })}
                  />
                }
                label="Core work done"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!formData.rug_protocol_done}
                    onChange={(e) => update({ rug_protocol_done: e.target.checked ? 1 : 0 })}
                  />
                }
                label="Rug Protocol (GOWOD)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!formData.kitchen_cutoff_hit}
                    onChange={(e) => update({ kitchen_cutoff_hit: e.target.checked ? 1 : 0 })}
                  />
                }
                label="Kitchen Cutoff (20:00)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!formData.hydration_tracked}
                    onChange={(e) => update({ hydration_tracked: e.target.checked ? 1 : 0 })}
                  />
                }
                label="Hydration tracked"
              />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Hydration (visible when sick) */}
      {isSick && (
        <Card variant="outlined">
          <CardContent>
            <FormControlLabel
              control={
                <Checkbox
                  checked={!!formData.hydration_tracked}
                  onChange={(e) => update({ hydration_tracked: e.target.checked ? 1 : 0 })}
                />
              }
              label="Hydration tracked"
            />
          </CardContent>
        </Card>
      )}

      {/* Bedtime */}
      <BedtimeCard
        bedtime={formData.vampire_bedtime}
        onUpdate={(val) => update({ vampire_bedtime: val })}
      />

      {/* Notes */}
      <NotesCard
        notes={formData.notes}
        onUpdate={(val) => update({ notes: val })}
      />
    </Box>
  );
}
