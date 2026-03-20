# Garmin TypeScript Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Python-based Garmin data sync with a pure TypeScript implementation that handles MFA authentication through the dashboard UI.

**Architecture:** Three-layer TypeScript Garmin client (SSO auth, authenticated API, token persistence) with data extraction ported 1:1 from garmin_connector.py. New API routes handle auth + MFA flow. CheckInForm gets an inline auth form for when tokens are expired.

**Tech Stack:** Next.js 16, TypeScript, Vitest, `oauth-1.0a` (OAuth1 signing), `tough-cookie` (SSO cookie jar)

**Spec:** `docs/superpowers/specs/2026-03-21-garmin-typescript-sync-design.md`

**Reference implementation:** `garmin-coach/garmin_connector.py` (Python source to port), garth SSO source at `/Users/martinlevie/Library/Python/3.9/lib/python/site-packages/garth/sso.py`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `dashboard/lib/garmin-auth.ts` | SSO login flow, MFA handling, OAuth1/OAuth2 token exchange. Port of garth `sso.py` + `auth_tokens.py`. |
| `dashboard/lib/garmin-api.ts` | Authenticated API client for `connectapi.garmin.com`. Token refresh logic. |
| `dashboard/lib/garmin-tokens.ts` | Token persistence: load/save/status from disk (JSON files). |
| `dashboard/lib/garmin-extract.ts` | Data extraction: all 15 Garmin API calls + JSON transforms. Port of `garmin_connector.py`. |
| `dashboard/app/api/garmin/auth/route.ts` | API route: login + MFA submission. |
| `dashboard/app/api/garmin/auth/status/route.ts` | API route: token health check. |
| `dashboard/app/api/garmin/sync/route.ts` | Rewritten: calls TypeScript extraction instead of Python. |
| `dashboard/lib/constants.ts` | Remove `GARMIN_CONNECTOR_DIR` and `GARMIN_CONNECTOR_SCRIPT` (no longer needed). |
| `dashboard/components/CheckInForm.tsx` | Add inline Garmin auth form (email/password/MFA). |
| `dashboard/__tests__/garmin-tokens.test.ts` | Tests for token persistence. |
| `dashboard/__tests__/garmin-auth.test.ts` | Tests for SSO flow (mocked HTTP). |
| `dashboard/__tests__/garmin-api.test.ts` | Tests for authenticated API client. |
| `dashboard/__tests__/garmin-extract.test.ts` | Tests for data extraction transforms. |

---

## Task 1: Install dependencies

**Files:**
- Modify: `dashboard/package.json`

- [ ] **Step 1: Install npm packages**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
npm install oauth-1.0a tough-cookie
npm install -D @types/tough-cookie
```

- [ ] **Step 2: Verify installation**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
node -e "require('oauth-1.0a'); require('tough-cookie'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
git add package.json package-lock.json
git commit -m "chore: add oauth-1.0a and tough-cookie for Garmin TS sync"
```

---

## Task 2: Token persistence layer (`garmin-tokens.ts`)

