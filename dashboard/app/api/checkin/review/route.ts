import { NextResponse } from 'next/server';
import { getDailyLogsByWeek } from '@/lib/db';
import { computeWeekSummary } from '@/lib/daily-log';
import { getWeekSessions } from '@/lib/session-db';
import { readGarminData } from '@/lib/garmin';
import { getTrainingWeek } from '@/lib/week';
import { suggestModel } from '@/lib/model-suggestion';
import type { DailyLog } from '@/lib/db';
import type { WeekSummary } from '@/lib/daily-log';
import type { ModelSuggestion } from '@/lib/model-suggestion';
import type { GarminFreshness } from '@/lib/types';
import type { SessionSetState, SessionCardioState } from '@/lib/types';

export interface WeeklyReviewData {
  weekNumber: number;
  dailyLogs: DailyLog[];
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
  modelSuggestion: ModelSuggestion;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekParam = searchParams.get('week');
  const weekNumber = weekParam ? parseInt(weekParam, 10) : getTrainingWeek();

  if (isNaN(weekNumber) || weekNumber < 1) {
    return NextResponse.json({ error: 'Invalid week number' }, { status: 400 });
  }

  const dailyLogs = getDailyLogsByWeek(weekNumber);
  const sessions = getWeekSessions(weekNumber);
  const compliance = computeWeekSummary(weekNumber);

  const garminFreshness = readGarminData();
  const garmin = {
    timestamp: garminFreshness.timestamp,
    ageHours: Math.round(garminFreshness.ageHours * 10) / 10,
    status: garminFreshness.status,
    hasData: garminFreshness.data !== null,
  };

  const modelSuggestion = suggestModel(compliance, weekNumber);

  const payload: WeeklyReviewData = {
    weekNumber,
    dailyLogs,
    sessions,
    garmin,
    compliance,
    modelSuggestion,
  };

  return NextResponse.json(payload);
}
