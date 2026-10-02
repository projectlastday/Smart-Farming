#!/usr/bin/env bash
# Isolated schema backup/restore drill. Creates agrifusionnet_drill_*, dumps,
# drops, restores, verifies a marker row, then drops the schema. Never touches agrifusionnet.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCHEMA="agrifusionnet_drill_$(date -u +%Y%m%d%H%M%S)"
MARKER="drill-$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="$ROOT/backups/${SCHEMA}.sql"
mkdir -p "$ROOT/backups"
cleanup() {
  docker compose -f "$ROOT/compose.yaml" exec -T mysql sh -c \
    "mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" -e \"DROP DATABASE IF EXISTS \\\`$SCHEMA\\\`;\"" >/dev/null 2>&1 || true
  rm -f "$DUMP"
}
trap cleanup EXIT

docker compose -f "$ROOT/compose.yaml" exec -T mysql sh -c \
  "mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" -e \"
    CREATE DATABASE \\\`$SCHEMA\\\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    USE \\\`$SCHEMA\\\`;
    CREATE TABLE restore_marker (id INT PRIMARY KEY, token VARCHAR(64) NOT NULL, note VARCHAR(128) NULL) ENGINE=InnoDB;
    INSERT INTO restore_marker (id, token, note) VALUES (1, '${MARKER}', 'isolated-drill');
  \""

docker compose -f "$ROOT/compose.yaml" exec -T mysql sh -c \
  "mysqldump --no-tablespaces --single-transaction -uroot -p\"\$MYSQL_ROOT_PASSWORD\" \"$SCHEMA\"" > "$DUMP"

docker compose -f "$ROOT/compose.yaml" exec -T mysql sh -c \
  "mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" -e \"DROP DATABASE \\\`$SCHEMA\\\`;\""

docker compose -f "$ROOT/compose.yaml" exec -T mysql sh -c \
  "mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" -e \"CREATE DATABASE \\\`$SCHEMA\\\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\""

docker compose -f "$ROOT/compose.yaml" exec -T mysql sh -c \
  "mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" \"$SCHEMA\"" < "$DUMP"

GOT="$(docker compose -f "$ROOT/compose.yaml" exec -T mysql sh -c \
  "mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" -N -e \"USE \\\`$SCHEMA\\\`; SELECT token FROM restore_marker WHERE id=1;\"")"
GOT="${GOT//$'\r'/}"
if [[ "$GOT" != "$MARKER" ]]; then
  echo "Restore drill failed: expected $MARKER got $GOT" >&2
  exit 1
fi
echo "backup_restore_drill ok schema=$SCHEMA marker_verified=true demo_untouched=true"
