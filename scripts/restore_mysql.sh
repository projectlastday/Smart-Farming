#!/usr/bin/env bash
# Restore a mysqldump into an explicit target database. Refuses the demo DB
# unless CONFIRM_RESTORE matches the target and CONFIRM_PRODUCTION=agrifusionnet.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DUMP="${1:-}"
TARGET="${TARGET_DB:-}"
if [[ -z "$DUMP" || -z "$TARGET" ]]; then
  echo "Usage: TARGET_DB=agrifusionnet_restore ./scripts/restore_mysql.sh backups/file.sql" >&2
  exit 1
fi
if [[ "$TARGET" == "agrifusionnet" && "${CONFIRM_PRODUCTION:-}" != "agrifusionnet" ]]; then
  echo "Refusing to restore into demo database agrifusionnet without CONFIRM_PRODUCTION=agrifusionnet" >&2
  exit 1
fi
if [[ "${CONFIRM_RESTORE:-}" != "$TARGET" ]]; then
  echo "Set CONFIRM_RESTORE=$TARGET to restore into that database." >&2
  exit 1
fi
if [[ ! -f "$DUMP" ]]; then
  echo "Dump not found: $DUMP" >&2
  exit 1
fi
docker compose -f "$ROOT/compose.yaml" exec -T mysql sh -c \
  "mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" -e \"CREATE DATABASE IF NOT EXISTS \\\`$TARGET\\\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\""
docker compose -f "$ROOT/compose.yaml" exec -T mysql sh -c \
  "mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" \"$TARGET\"" < "$DUMP"
echo "Restored $DUMP into $TARGET"
