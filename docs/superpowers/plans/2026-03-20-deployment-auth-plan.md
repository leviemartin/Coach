# Deployment + Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the OCR Coach Dashboard to Railway with Google OAuth, automated Garmin sync, verified data migration, and daily backups — eliminating all localhost dependency.

**Architecture:** Dockerized Next.js 16 standalone build with Python 3 for Garmin connector, running on Railway with a persistent volume at `/data/`. Google OAuth via NextAuth.js v5 restricts access to a single email. Cron daemon runs Garmin sync every 6 hours and daily SQLite backups.

**Tech Stack:** Next.js 16, React 19, MUI 7, NextAuth.js v5, better-sqlite3, Docker (Alpine), Railway, Python 3, dcron

**Spec:** `docs/superpowers/specs/2026-03-20-deployment-auth-design.md`

---

## File Structure

### New Files
```
dashboard/
  auth.ts                              # NextAuth config (Google provider, email allowlist, JWT)
  middleware.ts                         # Route protection (redirect unauthenticated)
  Dockerfile                           # Multi-stage build (Node + Python + cron)
  .dockerignore                        # Excludes node_modules, .next, .env.local, data/, .git
  components/Providers.tsx             # Client-side SessionProvider wrapper
  app/api/auth/[...nextauth]/route.ts  # NextAuth API route handler
  app/auth/error/page.tsx              # Access denied page
  scripts/
    entrypoint.sh                      # Container startup (env validation, migration check, persona sync, cron, Next.js)
    migrate-to-volume.sh               # One-time data migration with verification
    backup.sh                          # Daily SQLite + state file backup
    garmin-sync.sh                     # Garmin cron wrapper with error handling
```

### Modified Files
```
dashboard/
  lib/constants.ts                     # All paths via env vars
  lib/db.ts                            # Import DB_PATH from constants
  next.config.ts                       # Add output: 'standalone'
  package.json                         # Add next-auth dependency
  app/layout.tsx                       # Wrap with Providers component
  app/api/checkin/route.ts             # Remove maxDuration, add SSE heartbeat
  app/api/garmin/sync/route.ts         # Pass --output and --token-dir flags
  components/Sidebar.tsx               # Add user avatar + sign-out button

garmin-coach/
  garmin_connector.py                  # Add --token-dir CLI arg
```

---

### Task 1: Path Portability — Constants

**Files:**
- Modify: `dashboard/lib/constants.ts`
- Modify: `dashboard/lib/db.ts:7`

- [ ] **Step 1: Update constants.ts to use env vars**

Replace the hardcoded paths and add env var reads. In `dashboard/lib/constants.ts`:

```typescript
import path from 'path';

// Root of coach project data
export const COACH_ROOT = process.env.COACH_ROOT || path.resolve(process.cwd(), '..');

// State files
export const STATE_DIR = path.join(COACH_ROOT, 'state');
export const ATHLETE_PROFILE_PATH = path.join(STATE_DIR, 'athlete_profile.md');
export const TRAINING_HISTORY_PATH = path.join(STATE_DIR, 'training_history.md');
export const CURRENT_CEILINGS_PATH = path.join(STATE_DIR, 'current_ceilings.json');
export const PERIODIZATION_PATH = path.join(STATE_DIR, 'periodization.md');
export const DECISIONS_LOG_PATH = path.join(STATE_DIR, 'decisions_log.md');
export const WEEKLY_LOGS_DIR = path.join(STATE_DIR, 'weekly_logs');
export const DEXA_SCANS_PATH = path.join(STATE_DIR, 'dexa_scans.json');
export const RACES_PATH = path.join(STATE_DIR, 'races.json');

// Coach persona files
export const COACHES_DIR = path.join(COACH_ROOT, 'coaches');

// Garmin data (output on persistent volume)
export const GARMIN_DATA_PATH = process.env.GARMIN_DATA_PATH
  || path.join(COACH_ROOT, 'garmin', 'garmin_coach_data.json');

// Garmin connector script (in Docker image, not volume)
export const GARMIN_CONNECTOR_DIR = process.env.GARMIN_CONNECTOR_DIR
  || '/app/garmin-coach';
export const GARMIN_CONNECTOR_SCRIPT = 'garmin_connector.py';

// Garmin token directory
export const GARMIN_TOKEN_DIR = process.env.GARMIN_TOKEN_DIR
  || path.join(COACH_ROOT, 'garmin', '.tokens');

// Database
export const DB_PATH = process.env.DB_PATH
  || path.join(process.cwd(), 'data', 'trends.db');
```

