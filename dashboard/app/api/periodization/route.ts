import { NextResponse } from 'next/server';
import { readPeriodization } from '@/lib/state';
import { getTrainingWeek } from '@/lib/week';

interface PhaseInfo {
  number: number;
  name: string;
  dateRange: string;
  isCurrent: boolean;
  weightTarget: string;
  focus: string[];
}

interface PeriodizationResponse {
  phases: PhaseInfo[];
  currentPhase: PhaseInfo;
  currentWeek: number;
  targets: {
    raceWeight: string;
    stretchWeight: string;
    protein: string;
    calories: string;
  };
}

// Month ranges for each phase (approximate, for current-phase detection)
const PHASE_DATE_RANGES: Array<{ start: [number, number]; end: [number, number] }> = [
  { start: [2026, 1], end: [2026, 3] },   // Phase 1: Jan-Mar 2026
  { start: [2026, 4], end: [2026, 6] },   // Phase 2: Apr-Jun 2026
  { start: [2026, 7], end: [2026, 10] },  // Phase 3: Jul-Oct 2026
  { start: [2026, 11], end: [2027, 2] },  // Phase 4: Nov 2026-Feb 2027
  { start: [2027, 3], end: [2027, 5] },   // Phase 5: Mar-May 2027
  { start: [2027, 6], end: [2027, 7] },   // Phase 6: Jun-Jul 2027
];

function getCurrentPhaseNumber(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  for (let i = 0; i < PHASE_DATE_RANGES.length; i++) {
    const { start, end } = PHASE_DATE_RANGES[i];
    const startVal = start[0] * 100 + start[1];
    const endVal = end[0] * 100 + end[1];
    const nowVal = year * 100 + month;
    if (nowVal >= startVal && nowVal <= endVal) {
      return i + 1;
    }
  }
  // Before Phase 1 or after Phase 6 — default to nearest
  const nowVal = now.getFullYear() * 100 + (now.getMonth() + 1);
  if (nowVal < PHASE_DATE_RANGES[0].start[0] * 100 + PHASE_DATE_RANGES[0].start[1]) return 1;
  return 6;
}

function parsePeriodization(markdown: string): PhaseInfo[] {
  const phases: PhaseInfo[] = [];
  const currentPhaseNum = getCurrentPhaseNumber();

  // Split on phase headers
  const phaseRegex = /### Phase (\d+): ([^\n(]+?)(?:\s*\(([^)]+)\))?(?:\s*←\s*CURRENT)?\s*\n([\s\S]*?)(?=### Phase \d+:|---|\n## |$)/g;
  let match;

  while ((match = phaseRegex.exec(markdown)) !== null) {
    const number = parseInt(match[1]);
    const name = match[2].trim();
    const dateRange = match[3]?.trim() || '';
    const body = match[4];

    // Extract weight target
    const weightMatch = body.match(/\*\*Weight Target:\*\*\s*(.+)/);
    const weightTarget = weightMatch ? weightMatch[1].trim() : '';

    // Extract focus bullets from Key Programming section or Focus line
    const focus: string[] = [];
    const keyProgMatch = body.match(/\*\*Key Programming:\*\*\s*\n((?:\s*-\s*.+\n?)+)/);
    if (keyProgMatch) {
      const bullets = keyProgMatch[1].match(/^\s*-\s*(.+)/gm);
      if (bullets) {
        for (const b of bullets.slice(0, 5)) {
          focus.push(b.replace(/^\s*-\s*/, '').trim());
        }
      }
    }

    // If no Key Programming, fall back to Focus line
    if (focus.length === 0) {
      const focusMatch = body.match(/\*\*Focus:\*\*\s*(.+)/);
      if (focusMatch) {
        const parts = focusMatch[1].split(/[.,]/).map(s => s.trim()).filter(Boolean);
        focus.push(...parts.slice(0, 5));
      }
    }

    phases.push({
      number,
      name,
      dateRange,
      isCurrent: number === currentPhaseNum,
      weightTarget,
      focus,
    });
  }

  return phases;
}

// Determine protein target based on current weight bracket
function getProteinTarget(currentWeight: number | null): string {
  if (!currentWeight) return '180g';
  if (currentWeight >= 95) return '180g';
  if (currentWeight >= 92) return '190g';
  return '200g';
}

export async function GET() {
  const markdown = readPeriodization();
  const phases = parsePeriodization(markdown);
  const currentWeek = getTrainingWeek();
  const currentPhaseNum = getCurrentPhaseNumber();
  const currentPhase = phases.find(p => p.number === currentPhaseNum) || phases[0];

  // Mark current phase
  for (const p of phases) {
    p.isCurrent = p.number === currentPhaseNum;
  }

  const response: PeriodizationResponse = {
    phases,
    currentPhase,
    currentWeek,
    targets: {
      raceWeight: '89kg',
      stretchWeight: '87kg',
      protein: getProteinTarget(null), // Will be overridden client-side with actual weight
      calories: '2,350 kcal',
    },
  };

  return NextResponse.json(response);
}
