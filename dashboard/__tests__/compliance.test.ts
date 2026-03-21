import { describe, it, expect } from 'vitest';
import {
  computeDayCompliance,
  computeWeekCompliancePct,
  getBedtimeComplianceLevel,
  getComplianceColor,
  computeStreak,
} from '@/lib/daily-log';
import type { DayComplianceInput, ComplianceResult, StreakLogEntry } from '@/lib/daily-log';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeLog(overrides: Partial<DayComplianceInput> = {}): DayComplianceInput {
  return {
    workout_completed: 0,
    core_work_done: 0,
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
  it('returns 6/6 for a fully completed training day', () => {
    const log = makeLog({
      workout_completed: 1,
      core_work_done: 1,
      rug_protocol_done: 1,
      vampire_bedtime: '22:30',
      hydration_tracked: 1,
      kitchen_cutoff_hit: 1,
    });
    const result: ComplianceResult = computeDayCompliance(log, true);
    expect(result.checked).toBe(6);
    expect(result.total).toBe(6);
    expect(result.pct).toBe(100);
  });

  it('returns 5/5 for a fully completed rest day (no planned session)', () => {
    const log = makeLog({
      core_work_done: 1,
      rug_protocol_done: 1,
      vampire_bedtime: '22:00',
      hydration_tracked: 1,
      kitchen_cutoff_hit: 1,
    });
    const result = computeDayCompliance(log, false);
    expect(result.checked).toBe(5);
    expect(result.total).toBe(5);
    expect(result.pct).toBe(100);
  });

  it('returns 2/2 for a sick day with all items completed', () => {
    const log = makeLog({
      is_sick_day: 1,
      hydration_tracked: 1,
      vampire_bedtime: '22:00',
      // other items should be ignored
      core_work_done: 1,
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
    // bedtime checked, rest zero → 1/5
    expect(result.checked).toBe(1);
    expect(result.total).toBe(5);
  });

  it('does not count workout on a rest day even if workout_completed=1', () => {
    const log = makeLog({ workout_completed: 1 });
    const result = computeDayCompliance(log, false);
    // workout_completed is set but no planned session → should NOT count
    expect(result.total).toBe(5);
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
      core_work_done: 1,
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
      core_work_done: 1,
      rug_protocol_done: 1,
      vampire_bedtime: '22:00',
      hydration_tracked: 1,
      kitchen_cutoff_hit: 1,
    });
    const trainLog = makeLog({
      workout_completed: 1,
      core_work_done: 1,
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
    // 4 normal rest days (5 items each) + 1 sick day (2 items)
    // All complete → 4*5 + 2 = 22 total, 22 checked → 100%
    const normalLog = makeLog({
      core_work_done: 1,
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
    // 2 days, rest days, 5 items each = 10 total
    // Day 1: 3/5, Day 2: 0/5 → 3/10 = 30%
    const day1 = makeLog({
      core_work_done: 1,
      rug_protocol_done: 1,
      vampire_bedtime: '22:00',
    });
    const day2 = makeLog();
    const result = computeWeekCompliancePct([day1, day2], [false, false]);
    expect(result).toBe(30);
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
    core_work_done: 1,
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
    core_work_done: 0,
    rug_protocol_done: 0,
    vampire_bedtime: null,
    hydration_tracked: 0,
    kitchen_cutoff_hit: 0,
  });
}

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

  it('skips Saturday and continues streak across it (2026-03-21 is a Saturday)', () => {
    // Fri 20th compliant, Sat 21st skipped, Sun 22nd compliant
    const logs = [
      compliantLog('2026-03-20'), // Friday
      compliantLog('2026-03-22'), // Sunday
    ];
    // currentDate = Sunday 22nd
    const result = computeStreak(logs, '2026-03-22', []);
    expect(result.current).toBe(2);
    expect(result.best).toBe(2);
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
        core_work_done: 0,
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