Keep all existing exports below (AGENT_FILES, SPECIALIST_IDS, AGENT_LABELS, AGENT_COLORS, THRESHOLDS, DEFAULT_MODEL, OPUS_MODEL) unchanged.

- [ ] **Step 2: Update db.ts to import DB_PATH from constants**

In `dashboard/lib/db.ts`, replace line 7:
```typescript
// OLD:
const DB_PATH = path.join(process.cwd(), 'data', 'trends.db');
// NEW:
import { DB_PATH } from './constants';
```
Remove the `path` import if it's no longer used elsewhere in the file. Remove the old `DB_PATH` const.

- [ ] **Step 3: Verify the app still runs locally**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npm run build`
Expected: Build succeeds with no errors related to path resolution.

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/constants.ts dashboard/lib/db.ts
git commit -m "feat: make all file paths configurable via env vars"
```

---

### Task 2: NextAuth.js v5 — Google OAuth

**Files:**
- Create: `dashboard/auth.ts`
- Create: `dashboard/middleware.ts`
- Create: `dashboard/components/Providers.tsx`
- Create: `dashboard/app/api/auth/[...nextauth]/route.ts`
- Create: `dashboard/app/auth/error/page.tsx`
- Modify: `dashboard/app/layout.tsx`
- Modify: `dashboard/package.json`

- [ ] **Step 1: Install next-auth**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npm install next-auth@^5.0.0`

- [ ] **Step 2: Create auth.ts**

Create `dashboard/auth.ts`:

```typescript
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      return profile?.email === process.env.ALLOWED_EMAIL;
    },
  },
  pages: {
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});
```

- [ ] **Step 3: Create middleware.ts**

Create `dashboard/middleware.ts`:

```typescript
export { auth as middleware } from './auth';

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

- [ ] **Step 4: Create Providers.tsx**

Create `dashboard/components/Providers.tsx`:

```typescript
'use client';

import { SessionProvider } from 'next-auth/react';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

- [ ] **Step 5: Create auth route handler**

Create directory and file `dashboard/app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

- [ ] **Step 6: Create auth error page**

Create `dashboard/app/auth/error/page.tsx`:

```typescript
import { Box, Typography, Button } from '@mui/material';
import Link from 'next/link';

export default function AuthError() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2,
        p: 3,
      }}
    >
      <Typography variant="h4" fontWeight={700}>
        Access Denied
      </Typography>
      <Typography variant="body1" color="text.secondary" textAlign="center">
        This dashboard is restricted to authorized users.
      </Typography>
      <Button variant="contained" component={Link} href="/api/auth/signin">
        Try Again
      </Button>
    </Box>
  );
}
```

- [ ] **Step 7: Create auth layout to skip AppShell**

The root `app/layout.tsx` wraps everything in `<AppShell>` (sidebar/nav). The auth error page must render standalone since the user is unauthenticated. Create `dashboard/app/auth/layout.tsx`:

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

This overrides the root layout's `AppShell` wrapper for all `/auth/*` routes.

- [ ] **Step 8: Update layout.tsx with Providers wrapper**

In `dashboard/app/layout.tsx`, add the Providers import and wrap:

```typescript
import type { Metadata } from 'next';
import ThemeRegistry from '@/components/ThemeRegistry';
import AppShell from '@/components/AppShell';
import Providers from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'OCR Coach Dashboard',
  description: 'Multi-agent coaching system for Spartan Ultra Morzine 2027',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ThemeRegistry>
            <AppShell>{children}</AppShell>
          </ThemeRegistry>
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 9: Verify build**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npm run build`
Expected: Build succeeds. Auth routes are generated.

- [ ] **Step 10: Commit**

```bash
git add dashboard/auth.ts dashboard/middleware.ts dashboard/components/Providers.tsx \
  dashboard/app/api/auth/ dashboard/app/auth/ dashboard/app/layout.tsx dashboard/package.json dashboard/package-lock.json
git commit -m "feat: add Google OAuth via NextAuth.js v5"
```

