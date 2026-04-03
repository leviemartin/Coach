'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Alert, Box, Button, Chip, IconButton, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DailyLog from '@/components/DailyLog';
import WeekDots from '@/components/WeekDots';
import type { UncompletedSession } from '@/components/SessionPicker';
import type { DailyNote } from '@/components/TaggedNotes';

const MS_PER_DAY = 86_400_000;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getEpochLocal(): Date {
  return new Date(2025, 11, 29); // Dec 29, 2025
}

function getWeekNumber(dateStr: string): number {
  const epochLocal = getEpochLocal();
  const dateLocal = parseLocalDate(dateStr);
  const daysSince = Math.round((dateLocal.getTime() - epochLocal.getTime()) / MS_PER_DAY);
  if (daysSince < 0) return 1;
  return Math.floor(daysSince / 7) + 1;
}

function getWeekDates(weekNumber: number): string[] {
  const epochLocal = getEpochLocal();
  const monday = new Date(epochLocal.getTime() + (weekNumber - 1) * 7 * MS_PER_DAY);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getTime() + i * MS_PER_DAY);
    return toDateStr(d);
  });
}

function getTodayStr(): string {
  return toDateStr(new Date());
}

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

const DEFAULT_LOG: LogData = {
  workout_completed: 0,
  core_work_done: 0,
  rug_protocol_done: 0,
  vampire_bedtime: null,
  hydration_tracked: 0,
  kitchen_cutoff_hit: 0,
  is_sick_day: 0,
  notes: null,
  energy_level: null,
  pain_level: null,
  pain_area: null,
  sleep_disruption: null,
  session_summary: null,
  session_log_id: null,
};