**Files:**
- Create: `dashboard/lib/garmin-tokens.ts`
- Create: `dashboard/__tests__/garmin-tokens.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// dashboard/__tests__/garmin-tokens.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  saveTokens,
  loadTokens,
  getAuthStatus,
  type OAuth1Token,
  type OAuth2Token,
} from '@/lib/garmin-tokens';

const FIXTURES = {
  oauth1: {
    oauth_token: 'test-token',
    oauth_token_secret: 'test-secret',
    mfa_token: null,
    mfa_expiration_timestamp: null,
    domain: 'garmin.com',
  } satisfies OAuth1Token,
  oauth2: {
    scope: 'connect_read connect_write',
    jti: 'test-jti',
    token_type: 'Bearer',
    access_token: 'test-access',
    refresh_token: 'test-refresh',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token_expires_in: 7776000,
    refresh_token_expires_at: Math.floor(Date.now() / 1000) + 7776000,
  } satisfies OAuth2Token,
  oauth2Expired: {
    scope: 'connect_read connect_write',
    jti: 'test-jti',
    token_type: 'Bearer',
    access_token: 'test-access',
    refresh_token: 'test-refresh',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) - 100,
    refresh_token_expires_in: 7776000,
    refresh_token_expires_at: Math.floor(Date.now() / 1000) - 100,
  } satisfies OAuth2Token,
};

describe('garmin-tokens', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'garmin-tokens-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('saveTokens + loadTokens', () => {
    it('round-trips tokens to disk', () => {
      saveTokens(tmpDir, FIXTURES.oauth1, FIXTURES.oauth2);
      const loaded = loadTokens(tmpDir);
      expect(loaded).not.toBeNull();
      expect(loaded!.oauth1.oauth_token).toBe('test-token');
      expect(loaded!.oauth2.access_token).toBe('test-access');
    });

    it('creates directory if it does not exist', () => {
      const nested = path.join(tmpDir, 'sub', 'dir');
      saveTokens(nested, FIXTURES.oauth1, FIXTURES.oauth2);
      expect(fs.existsSync(path.join(nested, 'oauth1_token.json'))).toBe(true);
    });
  });

  describe('loadTokens', () => {
    it('returns null if directory does not exist', () => {
      expect(loadTokens('/tmp/nonexistent-garmin-dir')).toBeNull();
    });

    it('returns null if files are missing', () => {
      expect(loadTokens(tmpDir)).toBeNull();
    });
  });

  describe('getAuthStatus', () => {
    it('returns no_tokens when no tokens exist', () => {
      expect(getAuthStatus(tmpDir)).toBe('no_tokens');
    });

    it('returns authenticated when tokens are valid', () => {
      saveTokens(tmpDir, FIXTURES.oauth1, FIXTURES.oauth2);
      expect(getAuthStatus(tmpDir)).toBe('authenticated');
    });

    it('returns expired when oauth2 refresh token is expired', () => {
      saveTokens(tmpDir, FIXTURES.oauth1, FIXTURES.oauth2Expired);
      expect(getAuthStatus(tmpDir)).toBe('expired');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
npx vitest run __tests__/garmin-tokens.test.ts
```

Expected: FAIL — module `@/lib/garmin-tokens` not found.

- [ ] **Step 3: Implement garmin-tokens.ts**

```typescript
// dashboard/lib/garmin-tokens.ts
import fs from 'fs';
import path from 'path';

export interface OAuth1Token {
  oauth_token: string;
  oauth_token_secret: string;
  mfa_token: string | null;
  mfa_expiration_timestamp: string | null;
  domain: string | null;
}

export interface OAuth2Token {
  scope: string;
  jti: string;
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  refresh_token_expires_in: number;
  refresh_token_expires_at: number;
}

export function isOAuth2Expired(token: OAuth2Token): boolean {
  return token.expires_at < Math.floor(Date.now() / 1000);
}

export function isOAuth2RefreshExpired(token: OAuth2Token): boolean {
  return token.refresh_token_expires_at < Math.floor(Date.now() / 1000);
}

export function saveTokens(
  dir: string,
  oauth1: OAuth1Token,
  oauth2: OAuth2Token,
): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'oauth1_token.json'),
    JSON.stringify(oauth1, null, 2),
  );
  fs.writeFileSync(
    path.join(dir, 'oauth2_token.json'),
    JSON.stringify(oauth2, null, 2),
  );
}

export function loadTokens(
  dir: string,
): { oauth1: OAuth1Token; oauth2: OAuth2Token } | null {
  try {
    const oauth1 = JSON.parse(
      fs.readFileSync(path.join(dir, 'oauth1_token.json'), 'utf-8'),
    ) as OAuth1Token;
    const oauth2 = JSON.parse(
      fs.readFileSync(path.join(dir, 'oauth2_token.json'), 'utf-8'),
    ) as OAuth2Token;
    return { oauth1, oauth2 };
  } catch {
    return null;
  }
}

export type AuthStatus = 'authenticated' | 'expired' | 'no_tokens';

export function getAuthStatus(dir: string): AuthStatus {
  const tokens = loadTokens(dir);
  if (!tokens) return 'no_tokens';
  if (isOAuth2RefreshExpired(tokens.oauth2)) return 'expired';
  return 'authenticated';
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
npx vitest run __tests__/garmin-tokens.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
git add lib/garmin-tokens.ts __tests__/garmin-tokens.test.ts
git commit -m "feat: add Garmin token persistence layer"
```

