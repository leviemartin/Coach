# Local Garmin Sync with Data Push — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Garmin data sync from Railway to the local machine, pushing JSON to Railway via an authenticated upload endpoint — eliminating Cloudflare SSO blocking and ephemeral filesystem issues.

**Architecture:** A TypeScript script (`scripts/garmin-sync-local.ts`) runs locally, importing the existing `garmin-api.ts` and `garmin-extract.ts` directly (zero logic duplication). It fetches Garmin data, writes JSON locally, and pushes to a new `/api/garmin/data/upload` endpoint on Railway. Token bootstrap stays as a separate Python/garth script for yearly interactive MFA.

**Tech Stack:** TypeScript, Node.js (tsx runner), Next.js API routes, Vitest, garth (Python, auth only)

**Spec:** `docs/superpowers/specs/2026-03-22-local-garmin-sync-design.md`

---

### Task 1: Create the Railway data upload endpoint

The upload endpoint receives the full Garmin JSON from the local script and writes it to disk — same location the existing sync route uses.

**Files:**
- Create: `dashboard/app/api/garmin/data/upload/route.ts`
- Test: `dashboard/__tests__/garmin-data-upload.test.ts`

- [ ] **Step 1: Write failing tests for the upload endpoint**

Create `dashboard/__tests__/garmin-data-upload.test.ts`:

