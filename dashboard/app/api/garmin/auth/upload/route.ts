import { NextRequest, NextResponse } from 'next/server';
import { saveTokens, loadTokens } from '@/lib/garmin-tokens';
import { GARMIN_TOKEN_DIR } from '@/lib/constants';

/**
 * Upload locally-generated Garmin tokens to the server.
 *
 * Garmin's SSO uses Cloudflare which blocks datacenter IPs. This endpoint
 * lets you generate tokens locally (via garmin-token-bootstrap.py) and
 * upload them through the dashboard.
 *
 * Body: { oauth1: OAuth1Token, oauth2: OAuth2Token }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.oauth1?.oauth_token || !body.oauth2?.access_token) {
      return NextResponse.json(
        { status: 'error', error: 'Invalid token format. Need oauth1 and oauth2 objects.' },
        { status: 400 },
      );
    }

    saveTokens(GARMIN_TOKEN_DIR, body.oauth1, body.oauth2);

    // Verify they were saved correctly
    const loaded = loadTokens(GARMIN_TOKEN_DIR);
    if (!loaded) {
      return NextResponse.json(
        { status: 'error', error: 'Tokens saved but could not be read back' },
        { status: 500 },
      );
    }

    return NextResponse.json({ status: 'authenticated' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json(
      { status: 'error', error: msg },
      { status: 500 },
    );
  }
}
