import { NextResponse } from 'next/server';
import { readRaces, writeRaces } from '@/lib/state';
import { upsertRace } from '@/lib/db';
import type { Race, RaceStatus } from '@/lib/types';

export async function GET() {
  const data = readRaces();
  data.races.sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json(data);
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const VALID_STATUSES: RaceStatus[] = ['registered', 'planned', 'tentative', 'completed'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FIELD_LEN = 500;
const MAX_NOTES_LEN = 5000;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, MAX_FIELD_LEN) : '';
  const date = typeof body.date === 'string' ? body.date.trim() : '';
  const location = typeof body.location === 'string' ? body.location.trim().slice(0, MAX_FIELD_LEN) : '';
  const type = typeof body.type === 'string' ? body.type.trim().slice(0, MAX_FIELD_LEN) : '';
  const status = typeof body.status === 'string' ? body.status.trim() as RaceStatus : 'planned';
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, MAX_NOTES_LEN) : '';

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!DATE_REGEX.test(date) || isNaN(new Date(date).getTime())) return NextResponse.json({ error: 'Valid date is required (YYYY-MM-DD)' }, { status: 400 });
  if (!location) return NextResponse.json({ error: 'Location is required' }, { status: 400 });
  if (!type) return NextResponse.json({ error: 'Type is required' }, { status: 400 });
  if (!VALID_STATUSES.includes(status)) return NextResponse.json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });

  const year = date.split('-')[0];
  const slug = slugify(`${name}-${year}`);
  if (!slug) return NextResponse.json({ error: 'Name must contain alphanumeric characters' }, { status: 400 });
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : slug;

  const race: Race = { id, name, date, location, type, status, notes };

  try {
    const data = readRaces();
    const existingIdx = data.races.findIndex((r) => r.id === id);
    if (existingIdx >= 0) {
      data.races[existingIdx] = race;
    } else {
      data.races.push(race);
    }
    data.races.sort((a, b) => a.date.localeCompare(b.date));

    upsertRace(race);
    writeRaces(data);

    return NextResponse.json({ success: true, race });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save race' },
      { status: 500 }
    );
  }
}
