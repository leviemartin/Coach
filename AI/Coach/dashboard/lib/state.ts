import fs from 'fs';
import path from 'path';
import {
  ATHLETE_PROFILE_PATH,
  TRAINING_HISTORY_PATH,
  CURRENT_CEILINGS_PATH,
  PERIODIZATION_PATH,
  DECISIONS_LOG_PATH,
  WEEKLY_LOGS_DIR,
  COACHES_DIR,
  AGENT_FILES,
} from './constants';
import type { CeilingsData } from './types';

export function readFileOrEmpty(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

export function readAthleteProfile(): string {
  return readFileOrEmpty(ATHLETE_PROFILE_PATH);
}

export function readTrainingHistory(lastNWeeks = 4): string {
  const content = readFileOrEmpty(TRAINING_HISTORY_PATH);
  if (!content || lastNWeeks <= 0) return content;

  // Try to extract last N weeks by splitting on week headers
  const weekSections = content.split(/(?=^## Week \d+)/m);
  const lastSections = weekSections.slice(-lastNWeeks);
  return lastSections.join('\n');
}

export function readCeilings(): CeilingsData {
  try {
    const raw = fs.readFileSync(CURRENT_CEILINGS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { last_updated: '', week: 0, ceilings: {}, progression_history: [] };
  }
}

export function writeCeilings(data: CeilingsData): void {
  fs.writeFileSync(CURRENT_CEILINGS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function readPeriodization(): string {
  return readFileOrEmpty(PERIODIZATION_PATH);
}

export function readDecisionsLog(): string {
  return readFileOrEmpty(DECISIONS_LOG_PATH);
}

export function readAgentPersona(agentId: string): string {
  const filename = AGENT_FILES[agentId];
  if (!filename) return '';
  return readFileOrEmpty(path.join(COACHES_DIR, filename));
}

export function listWeeklyLogs(): string[] {
  try {
    const files = fs.readdirSync(WEEKLY_LOGS_DIR);
    return files
      .filter((f) => f.startsWith('week_') && f.endsWith('.md'))
      .sort();
  } catch {
    return [];
  }
}

export function readWeeklyLog(filename: string): string {
  return readFileOrEmpty(path.join(WEEKLY_LOGS_DIR, filename));
}

export function writeWeeklyLog(weekNumber: number, date: string, content: string): void {
  if (!fs.existsSync(WEEKLY_LOGS_DIR)) {
    fs.mkdirSync(WEEKLY_LOGS_DIR, { recursive: true });
  }
  const filename = `week_${String(weekNumber).padStart(2, '0')}_${date}.md`;
  fs.writeFileSync(path.join(WEEKLY_LOGS_DIR, filename), content, 'utf-8');
}

export function appendTrainingHistory(content: string): void {
  const existing = readFileOrEmpty(TRAINING_HISTORY_PATH);
  fs.writeFileSync(TRAINING_HISTORY_PATH, existing + '\n\n' + content, 'utf-8');
}

export function getWeeklyLogFiles(): Array<{ filename: string; weekNumber: number; date: string }> {
  return listWeeklyLogs().map((filename) => {
    const match = filename.match(/week_(\d+)_(\d{4}-\d{2}-\d{2})\.md/);
    return {
      filename,
      weekNumber: match ? parseInt(match[1]) : 0,
      date: match ? match[2] : '',
    };
  });
}

export function readWeeklyLogSynthesis(weekNumber: number): string {
  const logs = getWeeklyLogFiles();
  const logEntry = logs.find((l) => l.weekNumber === weekNumber);
  if (!logEntry) return '';

  const content = readWeeklyLog(logEntry.filename);
  const marker = '## Head Coach Synthesis';
  const idx = content.indexOf(marker);
  if (idx === -1) return '';

  return content.slice(idx);
}
