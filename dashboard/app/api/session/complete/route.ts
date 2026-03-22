import { NextResponse } from 'next/server';
import { completeSession, getSessionSets } from '@/lib/session-db';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  const { sessionId, notes } = await request.json();

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const result = completeSession(sessionId, notes || '');

  let ceilingCheck: string | null = null;
  try {
    const ceilingsPath = path.join(process.cwd(), '..', 'state', 'current_ceilings.json');
    const raw = fs.readFileSync(ceilingsPath, 'utf-8');
    const ceilings = JSON.parse(raw);
    const ceilingEntries: Record<string, number> = ceilings.ceilings || {};

    const sets = getSessionSets(sessionId);
    const newCeilings: string[] = [];

    const maxByExercise = new Map<string, number>();
    for (const set of sets) {
      if (set.completed && set.actualWeightKg != null && set.actualWeightKg > 0) {
        const current = maxByExercise.get(set.exerciseName) ?? 0;
        if (set.actualWeightKg > current) {
          maxByExercise.set(set.exerciseName, set.actualWeightKg);
        }
      }
    }

    for (const [exercise, maxWeight] of maxByExercise) {
      const ceilingKey = Object.keys(ceilingEntries).find(
        (k) => k.toLowerCase().replace(/[_\s-]/g, '') === exercise.toLowerCase().replace(/[_\s-]/g, ''),
      );
      const currentCeiling = ceilingKey ? ceilingEntries[ceilingKey] : null;
      if (currentCeiling != null && typeof currentCeiling === 'number' && maxWeight > currentCeiling) {
        newCeilings.push(`${exercise}: ${currentCeiling}kg → ${maxWeight}kg`);
      }
    }

    ceilingCheck = newCeilings.length > 0
      ? `New ceilings: ${newCeilings.join(', ')}`
      : 'No new ceilings hit today.';
  } catch {
    ceilingCheck = 'Could not check ceilings.';
  }

  return NextResponse.json({
    success: true,
    compliancePct: result.compliancePct,
    weightChanges: result.weightChanges,
    ceilingCheck,
  });
}
