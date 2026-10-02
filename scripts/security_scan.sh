#!/usr/bin/env bash
# Dependency/security scan. Does not print secrets. Exit 1 on high/critical findings
# when the tooling is available; otherwise records that the scan was skipped.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATUS=0

echo "== backend pip-audit =="
if [[ -x "$ROOT/backend/.venv/bin/pip-audit" ]]; then
  "$ROOT/backend/.venv/bin/pip-audit" -r "$ROOT/backend/requirements.txt" || STATUS=1
elif "$ROOT/backend/.venv/bin/python" -c "import pip_audit" 2>/dev/null; then
  "$ROOT/backend/.venv/bin/python" -m pip_audit -r "$ROOT/backend/requirements.txt" || STATUS=1
else
  echo "pip-audit not installed. Policy: pip install pip-audit && re-run. See docs/security-scanning.md"
fi

echo "== frontend npm audit =="
if [[ -f "$ROOT/frontend/package-lock.json" ]]; then
  (cd "$ROOT/frontend" && npm audit --omit=dev --audit-level=high) || STATUS=1
else
  echo "frontend package-lock.json missing"
  STATUS=1
fi

exit "$STATUS"
