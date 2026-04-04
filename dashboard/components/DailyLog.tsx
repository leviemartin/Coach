'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Switch,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BedtimeCard from './BedtimeCard';
import TaggedNotes from './TaggedNotes';
import type { DailyNote } from './TaggedNotes';
import SessionPicker from './SessionPicker';
import SwapSessionPicker from './SwapSessionPicker';
import SessionSummaryCard from './SessionSummaryCard';
import DailyChecklist from './DailyChecklist';
import DayProgress from './DayProgress';
import EnergyPainCard from './EnergyPainCard';
import SleepDisruptionCard from './SleepDisruptionCard';
import WeekComplianceBar from './WeekComplianceBar';
import ComplianceSparkline from './ComplianceSparkline';
import WeekOverview from './WeekOverview';
import type { WeekDay } from './WeekOverview';
import { computeDayCompliance, computeWeekCompliancePct, isBedtimeCompliant } from '@/lib/compliance';
import type { UncompletedSession } from './SessionPicker';
import type { WeekTallies } from './DailyChecklist';
import type { PlanItem } from '@/lib/types';

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
  sleep_disruption: string | null;
  session_summary: string | null;
  session_log_id: number | null;
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
  totalTrainingSessions: number;
  weekLogs: WeekLog[];
  streak: { current: number; best: number };
  complianceTrend: TrendPoint[];
  currentWeek: number;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  dailyLogId: number | null;
  dailyNotes: DailyNote[];
  onNotesChange: () => void;
  /** Optional: called when a day cell is clicked in the week overview */
  onDayClick?: (date: string) => void;
  /** Whether this date is a family day according to the plan */
  isFamilyDay?: boolean;
  /** All plan items for the week with resolved dates */
  weekPlanItems?: Array<{ date: string; session_type: string; focus: string; status: string; completed: number }>;
  /** Session compliance percentage from session_logs */
  sessionCompliancePct?: number | null;
}

// ── Week date helpers ────────────────────────────────────────────────────────
const MS_PER_DAY = 86_400_000;
const EPOCH_LOCAL = new Date(2025, 11, 29); // Dec 29, 2025 (Monday)
const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWeekDatesForDate(dateStr: string): string[] {
  const dateLocal = parseLocalDate(dateStr);
  const daysSince = Math.round((dateLocal.getTime() - EPOCH_LOCAL.getTime()) / MS_PER_DAY);
  const weekNumber = daysSince < 0 ? 1 : Math.floor(daysSince / 7) + 1;
  const monday = new Date(EPOCH_LOCAL.getTime() + (weekNumber - 1) * 7 * MS_PER_DAY);
  return Array.from({ length: 7 }, (_, i) => toDateStr(new Date(monday.getTime() + i * MS_PER_DAY)));
}