```typescript
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
    // First call to existsSync (for garmin_YYYY-MM-DD.json) returns true
    // Second call (for garmin_YYYY-MM-DD_2.json) returns false
    const existsSyncMock = vi.mocked(fs.existsSync);
    existsSyncMock.mockReturnValueOnce(true).mockReturnValueOnce(false);

    const req = makeRequest(VALID_PAYLOAD, 'test-secret-abc123');
    const resp = await POST(req);
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.archived_as).toMatch(/^garmin_\d{4}-\d{2}-\d{2}_2\.json$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npx vitest run __tests__/garmin-data-upload.test.ts`
Expected: FAIL — module not found (route doesn't exist yet).

- [ ] **Step 3: Implement the upload endpoint**

Create `dashboard/app/api/garmin/data/upload/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { GARMIN_DATA_PATH } from '@/lib/constants';
import fs from 'fs';
import path from 'path';

const REQUIRED_FIELDS = ['_meta', 'activities', 'health_stats_7d', 'performance_stats'];
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  // Auth check
  const authHeader = req.headers.get('authorization');
  const secret = process.env.GARMIN_UPLOAD_SECRET;
  if (!secret || !authHeader || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json(
      { success: false, error: 'unauthorized' },
      { status: 401 },
    );
  }

  // Size check
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { success: false, error: 'Payload too large' },
      { status: 413 },
    );
  }

  // Parse body
  let data: Record<string, unknown>;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON' },
      { status: 400 },
    );
  }

  // Validate required fields
  for (const field of REQUIRED_FIELDS) {
    if (!(field in data)) {
      return NextResponse.json(
        { success: false, error: `Invalid data: missing required field '${field}'` },
        { status: 400 },
      );
    }
  }

  // Write to GARMIN_DATA_PATH
  const dir = path.dirname(GARMIN_DATA_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const exportJson = JSON.stringify(data, null, 2);
  fs.writeFileSync(GARMIN_DATA_PATH, exportJson);

  // Archive to dated file
  const archiveDir = path.join(dir, 'archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  const today = new Date().toISOString().split('T')[0];
  let archiveName = `garmin_${today}.json`;
  if (fs.existsSync(path.join(archiveDir, archiveName))) {
    for (let seq = 2; seq <= 99; seq++) {
      archiveName = `garmin_${today}_${seq}.json`;
      if (!fs.existsSync(path.join(archiveDir, archiveName))) break;
    }
  }
  fs.writeFileSync(path.join(archiveDir, archiveName), exportJson);

  return NextResponse.json({
    success: true,
    message: 'Garmin data uploaded',
    archived_as: archiveName,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npx vitest run __tests__/garmin-data-upload.test.ts`
Expected: PASS

- [ ] **Step 5: Run all existing tests to check for regressions**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npx vitest run`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/martinlevie/AI/Coach
git add dashboard/app/api/garmin/data/upload/route.ts dashboard/__tests__/garmin-data-upload.test.ts
git commit -m "feat: add /api/garmin/data/upload endpoint for local sync push"
```

---

### Task 2: Create the local sync script

The script imports existing TS modules directly — zero extraction logic duplication. It loads tokens, calls `buildExport()`, writes JSON locally, and pushes to Railway.

**Files:**
- Create: `scripts/garmin-sync-local.ts`

**Dependencies:** The script imports from `dashboard/lib/`. These lib files use relative imports internally (no `@/` aliases), so `tsx` resolves them without path alias config. The script runs from the project root: `cd dashboard && npx tsx ../scripts/garmin-sync-local.ts`. `tsx` must be installed — add to dashboard devDependencies.

- [ ] **Step 1: Install tsx as a devDependency**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npm install --save-dev tsx`

- [ ] **Step 2: Create the local sync script**

Create `scripts/garmin-sync-local.ts`:

```typescript
/**
 * Local Garmin sync script.
 *
 * Runs on the user's Mac (residential IP) to bypass Cloudflare blocking.
 * Imports existing garmin-api.ts and garmin-extract.ts directly — zero
 * logic duplication.
 *
 * Usage:
 *   cd dashboard && npx tsx ../scripts/garmin-sync-local.ts
 *
 * Requires:
 *   - Garth tokens at ~/.garth/ (run scripts/garmin-token-bootstrap.py if expired)
 *   - .env with DASHBOARD_URL and GARMIN_UPLOAD_SECRET (for push to Railway)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadTokens, isOAuth2RefreshExpired, saveTokens } from '../dashboard/lib/garmin-tokens';
import { connectApi } from '../dashboard/lib/garmin-api';
import { buildExport } from '../dashboard/lib/garmin-extract';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GARTH_TOKEN_DIR = path.join(os.homedir(), '.garth');
const LOCAL_OUTPUT_DIR = path.join(os.homedir(), 'garmin-coach');
const LOCAL_OUTPUT_PATH = path.join(LOCAL_OUTPUT_DIR, 'garmin_coach_data.json');
const MAX_PUSH_BYTES = 10 * 1024 * 1024; // 10MB — abort if export is unexpectedly large

// Load .env from project root if present
// Use process.cwd() since the script is always run from the project root
const envPath = path.resolve(process.cwd(), '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const DASHBOARD_URL = process.env.DASHBOARD_URL;
const UPLOAD_SECRET = process.env.GARMIN_UPLOAD_SECRET;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fatal(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function log(msg: string): void {
  console.log(`[garmin-sync] ${msg}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // 1. Load tokens
  log(`Loading tokens from ${GARTH_TOKEN_DIR}...`);
  const tokens = loadTokens(GARTH_TOKEN_DIR);
  if (!tokens) {
    fatal(
      `No tokens found at ${GARTH_TOKEN_DIR}.\n` +
      `Run: python3 scripts/garmin-token-bootstrap.py`,
    );
  }

  if (isOAuth2RefreshExpired(tokens.oauth2)) {
    fatal(
      `Tokens expired (refresh token expired).\n` +
      `Run: python3 scripts/garmin-token-bootstrap.py`,
    );
  }

  // 2. Probe API to get display name and validate tokens
  log('Validating tokens with Garmin API...');
  let currentOAuth2 = tokens.oauth2;
  let displayName: string;
  try {
    const probe = await connectApi(
      '/userprofile-service/socialProfile',
      tokens.oauth1,
      currentOAuth2,
      GARTH_TOKEN_DIR,
    );
    currentOAuth2 = probe.oauth2;
    displayName = probe.data?.displayName ?? probe.data?.userName ?? '';
    log(`Authenticated as: ${displayName || '(unknown)'}`);
  } catch (err) {
    fatal(`Token validation failed: ${err instanceof Error ? err.message : err}`);
  }

  // 3. Build export (identical to Railway sync route)
  log('Fetching Garmin data (28-day window)...');
  const apiFn = async (apiPath: string) => {
    const result = await connectApi(
      apiPath,
      tokens.oauth1,
      currentOAuth2,
      GARTH_TOKEN_DIR,
    );
    currentOAuth2 = result.oauth2;
    return result.data;
  };

  const exportData = await buildExport(apiFn, displayName);

  // 4. Save tokens (may have been refreshed during export)
  saveTokens(GARTH_TOKEN_DIR, tokens.oauth1, currentOAuth2);

  // 5. Write locally
  const exportJson = JSON.stringify(exportData, null, 2);

  fs.mkdirSync(LOCAL_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(LOCAL_OUTPUT_PATH, exportJson);
  log(`Written to ${LOCAL_OUTPUT_PATH}`);

  // Archive locally
  const archiveDir = path.join(LOCAL_OUTPUT_DIR, 'archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  const today = new Date().toISOString().split('T')[0];
  let archiveName = `garmin_${today}.json`;
  if (fs.existsSync(path.join(archiveDir, archiveName))) {
    for (let seq = 2; seq <= 99; seq++) {
      archiveName = `garmin_${today}_${seq}.json`;
      if (!fs.existsSync(path.join(archiveDir, archiveName))) break;
    }
  }
  fs.writeFileSync(path.join(archiveDir, archiveName), exportJson);
  log(`Archived as ${archiveName}`);

  // 6. Print sync report
  const report = exportData._sync_report;
  if (report) {
    log(`Sync report: ${report.total_api_calls} API calls, ${report.failed_calls} failed (${report.success_rate}% success)`);
    if (report.failed_calls > 0) {
      log(`Failed endpoints:\n  ${report.failed_endpoints.join('\n  ')}`);
    }
  }

  // 7. Push to Railway (if configured)
  if (DASHBOARD_URL && UPLOAD_SECRET) {
    // Pre-flight size check
    const payloadBytes = Buffer.byteLength(exportJson, 'utf-8');
    if (payloadBytes > MAX_PUSH_BYTES) {
      fatal(`Export JSON is ${(payloadBytes / 1024 / 1024).toFixed(1)}MB — exceeds 10MB limit. Something is wrong.`);
    }

    log(`Pushing to ${DASHBOARD_URL}/api/garmin/data/upload (${(payloadBytes / 1024).toFixed(0)}KB)...`);
    try {
      const resp = await fetch(`${DASHBOARD_URL}/api/garmin/data/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${UPLOAD_SECRET}`,
        },
        body: exportJson,
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        fatal(`Push failed (${resp.status}): ${errBody}`);
      }

      const result = await resp.json();
      log(`Push successful: ${result.message} (archived as ${result.archived_as})`);
    } catch (err) {
      fatal(`Push failed: ${err instanceof Error ? err.message : err}`);
    }
  } else {
    log('DASHBOARD_URL or GARMIN_UPLOAD_SECRET not set — skipping push to Railway.');
    log('To enable push, add to .env: DASHBOARD_URL=https://... and GARMIN_UPLOAD_SECRET=...');
  }

  log('Done.');
}

main().catch((err) => {
  fatal(`Unexpected error: ${err instanceof Error ? err.message : err}`);
});
```

- [ ] **Step 3: Verify the script compiles**

Run: `cd /Users/martinlevie/AI/Coach/dashboard && npx tsx ../scripts/garmin-sync-local.ts 2>&1 || true`
Expected: Script may fail at token loading (no tokens at `~/.garth/` yet) with "ERROR: No tokens found" — that's fine, it means it compiled and ran.

- [ ] **Step 4: Commit**

```bash
cd /Users/martinlevie/AI/Coach
git add scripts/garmin-sync-local.ts dashboard/package.json dashboard/package-lock.json
git commit -m "feat: add local Garmin sync script (imports existing TS extraction)"
```

---

### Task 3: Update the token bootstrap script

Update the existing Python script to output to `~/.garth/` and remove the obsolete Railway SSH instructions.

**Files:**
- Modify: `scripts/garmin-token-bootstrap.py`

- [ ] **Step 1: Update the bootstrap script**

Replace the full contents of `scripts/garmin-token-bootstrap.py`:

```python
#!/usr/bin/env python3
"""
Garmin token bootstrap — interactive login with MFA.

Uses garth to authenticate with Garmin Connect. Saves OAuth1 + OAuth2
tokens to ~/.garth/ for use by the local sync script.

Run this:
  - On first setup
  - When tokens expire (~yearly)

Usage:
    python3 scripts/garmin-token-bootstrap.py

Requires:
    pip3 install garth
"""
import os
import sys
from pathlib import Path

try:
    import garth
except ImportError:
    print("ERROR: garth not installed. Run: pip3 install garth")
    sys.exit(1)

output_dir = str(Path.home() / ".garth")

email = os.environ.get("GARMIN_EMAIL") or input("Garmin email: ").strip()
password = os.environ.get("GARMIN_PASSWORD") or input("Garmin password: ").strip()

print(f"\nLogging in as {email}...")
print("(If MFA is required, check your email for the code)\n")

try:
    garth.login(email, password, prompt_mfa=lambda: input("Enter MFA code: ").strip())
except Exception as e:
    print(f"\nERROR: Login failed: {e}")
    sys.exit(1)

garth.save(output_dir)

print(f"\nTokens saved to {output_dir}/")
print(f"  - {output_dir}/oauth1_token.json")
print(f"  - {output_dir}/oauth2_token.json")
print()
print("Next: run the sync script:")
print("  cd dashboard && npx tsx ../scripts/garmin-sync-local.ts")
```

- [ ] **Step 2: Verify the script is valid Python**

Run: `python3 -c "import ast; ast.parse(open('scripts/garmin-token-bootstrap.py').read()); print('OK')"` from project root.
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/martinlevie/AI/Coach
git add scripts/garmin-token-bootstrap.py
git commit -m "fix: update token bootstrap to output to ~/.garth/ and remove Railway instructions"
```

---

### Task 4: Verify .gitignore and create .env.example

The root `.gitignore` already has `.env*` on line 2. Confirm and create the example file.

**Files:**
- Verify: `.gitignore:1-2`
- Create: `.env.example`

- [ ] **Step 1: Verify .env is gitignored**

Run: `cd /Users/martinlevie/AI/Coach && git check-ignore .env`
Expected: `.env` (confirming it's ignored)

- [ ] **Step 2: Create .env.example for documentation**

Create `.env.example` at project root (this IS committed — `.gitignore` has `!.env.example`):

```
# Garmin sync — push to Railway
DASHBOARD_URL=https://your-app.up.railway.app
GARMIN_UPLOAD_SECRET=your-secret-here
```

- [ ] **Step 3: Commit**

```bash
cd /Users/martinlevie/AI/Coach
git add .env.example
git commit -m "docs: add .env.example for local Garmin sync config"
```

---

### Task 5: Add GARMIN_UPLOAD_SECRET to Railway env vars

This is a manual step — generate the secret and add it to Railway.

- [ ] **Step 1: Generate a secure random secret**

Run: `openssl rand -base64 32`
Copy the output.

- [ ] **Step 2: Add to Railway env vars**

Add `GARMIN_UPLOAD_SECRET=<the-generated-secret>` to the Railway service's environment variables via the Railway dashboard.

- [ ] **Step 3: Add same secret to local .env**

Create/update `.env` at project root:
```
DASHBOARD_URL=https://your-actual-railway-url.up.railway.app
GARMIN_UPLOAD_SECRET=<same-secret-from-step-1>
```

This file is gitignored and will NOT be committed.

---

### Task 6: End-to-end test

Run the full pipeline locally to verify everything works.

- [ ] **Step 1: Bootstrap tokens (if not already at ~/.garth/)**

Check if tokens exist:
```bash
ls ~/.garth/oauth1_token.json ~/.garth/oauth2_token.json
```

If missing, run: `python3 scripts/garmin-token-bootstrap.py`
(This requires interactive MFA — check email for code.)

If tokens already exist at `garmin/.tokens/` from the previous setup, copy them:
```bash
mkdir -p ~/.garth
cp garmin/.tokens/oauth1_token.json ~/.garth/
cp garmin/.tokens/oauth2_token.json ~/.garth/
```

- [ ] **Step 2: Run the local sync script (local write only)**

First test without Railway push (no DASHBOARD_URL set):

```bash
cd /Users/martinlevie/AI/Coach/dashboard
DASHBOARD_URL= npx tsx ../scripts/garmin-sync-local.ts
```

Expected:
- Script authenticates with Garmin
- Fetches 28 days of data
- Writes `~/garmin-coach/garmin_coach_data.json`
- Archives to `~/garmin-coach/archive/garmin_2026-03-22.json`
- Prints sync report (total calls, failed calls, success rate)
- Prints "skipping push to Railway" since no URL configured

- [ ] **Step 3: Run the local sync script with Railway push**

```bash
cd /Users/martinlevie/AI/Coach/dashboard
npx tsx ../scripts/garmin-sync-local.ts
```

Expected (with `.env` configured):
- Same as above, plus:
- "Pushing to https://..." message with payload size
- "Push successful" confirmation
- Dashboard shows fresh data at `_meta.generated_at`

- [ ] **Step 4: Verify dashboard reads the uploaded data**

Open the Railway dashboard URL in a browser. Verify:
- Garmin data cards show values (not "---" or "No data")
- The data timestamp matches when you ran the script

- [ ] **Step 5: Token expiry verification (manual)**

Test that the script handles missing/expired tokens correctly:

```bash
# Test: missing tokens
mv ~/.garth ~/.garth.bak
cd /Users/martinlevie/AI/Coach/dashboard && npx tsx ../scripts/garmin-sync-local.ts 2>&1
# Expected: "ERROR: No tokens found at ~/.garth" + exit code 1

# Restore
mv ~/.garth.bak ~/.garth
```

- [ ] **Step 6: Final commit if any tweaks needed**

```bash
cd /Users/martinlevie/AI/Coach
git add -A
git commit -m "fix: tweaks from end-to-end Garmin sync test"
```
