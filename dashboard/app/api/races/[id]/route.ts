import { NextResponse } from 'next/server';
import { readRaces, writeRaces } from '@/lib/state';
import { upsertRace, deleteRace } from '@/lib/db';
import type { RaceStatus } from '@/lib/types';

const VALID_STATUSES: RaceStatus[] = ['registered', 'planned', 'tentative', 'completed'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const data = readRaces();
    const idx = data.races.findIndex((r) => r.id === id);
    if (idx < 0) {
      return NextResponse.json({ error: 'Race not found' }, { status: 404 });
    }

    const race = { ...data.races[idx] };
    if (typeof body.name === 'string' && body.name.trim()) race.name = body.name.trim();
    if (typeof body.date === 'string' && body.date.trim()) {
      const d = body.date.trim();
      if (!DATE_REGEX.test(d) || isNaN(new Date(d).getTime())) {
        return NextResponse.json({ error: 'Invalid date format (YYYY-MM-DD)' }, { status: 400 });
      }
      race.date = d;
    }
    if (typeof body.location === 'string' && body.location.trim()) race.location = body.location.trim();
    if (typeof body.type === 'string' && body.type.trim()) race.type = body.type.trim();
    if (typeof body.status === 'string') {
      const trimmed = body.status.trim() as RaceStatus;
      if (VALID_STATUSES.includes(trimmed)) race.status = trimmed;
    }
    if (typeof body.notes === 'string') race.notes = body.notes;

    data.races[idx] = race;
    data.races.sort((a, b) => a.date.localeCompare(b.date));

    upsertRace(race);
    writeRaces(data);

    return NextResponse.json({ success: true, race });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update race' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const data = readRaces();
    const idx = data.races.findIndex((r) => r.id === id);
    if (idx < 0) {
      return NextResponse.json({ error: 'Race not found' }, { status: 404 });
    }

    deleteRace(id);
    data.races.splice(idx, 1);
    writeRaces(data);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete race' },
      { status: 500 }
    );
  }
}
