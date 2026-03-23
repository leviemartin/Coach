/**
 * Tests for E2: buildSharedContext tiered history integration
 *
 * Verifies that:
 * - Structured path (CheckinSubjectiveData) uses tiered history sections
 * - Legacy path (CheckInFormData) still uses the old "Training History" heading
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock all external dependencies ───────────────────────────────────────────

vi.mock('../lib/state', () => ({
  readAthleteProfile: () => 'Test athlete profile',
  readTrainingHistory: () => '## Week 1\nTest history content',
  readCeilings: () => ({ last_updated: '', week: 0, ceilings: {}, progression_history: [] }),
  readPeriodization: () => 'Test periodization content',
  readDecisionsLog: () => 'Test decisions log content',
  readDexaScans: () => ({ scans: [], latest_calibration: null }),
  readAgentPersona: () => 'Test persona content',
}));

vi.mock('../lib/db', () => ({
  getDailyLogsByWeek: () => [],
  getWeekNotes: () => [],
  getWeeklyMetrics: () => [],
  getCeilingHistory: () => [],
  getPlanItems: () => [],
}));

vi.mock('../lib/session-db', () => ({
  getWeekSessions: () => [],
}));

vi.mock('../lib/week', () => ({
  getTrainingWeek: () => 12,
}));

// ── Test data helpers ─────────────────────────────────────────────────────────

function makeSubjectiveData() {
  return {
    perceivedReadiness: 3,
    planSatisfaction: 3,
    weekReflection: 'Good week overall',
    nextWeekConflicts: '',
    questionsForCoaches: '',
    model: 'sonnet' as const,
  };
}

function makeLegacyFormData() {
  return {
    hevyCsv: '',
    bakerCystPain: 0,
    lowerBackFatigue: 0,
    sessionsCompleted: 3,
    sessionsPlanned: 5,
    missedSessions: '',
    strengthWins: '',
    struggles: '',
    bedtimeCompliance: 4,
    rugProtocolDays: 3,
    hydrationTracked: false,
    upcomingConflicts: '',
    focusNextWeek: '',
    questionsForCoaches: '',
    perceivedReadiness: 3,
    planSatisfaction: 3,
    planFeedback: '',
    model: 'sonnet' as const,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildSharedContext tiered history integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('structured context includes Historical Context section', async () => {
    const { buildSharedContext } = await import('../lib/agents');
    const result = buildSharedContext(null, makeSubjectiveData());
    expect(result).toContain('## Historical Context');
  });

  it('structured context includes Recent Detail section', async () => {
    const { buildSharedContext } = await import('../lib/agents');
    const result = buildSharedContext(null, makeSubjectiveData());
    expect(result).toContain('### Recent Detail');
  });

  it('structured context includes Weekly Summaries section', async () => {
    const { buildSharedContext } = await import('../lib/agents');
    const result = buildSharedContext(null, makeSubjectiveData());
    expect(result).toContain('### Weekly Summaries');
  });

  it('structured context includes Long-Term Trends section', async () => {
    const { buildSharedContext } = await import('../lib/agents');
    const result = buildSharedContext(null, makeSubjectiveData());
    expect(result).toContain('### Long-Term Trends');
  });

  it('structured context does NOT include old "Training History (Last 4 Weeks)" heading', async () => {
    const { buildSharedContext } = await import('../lib/agents');
    const result = buildSharedContext(null, makeSubjectiveData());
    expect(result).not.toContain('## Training History (Last 4 Weeks)');
  });

  it('legacy context still uses Training History heading', async () => {
    const { buildSharedContext } = await import('../lib/agents');
    const result = buildSharedContext(null, makeLegacyFormData());
    expect(result).toContain('## Training History (Last 4 Weeks)');
  });
});
