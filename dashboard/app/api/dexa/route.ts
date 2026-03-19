import { NextResponse } from 'next/server';
import fs from 'fs';
import { readDexaScans, writeDexaScans } from '@/lib/state';
import { upsertDexaScan, getDexaScans } from '@/lib/db';
import { GARMIN_DATA_PATH } from '@/lib/constants';
import type { DexaScan, DexaScanCalibration, GarminData } from '@/lib/types';

export async function GET() {
  const data = readDexaScans();
  return NextResponse.json(data);
}

function findNearestGarminBodyComp(scanDate: string): {
  garminBodyFatPct: number | null;
  garminMuscleMassKg: number | null;
  garminWeightKg: number | null;
  garminReadingDate: string | null;
} {
  try {
    const raw = fs.readFileSync(GARMIN_DATA_PATH, 'utf-8');
    const garmin: GarminData = JSON.parse(raw);
    const daily = garmin.health_stats_7d?.body_composition?.daily;
    if (!daily || daily.length === 0) {
      return { garminBodyFatPct: null, garminMuscleMassKg: null, garminWeightKg: null, garminReadingDate: null };
    }

    const scanTime = new Date(scanDate).getTime();
    let closest = daily[0];
    let closestDiff = Math.abs(new Date(closest.date || '').getTime() - scanTime);

    for (const d of daily) {
      if (!d.date) continue;
      const diff = Math.abs(new Date(d.date).getTime() - scanTime);
      if (diff < closestDiff) {
        closest = d;
        closestDiff = diff;
      }
    }

    return {
      garminBodyFatPct: closest.body_fat_pct ?? null,
      garminMuscleMassKg: closest.muscle_mass_kg ?? null,
      garminWeightKg: closest.weight_kg ?? null,
      garminReadingDate: closest.date ?? null,
    };
  } catch {
    return { garminBodyFatPct: null, garminMuscleMassKg: null, garminWeightKg: null, garminReadingDate: null };
  }
}

// Handle European comma-decimal format (e.g. "62,446" → 62.446)
function parseLocaleNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val.replace(',', '.'));
  return NaN;
}

function toNum(val: unknown): number | null {
  if (val == null || val === '') return null;
  const n = parseLocaleNumber(val);
  return Number.isFinite(n) ? n : null;
}

