# Local Garmin Sync with Data Push — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Problem:** Garmin SSO is protected by Cloudflare, which blocks Railway's datacenter IPs. Railway's ephemeral filesystem wipes uploaded tokens on every deploy/restart. This creates an unrecoverable loop: tokens disappear → system asks to login → SSO blocked → 429 → escalating Cloudflare ban.
**Solution:** Move Garmin authentication and data fetching to the user's local machine (residential IP). Push the resulting JSON to Railway via an authenticated upload endpoint. Railway never touches Garmin directly.

---

## Architecture

```
┌─────────────────────────────────────┐       ┌──────────────────────┐
│  Mac (local)                        │       │  Railway (dashboard)  │
│                                     │       │                       │
│  1. garth (Python) — token bootstrap│       │                       │
│     └── ~/.garth/ (OAuth1+OAuth2)   │       │                       │
│                                     │       │                       │
│  2. garmin-sync-local.ts (Node.js)  │ POST  │  /api/garmin/data/    │
│     ├── imports garmin-api.ts       │──────>│  upload               │
│     ├── imports garmin-extract.ts   │ JSON  │                       │
│     ├── reads ~/.garth/ tokens      │       │  Writes to            │
│     ├── calls buildExport()         │       │  GARMIN_DATA_PATH     │
│     └── pushes JSON to Railway      │       │  + archive            │
│                                     │       │                       │
│  Also writes:                       │       │  Dashboard reads      │
│  ~/garmin-coach/garmin_coach_data   │       │  same JSON as today   │
│  .json (for Claude Code check-ins)  │       │                       │
└─────────────────────────────────────┘       └──────────────────────┘
```

**Key constraint:** All Garmin API calls originate from a residential IP. Railway is a data display layer only.

---

## Component 1: Token Bootstrap (Yearly, Interactive)

**File:** `scripts/garmin-token-bootstrap.py` (existing, minor update)

Runs interactively when tokens expire (~yearly) or on first setup. Uses `garth` for SSO auth + MFA. Outputs tokens to `~/.garth/` in garth's native format.

### Changes to existing script

