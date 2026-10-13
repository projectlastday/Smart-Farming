#!/usr/bin/env bash
# Runtime smoke checks against the Compose proxy (http://127.0.0.1:8005).
set -euo pipefail
BASE="${SMOKE_BASE_URL:-http://127.0.0.1:8005}"
ORIGIN="${SMOKE_ORIGIN:-http://127.0.0.1:8005}"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

echo "== health =="
curl -sf "$BASE/api/v1/health/live" | grep -q '"status":"ok"'
curl -sf "$BASE/api/v1/health/ready" | grep -q '"status":"ready"'

echo "== frontend shell =="
curl -sf -o /dev/null -w "%{http_code}\n" "$BASE/" | grep -q 200

echo "== login demo farmer =="
LOGIN=$(curl -sf -c "$COOKIE_JAR" -X POST "$BASE/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"petani@gmail.com","password":"password"}')
echo "$LOGIN" | grep -q 'csrf_token'
CSRF=$(python3 -c "import json,sys; print(json.load(sys.stdin)['csrf_token'])" <<<"$LOGIN")

echo "== list farms =="
curl -sf -b "$COOKIE_JAR" "$BASE/api/v1/farms" | grep -q 'Sawah'

echo "== harvest feature =="
CYCLE=$(curl -sf -b "$COOKIE_JAR" "$BASE/api/v1/crop-cycles" | python3 -c "import json,sys; d=json.load(sys.stdin); print(next(c['id'] for c in d if c['crop']=='rice'))")
curl -sf -b "$COOKIE_JAR" -X POST "$BASE/api/v1/features/harvest" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" -H "Origin: $ORIGIN" \
  -d "{\"crop_cycle_id\":\"$CYCLE\",\"variety_key\":\"ciherang\"}" | grep -q 'harvest'

echo "== model metadata =="
curl -sf -b "$COOKIE_JAR" "$BASE/api/v1/features/disease/model/metadata" | grep -q 'disease-mobilenet-v1-paddy-doctor'

echo "SMOKE OK"
