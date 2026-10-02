# Performance budget (school v1)

## Queries

- `GET /predictions` filters in SQL (`user_id`, cycle, farm, feature, dates, JSON `$.status`) then `ORDER BY created_at DESC, id DESC` with `LIMIT/OFFSET`.
- Indexes: `ix_predictions_user_created`, `ix_predictions_cycle_feature_created`, `ix_predictions_user_cycle`, farm/cycle FKs, `ix_audit_logs_timestamp`, `ix_saved_images_created_at` (Alembic `0003_retention_indexes`).
- Pytest `test_predictions_explain_uses_user_created_index` checks EXPLAIN `possible_keys`/`key`.
- `latest_per_feature=true` remains an optional API mode for callers that need one result per feature; Analisis Tanaman uses the complete global list with server-side pagination.

## Uploads / inference

- `UPLOAD_MAX_BYTES` 10 MiB, `UPLOAD_MAX_PIXELS` 4096², EXIF stripped, temp files deleted.
- Disease POST is rate-limited (`UPLOAD_RATE_LIMIT` / window).
- Login/register/password have separate limits.

## Cache

- PWA Workbox: hashed assets, ORT WASM `CacheFirst` (25 MiB precache ceiling), disease model `CacheFirst`, farms/crop-cycles `NetworkFirst` (3s). `/auth/session` is not cached.
- NASA POWER / SoilGrids live JSON cached on disk with TTL (`docs/external-adapters.md`).
- HTML/SW `Cache-Control: no-cache` so deploys appear.

## Bundle

- Vite production build. ORT WASM is copied to `/ort/` and is the large artifact; JS SPA should stay well under 1.5 MiB uncompressed excluding WASM.
- After `npm run build`, inspect `frontend/dist/assets`. Workbox refuses files over 25 MiB (`maximumFileSizeToCacheInBytes`).