---

### Task 3: Sidebar — User Avatar + Sign Out

**Files:**
- Modify: `dashboard/components/Sidebar.tsx`

- [ ] **Step 1: Add session imports and sign-out button to Sidebar**

Read the full current `dashboard/components/Sidebar.tsx` first. Then add:

At the top, add imports:
```typescript
import { useSession, signOut } from 'next-auth/react';
import Avatar from '@mui/material/Avatar';
import LogoutIcon from '@mui/icons-material/Logout';
```

Inside the component, get the session:
```typescript
const { data: session } = useSession();
```

At the bottom of the drawer content (before `RaceCountdown` or after it, at the very bottom), add:

```typescript
{session?.user && (
  <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
    <Avatar
      src={session.user.image || undefined}
      alt={session.user.name || ''}
      sx={{ width: 32, height: 32 }}
    />
    <Typography variant="body2" sx={{ flex: 1 }} noWrap>
      {session.user.name || session.user.email}
    </Typography>
    <IconButton size="small" onClick={() => signOut()} aria-label="Sign out">
      <LogoutIcon fontSize="small" />
    </IconButton>
  </Box>
)}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/Sidebar.tsx
git commit -m "feat: add user avatar and sign-out button to sidebar"
```

---

### Task 4: SSE Heartbeat for Check-in Pipeline

**Files:**
- Modify: `dashboard/app/api/checkin/route.ts`

- [ ] **Step 1: Read the full checkin route**

Read `dashboard/app/api/checkin/route.ts` in full to understand the SSE streaming pattern.

- [ ] **Step 2: Remove maxDuration and add heartbeat**

Remove the `export const maxDuration = 300;` line (Vercel-only, no-op on Railway).

Find the SSE streaming section. Add a heartbeat interval that sends a comment every 30 seconds to keep the Railway proxy connection alive:

```typescript
// Inside the streaming response setup, after creating the encoder/stream:
const heartbeat = setInterval(() => {
  try {
    controller.enqueue(encoder.encode(': heartbeat\n\n'));
  } catch {
    clearInterval(heartbeat);
  }
}, 30_000);

// In the cleanup/finally block:
clearInterval(heartbeat);
```

The exact insertion point depends on the current streaming implementation — read the file first.

- [ ] **Step 3: Verify build**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/api/checkin/route.ts
git commit -m "feat: add SSE heartbeat for Railway proxy, remove Vercel maxDuration"
```

---

### Task 5: Garmin Connector — Add --token-dir Flag

**Files:**
- Modify: `/Users/martinlevie/garmin-coach/garmin_connector.py`
- Modify: `dashboard/app/api/garmin/sync/route.ts`

- [ ] **Step 1: Add --token-dir arg to garmin_connector.py**

Read `garmin_connector.py` around lines 61, 91-122, and 1180-1216.

In the argparse section (~line 1208), add a new argument:
```python
parser.add_argument(
    "--token-dir", type=str, default=None,
    help="Directory to store auth tokens (default: ~/.garmin_coach_tokens)"
)
```

The module-level `TOKEN_DIR = Path.home() / ".garmin_coach_tokens"` (~line 61) stays as-is.

In the `main()` function, add `global TOKEN_DIR` at the **top of the function body** (before `parser = argparse.ArgumentParser(...)`), then override it after parsing:

```python
def main():
    global TOKEN_DIR  # Allow --token-dir to override module-level default

    parser = argparse.ArgumentParser(...)
    # ... existing argparse setup ...
    args = parser.parse_args()

    if args.token_dir:
        TOKEN_DIR = Path(args.token_dir)
    # ... rest of main() ...
```

The `global` declaration must be at the top of the function, not inside the `if` block. This ensures `TOKEN_DIR` is set before `authenticate()` is called later in `main()`.

- [ ] **Step 2: Update garmin sync route to pass flags**

In `dashboard/app/api/garmin/sync/route.ts`, update the `execFileAsync` call to pass `--output` and `--token-dir`:

```typescript
import { GARMIN_CONNECTOR_DIR, GARMIN_CONNECTOR_SCRIPT, GARMIN_DATA_PATH, GARMIN_TOKEN_DIR } from '@/lib/constants';

