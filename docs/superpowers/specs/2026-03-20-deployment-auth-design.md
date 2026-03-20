# Spec 1: Deployment + Authentication

**Date:** 2026-03-20
**Status:** Draft
**Scope:** Railway deployment, path portability, Google OAuth, Garmin cron, data migration
**Depends on:** Nothing (foundation spec)
**Blocks:** Spec 2 (Daily Log + Tracking), Spec 3 (UI/UX Audit)

---

## 1. Problem Statement

The OCR Coach Dashboard currently runs exclusively on localhost. All file paths are hardcoded to the developer's machine. There is no authentication, no deployment configuration, and no way to access the dashboard remotely (e.g., from a phone). The Garmin data connector must be run manually.

**Goal:** Make the dashboard permanently accessible via HTTPS on a public URL, protected by Google OAuth, with automated Garmin data refresh — while preserving all existing functionality.

## 2. Architecture Overview

```
[Browser] --HTTPS--> [Railway] --volume--> [/data/]
                        |                     ├── trends.db
                        |                     ├── state/
                        |                     ├── coaches/
                        |                     ├── garmin/
                        |                     │   ├── garmin_coach_data.json
                        |                     │   └── .tokens/
                        |                     └── backups/
                        |
                        ├── Next.js (standalone, port 3000)
                        ├── Garmin cron (every 6h, Python)
                        ├── Backup cron (daily, shell)
                        └── NextAuth.js (Google OAuth, JWT sessions)
```

**Single Railway service** running a Docker container with:
- Next.js standalone server
- Python 3 runtime for Garmin connector
- cron daemon for scheduled tasks
- Persistent volume at `/data/`

## 3. Path Portability

### Current State

`lib/constants.ts` derives most paths from `process.cwd()` but has two hardcoded paths:
```typescript
export const GARMIN_DATA_PATH = '/Users/martinlevie/garmin-coach/garmin_coach_data.json';
export const GARMIN_CONNECTOR_DIR = '/Users/martinlevie/garmin-coach';
```

`lib/db.ts` constructs the DB path from `process.cwd()`:
```typescript
const DB_PATH = path.join(process.cwd(), 'data', 'trends.db');
```

### Target State

All paths read from environment variables. **Defaults are for `next dev` only** — production (standalone mode) MUST have env vars set because `process.cwd()` points to a different location in standalone output.

```typescript
// lib/constants.ts

// Root of coach project data
export const COACH_ROOT = process.env.COACH_ROOT || path.resolve(process.cwd(), '..');

// State files
export const STATE_DIR = path.join(COACH_ROOT, 'state');
// ... all existing STATE_DIR-derived paths unchanged

// Coach persona files
export const COACHES_DIR = path.join(COACH_ROOT, 'coaches');

// Garmin data (output location — on persistent volume)
export const GARMIN_DATA_PATH = process.env.GARMIN_DATA_PATH
  || path.join(COACH_ROOT, 'garmin', 'garmin_coach_data.json');

// Garmin connector script (in Docker image, NOT on volume)
export const GARMIN_CONNECTOR_DIR = process.env.GARMIN_CONNECTOR_DIR
  || '/app/garmin-coach';

// Database
export const DB_PATH = process.env.DB_PATH
  || path.join(process.cwd(), 'data', 'trends.db');
```

### Startup Validation

`entrypoint.sh` validates that all required env vars are set before starting Next.js:

```bash
REQUIRED_VARS="COACH_ROOT DB_PATH GARMIN_DATA_PATH ANTHROPIC_API_KEY NEXTAUTH_SECRET NEXTAUTH_URL GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET ALLOWED_EMAIL"
for var in $REQUIRED_VARS; do
  eval val=\$$var
  if [ -z "$val" ]; then
    echo "ERROR: Required env var $var is not set"
    exit 1
  fi
done
```

**Changes required:**
- `lib/constants.ts` — add env var reads as shown above
- `lib/db.ts` — import `DB_PATH` from constants instead of computing it inline

### Files That Read Paths

