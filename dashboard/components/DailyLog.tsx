'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Box,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Switch,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BedtimeCard from './BedtimeCard';
import NotesCard from './NotesCard';
import SessionPicker from './SessionPicker';
import DailyChecklist from './DailyChecklist';
import DayProgress from './DayProgress';
import EnergyPainCard from './EnergyPainCard';
import WeekComplianceBar from './WeekComplianceBar';
import ComplianceSparkline from './ComplianceSparkline';
import { computeDayCompliance, computeWeekCompliancePct, isBedtimeCompliant } from '@/lib/compliance';
import { semanticColors } from '@/lib/design-tokens';
import type { UncompletedSession } from './SessionPicker';
import type { WeekTallies } from './DailyChecklist';

interface LogData {
  workout_completed: number;
  core_work_done: number;
  rug_protocol_done: number;
  vampire_bedtime: string | null;
  hydration_tracked: number;
  kitchen_cutoff_hit: number;
  is_sick_day: number;
  notes: string | null;
  energy_level: number | null;
  pain_level: number | null;
  pain_area: string | null;
}

interface PlannedSession {
  id?: number;
  session_type: string;
  focus: string;
  workout_plan?: string;
}

interface WeekLog {
  date: string;
  day: string;
  workout_completed: number;
  core_work_done: number;
  rug_protocol_done: number;
  vampire_bedtime: string | null;
  hydration_tracked: number;
  kitchen_cutoff_hit: number;
  is_sick_day: number;
}

interface TrendPoint {
  week_number: number;
  compliance_pct: number;
  days_logged: number;
}

