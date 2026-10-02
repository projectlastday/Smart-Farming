# Feature rules (v1)

Harvest, soil, rejuvenation, and mapping are **deterministic rules**, not trained models. UI reliability uses `kind: rule_completeness` (“Keandalan aturan”), never a fake model probability.

## Rice harvest

- Source: variety duration priors in `backend/app/predictors/rules.py` (`RICE_VARIETIES`).
- Ciherang 115–125 days, IR64 110–115, Inpari 32 110–120 (from planting date, date-only, local calendar date).
- Optional NASA POWER weather is provenance/context only in v1; missing weather lowers rule completeness, it does not invent a calibrated ML confidence.
- Growth stages: `not_yet_planted`, `vegetative`, `reproductive`, `ripening`, `near_harvest`, `overdue`, `harvested`.
- Future planting → Belum Ditanam. After harvest window end → Jendela Panen Terlewat. `actual_harvest_date` → Sudah Dipanen and predicted-vs-actual delta is stored without rewriting the original prediction row.

## Soil

- pH classes: asam / netral / basa. Nitrogen bands: rendah < 0.12, sedang < 0.20, cukup otherwise (fractional N as entered by the user).
- Phosphorus rendah below 0.05; potassium rendah below 0.08.
- `input_provenance` must stay honest (`manual`, `lab`, or regional cache). SoilGrids, when present, is regional context, not a field measurement.

## Guava rejuvenation

- Score 0–6 from orchard age (≥10 / ≥15), productivity decline, and canopy condition.
- ≥4 `rejuvenation_candidate`, ≥2 `monitor`, else `continue_management`.
- Species-specific to jambu biji. Rice cycles return not-applicable.

## Mapping

- Demo raster: `fixtures/mapping/demo_raster.tif` (128×128, single band).
- Method: **single-band intensity threshold** at 100, **not NDVI** (no NIR band).
- Known fixture result: `crop_area_percent = 25.0` in `real_raster` mode.
- Missing raster → `deterministic_demo_fallback` with `crop_area_percent: null` and an explicit reason. Never the old constant 62.5.

## Disease (ML, documented separately)

See `docs/model-disease.md`. Visual-only MobileNetV3-Small on a real Paddy Doctor subset. Not a rule engine.
