import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeDayCompliance,
  computeWeekCompliancePct,
  getBedtimeComplianceLevel,
  getComplianceColor,
  computeStreak,
  computeWeekSummary,
  formatWeekSummaryForAgents,
} from '@/lib/daily-log';
import type { DayComplianceInput, ComplianceResult, StreakLogEntry } from '@/lib/daily-log';

// ── Mocks for server-side db functions ────────────────────────────────────

vi.mock('@/lib/db', () => ({
  getDailyLogsByWeek: vi.fn(),
  getPlanItems: vi.fn(),
  getWeekNotes: vi.fn(),
}));

import * as dbMock from '@/lib/db';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeLog(overrides: Partial<DayComplianceInput> = {}): DayComplianceInput {
  return {
    workout_completed: 0,
    rug_protocol_done: 0,
    vampire_bedtime: null,
    hydration_tracked: 0,
    kitchen_cutoff_hit: 0,
    is_sick_day: 0,
    ...overrides,
  };
}

// ── computeDayCompliance ───────────────────────────────────────────────────

describe('computeDayCompliance', () => {
  it('returns 5/5 for a fully completed training day', () => {
    const log = makeLog({
      workout_completed: 1,
      rug_protocol_done: 1,
      vampire_bedtime: '22:30',
      hydration_tracked: 1,
      kitchen_cutoff_hit: 1,
    });
    const result: ComplianceResult = computeDayCompliance(log, true);
    expect(result.checked).toBe(5);
    expect(result.total).toBe(5);
    expect(result.pct).toBe(100);
  });

  it('returns 4/4 for a fully completed rest day (no planned session)', () => {
    const log = makeLog({
      rug_protocol_done: 1,
      vampire_bedtime: '22:00',
      hydration_tracked: 1,
      kitchen_cutoff_hit: 1,
    });
    const result = computeDayCompliance(log, false);
    expect(result.checked).toBe(4);
    expect(result.total).toBe(4);
    expect(result.pct).toBe(100);
  });

  it('returns 2/2 for a sick day with all items completed', () => {
    const log = makeLog({
      is_sick_day: 1,
      hydration_tracked: 1,
      vampire_bedtime: '22:00',
      // other items should be ignored

      rug_protocol_done: 1,
      kitchen_cutoff_hit: 1,
    });
    const result = computeDayCompliance(log, true);
    expect(result.checked).toBe(2);
    expect(result.total).toBe(2);
    expect(result.pct).toBe(100);
  });

  it('returns 0/2 for a sick day with nothing completed', () => {
    const log = makeLog({ is_sick_day: 1 });
    const result = computeDayCompliance(log, true);
    expect(result.checked).toBe(0);
    expect(result.total).toBe(2);
    expect(result.pct).toBe(0);
  });

  it('returns 1/2 for a sick day with only hydration tracked', () => {
    const log = makeLog({ is_sick_day: 1, hydration_tracked: 1 });
    const result = computeDayCompliance(log, false);
    expect(result.checked).toBe(1);
    expect(result.total).toBe(2);
    expect(result.pct).toBe(50);
  });

  it('counts bedtime when vampire_bedtime is set on a normal day', () => {
    const log = makeLog({ vampire_bedtime: '22:45' });
    const result = computeDayCompliance(log, false);
    // bedtime checked, rest zero → 1/4
    expect(result.checked).toBe(1);
    expect(result.total).toBe(4);
  });

  it('does not count workout on a rest day even if workout_completed=1', () => {
    const log = makeLog({ workout_completed: 1 });
    const result = computeDayCompliance(log, false);
    // workout_completed is set but no planned session → should NOT count
    expect(result.total).toBe(4);
    // checked is 0 because only workout was done and it's ignored on rest day
    expect(result.checked).toBe(0);
  });

  it('rounds pct correctly', () => {
    // 1 out of 3 items on a sick day: only bedtime hit
    const log = makeLog({ is_sick_day: 1, vampire_bedtime: '22:00' });
    const result = computeDayCompliance(log, false);
    expect(result.pct).toBe(50); // 1/2
  });
});

// ── computeWeekCompliancePct ───────────────────────────────────────────────

