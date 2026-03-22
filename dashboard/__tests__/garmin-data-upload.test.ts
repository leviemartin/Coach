import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/garmin/data/upload/route';
import fs from 'fs';

// Mock fs to avoid writing to disk during tests
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    default: {
      ...actual,
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      existsSync: vi.fn(() => false),
    },
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(() => false),
  };
});

const VALID_PAYLOAD = {
  _meta: { generated_at: '2026-03-22T06:00:00Z', version: '2.1.0' },
  activities: { this_week: [] },
  health_stats_7d: { daily: [] },
  performance_stats: {},
};

function makeRequest(body: unknown, secret?: string, headers?: Record<string, string>): Request {
  const hdrs: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };
  if (secret) {
    hdrs['Authorization'] = `Bearer ${secret}`;
  }
  return new Request('http://localhost/api/garmin/data/upload', {
    method: 'POST',
    headers: hdrs,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/garmin/data/upload', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, GARMIN_UPLOAD_SECRET: 'test-secret-abc123' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns 401 when no Authorization header', async () => {
    const req = makeRequest(VALID_PAYLOAD);
    const resp = await POST(req);
    expect(resp.status).toBe(401);
    const body = await resp.json();
    expect(body.error).toBe('unauthorized');
  });

  it('returns 401 when secret is wrong', async () => {
    const req = makeRequest(VALID_PAYLOAD, 'wrong-secret');
    const resp = await POST(req);
    expect(resp.status).toBe(401);
  });

  it('returns 413 when content-length exceeds 10MB', async () => {
    const req = makeRequest(VALID_PAYLOAD, 'test-secret-abc123', {
      'Content-Length': String(11 * 1024 * 1024),
    });
    const resp = await POST(req);
    expect(resp.status).toBe(413);
    const body = await resp.json();
    expect(body.error).toBe('Payload too large');
  });

  it('returns 400 on invalid JSON body', async () => {
    const req = makeRequest('not valid json {{{', 'test-secret-abc123');
    const resp = await POST(req);
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toBe('Invalid JSON');
  });

  it('returns 400 when required field _meta is missing', async () => {
    const req = makeRequest({ activities: {}, health_stats_7d: {}, performance_stats: {} }, 'test-secret-abc123');
    const resp = await POST(req);
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toContain('_meta');
  });

  it('returns 400 when required field activities is missing', async () => {
    const req = makeRequest({ _meta: {}, health_stats_7d: {}, performance_stats: {} }, 'test-secret-abc123');
    const resp = await POST(req);
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toContain('activities');
  });

  it('returns 200 and writes file on valid request', async () => {
    const req = makeRequest(VALID_PAYLOAD, 'test-secret-abc123');
    const resp = await POST(req);
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.archived_as).toMatch(/^garmin_\d{4}-\d{2}-\d{2}\.json$/);
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('generates sequential archive name on collision', async () => {
    const existsSyncMock = vi.mocked(fs.existsSync);
    existsSyncMock.mockReturnValueOnce(true).mockReturnValueOnce(false);

    const req = makeRequest(VALID_PAYLOAD, 'test-secret-abc123');
    const resp = await POST(req);
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.archived_as).toMatch(/^garmin_\d{4}-\d{2}-\d{2}_2\.json$/);
  });
});
