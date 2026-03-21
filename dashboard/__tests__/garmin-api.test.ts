import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildAuthHeader, connectApiUrl } from '@/lib/garmin-api';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('@/lib/garmin-auth', () => ({
  exchangeOAuth1ForOAuth2: vi.fn(),
}));

vi.mock('@/lib/garmin-tokens', () => ({
  isOAuth2Expired: vi.fn(() => false),
  saveTokens: vi.fn(),
}));

import { connectApi } from '@/lib/garmin-api';

const fakeOAuth1 = { oauth_token: 'tok', oauth_token_secret: 'sec', domain: 'garmin.com' };
const fakeOAuth2 = {
  access_token: 'acc',
  token_type: 'Bearer',
  expires_at: Date.now() / 1000 + 3600,
};

describe('connectApi retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries on 429 and succeeds on second attempt', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'retry-after': '1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: 'ok' }),
      });

    const promise = connectApi('/test-path', fakeOAuth1, fakeOAuth2);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.data).toEqual({ result: 'ok' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws after max retries on persistent 429', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: new Headers(),
    });

    // Attach rejection handler immediately to prevent unhandled rejection warning
    const promise = connectApi('/test-path', fakeOAuth1, fakeOAuth2);
    const caught = promise.catch((e: Error) => e);
    await vi.runAllTimersAsync();
    const err = await caught;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch('429');
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});

describe('garmin-api', () => {
  describe('buildAuthHeader', () => {
    it('returns Bearer token header', () => {
      const header = buildAuthHeader({
        token_type: 'Bearer',
        access_token: 'abc123',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
