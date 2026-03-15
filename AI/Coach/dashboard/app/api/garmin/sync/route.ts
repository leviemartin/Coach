import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { GARMIN_CONNECTOR_DIR, GARMIN_CONNECTOR_SCRIPT } from '@/lib/constants';

const execFileAsync = promisify(execFile);

// Module-level mutex — valid for single-process Node (next dev / next start).
// Not effective in serverless deployments; client-side disabled state is the primary guard.
let syncing = false;

export async function POST() {
  if (syncing) {
    return NextResponse.json(
      { success: false, error: 'Sync already in progress' },
      { status: 409 }
    );
  }

  syncing = true;
  try {
    const { stdout, stderr } = await execFileAsync(
      'python3',
      [GARMIN_CONNECTOR_SCRIPT],
      { cwd: GARMIN_CONNECTOR_DIR, timeout: 120_000, maxBuffer: 5 * 1024 * 1024 }
    );

    return NextResponse.json({
      success: true,
      message: 'Garmin data synced successfully',
      output: [stderr, stdout].filter(Boolean).join('\n').trim(),
    });
  } catch (err: unknown) {
    const error = err as {
      stderr?: string;
      stdout?: string;
      message?: string;
      killed?: boolean;
      signal?: string;
    };

    if (error.killed) {
      return NextResponse.json(
        { success: false, error: 'Sync timed out after 120 seconds. The Garmin API may be slow — try again.' },
        { status: 504 }
      );
    }

    const output = [error.stderr, error.stdout].filter(Boolean).join('\n').trim()
      || error.message || 'Unknown error';

    if (output.includes('Authentication')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication failed. Re-run garmin_connector.py manually to re-authenticate.',
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Garmin sync failed. Check the connector script for details.' },
      { status: 500 }
    );
  } finally {
    syncing = false;
  }
}
