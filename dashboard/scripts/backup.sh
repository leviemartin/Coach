#!/bin/sh
DATE=$(date +%Y%m%d)
BACKUP_DIR="${COACH_ROOT:-/data}/backups"

mkdir -p "$BACKUP_DIR"

echo "$(date): Starting backup..."

# SQLite hot backup (safe with WAL mode)
sqlite3 "${DB_PATH:-/data/trends.db}" ".backup $BACKUP_DIR/trends-$DATE.db"

# State files tarball
tar czf "$BACKUP_DIR/state-$DATE.tar.gz" -C "${COACH_ROOT:-/data}" state/ coaches/

# Prune backups older than 7 days
find "$BACKUP_DIR" -name "trends-*.db" -mtime +7 -delete
find "$BACKUP_DIR" -name "state-*.tar.gz" -mtime +7 -delete

echo "$(date): Backup complete"