function toNumOrNull(val: unknown): number | null {
  if (val == null || val === '') return null;
  const n = parseLocaleNumber(val);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const data = readDexaScans();

    // Validate scan number
    const scanNumber = toNum(body.scanNumber);
    if (scanNumber == null || ![1, 2, 3].includes(scanNumber)) {
      return NextResponse.json({ error: 'Invalid scan number (must be 1, 2, or 3)' }, { status: 400 });
    }

    // Validate date
    const date = typeof body.date === 'string' ? body.date : '';
    if (!date || isNaN(new Date(date).getTime())) {
      return NextResponse.json({ error: 'Invalid or missing date (use YYYY-MM-DD)' }, { status: 400 });
    }

    // Validate phase
    const phase = typeof body.phase === 'string' ? body.phase.trim() : '';
    if (!phase) {
      return NextResponse.json({ error: 'Missing required field: phase' }, { status: 400 });
    }

    // Parse and validate required numeric fields
    const totalBodyFatPct = toNum(body.totalBodyFatPct);
    const totalLeanMassKg = toNum(body.totalLeanMassKg);
    const fatMassKg = toNum(body.fatMassKg);
    const boneMineralDensityGcm2 = toNum(body.boneMineralDensityGcm2);
    const boneMassKg = toNum(body.boneMassKg);
    const weightAtScanKg = toNum(body.weightAtScanKg);

    if (totalBodyFatPct == null) return NextResponse.json({ error: 'Invalid or missing: totalBodyFatPct' }, { status: 400 });
    if (totalLeanMassKg == null) return NextResponse.json({ error: 'Invalid or missing: totalLeanMassKg' }, { status: 400 });
    if (fatMassKg == null) return NextResponse.json({ error: 'Invalid or missing: fatMassKg' }, { status: 400 });
    if (boneMineralDensityGcm2 == null) return NextResponse.json({ error: 'Invalid or missing: boneMineralDensityGcm2' }, { status: 400 });
    if (boneMassKg == null) return NextResponse.json({ error: 'Invalid or missing: boneMassKg' }, { status: 400 });
    if (weightAtScanKg == null) return NextResponse.json({ error: 'Invalid or missing: weightAtScanKg' }, { status: 400 });

    // Range validation
    if (totalBodyFatPct < 3 || totalBodyFatPct > 60) {
      return NextResponse.json({ error: 'Body fat % out of range (expected 3-60%)' }, { status: 400 });
    }
    if (weightAtScanKg < 40 || weightAtScanKg > 200) {
      return NextResponse.json({ error: 'Weight out of range (expected 40-200kg)' }, { status: 400 });
    }
    if (boneMineralDensityGcm2 <= 0 || boneMineralDensityGcm2 > 3) {
      return NextResponse.json({ error: 'Bone mineral density out of range (expected 0-3 g/cm²)' }, { status: 400 });
    }

    // Auto-populate Garmin nearest reading
    const garminPairing = findNearestGarminBodyComp(date);

    // Override with explicit values if provided
    const garminBodyFatPct = toNumOrNull(body.garminBodyFatPct) ?? garminPairing.garminBodyFatPct;
    const garminMuscleMassKg = toNumOrNull(body.garminMuscleMassKg) ?? garminPairing.garminMuscleMassKg;
    const garminWeightKg = toNumOrNull(body.garminWeightKg) ?? garminPairing.garminWeightKg;
    const garminReadingDate = (typeof body.garminReadingDate === 'string' ? body.garminReadingDate : null) ?? garminPairing.garminReadingDate;

    // Calculate calibration offsets (null when no Garmin data to compare)
    const hasGarminBF = garminBodyFatPct != null;
    const hasGarminLean = garminMuscleMassKg != null;
    const calibration: DexaScanCalibration = {
      bodyFatOffsetPct: hasGarminBF
        ? Math.round((totalBodyFatPct - garminBodyFatPct) * 10) / 10
        : 0,
      leanMassOffsetKg: hasGarminLean
        ? Math.round((totalLeanMassKg - garminMuscleMassKg) * 10) / 10
        : 0,
    };
    const garminPaired = hasGarminBF || hasGarminLean;

    const scan: DexaScan = {
      scanNumber: scanNumber as 1 | 2 | 3,
      date,
      phase,
      totalBodyFatPct,
      totalLeanMassKg,
      fatMassKg,
      boneMineralDensityGcm2,
      boneMassKg,
      weightAtScanKg,
      regional: {
        trunkFatPct: toNumOrNull(body.trunkFatPct),
        armsFatPct: toNumOrNull(body.armsFatPct),
        legsFatPct: toNumOrNull(body.legsFatPct),
        trunkLeanKg: toNumOrNull(body.trunkLeanKg),
        armsLeanKg: toNumOrNull(body.armsLeanKg),
        legsLeanKg: toNumOrNull(body.legsLeanKg),
      },
      garminBodyFatPct,
      garminMuscleMassKg,
      garminWeightKg,
      garminReadingDate,
      calibration,
      notes: typeof body.notes === 'string' ? body.notes : '',
    };

    // Update or add scan in JSON
    const existingIdx = data.scans.findIndex((s) => s.scanNumber === scanNumber);
    if (existingIdx >= 0) {
      data.scans[existingIdx] = scan;
    } else {
      data.scans.push(scan);
      data.scans.sort((a, b) => a.scanNumber - b.scanNumber);
    }

    // Update latest calibration (only if Garmin was actually paired)
    if (garminPaired) {
      data.latest_calibration = scan.calibration;
    }

    // Check for calibration drift (scan 2+, only when both have Garmin pairing)
    let driftWarning: string | null = null;
    if (data.scans.length >= 2) {
      const first = data.scans[0];
      const latest = data.scans[data.scans.length - 1];
      if (first.garminBodyFatPct != null && latest.garminBodyFatPct != null) {
        const bfDrift = Math.abs(latest.calibration.bodyFatOffsetPct - first.calibration.bodyFatOffsetPct);
        const lmDrift = Math.abs(latest.calibration.leanMassOffsetKg - first.calibration.leanMassOffsetKg);
        if (bfDrift > 2 || lmDrift > 1) {
          driftWarning = `Calibration drift detected: BF offset shifted ${bfDrift.toFixed(1)}%, lean mass offset shifted ${lmDrift.toFixed(1)}kg from scan 1`;
        }
      }
    }

    // Write SQLite first (throws on failure), then JSON
    upsertDexaScan(scan);
    writeDexaScans(data);

    return NextResponse.json({ success: true, scan, garminPaired, driftWarning });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save DEXA scan' },
      { status: 500 }
    );
  }
}
