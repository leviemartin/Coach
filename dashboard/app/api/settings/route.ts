import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';
import { DEFAULT_MODEL } from '@/lib/constants';

export async function GET() {
  const model = getSetting('model', DEFAULT_MODEL);
  return NextResponse.json({ model });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  if (body.model) {
    setSetting('model', body.model);
  }
  return NextResponse.json({ success: true });
}