describe('computeWeekCompliancePct', () => {
  it('returns 100 for a perfect week (5 rest days all complete)', () => {
    const log = makeLog({

      rug_protocol_done: 1,
      vampire_bedtime: '22:00',
      hydration_tracked: 1,
      kitchen_cutoff_hit: 1,
    });
    const logs = Array(5).fill(log);
    const hasPlanned = Array(5).fill(false);
    expect(computeWeekCompliancePct(logs, hasPlanned)).toBe(100);
  });

  it('returns 100 for a perfect week with training days', () => {
    const restLog = makeLog({

      rug_protocol_done: 1,
      vampire_bedtime: '22:00',
      hydration_tracked: 1,
      kitchen_cutoff_hit: 1,
    });
    const trainLog = makeLog({
      workout_completed: 1,

      rug_protocol_done: 1,
      vampire_bedtime: '22:00',
      hydration_tracked: 1,
      kitchen_cutoff_hit: 1,
    });
    const logs = [trainLog, restLog, restLog, trainLog, restLog];
    const hasPlanned = [true, false, false, true, false];
    expect(computeWeekCompliancePct(logs, hasPlanned)).toBe(100);
  });

  it('adjusts total correctly for sick days in the week', () => {
    // 4 normal rest days (4 items each) + 1 sick day (2 items)
    // All complete → 4*4 + 2 = 18 total, 18 checked → 100%
    const normalLog = makeLog({

      rug_protocol_done: 1,
      vampire_bedtime: '22:00',
      hydration_tracked: 1,
      kitchen_cutoff_hit: 1,
    });
    const sickLog = makeLog({
      is_sick_day: 1,
      hydration_tracked: 1,
      vampire_bedtime: '22:00',
    });
    const logs = [normalLog, normalLog, normalLog, normalLog, sickLog];
    const hasPlanned = [false, false, false, false, false];
    expect(computeWeekCompliancePct(logs, hasPlanned)).toBe(100);
  });

  it('returns partial pct when some items missed', () => {
    // 2 rest days, 4 items each = 8 total
    // Day 1: rug + bedtime = 2/4, Day 2: 0/4 → 2/8 = 25%
    const day1 = makeLog({
      rug_protocol_done: 1,
      vampire_bedtime: '22:00',
    });
    const day2 = makeLog();
    const result = computeWeekCompliancePct([day1, day2], [false, false]);
    expect(result).toBe(25);
  });

  it('returns 0 for an empty week', () => {
    expect(computeWeekCompliancePct([], [])).toBe(0);
  });
});

// ── getBedtimeComplianceLevel ──────────────────────────────────────────────

describe('getBedtimeComplianceLevel', () => {
  it('returns on-time for bedtime before 23:00', () => {
    expect(getBedtimeComplianceLevel('22:30')).toBe('on-time');
    expect(getBedtimeComplianceLevel('20:00')).toBe('on-time');
  });

  it('returns on-time for exactly midnight boundary (hour < 23)', () => {
    expect(getBedtimeComplianceLevel('22:59')).toBe('on-time');
  });

  it('returns late for bedtime at 23:00 up to (not including) 24:00', () => {
    expect(getBedtimeComplianceLevel('23:00')).toBe('late');
    expect(getBedtimeComplianceLevel('23:30')).toBe('late');
    expect(getBedtimeComplianceLevel('23:59')).toBe('late');
  });

  it('returns way-late for bedtime at 24:00 or after (after-midnight stored format)', () => {
    expect(getBedtimeComplianceLevel('24:00')).toBe('way-late');
    expect(getBedtimeComplianceLevel('25:30')).toBe('way-late');
    expect(getBedtimeComplianceLevel('27:45')).toBe('way-late');
  });

  it('returns null for null input', () => {
    expect(getBedtimeComplianceLevel(null)).toBeNull();
  });
});

// ── getComplianceColor ─────────────────────────────────────────────────────

describe('getComplianceColor', () => {
  it('returns success when current meets target', () => {
    expect(getComplianceColor(5, 5)).toBe('success');
    expect(getComplianceColor(7, 5)).toBe('success');
  });

  it('returns warning when 1 behind target', () => {
    expect(getComplianceColor(4, 5)).toBe('warning');
  });

  it('returns warning when 2 behind target', () => {
    expect(getComplianceColor(3, 5)).toBe('warning');
  });

  it('returns error when 3 or more behind target', () => {
    expect(getComplianceColor(2, 5)).toBe('error');
    expect(getComplianceColor(0, 5)).toBe('error');
  });

  it('returns success when both are zero', () => {
    expect(getComplianceColor(0, 0)).toBe('success');
  });
});

