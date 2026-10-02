#!/usr/bin/env bash
# Create agrifusionnet_test using credentials already inside the mysql container.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
docker compose -f "$ROOT/compose.yaml" exec -T mysql sh -c \
  'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS agrifusionnet_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON agrifusionnet_test.* TO \"$MYSQL_USER\"@\"%\"; FLUSH PRIVILEGES;"'
echo "agrifusionnet_test is ready"
