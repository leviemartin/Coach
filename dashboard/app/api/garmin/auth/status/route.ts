import { NextResponse } from 'next/server';
import { getAuthStatus } from '@/lib/garmin-tokens';
import { GARMIN_TOKEN_DIR } from '@/lib/constants';

export async function GET() {
  const status = getAuthStatus(GARMIN_TOKEN_DIR);
  return NextResponse.json({ status });
}
