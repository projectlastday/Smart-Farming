# External adapters (NASA POWER and SoilGrids)

Harvest and soil remain **rules**. Live adapters add provenance and an optional duration heuristic. They never become a claimed calibrated ML model.

## NASA POWER

- Endpoint: `https://power.larc.nasa.gov/api/temporal/daily/point` (`T2M`, `PRECTOTCORR`, community `AG`).
- Coordinates: school location table (`Semarang`, `Demak`, default Central Java). No live geocoder.
- Timeout / retries / disk cache: `NASA_POWER_TIMEOUT_SECONDS`, `NASA_POWER_RETRIES`, `NASA_POWER_CACHE_TTL_HOURS`.
- Success `mode`: `live` or `cache`. Failure with no cache: `demo_fallback` (explicit message: not direct NASA observations).
- `duration_adjustment_days`: uncalibrated heuristic (mean T2M &lt; 24°C → +3 days, &gt; 30°C → −2). Documented on the payload.

Disable in tests via `NASA_POWER_ENABLED=false` (pytest conftest).

## SoilGrids

- Live: ISRIC REST `properties/query` (phh2o, nitrogen, 0–5 cm mean) when `SOILGRIDS_LIVE_ENABLED=true`.
- Always-on local demo JSON: `fixtures/soilgrids/central-java.json` (`mode: local_cache`) if live fails or is disabled.
- Regional context is **not** a laboratory measurement. UI copy stays honest.

## Provenance fields

Every adapter payload includes `source`, `adapter_version`, `retrieved_at` (or null), `mode`, and `live_attempted`.
