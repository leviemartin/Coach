import { NextResponse } from 'next/server';
import { getWeeklyLogFiles, readWeeklyLog } from '@/lib/state';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get('week');

  if (week) {
    const weekNum = parseInt(week);
    if (isNaN(weekNum)) {
      return NextResponse.json({ error: 'Invalid week number' }, { status: 400 });
    }
    const logs = getWeeklyLogFiles();
    const logFile = logs.find((l) => l.weekNumber === weekNum);
    if (!logFile) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const content = readWeeklyLog(logFile.filename);
    return NextResponse.json({ ...logFile, content });
  }

  const logs = getWeeklyLogFiles().reverse();
  return NextResponse.json({ logs });
}