---

## Task 3: SSO Authentication (`garmin-auth.ts`)

**Files:**
- Create: `dashboard/lib/garmin-auth.ts`
- Create: `dashboard/__tests__/garmin-auth.test.ts`

**Reference:** garth `sso.py` at `/Users/martinlevie/Library/Python/3.9/lib/python/site-packages/garth/sso.py`

The SSO flow has these steps:
1. GET `/sso/embed` — set cookies
2. GET `/sso/signin` — get CSRF token from HTML
3. POST `/sso/signin` — submit credentials (email, password, CSRF)
4. Check response title — if "MFA", need MFA code
5. POST `/sso/verifyMFA/loginEnterMfaCode` — submit MFA code
6. Parse ticket from success HTML
7. OAuth1-signed GET to exchange ticket for OAuth1 token
8. OAuth1-signed POST to exchange OAuth1 for OAuth2 token

- [ ] **Step 1: Write tests for HTML parsing helpers and token exchange**

```typescript
// dashboard/__tests__/garmin-auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCsrfToken,
  getTitle,
  parseTicket,
  setExpirations,
} from '@/lib/garmin-auth';

describe('garmin-auth helpers', () => {
  describe('getCsrfToken', () => {
    it('extracts CSRF token from HTML', () => {
      const html = '<input name="_csrf" value="abc123def">';
      expect(getCsrfToken(html)).toBe('abc123def');
    });

    it('throws if no CSRF token found', () => {
      expect(() => getCsrfToken('<html></html>')).toThrow('CSRF');
    });
  });

  describe('getTitle', () => {
    it('extracts title from HTML', () => {
      const html = '<html><head><title>Success</title></head></html>';
      expect(getTitle(html)).toBe('Success');
    });

    it('throws if no title found', () => {
      expect(() => getTitle('<html></html>')).toThrow('title');
    });
  });

  describe('parseTicket', () => {
    it('extracts ticket from success HTML', () => {
      const html = 'embed?ticket=ST-123456-abc"';
      expect(parseTicket(html)).toBe('ST-123456-abc');
    });

    it('throws if no ticket found', () => {
      expect(() => parseTicket('<html>no ticket</html>')).toThrow('ticket');
    });
  });

  describe('setExpirations', () => {
    it('adds expires_at and refresh_token_expires_at', () => {
      const token = { expires_in: 3600, refresh_token_expires_in: 7776000 };
      const result = setExpirations(token);
      expect(result.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(result.refresh_token_expires_at).toBeGreaterThan(
        Math.floor(Date.now() / 1000),
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
npx vitest run __tests__/garmin-auth.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement garmin-auth.ts**

Port of garth `sso.py`. This file contains:

- HTML parsing helpers: `getCsrfToken()`, `getTitle()`, `parseTicket()`
- `setExpirations()` — adds computed expiry timestamps to OAuth2 token
- `getConsumerCredentials()` — fetches OAuth consumer key/secret from `https://thegarth.s3.amazonaws.com/oauth_consumer.json`, caches in memory
- `SSOSession` type and `ssoSessions` Map — stores in-flight SSO state (cookies, CSRF) between login and MFA, keyed by random session ID, 5-minute TTL with lazy cleanup
- `loginWithCredentials(email, password, domain?)` — performs SSO steps 1-3. If MFA required, stores session state and returns `{status: 'mfa_required', sessionId}`. If no MFA, completes ticket exchange and returns `{status: 'success', oauth1, oauth2}`.
- `submitMfaCode(sessionId, code)` — retrieves stored SSO session, performs step 5 (verifyMFA), then ticket exchange. Returns `{status: 'success', oauth1, oauth2}`.
- `exchangeOAuth1ForOAuth2(oauth1, domain?)` — performs step 8 only (used for token refresh). Returns fresh `OAuth2Token`.

