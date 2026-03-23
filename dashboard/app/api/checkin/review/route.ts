import { NextResponse } from 'next/server';
import { getDailyLogsByWeek, getWeekNotes } from '@/lib/db';
import { computeWeekSummary } from '@/lib/daily-log';
import { getWeekSessions } from '@/lib/session-db';
import { readGarminData } from '@/lib/garmin';
import { getTrainingWeek } from '@/lib/week';
import type { DailyLog } from '@/lib/db';
import type { WeekSummary } from '@/lib/daily-log';
import type { GarminFreshness } from '@/lib/types';
import type { SessionSetState, SessionCardioState } from '@/lib/types';

export interface WeeklyReviewData {
  weekNumber: number;
  dailyLogs: DailyLog[];
  taggedNotes: Array<{ date: string; category: string; text: string }>;
  sessions: Array<{
    date: string;
    sessionTitle: string;
    sessionType: string;
    compliancePct: number | null;
    sets: SessionSetState[];
    cardio: SessionCardioState[];
  }>;
  garmin: {
    timestamp: string;
    ageHours: number;
    status: GarminFreshness['status'];
    hasData: boolean;
  };
  compliance: WeekSummary;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekParam = searchParams.get('week');
  const weekNumber = weekParam ? parseInt(weekParam, 10) : getTrainingWeek();

  if (isNaN(weekNumber) || weekNumber < 1) {
    return NextResponse.json({ error: 'Invalid week number' }, { status: 400 });
  }

  const dailyLogs = getDailyLogsByWeek(weekNumber);
  const taggedNotes = getWeekNotes(weekNumber).map((n) => ({
    date: n.date,
    category: n.category,
    text: n.text,
  }));
  const sessions = getWeekSessions(weekNumber);
  const compliance = computeWeekSummary(weekNumber);

  const garminFreshness = readGarminData();
  const garmin = {
    timestamp: garminFreshness.timestamp,
    ageHours: Math.round(garminFreshness.ageHours * 10) / 10,
    status: garminFreshness.status,
    hasData: garminFreshness.data !== null,
  };

  const payload: WeeklyReviewData = {
    weekNumber,
    dailyLogs,
    taggedNotes,
    sessions,
    garmin,
    compliance,
  };

  return NextResponse.json(payload);
}
