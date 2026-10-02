#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/backups"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$ROOT/backups/agrifusionnet-${STAMP}.sql"
docker compose exec -T mysql sh -c 'mysqldump --no-tablespaces --single-transaction -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' > "$OUT"
echo "Wrote $OUT"
ls -lh "$OUT"
