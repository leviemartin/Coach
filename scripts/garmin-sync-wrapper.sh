#!/bin/bash
# garmin-sync-wrapper.sh — launchd wrapper for Garmin data sync
# Handles PATH setup, logging, and macOS notifications.
# Called by com.coach.garmin-sync.plist every Sunday 19:30.

set -euo pipefail

# --- Config ---
PROJECT_DIR="/Users/martinlevie/AI/Coach"
LOG_DIR="$HOME/Library/Logs/garmin-sync"
LOG_FILE="$LOG_DIR/sync.log"
MAX_LOG_AGE_DAYS=28

# --- PATH setup (launchd doesn't source shell profiles) ---
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# --- Ensure log dir exists ---
mkdir -p "$LOG_DIR"

# --- Rotate old logs ---
find "$LOG_DIR" -name "*.log.*" -mtime +$MAX_LOG_AGE_DAYS -delete 2>/dev/null || true

# --- Rotate current log if > 1MB ---
if [ -f "$LOG_FILE" ] && [ "$(stat -f%z "$LOG_FILE" 2>/dev/null || echo 0)" -gt 1048576 ]; then
  mv "$LOG_FILE" "$LOG_FILE.$(date +%Y%m%d-%H%M%S)"
fi

# --- Run sync ---
echo "" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Garmin sync" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

cd "$PROJECT_DIR/dashboard"

if npx tsx ../scripts/garmin-sync-local.ts >> "$LOG_FILE" 2>&1; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Sync completed successfully" >> "$LOG_FILE"
  osascript -e 'display notification "Data pushed to Railway. Ready for checkin." with title "Garmin Sync Complete" sound name "Glass"'
else
  EXIT_CODE=$?
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Sync FAILED (exit code $EXIT_CODE)" >> "$LOG_FILE"
  osascript -e 'display notification "Run manually before checkin. Check ~/Library/Logs/garmin-sync/sync.log" with title "Garmin Sync Failed" sound name "Basso"'
  exit $EXIT_CODE
fi
