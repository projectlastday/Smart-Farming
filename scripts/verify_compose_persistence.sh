#!/usr/bin/env bash
# Prove named MySQL volume data survives `docker compose restart`.
# Creates a uniquely named E2E farm, restarts the stack, then checks it still exists.
# Does not print credentials, cookies, or tokens.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BASE="${SMOKE_BASE_URL:-http://127.0.0.1:8005}"
ORIGIN="${SMOKE_ORIGIN:-http://127.0.0.1:8005}"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

python3 - "$BASE" "$ORIGIN" "$COOKIE_JAR" <<'PY'
import json, os, sys, urllib.request
from pathlib import Path

base, origin, cookie_path = sys.argv[1:4]
env = {}
env_path = Path(".env")
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
email = os.environ.get("E2E_FARMER_EMAIL") or env.get("E2E_FARMER_EMAIL") or "e2e.farmer@agrifusion.test"
password = os.environ.get("E2E_FARMER_PASSWORD") or env.get("E2E_FARMER_PASSWORD") or "E2eFarmer123!"
farm_name = os.environ.get("PERSISTENCE_FARM_NAME") or f"E2E-Persist-{os.getpid()}"
login_req = urllib.request.Request(
    f"{base}/api/v1/auth/login",
    data=json.dumps({"email": email, "password": password}).encode(),
    headers={"Content-Type": "application/json", "Origin": origin},
    method="POST",
)
with urllib.request.urlopen(login_req, timeout=30) as resp:
    body = json.loads(resp.read().decode())
    csrf = body["csrf_token"]
    cookie = resp.headers.get("Set-Cookie", "").split(";", 1)[0]
Path(cookie_path).write_text(cookie + "\n" + csrf + "\n" + farm_name + "\n", encoding="utf-8")
create_req = urllib.request.Request(
    f"{base}/api/v1/farms",
    data=json.dumps({"name": farm_name, "location": "Semarang Persistensi"}).encode(),
    headers={
        "Content-Type": "application/json",
        "Origin": origin,
        "X-CSRF-Token": csrf,
        "Cookie": cookie,
    },
    method="POST",
)
with urllib.request.urlopen(create_req, timeout=30) as resp:
    created = json.loads(resp.read().decode())
if created.get("name") != farm_name:
    raise SystemExit("create farm failed")
print("created persistence marker farm")
PY

echo "== compose restart =="
docker compose restart
echo "== wait for ready =="
for _ in $(seq 1 60); do
  if curl -sf "$BASE/api/v1/health/ready" | grep -q '"status":"ready"'; then
    break
  fi
  sleep 2
done
curl -sf "$BASE/api/v1/health/ready" | grep -q '"status":"ready"'

python3 - "$BASE" "$ORIGIN" "$COOKIE_JAR" <<'PY'
import json, os, sys, urllib.request
from pathlib import Path

base, origin, cookie_path = sys.argv[1:4]
_cookie, _csrf, farm_name = Path(cookie_path).read_text(encoding="utf-8").splitlines()[:3]
env = {}
env_path = Path(".env")
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
email = os.environ.get("E2E_FARMER_EMAIL") or env.get("E2E_FARMER_EMAIL") or "e2e.farmer@agrifusion.test"
password = os.environ.get("E2E_FARMER_PASSWORD") or env.get("E2E_FARMER_PASSWORD") or "E2eFarmer123!"
login_req = urllib.request.Request(
    f"{base}/api/v1/auth/login",
    data=json.dumps({"email": email, "password": password}).encode(),
    headers={"Content-Type": "application/json", "Origin": origin},
    method="POST",
)
with urllib.request.urlopen(login_req, timeout=30) as resp:
    body = json.loads(resp.read().decode())
    csrf = body["csrf_token"]
    cookie = resp.headers.get("Set-Cookie", "").split(";", 1)[0]
list_req = urllib.request.Request(
    f"{base}/api/v1/farms",
    headers={"Cookie": cookie, "Origin": origin},
)
with urllib.request.urlopen(list_req, timeout=30) as resp:
    farms = json.loads(resp.read().decode())
match = next((farm for farm in farms if farm.get("name") == farm_name), None)
if not match:
    raise SystemExit("persistence farm missing after compose restart")
delete_req = urllib.request.Request(
    f"{base}/api/v1/farms/{match['id']}",
    headers={
        "Content-Type": "application/json",
        "Origin": origin,
        "X-CSRF-Token": csrf,
        "Cookie": cookie,
    },
    method="DELETE",
)
with urllib.request.urlopen(delete_req, timeout=30):
    pass
print("compose restart persistence OK")
PY
