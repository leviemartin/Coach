#!/bin/sh
set -e

echo "=== OCR Coach Dashboard — Starting ==="

# 1. Validate required env vars
REQUIRED_VARS="COACH_ROOT DB_PATH GARMIN_DATA_PATH GARMIN_CONNECTOR_DIR GARMIN_TOKEN_DIR GARMIN_EMAIL GARMIN_PASSWORD ANTHROPIC_API_KEY NEXTAUTH_SECRET NEXTAUTH_URL GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET ALLOWED_EMAIL"
for var in $REQUIRED_VARS; do
  eval val=\$$var
  if [ -z "$val" ]; then
    echo "ERROR: Required env var $var is not set"
    exit 1
  fi
done

# 2. Auto-run migration if not yet complete
if [ ! -f "$COACH_ROOT/.migration-complete" ]; then
  echo "Migration not found — running automatically..."
  /app/scripts/migrate-to-volume.sh
fi

# 3. Sync coach personas from repo (updates on deploy)
if [ -d /app/init-data/coaches ]; then
  for f in /app/init-data/coaches/*.md; do
    name=$(basename "$f")
    target="$COACH_ROOT/coaches/$name"
    if [ ! -f "$target" ]; then
      cp "$f" "$target"
      echo "SYNC: Added new coach file $name"
    elif ! cmp -s "$f" "$target"; then
      cp "$f" "$target"
      echo "SYNC: Updated coach file $name from repo"
    fi
  done
fi

# 4. Export env vars for cron jobs (cron does not inherit container env)
printenv | grep -E '^(COACH_ROOT|DB_PATH|GARMIN_|NODE_ENV|PATH|PORT|ANTHROPIC_API_KEY)=' > /app/scripts/.env
chmod 600 /app/scripts/.env

# 5. Set up cron jobs dynamically
echo "0 */6 * * * . /app/scripts/.env; /app/scripts/garmin-sync.sh >> /var/log/garmin-sync.log 2>&1" > /etc/crontabs/root
echo "0 3 * * * . /app/scripts/.env; /app/scripts/backup.sh >> /var/log/backup.log 2>&1" >> /etc/crontabs/root

# 6. Start cron daemon
echo "Starting cron daemon..."
crond -b -l 2

# 7. Start Next.js
echo "Starting Next.js on port ${PORT:-3000}..."
exec node /app/server.js
