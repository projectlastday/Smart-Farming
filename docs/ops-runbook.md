# Operations runbook

School Compose stack: MySQL 8.4, FastAPI backend, Vite/nginx frontend, nginx proxy on **8005**, optional Cloudflare Tunnel to `https://sf.projectdunia.my.id`. Native Android, extra crops, Copernicus live pipeline, and six separate ML models are out of scope.

## Local start / restart

```bash
cp .env.example .env   # edit secrets locally; never commit .env
docker compose up --build -d
curl -sS http://127.0.0.1:8005/api/v1/health/ready
```

- App URL: `http://127.0.0.1:8005`
- MySQL published only on `127.0.0.1:3307`
- Backend applies Alembic `head`, `seed-demo`, and `apply-credentials` on start
- `COOKIE_SECURE_ENABLED` must stay `false` for HTTP :8005

Restart one service without wiping data:

```bash
docker compose restart backend frontend proxy
```

Compose named volume `mysql_data` survives container recreate. Recreate backend/frontend images with `docker compose up -d --build backend frontend` (`--no-deps` if you must avoid cycling MySQL).

## Domain / Cloudflare Tunnel

1. Tunnel origin is this Compose proxy (`http://127.0.0.1:8005` or the docker network equivalent).
2. Public hostname: `sf.projectdunia.my.id` (also `PUBLIC_ORIGIN`).
3. Cloudflare terminates TLS. The origin listener is HTTP.
4. Enable **HSTS on the Cloudflare edge** for the public hostname. Origin nginx sends HSTS only on `server_name sf.projectdunia.my.id`, never on `127.0.0.1` / `localhost`.
5. Backend also adds `Strict-Transport-Security` when `Host` matches `PUBLIC_ORIGIN` and the request is HTTPS (`X-Forwarded-Proto` or `CF-Visitor`).

Do not set `COOKIE_SECURE_ENABLED=true` while anyone still uses `http://127.0.0.1:8005`.

## Backup

Nightly dump (host crontab; print the lines first):

```bash
./scripts/print_backup_cron.sh
./scripts/backup_mysql.sh
```

Dumps land in `backups/` (gitignored). Restore into a **named** database only:

```bash
TARGET_DB=agrifusionnet_restore CONFIRM_RESTORE=agrifusionnet_restore \
  ./scripts/restore_mysql.sh backups/agrifusionnet-YYYYMMDDTHHMMSSZ.sql
```

Restoring over the live demo DB requires `TARGET_DB=agrifusionnet` **and** `CONFIRM_PRODUCTION=agrifusionnet`. Do not do that without an owner decision.

## Restore drill (isolated schema)

```bash
./scripts/backup_restore_drill.sh
# or, using the test DB privileges:
cd backend && .venv/bin/python -m app.cli backup-drill
```

The drill creates `agrifusionnet_drill_*` (or a temporary table in `agrifusionnet_test`), dumps, drops, restores, checks a marker row, then deletes the drill schema. It never writes into `agrifusionnet`.

Weekly cron line is included in `print_backup_cron.sh`.

## Retention

```bash
docker compose exec -T backend python -m app.cli retention-cleanup
```

See `docs/privacy-retention.md`.

## Rollback

1. Keep the previous dump from `backups/`.
2. `git checkout` the last known-good commit (working tree on `audit-remediation` may still be uncommitted — do not assume Git is the only recovery).
3. `docker compose up --build -d`
4. If the schema moved forward, restore the dump into a scratch DB, verify, then owner-approve production restore.
5. Model file `models/disease_v1.onnx` is not in Git; restore it from the operator’s copy. Checksum is in `models/disease_v1.json` / `docs/model-disease.md`.

## Recovery

| Failure | Action |
|---|---|
| Proxy 502 | `docker compose ps`; `docker compose logs backend --tail=80`; restart backend then proxy |
| MySQL unhealthy | Do not delete `mysql_data`. Check `docker compose logs mysql`. |
| Empty demo farms | `docker compose exec backend python -m app.cli seed-demo` (idempotent) |
| Tunnel down | Cloudflare dashboard; origin `curl` :8005 still works locally |
| Rate-limit 429 in class | `LOGIN_RATE_LIMIT` (default 120 / 60s) |

## Health

- `GET /api/v1/health/live` — process up
- `GET /api/v1/health/ready` — MySQL + disease ONNX present
- `GET /api/v1/metrics` — in-process counters (no PII)
- JSON logs on stdout with `request_id`; proxy echoes `X-Request-ID`
