import { NextResponse } from 'next/server';
import { readCeilings, writeCeilings } from '@/lib/state';

export async function GET() {
  const ceilings = readCeilings();
  return NextResponse.json(ceilings);
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const current = readCeilings();

  if (body.ceilings) {
    current.ceilings = { ...current.ceilings, ...body.ceilings };
    current.last_updated = new Date().toISOString().split('T')[0];
  }

  writeCeilings(current);
  return NextResponse.json(current);
}