// In the POST handler:
const { stdout, stderr } = await execFileAsync(
  'python3',
  [GARMIN_CONNECTOR_SCRIPT, '--output', GARMIN_DATA_PATH, '--token-dir', GARMIN_TOKEN_DIR],
  { cwd: GARMIN_CONNECTOR_DIR, timeout: 120_000, maxBuffer: 5 * 1024 * 1024 }
);
```

- [ ] **Step 3: Test locally**

Run: `cd /Users/martinlevie/garmin-coach && python3 garmin_connector.py --token-dir /tmp/test-tokens --output /tmp/test-garmin.json --days 1`
Expected: Either succeeds (if tokens exist) or prompts for MFA (first run). Verify token files are created in `/tmp/test-tokens/`.

- [ ] **Step 4: Commit**

```bash
git -C /Users/martinlevie/garmin-coach add garmin_connector.py
git -C /Users/martinlevie/garmin-coach commit -m "feat: add --token-dir CLI arg for containerized deployments"
git -C /Users/martinlevie/AI/Coach add dashboard/app/api/garmin/sync/route.ts
git -C /Users/martinlevie/AI/Coach commit -m "feat: pass --output and --token-dir flags to garmin connector"
```

---

### Task 6: Next.js Standalone Output

**Files:**
- Modify: `dashboard/next.config.ts`

- [ ] **Step 1: Add standalone output mode**

In `dashboard/next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
```

- [ ] **Step 2: Verify standalone build**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npm run build`
Expected: Build succeeds. `.next/standalone/` directory is created with `server.js`.

Run: `ls /Users/martinlevie/AI/Coach/dashboard/.next/standalone/server.js`
Expected: File exists.

- [ ] **Step 3: Commit**

```bash
git add dashboard/next.config.ts
git commit -m "feat: enable Next.js standalone output for Docker deployment"
```

---

### Task 7: Dockerfile

**Files:**
- Create: `dashboard/Dockerfile`
- Create: `dashboard/.dockerignore`

- [ ] **Step 1: Create .dockerignore at repo root**

The Docker build context is the **repo root** (not `dashboard/`), so `.dockerignore` must be at the repo root. Create `.dockerignore`:

```
.git
dashboard/node_modules
dashboard/.next
dashboard/.env.local
dashboard/data/
garmin-coach/archive/
garmin-coach/*.json
```

- [ ] **Step 2: Create Dockerfile**

Create `dashboard/Dockerfile`. All COPY paths are relative to the repo root build context:

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 py3-pip make g++ linux-headers
WORKDIR /app

# Node dependencies
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci

# Python dependencies for Garmin connector
COPY garmin-coach/garmin_connector.py /app/garmin-coach/
RUN PYPATH=$(python3 -c "import site; print(site.getsitepackages()[0])") && \
    python3 -m pip install --break-system-packages --target="$PYPATH" garminconnect

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY dashboard/ .
RUN npm run build

# Stage 3: Runtime
FROM node:20-alpine AS runner
RUN apk add --no-cache python3 dcron sqlite

WORKDIR /app

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public 2>/dev/null || true

# Copy Python connector + site-packages dynamically
COPY --from=deps /app/garmin-coach /app/garmin-coach/
RUN PYPATH=$(python3 -c "import site; print(site.getsitepackages()[0])") && \
    mkdir -p "$PYPATH"
COPY --from=deps /usr/lib/python3.12/site-packages/ /usr/lib/python3.12/site-packages/

