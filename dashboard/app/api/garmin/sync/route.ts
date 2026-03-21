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
