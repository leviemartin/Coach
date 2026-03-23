import { NextResponse } from 'next/server';
import { getDailyNotes, insertDailyNote, deleteDailyNote } from '@/lib/db';
import type { DailyNote } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get('daily_log_id');

  if (!rawId || isNaN(Number(rawId))) {
    return NextResponse.json({ error: 'Missing or invalid daily_log_id' }, { status: 400 });
  }

  const notes = getDailyNotes(Number(rawId));
  return NextResponse.json({ notes });
}

export async function POST(request: Request) {
  const body = await request.json();

  const { daily_log_id, category, text } = body as {
    daily_log_id?: number;
    category?: DailyNote['category'];
    text?: string;
  };

  if (!daily_log_id || typeof daily_log_id !== 'number') {
    return NextResponse.json({ error: 'Missing or invalid daily_log_id' }, { status: 400 });
  }

  const validCategories: DailyNote['category'][] = ['injury', 'sleep', 'training', 'life', 'other'];
  if (!category || !validCategories.includes(category)) {
    return NextResponse.json(
      { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
      { status: 400 }
    );
  }

  if (!text || typeof text !== 'string' || text.trim() === '') {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  const trimmed = text.trim();
  if (trimmed.length > 1000) {
    return NextResponse.json({ error: 'text must be 1000 characters or fewer' }, { status: 400 });
  }

  const note = insertDailyNote(daily_log_id, category, trimmed);
  return NextResponse.json({ note }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get('id');

  if (!rawId || isNaN(Number(rawId))) {
    return NextResponse.json({ error: 'Missing or invalid id' }, { status: 400 });
  }

  deleteDailyNote(Number(rawId));
  return NextResponse.json({ success: true });
}