- Update output path to `~/.garth/` (garth's default) instead of `/tmp/garmin_tokens_fresh/`
- Remove Railway SSH upload instructions from output (no longer relevant)
- Add instructions to run the sync script after bootstrap

### Auth flow

- `garth.login(email, password, prompt_mfa=...)` — interactive MFA prompt
- `garth.save(str(Path.home() / ".garth"))` — persists tokens
- Credentials from env vars `GARMIN_EMAIL` / `GARMIN_PASSWORD` or interactive prompt

---

## Component 2: Local Sync Script (Weekly/Daily)

**File:** `scripts/garmin-sync-local.ts`

A standalone Node.js/TypeScript script that **imports the existing `garmin-api.ts` and `garmin-extract.ts` directly**. Zero extraction logic duplication — single source of truth.

### Responsibilities

1. Load tokens from `~/.garth/` (garth's format: `oauth1_token.json`, `oauth2_token.json`)
2. Build an `apiFn` using the existing `connectApi()` from `garmin-api.ts`
3. Call `buildExport()` from `garmin-extract.ts` — identical to what the Railway sync route does
4. Write `garmin_coach_data.json` locally to `~/garmin-coach/` (for Claude Code sessions)
5. Push the JSON to Railway's upload endpoint
6. Archive locally (same `archive/garmin_YYYY-MM-DD.json` pattern)

### Token loading

garth stores tokens at `~/.garth/` in the same `oauth1_token.json` / `oauth2_token.json` format the existing `loadTokens()` function expects. The script calls `loadTokens(path.join(os.homedir(), '.garth'))` directly.

If tokens are missing or the OAuth2 refresh token is expired, the script prints: "Tokens expired. Run: python3 scripts/garmin-token-bootstrap.py" and exits with code 1.

### Data fetching

Uses the existing `connectApi()` function which already has:
- OAuth2 auto-refresh via OAuth1 exchange
- Retry with exponential backoff on 429s (3 retries, 2s/4s/8s)

Then calls `buildExport(apiFn, displayName)` which already has:
- 200ms inter-day throttle
- Failure tracking via `safeCall()` + `_sync_report`

No new extraction logic. No new API logic. Just wiring.

### Push to Railway

```
POST {DASHBOARD_URL}/api/garmin/data/upload
Authorization: Bearer {GARMIN_UPLOAD_SECRET}
Content-Type: application/json

{...full export JSON...}
```

On push failure (network error, non-2xx response): print error message, exit with code 1. The local JSON is already written at this point, so data is not lost. The user can retry the push manually or the next cron run will push fresh data.

### Configuration

Via `.env` file at project root (gitignored) or env vars:

```
DASHBOARD_URL=https://your-railway-app.up.railway.app
GARMIN_UPLOAD_SECRET=<shared-secret>
```

Garmin credentials are NOT needed in `.env` — garth manages tokens separately at `~/.garth/`.

### Execution

Runs via `npx tsx scripts/garmin-sync-local.ts` from the project root (uses the existing `tsconfig.json` and path aliases).

```bash
# Manual (weekly check-in)
npx tsx scripts/garmin-sync-local.ts

# Optional: cron (daily at 06:00)
# 0 6 * * * cd /Users/martinlevie/AI/Coach && npx tsx scripts/garmin-sync-local.ts >> /tmp/garmin-sync.log 2>&1
```

### Exit codes

- `0` — sync and push both succeeded
- `1` — error (tokens missing/expired, Garmin API failure, push failure). Error message printed to stderr.

---

## Component 3: Railway Upload Endpoint

**File:** `dashboard/app/api/garmin/data/upload/route.ts`

**Note:** This is distinct from the existing `/api/garmin/auth/upload/route.ts` which uploads tokens. This endpoint uploads the full data JSON.

### Responsibilities

1. Accept full JSON payload via POST
2. Validate `Authorization: Bearer <secret>` against `GARMIN_UPLOAD_SECRET` env var
3. Validate payload structure (must have `_meta`, `activities`, `health_stats_7d`, `performance_stats`)
4. Write to `GARMIN_DATA_PATH` (same location current sync writes to)
5. Archive to dated file (same pattern as current sync route)
6. Return success/failure response

### Body size limit

Enforce 10MB limit via Next.js App Router route segment config:

```typescript
export const runtime = 'nodejs';
// Next.js App Router: configure body size in next.config.js
// module.exports = { experimental: { serverActions: { bodySizeLimit: '10mb' } } }
// For route handlers, parse body manually with size check
```

The script-side also validates: if the JSON exceeds 10MB, something is wrong — abort before sending.

### Request validation

1. Reject 401 if no `Authorization` header or secret doesn't match `process.env.GARMIN_UPLOAD_SECRET`
2. Reject 400 if body is not valid JSON
3. Reject 400 if body is missing required top-level keys: `_meta`, `activities`, `health_stats_7d`, `performance_stats`
4. Reject 413 if body exceeds 10MB

### Response

```json
// Success (200)
{ "success": true, "message": "Garmin data uploaded", "archived_as": "garmin_2026-03-22.json" }

// Auth failure (401)
{ "success": false, "error": "unauthorized" }

// Validation failure (400)
{ "success": false, "error": "Invalid data: missing required field 'activities'" }

// Payload too large (413)
{ "success": false, "error": "Payload too large" }
```

### Data persistence on Railway

The endpoint writes to `GARMIN_DATA_PATH`. If Railway's filesystem is ephemeral (no persistent volume), the data survives until the next deploy. This is acceptable for weekly check-in usage — the user syncs before each check-in. For more durability, a Railway persistent volume should be configured at `/data/` (Railway-specific config, outside this spec's scope).

---

## Component 4: Dashboard Changes

### Sync button behavior

The existing sync button and `/api/garmin/sync` route stay as-is. No changes.

### Last-synced display

Add a line below the sync status showing when data was last uploaded:
- Read `_meta.generated_at` from the current Garmin JSON via the existing `/api/garmin` GET endpoint
- Display: "Data from: Mar 22, 2026 06:00" or "No data available"

### No SSO login changes

All auth routes (`/api/garmin/auth/*`) remain dormant but intact for future UI sync worker.

---

## What stays, what changes

| Component | Status |
|-----------|--------|
| `dashboard/lib/garmin-extract.ts` | **Unchanged** — imported by local script |
| `dashboard/lib/garmin-api.ts` | **Unchanged** — imported by local script |
| `dashboard/lib/garmin-tokens.ts` | **Unchanged** — `loadTokens()` used by local script |
| `dashboard/lib/garmin-auth.ts` | Unchanged (dormant on Railway) |
| `dashboard/app/api/garmin/sync/route.ts` | Unchanged |
| `dashboard/app/api/garmin/auth/*` | Unchanged (dormant) |
| `dashboard/app/api/garmin/route.ts` | Unchanged (reads JSON) |
| `garmin_connector.py` (original) | Superseded, left in place |
| `scripts/garmin-token-bootstrap.py` | **Updated** — output to `~/.garth/`, remove Railway SSH instructions |
| **NEW:** `scripts/garmin-sync-local.ts` | Local TypeScript sync + push script |
| **NEW:** `dashboard/app/api/garmin/data/upload/route.ts` | Data upload endpoint |

---

## Security

- `GARMIN_UPLOAD_SECRET`: random 32+ character string, stored in Railway env vars and local `.env`
- `.env` is gitignored (verify entry exists in `.gitignore` — the Next.js default `.gitignore` includes `.env*.local` but the script uses `.env` at project root, so confirm `.env` is listed)
- No Garmin credentials stored on Railway or in `.env` — garth manages tokens at `~/.garth/` separately
- Upload endpoint rejects requests without valid bearer token
- Railway enforces HTTPS on all custom domains and `*.up.railway.app` subdomains
- Single-user system — no rate limiting needed on upload endpoint beyond auth check

---

## Future: UI Sync Button (Phase 2)

When ready to restore the sync button to full functionality:

1. Run a lightweight sync worker on the Mac (Node.js process using same `garmin-sync-local.ts` logic)
2. Expose via Cloudflare Tunnel or Tailscale to get a stable URL
3. Dashboard sync button calls the worker URL
4. Worker fetches from Garmin (residential IP), pushes to same `/api/garmin/data/upload` endpoint
5. Zero dashboard changes needed — same upload endpoint, same JSON format

This is a separate design/spec when the time comes.

---

## Testing

1. **Upload endpoint unit test:** Valid auth + valid payload → 200. Missing auth → 401. Missing `_meta` → 400. Missing `activities` → 400.
2. **Local script integration test:** Run with valid tokens → verify JSON output at `~/garmin-coach/garmin_coach_data.json` matches expected schema. Verify `_sync_report` is present.
3. **Push test:** Run script against Railway → verify dashboard shows fresh `_meta.generated_at`. Verify archive file created.
4. **Token expiry test:** Remove `~/.garth/oauth2_token.json` → script should auto-refresh via OAuth1 exchange. Remove both → script should print bootstrap instructions and exit 1.
