# Garmin TypeScript Sync — Design Spec

**Date:** 2026-03-21
**Status:** Draft
**Goal:** Replace the Python-based Garmin data sync with a pure TypeScript implementation that handles MFA authentication through the dashboard UI, eliminating the Python runtime dependency on Railway.

## Problem

The current Garmin sync calls `garmin_connector.py` via `child_process.execFile` from a Next.js API route. When OAuth tokens expire, the Python script requires interactive MFA input (`input()`) which is impossible in a headless Railway environment. Additionally, without a persistent volume configured, tokens are lost on every deploy, forcing re-authentication on every sync attempt.

## Solution

Port the Garmin SSO authentication and data extraction from Python to TypeScript, running natively within the Next.js application. The dashboard UI handles the full login + MFA flow in the browser.

## Architecture

### Authentication Flow

```
Browser UI                    Next.js API                    Garmin SSO
    |                             |                              |
    +-- POST /api/garmin/auth ---+|                              |
    |   {email, password}         +-- GET /sso/embed -----------+| (set cookies)
    |                             +-- GET /sso/signin ----------+| (get CSRF)
    |                             +-- POST /sso/signin ---------+| (submit creds)
    |                             |                              |
    |                             |<-- Response title = "MFA" ---+
    |<-- {status: "mfa_required"} +                              |
    |       sessionId returned    |  (CSRF + cookies stored in   |
    |                             |   in-memory map, keyed by    |
    |                             |   sessionId, TTL ~5min)      |
    |                             |                              |
    +-- POST /api/garmin/auth ---+|                              |
    |   {mfaCode, sessionId}      +-- POST /sso/verifyMFA -----+|
    |                             |<-- title = "Success" --------+
    |                             +-- Parse ticket              |
    |                             +-- Exchange for OAuth1 ------+|
    |                             +-- Exchange for OAuth2 ------+|
    |                             |                              |
    |                             +-- Save tokens to disk        |
    |<-- {status: "authenticated"}+                              |
```

### Token Lifecycle

- **OAuth1 token**: Long-lived (~1 year). Obtained during login. Stored as `oauth1_token.json`.
- **OAuth2 token**: Short-lived. Contains `access_token` and `refresh_token` with `expires_at`. Stored as `oauth2_token.json`.
- **Refresh**: When OAuth2 expires, re-exchange using OAuth1 token (no user interaction). This is how garth handles it — Garmin does not use a standard OAuth2 refresh flow.
- **Re-auth**: When OAuth1 expires (~1 year), the sync endpoint returns `auth_required` and the UI shows the login form.

### Token Storage

Tokens are stored on a Railway persistent volume mounted at `/data/garmin/`:

- `/data/garmin/.tokens/oauth1_token.json`
- `/data/garmin/.tokens/oauth2_token.json`

Path is configurable via `GARMIN_TOKEN_DIR` environment variable (existing convention).

If no tokens exist or OAuth1 is expired, the system is self-healing: sync returns 401, UI shows login form, user authenticates once, and tokens are valid for ~1 year.

### OAuth1 Signing

The OAuth1 ticket exchange and OAuth2 exchange require OAuth1-signed HTTP requests. Garth uses Python's `requests_oauthlib`. In TypeScript, we use the `oauth-1.0a` npm package.

Consumer key and secret are fetched from `https://thegarth.s3.amazonaws.com/oauth_consumer.json` (same source as garth) and cached in memory.

## New Files

### `dashboard/lib/garmin-client.ts`

Three-layer Garmin client:

**Layer 1 — SSO Auth** (port of garth `sso.py`, ~200 lines)

- `loginWithCredentials(email, password)` — Initiates SSO login. Returns `{status: "mfa_required", sessionId}` if MFA is triggered, or `{status: "success", tokens}` if not.
- `submitMfaCode(sessionId, mfaCode)` — Completes MFA verification. Returns `{status: "success", tokens}`.
- `exchangeOAuth1ForOAuth2(oauth1)` — Exchanges OAuth1 token for fresh OAuth2 token.
- Internal: `getOAuth1Token(ticket)` — Exchanges SSO ticket for OAuth1 using OAuth1-signed request.
- Internal: `getConsumerCredentials()` — Fetches and caches OAuth consumer key/secret from S3.

SSO session state (cookies + CSRF token) between login and MFA submission is held in an in-memory `Map<string, SSOSession>` keyed by a random session ID. Entries expire after 5 minutes. Single-process safe (Railway runs one container).

Cookie handling: Use `tough-cookie` (or equivalent) to maintain a cookie jar across the multi-step SSO flow within a single auth attempt.

**Layer 2 — Authenticated API Requests**

- `connectApi(path, tokens)` — Makes authenticated GET to `connectapi.garmin.com` with OAuth2 bearer token. If OAuth2 is expired, transparently refreshes via OAuth1 exchange and retries. Returns parsed JSON.

**Layer 3 — Token Persistence**

- `loadTokens(dir)` — Reads `oauth1_token.json` and `oauth2_token.json` from disk. Returns null if missing.
- `saveTokens(dir, oauth1, oauth2)` — Writes token JSON files to disk.
- `getAuthStatus(dir)` — Returns `"authenticated"` (tokens valid), `"expired"` (OAuth1 expired), or `"no_tokens"`.

### `dashboard/lib/garmin-extract.ts`

Port of `garmin_connector.py`'s data extraction logic. Takes an authenticated client and produces the exact same JSON structure.

