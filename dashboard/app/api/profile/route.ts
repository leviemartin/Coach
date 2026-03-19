import { NextResponse } from 'next/server';
import { readAthleteProfile, readPeriodization } from '@/lib/state';

export async function GET() {
  return NextResponse.json({
    profile: readAthleteProfile(),
    periodization: readPeriodization(),
  });
}
