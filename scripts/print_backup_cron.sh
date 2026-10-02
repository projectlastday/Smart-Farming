#!/usr/bin/env bash
# Print a crontab line for nightly dumps. Does not install cron by itself.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "# AgriFusionNet scheduled backup (host crontab). Review path before installing:"
echo "15 2 * * * $ROOT/scripts/backup_mysql.sh >> $ROOT/backups/cron.log 2>&1"
echo "20 2 * * 0 $ROOT/scripts/backup_restore_drill.sh >> $ROOT/backups/drill-cron.log 2>&1"
echo "30 3 * * * docker compose -f $ROOT/compose.yaml exec -T backend python -m app.cli retention-cleanup >> $ROOT/backups/retention-cron.log 2>&1"
echo "# Install only after owner review: crontab -e"