Use `tough-cookie` for cookie jar management across the SSO requests. Use `oauth-1.0a` for signing the OAuth1 ticket exchange (steps 7-8). Use Node `fetch` for all HTTP calls.

Implementation details:
- `CSRF_RE = /name="_csrf"\s+value="(.+?)"/`
- `TITLE_RE = /<title>(.+?)<\/title>/`
- `TICKET_RE = /embed\?ticket=([^"]+)"/`
- `OAUTH_CONSUMER_URL = 'https://thegarth.s3.amazonaws.com/oauth_consumer.json'`
- `USER_AGENT = 'com.garmin.android.apps.connectmobile'`
- SSO base URL: `https://sso.garmin.com/sso` (or `sso.{domain}/sso`)
- OAuth1 exchange URL: `https://connectapi.garmin.com/oauth-service/oauth/preauthorized?ticket={ticket}&login-url=https://sso.garmin.com/sso/embed&accepts-mfa-tokens=true`
- OAuth2 exchange URL: `https://connectapi.garmin.com/oauth-service/oauth/exchange/user/2.0`

Export all helpers (`getCsrfToken`, `getTitle`, `parseTicket`, `setExpirations`) for testing, plus the main functions (`loginWithCredentials`, `submitMfaCode`, `exchangeOAuth1ForOAuth2`).

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
npx vitest run __tests__/garmin-auth.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
git add lib/garmin-auth.ts __tests__/garmin-auth.test.ts
git commit -m "feat: add Garmin SSO authentication (TypeScript port of garth)"
```

---

## Task 4: Authenticated API client (`garmin-api.ts`)

**Files:**
- Create: `dashboard/lib/garmin-api.ts`
- Create: `dashboard/__tests__/garmin-api.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// dashboard/__tests__/garmin-api.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
npx vitest run __tests__/garmin-api.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement garmin-api.ts**

```typescript
// dashboard/lib/garmin-api.ts
import { exchangeOAuth1ForOAuth2 } from './garmin-auth';
import {
  type OAuth1Token,
  type OAuth2Token,
  isOAuth2Expired,
  saveTokens,
} from './garmin-tokens';

const API_USER_AGENT = 'GCM-iOS-5.7.2.1';

export function buildAuthHeader(oauth2: OAuth2Token): string {
  return `${oauth2.token_type.charAt(0).toUpperCase() + oauth2.token_type.slice(1)} ${oauth2.access_token}`;
}

export function connectApiUrl(
  path: string,
  domain: string = 'garmin.com',
): string {
  return `https://connectapi.${domain}${path}`;
}