# Copy scripts
COPY dashboard/scripts/ /app/scripts/
RUN chmod +x /app/scripts/*.sh

# Copy initial data for migration (state, coaches, DB)
COPY state/ /app/init-data/state/
COPY coaches/ /app/init-data/coaches/
COPY dashboard/data/trends.db /app/init-data/trends.db

# Cron jobs are written dynamically by entrypoint.sh (to include env vars)

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/app/scripts/entrypoint.sh"]
```

**Note on Python site-packages:** The COPY from deps uses `python3.12` which matches node:20-alpine's current Python. If this breaks on a future Alpine release, replace with a dynamic copy using a build-stage RUN that copies to a known path.

- [ ] **Step 3: Verify Docker builds (optional, if Docker is available)**

Run: `cd /Users/martinlevie/AI/Coach && docker build -f dashboard/Dockerfile -t coach-dashboard .`
Expected: Multi-stage build completes.

- [ ] **Step 4: Commit**

```bash
git add .dockerignore dashboard/Dockerfile
git commit -m "feat: add multi-stage Dockerfile for Railway deployment"
```

---

### Task 8: Container Scripts

**Files:**
- Create: `dashboard/scripts/entrypoint.sh`
- Create: `dashboard/scripts/migrate-to-volume.sh`
- Create: `dashboard/scripts/backup.sh`
- Create: `dashboard/scripts/garmin-sync.sh`

- [ ] **Step 1: Create entrypoint.sh**

Create `dashboard/scripts/entrypoint.sh`:

```bash
#!/bin/sh
set -e

echo "=== OCR Coach Dashboard — Starting ==="

# 1. Validate required env vars
REQUIRED_VARS="COACH_ROOT DB_PATH GARMIN_DATA_PATH GARMIN_CONNECTOR_DIR GARMIN_TOKEN_DIR GARMIN_EMAIL GARMIN_PASSWORD ANTHROPIC_API_KEY NEXTAUTH_SECRET NEXTAUTH_URL GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET ALLOWED_EMAIL"
for var in $REQUIRED_VARS; do
  eval val=\$$var
  if [ -z "$val" ]; then
    echo "ERROR: Required env var $var is not set"
    exit 1
  fi
done

# 2. Verify migration
if [ ! -f "$COACH_ROOT/.migration-complete" ]; then
  echo "ERROR: Data migration not complete."
  echo "Run: docker exec <container> /app/scripts/migrate-to-volume.sh"
  exit 1
fi

# 3. Sync coach personas from repo (updates on deploy)
if [ -d /app/init-data/coaches ]; then
  for f in /app/init-data/coaches/*.md; do
    name=$(basename "$f")
    target="$COACH_ROOT/coaches/$name"
    if [ ! -f "$target" ]; then
      cp "$f" "$target"
      echo "SYNC: Added new coach file $name"
    elif ! cmp -s "$f" "$target"; then
      cp "$f" "$target"
      echo "SYNC: Updated coach file $name from repo"
    fi
  done
fi

# 4. Export env vars for cron jobs (cron does not inherit container env)
printenv | grep -E '^(COACH_ROOT|DB_PATH|GARMIN_|NODE_ENV|PATH|PORT|ANTHROPIC_API_KEY)=' > /app/scripts/.env
chmod 600 /app/scripts/.env

# 5. Set up cron jobs dynamically
echo "0 */6 * * * . /app/scripts/.env; /app/scripts/garmin-sync.sh >> /var/log/garmin-sync.log 2>&1" > /etc/crontabs/root
echo "0 3 * * * . /app/scripts/.env; /app/scripts/backup.sh >> /var/log/backup.log 2>&1" >> /etc/crontabs/root

# 6. Start cron daemon
echo "Starting cron daemon..."
crond -b -l 2

# 7. Start Next.js
echo "Starting Next.js on port ${PORT:-3000}..."
exec node /app/server.js
```

- [ ] **Step 2: Create migrate-to-volume.sh**

Create `dashboard/scripts/migrate-to-volume.sh`:

```bash
#!/bin/sh
set -e

VOLUME="$COACH_ROOT"
SOURCE="/app/init-data"

if [ -z "$VOLUME" ]; then
  echo "ERROR: COACH_ROOT env var is not set"
  exit 1
fi

if [ -f "$VOLUME/.migration-complete" ]; then
  echo "ERROR: Migration already completed. Delete $VOLUME/.migration-complete to re-run."
  exit 1
fi

echo "=== Data Migration ==="
echo "Source: $SOURCE"
echo "Target: $VOLUME"
echo ""

# Pre-flight
if [ ! -d "$SOURCE/state" ]; then
  echo "ERROR: Source state/ not found at $SOURCE/state"
  exit 1
fi