**Garmin API calls to port:**

| Endpoint | Called per | Purpose |
|---|---|---|
| `/usersummary-service/stats/{date}` | day (28x) | Daily health stats |
| `/wellness-service/wellness/dailySleepData/{date}` | day (28x) | Sleep data |
| `/hrv-service/hrv/{date}` | day (28x) | HRV data |
| `/metrics-service/metrics/trainingreadiness/{date}` | day (28x) | Training readiness |
| `/weight-service/weight/dateRange` | once | Body composition |
| `/usersummary-service/usersummary/hydration/daily/{date}` | day (28x) | Hydration |
| `/nutrition-service/food/logs/{date}` | day (28x) | Nutrition totals |
| `/nutrition-service/meals/{date}` | day (28x) | Per-meal breakdown |
| `/nutrition-service/settings/{date}` | fallback | Nutrition goals |
| `/activitylist-service/activities/search/activities` | once | Activity list |
| `/activity-service/activity/{id}/hrTimeInZones` | per activity | HR zones |
| `/activity-service/activity/{id}/exerciseSets` | per strength | Exercise sets |
| `/training-status-service/trainingStatus/aggregated` | once | Training status |

**Concurrency:** Parallelize the 6 per-day API calls within each day using `Promise.all()`. Process days sequentially to avoid Garmin rate limiting. This should roughly halve sync time (from ~90s to ~45s).

**Output:** Writes to `GARMIN_DATA_PATH` (same env var, same JSON structure). All downstream consumers (`lib/garmin.ts`, coaches, dashboard) are unaffected.

**Helper functions ported 1:1:**

- `extractDailyStats()`, `extractSleep()`, `extractHrv()`, `extractTrainingReadiness()`
- `extractBodyComposition()`, `extractHydration()`, `extractNutrition()`
- `extractActivities()` with `classifyActivity()`, `extractStrengthDetails()`, `extractCardioDetails()`
- `extractHrZones()`, `hrZonesToMinutes()`
- `computeTrends()`, `computeWeeklySummary()`, `computeZoneTotals()`, `computeWeeklyAverages()`
- `buildExport()` — orchestrator that calls all of the above and assembles final JSON

## Modified Files

### `dashboard/app/api/garmin/sync/route.ts`

Rewritten. Instead of `execFile('python3', ...)`, it:

1. Calls `loadTokens()` — if missing/expired, returns 401 with `{error: "auth_required"}`
2. Calls `buildExport(client)` from `garmin-extract.ts`
3. Writes result to `GARMIN_DATA_PATH`
4. Returns success with sync metadata

Keeps the existing module-level mutex (`syncing` flag).

### `dashboard/app/api/garmin/auth/route.ts` (new)

Single POST endpoint handling both login and MFA:

- Body `{email, password}` — initiates login, returns `{status: "mfa_required", sessionId}` or `{status: "authenticated"}`
- Body `{sessionId, mfaCode}` — completes MFA, saves tokens, returns `{status: "authenticated"}`
- Errors: 401 for bad credentials, 400 for invalid/expired session ID

### `dashboard/app/api/garmin/auth/status/route.ts` (new)

GET endpoint returning `{status: "authenticated" | "expired" | "no_tokens"}`.

### `dashboard/components/CheckInForm.tsx`

When sync returns 401 (`auth_required`), show an inline auth form instead of the current error message:

1. Email + password fields with "Log in to Garmin" button
2. On MFA required: swap to MFA code input with "Verify" button
3. On success: auto-trigger sync
4. On failure: show error, allow retry

This replaces the current behavior of showing "Re-run garmin_connector.py manually to re-authenticate."

## Deleted Files

- `dashboard/scripts/garmin-sync.sh` — no longer needed (was the shell wrapper calling Python)

## Unchanged

- `garmin-coach/garmin_connector.py` — kept for local CLI use and Claude Code coaching sessions
- `scripts/garmin-token-bootstrap.py` — kept as manual fallback
- `dashboard/lib/garmin.ts` — still reads the same JSON file
- `dashboard/lib/types.ts` — same data shape
- Output JSON format — identical structure, all coaches and dashboard consumers unaffected

## Dependencies

New npm packages:

- `oauth-1.0a` — OAuth1 request signing (needed for ticket exchange only)
- `tough-cookie` — Cookie jar for multi-step SSO flow

Both are small, well-maintained, no native dependencies.

## Railway Setup

One-time: create a persistent volume and mount at `/data/garmin/`. Set `GARMIN_TOKEN_DIR=/data/garmin/.tokens` in Railway environment variables (may already exist).

Python runtime is no longer required on the Railway service.

## Security Considerations

- Email and password are transmitted over HTTPS only (browser -> Railway backend -> Garmin SSO). Never stored.
- Only OAuth tokens are persisted. Token files are on a private volume, not in the codebase.
- The auth endpoint is protected by the same NextAuth session that protects the rest of the dashboard.
- In-memory SSO session state (cookies/CSRF) is short-lived (5-minute TTL) and scoped to a random session ID.

## Risk: Garmin SSO Changes

Garmin's SSO is undocumented. The flow could change. This is the same risk the Python garth library carries. Mitigation:

- The SSO module is isolated in `garmin-client.ts` — changes are contained to one file
- garth's changelog and GitHub issues are a good early warning system for SSO changes
- The local Python tools remain available as a fallback