// ── computeStreak ──────────────────────────────────────────────────────────

function makeStreakLog(date: string, overrides: Partial<DayComplianceInput> = {}): StreakLogEntry {
  return {
    date,
    workout_completed: 0,

    rug_protocol_done: 1,
    vampire_bedtime: '22:00',
    hydration_tracked: 1,
    kitchen_cutoff_hit: 1,
    is_sick_day: 0,
    ...overrides,
  };
}

// Fully compliant rest-day log (pct = 5/5 = 100%)
function compliantLog(date: string): StreakLogEntry {
  return makeStreakLog(date);
}

// Non-compliant rest-day log (pct = 0/5 = 0%)
function nonCompliantLog(date: string): StreakLogEntry {
  return makeStreakLog(date, {

    rug_protocol_done: 0,
    vampire_bedtime: null,
    hydration_tracked: 0,
    kitchen_cutoff_hit: 0,
  });
}

// ── computeWeekSummary — new fields ────────────────────────────────────────

describe('computeWeekSummary new fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMock.getPlanItems).mockReturnValue([]);
    vi.mocked(dbMock.getWeekNotes).mockReturnValue([]);
  });

  it('populates energy_levels from non-null logs', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(dbMock.getDailyLogsByWeek).mockReturnValue([
      { date: '2026-03-17', workout_completed: 0, rug_protocol_done: 0, vampire_bedtime: null, hydration_tracked: 0, kitchen_cutoff_hit: 0, is_sick_day: 0, notes: null, energy_level: 3, pain_level: null, pain_area: null, sleep_disruption: null, session_summary: null, session_log_id: null },
      { date: '2026-03-18', workout_completed: 0, rug_protocol_done: 0, vampire_bedtime: null, hydration_tracked: 0, kitchen_cutoff_hit: 0, is_sick_day: 0, notes: null, energy_level: null, pain_level: null, pain_area: null, sleep_disruption: null, session_summary: null, session_log_id: null },
      { date: '2026-03-19', workout_completed: 0, rug_protocol_done: 0, vampire_bedtime: null, hydration_tracked: 0, kitchen_cutoff_hit: 0, is_sick_day: 0, notes: null, energy_level: 5, pain_level: null, pain_area: null, sleep_disruption: null, session_summary: null, session_log_id: null },
    ] as any);

    const summary = computeWeekSummary(12);
    expect(summary.energy_levels).toEqual([
      { date: '2026-03-17', level: 3 },
      { date: '2026-03-19', level: 5 },
    ]);
  });

  it('populates pain_days only for pain_level > 0', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(dbMock.getDailyLogsByWeek).mockReturnValue([
      { date: '2026-03-17', workout_completed: 0, rug_protocol_done: 0, vampire_bedtime: null, hydration_tracked: 0, kitchen_cutoff_hit: 0, is_sick_day: 0, notes: null, energy_level: null, pain_level: 0, pain_area: null, sleep_disruption: null, session_summary: null, session_log_id: null },
      { date: '2026-03-18', workout_completed: 0, rug_protocol_done: 0, vampire_bedtime: null, hydration_tracked: 0, kitchen_cutoff_hit: 0, is_sick_day: 0, notes: null, energy_level: null, pain_level: 2, pain_area: 'left knee', sleep_disruption: null, session_summary: null, session_log_id: null },
      { date: '2026-03-19', workout_completed: 0, rug_protocol_done: 0, vampire_bedtime: null, hydration_tracked: 0, kitchen_cutoff_hit: 0, is_sick_day: 0, notes: null, energy_level: null, pain_level: null, pain_area: null, sleep_disruption: null, session_summary: null, session_log_id: null },
    ] as any);

    const summary = computeWeekSummary(12);
    // pain_level 0 is excluded, null is excluded, only pain_level 2 included
    expect(summary.pain_days).toEqual([
      { date: '2026-03-18', level: 2, area: 'left knee' },
    ]);
  });

  it('populates sleep_disruptions from non-null logs', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(dbMock.getDailyLogsByWeek).mockReturnValue([
      { date: '2026-03-17', workout_completed: 0, rug_protocol_done: 0, vampire_bedtime: null, hydration_tracked: 0, kitchen_cutoff_hit: 0, is_sick_day: 0, notes: null, energy_level: null, pain_level: null, pain_area: null, sleep_disruption: 'newborn', session_summary: null, session_log_id: null },
      { date: '2026-03-18', workout_completed: 0, rug_protocol_done: 0, vampire_bedtime: null, hydration_tracked: 0, kitchen_cutoff_hit: 0, is_sick_day: 0, notes: null, energy_level: null, pain_level: null, pain_area: null, sleep_disruption: null, session_summary: null, session_log_id: null },
    ] as any);

    const summary = computeWeekSummary(12);
    expect(summary.sleep_disruptions).toEqual([
      { date: '2026-03-17', type: 'newborn' },
    ]);
  });

  it('populates tagged_notes from getWeekNotes', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(dbMock.getDailyLogsByWeek).mockReturnValue([] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(dbMock.getWeekNotes).mockReturnValue([
      { date: '2026-03-17', category: 'injury', text: 'left knee soreness', id: 1, daily_log_id: 10, created_at: '' },
      { date: '2026-03-19', category: 'sleep', text: 'baby up 3x', id: 2, daily_log_id: 11, created_at: '' },
    ] as any);

    const summary = computeWeekSummary(12);
    expect(summary.tagged_notes).toEqual([
      { date: '2026-03-17', category: 'injury', text: 'left knee soreness' },
      { date: '2026-03-19', category: 'sleep', text: 'baby up 3x' },
    ]);
  });

  it('returns empty arrays when no relevant data', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(dbMock.getDailyLogsByWeek).mockReturnValue([] as any);

    const summary = computeWeekSummary(12);
    expect(summary.energy_levels).toEqual([]);
    expect(summary.pain_days).toEqual([]);
    expect(summary.sleep_disruptions).toEqual([]);
    expect(summary.tagged_notes).toEqual([]);
  });
});

