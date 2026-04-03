import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getTrainingWeek } from '@/lib/week';

// Temporary diagnostic endpoint — remove after fixing session data
export async function GET() {
  const db = getDb();
  const week = getTrainingWeek();

  const sessionLogs = db.prepare(`
    SELECT id, date, week_number, session_type, session_title, started_at, completed_at, compliance_pct
    FROM session_logs WHERE week_number = ? ORDER BY id
  `).all(week);

  const dailyLogs = db.prepare(`
    SELECT date, workout_completed, workout_plan_item_id, session_log_id, session_summary
    FROM daily_logs WHERE week_number = ? ORDER BY date
  `).all(week);

  const planItems = db.prepare(`
    SELECT id, day, focus, session_type, assigned_date, status, completed, has_structured_exercises
    FROM plan_items WHERE week_number = ? ORDER BY day_order
  `).all(week);

  const migrations = db.prepare(`
    SELECT key, value FROM settings WHERE key LIKE 'dedup%' OR key LIKE 'fix_session%'
  `).all();

  return NextResponse.json({ week, sessionLogs, dailyLogs, planItems, migrations }, { status: 200 });
}
