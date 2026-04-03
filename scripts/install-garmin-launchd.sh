#!/bin/bash
# install-garmin-launchd.sh — one-time setup for automatic Garmin sync
# Installs the Launch Agent and verifies it's active.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_SRC="$SCRIPT_DIR/com.coach.garmin-sync.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.coach.garmin-sync.plist"
LOG_DIR="$HOME/Library/Logs/garmin-sync"
WRAPPER="$SCRIPT_DIR/garmin-sync-wrapper.sh"

echo "=== Garmin Sync — LaunchAgent Installer ==="
echo ""

# Check prerequisites
if [ ! -f "$PLIST_SRC" ]; then
  echo "ERROR: Plist not found at $PLIST_SRC"
  exit 1
fi

if [ ! -x "$WRAPPER" ]; then
  echo "ERROR: Wrapper script not executable at $WRAPPER"
  echo "  Fix: chmod +x $WRAPPER"
  exit 1
fi

if ! command -v npx &>/dev/null; then
  echo "ERROR: npx not found. Install Node.js via Homebrew: brew install node"
  exit 1
fi

# Create log directory
mkdir -p "$LOG_DIR"
echo "✓ Log directory: $LOG_DIR"

# Unload existing agent if present
if launchctl list 2>/dev/null | grep -q "com.coach.garmin-sync"; then
  echo "  Unloading existing agent..."
  launchctl unload "$PLIST_DST" 2>/dev/null || true
fi

# Copy plist
cp "$PLIST_SRC" "$PLIST_DST"
echo "✓ Plist installed: $PLIST_DST"

# Load agent
launchctl load "$PLIST_DST"
echo "✓ Agent loaded"

# Verify
if launchctl list 2>/dev/null | grep -q "com.coach.garmin-sync"; then
  echo "✓ Agent active"
else
  echo "WARNING: Agent may not be active. Check: launchctl list | grep garmin"
fi

echo ""
echo "=== Setup Complete ==="
echo "Schedule: Every Sunday at 19:30"
echo "Logs:     $LOG_DIR/sync.log"
echo "Uninstall: launchctl unload $PLIST_DST && rm $PLIST_DST"
