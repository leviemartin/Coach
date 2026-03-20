#!/bin/sh
echo "$(date): Starting Garmin sync"

cd /app/garmin-coach || exit 1

python3 garmin_connector.py \
  --output "${GARMIN_DATA_PATH:-/data/garmin/garmin_coach_data.json}" \
  --token-dir "${GARMIN_TOKEN_DIR:-/data/garmin/.tokens}" \
  2>&1

EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "$(date): ERROR: Garmin sync failed (exit $EXIT_CODE)"
  echo "$(date): Check if MFA re-authentication is needed"
else
  echo "$(date): Garmin sync complete"
fi