if [ ! -f "$SOURCE/trends.db" ]; then
  echo "ERROR: Source trends.db not found at $SOURCE/trends.db"
  exit 1
fi

# Create directories
mkdir -p "$VOLUME/state/weekly_logs" "$VOLUME/coaches" "$VOLUME/garmin/.tokens" "$VOLUME/backups"

# Copy data
echo "Copying state files..."
cp -a "$SOURCE/state/." "$VOLUME/state/"

echo "Copying coach personas..."
cp -a "$SOURCE/coaches/." "$VOLUME/coaches/"

echo "Copying database..."
cp "$SOURCE/trends.db" "$VOLUME/trends.db"

# Verify checksums
echo ""
echo "=== Verifying Checksums ==="
ERRORS=0

verify_file() {
  src="$1"
  dst="$2"
  src_md5=$(md5sum "$src" | cut -d' ' -f1)
  dst_md5=$(md5sum "$dst" | cut -d' ' -f1)
  name=$(basename "$src")
  if [ "$src_md5" = "$dst_md5" ]; then
    echo "  OK: $name"
  else
    echo "  MISMATCH: $name (src=$src_md5 dst=$dst_md5)"
    ERRORS=$((ERRORS + 1))
  fi
}

# Verify all state files
for f in "$SOURCE/state/"*; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  verify_file "$f" "$VOLUME/state/$name"
done

# Verify weekly logs
for f in "$SOURCE/state/weekly_logs/"*; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  verify_file "$f" "$VOLUME/state/weekly_logs/$name"
done

# Verify coaches
for f in "$SOURCE/coaches/"*; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  verify_file "$f" "$VOLUME/coaches/$name"
done

# Verify database
verify_file "$SOURCE/trends.db" "$VOLUME/trends.db"

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "ERROR: $ERRORS checksum mismatches. Migration ABORTED."
  exit 1
fi

# Verify SQLite integrity
echo ""
echo "=== SQLite Integrity Check ==="
INTEGRITY=$(sqlite3 "$VOLUME/trends.db" "PRAGMA integrity_check")
if [ "$INTEGRITY" != "ok" ]; then
  echo "ERROR: SQLite integrity check failed: $INTEGRITY"
  exit 1
fi
echo "  Integrity: OK"

# Count rows
echo ""
echo "=== Table Row Counts ==="
for table in weekly_metrics plan_items ceiling_history dexa_scans races settings; do
  count=$(sqlite3 "$VOLUME/trends.db" "SELECT COUNT(*) FROM $table" 2>/dev/null || echo "N/A")
  echo "  $table: $count rows"
done

# Count files
FILE_COUNT=$(find "$VOLUME/state" "$VOLUME/coaches" -type f | wc -l | tr -d ' ')

# Write migration marker
echo ""
echo "=== Writing Migration Marker ==="
cat > "$VOLUME/.migration-complete" <<MARKER
Migration completed: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Files copied: $FILE_COUNT
Checksum errors: $ERRORS
SQLite integrity: $INTEGRITY
MARKER

echo ""
echo "=== Migration Complete ==="
echo "Files copied: $FILE_COUNT"
echo "Checksums verified: OK"
echo "SQLite integrity: OK"
echo "Marker written: $VOLUME/.migration-complete"
```

- [ ] **Step 3: Create backup.sh**

Create `dashboard/scripts/backup.sh`:

```bash
#!/bin/sh
DATE=$(date +%Y%m%d)
BACKUP_DIR="${COACH_ROOT:-/data}/backups"

mkdir -p "$BACKUP_DIR"

echo "$(date): Starting backup..."

# SQLite hot backup (safe with WAL mode)
sqlite3 "${DB_PATH:-/data/trends.db}" ".backup $BACKUP_DIR/trends-$DATE.db"

# State files tarball
tar czf "$BACKUP_DIR/state-$DATE.tar.gz" -C "${COACH_ROOT:-/data}" state/ coaches/

# Prune backups older than 7 days
find "$BACKUP_DIR" -name "trends-*.db" -mtime +7 -delete
find "$BACKUP_DIR" -name "state-*.tar.gz" -mtime +7 -delete

