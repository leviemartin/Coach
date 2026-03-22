import { NextResponse } from 'next/server';
import { GARMIN_DATA_PATH } from '@/lib/constants';
import fs from 'fs';
import path from 'path';

const REQUIRED_FIELDS = ['_meta', 'activities', 'health_stats_7d', 'performance_stats'];
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  // Auth check
  const authHeader = req.headers.get('authorization');
  const secret = process.env.GARMIN_UPLOAD_SECRET;
  if (!secret || !authHeader || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json(
      { success: false, error: 'unauthorized' },
      { status: 401 },
    );
  }

  // Size check
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { success: false, error: 'Payload too large' },
      { status: 413 },
    );
  }

  // Parse body
  let data: Record<string, unknown>;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON' },
      { status: 400 },
    );
  }

  // Validate required fields
  for (const field of REQUIRED_FIELDS) {
    if (!(field in data)) {
      return NextResponse.json(
        { success: false, error: `Invalid data: missing required field '${field}'` },
        { status: 400 },
      );
    }
  }

  // Write to GARMIN_DATA_PATH
  const dir = path.dirname(GARMIN_DATA_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const exportJson = JSON.stringify(data, null, 2);
  fs.writeFileSync(GARMIN_DATA_PATH, exportJson);

  // Archive to dated file
  const archiveDir = path.join(dir, 'archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  const today = new Date().toISOString().split('T')[0];
  let archiveName = `garmin_${today}.json`;
  if (fs.existsSync(path.join(archiveDir, archiveName))) {
    for (let seq = 2; seq <= 99; seq++) {
      archiveName = `garmin_${today}_${seq}.json`;
      if (!fs.existsSync(path.join(archiveDir, archiveName))) break;
    }
  }
  fs.writeFileSync(path.join(archiveDir, archiveName), exportJson);

  return NextResponse.json({
    success: true,
    message: 'Garmin data uploaded',
    archived_as: archiveName,
  });
}
