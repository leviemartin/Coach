import { describe, it, expect } from 'vitest';
import {
  classifyActivity,
  hrZonesToMinutes,
  computeTrends,
  computeWeeklySummary,
  computeZoneTotals,
  formatSleep,
  formatStats,
  formatNutrition,
  computeWeeklyAverages,
  ensureDict,
  safeCall,
} from '@/lib/garmin-extract';

describe('safeCall', () => {
  it('returns data and records success', async () => {
    const failures: string[] = [];
    const result = await safeCall(async () => ({ value: 42 }), '/test', failures);
    expect(result).toEqual({ value: 42 });
    expect(failures).toEqual([]);
  });

  it('returns null and records failure path', async () => {
    const failures: string[] = [];
    const result = await safeCall(async () => { throw new Error('boom'); }, '/test', failures);
    expect(result).toBeNull();
    expect(failures).toEqual(['/test']);
  });
});

describe('garmin-extract', () => {
  describe('ensureDict', () => {
    it('returns first item if array', () => {
      expect(ensureDict([{ a: 1 }])).toEqual({ a: 1 });
    });
    it('returns empty object for empty array', () => {
      expect(ensureDict([])).toEqual({});
    });
    it('returns dict as-is', () => {
      expect(ensureDict({ a: 1 })).toEqual({ a: 1 });
    });
    it('returns empty object for non-dict/non-array', () => {
      expect(ensureDict(null)).toEqual({});
    });
  });

  describe('classifyActivity', () => {
    it('classifies strength_training as strength', () => {
      expect(classifyActivity({ activityType: { typeKey: 'strength_training' } })).toBe('strength');
    });
    it('classifies indoor_cardio as strength', () => {
      expect(classifyActivity({ activityType: { typeKey: 'indoor_cardio' } })).toBe('strength');
    });
    it('classifies running as cardio', () => {
      expect(classifyActivity({ activityType: { typeKey: 'running' } })).toBe('cardio');
    });
    it('classifies stair_climbing as cardio', () => {
      expect(classifyActivity({ activityType: { typeKey: 'stair_climbing' } })).toBe('cardio');
    });
    it('classifies unknown as other', () => {
      expect(classifyActivity({ activityType: { typeKey: 'yoga' } })).toBe('other');
    });
    it('classifies activities containing "strength" in typeKey', () => {
      expect(classifyActivity({ activityType: { typeKey: 'custom_strength' } })).toBe('strength');
    });
  });

  describe('hrZonesToMinutes', () => {
    it('converts zone seconds to minutes', () => {
      const zones = [
        { zone_number: 1, seconds_in_zone: 600 },
        { zone_number: 2, seconds_in_zone: 300 },
      ];
      expect(hrZonesToMinutes(zones)).toEqual({ z1: 10, z2: 5 });
    });
    it('returns empty object for empty input', () => {
      expect(hrZonesToMinutes([])).toEqual({});
    });
    it('rounds to 1 decimal', () => {
      const zones = [{ zone_number: 1, seconds_in_zone: 100 }];
      expect(hrZonesToMinutes(zones)).toEqual({ z1: 1.7 });
    });
  });

  describe('computeTrends', () => {
    it('computes min/max/avg', () => {
      const data = [
        { date: '2026-01-01', score: 70 },
        { date: '2026-01-02', score: 80 },
        { date: '2026-01-03', score: 90 },
      ];
      const result = computeTrends(data, 'score');
      expect(result).toEqual({ min: 70, max: 90, avg: 80, count: 3 });
    });
    it('returns count 0 for no data', () => {
      expect(computeTrends([], 'score')).toEqual({ count: 0 });
    });
    it('ignores null values', () => {
      const data = [
        { date: '2026-01-01', score: 70 },
        { date: '2026-01-02', score: null },
      ];
      const result = computeTrends(data, 'score');
      expect(result.count).toBe(1);
      expect(result.avg).toBe(70);
    });
    it('rounds to 2 decimals', () => {
      const data = [
        { score: 10 },
        { score: 20 },
        { score: 30 },
      ];
      const result = computeTrends(data, 'score');
      expect(result.avg).toBe(20);
    });
  });

  describe('computeWeeklySummary', () => {
    it('computes activity totals', () => {
      const activities = [
        { type: 'strength', total_sets: 20, total_reps: 100, total_volume_kg: 5000, calories: 300 },
        { type: 'cardio', distance_m: 5000, duration_sec: 1800, calories: 200 },
      ];
      const result = computeWeeklySummary(activities);
      expect(result.total_activities).toBe(2);
      expect(result.strength_sessions).toBe(1);
      expect(result.cardio_sessions).toBe(1);
      expect(result.total_strength_volume_kg).toBe(5000);
      expect(result.total_cardio_distance_km).toBe(5);
      expect(result.total_cardio_duration_min).toBe(30);
      expect(result.total_activity_calories).toBe(500);
    });
    it('handles empty array', () => {
      const result = computeWeeklySummary([]);
      expect(result.total_activities).toBe(0);
    });
  });

  describe('computeZoneTotals', () => {
    it('aggregates zone minutes across activities', () => {
      const activities = [
        { zone_minutes: { z1: 10, z2: 5 } },
        { zone_minutes: { z1: 15, z3: 8 } },
      ];
      const result = computeZoneTotals(activities);
      expect(result.zone_1_minutes).toBe(25);
      expect(result.zone_2_minutes).toBe(5);
      expect(result.zone_3_minutes).toBe(8);
    });
  });

  describe('formatSleep', () => {
    it('converts seconds to hours and sorts by date', () => {
      const entries = [
        {
          date: '2026-01-02',
          sleep_score: 80,
          sleep_quality: 'GOOD',
          sleep_duration_sec: 28800,
          deep_sleep_sec: 7200,
          light_sleep_sec: 14400,
          rem_sleep_sec: 5400,
          awake_sec: 1800,
          bedtime: '22:30',
          wake_time: '06:30',
        },
      ];
      const result = formatSleep(entries);
      expect(result[0].duration_hours).toBe(8);
      expect(result[0].deep_sleep_hours).toBe(2);
    });
    it('filters out null values', () => {
      const entries = [{ date: '2026-01-01', sleep_score: null, sleep_duration_sec: 28800 }];
      const result = formatSleep(entries);
      expect(result[0]).not.toHaveProperty('score');
      expect(result[0].duration_hours).toBe(8);
    });
  });

  describe('formatStats', () => {
    it('picks coach-relevant fields', () => {
      const entries = [{
        date: '2026-01-01',
        total_steps: 10000,
        total_distance_m: 8000,
        calories_total: 2500,
        resting_heart_rate: 60,
      }];
      const result = formatStats(entries);
      expect(result[0].total_steps).toBe(10000);
      expect(result[0]).not.toHaveProperty('total_distance_m');
    });
  });

  describe('formatNutrition', () => {
    it('strips goals from daily entries', () => {
      const entries = [{
        date: '2026-01-01',
        calories_consumed: 2000,
        protein_g: 150,
        calorie_goal: 2500,
        goal_protein_g: 180,
      }];
      const result = formatNutrition(entries);
      expect(result[0].calories_consumed).toBe(2000);
      expect(result[0]).not.toHaveProperty('calorie_goal');
    });
    it('skips entries with only date', () => {
      const entries = [{ date: '2026-01-01' }];
      const result = formatNutrition(entries);
      expect(result).toHaveLength(0);
    });
  });

  describe('computeWeeklyAverages', () => {
    it('computes bedtime compliance', () => {
      const sleep = [
        { bedtime: '22:30' },
        { bedtime: '23:30' },
        { bedtime: '01:30' },
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = computeWeeklyAverages([], sleep as any, [], [], []);
      expect(result.nights_before_2300).toBe(1);
      expect(result.nights_tracked).toBe(3);
    });
    it('computes averages', () => {
      const stats = [
        { resting_heart_rate: 60, avg_stress_level: 30 },
        { resting_heart_rate: 64, avg_stress_level: 40 },
      ];
      const result = computeWeeklyAverages(stats, [], [], [], []);
      expect(result.avg_rhr).toBe(62);
      expect(result.avg_stress).toBe(35);
    });
  });
});