echo "$(date): Backup complete"
```

- [ ] **Step 4: Create garmin-sync.sh**

Create `dashboard/scripts/garmin-sync.sh`:

```bash
#!/bin/sh
echo "$(date): Starting Garmin sync"

cd /app/garmin-coach || exit 1

python3 garmin_connector.py \
  --output "${GARMIN_DATA_PATH:-/data/garmin/garmin_coach_data.json}" \
  --token-dir "${GARMIN_TOKEN_DIR:-/data/garmin/.tokens}" \
  2>&1

EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "$(date): ERROR: Garmin sync failed (exit $EXIT_CODE)"
  echo "$(date): Check if MFA re-authentication is needed"
else
  echo "$(date): Garmin sync complete"
fi
```

- [ ] **Step 5: Make scripts executable locally**

Run: `chmod +x /Users/martinlevie/AI/Coach/dashboard/scripts/*.sh`

- [ ] **Step 6: Commit**

```bash
git add dashboard/scripts/
git commit -m "feat: add container scripts (entrypoint, migration, backup, garmin sync)"
```

---

### Task 9: Railway Deployment

This task is manual — no code changes, just Railway setup.

- [ ] **Step 1: Create Railway project**

Go to https://railway.app, create a new project, connect to the GitHub repo.

- [ ] **Step 2: Create persistent volume**

In Railway service settings, add a volume mounted at `/data` (1GB).

- [ ] **Step 3: Set environment variables**

Add all variables from the spec's env var table (Section 5):
- `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ALLOWED_EMAIL`
- `COACH_ROOT=/data`, `DB_PATH=/data/trends.db`
- `GARMIN_DATA_PATH=/data/garmin/garmin_coach_data.json`, `GARMIN_CONNECTOR_DIR=/app/garmin-coach`, `GARMIN_TOKEN_DIR=/data/garmin/.tokens`
- `GARMIN_EMAIL`, `GARMIN_PASSWORD`

- [ ] **Step 4: Configure build**

Set the Dockerfile path to `dashboard/Dockerfile` and build context to the repo root.

- [ ] **Step 5: Deploy**

Push to main (or trigger manual deploy). Watch build logs.
Expected: Build completes, container starts, fails with "ERROR: Data migration not complete."

- [ ] **Step 6: Run migration**

```bash
railway run --service <service-name> /app/scripts/migrate-to-volume.sh
```
Or via `docker exec` if using Railway's shell access.
Expected: Migration report with all checksums OK.

- [ ] **Step 7: Restart service**

Redeploy or restart the service.
Expected: Container starts successfully, Next.js runs on port 3000.

- [ ] **Step 8: Set up Google OAuth**

In Google Cloud Console:
1. Create OAuth2 credentials
2. Set authorized redirect URI to `https://<your-railway-url>/api/auth/callback/google`
3. Copy client ID and secret to Railway env vars

- [ ] **Step 9: Bootstrap Garmin auth**

```bash
railway run --service <service-name> sh -c "cd /app/garmin-coach && python3 garmin_connector.py --output /data/garmin/garmin_coach_data.json --token-dir /data/garmin/.tokens"
```
Enter MFA code when prompted. Tokens saved to volume.

- [ ] **Step 10: Verify end-to-end**

1. Open the Railway URL in browser
2. Should redirect to Google sign-in
3. Sign in with the allowed email
4. Dashboard loads with data
5. Try a different email — should see "Access Denied" page
6. Check `/api/garmin` returns fresh data
7. Wait for cron or trigger manual sync — data refreshes

---

### Task 10: Final Verification

- [ ] **Step 1: Run all verification criteria from the spec**

Per spec Section 12:
1. Dashboard accessible at Railway URL via HTTPS
2. Google OAuth works — only allowed email can access
3. Unauthorized emails see error page
4. All existing pages render correctly
5. Check-in pipeline executes via SSE (test a check-in)
6. Garmin connector runs interactively (tokens on volume)
7. Garmin cron produces fresh data within 6 hours
8. Manual Garmin sync works
9. Migration report shows all checksums OK
10. Backup cron produces snapshots in `/data/backups/`
11. Coach personas sync on redeploy
12. Missing env var prevents boot with clear error

- [ ] **Step 2: Commit any final fixes**

If any issues found during verification, fix and commit.
