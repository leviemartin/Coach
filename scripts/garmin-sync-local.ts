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
const LOCAL_OUTPUT_DIR = path.resolve(__dirname, '..', 'garmin');
const LOCAL_OUTPUT_PATH = path.join(LOCAL_OUTPUT_DIR, 'garmin_coach_data.json');
const MAX_PUSH_BYTES = 10 * 1024 * 1024; // 10MB — abort if export is unexpectedly large

// Load .env from project root if present
// Script runs from dashboard/ dir, so project root is one level up
const envPath = path.resolve(process.cwd(), '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip matching quotes (standard .env convention)
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
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