// ── formatWeekSummaryForAgents — new sections ─────────────────────────────

describe('formatWeekSummaryForAgents new sections', () => {
  function baseWeekSummary() {
    return {
      week_number: 12,
      days_logged: 0,
      workouts: { completed: 0, planned: 0 },
      core: { done: 0, target: 3 },
      rug_protocol: { done: 0, total: 7 },
      vampire: { compliant: 0, total: 7, avg_bedtime: null, daily: [] },
      hydration: { tracked: 0, total: 7 },
      kitchen_cutoff: { hit: 0, total: 7 },
      sick_days: 0,
      notes: [] as Array<{ date: string; text: string }>,
      energy_levels: [] as Array<{ date: string; level: number }>,
      pain_days: [] as Array<{ date: string; level: number; area: string | null }>,
      sleep_disruptions: [] as Array<{ date: string; type: string }>,
      tagged_notes: [] as Array<{ date: string; category: string; text: string }>,
    };
  }

  it('includes energy levels in output', () => {
    const summary = baseWeekSummary();
    summary.energy_levels = [{ date: '2026-03-17', level: 4 }];
    const md = formatWeekSummaryForAgents(summary);
    expect(md).toContain('Energy levels:');
    expect(md).toContain('Tue:4');
  });

  it('includes pain flags with label and area', () => {
    const summary = baseWeekSummary();
    summary.pain_days = [{ date: '2026-03-17', level: 2, area: 'left knee' }];
    const md = formatWeekSummaryForAgents(summary);
    expect(md).toContain('Pain flags:');
    expect(md).toContain('Tue: moderate (left knee)');
  });

  it('includes pain flags without area when area is null', () => {
    const summary = baseWeekSummary();
    summary.pain_days = [{ date: '2026-03-17', level: 1, area: null }];
    const md = formatWeekSummaryForAgents(summary);
    expect(md).toContain('Tue: mild\n');
  });

  it('includes sleep disruptions in output', () => {
    const summary = baseWeekSummary();
    summary.sleep_disruptions = [{ date: '2026-03-18', type: 'sick child' }];
    const md = formatWeekSummaryForAgents(summary);
    expect(md).toContain('Sleep disruptions:');
    expect(md).toContain('Wed: sick child');
  });

  it('includes tagged_notes with category when present', () => {
    const summary = baseWeekSummary();
    summary.tagged_notes = [{ date: '2026-03-19', category: 'injury', text: 'Baker cyst flare' }];
    const md = formatWeekSummaryForAgents(summary);
    expect(md).toContain('Notes:');
    expect(md).toContain('Thu (injury): Baker cyst flare');
  });

  it('falls back to old notes when tagged_notes is empty', () => {
    const summary = baseWeekSummary();
    summary.notes = [{ date: '2026-03-17', text: 'felt strong today' }];
    const md = formatWeekSummaryForAgents(summary);
    expect(md).toContain('Notes:');
    expect(md).toContain('Tue: felt strong today');
  });

  it('prefers tagged_notes over old notes when both exist', () => {
    const summary = baseWeekSummary();
    summary.notes = [{ date: '2026-03-17', text: 'old note' }];
    summary.tagged_notes = [{ date: '2026-03-17', category: 'training', text: 'new note' }];
    const md = formatWeekSummaryForAgents(summary);
    expect(md).toContain('Tue (training): new note');
    expect(md).not.toContain('old note');
  });

  it('omits sections when arrays are empty', () => {
    const summary = baseWeekSummary();
    const md = formatWeekSummaryForAgents(summary);
    expect(md).not.toContain('Energy levels:');
    expect(md).not.toContain('Pain flags:');
    expect(md).not.toContain('Sleep disruptions:');
    expect(md).not.toContain('Notes:');
  });
});

