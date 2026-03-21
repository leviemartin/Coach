import { describe, it, expect } from 'vitest';
import {
  calculateRecoveryScore,
  buildSleepBars,
  getRecoveryDirective,
  getSleepBarColor,
  buildPhaseTargets,
} from '../lib/dashboard-data';

describe('calculateRecoveryScore', () => {
  it('returns combined score: 60% perceived + 40% garmin', () => {
    // perceived 3/5 = 60/100, garmin avg = 50
    // combined = 0.6 * 60 + 0.4 * 50 = 36 + 20 = 56
    expect(calculateRecoveryScore(3, 50)).toBe(56);
  });

  it('returns garmin only when perceived is null', () => {
    expect(calculateRecoveryScore(null, 50)).toBe(50);
  });

  it('returns null when both are null', () => {
    expect(calculateRecoveryScore(null, null)).toBeNull();
  });
});

describe('getRecoveryDirective', () => {
  it('returns "Train as programmed" for score > 50', () => {
    expect(getRecoveryDirective(55)).toBe('Train as programmed');
  });

  it('returns "Reduce volume 20%" for score 35-50', () => {
    expect(getRecoveryDirective(42)).toBe('Reduce volume 20%');
  });

  it('returns "Deload — Zone 2 + mobility" for score < 35', () => {
    expect(getRecoveryDirective(30)).toBe('Deload — Zone 2 + mobility');
  });

  it('returns "Rest day" for score < 20', () => {
    expect(getRecoveryDirective(15)).toBe('Rest day');
  });
});

describe('getSleepBarColor', () => {
  it('returns green for score >= 75', () => {
    expect(getSleepBarColor(80)).toBe('#22c55e');
  });

  it('returns amber for score 60-74', () => {
    expect(getSleepBarColor(65)).toBe('#f59e0b');
  });

  it('returns red for score < 60', () => {
    expect(getSleepBarColor(45)).toBe('#ef4444');
  });
});

describe('buildSleepBars', () => {
  it('builds 7 bars Mon-Sun from daily sleep data', () => {
    const daily = [
      { date: '2026-03-16', score: 45 },
      { date: '2026-03-17', score: 68 },
      { date: '2026-03-18', score: 62 },
    ];
    const bars = buildSleepBars(daily);
    expect(bars).toHaveLength(7);
    expect(bars[0]).toEqual({ day: 'Mon', score: 45 });
    expect(bars[1]).toEqual({ day: 'Tue', score: 68 });
    expect(bars[6]).toEqual({ day: 'Sun', score: null });
  });
});

describe('buildPhaseTargets', () => {
  it('builds phase targets from periodization data', () => {
    const phases = [
      { number: 1, name: 'Reconstruction', dateRange: 'Jan-Mar 2026', weightTarget: '<97kg', focus: [] },
      { number: 2, name: 'Building', dateRange: 'Apr-Jun 2026', weightTarget: '<95kg', focus: [] },
    ];
    const targets = buildPhaseTargets(phases);
    expect(targets[0].targetWeightKg).toBe(97);
    expect(targets[1].targetWeightKg).toBe(95);
  });
});
