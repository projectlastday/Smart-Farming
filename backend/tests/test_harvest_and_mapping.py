from datetime import date, timedelta

import numpy as np

from app.predictors.mapping import CROP_INTENSITY_THRESHOLD, MappingService
from app.predictors.rules import classify_growth_stage, predict_harvest
from app.config import ROOT_DIR


def test_harvest_future_planting_is_not_yet_planted():
    planting = date.today() + timedelta(days=10)
    result = predict_harvest(variety_key="ciherang", planting_date=planting, location="Semarang")
    assert result["growth_stage"] == "not_yet_planted"
    assert "confidence" not in result
    assert result["reliability"]["kind"] == "rule_completeness"


def test_harvest_overdue_after_window():
    planting = date.today() - timedelta(days=200)
    result = predict_harvest(variety_key="ciherang", planting_date=planting, location="Semarang")
    assert result["growth_stage"] == "overdue"


def test_harvest_uses_actual_harvest_stage():
    planting = date.today() - timedelta(days=40)
    actual = date.today() - timedelta(days=1)
    result = predict_harvest(
        variety_key="ciherang",
        planting_date=planting,
        location="Semarang",
        actual_harvest_date=actual,
    )
    assert result["growth_stage"] == "harvested"
    assert result["predicted_vs_actual"]["delta_days_from_window_mid"] is not None


def test_stage_boundaries():
    planting = date(2026, 1, 1)
    start = date(2026, 4, 26)
    end = date(2026, 5, 6)
    assert classify_growth_stage(planting_date=planting, harvest_start=start, harvest_end=end, today=date(2025, 12, 31)) == "not_yet_planted"
    assert classify_growth_stage(planting_date=planting, harvest_start=start, harvest_end=end, today=date(2026, 1, 10)) == "vegetative"
    assert classify_growth_stage(planting_date=planting, harvest_start=start, harvest_end=end, today=date(2026, 2, 15)) == "reproductive"
    assert classify_growth_stage(planting_date=planting, harvest_start=start, harvest_end=end, today=date(2026, 3, 20)) == "ripening"
    assert classify_growth_stage(planting_date=planting, harvest_start=start, harvest_end=end, today=start) == "near_harvest"
    assert classify_growth_stage(planting_date=planting, harvest_start=start, harvest_end=end, today=end + timedelta(days=1)) == "overdue"
    assert classify_growth_stage(
        planting_date=planting,
        harvest_start=start,
        harvest_end=end,
        today=date.today(),
        actual_harvest_date=date(2026, 5, 1),
    ) == "harvested"


def test_mapping_computes_known_area_from_fixture():
    raster = ROOT_DIR / "fixtures" / "mapping" / "demo_raster.tif"
    assert raster.exists(), "Demo raster fixture is required for mapping tests"
    result = MappingService().analyze(fixture_path=str(raster))
    assert result["mode"] == "real_raster"
    percent = result["segmentation_summary"]["crop_area_percent"]
    assert percent != 62.5
    assert percent == 25.0
    assert result["segmentation_summary"]["threshold"] == CROP_INTENSITY_THRESHOLD


def test_mapping_fallback_is_separate():
    result = MappingService().analyze(fixture_path="/nonexistent/path.tif")
    assert result["mode"] == "deterministic_demo_fallback"
    assert result["segmentation_summary"]["crop_area_percent"] is None


def test_mapping_area_changes_when_raster_changes(tmp_path):
    import rasterio
    from rasterio.transform import from_origin

    transform = from_origin(110.0, -6.8, 0.001, 0.001)
    profile = {
        "driver": "GTiff",
        "height": 4,
        "width": 4,
        "count": 1,
        "dtype": "uint8",
        "crs": "EPSG:4326",
        "transform": transform,
        "nodata": 0,
    }
    sparse = np.array(
        [[200, 200, 10, 10], [200, 200, 10, 10], [10, 10, 10, 10], [10, 10, 10, 10]],
        dtype=np.uint8,
    )
    full = np.full((4, 4), 200, dtype=np.uint8)
    sparse_path = tmp_path / "sparse.tif"
    full_path = tmp_path / "full.tif"
    with rasterio.open(sparse_path, "w", **profile) as dst:
        dst.write(sparse, 1)
    with rasterio.open(full_path, "w", **profile) as dst:
        dst.write(full, 1)

    sparse_pct = MappingService().analyze(fixture_path=str(sparse_path))["segmentation_summary"][
        "crop_area_percent"
    ]
    full_pct = MappingService().analyze(fixture_path=str(full_path))["segmentation_summary"][
        "crop_area_percent"
    ]
    assert sparse_pct == 25.0
    assert full_pct == 100.0
    assert sparse_pct != full_pct
