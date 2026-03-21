import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAuthHeader, connectApiUrl } from '@/lib/garmin-api';

describe('garmin-api', () => {
  describe('buildAuthHeader', () => {
    it('returns Bearer token header', () => {
      const header = buildAuthHeader({
        token_type: 'Bearer',
        access_token: 'abc123',
      } as any);
      expect(header).toBe('Bearer abc123');
    });
  });

  describe('connectApiUrl', () => {
    it('builds correct URL for default domain', () => {
      expect(connectApiUrl('/some-service/path')).toBe(
        'https://connectapi.garmin.com/some-service/path',
      );
    });

    it('builds correct URL for custom domain', () => {
      expect(connectApiUrl('/path', 'garmin.cn')).toBe(
        'https://connectapi.garmin.cn/path',
      );
    });
  });
});