All existing API routes and lib files already import from `lib/constants.ts`. No other files contain hardcoded paths. Only `lib/db.ts` computes its own path and needs updating.

## 4. Docker Container

### Dockerfile (multi-stage)

**Stage 1 — deps:**
- Base: `node:20-alpine`
- Install Python 3, pip, and build dependencies for `better-sqlite3` (native module)
- `npm ci` — install Node dependencies
- Copy Garmin connector directory and `pip install -r requirements.txt`

**Stage 2 — build:**
- Copy application source
- `npm run build` — produces `.next/standalone/` output

**Stage 3 — runtime:**
- Base: `node:20-alpine`
- Install Python 3 runtime (no pip/build tools — already installed deps)
- Install `dcron` (Alpine's cron daemon) and `sqlite` (for backup script)
- Copy standalone build from stage 2
- Copy Python connector + installed packages from stage 1 → `/app/garmin-coach/`
- Copy `scripts/entrypoint.sh`, `scripts/migrate-to-volume.sh`, `scripts/backup.sh`
- Copy `state/`, `coaches/`, `data/trends.db` into `/app/init-data/` (used by migration script only)
- Set up cron entries (see Section 7)
- Entrypoint: `scripts/entrypoint.sh`

**Key distinction:** The Garmin connector *script* lives in the image at `/app/garmin-coach/`. Its *output data* and *auth tokens* live on the persistent volume at `/data/garmin/`.

### next.config.ts Changes

```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
};
```

### .dockerignore

```
node_modules
.next
.env.local
data/
.git
```

## 5. Railway Configuration

### Service

- **Single service** connected to GitHub repo
- **Auto-deploy** on push to `main` branch
- **Persistent volume** mounted at `/data/` (1GB initial)
- **Port:** 3000 (Railway auto-detects)

### Environment Variables

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | Claude API for check-in pipeline | `sk-ant-...` |
| `GOOGLE_CLIENT_ID` | Yes | OAuth client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth client secret | `GOCSPX-...` |
| `NEXTAUTH_SECRET` | Yes | Session signing key (32+ chars) | Random string |
| `NEXTAUTH_URL` | Yes | Production URL | `https://coach.up.railway.app` |
| `ALLOWED_EMAIL` | Yes | Authorized Google email | `martin@...` |
| `COACH_ROOT` | Yes | Data volume root | `/data` |
| `DB_PATH` | Yes | SQLite database path | `/data/trends.db` |
| `GARMIN_DATA_PATH` | Yes | Garmin JSON output location | `/data/garmin/garmin_coach_data.json` |
| `GARMIN_CONNECTOR_DIR` | Yes | Garmin connector script location | `/app/garmin-coach` |
| `GARMIN_TOKEN_DIR` | Yes | Garmin auth token storage | `/data/garmin/.tokens` |
| `GARMIN_EMAIL` | Yes | Garmin Connect email | `martin@...` |
| `GARMIN_PASSWORD` | Yes | Garmin Connect password | `***` |

### Railway Timeout Configuration

The check-in pipeline runs up to 5 minutes via SSE streaming. Railway's default proxy idle timeout is 60-120 seconds. The SSE stream must send data (heartbeat or agent progress) within this window to prevent the proxy from killing the connection.

**Actions required:**
- Verify the check-in SSE stream already sends progress events frequently (it does — each agent's output streams as it completes, ~30-60s per agent)
- Add a heartbeat comment (`": heartbeat\n\n"`) every 30 seconds during agent processing as a safety net
- Remove the `maxDuration = 300` export from the check-in route — this is a Vercel-specific directive and has no effect on Railway

### Custom Domain (Optional)

Railway provides a `*.up.railway.app` subdomain free. A custom domain can be attached via Railway settings + DNS CNAME record.

## 6. Google OAuth with NextAuth.js v5

### Dependencies

```
next-auth@^5.0.0
```

Pin to latest stable v5 release at time of implementation.

### Google Cloud Console Setup

1. Create a project (or use existing)
2. Enable Google OAuth2 API
3. Create OAuth2 credentials (Web application type)
4. Authorized redirect URI: `https://<your-domain>/api/auth/callback/google`
5. No localhost URI registered — all development uses the deployed Railway instance

### Auth Files

**`auth.ts`** (project root):
```typescript
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      // Only allow the configured email
      return profile?.email === process.env.ALLOWED_EMAIL;
    },
  },
  pages: {
    error: '/auth/error', // Custom error page for rejected logins
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});
```

**`middleware.ts`** (project root):
```typescript
export { auth as middleware } from './auth';

export const config = {
  matcher: [
    // Protect everything except auth routes, static files, and favicon
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

**`app/api/auth/[...nextauth]/route.ts`**:
```typescript
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

**`app/auth/error/page.tsx`**:
Simple page showing "Access denied — this dashboard is restricted to authorized users."

### Session Provider

NextAuth's `SessionProvider` is a client component. The root `app/layout.tsx` is a server component and must remain so. Create a `components/Providers.tsx` client wrapper:

```typescript
// components/Providers.tsx
'use client';
import { SessionProvider } from 'next-auth/react';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

Then in `app/layout.tsx`:
```typescript
import Providers from '@/components/Providers';
// ...
<body>
  <Providers>
    <ThemeRegistry>
      <AppShell>{children}</AppShell>
    </ThemeRegistry>
  </Providers>
</body>
```

### UI Changes

- **Sidebar:** Add user avatar (from Google profile) + sign-out button at the bottom
- **No other UI changes** in this spec

### No Localhost Development

There is no localhost development flow for this project. All development uses the deployed Railway instance:
- Edit code locally
- Push to GitHub
- Railway auto-deploys (~60-90s)
- View changes on the Railway URL

Railway supports preview environments for PR branches if faster iteration is needed.

## 7. Garmin Cron

### Garmin Auth Bootstrapping

The Garmin connector uses interactive MFA on first login — it calls `input()` to prompt for a code sent to email. Auth tokens are then cached and reused until they expire.

**First-time setup after deploy:**
1. Run `docker exec -it <container> /bin/sh`
2. Set `GARMIN_TOKEN_DIR` to `/data/garmin/.tokens`
3. Run `cd /app/garmin-coach && python3 garmin_connector.py` interactively
4. Enter the MFA code when prompted
5. Tokens are saved to `/data/garmin/.tokens/` (persistent volume)

**Token expiry handling:**
- Tokens typically last months but can expire unexpectedly
- The cron wrapper script detects auth failures (non-zero exit + specific error patterns in output)
- On auth failure: log the error clearly and skip the sync (dashboard shows stale data indicator)
- The dashboard's Garmin freshness indicator (`stale` / `old`) already alerts the user that data is outdated, prompting a manual re-auth via `docker exec`

**Python connector changes required:**
- Accept `--output <path>` CLI arg for output JSON location (currently hardcoded)
- Accept `--token-dir <path>` CLI arg for token storage (currently uses `~/.garmin_coach_tokens`)
- Read `GARMIN_EMAIL` and `GARMIN_PASSWORD` from env vars (if not already)
- These are minor changes scoped to the connector's `__main__` block

### Cron Schedule

```cron
0 */6 * * * /app/scripts/garmin-sync.sh >> /var/log/garmin-sync.log 2>&1
```

Runs at minute 0 every 6 hours (00:00, 06:00, 12:00, 18:00 UTC).

### Garmin Sync Wrapper (`scripts/garmin-sync.sh`)

```bash
#!/bin/sh
echo "$(date): Starting Garmin sync"
cd /app/garmin-coach

python3 garmin_connector.py \
  --output "$GARMIN_DATA_PATH" \
  --token-dir "$GARMIN_TOKEN_DIR" \
  2>&1

EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "$(date): ERROR: Garmin sync failed (exit $EXIT_CODE)"
  echo "$(date): Check if MFA re-authentication is needed"
else
  echo "$(date): Garmin sync complete"
fi
```

### Manual Sync

The existing `POST /api/garmin/sync` endpoint continues to work — triggers the Python connector on demand via the same wrapper script. Useful after a workout when you want fresh data before the next cron run.

## 8. Data Migration

### Migration Script (`scripts/migrate-to-volume.sh`)

Runs once manually after first deploy. Not automated — you trigger it and verify the output.

**Steps:**

1. **Pre-flight checks:**
   - Verify `/data/` volume is mounted and writable
   - Verify source files exist in the Docker image (`/app/init-data/`)
   - Check that `/data/.migration-complete` does NOT exist (prevent double migration)

2. **Copy data with verification:**
   - `cp -a /app/init-data/state/ /data/state/` (preserves timestamps)
   - `cp -a /app/init-data/coaches/ /data/coaches/`
   - `cp /app/init-data/trends.db /data/trends.db`
   - `mkdir -p /data/garmin /data/garmin/.tokens /data/backups`

3. **Verify checksums:**
   - `md5sum` every copied file, compare source vs destination
   - Print file-by-file verification: `OK` or `MISMATCH`
   - If any mismatch -> abort, print error, do NOT write migration marker

4. **Verify SQLite integrity:**
   - `sqlite3 /data/trends.db "PRAGMA integrity_check"` -> must return `ok`
   - Count rows in each table, print report:
     ```
     weekly_metrics: 12 rows
     plan_items: 84 rows
     ceiling_history: 45 rows
     dexa_scans: 1 row
     races: 3 rows
     settings: 2 rows
     ```

5. **Write migration marker:**
   - `/data/.migration-complete` containing timestamp and verification summary

6. **Print final report:**
   ```
   === Migration Complete ===
   Files copied: 24
   Checksums verified: 24/24 OK
   SQLite integrity: OK
   Tables: weekly_metrics(12), plan_items(84), ...
   Migration marker written: /data/.migration-complete
   ```

### Startup Check (`scripts/entrypoint.sh`)

```bash
#!/bin/sh
set -e

# 1. Validate required env vars
REQUIRED_VARS="COACH_ROOT DB_PATH GARMIN_DATA_PATH GARMIN_CONNECTOR_DIR GARMIN_TOKEN_DIR ANTHROPIC_API_KEY NEXTAUTH_SECRET NEXTAUTH_URL GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET ALLOWED_EMAIL"
for var in $REQUIRED_VARS; do
  eval val=\$$var
  if [ -z "$val" ]; then
    echo "ERROR: Required env var $var is not set"
    exit 1
  fi
done

# 2. Verify migration
if [ ! -f /data/.migration-complete ]; then
  echo "ERROR: Data migration not complete."
  echo "Run: docker exec <container> /app/scripts/migrate-to-volume.sh"
  exit 1
fi

# 3. Sync coach personas from repo (updates on deploy)
for f in /app/init-data/coaches/*.md; do
  name=$(basename "$f")
  target="/data/coaches/$name"
  if [ ! -f "$target" ]; then
    cp "$f" "$target"
    echo "SYNC: Added new coach file $name"
  elif ! cmp -s "$f" "$target"; then
    cp "$f" "$target"
    echo "SYNC: Updated coach file $name from repo"
  fi
done

# 4. Start cron daemon
crond -b -l 2

# 5. Start Next.js
exec node /app/.next/standalone/server.js
```

## 9. Daily Backups

### Cron Entry

```cron
0 3 * * * /app/scripts/backup.sh >> /var/log/backup.log 2>&1
```

Runs daily at 03:00 UTC.

### Backup Script (`scripts/backup.sh`)

```bash
#!/bin/sh
DATE=$(date +%Y%m%d)
BACKUP_DIR=/data/backups

mkdir -p "$BACKUP_DIR"

# SQLite hot backup (safe with WAL mode)
sqlite3 /data/trends.db ".backup $BACKUP_DIR/trends-$DATE.db"

# State files tarball
tar czf "$BACKUP_DIR/state-$DATE.tar.gz" -C /data state/ coaches/

# Prune backups older than 7 days
find "$BACKUP_DIR" -name "trends-*.db" -mtime +7 -delete
find "$BACKUP_DIR" -name "state-*.tar.gz" -mtime +7 -delete

echo "Backup complete: $DATE"
```

### Off-Site Backup (Future Consideration)

Backups are stored on the same Railway volume as the data. If the volume fails, backups are lost too. For v1 this is acceptable — Railway volumes are replicated. A future enhancement could push backups to an S3 bucket or use `railway volume download` periodically from a local machine. Not in scope for this spec.

## 10. Files Changed / Created

### Modified Files

| File | Change |
|------|--------|
| `lib/constants.ts` | All paths read from env vars; defaults for `next dev` only |
| `lib/db.ts` | Import `DB_PATH` from constants |
| `next.config.ts` | Add `output: 'standalone'` |
| `app/layout.tsx` | Wrap with `Providers` component (SessionProvider) |
| `package.json` | Add `next-auth@^5.0.0` dependency |
| `components/Sidebar.tsx` | Add user avatar + sign-out button |
| `app/api/checkin/route.ts` | Remove `maxDuration` export (Vercel-only), add SSE heartbeat |

### New Files

| File | Purpose |
|------|---------|
| `auth.ts` | NextAuth configuration (Google provider, email allowlist, JWT) |
| `middleware.ts` | Route protection (redirect unauthenticated to sign-in) |
| `components/Providers.tsx` | Client-side `SessionProvider` wrapper |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth API route handler |
| `app/auth/error/page.tsx` | Access denied page for unauthorized logins |
| `Dockerfile` | Multi-stage build (Node + Python + cron) |
| `.dockerignore` | Excludes node_modules, .next, .env.local, data/, .git |
| `scripts/entrypoint.sh` | Container startup (env validation, migration check, persona sync, cron, Next.js) |
| `scripts/migrate-to-volume.sh` | One-time data migration with verification |
| `scripts/backup.sh` | Daily SQLite + state file backup |
| `scripts/garmin-sync.sh` | Garmin cron wrapper with error handling |

### Garmin Connector Changes (External Repo)

| File | Change |
|------|--------|
| `garmin_connector.py` | Add `--output`, `--token-dir` CLI args; read credentials from env vars |

### Not Changed

- No API route logic changes (only path resolution via constants, plus heartbeat in check-in)
- No UI changes beyond sidebar avatar/sign-out
- No check-in pipeline agent logic changes
- No new dashboard pages (except auth error page)

## 11. Scope Boundaries

**In scope:**
- Docker containerization with standalone Next.js build
- Railway persistent volume setup
- Environment variable-based path configuration with startup validation
- Google OAuth (single authorized user, JWT sessions)
- Garmin connector cron (every 6 hours) with auth bootstrapping plan
- Verified data migration script with checksums and integrity checks
- Daily automated backups with 7-day retention
- Coach persona sync on deploy
- SSE heartbeat for Railway proxy compatibility

**Out of scope (deferred to Spec 2 and 3):**
- Daily log page
- Workout/sleep/mobility tracking
- Sick day tracking
- Mobile UI audit and fixes
- Any new dashboard features
- Off-site backups

## 12. Verification Criteria

Spec 1 is complete when:

1. Dashboard is accessible at the Railway URL via HTTPS
2. Google OAuth login works — only the allowed email can access
3. Unauthorized emails see the error page, not dashboard data
4. All existing pages render correctly with data from the volume
5. Check-in pipeline executes successfully via SSE (submit a test check-in, confirm streaming completes without proxy timeout)
6. Garmin connector runs interactively via `docker exec` (MFA bootstrapped, tokens on volume)
7. Garmin cron produces fresh data within 6 hours of bootstrap
8. Manual Garmin sync (`/api/garmin/sync`) works
9. Migration verification report shows all checksums OK and SQLite integrity passes
10. Backup cron produces daily snapshots in `/data/backups/`
11. Coach persona files sync correctly on redeploy (modify a persona, push, verify volume updated)
12. All required env vars validated on startup — missing var prevents boot with clear error