export interface DailyLogProps {
  date: string;
  log: LogData;
  plannedSession: PlannedSession | null;
  uncompletedSessions: UncompletedSession[];
  weekLogs: WeekLog[];
  streak: { current: number; best: number };
  complianceTrend: TrendPoint[];
  currentWeek: number;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

export default function DailyLog({
  date,
  log,
  plannedSession,
  uncompletedSessions,
  weekLogs,
  streak,
  complianceTrend,
  currentWeek,
  onSave,
}: DailyLogProps) {
  const [formData, setFormData] = useState<LogData>(log);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [selectedPlanItemId, setSelectedPlanItemId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset form when date/log changes
  useEffect(() => {
    setFormData(log);
    setSaveStatus('idle');
    setSelectedPlanItemId(null);
  }, [date, log]);

  const triggerSave = useCallback(
    (data: LogData, planItemId?: number | null) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);

      debounceRef.current = setTimeout(async () => {
        setSaveStatus('saving');
        const payload: Record<string, unknown> = { ...data };
        if (planItemId != null) {
          payload.workout_plan_item_id = planItemId;
        }

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
    triggerSave(next, selectedPlanItemId);
  };

  const isSick = !!formData.is_sick_day;

  // Determine day type
  const dateObj = new Date(date + 'T12:00:00');
  const dayIndex = dateObj.getDay(); // 0=Sun, 6=Sat
  const isSaturday = dayIndex === 6;

  // ── Compute week tallies from weekLogs ──────────────────────────────────
  const weekTallies: WeekTallies = {
    core: weekLogs.filter((l) => l.core_work_done).length,
    rug: weekLogs.filter((l) => l.rug_protocol_done).length,
    kitchen: weekLogs.filter((l) => l.kitchen_cutoff_hit).length,
    hydration: weekLogs.filter((l) => l.hydration_tracked).length,
  };

  // ── Sessions completed/planned ──────────────────────────────────────────
  const sessionsCompleted = weekLogs.filter((l) => l.workout_completed === 1).length;
  const sessionsPlanned = uncompletedSessions.length + sessionsCompleted;

  // ── Day compliance (progress ring) ──────────────────────────────────────
  const hasPlannedSession = !!plannedSession || selectedPlanItemId != null;
  const dayCompliance = computeDayCompliance(formData, hasPlannedSession);

  // ── Week compliance for bar ─────────────────────────────────────────────
  const bedtimeCompliantCount = weekLogs.filter(
    (l) => l.vampire_bedtime && isBedtimeCompliant(l.vampire_bedtime),
  ).length;

  const weekMetrics = [
    { label: 'Sessions', current: sessionsCompleted, target: sessionsPlanned || 1 },
    { label: 'Core', current: weekTallies.core, target: 3 },
    { label: 'Mobility', current: weekTallies.rug, target: 7 },
    { label: 'Food Cut', current: weekTallies.kitchen, target: 7 },
    { label: 'Hydration', current: weekTallies.hydration, target: 7 },
    { label: 'Bedtime', current: bedtimeCompliantCount, target: 7 },
  ];

  // Overall week compliance %
  const weekCompliancePct = computeWeekCompliancePct(
    weekLogs,
    weekLogs.map(() => false), // simplified: we don't know per-day session status from weekLogs alone
  );

  // ── SessionPicker callbacks ─────────────────────────────────────────────
  const handleSessionUpdate = (completed: number, planItemId: number | null) => {
    setSelectedPlanItemId(planItemId);
    const next = { ...formData, workout_completed: completed };
    setFormData(next);
    triggerSave(next, planItemId);
  };

  // ── Checklist callback ──────────────────────────────────────────────────
  const handleChecklistUpdate = (field: string, value: number) => {
    update({ [field]: value });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 1. Save status indicator (top right) */}
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

      {/* 2. DayProgress (if not Saturday) */}
      {!isSaturday && (
        <DayProgress
          checked={dayCompliance.checked}
          total={dayCompliance.total}
          streak={streak}
        />
      )}

      {/* 3. Sick day toggle */}
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

      {/* 4. SessionPicker (if not sick) */}
      {!isSick && (
        <SessionPicker
          date={date}
          plannedSession={plannedSession}
          uncompletedSessions={uncompletedSessions}
          workoutCompleted={formData.workout_completed}
          sessionsCompleted={sessionsCompleted}
          sessionsPlanned={sessionsPlanned}
          onUpdate={handleSessionUpdate}
        />
      )}

      {/* 4b. Start Session / Session completed link */}
      {!isSick && (plannedSession || selectedPlanItemId != null || formData.workout_completed) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {formData.workout_completed ? (
            <>
              <CheckCircleIcon sx={{ color: semanticColors.recovery.good, fontSize: 18 }} />
              <Typography variant="body2" sx={{ color: semanticColors.recovery.good, fontWeight: 600 }}>
                Session completed
              </Typography>
            </>
          ) : (
            <Link href="/session" style={{ textDecoration: 'none' }}>
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{
                  color: semanticColors.body,
                  border: `1px solid ${semanticColors.body}`,
                  borderRadius: 1,
                  px: 1.5,
                  py: 0.5,
                  display: 'inline-block',
                  '&:hover': { opacity: 0.8 },
                }}
              >
                Start Session →
              </Typography>
            </Link>
          )}
        </Box>
      )}

      {/* 5. EnergyPainCard (if not sick) */}
      {!isSick && (
        <EnergyPainCard
          energyLevel={formData.energy_level}
          painLevel={formData.pain_level}
          painArea={formData.pain_area}
          onEnergyChange={(level) => update({ energy_level: level })}
          onPainChange={(level) =>
            update({ pain_level: level, pain_area: level === 0 ? null : formData.pain_area })
          }
          onPainAreaChange={(area) => update({ pain_area: area })}
        />
      )}

      {/* 6. DailyChecklist (if not sick) / Hydration standalone if sick */}
      {!isSick ? (
        <DailyChecklist
          coreWorkDone={formData.core_work_done}
          rugProtocolDone={formData.rug_protocol_done}
          kitchenCutoffHit={formData.kitchen_cutoff_hit}
          hydrationTracked={formData.hydration_tracked}
          weekTallies={weekTallies}
          onUpdate={handleChecklistUpdate}
        />
      ) : (
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

      {/* 6. BedtimeCard (always visible) */}
      <BedtimeCard
        bedtime={formData.vampire_bedtime}
        onUpdate={(val) => update({ vampire_bedtime: val })}
      />

      {/* 7. NotesCard (always visible) */}
      <NotesCard
        notes={formData.notes}
        onUpdate={(val) => update({ notes: val })}
      />

      {/* 8. WeekComplianceBar */}
      <WeekComplianceBar metrics={weekMetrics} overallPct={weekCompliancePct} />

      {/* 9. ComplianceSparkline */}
      <ComplianceSparkline trend={complianceTrend} currentWeek={currentWeek} />
    </Box>
  );
}
