import { describe, it, expect } from 'vitest';
import { extractExtendedSummary } from '@/lib/garmin';
import type { GarminData } from '@/lib/types';

function makeMinimalGarminData(overrides: Partial<GarminData> = {}): GarminData {
  return {
    _meta: {
      generated_at: '2026-03-21T12:00:00Z',
      period_start_28d: '2026-02-21',
      period_start_7d: '2026-03-14',
      period_end: '2026-03-21',
      version: '2.1.0',
    },
    activities: { this_week: [] },
    health_stats_7d: {
      daily: [],
      sleep: { daily: [] },
      body_composition: { daily: [] },
    },
    performance_stats: {},
    ...overrides,
  };
}

describe('extractExtendedSummary', () => {
  it('extracts avgHrv from weekly_avg_hrv field', () => {
    const data = makeMinimalGarminData({
      performance_stats: {
        hrv_4w: {
          daily: [
            { date: '2026-03-18', weekly_avg_hrv: 60 },
            { date: '2026-03-19', weekly_avg_hrv: 70 },
            { date: '2026-03-20', weekly_avg_hrv: 80 },
          ],
        },
      },
    });

    const result = extractExtendedSummary(data);
    expect(result.avgHrv).toBe(70); // (60+70+80)/3 = 70
    expect(result.dailyHrv).toHaveLength(3);
    expect(result.dailyHrv[0].value).toBe(60);
  });

  it('returns null avgHrv when no HRV data', () => {
    const data = makeMinimalGarminData();
    const result = extractExtendedSummary(data);
    expect(result.avgHrv).toBeNull();
    expect(result.dailyHrv).toHaveLength(0);
  });

  it('extracts avgSleep from sleep daily scores', () => {
    const data = makeMinimalGarminData({
      health_stats_7d: {
        daily: [],
        sleep: {
          daily: [
            { date: '2026-03-18', score: 65, quality: 'FAIR', duration_hours: 7 },
            { date: '2026-03-19', score: 75, quality: 'GOOD', duration_hours: 7.5 },
          ],
        },
        body_composition: { daily: [] },
      },
    });

    const result = extractExtendedSummary(data);
    expect(result.avgSleep).toBe(70);
  });

  it('extracts weight from body_composition daily', () => {
    const data = makeMinimalGarminData({
      health_stats_7d: {
        daily: [],
        sleep: { daily: [] },
        body_composition: {
          daily: [
            { date: '2026-03-18', weight_kg: 98.5 },
            { date: '2026-03-19', weight_kg: 98.2 },
          ],
        },
      },
    });

    const result = extractExtendedSummary(data);
    expect(result.weight).toBe(98.2);
    expect(result.dailyWeight).toHaveLength(2);
  });

  it('extracts bodyBatteryHigh from health daily stats', () => {
    const data = makeMinimalGarminData({
      health_stats_7d: {
        daily: [
          { date: '2026-03-18', body_battery_high: 80 },
          { date: '2026-03-19', body_battery_high: 70 },
        ],
        sleep: { daily: [] },
        body_composition: { daily: [] },
      },
    });

    const result = extractExtendedSummary(data);
    expect(result.bodyBatteryHigh).toBe(75);
  });
});