describe('computeStreak', () => {
  it('returns { current: 0, best: 0 } for empty logs', () => {
    expect(computeStreak([], '2026-03-18', [])).toEqual({ current: 0, best: 0 });
  });

  it('returns current=3 for 3 consecutive compliant days', () => {
    // 2026-03-17 Tue, 2026-03-18 Wed, 2026-03-19 Thu — all weekdays
    const logs = [
      compliantLog('2026-03-17'),
      compliantLog('2026-03-18'),
      compliantLog('2026-03-19'),
    ];
    const result = computeStreak(logs, '2026-03-19', []);
    expect(result.current).toBe(3);
    expect(result.best).toBe(3);
  });

  it('treats Saturday like any other day — missing log breaks streak', () => {
    // Fri 20th compliant, Sat 21st no log (breaks streak), Sun 22nd compliant
    const logs = [
      compliantLog('2026-03-20'), // Friday
      compliantLog('2026-03-22'), // Sunday
    ];
    // currentDate = Sunday 22nd — Saturday gap breaks the streak
    const result = computeStreak(logs, '2026-03-22', []);
    expect(result.current).toBe(1);
    expect(result.best).toBe(1);
  });

  it('maintains streak on a sick day when hydration + bedtime are both hit', () => {
    // Sick day with hydration + bedtime → 2/2 = 100% → compliant
    const logs = [
      compliantLog('2026-03-17'),
      makeStreakLog('2026-03-18', {
        is_sick_day: 1,
        hydration_tracked: 1,
        vampire_bedtime: '22:00',
        // other fields irrelevant on sick day
    
        rug_protocol_done: 0,
        kitchen_cutoff_hit: 0,
      }),
      compliantLog('2026-03-19'),
    ];
    const result = computeStreak(logs, '2026-03-19', []);
    expect(result.current).toBe(3);
    expect(result.best).toBe(3);
  });

  it('tracks best streak separately from current streak', () => {
    // 3 compliant days, 1 non-compliant break, 1 compliant day
    // Mon 16, Tue 17, Wed 18 = 3 streak | Thu 19 break | Fri 20 = 1 streak
    const logs = [
      compliantLog('2026-03-16'),
      compliantLog('2026-03-17'),
      compliantLog('2026-03-18'),
      nonCompliantLog('2026-03-19'),
      compliantLog('2026-03-20'),
    ];
    const result = computeStreak(logs, '2026-03-20', []);
    expect(result.current).toBe(1);
    expect(result.best).toBe(3);
  });
});
