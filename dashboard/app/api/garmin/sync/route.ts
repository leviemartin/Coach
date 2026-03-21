import { NextResponse } from 'next/server';
import { loadTokens, saveTokens } from '@/lib/garmin-tokens';
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

    // Validate tokens with a lightweight API call before running the full export.
    // This call is NOT wrapped in safeCall, so auth errors surface immediately.
    try {
      const probe = await connectApi(
        '/userprofile-service/socialProfile',
        tokens.oauth1,
        currentOAuth2,
        GARMIN_TOKEN_DIR,
      );
      currentOAuth2 = probe.oauth2;
    } catch {
      return NextResponse.json(
        { success: false, error: 'auth_required' },
        { status: 401 },
      );
    }

    const apiFn = async (apiPath: string) => {
      const result = await connectApi(
        apiPath,
        tokens.oauth1,
        currentOAuth2,
        GARMIN_TOKEN_DIR,
      );
      currentOAuth2 = result.oauth2;
      return result.data;
    };

    const exportData = await buildExport(apiFn);

    const dir = path.dirname(GARMIN_DATA_PATH);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(GARMIN_DATA_PATH, JSON.stringify(exportData, null, 2));

    saveTokens(GARMIN_TOKEN_DIR, tokens.oauth1, currentOAuth2);

    // Read the sync report from the export data
    const syncReport = exportData._sync_report ?? null;

    return NextResponse.json({
      success: true,
      message: syncReport && syncReport.failed_calls > 0
        ? `Synced with ${syncReport.failed_calls} failed API calls (${syncReport.success_rate}% success)`
        : 'Garmin data synced successfully',
      syncReport,
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
