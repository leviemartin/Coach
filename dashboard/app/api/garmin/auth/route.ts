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