export default function DailyLogPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(getTodayStr);
  const [log, setLog] = useState<LogData>(DEFAULT_LOG);
  const [dailyLogId, setDailyLogId] = useState<number | null>(null);
  const [dailyNotes, setDailyNotes] = useState<DailyNote[]>([]);
  const [plannedSession, setPlannedSession] = useState<PlannedSession | null>(null);
  const [uncompletedSessions, setUncompletedSessions] = useState<UncompletedSession[]>([]);
  const [totalTrainingSessions, setTotalTrainingSessions] = useState<number>(0);
  const [streak, setStreak] = useState<{ current: number; best: number }>({ current: 0, best: 0 });
  const [familyDates, setFamilyDates] = useState<string[]>([]);
  const [weekPlanItems, setWeekPlanItems] = useState<Array<{ date: string; session_type: string; focus: string; status: string; completed: number }>>([]);
  const [weekLogs, setWeekLogs] = useState<WeekLog[]>([]);
  const [complianceTrend, setComplianceTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const weekNumber = getWeekNumber(currentDate);
  const todayStr = getTodayStr();
  const isToday = currentDate === todayStr;
  const canGoForward = currentDate < todayStr;

  const fetchDayLog = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/log?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        const prevSleepDisruption: string | null = data.sleep_disruption_for_last_night ?? null;
        const rawLog: LogData = data.log || DEFAULT_LOG;
        // Pre-populate sleep_disruption with previous night's saved value when current day has none
        setLog({
          ...rawLog,
          sleep_disruption: rawLog.sleep_disruption ?? prevSleepDisruption,
        });
        setDailyLogId(data.log?.id ?? null);
        setDailyNotes(data.daily_notes || []);
        setPlannedSession(data.planned_session || null);
        setUncompletedSessions(data.uncompleted_sessions || []);
        setTotalTrainingSessions(data.total_training_sessions ?? 0);
        setStreak(data.streak || { current: 0, best: 0 });
        setFamilyDates(data.family_dates || []);
        setWeekPlanItems(data.week_plan_items || []);
      }
    } catch {
      // keep existing state
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWeekLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/log/week?week=${weekNumber}`);
      if (res.ok) {
        const data = await res.json();
        setWeekLogs(data.logs || []);
      }
    } catch {
      // keep existing state
    }
  }, [weekNumber]);

  const fetchComplianceTrend = useCallback(async () => {
    try {
      const res = await fetch('/api/log/compliance-trend?weeks=4');
      if (res.ok) {
        const data = await res.json();
        setComplianceTrend(data.trend || []);
      }
    } catch {
      // keep existing state
    }
  }, []);

  useEffect(() => {
    fetchDayLog(currentDate);
  }, [currentDate, fetchDayLog]);

  useEffect(() => {
    fetchWeekLogs();
  }, [fetchWeekLogs]);

  // Fetch compliance trend once on mount
  useEffect(() => {
    fetchComplianceTrend();
  }, [fetchComplianceTrend]);

  const handleNotesChange = useCallback(() => {
    fetchDayLog(currentDate);
  }, [fetchDayLog, currentDate]);

  const handleSave = async (data: Record<string, unknown>) => {
    const res = await fetch('/api/log', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, date: currentDate }),
    });
    if (!res.ok) throw new Error('Save failed');
    fetchWeekLogs();
    fetchDayLog(currentDate);
  };

  const navigateDay = (delta: number) => {
    const d = parseLocalDate(currentDate);
    d.setDate(d.getDate() + delta);
    const next = toDateStr(d);
    if (next <= todayStr) setCurrentDate(next);
  };

  // Build week dots data
  const weekDates = getWeekDates(weekNumber);
  const familyDateSet = new Set(familyDates);
  const days = weekDates.map((date, i) => {
    const abbr = DAY_ABBR[i]; // Mon-Sun since weekDates starts on Monday

    if (familyDateSet.has(date)) {
      return { date, day: abbr, status: 'family' as const };
    }

    const wl = weekLogs.find((l) => l.date === date);
    if (!wl) return { date, day: abbr, status: 'empty' as const };

    // Check completeness: all non-sick applicable fields filled
    const isSick = !!wl.is_sick_day;
    let allFilled: boolean;
    if (isSick) {
      allFilled = !!wl.hydration_tracked && !!wl.vampire_bedtime;
    } else {
      allFilled =
        !!wl.vampire_bedtime &&
        !!wl.hydration_tracked &&
        (!!wl.workout_completed || true) && // workout is optional if rest day
        !!wl.core_work_done &&
        !!wl.rug_protocol_done &&
        !!wl.kitchen_cutoff_hit;
    }

    const anyFilled =
      !!wl.workout_completed ||
      !!wl.core_work_done ||
      !!wl.rug_protocol_done ||
      !!wl.vampire_bedtime ||
      !!wl.hydration_tracked ||
      !!wl.kitchen_cutoff_hit;

    if (allFilled) return { date, day: abbr, status: 'complete' as const };
    if (anyFilled) return { date, day: abbr, status: 'partial' as const };
    return { date, day: abbr, status: 'empty' as const };
  });

  const dateObj = parseLocalDate(currentDate);
  const dayName = DAY_NAMES[dateObj.getDay()];
  const isFamilyDay = familyDateSet.has(currentDate);

  // Determine the workout label chip text
  let sessionLabel: string | null = null;
  if (isFamilyDay) {
    sessionLabel = 'Family Day';
  } else if (plannedSession) {
    sessionLabel = plannedSession.focus;
  } else {
    sessionLabel = 'Rest Day';
  }

  // Sunday nudge banner logic
  const now = new Date();
  const isSunday = now.getDay() === 0;
  const isAfter20 = now.getHours() >= 20;
  const viewingToday = currentDate === todayStr;

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto' }}>
      {/* Sunday nudge banner */}
      {isSunday && viewingToday && isAfter20 && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => router.push('/checkin')}>
              Start Check-In
            </Button>
          }
        >
          Your week is ready for review. Start check-in.
        </Alert>
      )}
      {isSunday && viewingToday && !isAfter20 && (
        <Alert severity="info" variant="outlined" sx={{ mb: 2, opacity: 0.7 }}>
          Sunday&apos;s data isn&apos;t complete yet. Best results after 20:00.
        </Alert>
      )}

      {/* Date Navigation */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          mb: 1,
        }}
      >
        <IconButton onClick={() => navigateDay(-1)} aria-label="Previous day" size="small">
          <ChevronLeftIcon />
        </IconButton>
        <Box sx={{ textAlign: 'center', minWidth: 160 }}>
          <Typography variant="h5">
            {dayName}
          </Typography>
          <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
            {dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            {' \u00B7 '}
            Week {weekNumber}
          </Typography>
          {/* Workout label chip */}
          <Chip
            label={sessionLabel}
            size="small"
            color={isFamilyDay ? 'secondary' : plannedSession ? 'primary' : 'default'}
            variant="outlined"
            sx={{ mt: 0.5 }}
          />
        </Box>
        <IconButton
          onClick={() => navigateDay(1)}
          disabled={!canGoForward}
          aria-label="Next day"
          size="small"
        >
          <ChevronRightIcon />
        </IconButton>
      </Box>

      {/* Week Dots */}
      <WeekDots days={days} currentDate={currentDate} onDayClick={setCurrentDate} />

      {/* Daily Log Form */}
      <Box sx={{ mt: 2, opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
        <DailyLog
          date={currentDate}
          log={log}
          plannedSession={plannedSession}
          uncompletedSessions={uncompletedSessions}
          totalTrainingSessions={totalTrainingSessions}
          weekLogs={weekLogs}
          streak={streak}
          complianceTrend={complianceTrend}
          currentWeek={weekNumber}
          onSave={handleSave}
          dailyLogId={dailyLogId}
          dailyNotes={dailyNotes}
          onNotesChange={handleNotesChange}
          onDayClick={setCurrentDate}
          isFamilyDay={isFamilyDay}
          weekPlanItems={weekPlanItems}
        />
      </Box>
    </Box>
  );
}
