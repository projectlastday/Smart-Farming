# Dependency and security scanning policy

School prototype. No automated production patch train. Pins stay in `backend/requirements.txt` and `frontend/package-lock.json`.

## Cadence

- Before a public demo: run `./scripts/security_scan.sh`.
- Monthly, or after adding a dependency: re-run the same script and review high/critical items.
- Do not `npm update` / `pip install -U` blindly. Bump one package, run pytest + frontend tests + a smoke login.

## Commands

```bash
./scripts/security_scan.sh
# backend: pip-audit against requirements.txt (install pip-audit in backend/.venv if missing)
# frontend: npm audit --omit=dev --audit-level=high
```

Install pip-audit when missing:

```bash
backend/.venv/bin/pip install pip-audit
```

## What “pass” means

- High/critical issues are fixed, deferred with a written reason (transitive, no exploit path in this app), or the package is removed.
- Secrets stay out of Git (`.env`, dumps, ONNX licenses). Scanning does not print `.env`.
- Container images are version-pinned in `compose.yaml` (`mysql:8.4.3`, `nginx:1.27.3-alpine`, Python/Node Dockerfiles).

## 2026-09-01 scan (written deferrals)

`./scripts/security_scan.sh` exit 1. pip-audit reported advisories in pinned school versions; npm audit `--audit-level=high` had no high/critical (2 moderate on `react-router` 6.30.6).

| Package | Action |
|---|---|
| `starlette` 0.41.3 (via FastAPI 0.115.6) | Defer major 1.x. FastAPI pins Starlette; upgrade as a FastAPI release, then re-run pytest. |
| `cryptography` 44.0.0 | Defer 46/49/50 majors until after demo; used for Argon2/session hashing path, not TLS termination (Cloudflare). |
| `pillow` 11.0.0 | Defer 12.x major; disease preprocessing is calibrated on 11.0 decode. Re-run known-good fixtures after any bump. |
| `python-multipart` 0.0.19 | Defer patch train to 0.0.31 until a dedicated pytest/upload pass; uploads already cap size/type/pixels. |
| `pytest` 8.3.4 | Dev-only; no runtime exposure. |
| `react-router` / `react-router-dom` 6.30.6 | Moderate: SSR `deserializeErrors` does not apply (CSR Vite). Open-redirect via backslash in Link: app uses in-app paths, not user-supplied absolute URLs. Stay on v6 (v7 is a breaking change). |

## Out of policy

Dependabot auto-merge, unattended major upgrades, and publishing the school app as a hardened SaaS.