function buildWeekDays(
  date: string,
  weekLogs: WeekLog[],
  weekPlanItems: Array<{ date: string; session_type: string; focus: string; status: string; completed: number }>,
): WeekDay[] {
  const weekDates = getWeekDatesForDate(date);

  return weekDates.map((d, i) => {
    const dayName = DAY_ABBR[i];
    const isToday = d === date;

    // Find plan item for this date (works for both swapped and unswapped)
    const planItem = weekPlanItems.find((p) => p.date === d);
    const sessionFocus = planItem?.focus ?? null;

    // Family/rest detection
    const isRestOrFamily = planItem != null && /rest|family/i.test(planItem.session_type);
    if (isRestOrFamily) {
      const isFamily = /family/i.test(planItem!.session_type);
      return { date: d, dayName, sessionType: null, sessionFocus, status: isFamily ? 'family' as const : 'rest' as const };
    }

    // Check if workout was actually completed on this date
    const wl = weekLogs.find((l) => l.date === d);
    if (wl?.workout_completed) {
      return { date: d, dayName, sessionType: null, sessionFocus, status: 'done' as const };
    }

    if (isToday && planItem) {
      return { date: d, dayName, sessionType: null, sessionFocus, status: 'today' as const };
    }

    if (!planItem) {
      return { date: d, dayName, sessionType: null, sessionFocus: null, status: 'rest' as const };
    }

    return { date: d, dayName, sessionType: null, sessionFocus, status: 'pending' as const };
  });
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

export default function DailyLog({
  date,
  log,
  plannedSession,
  uncompletedSessions,
  totalTrainingSessions,
  weekLogs,
  streak,
  complianceTrend,
  currentWeek,
  onSave,
  dailyLogId,
  dailyNotes,
  onNotesChange,
  onDayClick,
  isFamilyDay = false,
  weekPlanItems = [],
  sessionCompliancePct,
}: DailyLogProps) {
  const [formData, setFormData] = useState<LogData>(log);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [selectedPlanItemId, setSelectedPlanItemId] = useState<number | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [swapPlanItems, setSwapPlanItems] = useState<PlanItem[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset form when date/log changes
  useEffect(() => {
    setFormData(log);
    setSaveStatus('idle');
    setSelectedPlanItemId(null);
    setSwapMode(false);
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


  // ── Compute week tallies from weekLogs ──────────────────────────────────
  const weekTallies: WeekTallies = {
    rug: weekLogs.filter((l) => l.rug_protocol_done).length,
    kitchen: weekLogs.filter((l) => l.kitchen_cutoff_hit).length,
    hydration: weekLogs.filter((l) => l.hydration_tracked).length,
  };

  // ── Sessions completed/planned ──────────────────────────────────────────
  const sessionsCompleted = weekLogs.filter((l) => l.workout_completed === 1).length;
  const sessionsPlanned = totalTrainingSessions || (uncompletedSessions.length + sessionsCompleted);

  // ── Week overview days ───────────────────────────────────────────────────
  const weekDays = buildWeekDays(date, weekLogs, weekPlanItems);

  // ── Day compliance (progress ring) ──────────────────────────────────────
  const hasPlannedSession = !!plannedSession || selectedPlanItemId != null;
  const dayCompliance = computeDayCompliance(formData, hasPlannedSession);

  // ── Week compliance for bar ─────────────────────────────────────────────
  const bedtimeCompliantCount = weekLogs.filter(
    (l) => l.vampire_bedtime && isBedtimeCompliant(l.vampire_bedtime),
  ).length;

  const weekMetrics = [
    { label: 'Sessions', current: sessionsCompleted, target: sessionsPlanned || 1 },
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
  // ── Checklist callback ──────────────────────────────────────────────────
  const handleChecklistUpdate = (field: string, value: number) => {
    update({ [field]: value });
  };

  // ── Swap mode handlers ──────────────────────────────────────────────────
  const handleOpenSwap = async () => {
    setSwapMode(true);
    try {
      const res = await fetch(`/api/plan?week=${currentWeek}`);
      const data = await res.json();
      setSwapPlanItems(data.items ?? []);
    } catch {
      // Keep empty list on error — user can cancel
    }
  };

  const handleSwap = async (planItemId: number) => {
    try {
      const res = await fetch('/api/plan/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planItemId, targetDate: date }),
      });
      if (!res.ok) {
        console.error('Swap failed:', res.status);
        return;
      }
      setSwapMode(false);
      await onSave({ ...formData, workout_plan_item_id: planItemId });
    } catch (err) {
      console.error('Swap error:', err);
    }
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

      {/* 2. Week Overview accordion */}
      <Accordion
        disableGutters
        elevation={0}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2, py: 0.5, minHeight: 40 }}>
          <Typography variant="body2" fontWeight={600}>
            This Week
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 1.5, pb: 1.5, pt: 0.5 }}>
          <WeekOverview
            days={weekDays}
            sessionsCompleted={sessionsCompleted}
            sessionsPlanned={sessionsPlanned}
            currentDate={date}
            onDayClick={onDayClick ?? (() => {})}
          />
        </AccordionDetails>
      </Accordion>

      {/* 3. DayProgress */}
      {(
        <DayProgress
          checked={dayCompliance.checked}
          total={dayCompliance.total}
          streak={streak}
        />
      )}

      {/* 4. Sick day toggle */}
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

      {/* 4. SessionPicker / SwapSessionPicker (if not sick) */}
      {!isSick && !swapMode && (
        <SessionPicker
          date={date}
          plannedSession={plannedSession}
          sessionsCompleted={sessionsCompleted}
          sessionsPlanned={sessionsPlanned}
          isFamilyDay={isFamilyDay}
          sessionCompleted={!!formData.session_summary || (isFamilyDay && !!formData.workout_completed)}
          sessionLogId={formData.session_log_id}
          compliancePct={sessionCompliancePct ?? null}
          onSwap={handleOpenSwap}
          onMarkFamilyDone={() => {
            const next = { ...formData, workout_completed: 1 };
            setFormData(next);
            triggerSave(next, plannedSession?.id ?? null);
          }}
        />
      )}
      {!isSick && swapMode && (
        <SwapSessionPicker
          weekItems={swapPlanItems}
          currentDate={date}
          suggestedItemId={plannedSession?.id ?? null}
          onSwap={handleSwap}
          onCancel={() => setSwapMode(false)}
        />
      )}

      {/* 4b. SessionSummaryCard (after session completed) */}
      {!isSick && formData.session_summary && (
        <SessionSummaryCard
          sessionSummary={formData.session_summary}
          sessionLogId={formData.session_log_id}
        />
      )}

      {/* 5. SleepDisruptionCard (always visible) */}
      {(() => {
        const prevDate = new Date(date + 'T12:00:00');
        prevDate.setDate(prevDate.getDate() - 1);
        const previousDayName = prevDate.toLocaleDateString('en-US', { weekday: 'long' });
        return (
          <SleepDisruptionCard
            value={formData.sleep_disruption}
            previousDayName={previousDayName}
            onChange={(value) => update({ sleep_disruption: value })}
          />
        );
      })()}

      {/* 6. EnergyPainCard (if not sick) */}
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

      {/* 7. DailyChecklist (if not sick) / Hydration standalone if sick */}
      {!isSick ? (
        <DailyChecklist
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

      {/* 7. TaggedNotes (always visible) */}
      <TaggedNotes
        dailyLogId={dailyLogId}
        notes={dailyNotes}
        onNotesChange={onNotesChange}
      />

      {/* 8. WeekComplianceBar */}
      <WeekComplianceBar metrics={weekMetrics} overallPct={weekCompliancePct} />

      {/* 9. ComplianceSparkline */}
      <ComplianceSparkline trend={complianceTrend} currentWeek={currentWeek} />
    </Box>
  );
}
