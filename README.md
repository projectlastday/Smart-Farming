# AgriFusionNet

School agricultural decision-support PWA for rice and guava. Indonesian UI. Not a production agronomy service.

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

Open http://127.0.0.1:8005 (Compose proxy). Public tunnel: https://sf.projectdunia.my.id

Backend applies Alembic `head` and `seed-demo` on container start. MySQL data lives in the `mysql_data` volume.

### Demo accounts

Passwords are in `.env` / `.env.example` (defaults are classroom placeholders). Do not commit a live `.env`.

| Role | Email |
|------|-------|
| Superadmin | `superadmin@gmail.com` |
| Farmer (presentation) | `petani@gmail.com` |
| Farmer (Playwright only) | `e2e.farmer@agrifusion.test` |

Do not mix E2E farms into a live demo. Seeded presentation farms: **Sawah Ngemplak** (padi) and **Kebun Jambu Mulyorejo** (jambu).

`COOKIE_SECURE_ENABLED` must stay `false` for `http://127.0.0.1:8005`. Set `true` only on an HTTPS-only origin.

## Stack

- Frontend: React, TypeScript, Vite, PWA, TanStack Query, ONNX Runtime Web (local WASM, not CDN)
- Backend: FastAPI, SQLAlchemy 2, Alembic, MySQL 8.4
- Disease: MobileNetV3-Small ONNX trained on a real Paddy Doctor subset (`docs/model-disease.md`)
- Harvest, soil, rejuvenation, mapping: deterministic rules (`docs/rules.md`)
- Auth: opaque session cookies, CSRF header, farmer / admin / superadmin

## Tests

Backend pytest uses database `agrifusionnet_test`, not the demo DB. Create it once with `scripts/ensure_test_db.sh` (do not `source .env` in bash; unquoted values break the shell).

```bash
# Backend
cd backend && .venv/bin/pytest -q

# Frontend unit
cd frontend && npm test

# End-to-end (full Compose stack on :8005)
cd frontend && npx playwright install chromium
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8005 npm run test:e2e:desktop
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8005 npm run test:e2e:mobile
```

## Backup

```bash
./scripts/backup_mysql.sh          # gitignored dumps under backups/
./scripts/backup_restore_drill.sh  # isolated schema; does not touch agrifusionnet
```

ONNX weights (`models/*.onnx`) are gitignored. Place `models/disease_v1.onnx` next to `models/disease_v1.json` before classify/offline install.

## Documentation

- `HANDOFF.md` — scope, roles, architecture
- `IMPLEMENTATION-GOAL.md` — remediation checklist and implementation log
- `docs/model-disease.md` — dataset, license, split, metrics
- `docs/rules.md` — harvest / soil / rejuvenation / mapping
- `docs/DEMO.md` — presentation script
- `docs/scientific-limitations.md` — honesty constraints
- `docs/external-adapters.md` — NASA POWER / SoilGrids fallback and provenance
- `docs/ops-runbook.md` — Compose, tunnel, backup, rollback
- `docs/privacy-retention.md` — image/prediction/audit/account retention
- `docs/performance.md` — indexes, pagination, upload and cache budget
- `docs/security-scanning.md` — scan cadence and deferred advisories
- `docs/accessibility.md` / `docs/pwa.md` — automated vs physical-device checks
- `AUDIT-REPORT.md` — original audit (do not rewrite)
