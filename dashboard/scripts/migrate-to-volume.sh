#!/bin/sh
set -e

VOLUME="$COACH_ROOT"
SOURCE="/app/init-data"

if [ -z "$VOLUME" ]; then
  echo "ERROR: COACH_ROOT env var is not set"
  exit 1
fi

if [ -f "$VOLUME/.migration-complete" ]; then
  echo "ERROR: Migration already completed. Delete $VOLUME/.migration-complete to re-run."
  exit 1
fi

echo "=== Data Migration ==="
echo "Source: $SOURCE"
echo "Target: $VOLUME"
echo ""

# Pre-flight
if [ ! -d "$SOURCE/state" ]; then
  echo "ERROR: Source state/ not found at $SOURCE/state"
  exit 1
fi

if [ ! -f "$SOURCE/trends.db" ]; then
  echo "ERROR: Source trends.db not found at $SOURCE/trends.db"
  exit 1
fi

# Create directories
mkdir -p "$VOLUME/state/weekly_logs" "$VOLUME/coaches" "$VOLUME/garmin/.tokens" "$VOLUME/backups"

# Copy data
echo "Copying state files..."
cp -a "$SOURCE/state/." "$VOLUME/state/"

echo "Copying coach personas..."
cp -a "$SOURCE/coaches/." "$VOLUME/coaches/"

echo "Copying database..."
cp "$SOURCE/trends.db" "$VOLUME/trends.db"

# Verify checksums
echo ""
echo "=== Verifying Checksums ==="
ERRORS=0

verify_file() {
  src="$1"
  dst="$2"
  src_md5=$(md5sum "$src" | cut -d' ' -f1)
  dst_md5=$(md5sum "$dst" | cut -d' ' -f1)
  name=$(basename "$src")
  if [ "$src_md5" = "$dst_md5" ]; then
    echo "  OK: $name"
  else
    echo "  MISMATCH: $name (src=$src_md5 dst=$dst_md5)"
    ERRORS=$((ERRORS + 1))
  fi
}

# Verify all state files
for f in "$SOURCE/state/"*; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  verify_file "$f" "$VOLUME/state/$name"
done

# Verify weekly logs
if [ -d "$SOURCE/state/weekly_logs" ]; then
  for f in "$SOURCE/state/weekly_logs/"*; do
    [ -f "$f" ] || continue
    name=$(basename "$f")
    verify_file "$f" "$VOLUME/state/weekly_logs/$name"
  done
fi

# Verify coaches
for f in "$SOURCE/coaches/"*; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  verify_file "$f" "$VOLUME/coaches/$name"
done

# Verify database
verify_file "$SOURCE/trends.db" "$VOLUME/trends.db"

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "ERROR: $ERRORS checksum mismatches. Migration ABORTED."
  exit 1
fi

# Verify SQLite integrity
echo ""
echo "=== SQLite Integrity Check ==="
INTEGRITY=$(sqlite3 "$VOLUME/trends.db" "PRAGMA integrity_check")
if [ "$INTEGRITY" != "ok" ]; then
  echo "ERROR: SQLite integrity check failed: $INTEGRITY"
  exit 1
fi
echo "  Integrity: OK"

# Count rows
echo ""
echo "=== Table Row Counts ==="
for table in weekly_metrics plan_items ceiling_history dexa_scans races settings; do
  count=$(sqlite3 "$VOLUME/trends.db" "SELECT COUNT(*) FROM $table" 2>/dev/null || echo "N/A")
  echo "  $table: $count rows"
done

# Count files
FILE_COUNT=$(find "$VOLUME/state" "$VOLUME/coaches" -type f | wc -l | tr -d ' ')

# Write migration marker
cat > "$VOLUME/.migration-complete" <<MARKER
Migration completed: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Files copied: $FILE_COUNT
Checksum errors: $ERRORS
SQLite integrity: $INTEGRITY
MARKER

echo ""
echo "=== Migration Complete ==="
echo "Files copied: $FILE_COUNT"
echo "Checksums verified: OK"
echo "SQLite integrity: OK"
echo "Marker written: $VOLUME/.migration-complete"
