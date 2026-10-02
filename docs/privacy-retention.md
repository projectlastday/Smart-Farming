# Privacy and retention lifecycle

Configured in `.env` (defaults in `backend/app/config.py`):

| Data | Default | Action |
|---|---|---|
| Saved disease images | 180 days | Delete DB row and file |
| Predictions | 730 days | Delete row (cascades images) |
| Audit logs | 365 days | Delete rows |
| Anonymized accounts | 90 days after `anonymized_at` | Hard-delete user (cascades farms/cycles/sessions/predictions) |

Run:

```bash
docker compose exec -T backend python -m app.cli retention-cleanup
```

Cron line: `scripts/print_backup_cron.sh`.

Anonymize (admin/superadmin) revokes sessions, replaces name/email, sets `anonymized`. No passwords or tokens are stored in audit metadata.

E2E data lives on `e2e.farmer@agrifusion.test`, not the presentation farmer. Preview cleanup: `scripts/preview_demo_cleanup.py` (preview only unless the owner confirms targets).