export async function connectApi(
  path: string,
  oauth1: OAuth1Token,
  oauth2: OAuth2Token,
  tokenDir?: string,
): Promise<{ data: any; oauth2: OAuth2Token }> {
  let currentOAuth2 = oauth2;

  if (isOAuth2Expired(currentOAuth2)) {
    const domain = oauth1.domain || 'garmin.com';
    currentOAuth2 = await exchangeOAuth1ForOAuth2(oauth1, domain);
    if (tokenDir) {
      saveTokens(tokenDir, oauth1, currentOAuth2);
    }
  }

  const domain = oauth1.domain || 'garmin.com';
  const url = connectApiUrl(path, domain);
  const resp = await fetch(url, {
    headers: {
      Authorization: buildAuthHeader(currentOAuth2),
      'User-Agent': API_USER_AGENT,
    },
  });

  if (!resp.ok) {
    throw new Error(`Garmin API ${path} failed: ${resp.status} ${resp.statusText}`);
  }

  if (resp.status === 204) {
    return { data: null, oauth2: currentOAuth2 };
  }

  const data = await resp.json();
  return { data, oauth2: currentOAuth2 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
npx vitest run __tests__/garmin-api.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
git add lib/garmin-api.ts __tests__/garmin-api.test.ts
git commit -m "feat: add authenticated Garmin API client"
```

---

## Task 5: Data extraction (`garmin-extract.ts`)

**Files:**
- Create: `dashboard/lib/garmin-extract.ts`
- Create: `dashboard/__tests__/garmin-extract.test.ts`

**Reference:** `garmin-coach/garmin_connector.py` lines 160-1060

This is the largest task. It ports all data extraction and summary computation from the Python connector. The output JSON structure must be identical.

- [ ] **Step 1: Write tests for pure transform functions**

Test the helper/compute functions that don't need API calls — these are the most important to get right since they shape the output format.

```typescript
// dashboard/__tests__/garmin-extract.test.ts
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
} from '@/lib/garmin-extract';

describe('garmin-extract', () => {
  describe('classifyActivity', () => {
    it('classifies strength_training as strength', () => {
      expect(
        classifyActivity({ activityType: { typeKey: 'strength_training' } }),
      ).toBe('strength');
    });

    it('classifies running as cardio', () => {
      expect(
        classifyActivity({ activityType: { typeKey: 'running' } }),
      ).toBe('cardio');
    });

    it('classifies unknown as other', () => {
      expect(
        classifyActivity({ activityType: { typeKey: 'yoga' } }),
      ).toBe('other');
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
  });

  describe('computeWeeklyAverages', () => {
    it('computes bedtime compliance', () => {
      const sleep = [
        { bedtime: '22:30' },
        { bedtime: '23:30' },
        { bedtime: '01:30' },
      ];
      const result = computeWeeklyAverages([], sleep as any, [], [], []);
      expect(result.nights_before_2300).toBe(1);
      expect(result.nights_tracked).toBe(3);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
npx vitest run __tests__/garmin-extract.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement garmin-extract.ts**

Port all functions from `garmin_connector.py`. This is a large file (~600-800 lines). Key sections:

**Constants:**
- `STRENGTH_TYPES` and `CARDIO_TYPES` sets (from line 478-481 of connector)

**Individual extraction functions** (each takes API response JSON and returns clean object):
- `extractDailyStats(raw)` — maps Garmin field names to our schema (lines 160-186)
- `extractSleep(raw)` — parses sleep DTO, converts bedtime timestamps (lines 189-232)
- `extractHrv(raw)` — extracts HRV summary (lines 235-252)
- `extractTrainingReadiness(raw)` — extracts readiness + all component factors (lines 255-284)
- `extractBodyComposition(raw)` — parses dateWeightList, converts g to kg (lines 287-310)
- `extractHydration(raw)` — simple intake/goal (lines 313-326)
- `extractNutrition(foodLogs, meals, settings, statsResult)` — merges 3 endpoints + fallback (lines 329-472)
- `classifyActivity(activity)` — strength/cardio/other (lines 484-491)
- `extractHrZones(raw)` — zone number + seconds (lines 494-510)
- `hrZonesToMinutes(zones)` — convert to `{z1: mins, ...}` (lines 513-521)
- `extractStrengthDetails(activity, setsData, hrZones)` — builds strength summary (lines 524-579)
- `extractCardioDetails(activity, hrZones)` — builds cardio summary (lines 582-612)

**Summary/compute functions:**
- `computeTrends(data, field)` — min/max/avg (lines 655-665)
- `computeWeeklySummary(activities)` — total sets/reps/volume/distance (lines 668-691)
- `computeZoneTotals(activities)` — aggregate zone minutes (lines 694-701)
- `computeWeeklyAverages(stats, sleep, readiness, hrv, nutrition)` — pre-computed averages + bedtime compliance (lines 704-749)

**Formatting helpers:**
- `formatSleep(entries)` — converts sec to hours (lines 838-862)
- `formatStats(entries)` — picks coach-relevant fields (lines 865-883)
- `formatNutrition(entries)` — strips goals from daily entries (lines 886-895)

**Orchestrator function:**
- `buildExport(apiFn, numDays)` — takes an API call function and orchestrates all data fetching + assembly. Uses `Promise.all()` to parallelize the 6 per-day calls within each day. Produces the exact same JSON structure as `garmin_connector.py` lines 974-end.

The `apiFn` parameter is a function `(path: string) => Promise<any>` — this allows the orchestrator to be tested with mock API responses.

**Training status extraction** (lines 897-970):
- Tries `/training-status-service/trainingStatus/aggregated` first
- Falls back to `/training-status-service/trainingStatus/latest`
- Extracts load_focus, status_feedback, acute_training_load, vo2_max

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
npx vitest run __tests__/garmin-extract.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
git add lib/garmin-extract.ts __tests__/garmin-extract.test.ts
git commit -m "feat: add Garmin data extraction (TypeScript port of connector)"
```

---

## Task 6: Auth API routes

**Files:**
- Create: `dashboard/app/api/garmin/auth/route.ts`
- Create: `dashboard/app/api/garmin/auth/status/route.ts`

- [ ] **Step 1: Implement auth route**

```typescript
// dashboard/app/api/garmin/auth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { loginWithCredentials, submitMfaCode } from '@/lib/garmin-auth';
import { saveTokens } from '@/lib/garmin-tokens';
import { GARMIN_TOKEN_DIR } from '@/lib/constants';

export async function POST(req: NextRequest) {
  const body = await req.json();

  // MFA submission
  if (body.sessionId && body.mfaCode) {
    try {
      const result = await submitMfaCode(body.sessionId, body.mfaCode);
      if (result.status === 'success') {
        saveTokens(GARMIN_TOKEN_DIR, result.oauth1, result.oauth2);
        return NextResponse.json({ status: 'authenticated' });
      }
      return NextResponse.json(
        { status: 'error', error: 'MFA verification failed' },
        { status: 401 },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'MFA failed';
      return NextResponse.json(
        { status: 'error', error: msg },
        { status: 401 },
      );
    }
  }

  // Initial login
  if (body.email && body.password) {
    try {
      const result = await loginWithCredentials(body.email, body.password);
      if (result.status === 'mfa_required') {
        return NextResponse.json({
          status: 'mfa_required',
          sessionId: result.sessionId,
        });
      }
      if (result.status === 'success') {
        saveTokens(GARMIN_TOKEN_DIR, result.oauth1, result.oauth2);
        return NextResponse.json({ status: 'authenticated' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      return NextResponse.json(
        { status: 'error', error: msg },
        { status: 401 },
      );
    }
  }

  return NextResponse.json(
    { status: 'error', error: 'Missing email/password or sessionId/mfaCode' },
    { status: 400 },
  );
}
```

- [ ] **Step 2: Implement auth status route**

```typescript
// dashboard/app/api/garmin/auth/status/route.ts
import { NextResponse } from 'next/server';
import { getAuthStatus } from '@/lib/garmin-tokens';
import { GARMIN_TOKEN_DIR } from '@/lib/constants';

export async function GET() {
  const status = getAuthStatus(GARMIN_TOKEN_DIR);
  return NextResponse.json({ status });
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
git add app/api/garmin/auth/route.ts app/api/garmin/auth/status/route.ts
git commit -m "feat: add Garmin auth API routes (login + MFA + status)"
```

---

## Task 7: Rewrite sync route

**Files:**
- Modify: `dashboard/app/api/garmin/sync/route.ts`

- [ ] **Step 1: Read the current sync route**

Read `dashboard/app/api/garmin/sync/route.ts` to confirm current state before rewriting.

- [ ] **Step 2: Rewrite sync route**

Replace the `execFile` Python call with TypeScript extraction:

```typescript
// dashboard/app/api/garmin/sync/route.ts
import { NextResponse } from 'next/server';
import { loadTokens, isOAuth2Expired, saveTokens } from '@/lib/garmin-tokens';
import { connectApi } from '@/lib/garmin-api';
import { buildExport } from '@/lib/garmin-extract';
import { GARMIN_DATA_PATH, GARMIN_TOKEN_DIR } from '@/lib/constants';
import fs from 'fs';
import path from 'path';

let syncing = false;

export async function POST() {
  if (syncing) {
    return NextResponse.json(
      { success: false, error: 'Sync already in progress' },
      { status: 409 },
    );
  }

  syncing = true;
  try {
    const tokens = loadTokens(GARMIN_TOKEN_DIR);
    if (!tokens) {
      return NextResponse.json(
        { success: false, error: 'auth_required' },
        { status: 401 },
      );
    }

    let currentOAuth2 = tokens.oauth2;

    // Build the API call function that buildExport will use
    const apiFn = async (apiPath: string) => {
      const result = await connectApi(
        apiPath,
        tokens.oauth1,
        currentOAuth2,
        GARMIN_TOKEN_DIR,
      );
      // Keep the potentially refreshed OAuth2 token
      currentOAuth2 = result.oauth2;
      return result.data;
    };

    const exportData = await buildExport(apiFn);

    // Write to GARMIN_DATA_PATH
    const dir = path.dirname(GARMIN_DATA_PATH);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(GARMIN_DATA_PATH, JSON.stringify(exportData, null, 2));

    // Persist any refreshed OAuth2 token
    saveTokens(GARMIN_TOKEN_DIR, tokens.oauth1, currentOAuth2);

    return NextResponse.json({
      success: true,
      message: 'Garmin data synced successfully',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';

    if (msg.includes('401') || msg.includes('Authentication')) {
      return NextResponse.json(
        { success: false, error: 'auth_required' },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { success: false, error: `Garmin sync failed: ${msg}` },
      { status: 500 },
    );
  } finally {
    syncing = false;
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
git add app/api/garmin/sync/route.ts
git commit -m "feat: rewrite Garmin sync to use TypeScript extraction"
```

---

## Task 8: Update constants

**Files:**
- Modify: `dashboard/lib/constants.ts`

- [ ] **Step 1: Read current constants file**

Read `dashboard/lib/constants.ts` to confirm current state.

- [ ] **Step 2: Remove Python-specific constants**

Remove `GARMIN_CONNECTOR_DIR` and `GARMIN_CONNECTOR_SCRIPT` — they are no longer used. Keep `GARMIN_DATA_PATH` and `GARMIN_TOKEN_DIR`.

- [ ] **Step 3: Verify no other files reference the removed constants**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
grep -r "GARMIN_CONNECTOR_DIR\|GARMIN_CONNECTOR_SCRIPT" --include="*.ts" --include="*.tsx" -l
```

Expected: Only `lib/constants.ts` (the old definition) and possibly the old `api/garmin/sync/route.ts` (already rewritten). If any other files reference them, update those too.

- [ ] **Step 4: Commit**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
git add lib/constants.ts
git commit -m "chore: remove Python connector constants (no longer needed)"
```

---

## Task 9: Update CheckInForm with auth UI

**Files:**
- Modify: `dashboard/components/CheckInForm.tsx`

- [ ] **Step 1: Read the current CheckInForm**

Read the full `dashboard/components/CheckInForm.tsx`, focusing on the Garmin sync section (around the `handleSync` function and the Step 0 / "Garmin Data" UI).

- [ ] **Step 2: Add auth state and handlers**

Add the following state variables after the existing sync state:

```typescript
const [authRequired, setAuthRequired] = useState(false);
const [garminEmail, setGarminEmail] = useState('');
const [garminPassword, setGarminPassword] = useState('');
const [mfaRequired, setMfaRequired] = useState(false);
const [mfaCode, setMfaCode] = useState('');
const [mfaSessionId, setMfaSessionId] = useState('');
const [authLoading, setAuthLoading] = useState(false);
const [authError, setAuthError] = useState<string | null>(null);
```

- [ ] **Step 3: Modify handleSync to detect auth_required**

Update the `handleSync` function: when the sync returns 401 with `error: 'auth_required'`, set `authRequired = true` instead of showing the raw error message.

```typescript
// In the catch/error branch of handleSync:
if (data.error === 'auth_required') {
  setAuthRequired(true);
  setSyncError(null);
} else {
  setSyncError(data.error || 'Sync failed');
}
```

- [ ] **Step 4: Add handleGarminLogin and handleMfaSubmit functions**

```typescript
const handleGarminLogin = async () => {
  setAuthLoading(true);
  setAuthError(null);
  try {
    const res = await fetch('/api/garmin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: garminEmail, password: garminPassword }),
    });
    const data = await res.json();
    if (data.status === 'mfa_required') {
      setMfaRequired(true);
      setMfaSessionId(data.sessionId);
    } else if (data.status === 'authenticated') {
      setAuthRequired(false);
      setMfaRequired(false);
      setGarminEmail('');
      setGarminPassword('');
      handleSync(); // auto-trigger sync after auth
    } else {
      setAuthError(data.error || 'Login failed');
    }
  } catch {
    setAuthError('Network error');
  } finally {
    setAuthLoading(false);
  }
};

const handleMfaSubmit = async () => {
  setAuthLoading(true);
  setAuthError(null);
  try {
    const res = await fetch('/api/garmin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: mfaSessionId, mfaCode }),
    });
    const data = await res.json();
    if (data.status === 'authenticated') {
      setAuthRequired(false);
      setMfaRequired(false);
      setMfaCode('');
      setMfaSessionId('');
      setGarminEmail('');
      setGarminPassword('');
      handleSync(); // auto-trigger sync after auth
    } else {
      setAuthError(data.error || 'MFA verification failed');
    }
  } catch {
    setAuthError('Network error');
  } finally {
    setAuthLoading(false);
  }
};
```

- [ ] **Step 5: Add auth form UI**

Add a conditional block in the Garmin step UI. When `authRequired` is true, show either the login form or the MFA form:

**Login form** (when `authRequired && !mfaRequired`):
- TextField for email
- TextField for password (type="password")
- Button "Log in to Garmin" (disabled when `authLoading`, shows CircularProgress)
- Alert for `authError`

**MFA form** (when `authRequired && mfaRequired`):
- Typography: "Check your email for a verification code from Garmin"
- TextField for MFA code
- Button "Verify" (disabled when `authLoading`)
- Alert for `authError`

Place this block where the current `syncError` alert shows "Re-run garmin_connector.py manually to re-authenticate." — that message is replaced by the inline auth form.

- [ ] **Step 6: Test manually**

Start the dev server and verify:
1. If tokens don't exist, clicking "Sync Garmin Data" shows the login form
2. The login form submits to `/api/garmin/auth`
3. If MFA is triggered, the MFA input appears
4. After successful auth, sync auto-triggers

```bash
cd /Users/martinlevie/AI/Coach/dashboard
npm run dev
```

- [ ] **Step 7: Commit**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
git add components/CheckInForm.tsx
git commit -m "feat: add inline Garmin auth form to CheckInForm"
```

---

## Task 10: Delete obsolete files and clean up

**Files:**
- Delete: `dashboard/scripts/garmin-sync.sh`

- [ ] **Step 1: Verify nothing references garmin-sync.sh**

```bash
cd /Users/martinlevie/AI/Coach
grep -r "garmin-sync.sh" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yml" --include="*.yaml" -l
```

Expected: No results (or only Dockerfiles/CI that need updating).

- [ ] **Step 2: Delete the file**

```bash
rm dashboard/scripts/garmin-sync.sh
```

- [ ] **Step 3: Check if the scripts directory is now empty**

```bash
ls dashboard/scripts/
```

If empty, delete the directory too.

- [ ] **Step 4: Commit**

```bash
cd /Users/martinlevie/AI/Coach
git add -A dashboard/scripts/
git commit -m "chore: remove garmin-sync.sh (replaced by TypeScript sync)"
```

---

## Task 11: End-to-end verification

- [ ] **Step 1: Run all tests**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
npx vitest run
```

Expected: All tests pass including the new garmin-tokens, garmin-auth, garmin-api, and garmin-extract tests.

- [ ] **Step 2: Build check**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Lint check**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
npm run lint
```

Expected: No new lint errors.

- [ ] **Step 4: Manual smoke test**

Start dev server, navigate to check-in page:
1. Verify "Sync Garmin Data" button appears
2. If no tokens: click sync, confirm auth form appears
3. If tokens exist: click sync, confirm data loads

```bash
cd /Users/martinlevie/AI/Coach/dashboard
npm run dev
```

- [ ] **Step 5: Final commit if any fixes needed**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
git add -A
git commit -m "fix: address issues found in e2e verification"
```
